# LINE OA Booking MVP

> 單一商家 LINE 官方帳號預約系統。Single-business LINE Official Account booking system.

[繁體中文](#繁體中文) | [English](#english)

---

## 繁體中文

### 系統介紹

客人在 LINE App 內點圖文選單「立即預約」→ LIFF 介面選服務/員工/日期/時段 → 確認下訂 → 立刻收到「預約成功」LINE 推播 → 24 小時前自動收到提醒。商家不需後台介面，所有訂單與行程透過 Google Calendar 檢視、所有設定透過 Google Sheet 編輯。

### 架構

```
LINE App（圖文選單）
  → LIFF（GitHub Pages 靜態頁）
    → fetch → Google Apps Script Web App
       ├─ Google Sheet（資料庫 + 設定）
       ├─ Google Calendar（商家檢視層）
       └─ LINE Messaging API（推播）
```

LIFF 靜態頁放在**另一個 repo**：`line-oa-booking-liff`。本 repo 為 GAS 後端、單元測試、設計文件。

### 文件

- [設計規格 Design Spec](docs/superpowers/specs/2026-05-13-line-oa-booking-mvp-design.md) — 12 章節：目標、資料模型、API 規格、錯誤處理、安全考量
- [實作計畫 Implementation Plan](docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md) — 25 個 TDD 任務、8 個階段
- [系統流程圖 System Flows](docs/system-flows.md) — 11 張 mermaid 圖：架構、客人流程、cron、取消、狀態機等
- [v2 金流接續備忘 Payment Runbook](docs/v2-payment-integration.md) — 如何把 stub 換成綠界/藍新

### 本機開發

```powershell
npm install
npm test           # 30 個單元測試（純邏輯、mock GAS globals）
clasp push --force # 部署到 GAS
clasp deploy --deploymentId <ID> --description "vX.X.X"
```

### 技術棧

- Google Apps Script V8 runtime（無模組系統，所有檔案共用一個 global namespace）
- Google Spreadsheet 當資料庫（7 個分頁：Services / Staff / StaffServices / Schedule / Holidays / Orders / Logs）
- Google Calendar API 寫訂單事件
- LINE LIFF v2 SDK 取得 LINE 身份、Messaging API 推播
- Jest 29 + 自製 in-memory GAS mock 做單元測試
- `@google/clasp` 2.4 本機開發 → 推上 GAS

### 機密處理

所有敏感值**只存於 GAS Script Properties**，程式碼透過 `PropertiesService.getScriptProperties().getProperty(...)` 讀取。永不寫入原始碼、不入 `.clasp.json`（已 gitignore）、不進任何 git commit。

必要的 Script Properties：

| Key | 來源 |
|-----|------|
| `SPREADSHEET_ID` | Google Sheet 網址 |
| `CALENDAR_ID` | Google Calendar 設定 →「整合日曆」 |
| `LINE_CHANNEL_ID` | LINE Login channel 基本設定 |
| `LINE_CHANNEL_SECRET` | 同上 |
| `LINE_MESSAGING_CHANNEL_TOKEN` | Messaging API channel → Issue 長效 token |
| `LIFF_ID` | LIFF app 設定 |
| `STAGING` | 正式環境填 `false` |

### 成本

月開銷 **NT$ 0**（在 Google + GitHub + LINE OA 免費額度內：~500 筆預約/月、200 則 OA 廣播/月）

---

## English

### Overview

Customer taps Rich Menu inside LINE App → picks service / staff / date / time via LIFF → receives "booking confirmed" push immediately → gets an auto reminder 24 hours before the appointment. The shop owner needs no admin UI: bookings show up in Google Calendar, settings live in a Google Sheet.

### Architecture

```
LINE App (Rich Menu)
  → LIFF (static page on GitHub Pages)
    → fetch → Google Apps Script Web App
       ├─ Google Sheet (DB + settings)
       ├─ Google Calendar (owner-facing view)
       └─ LINE Messaging API (push notifications)
```

The LIFF static page lives in a **separate repo**: `line-oa-booking-liff`.
This repo holds the GAS backend, unit tests, and design docs.

### Docs

- [Design Spec](docs/superpowers/specs/2026-05-13-line-oa-booking-mvp-design.md) — 12 sections: goals, data model, API spec, error handling, security
- [Implementation Plan](docs/superpowers/plans/2026-05-13-line-oa-booking-mvp-plan.md) — 25 TDD tasks across 8 phases
- [System Flows](docs/system-flows.md) — 11 mermaid diagrams: architecture, customer flow, cron, cancel, state machine, etc.
- [v2 Payment Runbook](docs/v2-payment-integration.md) — how to swap the stub for ECPay / NewebPay

### Local development

```powershell
npm install
npm test           # 30 unit tests, all pure logic (mocked GAS globals)
clasp push --force # deploy to GAS
clasp deploy --deploymentId <ID> --description "vX.X.X"
```

### Tech stack

- Google Apps Script V8 (no module system; files share one global namespace)
- Google Spreadsheet as DB (7 sheets: Services / Staff / StaffServices / Schedule / Holidays / Orders / Logs)
- Google Calendar API for booking events
- LINE LIFF v2 SDK for identity, Messaging API for push
- Jest 29 with in-memory GAS mocks for unit testing
- `@google/clasp` 2.4 for local dev → GAS deploy

### Secrets

All sensitive values live exclusively in GAS Script Properties (accessed via
`PropertiesService.getScriptProperties().getProperty(...)`). They are never
in source code, never in `.clasp.json` (gitignored), and never in any git commit.

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

### Cost

**NT$ 0 / month** within Google + GitHub + LINE OA free tiers (up to ~500
bookings/month and 200 OA broadcasts/month).

---

## License & Acknowledgments

This system was bootstrapped via a guided multi-stage workflow:
brainstorming → spec → 25-task plan → overnight autonomous implementation
(via the [Superpowers](https://github.com/anthropics/anthropic-quickstarts)
skill set) → real-device smoke test → production deploy.

Reference implementation inspired by [TinyBook](https://tinybook.cc/) — a
commercial LINE booking SaaS in Taiwan. This repo demonstrates a "Google
全包" (Google-only stack) alternative for single-shop operators.
