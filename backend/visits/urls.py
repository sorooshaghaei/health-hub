from django.urls import path

from .views import (
    VisitCheckInView,
    VisitDetailView,
    VisitListCreateView,
    VisitQueueView,
    VisitUndoCheckInView,
    VisitUndoDeleteView,
)

urlpatterns = [
    path("visits/", VisitListCreateView.as_view(), name="visit-list-create"),
    path("visits/queue/", VisitQueueView.as_view(), name="visit-queue"),
    path("visits/<uuid:visit_id>/", VisitDetailView.as_view(), name="visit-detail"),
    path(
        "visits/<uuid:visit_id>/check-in/",
        VisitCheckInView.as_view(),
        name="visit-check-in",
    ),
    path(
        "visits/<uuid:visit_id>/undo-check-in/",
        VisitUndoCheckInView.as_view(),
        name="visit-undo-check-in",
    ),
    path(
        "visits/<uuid:visit_id>/undo-delete/",
        VisitUndoDeleteView.as_view(),
        name="visit-undo-delete",
    ),
]
