# Pre-deployment audit and change log

This audit compares the current project files with Saketh's October 6, 2026 v2 review and the earlier review items. It records static checks and code changes only; it is **not** a claim that the complete application has been runtime-tested.

## Changes made in this package

- Completed the frontend Docker image and added an Nginx configuration with React Router SPA fallback, so direct navigation to routes such as `/dashboard` does not fall through to a static-file 404.
- Updated the backend container to use a non-root account, provide the OpenMP runtime required by common PyTorch/EasyOCR builds, and include a health check.
- Removed Docker BuildKit host-network/entitlement settings from Compose and made the frontend wait for the healthy backend. PostgreSQL's host port is bound to `127.0.0.1` rather than every network interface.
- Kept the Compose stack to PostgreSQL, backend, and frontend. The repository does not include an n8n workflow export or Ollama/model configuration, so these are configured as external services instead of adding containers that would not be configured correctly.
- Made container/OS environment variables take precedence over `.env` values.
- Enforced a unique JWT secret of at least 32 characters and rejected common example placeholders at startup.
- Changed refresh-token submission from a URL query parameter to a POST JSON body, reducing the chance that refresh tokens appear in URL logs.
- Kept passwords bcrypt-hashed in PostgreSQL and changed password-reset links to be short-lived and single-use using a new `password_reset_tokens` table. A new reset link invalidates earlier outstanding links for that account.
- Made forgot-password responses generic so the endpoint does not disclose whether an email address has an account.
- Removed the duplicate `get_db()` helper from `main.py`; the shared helper from `database.py` is now used.
- Cleaned duplicate `.gitignore` entries, removed the ineffective nested `src/.dockerignore` (the Docker build context is the repository root), and documented how to create `.env` safely.
- Added this audit file and refreshed the README with setup and security notes.

## Saketh review cross-check

| Review finding | Current package status |
|---|---|
| Protected frontend routes | Present in `src/App.jsx`; still verify in browser. |
| Plaintext password comparison / bcrypt mismatch | Login verifies the stored DB hash; first HR account is created by hashing `INITIAL_HR_PASSWORD`. |
| Hardcoded JWT secret | Removed; a strong `JWT_SECRET` is required at startup. |
| Permissive CORS | CORS is configured from `CORS_ORIGINS`; set exact frontend origins in `.env`. |
| Duplicate Google Sheets URL declarations | Only one declaration was found in `src/pages/Screening.jsx`. The URL itself remains a configurable-project value and should be changed if it points to the wrong spreadsheet. |
| Jobs only in localStorage | Jobs use backend/PostgreSQL endpoints. Local storage is still used for UI/session-related state, not as the job database. |
| Infinite polling | Polling is bounded at 360 attempts and has cancellation support. This is bounded, but can wait up to about 30 minutes; confirm that duration suits the n8n workflow. |
| requirements file corrupted | File is UTF-8 text and its encoding was checked. Dependency installation still needs to be tested on a machine with package-registry access. |
| Missing `.env.example`, Dockerfiles, `.dockerignore` | Present; frontend Dockerfile and root ignore rules were updated. |
| `window.location.href` / `alert()` | No matches were found in the inspected frontend source during this pass. |
| Login label / forgot-password UI | Login and forgot-password UI are present; forgot-password success text now uses the generic response. |
| Hardcoded jobs / no edit-delete | Jobs are backend-backed and edit/delete UI exists. Delete confirmation modal is present. |
| Access-token expiry / refresh flow | Access and refresh tokens are implemented; refresh request now sends its token in the POST body. |
| Dashboard overview endpoint missing | `GET /api/dashboard/overview` exists in `main.py`. |
| Password reset mutates `.env` | Reset updates the user password hash in PostgreSQL; it no longer writes passwords to `.env`. Reset tokens are single-use. |
| Duplicate unreachable return | The specific duplicate return described in the review was not found in the current `screen_job()` response path. |
| Redundant manual auth headers | No `getAuthConfig()` helpers were found in the inspected page files; the Axios interceptor handles bearer headers. |
| Candidates “All Jobs” filter | Job selector is state-controlled and populated from backend jobs. |
| Compose missing database/frontend | Compose defines PostgreSQL, backend, and frontend with health dependencies. n8n/Ollama remain external because workflow/model setup is not present in the ZIP. |
| Settings/Help no-op controls | Settings and Help Center panels are wired through the layout. |

## Checks run here

- Python syntax/AST parsing for `main.py`, `auth.py`, `database.py`, `models.py`, and `schemas.py`: passed.
- `docker-compose.yml` YAML parsing and expected service/dependency checks: passed.
- `requirements.txt` UTF-8 decoding and no UTF-16 BOM: passed.
- `package.json` / `package-lock.json` root dependency metadata match: passed.
- Nginx SPA fallback presence: passed.

## Not verified in this environment

- Docker image build and `docker compose up`: Docker CLI/daemon was not available here.
- `npm run build` / full frontend lint: dependency installation did not complete because the registry package was unavailable in the environment; run `npm ci`, `npm run build`, and `npm run lint` on your machine.
- Python dependency installation, database migrations/queries, SMTP delivery, live n8n webhook processing, Google Sheets writes, and rejection emails: these require a configured runtime and credentials and have not been end-to-end tested.
- Production deployment: configure HTTPS/reverse proxy, backups, monitoring, a production-grade rate limiter, secrets management, and a candidate-data retention policy before exposing the app publicly.

## Safe local setup

1. Extract this ZIP into a **new folder**; do not overwrite your current project folder.
2. Copy `.env.example` to `.env` and fill in real local values. Generate a JWT secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
3. Run `docker compose config`, then `docker compose up --build` with Docker Desktop running.
4. Test login, password reset, job create/edit/delete, resume upload, screening, cancellation, candidate filtering, dashboard, analytics, Google Sheets, and rejection email before deployment.
5. Do not commit `.env`; commit `.env.example`, `.gitignore`, and `.dockerignore`.
