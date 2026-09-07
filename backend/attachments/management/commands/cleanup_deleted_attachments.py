from django.core.management.base import BaseCommand

from attachments.services import purge_expired_deleted_attachments


class Command(BaseCommand):
    help = "Permanently delete Patient attachments whose five-second Undo expired."

    def handle(self, *args, **options):
        deleted = purge_expired_deleted_attachments()
        self.stdout.write(
            self.style.SUCCESS(f"Permanently deleted {deleted} Patient attachment(s).")
        )
