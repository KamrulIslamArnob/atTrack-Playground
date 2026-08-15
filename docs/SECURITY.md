# Security Policy and Data Privacy

atTrack is a local-first, privacy-focused career workspace and job application tracker.

## Security model

The app is designed primarily as a single-user local application.

- There is no public multi-user authentication model.
- Whoever can access the running local process is effectively the owner.
- Protecting the local machine, local app process, and local data directory is the main trust boundary.
- Do not expose a production server on an untrusted network without an external authentication layer and careful review.

## Local data storage

User data is stored locally, not in a hosted project database.

Typical local data includes:

- Job records
- Applications
- Interviews
- Contacts
- Notes
- Resumes and uploaded files
- AI usage logs
- SMTP settings and encrypted credentials

Development data normally lives under `.data/`, including:

- `.data/attrack.db`
- `.data/storage/`
- SQLite WAL/journal files

Packaged Electron builds store data in the OS user-data directory, such as `%APPDATA%\atTrack\` on Windows.

Never commit local databases, uploaded files, logs, resumes, screenshots containing personal data, or generated release/build artifacts.

## Credentials and secrets

Never commit:

- AI provider API keys
- `SMTP_ENCRYPTION_KEY`
- SMTP passwords
- OAuth tokens
- Bearer tokens
- Private certificates or keys
- Real `.env.local` files

SMTP credentials are encrypted at rest using AES-256-GCM with an environment/app-derived encryption key. If that key is missing or compromised, treat stored credentials as at risk.

## AI integrations

AI features may send user-provided content to configured AI providers. Depending on the feature and configuration, this may include job descriptions, resume text, prompts, screenshots, or generated draft content.

Contributor expectations:

- Do not add new AI data sharing without making the behavior clear in UI/docs where appropriate.
- Do not log raw secrets or unnecessary private content.
- Keep provider keys outside committed code.
- Preserve AI usage logging patterns without making logging block core user workflows.

## File serving and uploads

Uploaded files are private by default and served through application routes that enforce safe access rules. When changing file APIs:

- Prevent path traversal.
- Keep bucket boundaries intact.
- Require signed access or an owner-matching access path.
- Avoid exposing local filesystem paths in user-facing errors.

## Network exposure

`npm run dev` is intended for local development. `next start` and Electron-packaged local servers should not be exposed to public or untrusted networks without additional protection.

Because the app intentionally has no public login/session gate, network exposure can become full data exposure.

## Reporting vulnerabilities

Please do **not** report security vulnerabilities through public GitHub issues.

Report privately to the repository maintainer with:

1. A clear description of the issue.
2. Steps to reproduce.
3. Affected files or versions if known.
4. Potential impact.
5. Suggested fix if you have one.

The maintainer should investigate, prepare a fix, and publish an advisory or release notes when appropriate.

## If a secret is exposed

1. Revoke or rotate the exposed secret immediately.
2. Remove it from local files.
3. Remove it from git history before pushing, or coordinate a repository history cleanup if already pushed.
4. Audit logs and provider dashboards for suspicious usage.
