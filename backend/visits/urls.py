from django.urls import path

from .views import (
    RoomReadyView,
    UndoRoomReadyView,
    VisitCheckInView,
    VisitDetailView,
    VisitListCreateView,
    VisitQueueView,
    VisitRoomStateView,
    VisitUndoCheckInView,
    VisitUndoDeleteView,
    VisitUndoWithDoctorView,
    VisitWithDoctorView,
)

urlpatterns = [
    path("visits/", VisitListCreateView.as_view(), name="visit-list-create"),
    path("visits/queue/", VisitQueueView.as_view(), name="visit-queue"),
    path("visits/room-state/", VisitRoomStateView.as_view(), name="visit-room-state"),
    path("visits/room-ready/", RoomReadyView.as_view(), name="visit-room-ready"),
    path(
        "visits/room-ready/undo/",
        UndoRoomReadyView.as_view(),
        name="visit-room-ready-undo",
    ),
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
        "visits/<uuid:visit_id>/with-doctor/",
        VisitWithDoctorView.as_view(),
        name="visit-with-doctor",
    ),
    path(
        "visits/<uuid:visit_id>/undo-with-doctor/",
        VisitUndoWithDoctorView.as_view(),
        name="visit-undo-with-doctor",
    ),
    path(
        "visits/<uuid:visit_id>/undo-delete/",
        VisitUndoDeleteView.as_view(),
        name="visit-undo-delete",
    ),
]
