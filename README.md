# LINE OA Booking MVP

Single-business LINE Official Account booking system. Customer taps Rich Menu inside LINE App → picks service/staff/time via LIFF → receives confirmation + 24h reminder. Backend: Google Apps Script + Google Sheet + Google Calendar. Payment is a stubbed adapter for v1.

## Architecture

```
LINE App (Rich Menu)
  → LIFF (static page on GitHub Pages)
    → fetch → GAS Web App (/exec)
       ↳ Google Sheet (DB + settings)
       ↳ Google Calendar (view layer)
       ↳ LINE Messaging API (push)
```

LIFF static page lives in a **separate repo**: `line-oa-booking-liff`.
This repo holds the GAS backend, tests, and design docs.

## Docs

- [Design spec](docs/superpowers/specs/2026-05-13-line-oa-booking-mvp-design.md) — 12 sections covering goals, data model, API spec, error handling, security
- [Implementation plan](docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md) — 25 TDD tasks across 8 phases
- [System flow diagrams](docs/system-flows.md) — 11 mermaid charts: architecture, customer flow, cron, cancel, state machine, etc.
- [v2 payment integration runbook](docs/v2-payment-integration.md) — how to swap the stub for ECPay/NewebPay

## Local development

```powershell
npm install
npm test           # 30 unit tests, all pure logic (mocked GAS globals)
clasp push --force # deploy to GAS
clasp deploy --deploymentId <ID> --description "vX.X.X"
```

## Tech stack

- Google Apps Script V8 (no module system; files share one global namespace)
- Google Spreadsheet as DB (7 sheets: Services / Staff / StaffServices / Schedule / Holidays / Orders / Logs)
- Google Calendar API for booking events
- LINE LIFF v2 SDK for identity, Messaging API for push
- Jest 29 with in-memory GAS mocks for unit testing
- `@google/clasp` 2.4 for local dev → GAS deploy

## Secrets

All sensitive values live exclusively in GAS Script Properties (accessed via
`PropertiesService.getScriptProperties().getProperty(...)`). They are never
in source code, never in `.clasp.json` (which is gitignored), and never in
any git commit.

Required Script Properties:
| Key | Source |
|-----|--------|
| `SPREADSHEET_ID` | Google Sheet URL |
| `CALENDAR_ID` | Google Calendar settings → "Integrate calendar" |
| `LINE_CHANNEL_ID` | LINE Login channel basic settings |
| `LINE_CHANNEL_SECRET` | Same |
| `LINE_MESSAGING_CHANNEL_TOKEN` | Messaging API channel → Issue long-lived token |
| `LIFF_ID` | LIFF app config |
| `STAGING` | `false` for production |

## Cost

NT$ 0 / month within Google + GitHub + LINE OA free tiers (up to ~500
bookings/month and 200 OA broadcasts/month).
