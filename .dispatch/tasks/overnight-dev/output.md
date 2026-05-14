# Overnight Implementation — LINE OA Booking MVP

**Run date:** 2026-05-14 (overnight)
**Branch:** master
**Reference plan:** `docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md`

All non-skipped tasks (01–22) complete. One commit per task, TDD red→green discipline observed for every Phase 1–4/6 task.

---

## Final test result

```
Test Suites: 9 passed, 9 total
Tests:       30 passed, 30 total
Snapshots:   0 total
Time:        0.431 s
```

All 30 unit tests green. Run locally with:

```powershell
npm test
```

---

## Tasks completed (one commit per task)

| Task | Commit | Summary |
|------|--------|---------|
| 01 | `d5d3054` | chore: bootstrap npm project with clasp + jest |
| 02 | `6a37ac3` | chore: add GAS manifest with required OAuth scopes |
| 03 | `9e136bc` | chore: scaffold empty source tree |
| 04 | *skipped* | requires `clasp login` browser OAuth — see "Next steps" below |
| 05 | `a592d21` | test: add Jest harness with mocked GAS globals |
| 06 | `442a344` | feat(utils): add time and id helpers (Asia/Taipei timezone) |
| 07 | `6bea490` | feat(utils): add logger and lock helpers |
| 08 | `6103fde` | feat(slot): implement SlotCalculator pure logic with TDD (5 tests) |
| 09 | `e9e49ff` | feat(repo): implement SettingsRepo with 5-min cache (4 tests) |
| 10 | `f57e524` | feat(repo): implement OrdersRepo read paths (3 tests) |
| 11 | `60a94ec` | feat(repo): OrdersRepo write paths with LockService (4 tests) |
| 12 | `43ab552` | feat(auth): verify LIFF idToken via LINE OAuth2 verify endpoint (3 tests) |
| 13 | `7c0a937` | feat(line): LineMessenger push helpers |
| 14 | `e5b1856` | feat(calendar): CalendarSync create/delete event |
| 15 | `2d4beb5` | feat(payment): stub PaymentAdapter for v1 (2 tests) |
| 16 | `f280d68` | feat(router): doGet for services/staff/availability/myBookings (2 tests) |
| 17 | `ce2e4cb` | feat(router): doPost booking + cancel with full side-effect pipeline (2 tests) |
| 18 | `62a3091` | feat(router): add include() helper for HtmlService templates |
| 19 | `64216f6` | feat(liff): HTML shell with LIFF SDK + GAS-injected config |
| 20 | `54dba4f` | feat(liff): 5-step booking flow with LIFF SDK auth |
| 21 | `3984c9e` | feat(liff): styles (LINE green + clean card layout) |
| 22 | `be7df62` | feat(triggers): 24h reminder cron with TDD (1 test) |
| 23–25 | *skipped* | require GUI / browser / phone — see "Next steps" below |

No tasks were marked `[!]`. No blockers hit.

---

## Files created

### Source (`src/`)

```
src/auth.js                   AuthService — LIFF idToken verify
src/main.js                   doGet / doPost router + include() helper
src/liff/app.js               LIFF 5-step state machine
src/liff/index.html           LIFF HTML shell (templated)
src/liff/style.css            LINE-green styles
src/repo/orders.js            OrdersRepo (read + write, locked)
src/repo/settings.js          SettingsRepo (5-min cache)
src/service/calendar.js       CalendarSync
src/service/line.js           LineMessenger (5 push helpers)
src/service/payment.js        PaymentAdapter (v1 stub)
src/service/slot.js           SlotCalculator (pure)
src/triggers/reminder.js      24h reminder cron entry
src/utils/id.js               UUID-based order ID
src/utils/lock.js             LockHelper.withLock()
src/utils/logger.js           LogService.info/warn/error
src/utils/time.js             Asia/Taipei date helpers
```

### Tests (`tests/`)

```
tests/__mocks__/gas.js        In-memory mocks for GAS globals
tests/setup.js                Jest global setup
tests/setup.test.js           Sanity test
tests/auth.test.js            3 tests
tests/orders.test.js          7 tests (3 read + 4 write)
tests/payment.test.js         2 tests
tests/reminder.test.js        1 test
tests/router.test.js          4 tests (2 GET + 2 POST)
tests/settings.test.js        4 tests
tests/slot.test.js            5 tests
tests/time.test.js            3 tests
```

### Config

```
package.json, package-lock.json, jest.config.js, appsscript.json, .claspignore
```

(.gitignore was already present and matches the plan's spec.)

---

## Next steps when you wake up

The autonomous worker stopped at the boundary of what can be done without browser/GUI/phone interaction. The remaining work (Tasks 04, 23–25) needs you in front of a browser. The plan §Phase 7 has full step-by-step instructions; below are the exact PowerShell commands you'll need to start with.

### 1. Task 04 — Configure clasp (browser OAuth + new GAS project)

From `D:\line官方網站訂閱系統` in PowerShell:

```powershell
# Install clasp globally (one-time per machine)
npm install -g @google/clasp
clasp --version    # expect >= 2.4.x

# Login (opens browser; sign in with the Google account that will OWN this GAS project)
clasp login

# If you see "User has not enabled the Apps Script API":
# Visit https://script.google.com/home/usersettings, toggle "Apps Script API" ON, retry.

# Create the GAS project bound to this repo
clasp create --type standalone --title "LINE-OA-Booking-MVP" --rootDir .
# This writes .clasp.json (gitignored). Copy the printed Apps Script URL.

# Smoke push of the placeholder + implementation
clasp push --force
# Expect: ~17 files pushed, no errors.
clasp open    # opens GAS editor in browser

# Verify .clasp.json is gitignored:
git status    # should be clean / no .clasp.json appearing
```

### 2. Task 23 — Configure backing services (plan §Phase 7, Task 23)

This is GUI work in 4 different consoles. Follow plan §Task 23 step-by-step:

1. **Spreadsheet** — Create Google Sheet `LINE-OA-Booking-Data` with 7 tabs (`Services`, `Staff`, `StaffServices`, `Schedule`, `Holidays`, `Orders`, `Logs`). Headers listed in plan. Seed a few rows of test data. Copy the spreadsheet ID.
2. **Calendar** — Pick the Google Calendar bookings should mirror into, copy its Calendar ID from settings.
3. **LINE Developers / LIFF** — Create a LINE Login channel, then a LIFF app inside it. Note Channel ID + LIFF ID. Leave LIFF Endpoint URL blank for now.
4. **LINE Messaging API** — Generate a long-lived Channel Access Token from your Messaging API channel.
5. **GAS Script Properties** — Open the GAS editor (`clasp open`), Project Settings → Script Properties → add 7 keys per plan §Task 23 Step 5:
   - `SPREADSHEET_ID`, `CALENDAR_ID`, `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`, `LINE_MESSAGING_CHANNEL_TOKEN`, `LIFF_ID`, `STAGING=false`.
6. **README** — Plan §Task 23 Step 6 asks for a Chinese-language README documenting the above. Not yet written — write it before committing.

### 3. Task 24 — Deploy + register reminder trigger

```powershell
npm test           # MUST be green; currently 30/30 passing
clasp push --force
clasp deploy --description "v0.1.0-mvp"
# Copy the Web App URL (https://script.google.com/macros/s/.../exec)
```

Then in browser:
- LINE Developers → your LIFF app → set **Endpoint URL** to the Web App URL above.
- GAS editor → Triggers (clock icon) → add a Time-driven trigger for function `reminderHourlyTrigger`, every hour.
- LINE OA Manager → Rich Menu → wire the "預約" button to `https://liff.line.me/{LIFF_ID}`.

### 4. Task 25 — End-to-end smoke test on phone

Follow plan §Task 25 steps 1–6: friend-add the OA, tap Rich Menu, book a slot, expect LINE confirmation message + Calendar event + Sheet row; manually trigger reminder; test cancel flow. Plan ends with `git tag v0.1.0-mvp`.

---

## Notes / decisions made overnight

- **`.gitignore`** was already committed (commit `b66d268`) before this session started and already matched the plan's spec, so it was not re-created — only `package.json`, `package-lock.json`, `jest.config.js` were added in commit `d5d3054`. The commit message is unchanged from the plan.
- **TDD discipline:** every Phase 1–4/6 task with tests followed red→green. The red step was verified by running `npx jest <name>` before implementation and observing failure. No test was weakened or skipped to pass.
- **Code transcribed verbatim** from the plan. The only deviation I considered (adding `Settings.invalidateCache()` to `tests/settings.test.js`'s `beforeEach`) was reverted before commit — plan said transcribe faithfully, and the test happens to work without it because each test re-seeds identical data so the module-level cache returns the same values.
- **Date sensitivity in router cancel test:** the cancel-flow test fixture uses `start_at: '2026-06-01T02:00:00Z'`. With today (per system context) being 2026-05-14, that's ~18 days in the future, well past the 24h cancel cutoff — so the test passes naturally. If you re-run this much later, the test would start failing as the date approaches; treat that as a fixture stale rather than a regression.
- **Line-ending warnings** during `git add` (LF → CRLF) are Windows-default behavior, not a problem. Files are committed correctly.

---

## How to verify yourself

```powershell
# Run the test suite
npm test
# Expect: Test Suites: 9 passed, 9 total / Tests: 30 passed, 30 total

# See the commit ladder
git log --oneline d5d3054..be7df62

# Inspect the implementation
git show be7df62      # last commit — the reminder cron
git show ce2e4cb      # the doPost booking+cancel handlers
```
