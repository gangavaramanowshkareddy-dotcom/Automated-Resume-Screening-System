# Automated Resume Screening System

An AI-assisted resume screening application for HR teams. The project uses a React/Vite frontend, FastAPI backend, PostgreSQL persistence, local OCR for JPEG resumes, SMTP password-reset/rejection notifications, and an **external n8n workflow** for automated screening.

## Stack

- Frontend: React, Vite, React Router, Axios
- Backend: FastAPI, SQLAlchemy, PostgreSQL, JWT, bcrypt
- Resume handling: PDF, DOCX, JPEG; 10 MB per file
- Automation: n8n webhook URL configured separately
- Deployment: Docker Compose (frontend, backend, PostgreSQL)

## Before first run

1. Copy `.env.example` to `.env` in the project root.
2. Set `POSTGRES_PASSWORD` to a strong unique password.
3. Set `JWT_SECRET` to a random secret. Generate one in a terminal with:
   `python -c "import secrets; print(secrets.token_urlsafe(48))"`
   Paste the generated value into `.env`; do not use the example placeholder.
4. Set `INITIAL_HR_EMAIL` and `INITIAL_HR_PASSWORD` for the first HR account. Use a unique password with at least 8 characters.
5. Set `N8N_WEBHOOK_URL` and `N8N_API_KEY` to match your n8n workflow. Set SMTP values if password-reset and email notifications should be enabled.
6. Check `CORS_ORIGINS`, `FRONTEND_URL`, and `VITE_API_BASE_URL` for the URL(s) used by your browser. `VITE_API_BASE_URL` is embedded at frontend build time, so rebuild after changing it.

**Never commit `.env` or real secrets.** `.env` is intentionally ignored by Git and Docker build contexts. `.env.example` is safe to commit and documents the required variables.

## Run with Docker Compose

From this directory, with Docker Desktop running:

```bash
docker compose config
docker compose up --build
```

Open `http://localhost:5173`. The API is available at `http://localhost:8000`. PostgreSQL is used internally by the Compose network; resume uploads are persisted in a named volume. To stop the services, run `docker compose down`. To also delete the database volume, use `docker compose down -v` **only if you intend to permanently delete the stored database data**.

The Compose file does not provision n8n or an LLM service because the actual workflow export/model configuration is not included in this repository. Configure an existing n8n instance and set its webhook/API key in `.env`.

## Run locally without Docker

- Install Python 3.11 and Node.js 22.
- Create a PostgreSQL database and set `DATABASE_URL` in `.env`.
- Install backend dependencies with `python -m pip install -r requirements.txt`.
- Start the API with `python -m uvicorn main:app --reload --port 8000`.
- In another terminal, run `npm ci` and `npm run dev`.

## Security notes

- JWT secrets are required and validated at startup; do not use a placeholder.
- Passwords are hashed with bcrypt. Password reset tokens expire after 15 minutes and are recorded as single-use.
- Protected HR routes require a bearer access token. n8n callback/OCR routes require `X-N8N-API-KEY`.
- Use HTTPS, a production secret manager, backups, monitoring, and a production-grade rate limiter/reverse proxy before exposing this service publicly. Browser localStorage token storage is convenient for a prototype but should be reviewed for a higher-security production deployment.
- Candidate/resume information is sensitive personal data. Restrict access and define a retention/deletion policy before real-world use.

## Project structure

```text
main.py                 FastAPI routes and screening integration
auth.py                 Password hashing and JWT helpers
database.py             SQLAlchemy engine/session
models.py               PostgreSQL models
schemas.py              Request/response schemas
requirements.txt        Python dependencies
src/                    React frontend
Dockerfile              Backend image
Dockerfile.frontend     Frontend build + Nginx image
nginx.conf              SPA fallback and basic response headers
docker-compose.yml      PostgreSQL, backend, frontend
.env.example            Safe environment-variable template
.dockerignore           Excludes secrets and local files from Docker builds
.gitignore              Excludes secrets and generated files from Git
```
