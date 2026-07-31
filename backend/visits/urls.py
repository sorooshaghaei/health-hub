from django.urls import path

from .views import VisitDetailView, VisitListCreateView

urlpatterns = [
    path("visits/", VisitListCreateView.as_view(), name="visit-list-create"),
    path("visits/<uuid:visit_id>/", VisitDetailView.as_view(), name="visit-detail"),
]
