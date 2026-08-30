# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for Doctor and Assistant accounts. The frontend is React/Vite and the backend is Django REST Framework with PostgreSQL.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

Quality validation includes Node unit/contract tests, Django tests against PostgreSQL, production/demo builds, and a rendered Chromium smoke suite. The rendered suite exercises pending-verification reload recovery, alternating trusted accounts, Account-menu Escape and nested-dialog focus behavior, future Patient date-of-birth rejection, and contextual task/comment/Undo names. Claims outside those paths remain specification- or lower-level-test backed rather than browser-validated.

## Current status

**Product Phases 0–8 and Design Steps 1–5 are implemented on `main`. The approved hands-on browser-audit findings are remediated, with critical release paths covered by the rendered-browser gate. Product Phase 9 has not started.**

Source-of-truth documents:

- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- [`docs/PHASE_0_FOUNDATION.md`](docs/PHASE_0_FOUNDATION.md)
- [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- [`docs/PHASE_2_VISITS.md`](docs/PHASE_2_VISITS.md)
- [`docs/PHASE_3_QUEUE.md`](docs/PHASE_3_QUEUE.md)
- [`docs/PHASE_4_CONSULTATION.md`](docs/PHASE_4_CONSULTATION.md)
- [`docs/PHASE_5_COMPLETION.md`](docs/PHASE_5_COMPLETION.md)
- [`docs/PHASE_6_SHARED_TASKS.md`](docs/PHASE_6_SHARED_TASKS.md)
- [`docs/PHASE_7_PRIVATE_NOTES.md`](docs/PHASE_7_PRIVATE_NOTES.md)
- [`docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md)
- [`docs/DESIGN_STEP_5_WORKING_HOURS.md`](docs/DESIGN_STEP_5_WORKING_HOURS.md)

## Account and clinic architecture

Personal identity and trusted devices are global. Clinic workflow data is tenant-scoped.

`StaffUser` owns the person's permanent Doctor/Assistant role and global identity/security data. The role never changes and cannot differ between clinics.

`StaffMembership` links a global account to a clinic. It does not assign role. Both Doctor and Assistant accounts may belong to multiple clinics.

Only Doctors create clinics. Each clinic currently has one owning Doctor and at most one active Assistant.

Workspace rules:

- Doctor account + active clinic membership → Doctor workspace;
- Doctor account + active clinic membership → Assistant workspace as administrator;
- Assistant account + active clinic membership → Assistant workspace only.

There is no shared clinic password and no username login. Sign-in uses selected permanent role plus email or phone + password, with optional passkeys.

Both personal email and phone must be verified before clinic operational data opens.
Personal phone values use full international input and are normalized to E.164 before storage.

## Authentication flow

New Doctor:

```text
Doctor → create account → verify email → verify phone → create clinic → first device trusted → Doctor workspace
```

New Assistant:

```text
Assistant → create account → verify email → verify phone → Doctor setup code → first device trusted → Assistant workspace
```

Existing trusted browser:

```text
role → email/phone + password or passkey → clinic
```

There is no second OTP on an already trusted browser. One clinic opens automatically; multiple clinics use the clinic picker.

New/untrusted browser:

```text
role → sign in → verified email or SMS OTP → browser becomes globally trusted → clinic
```

## Trusted devices and sessions

Device trust is global per personal account, not per clinic.

- one trusted browser works across all of that account's clinics;
- the browser retains a separate trusted-device credential for each account used on it, so alternating Doctor and Assistant accounts does not overwrite trust;
- reusing a matching account credential updates that device's last-used time instead of creating a duplicate;
- current trusted device cannot be removed;
- another trusted device may be removed;
- removing it ends sessions on that device across all clinics;
- sign-out revokes only the session and preserves device trust;
- untrusted sessions cannot open clinic operational data or manage trusted devices.

Trusted-device-bound sessions require bearer token + matching device proof.

Default session policy is 12-hour absolute lifetime, 2-hour inactivity timeout, and no Remember Me.

## Phase 8 administration/security

- Assistant setup codes are one-time and valid for 24 hours. The Doctor sees the plaintext only when it is created, with a copy control and exact expiry; reopening Clinic team shows only that an active code exists and when it expires.
- Replacing an unclaimed setup code requires confirmation and invalidates the previous code. Code entry is case-insensitive in production and the Pages demo.
- A Doctor removes/replaces an Assistant's membership in that clinic; the Doctor never deletes or takes over the Assistant's global account.
- An existing Assistant may join several clinics with separate Doctor setup codes.
- Assistants have no self-service Delete account action.
- Zero active Assistant memberships starts a two-year dormant period; after two years, personal/authentication data is anonymized while minimal **Former Assistant** history remains.
- A Doctor who deletes their own account permanently deletes all Doctor-owned clinics and their operational data, but not other people's global accounts.
- Doctor deletion requires trusted browser, fresh password/passkey reauthentication, affected-clinic warning, typed `DELETE`, and has no Undo.
- Email/phone changes require explicit fresh password/passkey reauthentication; ordinary login does not count. Reauthentication remains valid for 10 minutes by default.
- Doctor offline recovery uses ten one-time codes; regeneration invalidates unused previous codes. Assistant recovery shows only verified personal email/SMS methods.
- Passkeys are optional, maximum five.
- OTP defaults are six digits, 10-minute expiry, 60-second resend minimum, five failed attempts.
- Pending onboarding, device-authorization, contact-change, and password-change challenges restore their code-entry state and server-derived resend countdown after reload.
- Verification submissions require the complete six-digit code. Verification screens allow contact correction with isolated re-verification and always retain a sign-out escape.
- First-clinic Doctor and Assistant screens always provide account and sign-out exits. Health Hub seeds an in-app history entry so the browser's first Back action returns to account settings instead of immediately leaving the app.
- A pending Account-settings email/phone replacement can be edited or explicitly cancelled; cancellation consumes its challenge and leaves the verified contact unchanged.
- New-password forms provide live requirements, match/strength feedback, accessible Show/Hide controls, and remain disabled until the client-known requirements and confirmation match pass. Production validation remains authoritative.
- The Account menu supports arrow-key navigation and closes on Escape with focus returned to its visible Account trigger.
- Routine Account settings stay open beneath the Doctor-account Danger zone. Only the top dialog is interactive; modal surfaces isolate the background, contain focus, close on Escape when allowed, and restore focus to a visible opener.
- A successful Profile update displays and politely announces **Profile saved.** beside the save action; the confirmation clears when the profile is edited again or the person leaves the section.
- Working-day selectors, working-time fields, Account settings tabs, and dialog close controls provide at least 44×44px touch areas. Form controls use at least 15px text on desktop and 16px on compact/mobile layouts.
- Broader login/recovery/IP throttling is deferred to Phase 10 production hardening.

## Clinic operational timezone

Each clinic stores one IANA operational timezone automatically captured from the browser when the clinic is created.

That timezone determines clinic **today**, today's Appointments, check-in eligibility, live queue membership, and consultation/Room-ready day boundaries. A travelling staff browser does not move the clinic into another operational day.

## Clinic workflow

### Patients

- clinic-scoped reusable Patient records;
- full name, `Man`/`Woman`, phone country or region plus domestic/international phone input, optional DOB limited to clinic today or earlier, optional shared Patient note;
- Patient phone validation uses country metadata and stores one canonical E.164 value while retaining the selected country and national number;
- Iran `+98` default;
- automatic search + one duplicate warning;
- Appointment search, daily-list, and queue Patient names wrap to two visible lines before truncation; hovering a shortened name reveals the full value, while the complete text remains available to assistive technology;
- Doctor workspace may edit approved Patient data;
- Assistant workspace administers Patient creation/deletion;
- Doctor in Assistant workspace gets Assistant-side administrator controls;
- current/future Appointments block Patient deletion;
- Patient deletion uses a contained confirmation dialog; a failed deletion is announced and focused inside that dialog rather than above the Patient page;
- deletion has five-second Undo;
- Patient records never merge across clinics.

### Appointments

- Patient, date, scheduled time, optional reason;
- new Appointment creation starts with existing-Patient search, then explicitly selects an existing Patient or reveals the new-Patient form;
- each Appointment row shows workflow status once in its status chip; the scheduled-time column contains only the time;
- one active Appointment maximum per Patient per clinic date;
- unplanned same-day arrival = normal same-day Appointment followed by check-in;
- Assistant workspace administers Appointments;
- Doctor workspace is read-only for Appointment administration;
- Patient/date lock after check-in; scheduled time/reason remain correctable;
- eligible deletion has five-second Undo.

### Check-in and queue

```text
PLANNED → CHECKED_IN
```

- check-in only for clinic-operational-today Appointments;
- original persisted check-in sequence controls queue order;
- queue check-in times show seconds only when multiple arrivals share a minute, making their persisted order visible without adding seconds to every row;
- an empty live queue uses compact content padding without a forced minimum height;
- Assistant queue shows Patient phone; Doctor queue omits it;
- check-in has five-second Undo;
- authenticated three-second polling.

### Room ready and consultation

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- **Room ready** requires Doctor account + Doctor workspace + active membership;
- when a Patient is current, the control reads **Complete Patient and signal room ready**, and helper text discloses both consequences before the Doctor acts;
- **With doctor** is an Assistant-workspace action, including Doctor administrator access;
- one pending Room-ready call maximum per clinic;
- Room ready has five-second Undo before Assistant notification;
- after expiry: one short sound + persistent visual indication;
- first waiting Patient is suggested, but any checked-in Patient may be selected;
- With doctor has five-second Undo and preserves queue sequence.

### Completed consultation

`DOCTOR_FINISHED` is final and displayed as **Completed**.

- no Checkout workflow;
- Doctor's next Room ready completes the current consultation;
- its feedback retains the completed Patient identity, and five-second Undo names and reverses both Patient completion and the pending room call;
- Completed remains in date list + Patient history but leaves queue/current Doctor card;
- Completed cannot be deleted.

### Shared tasks

```text
OPEN → DONE
```

- clinic-scoped Doctor-to-Assistant work;
- Doctor account may create tasks from Doctor or Assistant administrator workspace;
- Assistant account cannot create/edit/delete tasks;
- only the task creator may edit it;
- Doctor may delete tasks in the active clinic;
- both roles may mark Done;
- Done has five-second Undo and no permanent Reopen after expiry;
- optional date-only due date and same-clinic Patient link;
- comments are shared but only each personal author may edit/delete their own;
- former Assistant attribution is preserved;
- task/comment deletion has five-second Undo;
- attention dots remain per clinic membership;
- no general task notification system beyond the red dot;
- authenticated three-second polling;
- New task remains a compact dialog with keyboard focus management; Open/History and comment fields expose complete accessible semantics.
- repeated Done/Edit/Delete/comment and Undo controls retain short visible text while their accessible names identify the affected task, comment, Patient, or action;
- editing an existing task replaces that card's normal details and conflicting controls until Save or Cancel, and saves back to the same task.

### Private sticky

- one global plain-text scratchpad per personal account;
- follows that account across clinics;
- visible only when workspace matches permanent account role;
- Doctor administrator access to Assistant workspace shows no sticky;
- minimized strip always shows **Private note**, never private content;
- autosave with Saving/Saved feedback; no multiple notes/title/history/attachments/etc.;
- desktop pointer and arrow-key movement/resizing stay inside safe viewport bounds below the workspace header and above the Undo lane; compact-height windows cap the sticky size, and there is no Reset control;
- layout/minimized state is not stored on the server.

## Browser demo

GitHub Pages uses the same production React product UI and substitutes only browser-local API/storage behavior.

The adapter mirrors permanent account roles, global trusted-device simulation, clinic ownership/memberships, Assistant setup/replacement, and Doctor account deletion at the product-workflow level.

It does not claim real trusted-device authority, email/SMS delivery, WebAuthn security, or medical-data guarantees. Real Patient information must not be entered into the public demo.

## Repository structure

```text
backend/accounts/        accounts, memberships, ownership, sessions, devices, verification, passkeys, recovery
backend/patients/        Patient records and deletion Undo
backend/visits/          Appointments, queue, room calls, consultation handoff
backend/tasks/           clinic-scoped shared tasks/comments
backend/health_hub/      Django project configuration and test runner
frontend/                React/Vite app and browser adapter
docs/                    product specifications and handoff
docker-compose.yml       local PostgreSQL service
```

## Local setup

### PostgreSQL

```bash
cp .env.example .env
docker compose up -d db
```

### Backend

Django 6 requires Python 3.12 or newer.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Backend verification:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test
```

Dormant Assistant cleanup:

```bash
python manage.py cleanup_dormant_assistants
```

Production scheduling of this cleanup command belongs to deployment/operations configuration.

### Frontend

Use Node.js 22.

```bash
cd frontend
npm install
npm run dev
```

Frontend verification:

```bash
npm test
npm run build
npm run build:demo
```

## Production boundary

This repository is not yet a production medical-data deployment. Production use still requires Phase 9 attachment/security decisions and Phase 10 hardening including broader auth throttling, security/privacy review, communication providers, backups, audit/logging, monitoring, retention operations, and deployment review.

Phase 9 sensitive attachment architecture has not started.
