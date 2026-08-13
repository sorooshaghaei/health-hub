from django.contrib import admin

from .models import SharedTask, TaskComment


@admin.register(SharedTask)
class SharedTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "clinic", "status", "due_date", "created_at")
    list_filter = ("status", "clinic")
    search_fields = ("title", "description")


@admin.register(TaskComment)
class TaskCommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "created_at", "edited_at")
    list_filter = ("task__clinic",)
