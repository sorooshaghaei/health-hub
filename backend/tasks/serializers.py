from rest_framework import serializers

from .models import SharedTask, TaskComment


def staff_summary(user):
    if user is None:
        return None
    display_name = f"{user.first_name} {user.last_name}".strip() or user.username
    return {
        "id": user.id,
        "display_name": display_name,
        "role": user.role,
    }


class TaskWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=200, trim_whitespace=True)
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=True,
    )
    due_date = serializers.DateField(required=False, allow_null=True)
    patient_id = serializers.UUIDField(required=False, allow_null=True)


class TaskCommentWriteSerializer(serializers.Serializer):
    body = serializers.CharField(trim_whitespace=True, allow_blank=False)


class TaskCommentSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()

    class Meta:
        model = TaskComment
        fields = [
            "id",
            "body",
            "author",
            "created_at",
            "edited_at",
        ]

    def get_author(self, obj):
        return staff_summary(obj.author)


class SharedTaskSerializer(serializers.ModelSerializer):
    patient = serializers.SerializerMethodField()
    created_by = serializers.SerializerMethodField()
    completed_by = serializers.SerializerMethodField()
    comments = serializers.SerializerMethodField()

    class Meta:
        model = SharedTask
        fields = [
            "id",
            "title",
            "description",
            "due_date",
            "status",
            "patient",
            "created_by",
            "completed_at",
            "completed_by",
            "created_at",
            "updated_at",
            "comments",
        ]

    def get_patient(self, obj):
        patient = obj.patient
        if patient is None or patient.deleted_at is not None:
            return None
        return {
            "id": str(patient.id),
            "full_name": patient.full_name,
        }

    def get_created_by(self, obj):
        return staff_summary(obj.created_by)

    def get_completed_by(self, obj):
        return staff_summary(obj.completed_by)

    def get_comments(self, obj):
        comments = TaskComment.objects.filter(task=obj).select_related("author")
        return TaskCommentSerializer(comments, many=True).data
