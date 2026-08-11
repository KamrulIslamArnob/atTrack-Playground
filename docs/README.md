# Aven / AtTrack Documentation

This folder is the public documentation home for **Aven / AtTrack**, a local-first career workspace and job application tracker.

The docs are intentionally kept small and category-based so contributors can find the right information quickly.

## Start here

| Need | Read |
|---|---|
| Project overview, setup, and commands | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| How to contribute safely | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Security model and vulnerability reporting | [`SECURITY.md`](SECURITY.md) |
| UI, brand, layout, and design rules | [`Design.md`](Design.md) |
| Current feature backlog and roadmap notes | [`ROADMAP.md`](ROADMAP.md) |
| Latest codebase audit status | [`AuditReport.md`](AuditReport.md) |
| Historical task/plan summaries | [`PlanningSummary.md`](PlanningSummary.md) |
| AI-agent/code-assistant navigation map | [`CLAUDE.md`](CLAUDE.md) |

## Documentation rules

When adding or changing docs:

1. **Prefer updating an existing category** over creating a new top-level document.
2. **Keep `CLAUDE.md` updated** with links to the current canonical files.
3. **Keep audits in `AuditReport.md`** and replace it with the latest dated audit summary instead of creating many audit files.
4. **Summarize historical implementation plans in `PlanningSummary.md`** instead of keeping many separate task documents.
5. **Do not document secrets, private local data, or machine-specific paths** except as safe examples.

## Current docs structure

```text
docs/
├── README.md        # This index
├── CLAUDE.md        # AI-agent map and repository conventions
├── CONTRIBUTING.md  # Contributor workflow and PR checklist
├── SECURITY.md      # Security and privacy policy
├── DEVELOPMENT.md   # Architecture, setup, commands, Electron notes
├── Design.md        # Design system and UI rules
├── ROADMAP.md          # Current backlog policy
├── PlanningSummary.md  # Condensed history from old task docs
└── AuditReport.md      # Latest dated audit only
```

Historical planning artifacts are summarized in `PlanningSummary.md` so public docs stay focused on active contributor knowledge.
