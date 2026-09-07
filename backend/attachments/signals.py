from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import PatientAttachment


@receiver(post_delete, sender=PatientAttachment)
def remove_stored_attachment_after_commit(sender, instance, **kwargs):
    if not instance.file or not instance.file.name:
        return
    storage = instance.file.storage
    stored_name = instance.file.name
    transaction.on_commit(lambda: storage.delete(stored_name))
