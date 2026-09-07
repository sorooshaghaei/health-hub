import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",") if host.strip()]

INSTALLED_APPS = [
    "django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes",
    "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles",
    "rest_framework", "accounts", "patients", "visits", "tasks",
    "attachments.apps.AttachmentsConfig",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware", "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware", "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware", "accounts.middleware.ClinicTimeZoneResetMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware", "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "health_hub.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]
WSGI_APPLICATION = "health_hub.wsgi.application"
ASGI_APPLICATION = "health_hub.asgi.application"
TEST_RUNNER = "health_hub.test_runner.HealthHubDiscoverRunner"

if os.getenv("USE_SQLITE", "false").lower() == "true":
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.postgresql", "NAME": os.getenv("POSTGRES_DB", "health_hub"), "USER": os.getenv("POSTGRES_USER", "health_hub"), "PASSWORD": os.getenv("POSTGRES_PASSWORD", "health_hub_dev_password"), "HOST": os.getenv("POSTGRES_HOST", "127.0.0.1"), "PORT": os.getenv("POSTGRES_PORT", "5432"), "CONN_MAX_AGE": 60}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
AUTH_USER_MODEL = "accounts.StaffUser"
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
PRIVATE_MEDIA_PATH = Path(os.getenv("PRIVATE_MEDIA_ROOT", "private_media"))
MEDIA_ROOT = (
    PRIVATE_MEDIA_PATH
    if PRIVATE_MEDIA_PATH.is_absolute()
    else BASE_DIR / PRIVATE_MEDIA_PATH
)
STORAGES = {
    "default": {
        "BACKEND": os.getenv(
            "PRIVATE_FILE_STORAGE_BACKEND",
            "django.core.files.storage.FileSystemStorage",
        ),
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["accounts.authentication.StaffSessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

DEVICE_PAIRING_MAX_AGE = int(os.getenv("DEVICE_PAIRING_MAX_AGE", "600"))
STAFF_SESSION_MAX_AGE = int(os.getenv("STAFF_SESSION_MAX_AGE", "43200"))
STAFF_SESSION_INACTIVITY_AGE = int(os.getenv("STAFF_SESSION_INACTIVITY_AGE", "7200"))
REAUTH_MAX_AGE = int(os.getenv("REAUTH_MAX_AGE", "600"))
VERIFICATION_CODE_MAX_AGE = int(os.getenv("VERIFICATION_CODE_MAX_AGE", "600"))
VERIFICATION_RESEND_MIN_AGE = int(os.getenv("VERIFICATION_RESEND_MIN_AGE", "60"))
VERIFICATION_MAX_ATTEMPTS = int(os.getenv("VERIFICATION_MAX_ATTEMPTS", "5"))
RECOVERY_GRANT_MAX_AGE = int(os.getenv("RECOVERY_GRANT_MAX_AGE", "1800"))
ASSISTANT_SETUP_MAX_AGE = int(os.getenv("ASSISTANT_SETUP_MAX_AGE", "86400"))
PASSKEY_CHALLENGE_MAX_AGE = int(os.getenv("PASSKEY_CHALLENGE_MAX_AGE", "300"))
WEBAUTHN_RP_ID = os.getenv("WEBAUTHN_RP_ID", "localhost")
WEBAUTHN_RP_NAME = os.getenv("WEBAUTHN_RP_NAME", "Health Hub")
WEBAUTHN_ORIGIN = os.getenv("WEBAUTHN_ORIGIN", "http://localhost:5173")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no-reply@health-hub.local")
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.locmem.EmailBackend")
SMS_SENDER = os.getenv("SMS_SENDER", "")

PATIENT_ATTACHMENT_MAX_BYTES = int(
    os.getenv("PATIENT_ATTACHMENT_MAX_BYTES", str(100 * 1024 * 1024))
)
PATIENT_ATTACHMENT_MAX_BATCH = int(os.getenv("PATIENT_ATTACHMENT_MAX_BATCH", "10"))
PATIENT_ATTACHMENT_PAGE_SIZE = int(os.getenv("PATIENT_ATTACHMENT_PAGE_SIZE", "50"))
PATIENT_ATTACHMENT_DELETE_UNDO_SECONDS = int(
    os.getenv("PATIENT_ATTACHMENT_DELETE_UNDO_SECONDS", "5")
)
