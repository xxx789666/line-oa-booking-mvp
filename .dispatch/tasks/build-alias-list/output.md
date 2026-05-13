# LINE OA Booking MVP — Dispatch Alias Catalog

One alias per Task (T01–T25) in `docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md`.
Alias naming: `booking-t<NN>-<short-slug>` (kebab-case, ≤40 chars).
Model mapping: **LOW → haiku, MEDIUM → sonnet, HIGH → opus.**
Borderline tasks have been bumped per the "prefer higher" rule, except where the rubric named the task explicitly.

## Summary Table

| Task | Title | Complexity | Model | Reason |
|------|-------|-----------|-------|--------|
| T01 | Initialize npm + devDeps | LOW | haiku | Pure scaffolding: write 3 config files + `npm install` + commit. Plan supplies every byte. |
| T02 | Create `appsscript.json` | LOW | haiku | Single JSON manifest, contents supplied verbatim. |
| T03 | Empty source tree | LOW | haiku | `mkdir` + write placeholder comments. No logic. |
| T04 | Configure clasp | LOW | haiku | `clasp login` + `clasp create` + verify push. External-tool wiring; no source logic. |
| T05 | Jest mock harness for GAS globals | MEDIUM | sonnet | Non-trivial mock library (SpreadsheetApp/UrlFetchApp/LockService/PropertiesService) — must get semantics right for the rest of Phase 1-4 to compile. |
| T06 | `utils/time.js` + `utils/id.js` | MEDIUM | sonnet | TDD with failing tests first; Asia/Taipei timezone math + UUID wrapper. |
| T07 | `utils/logger.js` + `utils/lock.js` | MEDIUM | sonnet | Two thin wrappers around `SpreadsheetApp` and `LockService`; plan supplies code. |
| T08 | `SlotCalculator` (pure logic) | MEDIUM | sonnet | Central business algorithm. TDD with multiple cases. Pure JS — high coverage value. |
| T09 | `SettingsRepo` with caching | MEDIUM | sonnet | Sheet I/O + 5-min `PropertiesService` cache + schema validation. TDD spec given. |
| T10 | `OrdersRepo` read paths | MEDIUM | sonnet | Read-side of Orders sheet; well-specified TDD. |
| T11 | `OrdersRepo` write paths (create/cancel/update) | **HIGH** | **opus** | Borderline-bumped: involves `LockService.withLock`, re-check-after-lock to prevent double-booking, multi-step writes with idempotency. Race-condition correctness matters; spec §6 critical for shop. |
| T12 | `AuthService` (LIFF idToken verify) | MEDIUM | sonnet | `UrlFetchApp` POST to `api.line.me/oauth2/v2.1/verify`, error mapping, optional caching. |
| T13 | `LineMessenger` push messages | MEDIUM | sonnet | Thin wrapper around LINE Messaging API push. |
| T14 | `CalendarSync` | MEDIUM | sonnet | Wrapper around `CalendarApp.createEvent`/`deleteEvent`. |
| T15 | `PaymentAdapter` (stub) | LOW | haiku | Explicit stub: `return { success: true, method: 'stub' }`. Plan classifies as placeholder. |
| T16 | `main.js` doGet router | HIGH | opus | Cross-module router (services/staff/availability/myBookings), DI seam, error envelope, query parsing. Rubric: 16-17 router → HIGH. |
| T17 | `main.js` doPost router (booking + cancel) | HIGH | opus | Multi-side-effect pipeline: lock → re-verify → payment → write Order → write Calendar → push LINE × 2 → log. Spec §6 hardest path. |
| T18 | `include()` helper for HtmlService | LOW | haiku | 4-line helper; pure scaffolding. |
| T19 | LIFF HTML shell | HIGH | opus | Per rubric (19-21 LIFF). Tag-soup + LIFF SDK script + GAS templating tags `<?!= … ?>` + viewport meta. Bugs in this break Phase 5 entirely. |
| T20 | LIFF `app.js` state machine | HIGH | opus | 5-step state machine, LIFF SDK lifecycle, fetch, async error UX, timezone math on client. ~200 LOC. |
| T21 | LIFF CSS | HIGH | opus | Per rubric (19-21 LIFF). Styling decisions matter for mobile-inside-LINE; bumped to opus to match its sibling LIFF tasks. |
| T22 | 24h reminder cron | LOW | haiku | Per rubric example. Implementation is a 30-line `Reminder.run()` with DI seam; plan supplies code + test. |
| T23 | Configure GAS PropertiesService env vars | HIGH | opus | Per rubric (23-25 deploy). No source changes — GUI configuration of 6 secrets (LINE channel/secret/token, spreadsheet, calendar, staging) + seeding the master Spreadsheet with 7 sheets. Mistakes here surface only at runtime. |
| T24 | Deploy Web App + register Time Trigger | HIGH | opus | Per rubric. `clasp deploy` + LINE Developers Console + LIFF endpoint URL + GAS Triggers GUI + Rich Menu wiring. External-system integration, hard to reverse. |
| T25 | End-to-end smoke test | HIGH | opus | Manual cross-system verification (LINE app → LIFF → GAS → Sheet → Calendar → LINE push). Judgement-heavy: pass/fail interpretation, where to look for breakage, tagging v0.1.0-mvp. |

**Distribution**: 7 LOW (haiku), 10 MEDIUM (sonnet), 8 HIGH (opus).

---

## YAML — paste into `~/.dispatch/config.yaml` under `aliases:`

```yaml
  # ===== LINE OA Booking MVP — Phase 0: Bootstrap =====
  booking-t01-npm-bootstrap:
    model: haiku
    prompt: |
      Execute Task 01 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Initialize npm project and devDeps"). Follow every Step literally:
      create package.json, .gitignore, jest.config.js with the exact contents
      shown, run `npm install`, then commit per the plan. Do not improvise.
      Working dir: D:\line官方網站訂閱系統 (PowerShell).

  booking-t02-appsscript-manifest:
    model: haiku
    prompt: |
      Execute Task 02 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Create appsscript.json manifest"). Write the file with the JSON shown
      verbatim (timezone Asia/Taipei, the 5 OAuth scopes, webapp block) and
      commit. Working dir: D:\line官方網站訂閱系統.

  booking-t03-source-tree-scaffold:
    model: haiku
    prompt: |
      Execute Task 03 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Create empty source tree"). Run the PowerShell mkdir command, write
      "// TODO: implement" placeholders into every listed .js file, write the
      minimal LIFF HTML shell and TODO files for app.js/style.css, write
      .claspignore exactly as shown, then commit. Do not add real logic — that
      comes in later tasks.

  booking-t04-clasp-setup:
    model: haiku
    prompt: |
      Execute Task 04 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Configure clasp"). Install @google/clasp globally, run `clasp login`
      (will prompt browser), `clasp create --type standalone --title
      "LINE-OA-Booking-MVP" --rootDir .`, then `clasp push --force` to verify.
      If you hit "Apps Script API not enabled", follow the in-plan gotcha note.
      `.clasp.json` is already gitignored — verify `git status` is clean.

  # ===== Phase 1: Pure-logic foundation =====
  booking-t05-jest-mock-harness:
    model: sonnet
    prompt: |
      Execute Task 05 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Create Jest mock harness for GAS globals"). Write tests/__mocks__/gas.js
      and tests/setup.js using the exact code in the plan — in-memory mocks for
      SpreadsheetApp, UrlFetchApp, LockService, CalendarApp, PropertiesService,
      Utilities. Confirm `npm test` runs (zero tests is OK) before committing.

  booking-t06-time-id-utils:
    model: sonnet
    prompt: |
      Execute Task 06 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement utils/time.js and utils/id.js"). Follow TDD: write
      tests/time.test.js first, run it RED, then implement src/utils/time.js
      with the GAS-namespace + CommonJS pattern, run GREEN, then implement
      src/utils/id.js. All times must be Asia/Taipei. Commit per plan.

  booking-t07-logger-lock-utils:
    model: sonnet
    prompt: |
      Execute Task 07 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement utils/logger.js and utils/lock.js"). Write both modules with
      the exact code in the plan: LogService appends to the Logs sheet with a
      console fallback; LockHelper.withLock wraps tryLock(10s) with a throw on
      timeout and finally-release. Commit per plan.

  booking-t08-slot-calculator:
    model: sonnet
    prompt: |
      Execute Task 08 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement SlotCalculator with TDD"). Follow the algorithm in the plan
      header: holiday check → weekday schedule → 15-min grid → subtract orders
      overlapping [start, start+duration). Write the full failing test suite
      first, then implement until green. Pure logic — no GAS deps. Commit.

  # ===== Phase 2: Sheet repos =====
  booking-t09-settings-repo:
    model: sonnet
    prompt: |
      Execute Task 09 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement SettingsRepo with caching"). TDD: read Services / Staff /
      StaffServices / Schedule / Holidays from the Spreadsheet, parse rows to
      objects, 5-minute PropertiesService cache, schema validation that logs
      INFO + uses defaults on missing columns. Commit when green.

  booking-t10-orders-repo-read:
    model: sonnet
    prompt: |
      Execute Task 10 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement OrdersRepo read paths"). TDD: findById, listByUser,
      listForStaffOnDate, listUpcomingForReminder(fromIso, toIso). Read-only —
      no LockService yet. Commit when green.

  booking-t11-orders-repo-write:
    model: opus
    prompt: |
      Execute Task 11 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement OrdersRepo write paths"). TDD-driven: create / cancel /
      setCalendarEventId / markReminded. CRITICAL: wrap create() in
      LockHelper.withLock and re-verify the slot is still free inside the lock
      (spec §6 "同時兩人搶同一個時段" — only one must succeed). Also enforce
      same-user-same-start-at idempotency (spec §12 Q2). Implement and verify
      the race-test in the plan before committing.

  # ===== Phase 3: External adapters =====
  booking-t12-auth-service:
    model: sonnet
    prompt: |
      Execute Task 12 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement AuthService — LIFF idToken verification"). POST idToken to
      https://api.line.me/oauth2/v2.1/verify via UrlFetchApp, parse userId +
      displayName, throw `unauthenticated` on bad token. Follow the test in the
      plan. Commit when green.

  booking-t13-line-messenger:
    model: sonnet
    prompt: |
      Execute Task 13 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement LineMessenger"). Thin wrapper around the LINE Messaging API
      push endpoint via UrlFetchApp, with pushBookingConfirmed /
      pushOwnerNewOrder / pushOwnerCancelled / pushReminder helpers that build
      the message text per spec §4. Commit when green.

  booking-t14-calendar-sync:
    model: sonnet
    prompt: |
      Execute Task 14 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement CalendarSync"). createBookingEvent → returns eventId,
      deleteEvent(eventId). Use CalendarApp.getCalendarById with the
      CALENDAR_ID PropertiesService key. Commit when green.

  booking-t15-payment-stub:
    model: haiku
    prompt: |
      Execute Task 15 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement PaymentAdapter stub"). It is a stub: `charge()` returns
      `{ success: true, method: 'stub' }`, `refund()` returns
      `{ success: true }`. Add the trivial sanity test the plan specifies and
      commit. Do not start integrating ECPay / NewebPay — that's v2.

  # ===== Phase 4: Router =====
  booking-t16-router-doget:
    model: opus
    prompt: |
      Execute Task 16 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement main.js doGet"). Build _dispatchGet with the DI seam
      (_setRepos for tests, _repos() in prod), JSON envelope helpers _ok/_err,
      and routes: no-action → LIFF HTML; ?action=services / staff /
      availability / myBookings → JSON. Wire doGet() to ContentService /
      HtmlService. Pass the two tests in the plan before committing.

  booking-t17-router-dopost:
    model: opus
    prompt: |
      Execute Task 17 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement main.js doPost — booking + cancel"). Append _dispatchPost,
      _handleBooking, _handleCancel exactly per plan. Booking flow:
      verify → fetch service/staff → charge stub → orders.create (this is the
      hot path with the lock from T11) → calendar.createBookingEvent (try/log,
      do NOT roll back) → push to customer + owner (try/log). Cancel flow:
      verify owner, enforce >24h rule, cancel order, delete calendar event,
      refund stub, push owner. Pass all 4 router tests (2 GET + 2 POST) before
      committing.

  booking-t18-html-include-helper:
    model: haiku
    prompt: |
      Execute Task 18 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Add include helper for HtmlService templating"). Append a 3-line
      `function include(filename)` to src/main.js that returns
      HtmlService.createHtmlOutputFromFile(filename).getContent(). Commit.

  # ===== Phase 5: LIFF frontend =====
  booking-t19-liff-html-shell:
    model: opus
    prompt: |
      Execute Task 19 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Build LIFF HTML shell"). Write src/liff/index.html with the exact
      markup in the plan: lang="zh-Hant", viewport meta, inline
      <?!= include('liff/style') ?> in <style>, the LINE LIFF SDK <script>
      tag, header/main/footer bars, and the bottom inline <script> that sets
      window.__API_URL__ from ScriptApp.getService().getUrl() and
      window.__LIFF_ID__ from PropertiesService. Commit.

  booking-t20-liff-app-state-machine:
    model: opus
    prompt: |
      Execute Task 20 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Write LIFF app.js state machine"). Implement the 5-step flow exactly as
      the plan shows: init() with liff.init/login/getIDToken/getProfile, then
      renderServices → renderStaff → renderDate → renderTime → renderConfirm →
      submitBooking. Use the Date.UTC + 8h offset math shown in submitBooking
      to convert local picks to UTC ISO. Commit per plan.

  booking-t21-liff-css:
    model: opus
    prompt: |
      Execute Task 21 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Write LIFF CSS"). Paste the stylesheet from the plan verbatim into
      src/liff/style.css — LINE-green (#06C755) bars, 12px rounded cards,
      4-col date/time grids, primary button, success state. Commit.

  # ===== Phase 6: Triggers =====
  booking-t22-reminder-cron:
    model: haiku
    prompt: |
      Execute Task 22 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Implement 24h reminder cron"). TDD: write tests/reminder.test.js first,
      then src/triggers/reminder.js with the Reminder IIFE, _setDeps seam,
      run() that queries OrdersRepo.listUpcomingForReminder(now+23h, now+25h),
      pushes reminders via LineMessenger, and marks reminded_at. Expose
      top-level reminderHourlyTrigger() for GAS Time Trigger registration.
      Commit when green.

  # ===== Phase 7: Deploy & smoke =====
  booking-t23-gas-properties:
    model: opus
    prompt: |
      Execute Task 23 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Configure GAS PropertiesService env vars"). No source changes. Create
      the LINE-OA-Booking-Data Spreadsheet with all 7 sheets and the header
      rows from spec §3 (Services, Staff, StaffServices, Schedule, Holidays,
      Orders [15 cols], Logs). Then in the GAS editor → Project Settings →
      Script Properties, set: LINE_CHANNEL_ID, LINE_CHANNEL_SECRET,
      LINE_MESSAGING_CHANNEL_TOKEN, SPREADSHEET_ID, CALENDAR_ID, LIFF_ID,
      STAGING. Report any missing credentials before continuing.

  booking-t24-deploy-webapp:
    model: opus
    prompt: |
      Execute Task 24 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("Deploy Web App and register Time Trigger"). Verify `npm test` is green,
      run `clasp push --force`, `clasp deploy --description "v0.1.0-mvp"`.
      Copy the Web App URL into the LIFF Endpoint URL in LINE Developers
      Console. Register `reminderHourlyTrigger` as an hourly Time Trigger in
      GAS. Wire the Rich Menu "預約" button to https://liff.line.me/{LIFF_ID}.
      Accept all OAuth consent prompts. Report the final Web App URL + LIFF ID.

  booking-t25-smoke-test:
    model: opus
    prompt: |
      Execute Task 25 in docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md
      ("End-to-end smoke test"). Friend-add the OA, tap Rich Menu, book a
      slot, verify: LINE 預約成功 push arrives ≤5s, Orders sheet has new row,
      Calendar event present. Manually trigger reminderHourlyTrigger and
      confirm the reminder + reminded_at update. Cancel via API and confirm
      Calendar event deleted + owner gets cancel push. If everything passes,
      `git tag v0.1.0-mvp`. Report any failures with logs.
```
