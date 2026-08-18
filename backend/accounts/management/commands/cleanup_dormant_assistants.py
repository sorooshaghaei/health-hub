from django.core.management.base import BaseCommand

from accounts.services import anonymize_dormant_assistants


class Command(BaseCommand):
    help = "Anonymize Assistant accounts that have had no active clinic membership for two years."

    def handle(self, *args, **options):
        count = anonymize_dormant_assistants()
        self.stdout.write(self.style.SUCCESS(f"Anonymized {count} dormant Assistant account(s)."))
