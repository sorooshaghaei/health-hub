from django.urls import path

from .views import (
    SharedTaskAttentionView,
    SharedTaskDetailView,
    SharedTaskDoneView,
    SharedTaskListCreateView,
    SharedTaskUndoDeleteView,
    SharedTaskUndoDoneView,
    TaskCommentCreateView,
    TaskCommentDetailView,
    TaskCommentUndoDeleteView,
)

urlpatterns = [
    path("tasks/", SharedTaskListCreateView.as_view(), name="shared-task-list"),
    path("tasks/attention/", SharedTaskAttentionView.as_view(), name="shared-task-attention"),
    path("tasks/<uuid:task_id>/", SharedTaskDetailView.as_view(), name="shared-task-detail"),
    path("tasks/<uuid:task_id>/done/", SharedTaskDoneView.as_view(), name="shared-task-done"),
    path("tasks/<uuid:task_id>/undo-done/", SharedTaskUndoDoneView.as_view(), name="shared-task-undo-done"),
    path("tasks/<uuid:task_id>/undo-delete/", SharedTaskUndoDeleteView.as_view(), name="shared-task-undo-delete"),
    path("tasks/<uuid:task_id>/comments/", TaskCommentCreateView.as_view(), name="shared-task-comment-create"),
    path("task-comments/<uuid:comment_id>/", TaskCommentDetailView.as_view(), name="shared-task-comment-detail"),
    path("task-comments/<uuid:comment_id>/undo-delete/", TaskCommentUndoDeleteView.as_view(), name="shared-task-comment-undo-delete"),
]
