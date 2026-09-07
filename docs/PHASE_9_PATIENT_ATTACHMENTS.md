# Phase 9 — Secure Patient attachments

## Status

The product contract was clarified and approved before implementation.

**Phase 9 is complete and reconciled.**

Phase 9 was delivered in four separately reviewed parts:

1. **Specification and backend foundation — implemented:** private provider-neutral storage, attachment metadata, validation/conversion, duplicate protection, clinic-scoped APIs, preview/download streaming, rename, five-second delete Undo, permanent cleanup, migrations, and backend tests.
2. **Production Patient-profile interface — implemented:** shared Doctor/Assistant attachment UI, picker, desktop drag/drop, progress, preview/download, search, rename, delete, and Undo.
3. **GitHub Pages demo parity — implemented:** the same production React UI backed by actual browser-local file bytes in IndexedDB, with local HEIC/HEIF conversion and lifecycle parity.
4. **Full reconciliation — implemented:** cross-layer validation, responsive/accessibility corrections, deterministic dependency installation, expanded regression coverage, and final documentation alignment.

This document remains the approved Phase 9 contract. Subsequent changes must not reinterpret it without explicit product-owner approval.

## Scope and ownership

An attachment belongs directly to one existing Patient.

- The Patient must exist before a file can be uploaded.
- Attachments appear only in that Patient's profile.
- There are no Appointment, task, consultation, private-sticky, or other attachment targets.
- There are no folders, categories, tags, descriptions, or manual ordering.
- A Patient may have an unlimited number of attachments. Lists use 50-row pages.

## Authorization and isolation

Doctor and Assistant accounts have equal attachment permissions inside an active clinic membership. A Doctor using the Assistant workspace as administrator keeps the same attachment permissions.

Both roles may:

- list and search;
- upload;
- preview and download;
- rename;
- delete and Undo deletion.

Every metadata and content request resolves the Patient through the requester's active clinic. A Patient or attachment from another clinic returns the same not-found response as a nonexistent resource. Stored objects never have public product URLs.

## Patient-profile presentation

The attachment area shows newest uploads first and displays:

- editable document name;
- immutable original upload filename;
- stored file type and size;
- upload date and time;
- uploader identity.

If an Assistant uploader is later anonymized, the identity displays as **Former Assistant**, consistent with task history.

Search is case-insensitive and matches the current document name only. It does not match original filename, uploader, type, or date.

## Upload interaction

The Patient profile provides an **Add files** action with the standard system file picker on every device. Desktop also supports drag and drop. One upload batch may contain at most 10 files.

Each file has independent progress, success, or error feedback. Valid files in a mixed batch succeed even if other files fail. Failed files may be retried or removed without reselecting successful files.

There are no upload notifications, sounds, badges, or background polling. Attachment data refreshes when a Patient is opened and after an attachment mutation.

## Accepted files and conversion

The maximum input or converted output size is 100 MB (104,857,600 bytes) per file.

Accepted input extensions:

- `.pdf`;
- `.jpg` and `.jpeg`;
- `.png`;
- `.heic` and `.heif`.

The backend validates the filename extension, reported MIME type, and file signature/decodability. Invalid, mismatched, empty, unsafe, or oversized files are rejected per file.

HEIC and HEIF inputs are decoded server-side:

- ordinary images become JPEG;
- images with transparency become PNG;
- orientation metadata is applied during conversion;
- only the converted browser-previewable output is retained;
- the immutable original filename keeps the original `.heic` or `.heif` name;
- the initial editable document name receives `.jpg` or `.png` to match the stored output.

## Document names and duplicates

The document name is editable during upload through the API and after upload through Rename. It is the name used by search and download.

- A rename never changes the stored bytes or internal object key.
- The name must retain the real stored extension.
- The immutable original filename never changes.
- Rename is a normal edit and has no Undo.

Within one Patient, an upload is a duplicate when either condition is true:

1. the normalized document name already exists; or
2. the SHA-256 hash of the exact uploaded source bytes already exists.

Name comparison uses Unicode normalization, case-insensitive comparison, and collapsed whitespace. Other Patients and clinics are never included in duplicate checks.

A duplicate-name error names the conflicting document and tells the user to upload a new document or change the name. An identical-content error identifies the existing document. A soft-deleted attachment continues to reserve both its name and content during the five-second Undo window.

## Preview and download

PDF, JPEG, and PNG content is available through authenticated Patient- and clinic-scoped streams.

- Preview uses an inline response.
- Download uses the current editable document name.
- Both responses disable shared/browser caching and MIME sniffing.
- PDF preview receives a restrictive sandbox policy.
- Storage object URLs and internal random keys are never returned by the API.

## Deletion lifecycle

Deleting an attachment requires confirmation in the interface and immediately hides it from active product queries. The backend records a server timestamp and permits Undo for five seconds.

After the Undo window expires, the metadata row and stored object are permanently deleted. Expired rows are purged opportunistically by attachment API requests and by the idempotent command:

```bash
python manage.py cleanup_deleted_attachments
```

Phase 10 owns production scheduling and monitoring of that cleanup command. The command does not change the five-second authorization rule: expired rows can never be restored or accessed through the product.

Patient deletion keeps the established Patient lifecycle:

- a soft-deleted Patient and all attachments immediately become inaccessible;
- Patient Undo restores access to those unchanged attachments;
- after Patient Undo expires, the Patient and attachments remain inaccessible until Phase 10 defines Patient retention cleanup.

Permanent clinic deletion cascades through Patients and permanently deletes attachment metadata and stored objects without Undo. Permanent Doctor-account deletion already deletes every clinic owned by that Doctor first, so it produces the same attachment cascade.

## Storage architecture

The attachment domain uses Django's storage abstraction. The default development backend is a private filesystem directory, while Phase 10 may select a managed object-storage provider and region without changing the attachment model or HTTP contract.

Stored object keys use random attachment UUIDs under clinic and Patient prefixes. Original or editable filenames are metadata only and are never trusted as object keys.

Phase 10 remains responsible for the chosen hosting/storage provider, regional requirements, encryption configuration, malware scanning, backup/restore operations, audit logging, monitoring, retention jobs, and incident procedures.

## Backend HTTP contract

All routes require an authenticated, trusted-device-bound session with an active membership in the selected clinic.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/patients/{patient_id}/attachments/?search=&page=` | Newest-first metadata list, document-name search, 50-row pages |
| `POST` | `/api/patients/{patient_id}/attachments/` | Multipart batch upload using repeated `files` and optional matching `document_names` |
| `PATCH` | `/api/patients/{patient_id}/attachments/{attachment_id}/` | Rename with `document_name` only |
| `DELETE` | `/api/patients/{patient_id}/attachments/{attachment_id}/` | Soft delete and return server `undo_until` |
| `POST` | `/api/patients/{patient_id}/attachments/{attachment_id}/undo-delete/` | Restore only within five seconds |
| `GET` | `/api/patients/{patient_id}/attachments/{attachment_id}/preview/` | Authorized inline content stream |
| `GET` | `/api/patients/{patient_id}/attachments/{attachment_id}/download/` | Authorized download using current document name |

A fully successful upload returns `201`. A mixed batch returns `207` with one ordered result per selected file. Request-wide structural errors, such as zero files, more than 10 files, or mismatched custom-name count, return `400` before any file is processed.

## GitHub Pages demo invariant

The public demo is not a separate application. It renders the same production React attachment interface through the existing `VITE_DEMO_API=true` transport boundary.

The demo retains actual selected file bytes and metadata in browser IndexedDB so preview, download, SHA-256 duplicate-content detection, rename, delete, Undo, Patient deletion/restore, and Doctor-account/clinic cascades behave like the production interface. HEIC/HEIF decoding is loaded only when needed; converted JPEG or transparency-preserving PNG bytes are stored. Metadata-only simulation is not used. The browser's available IndexedDB quota is the demo's environmental storage limit.

The demo still provides no production security guarantee, and real Patient information must never be entered into it.

## Final reconciliation

The final pass reconciles the approved contract across the private Django storage/API, shared React interface, IndexedDB demo adapter, cleanup lifecycle, tests, CI workflows, and handoff documentation.

Attachment-specific accessibility and responsive behavior includes:

- descriptive context on the visible **Add files** control;
- contextual names for repeated upload Retry, Remove, and Dismiss actions;
- semantic upload-queue and loading status regions;
- a plain document count rather than an attachment badge;
- at least 44px attachment action targets on coarse-pointer devices;
- long document names that wrap safely in rows and dialogs;
- dialog focus containment and restoration for preview, rename, and delete;
- compact 320px layout coverage for horizontal overflow and action targets.

The Quality and Pages workflows install the committed frontend dependency graph with `npm ci`. The Quality gate runs Node contract/demo tests, the rendered Chromium release-smoke suite, both frontend builds, Django system and migration checks, and the PostgreSQL-backed backend suite. The attachment browser path covers actual IndexedDB bytes, preview, rename, download naming, delete/Undo, focus restoration, and compact-screen behavior.

## Explicit exclusions

Phase 9 does not add:

- non-Patient attachment targets;
- folders, categories, tags, descriptions, or manual ordering;
- file versioning or replacement;
- attachment notifications, sounds, badges, or polling;
- public/shareable file URLs;
- country-specific databases, storage providers, or regions;
- production malware scanning, audit trails, backups, retention policy, or operational scheduling.

These exclusions remain Phase 10 work where applicable.
