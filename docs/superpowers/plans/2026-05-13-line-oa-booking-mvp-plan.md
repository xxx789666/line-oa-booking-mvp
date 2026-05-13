# LINE OA Booking MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working single-business LINE Official Account booking system. Customer taps Rich Menu in LINE → opens LIFF → picks service/staff/time → pays (stub for v1) → receives LINE confirmation + 24h reminder. Shop owner manages settings in Google Sheet and views bookings in Google Calendar.

**Architecture:** Google Apps Script (GAS) hosts the entire backend — `doGet`/`doPost` Web App router, Time Triggers for cron, and HtmlService for serving LIFF page. Google Spreadsheet acts as both settings store and orders database (7 sheets). Google Calendar mirrors confirmed orders as a view layer for the owner. The LIFF frontend (vanilla HTML + JS) calls the GAS Web App URL passing an `idToken` from LIFF SDK for auth. Payment is a no-op stub for v1; the `PaymentAdapter` interface accepts an `ECPay`/`NewebPay` implementation for v2.

**Tech Stack:** Google Apps Script (V8 runtime), Google Spreadsheet, Google Calendar, LINE LIFF v2 SDK, LINE Messaging API, `@google/clasp` (local dev CLI), Node.js 24, Jest 29 (local unit tests with mocked GAS globals), PowerShell on Windows 11.

**Spec reference:** `docs/superpowers/specs/2026-05-13-line-oa-booking-mvp-design.md`

---

## File Structure

```
D:\line官方網站訂閱系統\
├── .clasp.json                  # clasp project link (gitignored: scriptId)
├── .claspignore                 # files clasp should NOT push
├── .gitignore                   # node_modules, .env, .clasp.json
├── README.md                    # setup + deploy guide (Chinese)
├── package.json                 # npm scripts + devDeps
├── jest.config.js               # Jest config + GAS mock setup
├── appsscript.json              # GAS manifest (timezone, scopes)
├── src/
│   ├── main.js                  # doGet/doPost router, error envelope
│   ├── auth.js                  # AuthService: verify LIFF idToken
│   ├── repo/
│   │   ├── settings.js          # SettingsRepo: read Services/Staff/Schedule/Holidays from Sheet
│   │   └── orders.js            # OrdersRepo: CRUD on Orders sheet with LockService
│   ├── service/
│   │   ├── slot.js              # SlotCalculator: pure logic computing available slots
│   │   ├── calendar.js          # CalendarSync: write/delete Google Calendar events
│   │   ├── line.js              # LineMessenger: push messages via Messaging API
│   │   └── payment.js           # PaymentAdapter: stub for v1
│   ├── triggers/
│   │   └── reminder.js          # 24h reminder cron + cache invalidation
│   ├── utils/
│   │   ├── logger.js            # Logs-sheet append helper
│   │   ├── lock.js              # LockService wrapper
│   │   ├── time.js              # ISO/Asia-Taipei date helpers
│   │   └── id.js                # UUID generator
│   └── liff/
│       ├── index.html           # LIFF entry HTML (served by HtmlService)
│       ├── app.js               # LIFF JS app
│       └── style.css            # LIFF styles
├── tests/
│   ├── __mocks__/
│   │   └── gas.js               # Mock SpreadsheetApp, UrlFetchApp, etc.
│   ├── setup.js                 # Jest global setup
│   ├── slot.test.js             # SlotCalculator pure-logic tests
│   ├── settings.test.js
│   ├── orders.test.js
│   ├── auth.test.js
│   └── reminder.test.js
└── docs/
    ├── superpowers/specs/2026-05-13-line-oa-booking-mvp-design.md (already exists)
    └── superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md (this file)
```

### File responsibilities (decomposition rationale)

- **`repo/`** isolates Sheet I/O — every other module receives plain JS objects, makes them mockable in tests.
- **`service/`** holds business logic. `slot.js` is pure (no GAS deps), most testable. `calendar.js`/`line.js`/`payment.js` wrap external APIs and are mocked in tests.
- **`utils/`** is leaf-level helpers — no domain knowledge.
- **`triggers/`** are GAS Time Trigger entrypoints, importable via global namespace.
- **`liff/`** is the frontend, served by GAS HtmlService — kept separate from backend logic.

**GAS module pattern**: GAS V8 runtime has no `require`/`import`. All `.js` files share a single global namespace after clasp upload. We use the **module namespace** pattern: each file declares `var ModuleName = (function() { ... return { publicFn }; })();`. Locally for Jest, we wrap the same file behavior with `module.exports` via a small footer that's stripped on push (see `.claspignore` / build step in Phase 0).

---

## Phases Overview

| Phase | Theme | Tasks | Tests |
|-------|-------|-------|-------|
| 0 | Bootstrap (npm, clasp, Jest, dirs, manifest) | T01–T05 | n/a (setup) |
| 1 | Pure-logic foundation (`utils/`, `SlotCalculator`) | T06–T08 | unit |
| 2 | Sheet repos (`SettingsRepo`, `OrdersRepo`) | T09–T11 | unit (mocked Sheet) |
| 3 | External adapters (`AuthService`, `LineMessenger`, `CalendarSync`, `PaymentAdapter`) | T12–T15 | unit |
| 4 | Router (`main.js` doGet/doPost) | T16–T18 | unit |
| 5 | LIFF frontend (HTML, app.js, css) | T19–T21 | manual |
| 6 | Triggers (24h reminder cron) | T22 | unit |
| 7 | Deploy + smoke test | T23–T25 | manual |

---

## Phase 0 — Project Bootstrap

### Task 01: Initialize npm project and devDeps

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `jest.config.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "line-oa-booking",
  "version": "0.1.0",
  "private": true,
  "description": "Single-business LINE OA booking MVP (Google Apps Script backend)",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "push": "clasp push",
    "open": "clasp open",
    "deploy": "clasp deploy --description \"v$npm_package_version\""
  },
  "devDependencies": {
    "@google/clasp": "^2.4.2",
    "@types/google-apps-script": "^1.0.97",
    "jest": "^29.7.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
.env
.env.local
.DS_Store
*.log
.clasp.json
.claspignore.local
coverage/
```

- [ ] **Step 3: Create `jest.config.js`**

```javascript
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  moduleDirectories: ['node_modules', 'src'],
  collectCoverageFrom: ['src/**/*.js', '!src/liff/**'],
  verbose: true
};
```

- [ ] **Step 4: Run install**

In PowerShell at `D:\line官方網站訂閱系統`:
```powershell
npm install
```
Expected: creates `node_modules/`, `package-lock.json`. No errors.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json .gitignore jest.config.js
git commit -m "chore: bootstrap npm project with clasp + jest"
```

---

### Task 02: Create `appsscript.json` manifest

**Files:**
- Create: `appsscript.json`

- [ ] **Step 1: Write the manifest**

```json
{
  "timeZone": "Asia/Taipei",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.send_mail"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

- [ ] **Step 2: Commit**

```powershell
git add appsscript.json
git commit -m "chore: add GAS manifest with required OAuth scopes"
```

---

### Task 03: Create empty source tree

**Files:**
- Create: `src/main.js` (placeholder)
- Create: `src/auth.js`
- Create: `src/repo/settings.js`
- Create: `src/repo/orders.js`
- Create: `src/service/slot.js`
- Create: `src/service/calendar.js`
- Create: `src/service/line.js`
- Create: `src/service/payment.js`
- Create: `src/triggers/reminder.js`
- Create: `src/utils/logger.js`
- Create: `src/utils/lock.js`
- Create: `src/utils/time.js`
- Create: `src/utils/id.js`
- Create: `src/liff/index.html`
- Create: `src/liff/app.js`
- Create: `src/liff/style.css`
- Create: `.claspignore`

- [ ] **Step 1: Create directory structure**

```powershell
mkdir src, src\repo, src\service, src\triggers, src\utils, src\liff, tests, tests\__mocks__
```

- [ ] **Step 2: Create placeholder files**

Each empty `.js` file should contain only a single comment, e.g. `// TODO: implement`. This commits the structure without functional code.

PowerShell shortcut:
```powershell
$placeholder = '// TODO: implement'
$placeholder | Out-File -Encoding utf8 src/main.js
$placeholder | Out-File -Encoding utf8 src/auth.js
$placeholder | Out-File -Encoding utf8 src/repo/settings.js
$placeholder | Out-File -Encoding utf8 src/repo/orders.js
$placeholder | Out-File -Encoding utf8 src/service/slot.js
$placeholder | Out-File -Encoding utf8 src/service/calendar.js
$placeholder | Out-File -Encoding utf8 src/service/line.js
$placeholder | Out-File -Encoding utf8 src/service/payment.js
$placeholder | Out-File -Encoding utf8 src/triggers/reminder.js
$placeholder | Out-File -Encoding utf8 src/utils/logger.js
$placeholder | Out-File -Encoding utf8 src/utils/lock.js
$placeholder | Out-File -Encoding utf8 src/utils/time.js
$placeholder | Out-File -Encoding utf8 src/utils/id.js
```

LIFF files get minimal scaffold:

`src/liff/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>預約</title>
</head>
<body>
  <div id="app">Loading…</div>
</body>
</html>
```

`src/liff/app.js`: `// TODO: implement`
`src/liff/style.css`: `/* TODO: styles */`

- [ ] **Step 3: Create `.claspignore`**

```
node_modules/**
tests/**
docs/**
.git/**
.gitignore
.clasp.json
jest.config.js
package.json
package-lock.json
README.md
**/*.test.js
**/__mocks__/**
```

- [ ] **Step 4: Commit**

```powershell
git add src/ .claspignore
git commit -m "chore: scaffold empty source tree"
```

---

### Task 04: Configure clasp

**Files:**
- Create: `.clasp.json` (gitignored)

- [ ] **Step 1: Install clasp globally (one-time per machine)**

```powershell
npm install -g @google/clasp
```
Expected: `clasp` available in PowerShell. Verify with `clasp --version` → ≥ 2.4.x.

- [ ] **Step 2: Login to Google**

```powershell
clasp login
```
A browser will open. Sign in with the Google account that will OWN the GAS project. After consent, terminal shows "Saved auth to ~/.clasprc.json".

- [ ] **Step 3: Create a new GAS project**

```powershell
clasp create --type standalone --title "LINE-OA-Booking-MVP" --rootDir .
```
Expected: creates `.clasp.json` containing `scriptId`. Also prints the Apps Script URL.

**First-time gotcha**: if you see `Error: User has not enabled the Apps Script API`, visit https://script.google.com/home/usersettings once, toggle "Apps Script API" ON, then retry the `clasp create` command.

- [ ] **Step 4: Verify push works (smoke push of placeholders)**

```powershell
clasp push --force
```
Expected: 17 files pushed, no errors. `clasp open` opens the GAS editor in browser; you should see all source files.

- [ ] **Step 5: Commit (.clasp.json already gitignored)**

Nothing new to commit if `.gitignore` covered it. Verify:
```powershell
git status
```
Expected: clean.

---

### Task 05: Create Jest mock harness for GAS globals

**Files:**
- Create: `tests/setup.js`
- Create: `tests/__mocks__/gas.js`

- [ ] **Step 1: Write `tests/__mocks__/gas.js`**

Provides factory functions for in-memory mocks of `SpreadsheetApp`, `UrlFetchApp`, `LockService`, `CalendarApp`, `PropertiesService`, `Utilities`.

```javascript
// tests/__mocks__/gas.js
function createSheetMock(rows) {
  const data = rows.map(r => [...r]);
  return {
    getDataRange: () => ({ getValues: () => data.map(r => [...r]) }),
    getLastRow: () => data.length,
    getLastColumn: () => (data[0] || []).length,
    appendRow: (row) => { data.push([...row]); },
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const r = [];
          for (let j = 0; j < numCols; j++) {
            r.push(data[row - 1 + i] ? data[row - 1 + i][col - 1 + j] : '');
          }
          out.push(r);
        }
        return out;
      },
      setValues: (values) => {
        values.forEach((rowVals, i) => {
          if (!data[row - 1 + i]) data[row - 1 + i] = [];
          rowVals.forEach((v, j) => { data[row - 1 + i][col - 1 + j] = v; });
        });
      },
      setValue: (v) => { data[row - 1][col - 1] = v; }
    }),
    _data: () => data
  };
}

function createSpreadsheetMock(sheets) {
  const sheetMocks = {};
  Object.entries(sheets).forEach(([name, rows]) => {
    sheetMocks[name] = createSheetMock(rows);
  });
  return {
    getSheetByName: (name) => sheetMocks[name] || null,
    _sheets: sheetMocks
  };
}

module.exports = {
  installGlobals(spreadsheets = {}, extra = {}) {
    const spreadsheetMock = createSpreadsheetMock(spreadsheets);
    global.SpreadsheetApp = {
      openById: () => spreadsheetMock,
      getActiveSpreadsheet: () => spreadsheetMock
    };
    global.UrlFetchApp = {
      fetch: jest.fn(extra.urlFetchFn || (() => ({
        getResponseCode: () => 200,
        getContentText: () => '{}'
      })))
    };
    global.LockService = {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {}
      })
    };
    global.CalendarApp = {
      getCalendarById: () => ({
        createEvent: jest.fn(() => ({ getId: () => 'evt-' + Math.random() })),
        getEventById: jest.fn(() => ({ deleteEvent: jest.fn() }))
      })
    };
    global.PropertiesService = {
      getScriptProperties: () => {
        const store = extra.properties || {};
        return {
          getProperty: (k) => store[k] || null,
          setProperty: (k, v) => { store[k] = v; },
          getProperties: () => ({ ...store })
        };
      }
    };
    global.Utilities = {
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2, 10),
      formatDate: (d, tz, fmt) => new Date(d).toISOString()
    };
    global.Logger = { log: () => {} };
    return { spreadsheetMock };
  }
};
```

- [ ] **Step 2: Write `tests/setup.js`**

```javascript
// tests/setup.js
// Provides per-test re-installable GAS mocks.
const gasMocks = require('./__mocks__/gas');
global.installGasMocks = gasMocks.installGlobals;
```

- [ ] **Step 3: Add a sanity test to confirm Jest runs**

Create `tests/setup.test.js`:
```javascript
describe('Jest harness', () => {
  beforeEach(() => { installGasMocks({}); });
  it('installs SpreadsheetApp', () => {
    expect(global.SpreadsheetApp).toBeDefined();
    expect(typeof SpreadsheetApp.openById).toBe('function');
  });
});
```

Run:
```powershell
npm test
```
Expected: 1 test, 1 passes.

- [ ] **Step 4: Commit**

```powershell
git add tests/
git commit -m "test: add Jest harness with mocked GAS globals"
```

---

## Phase 1 — Pure-Logic Foundation

### Task 06: Implement `utils/time.js` and `utils/id.js`

**Files:**
- Modify: `src/utils/time.js`
- Modify: `src/utils/id.js`
- Create: `tests/time.test.js`

- [ ] **Step 1: Write failing test for time helpers**

`tests/time.test.js`:
```javascript
beforeEach(() => installGasMocks({}));
const Time = require('../src/utils/time');

describe('Time', () => {
  it('formats a date as YYYY-MM-DD in Asia/Taipei', () => {
    const result = Time.toDateString(new Date('2026-05-13T15:00:00Z'));
    expect(result).toBe('2026-05-13');
  });

  it('combines date + HH:mm into ISO datetime in Taipei', () => {
    const result = Time.combine('2026-05-13', '09:30');
    expect(result.toISOString()).toBe('2026-05-13T01:30:00.000Z');
  });

  it('adds minutes to a date', () => {
    const start = new Date('2026-05-13T01:30:00Z');
    const after = Time.addMinutes(start, 60);
    expect(after.toISOString()).toBe('2026-05-13T02:30:00.000Z');
  });
});
```

Run: `npm test -- time.test`
Expected: FAIL — `Time` is undefined.

- [ ] **Step 2: Implement `src/utils/time.js`**

```javascript
// src/utils/time.js
// Date helpers — Asia/Taipei timezone (UTC+8).
// Exposed both as a GAS-global `Time` namespace and via CommonJS for Jest.

var Time = (function () {
  const TZ_OFFSET_MIN = 8 * 60; // Asia/Taipei

  function toDateString(d) {
    // Returns YYYY-MM-DD in Asia/Taipei
    const taipei = new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000);
    return taipei.toISOString().slice(0, 10);
  }

  function combine(dateStr, timeStr) {
    // dateStr = "YYYY-MM-DD" (treated as Taipei), timeStr = "HH:mm"
    // Returns a UTC Date.
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = timeStr.split(':').map(Number);
    const utcMillis = Date.UTC(y, mo - 1, d, h, mi) - TZ_OFFSET_MIN * 60 * 1000;
    return new Date(utcMillis);
  }

  function addMinutes(d, mins) {
    return new Date(d.getTime() + mins * 60 * 1000);
  }

  function formatHHmm(d) {
    const taipei = new Date(d.getTime() + TZ_OFFSET_MIN * 60 * 1000);
    return taipei.toISOString().slice(11, 16);
  }

  return { toDateString, combine, addMinutes, formatHHmm };
})();

if (typeof module !== 'undefined') module.exports = Time;
```

- [ ] **Step 3: Run test, verify pass**

```powershell
npm test -- time.test
```
Expected: PASS (3 tests).

- [ ] **Step 4: Implement `src/utils/id.js`**

```javascript
// src/utils/id.js
var Id = (function () {
  function newOrderId() {
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
      return 'ORD-' + Utilities.getUuid().split('-')[0].toUpperCase();
    }
    // local fallback (jest)
    return 'ORD-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }
  return { newOrderId };
})();

if (typeof module !== 'undefined') module.exports = Id;
```

Quick smoke (no test file needed; covered in OrdersRepo tests later).

- [ ] **Step 5: Commit**

```powershell
git add src/utils/time.js src/utils/id.js tests/time.test.js
git commit -m "feat(utils): add time and id helpers (Asia/Taipei timezone)"
```

---

### Task 07: Implement `utils/logger.js` and `utils/lock.js`

**Files:**
- Modify: `src/utils/logger.js`
- Modify: `src/utils/lock.js`

- [ ] **Step 1: Implement `logger.js`**

```javascript
// src/utils/logger.js
// Appends rows to the `Logs` sheet. Falls back to console in tests.
var LogService = (function () {
  function _spreadsheet() {
    if (typeof SpreadsheetApp === 'undefined') return null;
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    return id ? SpreadsheetApp.openById(id) : null;
  }

  function _append(level, module, msg, payload) {
    const ts = new Date().toISOString();
    const ss = _spreadsheet();
    const sheet = ss && ss.getSheetByName('Logs');
    if (!sheet) {
      // fallback to GAS Logger / console
      const line = `[${ts}] ${level} ${module} ${msg}`;
      if (typeof Logger !== 'undefined') Logger.log(line);
      return;
    }
    sheet.appendRow([ts, level, module, msg, payload ? JSON.stringify(payload) : '']);
  }

  return {
    info: (mod, msg, p) => _append('INFO', mod, msg, p),
    warn: (mod, msg, p) => _append('WARN', mod, msg, p),
    error: (mod, msg, p) => _append('ERROR', mod, msg, p)
  };
})();

if (typeof module !== 'undefined') module.exports = LogService;
```

- [ ] **Step 2: Implement `lock.js`**

```javascript
// src/utils/lock.js
// Wraps GAS LockService for safe critical sections.
var LockHelper = (function () {
  function withLock(fn, timeoutMs) {
    timeoutMs = timeoutMs || 10000;
    const lock = LockService.getScriptLock();
    const got = lock.tryLock(timeoutMs);
    if (!got) {
      const err = new Error('lock_timeout');
      err.code = 'lock_timeout';
      throw err;
    }
    try {
      return fn();
    } finally {
      try { lock.releaseLock(); } catch (e) { /* ignore */ }
    }
  }
  return { withLock };
})();

if (typeof module !== 'undefined') module.exports = LockHelper;
```

- [ ] **Step 3: Commit**

```powershell
git add src/utils/logger.js src/utils/lock.js
git commit -m "feat(utils): add logger and lock helpers"
```

---

### Task 08: Implement `SlotCalculator` (pure logic) with TDD

**Files:**
- Modify: `src/service/slot.js`
- Create: `tests/slot.test.js`

**Algorithm** (per spec §4.1 step 6):
Given (date `YYYY-MM-DD`, staffId, service duration in minutes, weekly schedule, holidays, existing orders), return list of available start times `HH:mm` on 15-minute grid.

1. If date is a holiday for staff (or shop-wide) → return `[]`.
2. Get staff schedule for that weekday → e.g. `09:00–18:00`.
3. Generate 15-min grid starts from `start` up to `end - duration`.
4. Subtract any starts whose `[start, start+duration)` overlaps with any existing order `[ord.start_at, ord.end_at)`.
5. Return as `HH:mm` strings.

- [ ] **Step 1: Write failing tests**

`tests/slot.test.js`:
```javascript
beforeEach(() => installGasMocks({}));
const Slot = require('../src/service/slot');

describe('SlotCalculator', () => {
  const schedule = [
    { staff_id: 'S1', day_of_week: 3, start_time: '09:00', end_time: '12:00' }
  ];

  it('returns empty array when staff has no schedule that day', () => {
    const result = Slot.compute({
      date: '2026-05-12', // Tuesday (dow=2)
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [],
      orders: []
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when date is a shop-wide holiday', () => {
    const result = Slot.compute({
      date: '2026-05-13',
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [{ date: '2026-05-13', staff_id: '' }],
      orders: []
    });
    expect(result).toEqual([]);
  });

  it('returns 15-min slots that fit duration within working hours', () => {
    const result = Slot.compute({
      date: '2026-05-13', // Wednesday (dow=3)
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [],
      orders: []
    });
    // Working 09:00-12:00, 60min service → starts 09:00..11:00 step 15
    expect(result).toEqual([
      '09:00', '09:15', '09:30', '09:45',
      '10:00', '10:15', '10:30', '10:45',
      '11:00'
    ]);
  });

  it('excludes slots that overlap with existing orders', () => {
    const result = Slot.compute({
      date: '2026-05-13',
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [],
      orders: [
        {
          staff_id: 'S1',
          start_at: '2026-05-13T02:00:00.000Z', // 10:00 Taipei
          end_at:   '2026-05-13T03:00:00.000Z'  // 11:00 Taipei
        }
      ]
    });
    expect(result).not.toContain('09:30'); // would end 10:30, overlaps
    expect(result).not.toContain('10:00');
    expect(result).not.toContain('10:45');
    expect(result).toContain('09:00');
    expect(result).toContain('11:00');
  });

  it('ignores staff-specific holidays for other staff', () => {
    const result = Slot.compute({
      date: '2026-05-13',
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [{ date: '2026-05-13', staff_id: 'S2' }],
      orders: []
    });
    expect(result.length).toBeGreaterThan(0);
  });
});
```

Run: `npm test -- slot.test`
Expected: FAIL.

- [ ] **Step 2: Implement `SlotCalculator`**

```javascript
// src/service/slot.js
var SlotCalculator = (function () {
  const Time = (typeof module !== 'undefined') ? require('../utils/time') : null;
  const T = Time || (typeof globalThis !== 'undefined' ? globalThis.Time : Time);

  const GRID_MIN = 15;

  function _dow(dateStr) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  }

  function _isHoliday(dateStr, staffId, holidays) {
    return holidays.some(h =>
      h.date === dateStr && (h.staff_id === '' || h.staff_id === staffId)
    );
  }

  function compute({ date, staffId, durationMin, schedule, holidays, orders }) {
    if (_isHoliday(date, staffId, holidays)) return [];

    const dow = _dow(date);
    const sched = schedule.find(s => s.staff_id === staffId && s.day_of_week === dow);
    if (!sched) return [];

    const dayStart = T.combine(date, sched.start_time);
    const dayEnd = T.combine(date, sched.end_time);

    const ranges = orders
      .filter(o => o.staff_id === staffId)
      .map(o => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()]);

    const slots = [];
    for (let t = dayStart.getTime(); t + durationMin * 60000 <= dayEnd.getTime(); t += GRID_MIN * 60000) {
      const slotEnd = t + durationMin * 60000;
      const overlaps = ranges.some(([s, e]) => Math.max(t, s) < Math.min(slotEnd, e));
      if (!overlaps) slots.push(T.formatHHmm(new Date(t)));
    }
    return slots;
  }

  return { compute };
})();

if (typeof module !== 'undefined') module.exports = SlotCalculator;
```

- [ ] **Step 3: Run tests, verify pass**

```powershell
npm test -- slot.test
```
Expected: 5 PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/service/slot.js tests/slot.test.js
git commit -m "feat(slot): implement SlotCalculator pure logic with TDD"
```

---

## Phase 2 — Sheet Repos

### Task 09: Implement `SettingsRepo` with caching

**Files:**
- Modify: `src/repo/settings.js`
- Create: `tests/settings.test.js`

- [ ] **Step 1: Write failing test**

`tests/settings.test.js`:
```javascript
const Settings = require('../src/repo/settings');

describe('SettingsRepo', () => {
  beforeEach(() => {
    installGasMocks({
      Services: [
        ['service_id', 'name', 'duration_min', 'price', 'description', 'is_active'],
        ['S001', '剪髮', 60, 800, '含洗髮', true],
        ['S002', '染髮', 120, 2500, '', true],
        ['S003', '頭皮舒緩', 30, 500, '', false]
      ],
      Staff: [
        ['staff_id', 'name', 'photo_url', 'line_user_id', 'is_active'],
        ['ST001', 'Alice', 'https://x/a.jpg', 'U_alice', true]
      ],
      Schedule: [
        ['staff_id', 'day_of_week', 'start_time', 'end_time'],
        ['ST001', 1, '09:00', '18:00']
      ],
      Holidays: [
        ['date', 'staff_id', 'reason'],
        ['2026-05-25', '', '國定假日']
      ],
      StaffServices: [
        ['staff_id', 'service_id'],
        ['ST001', 'S001'],
        ['ST001', 'S002']
      ]
    }, { properties: { SPREADSHEET_ID: 'fake-id' } });
  });

  it('lists only active services', () => {
    const result = Settings.listServices();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ service_id: 'S001', name: '剪髮', duration_min: 60 });
  });

  it('lists staff who can perform a given service', () => {
    const result = Settings.listStaffForService('S001');
    expect(result).toHaveLength(1);
    expect(result[0].staff_id).toBe('ST001');
  });

  it('returns the weekly schedule', () => {
    expect(Settings.getSchedule()).toEqual([
      { staff_id: 'ST001', day_of_week: 1, start_time: '09:00', end_time: '18:00' }
    ]);
  });

  it('returns holidays', () => {
    expect(Settings.getHolidays()).toEqual([
      { date: '2026-05-25', staff_id: '', reason: '國定假日' }
    ]);
  });
});
```

Run: `npm test -- settings.test`
Expected: FAIL.

- [ ] **Step 2: Implement `SettingsRepo`**

```javascript
// src/repo/settings.js
var SettingsRepo = (function () {
  const _CACHE_TTL_MS = 5 * 60 * 1000;
  let _cache = {};

  function _ss() {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    return SpreadsheetApp.openById(id);
  }

  function _readSheet(sheetName) {
    const cached = _cache[sheetName];
    if (cached && (Date.now() - cached.at < _CACHE_TTL_MS)) return cached.data;
    const sheet = _ss().getSheetByName(sheetName);
    if (!sheet) throw new Error('sheet_not_found:' + sheetName);
    const rows = sheet.getDataRange().getValues();
    if (rows.length === 0) return [];
    const header = rows[0];
    const data = rows.slice(1).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
    _cache[sheetName] = { at: Date.now(), data };
    return data;
  }

  function listServices() {
    return _readSheet('Services').filter(r => r.is_active === true);
  }

  function listStaff() {
    return _readSheet('Staff').filter(r => r.is_active === true);
  }

  function listStaffForService(serviceId) {
    const links = _readSheet('StaffServices').filter(r => r.service_id === serviceId);
    const ids = new Set(links.map(l => l.staff_id));
    return listStaff().filter(s => ids.has(s.staff_id));
  }

  function getSchedule() {
    return _readSheet('Schedule');
  }

  function getHolidays() {
    return _readSheet('Holidays');
  }

  function getServiceById(serviceId) {
    return _readSheet('Services').find(s => s.service_id === serviceId);
  }

  function getStaffById(staffId) {
    return _readSheet('Staff').find(s => s.staff_id === staffId);
  }

  function invalidateCache() {
    _cache = {};
  }

  return {
    listServices, listStaff, listStaffForService,
    getSchedule, getHolidays,
    getServiceById, getStaffById, invalidateCache
  };
})();

if (typeof module !== 'undefined') module.exports = SettingsRepo;
```

- [ ] **Step 3: Run, verify pass**

```powershell
npm test -- settings.test
```
Expected: 4 PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/repo/settings.js tests/settings.test.js
git commit -m "feat(repo): implement SettingsRepo with 5-min cache"
```

---

### Task 10: Implement `OrdersRepo` read paths

**Files:**
- Modify: `src/repo/orders.js`
- Create: `tests/orders.test.js`

- [ ] **Step 1: Write failing tests for read paths**

`tests/orders.test.js`:
```javascript
const Orders = require('../src/repo/orders');

const ORDERS_HEADER = [
  'order_id', 'created_at', 'line_user_id', 'customer_name',
  'service_id', 'staff_id', 'start_at', 'end_at', 'price',
  'payment_method', 'payment_status', 'status', 'reminded_at',
  'calendar_event_id', 'note'
];

describe('OrdersRepo (read)', () => {
  beforeEach(() => {
    installGasMocks({
      Orders: [
        ORDERS_HEADER,
        ['ORD-1', '2026-05-12T00:00:00Z', 'U_alice', 'Alice', 'S001', 'ST001',
         '2026-05-13T02:00:00Z', '2026-05-13T03:00:00Z', 800,
         'stub', 'paid', 'confirmed', '', 'evt-1', ''],
        ['ORD-2', '2026-05-12T00:00:00Z', 'U_bob', 'Bob', 'S002', 'ST001',
         '2026-05-13T05:00:00Z', '2026-05-13T07:00:00Z', 2500,
         'stub', 'paid', 'cancelled', '', 'evt-2', '']
      ]
    }, { properties: { SPREADSHEET_ID: 'fake-id' } });
  });

  it('lists confirmed orders for a given staff and date range', () => {
    const result = Orders.listForStaffOnDate('ST001', '2026-05-13');
    expect(result).toHaveLength(1);
    expect(result[0].order_id).toBe('ORD-1');
  });

  it('lists my (line_user_id) active orders', () => {
    const result = Orders.listByUser('U_alice');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('confirmed');
  });

  it('finds an order by id', () => {
    expect(Orders.findById('ORD-1').customer_name).toBe('Alice');
    expect(Orders.findById('NOPE')).toBeNull();
  });
});
```

Run: `npm test -- orders.test`
Expected: FAIL.

- [ ] **Step 2: Implement read paths in `src/repo/orders.js`**

```javascript
// src/repo/orders.js
var OrdersRepo = (function () {
  const Time = (typeof module !== 'undefined') ? require('../utils/time') : null;
  const Id = (typeof module !== 'undefined') ? require('../utils/id') : null;
  const LockHelper = (typeof module !== 'undefined') ? require('../utils/lock') : null;

  const T = Time || (typeof globalThis !== 'undefined' ? globalThis.Time : null);
  const I = Id || (typeof globalThis !== 'undefined' ? globalThis.Id : null);
  const L = LockHelper || (typeof globalThis !== 'undefined' ? globalThis.LockHelper : null);

  const SHEET = 'Orders';

  function _ss() {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    return SpreadsheetApp.openById(id);
  }

  function _readAll() {
    const sheet = _ss().getSheetByName(SHEET);
    const rows = sheet.getDataRange().getValues();
    if (rows.length === 0) return { header: [], rows: [], sheet };
    const header = rows[0];
    const data = rows.slice(1).map((r, idx) => {
      const obj = { _rowIndex: idx + 2 };
      header.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
    return { header, rows: data, sheet };
  }

  function listForStaffOnDate(staffId, dateStr) {
    const { rows } = _readAll();
    return rows.filter(r =>
      r.status === 'confirmed' &&
      r.staff_id === staffId &&
      T.toDateString(new Date(r.start_at)) === dateStr
    );
  }

  function listByUser(lineUserId) {
    const { rows } = _readAll();
    return rows.filter(r => r.line_user_id === lineUserId && r.status === 'confirmed');
  }

  function findById(orderId) {
    const { rows } = _readAll();
    return rows.find(r => r.order_id === orderId) || null;
  }

  function listUpcomingForReminder(fromIso, toIso) {
    const { rows } = _readAll();
    return rows.filter(r =>
      r.status === 'confirmed' &&
      !r.reminded_at &&
      r.start_at >= fromIso && r.start_at <= toIso
    );
  }

  // CRUD operations added in Task 11
  return {
    listForStaffOnDate, listByUser, findById, listUpcomingForReminder,
    _internal: { _readAll }
  };
})();

if (typeof module !== 'undefined') module.exports = OrdersRepo;
```

- [ ] **Step 3: Run, verify**

```powershell
npm test -- orders.test
```
Expected: 3 PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/repo/orders.js tests/orders.test.js
git commit -m "feat(repo): implement OrdersRepo read paths"
```

---

### Task 11: Implement `OrdersRepo` write paths (create / cancel / update)

**Files:**
- Modify: `src/repo/orders.js`
- Modify: `tests/orders.test.js`

- [ ] **Step 1: Add failing tests for write paths**

Append to `tests/orders.test.js`:
```javascript
describe('OrdersRepo (write)', () => {
  beforeEach(() => {
    installGasMocks({
      Orders: [ORDERS_HEADER]
    }, { properties: { SPREADSHEET_ID: 'fake-id' } });
  });

  it('creates an order and returns the order_id', () => {
    const orderId = Orders.create({
      line_user_id: 'U_x',
      customer_name: 'X',
      service_id: 'S001',
      staff_id: 'ST001',
      start_at: '2026-06-01T02:00:00Z',
      end_at:   '2026-06-01T03:00:00Z',
      price: 800,
      payment_method: 'stub',
      note: ''
    });
    expect(orderId).toMatch(/^ORD-/);
    const found = Orders.findById(orderId);
    expect(found.customer_name).toBe('X');
    expect(found.status).toBe('confirmed');
    expect(found.payment_status).toBe('paid');
  });

  it('refuses to double-book the same (staff, start_at)', () => {
    Orders.create({
      line_user_id: 'U_a', customer_name: 'A',
      service_id: 'S001', staff_id: 'ST001',
      start_at: '2026-06-01T02:00:00Z', end_at: '2026-06-01T03:00:00Z',
      price: 800, payment_method: 'stub'
    });
    expect(() => Orders.create({
      line_user_id: 'U_b', customer_name: 'B',
      service_id: 'S001', staff_id: 'ST001',
      start_at: '2026-06-01T02:00:00Z', end_at: '2026-06-01T03:00:00Z',
      price: 800, payment_method: 'stub'
    })).toThrow(/slot_taken/);
  });

  it('cancels an order', () => {
    const orderId = Orders.create({
      line_user_id: 'U_a', customer_name: 'A',
      service_id: 'S001', staff_id: 'ST001',
      start_at: '2026-06-01T02:00:00Z', end_at: '2026-06-01T03:00:00Z',
      price: 800, payment_method: 'stub'
    });
    Orders.cancel(orderId);
    expect(Orders.findById(orderId).status).toBe('cancelled');
  });

  it('marks reminded_at', () => {
    const orderId = Orders.create({
      line_user_id: 'U_a', customer_name: 'A',
      service_id: 'S001', staff_id: 'ST001',
      start_at: '2026-06-01T02:00:00Z', end_at: '2026-06-01T03:00:00Z',
      price: 800, payment_method: 'stub'
    });
    Orders.markReminded(orderId);
    expect(Orders.findById(orderId).reminded_at).toBeTruthy();
  });
});
```

Run: `npm test -- orders.test` → FAIL on create/cancel/markReminded.

- [ ] **Step 2: Add write methods to `OrdersRepo`**

Modify `src/repo/orders.js`, adding to the returned object:

```javascript
  function _conflict(rows, staffId, startAtIso) {
    return rows.some(r =>
      r.status === 'confirmed' &&
      r.staff_id === staffId &&
      r.start_at === startAtIso
    );
  }

  function create(input) {
    return L.withLock(function () {
      const { header, rows, sheet } = _readAll();
      if (_conflict(rows, input.staff_id, input.start_at)) {
        const err = new Error('slot_taken');
        err.code = 'slot_taken';
        throw err;
      }
      const orderId = I.newOrderId();
      const newRow = {
        order_id: orderId,
        created_at: new Date().toISOString(),
        line_user_id: input.line_user_id,
        customer_name: input.customer_name,
        service_id: input.service_id,
        staff_id: input.staff_id,
        start_at: input.start_at,
        end_at: input.end_at,
        price: input.price,
        payment_method: input.payment_method || 'stub',
        payment_status: 'paid',
        status: 'confirmed',
        reminded_at: '',
        calendar_event_id: '',
        note: input.note || ''
      };
      sheet.appendRow(header.map(h => newRow[h] !== undefined ? newRow[h] : ''));
      return orderId;
    });
  }

  function _updateRow(orderId, patch) {
    const { header, rows, sheet } = _readAll();
    const target = rows.find(r => r.order_id === orderId);
    if (!target) throw new Error('order_not_found');
    Object.entries(patch).forEach(([key, val]) => {
      const colIdx = header.indexOf(key);
      if (colIdx === -1) return;
      sheet.getRange(target._rowIndex, colIdx + 1).setValue(val);
    });
  }

  function cancel(orderId) {
    _updateRow(orderId, { status: 'cancelled' });
  }

  function markReminded(orderId) {
    _updateRow(orderId, { reminded_at: new Date().toISOString() });
  }

  function setCalendarEventId(orderId, eventId) {
    _updateRow(orderId, { calendar_event_id: eventId });
  }
```

Add these to the returned object:
```javascript
  return {
    listForStaffOnDate, listByUser, findById, listUpcomingForReminder,
    create, cancel, markReminded, setCalendarEventId,
    _internal: { _readAll }
  };
```

- [ ] **Step 3: Run, verify**

```powershell
npm test -- orders.test
```
Expected: 7 PASS (3 read + 4 write).

- [ ] **Step 4: Commit**

```powershell
git add src/repo/orders.js tests/orders.test.js
git commit -m "feat(repo): OrdersRepo write paths with LockService"
```

---

## Phase 3 — External Adapters

### Task 12: Implement `AuthService` (LIFF idToken verification)

**Files:**
- Modify: `src/auth.js`
- Create: `tests/auth.test.js`

- [ ] **Step 1: Write failing test**

`tests/auth.test.js`:
```javascript
const Auth = require('../src/auth');

describe('AuthService', () => {
  beforeEach(() => {
    installGasMocks({}, {
      properties: { LINE_CHANNEL_ID: 'CHAN-123' },
      urlFetchFn: (url, opts) => {
        if (url.includes('/oauth2/v2.1/verify')) {
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({
              sub: 'U_alice',
              name: 'Alice',
              picture: 'https://x/a.jpg',
              aud: 'CHAN-123',
              exp: Math.floor(Date.now() / 1000) + 600
            })
          };
        }
        return { getResponseCode: () => 400, getContentText: () => '{}' };
      }
    });
  });

  it('verifies a valid idToken and returns user profile', () => {
    const result = Auth.verify('fake-token');
    expect(result.userId).toBe('U_alice');
    expect(result.displayName).toBe('Alice');
  });

  it('rejects an invalid idToken', () => {
    global.UrlFetchApp.fetch = jest.fn(() => ({
      getResponseCode: () => 400,
      getContentText: () => '{"error":"invalid_token"}'
    }));
    expect(() => Auth.verify('bad-token')).toThrow(/unauthenticated/);
  });

  it('rejects when audience does not match LINE_CHANNEL_ID', () => {
    global.UrlFetchApp.fetch = jest.fn(() => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        sub: 'U_x', name: 'X', picture: '',
        aud: 'WRONG-CHANNEL',
        exp: Math.floor(Date.now() / 1000) + 600
      })
    }));
    expect(() => Auth.verify('mismatched')).toThrow(/unauthenticated/);
  });
});
```

Run: `npm test -- auth.test` → FAIL.

- [ ] **Step 2: Implement `AuthService`**

```javascript
// src/auth.js
var AuthService = (function () {
  function verify(idToken) {
    if (!idToken) {
      const e = new Error('unauthenticated'); e.code = 'unauthenticated'; throw e;
    }
    const channelId = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ID');
    const res = UrlFetchApp.fetch(
      'https://api.line.me/oauth2/v2.1/verify',
      {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: 'id_token=' + encodeURIComponent(idToken) + '&client_id=' + encodeURIComponent(channelId),
        muteHttpExceptions: true
      }
    );
    if (res.getResponseCode() !== 200) {
      const e = new Error('unauthenticated'); e.code = 'unauthenticated'; throw e;
    }
    const body = JSON.parse(res.getContentText());
    if (body.aud !== channelId) {
      const e = new Error('unauthenticated'); e.code = 'unauthenticated'; throw e;
    }
    return {
      userId: body.sub,
      displayName: body.name,
      pictureUrl: body.picture || ''
    };
  }
  return { verify };
})();

if (typeof module !== 'undefined') module.exports = AuthService;
```

- [ ] **Step 3: Run, verify**

```powershell
npm test -- auth.test
```
Expected: 3 PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/auth.js tests/auth.test.js
git commit -m "feat(auth): verify LIFF idToken via LINE OAuth2 verify endpoint"
```

---

### Task 13: Implement `LineMessenger` (push messages)

**Files:**
- Modify: `src/service/line.js`

No test — direct external API wrapper. Verified by integration test in Phase 7.

- [ ] **Step 1: Implement**

```javascript
// src/service/line.js
var LineMessenger = (function () {
  function _token() {
    return PropertiesService.getScriptProperties().getProperty('LINE_MESSAGING_CHANNEL_TOKEN');
  }

  function push(toUserId, messages) {
    if (!toUserId) return { ok: false, reason: 'no_target' };
    const messageArr = Array.isArray(messages) ? messages : [{ type: 'text', text: String(messages) }];
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + _token() },
      payload: JSON.stringify({ to: toUserId, messages: messageArr }),
      muteHttpExceptions: true
    });
    const ok = res.getResponseCode() === 200;
    return { ok, status: res.getResponseCode(), body: res.getContentText() };
  }

  function pushBookingConfirmed(toUserId, ctx) {
    // ctx: { serviceName, staffName, startAt (Date), price }
    const dateStr = Utilities.formatDate(ctx.startAt, 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
    const text = `【預約成功】\n服務：${ctx.serviceName}\n指定：${ctx.staffName}\n時間：${dateStr}\n金額：NT$ ${ctx.price}\n\n如需取消，請至「我的預約」操作。`;
    return push(toUserId, text);
  }

  function pushReminder(toUserId, ctx) {
    const dateStr = Utilities.formatDate(ctx.startAt, 'Asia/Taipei', 'MM/dd HH:mm');
    const text = `【明日預約提醒】\n${dateStr}\n服務：${ctx.serviceName}\n指定：${ctx.staffName}\n\n期待您的光臨！`;
    return push(toUserId, text);
  }

  function pushOwnerNewOrder(staffLineId, ctx) {
    const dateStr = Utilities.formatDate(ctx.startAt, 'Asia/Taipei', 'MM/dd HH:mm');
    const text = `📥 新訂單\n${ctx.customerName} 預約 ${ctx.serviceName}\n時間：${dateStr}`;
    return push(staffLineId, text);
  }

  function pushOwnerCancelled(staffLineId, ctx) {
    const dateStr = Utilities.formatDate(ctx.startAt, 'Asia/Taipei', 'MM/dd HH:mm');
    const text = `❌ 訂單取消\n${ctx.customerName} 取消 ${ctx.serviceName}\n原時間：${dateStr}`;
    return push(staffLineId, text);
  }

  return { push, pushBookingConfirmed, pushReminder, pushOwnerNewOrder, pushOwnerCancelled };
})();

if (typeof module !== 'undefined') module.exports = LineMessenger;
```

- [ ] **Step 2: Commit**

```powershell
git add src/service/line.js
git commit -m "feat(line): LineMessenger push helpers"
```

---

### Task 14: Implement `CalendarSync`

**Files:**
- Modify: `src/service/calendar.js`

- [ ] **Step 1: Implement**

```javascript
// src/service/calendar.js
var CalendarSync = (function () {
  function _calId() {
    return PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  }

  function createBookingEvent({ customerName, serviceName, staffName, startAt, endAt, orderId, price }) {
    const cal = CalendarApp.getCalendarById(_calId());
    const title = `${customerName} - ${serviceName} (${staffName})`;
    const description = `訂單 #${orderId}\n金額 NT$ ${price}`;
    const event = cal.createEvent(title, new Date(startAt), new Date(endAt), { description });
    return event.getId();
  }

  function deleteEvent(eventId) {
    if (!eventId) return;
    try {
      const cal = CalendarApp.getCalendarById(_calId());
      const ev = cal.getEventById(eventId);
      if (ev) ev.deleteEvent();
    } catch (e) {
      // log but don't fail caller
      LogService.warn('CalendarSync', 'deleteEvent failed', { eventId, err: String(e) });
    }
  }

  return { createBookingEvent, deleteEvent };
})();

if (typeof module !== 'undefined') module.exports = CalendarSync;
```

- [ ] **Step 2: Commit**

```powershell
git add src/service/calendar.js
git commit -m "feat(calendar): CalendarSync create/delete event"
```

---

### Task 15: Implement `PaymentAdapter` (stub) and trivial sanity test

**Files:**
- Modify: `src/service/payment.js`
- Create: `tests/payment.test.js`

- [ ] **Step 1: Write test**

```javascript
const Payment = require('../src/service/payment');
beforeEach(() => installGasMocks({}));

describe('PaymentAdapter (stub)', () => {
  it('always succeeds for v1 stub', () => {
    const r = Payment.charge({ orderId: 'X', amount: 100 });
    expect(r.success).toBe(true);
    expect(r.method).toBe('stub');
  });
  it('refund always succeeds', () => {
    expect(Payment.refund({ orderId: 'X', amount: 100 }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Implement**

```javascript
// src/service/payment.js
var PaymentAdapter = (function () {
  function charge({ orderId, amount }) {
    return { success: true, method: 'stub', txnId: 'STUB-' + orderId, amount };
  }
  function refund({ orderId, amount }) {
    return { success: true, method: 'stub', refundId: 'REF-' + orderId, amount };
  }
  return { charge, refund };
})();

if (typeof module !== 'undefined') module.exports = PaymentAdapter;
```

- [ ] **Step 3: Run + Commit**

```powershell
npm test -- payment.test
git add src/service/payment.js tests/payment.test.js
git commit -m "feat(payment): stub PaymentAdapter for v1"
```

---

## Phase 4 — Router

### Task 16: Implement `main.js` doGet (serves LIFF + JSON GETs)

**Files:**
- Modify: `src/main.js`
- Create: `tests/router.test.js`

- [ ] **Step 1: Write failing tests for query routing**

`tests/router.test.js`:
```javascript
const Router = require('../src/main');

describe('doGet', () => {
  beforeEach(() => installGasMocks({}));

  it('returns LIFF HTML when no action param', () => {
    const out = Router._dispatchGet({ parameter: {} });
    expect(out.type).toBe('html');
  });

  it('returns services JSON for action=services', () => {
    // mock SettingsRepo via DI seam
    Router._setRepos({
      settings: { listServices: () => [{ service_id: 'S1', name: 'X' }] }
    });
    const out = Router._dispatchGet({ parameter: { action: 'services' } });
    expect(out.type).toBe('json');
    expect(out.body).toEqual({ services: [{ service_id: 'S1', name: 'X' }] });
    Router._setRepos(null);
  });
});
```

Run: `npm test -- router.test` → FAIL.

- [ ] **Step 2: Implement `main.js`**

```javascript
// src/main.js
// GAS Web App entry points: doGet, doPost.
// Local exports include _dispatchGet/_dispatchPost for unit testing.

var _injectedRepos = null;
function _repos() {
  if (_injectedRepos) return _injectedRepos;
  return {
    settings: SettingsRepo,
    orders: OrdersRepo,
    auth: AuthService,
    slot: SlotCalculator,
    calendar: CalendarSync,
    line: LineMessenger,
    payment: PaymentAdapter
  };
}

function _ok(body) { return { type: 'json', body, status: 200 }; }
function _err(code, status) { return { type: 'json', body: { error: code }, status: status || 400 }; }

function _dispatchGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action;

  if (!action) {
    return { type: 'html', file: 'liff/index' };
  }

  try {
    const r = _repos();
    if (action === 'services') return _ok({ services: r.settings.listServices() });
    if (action === 'staff') {
      if (!p.service_id) return _err('missing_service_id');
      return _ok({ staff: r.settings.listStaffForService(p.service_id) });
    }
    if (action === 'availability') {
      if (!p.service_id || !p.staff_id || !p.date) return _err('missing_params');
      const svc = r.settings.getServiceById(p.service_id);
      if (!svc) return _err('service_not_found', 404);
      const orders = r.orders.listForStaffOnDate(p.staff_id, p.date);
      const slots = r.slot.compute({
        date: p.date,
        staffId: p.staff_id,
        durationMin: svc.duration_min,
        schedule: r.settings.getSchedule(),
        holidays: r.settings.getHolidays(),
        orders
      });
      return _ok({ slots });
    }
    if (action === 'myBookings') {
      if (!p.idToken) return _err('unauthenticated', 401);
      const user = r.auth.verify(p.idToken);
      return _ok({ orders: r.orders.listByUser(user.userId) });
    }
    return _err('unknown_action', 404);
  } catch (e) {
    const code = e && e.code ? e.code : 'internal_error';
    return _err(code, code === 'unauthenticated' ? 401 : 500);
  }
}

function doGet(e) {
  const out = _dispatchGet(e);
  if (out.type === 'html') {
    return HtmlService.createTemplateFromFile(out.file).evaluate()
      .setTitle('預約')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return ContentService.createTextOutput(JSON.stringify(out.body))
    .setMimeType(ContentService.MimeType.JSON);
}

// Local-only DI hook
if (typeof module !== 'undefined') {
  module.exports = { _dispatchGet, _setRepos(r) { _injectedRepos = r; } };
}
```

- [ ] **Step 3: Run, verify**

```powershell
npm test -- router.test
```
Expected: 2 PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/main.js tests/router.test.js
git commit -m "feat(router): doGet for services/staff/availability/myBookings"
```

---

### Task 17: Implement `main.js` doPost (booking + cancel)

**Files:**
- Modify: `src/main.js`
- Modify: `tests/router.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/router.test.js`:
```javascript
describe('doPost', () => {
  let captured;
  beforeEach(() => {
    installGasMocks({});
    captured = { pushed: [], created: null, eventCreated: null, cancelled: [] };
    Router._setRepos({
      auth: { verify: () => ({ userId: 'U_x', displayName: 'X' }) },
      settings: {
        getServiceById: (id) => ({ service_id: id, name: '剪髮', duration_min: 60, price: 800 }),
        getStaffById: (id) => ({ staff_id: id, name: 'Alice', line_user_id: 'U_alice' })
      },
      orders: {
        create: (input) => { captured.created = input; return 'ORD-NEW'; },
        findById: (id) => captured.cancelled.includes(id) ? null : {
          order_id: id, line_user_id: 'U_x', start_at: '2026-06-01T02:00:00Z',
          end_at: '2026-06-01T03:00:00Z', calendar_event_id: 'evt-1',
          status: 'confirmed', service_id: 'S1', staff_id: 'ST1', price: 800
        },
        cancel: (id) => captured.cancelled.push(id),
        setCalendarEventId: (id, ev) => { /* noop */ }
      },
      slot: { compute: () => ['09:00', '10:00'] },
      calendar: {
        createBookingEvent: () => { captured.eventCreated = true; return 'evt-1'; },
        deleteEvent: jest.fn()
      },
      line: {
        pushBookingConfirmed: (u, ctx) => captured.pushed.push(['cust', u, ctx]),
        pushOwnerNewOrder: (u, ctx) => captured.pushed.push(['owner', u, ctx]),
        pushOwnerCancelled: () => {}
      },
      payment: { charge: () => ({ success: true }), refund: () => ({ success: true }) }
    });
  });
  afterEach(() => Router._setRepos(null));

  it('creates a booking on POST action=booking', () => {
    const out = Router._dispatchPost({
      parameter: { action: 'booking' },
      postData: { contents: JSON.stringify({
        idToken: 'fake', service_id: 'S1', staff_id: 'ST1',
        start_at: '2026-06-01T02:00:00Z'
      })}
    });
    expect(out.body.order_id).toBe('ORD-NEW');
    expect(captured.eventCreated).toBe(true);
    expect(captured.pushed.length).toBe(2); // customer + owner
  });

  it('cancels an order on POST action=cancel', () => {
    const out = Router._dispatchPost({
      parameter: { action: 'cancel' },
      postData: { contents: JSON.stringify({
        idToken: 'fake', order_id: 'ORD-1'
      })}
    });
    expect(out.body.success).toBe(true);
    expect(captured.cancelled).toContain('ORD-1');
  });
});
```

Run: FAIL.

- [ ] **Step 2: Add `_dispatchPost` to `main.js`**

```javascript
function _dispatchPost(e) {
  const p = (e && e.parameter) || {};
  const action = p.action;
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (_) {}

  try {
    const r = _repos();
    if (action === 'booking') return _handleBooking(r, body);
    if (action === 'cancel') return _handleCancel(r, body);
    return _err('unknown_action', 404);
  } catch (e) {
    const code = e && e.code ? e.code : 'internal_error';
    return _err(code, code === 'unauthenticated' ? 401 : 500);
  }
}

function _handleBooking(r, body) {
  const user = r.auth.verify(body.idToken);
  const svc = r.settings.getServiceById(body.service_id);
  if (!svc) return _err('service_not_found', 404);
  const staff = r.settings.getStaffById(body.staff_id);
  if (!staff) return _err('staff_not_found', 404);

  const startAt = new Date(body.start_at);
  const endAt = new Date(startAt.getTime() + svc.duration_min * 60 * 1000);

  // Payment (stub for v1)
  const pay = r.payment.charge({ orderId: 'pending', amount: svc.price });
  if (!pay.success) return _err('payment_failed', 402);

  const orderId = r.orders.create({
    line_user_id: user.userId,
    customer_name: user.displayName,
    service_id: svc.service_id,
    staff_id: staff.staff_id,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    price: svc.price,
    payment_method: 'stub',
    note: body.note || ''
  });

  // Calendar (best-effort)
  try {
    const eventId = r.calendar.createBookingEvent({
      customerName: user.displayName, serviceName: svc.name, staffName: staff.name,
      startAt: startAt, endAt: endAt, orderId: orderId, price: svc.price
    });
    r.orders.setCalendarEventId(orderId, eventId);
  } catch (e) {
    if (typeof LogService !== 'undefined') LogService.warn('Booking', 'calendar_failed', { orderId });
  }

  // Push messages (best-effort)
  try {
    r.line.pushBookingConfirmed(user.userId, {
      serviceName: svc.name, staffName: staff.name, startAt: startAt, price: svc.price
    });
    if (staff.line_user_id) {
      r.line.pushOwnerNewOrder(staff.line_user_id, {
        customerName: user.displayName, serviceName: svc.name, startAt: startAt
      });
    }
  } catch (e) {
    if (typeof LogService !== 'undefined') LogService.warn('Booking', 'push_failed', { orderId });
  }

  return _ok({ order_id: orderId, success: true });
}

function _handleCancel(r, body) {
  const user = r.auth.verify(body.idToken);
  const order = r.orders.findById(body.order_id);
  if (!order) return _err('order_not_found', 404);
  if (order.line_user_id !== user.userId) return _err('not_owner', 403);
  if (order.status !== 'confirmed') return _err('already_cancelled');
  const now = Date.now();
  const start = new Date(order.start_at).getTime();
  if (start - now < 24 * 3600 * 1000) return _err('too_late');

  r.orders.cancel(order.order_id);
  r.calendar.deleteEvent(order.calendar_event_id);
  r.payment.refund({ orderId: order.order_id, amount: order.price });

  try {
    const svc = r.settings.getServiceById(order.service_id);
    const staff = r.settings.getStaffById(order.staff_id);
    if (staff && staff.line_user_id) {
      r.line.pushOwnerCancelled(staff.line_user_id, {
        customerName: user.displayName,
        serviceName: svc ? svc.name : '?',
        startAt: new Date(order.start_at)
      });
    }
  } catch (e) { /* swallow */ }

  return _ok({ success: true });
}

function doPost(e) {
  const out = _dispatchPost(e);
  return ContentService.createTextOutput(JSON.stringify(out.body))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Update local export footer:
```javascript
if (typeof module !== 'undefined') {
  module.exports = { _dispatchGet, _dispatchPost, _setRepos(r) { _injectedRepos = r; } };
}
```

- [ ] **Step 3: Run, verify**

```powershell
npm test -- router.test
```
Expected: 4 PASS (2 GET + 2 POST).

- [ ] **Step 4: Commit**

```powershell
git add src/main.js tests/router.test.js
git commit -m "feat(router): doPost booking + cancel with full side-effect pipeline"
```

---

### Task 18: Add `include` helper for HtmlService templating

**Files:**
- Modify: `src/main.js`

LIFF page needs to inline `app.js` and `style.css`. GAS HtmlService templates use `<?!= include('liff/app') ?>`.

- [ ] **Step 1: Append helper to `main.js`**

```javascript
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/main.js
git commit -m "feat(router): add include() helper for HtmlService templates"
```

---

## Phase 5 — LIFF Frontend

### Task 19: Build LIFF HTML shell

**Files:**
- Modify: `src/liff/index.html`

- [ ] **Step 1: Write HTML**

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>預約</title>
  <style>
    <?!= include('liff/style') ?>
  </style>
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
</head>
<body>
  <header class="bar">
    <span id="header-title">預約</span>
  </header>
  <main id="app">
    <div class="loading" id="loading">載入中…</div>
  </main>
  <footer class="bar bottom">
    <button id="back-btn" class="ghost" hidden>← 上一步</button>
  </footer>
  <script>
    window.__API_URL__ = '<?= ScriptApp.getService().getUrl() ?>';
    window.__LIFF_ID__ = '<?= PropertiesService.getScriptProperties().getProperty("LIFF_ID") ?>';
  </script>
  <script>
    <?!= include('liff/app') ?>
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```powershell
git add src/liff/index.html
git commit -m "feat(liff): HTML shell with LIFF SDK + GAS-injected config"
```

---

### Task 20: Write LIFF app.js (state machine)

**Files:**
- Modify: `src/liff/app.js`

- [ ] **Step 1: Write JS**

```javascript
// src/liff/app.js
// LIFF app — five-step flow: services → staff → date → time → confirm.

(function () {
  const API = window.__API_URL__;
  const LIFF_ID = window.__LIFF_ID__;

  const state = {
    step: 'services',
    idToken: null,
    profile: null,
    selected: { service: null, staff: null, date: null, time: null }
  };

  const $app = document.getElementById('app');
  const $back = document.getElementById('back-btn');
  const $title = document.getElementById('header-title');

  function setTitle(t) { $title.textContent = t; }

  function fetchJson(action, params) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    return fetch(API + '?' + qs).then(r => r.json());
  }

  function postJson(action, body) {
    return fetch(API + '?action=' + action, {
      method: 'POST',
      body: JSON.stringify(body)
    }).then(r => r.json());
  }

  async function init() {
    try {
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      state.idToken = liff.getIDToken();
      state.profile = await liff.getProfile();
      renderServices();
    } catch (e) {
      $app.innerHTML = `<div class="error">無法初始化 LIFF：${e.message}</div>`;
    }
  }

  function renderLoading() {
    $app.innerHTML = '<div class="loading">載入中…</div>';
  }

  async function renderServices() {
    state.step = 'services';
    setTitle('選擇服務');
    $back.hidden = true;
    renderLoading();
    const data = await fetchJson('services', {});
    $app.innerHTML = data.services.map(s => `
      <button class="card" data-id="${s.service_id}">
        <div class="card-title">${s.name}</div>
        <div class="card-meta">${s.duration_min} 分鐘 · NT$ ${s.price}</div>
        <div class="card-desc">${s.description || ''}</div>
      </button>
    `).join('') || '<div class="empty">尚無服務</div>';
    $app.querySelectorAll('button.card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.service = data.services.find(s => s.service_id === btn.dataset.id);
        renderStaff();
      });
    });
  }

  async function renderStaff() {
    state.step = 'staff';
    setTitle('選擇人員');
    $back.hidden = false; $back.onclick = renderServices;
    renderLoading();
    const data = await fetchJson('staff', { service_id: state.selected.service.service_id });
    $app.innerHTML = data.staff.map(s => `
      <button class="card" data-id="${s.staff_id}">
        ${s.photo_url ? `<img class="avatar" src="${s.photo_url}">` : ''}
        <div class="card-title">${s.name}</div>
      </button>
    `).join('');
    $app.querySelectorAll('button.card').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.staff = data.staff.find(s => s.staff_id === btn.dataset.id);
        renderDate();
      });
    });
  }

  function renderDate() {
    state.step = 'date';
    setTitle('選擇日期');
    $back.onclick = renderStaff;

    const today = new Date();
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ iso, label: `${d.getMonth()+1}/${d.getDate()}`, dow: ['日','一','二','三','四','五','六'][d.getDay()] });
    }
    $app.innerHTML = `<div class="grid-dates">${
      days.map(d => `<button class="date-cell" data-iso="${d.iso}"><span>${d.label}</span><small>${d.dow}</small></button>`).join('')
    }</div>`;
    $app.querySelectorAll('.date-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.date = btn.dataset.iso;
        renderTime();
      });
    });
  }

  async function renderTime() {
    state.step = 'time';
    setTitle(`${state.selected.date} 可預約時段`);
    $back.onclick = renderDate;
    renderLoading();
    const data = await fetchJson('availability', {
      service_id: state.selected.service.service_id,
      staff_id: state.selected.staff.staff_id,
      date: state.selected.date
    });
    if (!data.slots || data.slots.length === 0) {
      $app.innerHTML = '<div class="empty">這天沒有可預約時段</div>';
      return;
    }
    $app.innerHTML = `<div class="grid-times">${
      data.slots.map(t => `<button class="time-cell">${t}</button>`).join('')
    }</div>`;
    $app.querySelectorAll('.time-cell').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selected.time = btn.textContent;
        renderConfirm();
      });
    });
  }

  function renderConfirm() {
    state.step = 'confirm';
    setTitle('確認預約');
    $back.onclick = renderTime;
    const s = state.selected;
    $app.innerHTML = `
      <div class="summary">
        <div><b>服務：</b>${s.service.name}</div>
        <div><b>人員：</b>${s.staff.name}</div>
        <div><b>日期：</b>${s.date}</div>
        <div><b>時段：</b>${s.time}</div>
        <div><b>金額：</b>NT$ ${s.service.price}</div>
      </div>
      <button id="submit" class="primary">確認下訂並付款</button>
    `;
    document.getElementById('submit').addEventListener('click', submitBooking);
  }

  async function submitBooking() {
    const btn = document.getElementById('submit');
    btn.disabled = true; btn.textContent = '處理中…';
    const s = state.selected;
    const [y, mo, d] = s.date.split('-').map(Number);
    const [h, mi] = s.time.split(':').map(Number);
    const utcMillis = Date.UTC(y, mo - 1, d, h, mi) - 8 * 3600 * 1000;
    const startAtIso = new Date(utcMillis).toISOString();
    const result = await postJson('booking', {
      idToken: state.idToken,
      service_id: s.service.service_id,
      staff_id: s.staff.staff_id,
      start_at: startAtIso
    });
    if (result.success) {
      $app.innerHTML = `
        <div class="success">
          <div class="big-check">✓</div>
          <div>預約成功！</div>
          <div class="small">訂單編號：${result.order_id}</div>
          <button class="primary" onclick="liff.closeWindow()">回到 LINE</button>
        </div>
      `;
      $back.hidden = true;
    } else {
      btn.disabled = false; btn.textContent = '確認下訂並付款';
      alert('預約失敗：' + (result.error || '未知錯誤'));
    }
  }

  init();
})();
```

- [ ] **Step 2: Commit**

```powershell
git add src/liff/app.js
git commit -m "feat(liff): 5-step booking flow with LIFF SDK auth"
```

---

### Task 21: Write LIFF CSS

**Files:**
- Modify: `src/liff/style.css`

- [ ] **Step 1: Write CSS**

```css
/* src/liff/style.css */
* { box-sizing: border-box; }
body {
  font-family: -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif;
  margin: 0; background: #f5f7fa; color: #1a1a1a;
}
.bar {
  display: flex; align-items: center; justify-content: center;
  background: #06C755; color: white; padding: 12px 16px; font-weight: 600;
}
.bar.bottom { background: transparent; color: #444; justify-content: flex-start; }
#app { padding: 16px; min-height: calc(100vh - 100px); }
.loading, .empty, .error { text-align: center; padding: 24px; color: #666; }
.error { color: #e53935; }
.card {
  display: block; width: 100%; text-align: left; padding: 14px;
  background: white; border: 0; border-radius: 12px; margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.card-title { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
.card-meta { font-size: 13px; color: #1E3A8A; margin-bottom: 4px; }
.card-desc { font-size: 13px; color: #666; }
.avatar { width: 48px; height: 48px; border-radius: 50%; vertical-align: middle; margin-right: 12px; }
.grid-dates, .grid-times {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
}
.date-cell, .time-cell {
  background: white; border: 1px solid #e0e0e0; border-radius: 8px;
  padding: 10px 6px; font-size: 14px; cursor: pointer; text-align: center;
}
.date-cell span { display: block; font-weight: 600; }
.date-cell small { color: #888; }
.time-cell { font-weight: 500; }
.summary { background: white; padding: 16px; border-radius: 12px; margin-bottom: 16px; line-height: 2; }
button.primary {
  width: 100%; padding: 14px; background: #06C755; color: white; border: 0;
  border-radius: 8px; font-size: 16px; font-weight: 600;
}
button.ghost { background: transparent; border: 0; color: #1E3A8A; padding: 6px; }
button:disabled { opacity: 0.5; }
.success { text-align: center; padding: 32px; background: white; border-radius: 12px; }
.big-check { font-size: 64px; color: #06C755; }
.small { color: #666; font-size: 13px; margin: 8px 0 16px; }
```

- [ ] **Step 2: Commit**

```powershell
git add src/liff/style.css
git commit -m "feat(liff): styles (LINE green + clean card layout)"
```

---

## Phase 6 — Triggers

### Task 22: Implement 24h reminder cron

**Files:**
- Modify: `src/triggers/reminder.js`
- Create: `tests/reminder.test.js`

- [ ] **Step 1: Write failing test**

`tests/reminder.test.js`:
```javascript
const Reminder = require('../src/triggers/reminder');

describe('Reminder cron', () => {
  beforeEach(() => installGasMocks({}));
  it('pushes reminders for orders in [now+23h, now+25h] window', () => {
    const captured = { pushed: [], marked: [] };
    Reminder._setDeps({
      orders: {
        listUpcomingForReminder: () => [
          { order_id: 'O1', line_user_id: 'U1', start_at: '2026-06-01T02:00:00Z',
            service_id: 'S1', staff_id: 'ST1', status: 'confirmed' }
        ],
        markReminded: (id) => captured.marked.push(id)
      },
      settings: {
        getServiceById: () => ({ name: '剪髮' }),
        getStaffById: () => ({ name: 'Alice' })
      },
      line: { pushReminder: (u, ctx) => captured.pushed.push([u, ctx]) },
      now: () => new Date('2026-05-31T03:00:00Z') // 23h before
    });
    Reminder.run();
    expect(captured.pushed.length).toBe(1);
    expect(captured.marked).toEqual(['O1']);
  });
});
```

Run: FAIL.

- [ ] **Step 2: Implement**

```javascript
// src/triggers/reminder.js
var Reminder = (function () {
  let _deps = null;
  function _D() {
    if (_deps) return _deps;
    return {
      orders: OrdersRepo, settings: SettingsRepo, line: LineMessenger,
      now: () => new Date()
    };
  }

  function run() {
    const d = _D();
    const now = d.now();
    const fromIso = new Date(now.getTime() + 23 * 3600 * 1000).toISOString();
    const toIso = new Date(now.getTime() + 25 * 3600 * 1000).toISOString();
    const upcoming = d.orders.listUpcomingForReminder(fromIso, toIso);

    upcoming.forEach(o => {
      try {
        const svc = d.settings.getServiceById(o.service_id);
        const staff = d.settings.getStaffById(o.staff_id);
        d.line.pushReminder(o.line_user_id, {
          serviceName: svc ? svc.name : '',
          staffName: staff ? staff.name : '',
          startAt: new Date(o.start_at)
        });
        d.orders.markReminded(o.order_id);
      } catch (e) {
        if (typeof LogService !== 'undefined') {
          LogService.warn('Reminder', 'failed', { orderId: o.order_id, err: String(e) });
        }
      }
    });
  }

  // GAS entry — called by Time Trigger
  function reminderHourlyTrigger() { run(); }

  return { run, reminderHourlyTrigger, _setDeps(d) { _deps = d; } };
})();

// expose top-level for GAS trigger registration
function reminderHourlyTrigger() { Reminder.reminderHourlyTrigger(); }

if (typeof module !== 'undefined') module.exports = Reminder;
```

- [ ] **Step 3: Run, verify**

```powershell
npm test -- reminder.test
```
Expected: 1 PASS.

- [ ] **Step 4: Commit**

```powershell
git add src/triggers/reminder.js tests/reminder.test.js
git commit -m "feat(triggers): 24h reminder cron with TDD"
```

---

## Phase 7 — Deploy & Smoke Test

### Task 23: Configure GAS PropertiesService env vars

**Files:** (no source changes; GUI configuration)

- [ ] **Step 1: Create the master Spreadsheet**

In Google Drive: create a new Spreadsheet titled `LINE-OA-Booking-Data`. Add 7 sheet tabs with the headers from spec §3:

| Sheet | Header row |
|-------|-----------|
| Services | `service_id, name, duration_min, price, description, is_active` |
| Staff | `staff_id, name, photo_url, line_user_id, is_active` |
| StaffServices | `staff_id, service_id` |
| Schedule | `staff_id, day_of_week, start_time, end_time` |
| Holidays | `date, staff_id, reason` |
| Orders | (15 cols per spec §3.6) |
| Logs | `timestamp, level, module, msg, payload` |

Seed 2-3 rows of Services / Staff / Schedule with real test data.

Copy the **Spreadsheet ID** from the URL (the long string between `/d/` and `/edit`).

- [ ] **Step 2: Identify your Calendar ID**

Open https://calendar.google.com → ⚙ Settings → "Settings for my calendars" → click your booking calendar → scroll to "Integrate calendar" → copy **Calendar ID**.

- [ ] **Step 3: Create LIFF Channel in LINE Developers**

- Go to https://developers.line.biz → Providers → your Provider → "Create channel" → **LINE Login (LIFF)**.
- Note the **Channel ID** and **Channel Secret**.
- Inside the channel → "LIFF" tab → Add LIFF App:
  - Endpoint URL: leave blank for now (will set in Step 7).
  - Size: Full.
  - Scope: `profile`, `openid`.
- Save and note the **LIFF ID** (10-digit-style).

- [ ] **Step 4: Create / use a Messaging API Channel for push**

In the same Provider, create a **Messaging API channel** (or reuse the one tied to your LINE OA). Generate a **Channel Access Token (long-lived)**.

- [ ] **Step 5: Set GAS PropertiesService**

Open GAS editor (`clasp open`) → ⚙ Project Settings → Script Properties → Add:

| Key | Value |
|-----|-------|
| `SPREADSHEET_ID` | (from Step 1) |
| `CALENDAR_ID` | (from Step 2) |
| `LINE_CHANNEL_ID` | (LIFF channel ID from Step 3) |
| `LINE_CHANNEL_SECRET` | (LIFF channel secret) |
| `LINE_MESSAGING_CHANNEL_TOKEN` | (from Step 4) |
| `LIFF_ID` | (from Step 3) |
| `STAGING` | `false` |

**Note**: `LIFF_ID` is also required at runtime by Task 19's HTML template (consumed via `PropertiesService` to inject into the page). It's listed above. Spec §8.3 omits it — that's a spec gap noted here, not a plan gap.

- [ ] **Step 6: Commit a README.md documenting all this**

```powershell
# create README.md with the above setup steps in Chinese
```

Write a Chinese-language `README.md` summarizing:
- 安裝 (clone, npm install, clasp install/login)
- Spreadsheet + Calendar 建立步驟
- LINE Developers 設定
- 部署 (clasp push, clasp deploy)
- 本機測試 (npm test)

```powershell
git add README.md
git commit -m "docs: setup + deploy guide"
```

---

### Task 24: Deploy Web App and register Time Trigger

- [ ] **Step 1: Push final code**

```powershell
npm test
clasp push --force
```
Tests must pass before pushing. Expected: all tests green, files uploaded.

- [ ] **Step 2: Deploy as Web App**

```powershell
clasp deploy --description "v0.1.0-mvp"
```
Note the **Web App URL** (https://script.google.com/macros/s/.../exec). Copy it.

- [ ] **Step 3: Configure LIFF Endpoint URL**

Back in LINE Developers → LIFF tab → edit your LIFF app → set **Endpoint URL** to the Web App URL from Step 2.

- [ ] **Step 4: Register Time Trigger for reminders**

Open GAS editor → Triggers (clock icon, left bar) → Add Trigger:
- Function: `reminderHourlyTrigger`
- Event source: Time-driven
- Type: Hour timer
- Interval: Every hour

Save (Google will ask for OAuth consent — accept).

- [ ] **Step 5: Hook up Rich Menu**

In LINE Official Account Manager → Rich Menu → create / edit your menu → for the "預約" button → Action: "URI" → URL: `https://liff.line.me/{LIFF_ID}` (replace with your actual LIFF ID).

Save and apply to your OA.

---

### Task 25: Smoke test — end-to-end

- [ ] **Step 1: Friend-add your LINE OA**

On your phone, scan the QR or search the OA → add as friend.

- [ ] **Step 2: Tap Rich Menu "預約"**

Expected: LIFF opens inside LINE, shows service list within 3 seconds.

- [ ] **Step 3: Book a slot**

Select service → staff → date → time → "確認下訂並付款" → see green check + order ID.

Expected: within 5 seconds, a LINE message "預約成功" arrives in the OA chat. The `Orders` sheet has a new row. Google Calendar shows the event.

- [ ] **Step 4: Trigger reminder manually**

In GAS editor → select function `reminderHourlyTrigger` → Run. Check that booked orders within 23-25h get a reminder push and `reminded_at` filled.

(For real-time testing, temporarily seed an Orders row with `start_at = now + 24h`.)

- [ ] **Step 5: Cancel a booking**

In LIFF, open `myBookings` (if you've built that UI section in v1.1; v1 may omit) — or call the API directly:
```powershell
$body = @{ idToken = "..."; order_id = "ORD-XXX" } | ConvertTo-Json
Invoke-RestMethod -Uri "$webAppUrl?action=cancel" -Method Post -Body $body
```
Expected: order status → cancelled, Calendar event deleted, owner gets cancel notification.

- [ ] **Step 6: Document any issues, then mark v1 complete**

```powershell
git tag v0.1.0-mvp
git log --oneline
```

---

## Acceptance Criteria (rolled-up)

| # | Criterion | How to verify |
|---|-----------|---------------|
| 1 | Customer can book a slot from LINE in ≤ 60 sec | Task 25 Step 3 |
| 2 | Race: two simultaneous bookings of same slot → only one succeeds | Run `OrdersRepo.create` twice in GAS editor concurrently (or rely on Task 11 test) |
| 3 | Customer receives "預約成功" via LINE within 5 sec | Task 25 Step 3 |
| 4 | 24h reminder fires automatically | Task 25 Step 4 |
| 5 | Customer can cancel and Calendar event is deleted | Task 25 Step 5 |
| 6 | Shop owner sees order on Google Calendar | Task 25 Step 3 |
| 7 | All settings (services / staff / schedule / holidays) live in Sheet, no code change to update | Edit Sheet, wait 5 min (cache TTL) or call `SettingsRepo.invalidateCache()` |
| 8 | Monthly cost = NT$0 | All services used are within free quota |
| 9 | All unit tests pass | `npm test` → green |
| 10 | LIFF works on iPhone Safari + Android Chrome inside LINE | Manual on 2 devices |

---

## Known Limitations / v1.1+

- LIFF "我的預約" 頁未實作（spec §4.3 cancel 流程目前只能透過 API）—— v1.1 加。
- 商家後台無 web UI；管理透過 Sheet + Calendar —— spec 確認此為設計選擇。
- 金流為 stub，不真實扣款 —— v2 換 ECPay/NewebPay adapter。
- 不支援多商家 —— v5 才考慮重構。

---

## Dispatch Notes (for executing agents)

- **Windows path quirk**: project at `D:\line官方網站訂閱系統\` has Chinese characters. PowerShell + clasp tested OK; if any tool errors on path, fallback is to `cd` from a short ASCII alias.
- **TDD discipline**: every Phase 1-4 task starts with a failing test. Run `npm test -- <name>` between steps to verify state transitions. Don't write implementation before red.
- **Commit cadence**: one commit per task minimum; for big tasks (16/17) commit after each green test cycle.
- **Skill references**:
  - `@superpowers:systematic-debugging` if any test stays red after impl
  - `@superpowers:test-driven-development` for refresher
  - `@superpowers:verification-before-completion` before claiming v1 done

---

**End of Plan**
