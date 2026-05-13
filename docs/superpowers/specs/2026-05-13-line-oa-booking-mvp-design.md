# LINE OA Booking MVP — 設計文件

- **建立日期**: 2026-05-13
- **狀態**: Draft
- **目標讀者**: 個人開發者（單商家用例）

---

## 1. 背景與目標

仿照 [TinyBook 社群預約](https://tinybook.cc/social/) 的核心預約流程，建置一套**單商家、零雲端費用、全部跑在 Google 與 LINE 內**的 LINE 官方帳號預約系統 MVP。

### 1.1 商業需求
- 客人從 LINE 官方帳號的圖文選單進入，**全程不離開 LINE**
- 客人選服務、員工、日期、時段 → 下訂時全額付清
- 商家在 Google Calendar 看到訂單、Google Sheet 管設定
- 系統自動推「預約成功」與「24 小時前提醒」訊息

### 1.2 非目標（v1 不做）
- 真實金流串接（v1 使用 stub，未來接 ECPay/NewebPay）
- 會員紅利、分級
- 部落格
- 多商家 / SaaS 多租戶
- EDM 群發
- 報表 dashboard

### 1.3 成功標準
1. 客人從 LINE 圖文選單按到「預約成功」訊息，全流程 ≤ 60 秒
2. 同一時段被兩人同時點選，只有一人成功（無重複訂單）
3. 商家不需開電腦／不需登入後台，所有設定在手機 Google App 內完成
4. 月開銷 NT$0（個人 Google 帳號額度內）

---

## 2. 系統架構

### 2.1 高階圖

```
┌──────────────────────────────────────────────────────────┐
│                     客人手機                              │
│  LINE App → 圖文選單「立即預約」                          │
│                       │                                    │
│                       ▼                                    │
│  LIFF 畫面 (HTML 由 GAS HtmlService 提供)                 │
│  [服務] → [員工] → [日期] → [時段] → [確認] → [付款]     │
└────────────────────────┬─────────────────────────────────┘
                         │ POST 訂單（夾 idToken）
                         ▼
┌──────────────────────────────────────────────────────────┐
│        Google Apps Script（後端）                         │
│  doGet  → 回 LIFF HTML 或 /availability JSON              │
│  doPost → /booking, /cancel                                │
│  trigger → 每小時「24h 提醒」                              │
│                                                            │
│  模組:                                                     │
│   ├─ AuthService    （驗 LIFF idToken）                   │
│   ├─ SettingsRepo   （讀 Sheet 設定、5min 快取）          │
│   ├─ OrdersRepo     （讀寫 Orders sheet）                 │
│   ├─ SlotCalculator （算可預約時段）                      │
│   ├─ CalendarSync   （寫 Google Calendar）                │
│   ├─ LineMessenger  （推 LINE 訊息）                      │
│   └─ PaymentAdapter （v1 stub）                           │
└────────────┬──────────────┬──────────────┬────────────────┘
             ▼              ▼              ▼
   Google Sheet      Google Calendar    LINE API
   (設定 + 訂單)     (商家檢視)         (推送訊息)
```

### 2.2 元件職責

| 元件 | 職責 | 依賴 |
|------|------|------|
| **LIFF Frontend** | UI 流程、idToken 取得、呼叫後端 | LINE LIFF SDK |
| **GAS Router (main.js)** | doGet / doPost 路由、錯誤統一處理 | 其他模組 |
| **AuthService** | 驗證 idToken、解出 userId / displayName | LINE Verify API |
| **SettingsRepo** | 從 Sheet 讀 Services/Staff/Schedule/Holidays | SpreadsheetApp, PropertiesService |
| **OrdersRepo** | 訂單 CRUD（含 LockService 序列化寫入） | SpreadsheetApp, LockService |
| **SlotCalculator** | 給定（日期、員工、服務時長），算可預約時段（扣除已訂、扣除休假） | SettingsRepo, OrdersRepo |
| **CalendarSync** | 訂單成立寫 Calendar 事件、取消刪事件 | CalendarApp |
| **LineMessenger** | 呼叫 LINE Messaging API push 訊息 | UrlFetchApp |
| **PaymentAdapter** | v1: 回 `{success: true, method: 'stub'}` <br> v2: 串 ECPay/NewebPay | （v2 起依賴金流商 SDK） |

---

## 3. 資料模型（Google Sheet）

整個系統使用**單一 Spreadsheet**，內含 7 個 Sheet 分頁：

### 3.1 `Services` — 服務目錄
| 欄位 | 型別 | 範例 | 說明 |
|------|------|------|------|
| service_id | string (PK) | `S001` | 服務 ID |
| name | string | `剪髮 + 洗髮` | 顯示名稱 |
| duration_min | int | `60` | 服務時長（分鐘） |
| price | int | `800` | 價格（TWD） |
| description | string | `含洗髮、頭皮按摩` | 簡介 |
| is_active | bool | `TRUE` | 是否上架 |

### 3.2 `Staff` — 員工
| 欄位 | 型別 | 說明 |
|------|------|------|
| staff_id | string (PK) | 員工 ID |
| name | string | 顯示名稱 |
| photo_url | string | 大頭照 URL |
| line_user_id | string | 接收訂單通知的 LINE userId |
| is_active | bool | 是否上架 |

### 3.3 `StaffServices` — 員工可做哪些服務（多對多）
| 欄位 | 型別 |
|------|------|
| staff_id | string (FK) |
| service_id | string (FK) |

### 3.4 `Schedule` — 每週固定班表
| 欄位 | 型別 | 範例 |
|------|------|------|
| staff_id | string (FK) | `ST001` |
| day_of_week | int (0-6, 0=Sun) | `1` (週一) |
| start_time | string (HH:mm) | `09:00` |
| end_time | string (HH:mm) | `18:00` |

### 3.5 `Holidays` — 例外休假
| 欄位 | 型別 | 說明 |
|------|------|------|
| date | string (YYYY-MM-DD) | 休假日 |
| staff_id | string (FK, optional) | 空白 = 全店休 |
| reason | string | 顯示用 |

### 3.6 `Orders` — 訂單（資料庫）
| 欄位 | 型別 | 說明 |
|------|------|------|
| order_id | string (PK, UUID) | 訂單 ID |
| created_at | ISO datetime | 建立時間 |
| line_user_id | string | 客人 LINE userId |
| customer_name | string | 客人 LINE displayName |
| customer_phone | string (optional) | 客人手機（v2 加） |
| service_id | string (FK) | |
| staff_id | string (FK) | |
| start_at | ISO datetime | 開始時間 |
| end_at | ISO datetime | 結束時間 |
| price | int | 訂單金額 |
| payment_method | string | `stub` / `ecpay_credit` / `linepay` |
| payment_status | string | `pending` / `paid` / `failed` |
| status | string | `confirmed` / `cancelled` / `completed` |
| reminded_at | ISO datetime (optional) | 24h 提醒已發送時間 |
| calendar_event_id | string | Google Calendar 事件 ID（取消時用） |
| note | string | 客人備註 |

### 3.7 `Logs` — 系統日誌
| 欄位 | 型別 |
|------|------|
| timestamp | ISO datetime |
| level | `INFO` / `WARN` / `ERROR` |
| module | string |
| msg | string |
| payload | string (JSON) |

---

## 4. 主要流程

### 4.1 預約流程（Happy Path）

```
1. 客人在 LINE OA 點圖文選單「預約」
2. LIFF 開啟，URL: liff://{liffId}
3. LIFF SDK 取得 idToken + userProfile
4. JS 呼叫 GET /api/services → 顯示服務列表
5. 客人選服務 → GET /api/staff?service_id=X → 顯示員工列表
6. 客人選員工 → GET /api/availability?service_id=X&staff_id=Y&date=Z
   - GAS 算法：
     a. 從 Schedule 取該員工該星期幾的營業時段
     b. 從 Holidays 排除該日休假
     c. 從 Orders 取該員工該日已預約區間
     d. 用服務時長切 slot（每 15 分鐘起跳一個 slot）
     e. 回傳可預約 slot 列表
7. 客人選時段 → POST /api/booking
   Payload: { service_id, staff_id, start_at, idToken }
8. GAS 處理：
   a. AuthService.verify(idToken) → 取 userId
   b. LockService.tryLock(10s)
   c. OrdersRepo 再次驗 slot 仍可預約（防 race）
   d. PaymentAdapter.charge() → stub 直接回 success
   e. OrdersRepo.create() 寫入 Orders sheet
   f. CalendarSync.createEvent() → 取得 event_id 回填 Orders
   g. LineMessenger.push(客人, "預約成功訊息")
   h. LineMessenger.push(員工, "您有新訂單")
   i. LockService.release()
   j. 回 { order_id, success: true }
9. LIFF 顯示「預約成功」畫面，附 [關閉] 按鈕
10. 客人關閉 LIFF → 回到 LINE 對話 → 收到推播訊息
```

### 4.2 24 小時提醒（背景 Cron）

```
每小時觸發一次 (Apps Script Time Trigger):
1. 找 Orders 中:
   - status = 'confirmed'
   - reminded_at IS NULL
   - start_at BETWEEN now+23h AND now+25h
2. 對每筆:
   - LineMessenger.push(line_user_id, "明天 HH:mm 預約提醒")
   - OrdersRepo.update(order_id, { reminded_at: now })
3. 失敗者寫進 Logs 留供下次重試
```

### 4.3 取消預約

```
1. 客人在 LIFF「我的預約」點 [取消]
2. POST /api/cancel { order_id, idToken }
3. GAS:
   a. AuthService.verify → 確認 userId 是訂單持有人
   b. 業務規則：start_at - now > 24h 才可取消（避免太晚取消）
   c. OrdersRepo.update(status='cancelled')
   d. CalendarSync.deleteEvent(calendar_event_id)
   e. PaymentAdapter.refund() → stub 直接回 success
   f. LineMessenger.push(客人, "取消成功")
   g. LineMessenger.push(員工, "客人取消訂單")
4. LIFF 重新整理「我的預約」
```

---

## 5. API 規格

所有 API 由 GAS doGet / doPost 處理，**統一從 URL query string 取 `action`**：

### 5.1 `GET ?action=services`
Response: `{ services: [{ service_id, name, duration_min, price, description }] }`

### 5.2 `GET ?action=staff&service_id=X`
Response: `{ staff: [{ staff_id, name, photo_url }] }`

### 5.3 `GET ?action=availability&service_id=X&staff_id=Y&date=YYYY-MM-DD`
Response: `{ slots: ["09:00", "09:15", "10:30", ...] }`

### 5.4 `POST ?action=booking`
Body: `{ service_id, staff_id, start_at, idToken, note? }`
Response: `{ order_id, success: true }` or `{ success: false, error: "slot_taken" }`

### 5.5 `GET ?action=myBookings&idToken=<token>`
Response: `{ orders: [...] }`

### 5.6 `POST ?action=cancel`
Body: `{ order_id, idToken }`
Response: `{ success: true }` or `{ success: false, error: "too_late" }`

**錯誤碼**:
- `unauthenticated` — idToken 缺失或失效
- `slot_taken` — 時段已被預約
- `out_of_business_hours` — 不在營業時段
- `service_not_found` / `staff_not_found`
- `too_late` — 取消時間太接近
- `not_owner` — 嘗試取消他人訂單
- `internal_error` — 其他

---

## 6. 邊界與錯誤處理

| 情境 | 處理策略 |
|------|---------|
| **同時兩人搶同一個時段** | `LockService.getScriptLock().tryLock(10000)`；後者重新檢查 slot 後拒絕 |
| **LINE 推播 API 失敗** | 寫 Logs，**不**回滾訂單；用 cron 重試 |
| **Sheet API quota 不足** | SettingsRepo 用 `PropertiesService` 快取 5 分鐘 |
| **GAS 6 分鐘執行上限** | 訂單流程 < 5 秒；提醒 cron 每次處理一批，超量留下次 |
| **idToken 過期** | 回 401，LIFF JS 重打 `liff.getIDToken()` 再試 |
| **Sheet 欄位被老闆改壞** | 啟動時 `SettingsRepo` 驗 schema，缺欄位丟 `INFO` Log + 用預設值 |
| **Calendar 寫入失敗** | 訂單仍成立，`calendar_event_id` 留空 + Log；下次 cron 補同步 |
| **客人重複按確認** | 前端 button disable + 後端用 `(line_user_id, start_at)` 去重（呼應 §12 Q2：同客同時段只一筆）|
| **時區** | GAS / Sheet 全用 `Asia/Taipei`，存 ISO 8601 含時區 |
| **客人變更 LINE 頭像/名稱** | 訂單存 snapshot；不追同步 |

---

## 7. 安全

| 項目 | 做法 |
|------|------|
| **LIFF idToken 驗證** | 每個 API call 都打 `https://api.line.me/oauth2/v2.1/verify` 驗證並取 userId |
| **LINE Channel Secret / Access Token** | 存 `PropertiesService`，**禁止寫死在程式碼** |
| **Sheet 權限** | Spreadsheet 私有，僅商家 Google 帳號可看；GAS 以擁有者身分執行 |
| **訂單擁有權** | 取消／查詢時驗 `idToken.userId === order.line_user_id` |
| **CSRF** | LIFF idToken 等同 bearer token，本身就是憑證 |
| **Rate limit** | v1 不做；GAS 自身有 quota 保護；v2 視需求加 IP / userId 限速 |
| **PII** | 訂單只存 LINE userId（不可逆推到真人），不存身分證等敏感資料 |

---

## 8. 部署與開發

### 8.1 專案結構
```
D:\line官方網站訂閱系統\
├── src/
│   ├── main.js              # doGet / doPost router
│   ├── auth.js              # AuthService
│   ├── repo/
│   │   ├── settings.js      # SettingsRepo
│   │   └── orders.js        # OrdersRepo
│   ├── service/
│   │   ├── slot.js          # SlotCalculator
│   │   ├── calendar.js      # CalendarSync
│   │   ├── line.js          # LineMessenger
│   │   └── payment.js       # PaymentAdapter (stub)
│   └── liff/
│       ├── index.html       # LIFF 頁面
│       ├── app.js
│       └── style.css
├── tests/                   # 本機單元測試（Jest）
├── appsscript.json          # GAS 設定（時區、scopes）
├── .clasp.json              # clasp 設定
├── package.json
└── docs/superpowers/specs/2026-05-13-line-oa-booking-mvp-design.md
```

### 8.2 開發流程
1. 本機開發 → `clasp push` 上傳至 GAS
2. GAS 編輯器內「部署 → 新增部署」→ 取得 Web App URL
3. LINE Developers Console → 建 LIFF App，Endpoint URL 填 GAS Web App URL
4. LINE OA Manager → 圖文選單「預約」按鈕指向 `liff://{liffId}`

### 8.3 環境變數（GAS PropertiesService）
| Key | 說明 |
|-----|------|
| `LINE_CHANNEL_ID` | LIFF Channel ID |
| `LINE_CHANNEL_SECRET` | LIFF Channel Secret |
| `LINE_MESSAGING_CHANNEL_TOKEN` | LINE Messaging API Channel Access Token |
| `SPREADSHEET_ID` | 設定 + 訂單 Spreadsheet ID |
| `CALENDAR_ID` | 商家 Google Calendar ID |
| `STAGING` | `true` / `false`（決定送測試或正式訊息） |

### 8.4 GAS OAuth Scopes（`appsscript.json` 必填）
```json
{
  "timeZone": "Asia/Taipei",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp"
  ],
  "webapp": { "access": "ANYONE_ANONYMOUS", "executeAs": "USER_DEPLOYING" }
}
```

---

## 9. 測試策略

GAS 無原生單元測試框架，策略如下：

| 測試類型 | 工具 / 做法 |
|---------|----------|
| **單元測試** | 本機 Jest + 把 GAS 全域物件（SpreadsheetApp、UrlFetchApp）注入 mock。所有業務邏輯（SlotCalculator、SettingsRepo 等）寫成「函式接受參數」可注入。 |
| **整合測試** | 另開 staging GAS 專案 + 測試用 LINE Channel + 測試用 Spreadsheet，跑完整 booking → reminder → cancel 流程。 |
| **手動 smoke** | 上線前用真實 LINE 帳號跑：預約 → 取消 → 再預約 → 等 24h 提醒（或手動觸發 cron）。 |
| **回歸** | Logs sheet 留所有 API 進出，異常即查。 |

---

## 10. 風險與已知限制

| 風險 | 說明 | 緩解 |
|------|------|------|
| **GAS quota** | 個人帳號每日 6 小時執行時間、20,000 次 UrlFetch 等 | 預估 < 500 筆/月，遠低於 quota |
| **Sheet 當 DB 的限制** | 列數超過 10 萬會慢 | 每年 archive 一次 Orders sheet |
| **GAS 冷啟動** | 第一次回應可能 2-3 秒 | LIFF 顯示「載入中」提示 |
| **無交易（transaction）** | 寫 Sheet + Calendar + LINE 不是原子操作 | 用 LockService + 失敗時 Log，由 cron 補償 |
| **金流 stub** | v1 不真的扣款 | 明示「測試模式」；上線真用前必接 ECPay/NewebPay |
| **路徑含中文** | `D:\line官方網站訂閱系統\` 中文路徑某些工具會出問題 | clasp 應該沒問題，但若遇到工具失敗考慮改英文路徑 |

---

## 11. v2+ Roadmap（不在本 spec 範圍）

| 階段 | 子系統 |
|------|--------|
| v2 | 真實金流（ECPay 或 NewebPay）— 替換 PaymentAdapter。**注意**：v1 的 `LockService.tryLock(10s)` 對 stub 沒問題，但接真實金流時付款 redirect 可能超過 10s，需把付款流程拆出鎖、改用「先佔位 pending → 確認後 paid」兩段式 |
| v3 | 會員紅利、消費歷史 |
| v4 | 部落格 / 文章 |
| v5 | 多商家 SaaS（需要重寫資料模型、加 shop_id） |

---

## 12. 開放問題（需後續決定）

1. 服務時長若不是 15 分鐘倍數（如 50 分鐘），slot 邊界怎麼切？
   - 暫定：固定 15 分鐘 grid，服務跨多個 grid。
2. 客人可否同時間預約兩個不同員工？
   - 暫定：不可，同一 LINE userId 同一時段只能有一筆 active 訂單。
3. 員工可否同時被預約兩筆「服務區間部分重疊」訂單？
   - 暫定：不可，員工 slot 嚴格序列。
4. 跨日訂單（如晚上 23:30 開始的 60 分鐘服務）？
   - 暫定：禁止，營業時段必須當日結束。

---

**End of Document**
