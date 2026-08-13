from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StaffUser
from patients.models import Patient
from patients.views import clinic_for_staff

from .models import SharedTask, TaskComment
from .serializers import (
    SharedTaskSerializer,
    TaskCommentSerializer,
    TaskCommentWriteSerializer,
    TaskWriteSerializer,
)


def require_doctor_account(request):
    if request.user.role != StaffUser.Role.DOCTOR:
        raise PermissionDenied("Only the Doctor can create, edit, or remove shared tasks.")


def active_task_for_request(request, task_id, *, lock=False):
    clinic = clinic_for_staff(request)
    queryset = SharedTask.objects.select_related("patient", "created_by", "completed_by").filter(clinic=clinic)
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=task_id)
    except SharedTask.DoesNotExist:
        raise NotFound("Task not found.")


def deleted_task_for_request(request, task_id, *, lock=False):
    clinic = clinic_for_staff(request)
    queryset = SharedTask.all_objects.select_related("patient", "created_by", "completed_by").filter(
        clinic=clinic, deleted_at__isnull=False
    )
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=task_id)
    except SharedTask.DoesNotExist:
        raise NotFound("Deleted task not found.")


def active_comment_for_request(request, comment_id, *, lock=False):
    clinic = clinic_for_staff(request)
    queryset = TaskComment.objects.select_related("author", "task").filter(
        task__clinic=clinic, task__deleted_at__isnull=True
    )
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=comment_id)
    except TaskComment.DoesNotExist:
        raise NotFound("Comment not found.")


def deleted_comment_for_request(request, comment_id, *, lock=False):
    clinic = clinic_for_staff(request)
    queryset = TaskComment.all_objects.select_related("author", "task").filter(
        task__clinic=clinic, task__deleted_at__isnull=True, deleted_at__isnull=False
    )
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=comment_id)
    except TaskComment.DoesNotExist:
        raise NotFound("Deleted comment not found.")


def patient_for_task(clinic, patient_id):
    if patient_id is None:
        return None
    try:
        return Patient.objects.get(pk=patient_id, clinic=clinic)
    except Patient.DoesNotExist:
        raise NotFound("Patient not found.")


def ensure_task_creator(request, task):
    require_doctor_account(request)
    if task.created_by_id != request.user.id:
        raise PermissionDenied("Only the Doctor who created this task can edit it.")


class SharedTaskListCreateView(APIView):
    def get(self, request):
        clinic = clinic_for_staff(request)
        base = SharedTask.objects.select_related("patient", "created_by", "completed_by").filter(clinic=clinic)
        open_tasks = base.filter(status=SharedTask.Status.OPEN).order_by("created_at", "id")
        completed_tasks = base.filter(status=SharedTask.Status.DONE).order_by("-completed_at", "-created_at", "-id")
        return Response({
            "open_tasks": SharedTaskSerializer(open_tasks, many=True).data,
            "completed_tasks": SharedTaskSerializer(completed_tasks, many=True).data,
        })

    def post(self, request):
        require_doctor_account(request)
        clinic = clinic_for_staff(request)
        serializer = TaskWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        task = SharedTask.objects.create(
            clinic=clinic,
            created_by=request.user,
            patient=patient_for_task(clinic, data.get("patient_id")),
            title=data["title"],
            description=data.get("description", ""),
            due_date=data.get("due_date"),
        )
        return Response(SharedTaskSerializer(task).data, status=status.HTTP_201_CREATED)


class SharedTaskDetailView(APIView):
    def get(self, request, task_id):
        return Response(SharedTaskSerializer(active_task_for_request(request, task_id)).data)

    def patch(self, request, task_id):
        task = active_task_for_request(request, task_id)
        ensure_task_creator(request, task)
        serializer = TaskWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if "title" in data:
            task.title = data["title"]
        if "description" in data:
            task.description = data["description"]
        if "due_date" in data:
            task.due_date = data["due_date"]
        if "patient_id" in data:
            task.patient = patient_for_task(task.clinic, data["patient_id"])
        task.save()
        return Response(SharedTaskSerializer(task).data)

    def delete(self, request, task_id):
        require_doctor_account(request)
        with transaction.atomic():
            task = active_task_for_request(request, task_id, lock=True)
            task.soft_delete()
        return Response({
            "code": "task_deleted",
            "detail": "Task deleted.",
            "task_id": str(task.id),
            "undo_until": task.delete_undo_until,
        })


class SharedTaskDoneView(APIView):
    def post(self, request, task_id):
        with transaction.atomic():
            task = active_task_for_request(request, task_id, lock=True)
            if task.status != SharedTask.Status.OPEN:
                return Response({"code": "task_already_done", "detail": "This task is already done."}, status=status.HTTP_409_CONFLICT)
            task.mark_done(request.user)
        return Response({
            "code": "task_done",
            "detail": "Task marked done.",
            "task": SharedTaskSerializer(task).data,
            "undo_until": task.done_undo_until,
        })


class SharedTaskUndoDoneView(APIView):
    def post(self, request, task_id):
        with transaction.atomic():
            task = active_task_for_request(request, task_id, lock=True)
            if task.status != SharedTask.Status.DONE or task.done_undo_until is None:
                return Response({"code": "task_not_done", "detail": "This task is not done."}, status=status.HTTP_400_BAD_REQUEST)
            if timezone.now() > task.done_undo_until:
                return Response({"code": "undo_expired", "detail": "The five-second Undo period has expired."}, status=status.HTTP_400_BAD_REQUEST)
            task.undo_done()
        return Response(SharedTaskSerializer(task).data)


class SharedTaskUndoDeleteView(APIView):
    def post(self, request, task_id):
        require_doctor_account(request)
        with transaction.atomic():
            task = deleted_task_for_request(request, task_id, lock=True)
            if timezone.now() > task.delete_undo_until:
                return Response({"code": "undo_expired", "detail": "The five-second Undo period has expired."}, status=status.HTTP_400_BAD_REQUEST)
            task.restore()
        return Response(SharedTaskSerializer(task).data)


class TaskCommentCreateView(APIView):
    def post(self, request, task_id):
        task = active_task_for_request(request, task_id)
        serializer = TaskCommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = TaskComment.objects.create(task=task, author=request.user, body=serializer.validated_data["body"])
        return Response(TaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class TaskCommentDetailView(APIView):
    def patch(self, request, comment_id):
        comment = active_comment_for_request(request, comment_id)
        if comment.author_id != request.user.id:
            raise PermissionDenied("You can edit only your own comments.")
        serializer = TaskCommentWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment.body = serializer.validated_data["body"]
        comment.edited_at = timezone.now()
        comment.save(update_fields=["body", "edited_at", "updated_at"])
        return Response(TaskCommentSerializer(comment).data)

    def delete(self, request, comment_id):
        with transaction.atomic():
            comment = active_comment_for_request(request, comment_id, lock=True)
            if comment.author_id != request.user.id:
                raise PermissionDenied("You can delete only your own comments.")
            comment.soft_delete()
        return Response({
            "code": "task_comment_deleted",
            "detail": "Comment deleted.",
            "comment_id": str(comment.id),
            "undo_until": comment.delete_undo_until,
        })


class TaskCommentUndoDeleteView(APIView):
    def post(self, request, comment_id):
        with transaction.atomic():
            comment = deleted_comment_for_request(request, comment_id, lock=True)
            if comment.author_id != request.user.id:
                raise PermissionDenied("You can undo only your own comment deletion.")
            if timezone.now() > comment.delete_undo_until:
                return Response({"code": "undo_expired", "detail": "The five-second Undo period has expired."}, status=status.HTTP_400_BAD_REQUEST)
            comment.restore()
        return Response(TaskCommentSerializer(comment).data)
