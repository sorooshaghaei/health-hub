import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

from accounts.models import Clinic, StaffUser
from patients.models import Patient

TASK_UNDO_SECONDS = 5


class ActiveTaskManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class SharedTask(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        DONE = "done", "Done"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name="shared_tasks",
    )
    created_by = models.ForeignKey(
        StaffUser,
        on_delete=models.PROTECT,
        related_name="created_shared_tasks",
    )
    patient = models.ForeignKey(
        Patient,
        on_delete=models.SET_NULL,
        related_name="shared_tasks",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=8,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True, editable=False)
    completed_by = models.ForeignKey(
        StaffUser,
        on_delete=models.SET_NULL,
        related_name="completed_shared_tasks",
        null=True,
        blank=True,
    )
    deleted_at = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveTaskManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["clinic", "status", "created_at"], name="task_clinic_status_idx"),
            models.Index(fields=["clinic", "completed_at"], name="task_clinic_done_idx"),
        ]

    def __str__(self):
        return self.title

    @property
    def done_undo_until(self):
        if self.completed_at is None:
            return None
        return self.completed_at + timedelta(seconds=TASK_UNDO_SECONDS)

    @property
    def delete_undo_until(self):
        if self.deleted_at is None:
            return None
        return self.deleted_at + timedelta(seconds=TASK_UNDO_SECONDS)

    def mark_done(self, user):
        now = timezone.now()
        self.status = self.Status.DONE
        self.completed_at = now
        self.completed_by = user
        self.save(update_fields=["status", "completed_at", "completed_by", "updated_at"])

    def undo_done(self):
        self.status = self.Status.OPEN
        self.completed_at = None
        self.completed_by = None
        self.save(update_fields=["status", "completed_at", "completed_by", "updated_at"])

    def soft_delete(self):
        if self.deleted_at is None:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self):
        if self.deleted_at is not None:
            self.deleted_at = None
            self.save(update_fields=["deleted_at", "updated_at"])


class ActiveTaskCommentManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class TaskComment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        SharedTask,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        StaffUser,
        on_delete=models.PROTECT,
        related_name="shared_task_comments",
    )
    body = models.TextField()
    edited_at = models.DateTimeField(null=True, blank=True, editable=False)
    deleted_at = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveTaskCommentManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["task", "created_at"], name="task_comment_order_idx"),
        ]

    def __str__(self):
        return f"Comment on {self.task_id}"

    @property
    def delete_undo_until(self):
        if self.deleted_at is None:
            return None
        return self.deleted_at + timedelta(seconds=TASK_UNDO_SECONDS)

    def soft_delete(self):
        if self.deleted_at is None:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self):
        if self.deleted_at is not None:
            self.deleted_at = None
            self.save(update_fields=["deleted_at", "updated_at"])
