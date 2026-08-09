from rest_framework.exceptions import PermissionDenied

from .models import StaffUser


def active_workspace_role(request):
    return (
        getattr(request.auth, "workspace_role", None)
        or getattr(request.user, "role", None)
    )


def require_assistant_workspace(request):
    if active_workspace_role(request) != StaffUser.Role.ASSISTANT:
        raise PermissionDenied(
            "Open the Assistant workspace to manage Patients and appointments."
        )


def require_doctor_workspace(request):
    if active_workspace_role(request) != StaffUser.Role.DOCTOR:
        raise PermissionDenied(
            "Open the Doctor workspace to signal that the room is ready."
        )
