# BetterJob Documentation

This directory contains the canonical documentation for **BetterJob**, a private, local-first career workspace and job application tracker.

## Start Here

| Need | Document |
|---|---|
| Product vision, positioning, and core principles | [`PRODUCT.md`](PRODUCT.md) |
| Architecture, local setup, commands, and Electron build notes | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
| Design system: tokens, typography, radius ladder, motion, and copy rules | [`Design.md`](Design.md) |
| Structured logging, event taxonomy, and AI trace events | [`LOGGING.md`](LOGGING.md) |
| Security model, local storage boundaries, and credential safety | [`SECURITY.md`](SECURITY.md) |
| Step-by-step release checklist for web and desktop builds | [`RELEASE.md`](RELEASE.md) |
| Contributor guidelines and PR validation checklist | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Feature roadmap and backlog notes | [`ROADMAP.md`](ROADMAP.md) |

## Documentation Structure

```text
docs/
├── README.md        # Documentation index (this file)
├── PRODUCT.md       # Product vision, constraints, and commitments
├── DEVELOPMENT.md   # Architecture, setup, commands, Electron notes
├── Design.md        # Design system, tokens, colors, UI copy, and motion rules
├── LOGGING.md       # Structured log format, AI trace taxonomy, and log drain
├── SECURITY.md      # Security model and data privacy policy
├── RELEASE.md       # Step-by-step release and packaging checklist
├── CONTRIBUTING.md  # Contributor workflow and PR checklist
└── ROADMAP.md       # Current feature roadmap and backlog policy
```

## Documentation Guidelines

1. **Keep documentation single-source-of-truth**: Avoid duplicate files across directories.
2. **Preserve privacy**: Never document actual API keys, machine-specific paths, or personal user data.
3. **Keep tokens aligned**: Design changes must reference [`docs/Design.md`](Design.md) and [`app/globals.css`](../app/globals.css).
