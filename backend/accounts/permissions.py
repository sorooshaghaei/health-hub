from rest_framework.exceptions import PermissionDenied

from .models import StaffUser


def active_membership(request, *, require_verified=True):
    membership = getattr(getattr(request, "auth", None), "membership", None)
    if membership is None or membership.user_id != getattr(request.user, "id", None) or not membership.is_active:
        raise PermissionDenied("Choose a clinic before opening clinic data.")
    if require_verified and not request.user.contacts_verified:
        raise PermissionDenied("Verify both email and phone before opening clinic data.")
    return membership


def active_clinic(request, *, require_verified=True):
    return active_membership(request, require_verified=require_verified).clinic


def active_membership_role(request, *, require_verified=True):
    return active_membership(request, require_verified=require_verified).role


def active_workspace_role(request):
    return getattr(getattr(request, "auth", None), "workspace_role", None) or None


def require_assistant_workspace(request):
    active_membership(request)
    if active_workspace_role(request) != StaffUser.Role.ASSISTANT:
        raise PermissionDenied("Open the Assistant workspace to manage Patients and appointments.")


def require_doctor_workspace(request):
    membership = active_membership(request)
    if membership.role != StaffUser.Role.DOCTOR or active_workspace_role(request) != StaffUser.Role.DOCTOR:
        raise PermissionDenied("Open the Doctor workspace to signal that the room is ready.")
