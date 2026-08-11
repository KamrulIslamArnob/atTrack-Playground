# Security Policy & Data Privacy

## Security Architecture Overview

**Aven / AtTrack** is designed as a local-first, privacy-focused career workspace and application tracker.

- **Local Storage**: All application data, job records, interviews, contacts, notes, and uploaded documents are stored locally in your environment within an embedded SQLite database (`.data/attrack.db`) and local filesystem storage (`.data/storage/`). No user data is transmitted to external telemetry servers.
- **Sensitive Credentials Encryption**: SMTP credentials used for job application email delivery are encrypted at rest using AES-256-GCM encryption with an environment-derived `SMTP_ENCRYPTION_KEY`.
- **AI Integrations**: When AI features are utilized (e.g., job posting extraction or interview prep generation), prompt data is sent directly to Google Gemini or OpenRouter via their official API endpoints using your configured API keys.

---

## Reporting Vulnerabilities

If you discover a security vulnerability or potential privacy issue in Aven, please follow responsible disclosure guidelines:

1. **Do NOT report security vulnerabilities via public GitHub issues.**
2. Email your report directly to the repository maintainer.
3. Include details of the vulnerability, steps to reproduce, and potential impact.
4. Maintainers will respond promptly to investigate and release patches.

---

## Secret Key Protection Guidelines for Developers & Users

- **Application Settings**: Configure API keys directly inside the application UI (`/settings`) where keys are encrypted at rest in local storage.
- **Never Commit Credentials**: Never hardcode API keys, passwords, or tokens in source files or committed assets.
- **Network Interface**: In standalone web mode (`next start`), the server binds to localhost by default. Do not expose the service on unauthenticated public networks without an external reverse proxy providing authentication.
