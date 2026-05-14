# 系統流程圖

> 涵蓋 LINE OA 預約系統 MVP（v0.1.0）的所有主要流程。圖用 Mermaid 語法（GitHub、VSCode、Obsidian 等預覽器原生支援）。

---

## 0. 系統架構（誰跟誰講話）

```mermaid
flowchart LR
  subgraph Phone["客人手機"]
    LineApp["LINE App"]
    LIFF["LIFF Webview<br/>（LINE 內建瀏覽器）"]
  end

  subgraph Cloud["雲端服務"]
    Pages["GitHub Pages<br/>xxx789666.github.io/line-oa-booking-liff/<br/>(靜態 HTML/JS/CSS)"]
    GAS["Google Apps Script<br/>script.google.com/.../exec<br/>(後端 API + Cron)"]
    Sheet[(Google Sheet<br/>LINE-OA-Booking-Data<br/>7 個分頁)]
    Cal[(Google Calendar<br/>LINE-OA-Booking)]
    LineAPI["LINE Messaging API<br/>api.line.me"]
  end

  subgraph Admin["商家"]
    Owner["老闆<br/>編輯 Sheet / 看 Calendar"]
  end

  LineApp -->|點圖文選單| LIFF
  LIFF -->|載入 HTML+JS| Pages
  LIFF -->|fetch GET/POST| GAS
  GAS -->|讀寫| Sheet
  GAS -->|建/刪事件| Cal
  GAS -->|push 訊息| LineAPI
  LineAPI -->|送達| LineApp

  Owner -->|管設定/看訂單| Sheet
  Owner -->|看行程| Cal

  classDef cloud fill:#e3f2fd,stroke:#1976d2
  classDef storage fill:#fff3e0,stroke:#f57c00
  class Pages,GAS,LineAPI cloud
  class Sheet,Cal storage
```

---

## 1. 客人預約完整流程（成功路徑）

```mermaid
sequenceDiagram
  autonumber
  participant C as 客人
  participant LineApp as LINE App
  participant LIFF as LIFF Webview
  participant Pages as GitHub Pages
  participant GAS as GAS Backend
  participant Sheet as Google Sheet
  participant Cal as Google Calendar
  participant API as LINE Messaging API

  C->>LineApp: 進「預約系統」OA 對話
  C->>LineApp: 點圖文選單「立即預約」
  LineApp->>LIFF: 開 liff.line.me/{LIFF_ID}
  LIFF->>Pages: 載入 index.html + app.js
  Pages-->>LIFF: 靜態頁
  LIFF->>LIFF: liff.init() / 取 idToken / 取 profile
  LIFF->>GAS: GET ?action=services
  GAS->>Sheet: 讀 Services 分頁
  Sheet-->>GAS: [剪髮+洗髮, 染髮]
  GAS-->>LIFF: {services:[...]}
  C->>LIFF: 點「剪髮+洗髮」
  LIFF->>GAS: GET ?action=staff&service_id=S001
  GAS->>Sheet: 讀 Staff + StaffServices
  Sheet-->>GAS: [測試設計師]
  GAS-->>LIFF: {staff:[...]}
  C->>LIFF: 點員工
  Note over LIFF: 在前端產 14 天日期格網
  C->>LIFF: 點日期
  LIFF->>GAS: GET ?action=availability&...
  GAS->>Sheet: 讀 Schedule + Holidays + Orders
  Sheet-->>GAS: 排班 + 已訂時段
  Note over GAS: SlotCalculator 算可預約 slot
  GAS-->>LIFF: {slots:["10:00","10:15",...]}
  C->>LIFF: 點時段 → 看確認頁 → 按「確認下訂」
  LIFF->>GAS: POST ?action=booking<br/>{idToken, service_id, staff_id, start_at}
  GAS->>API: 驗證 idToken
  API-->>GAS: {sub:userId, name, ...}
  Note over GAS: PaymentAdapter.charge()<br/>v1 stub 直接 success
  GAS->>Sheet: LockService → 再驗 slot → appendRow(Orders)
  Sheet-->>GAS: 訂單已寫入
  GAS->>Cal: 建事件「客人-服務(員工)」
  Cal-->>GAS: event_id
  GAS->>Sheet: 把 event_id 寫回 Orders
  par 推播給客人
    GAS->>API: push「預約成功」訊息
    API->>LineApp: 訊息送達
  and 推播給員工/老闆
    GAS->>API: push「新訂單」訊息（若 staff 有 line_user_id）
  end
  GAS-->>LIFF: {success:true, order_id}
  LIFF-->>C: 顯示「✓ 預約成功」+ 訂單編號
  C->>LIFF: 按「回到 LINE」
  Note over LineApp: 收到「預約成功」訊息 +<br/>Calendar 多了事件 + Sheet 多訂單
```

---

## 2. 客人預約流程的決策樹

```mermaid
flowchart TD
  A[客人開 LIFF] --> B{liff.init OK?}
  B -->|否| ERR1[顯示「無法初始化」]
  B -->|是| C{isLoggedIn?}
  C -->|否| LOGIN[顯示「使用 LINE 登入」按鈕]
  LOGIN --> A
  C -->|是| D[抓 idToken + profile]
  D --> E[載入服務列表]
  E --> F{服務 > 0?}
  F -->|否| EMPTY1[顯示「尚無上架服務」]
  F -->|是| G[客人選服務]
  G --> H[載入員工列表]
  H --> I{該服務有員工?}
  I -->|否| EMPTY2[顯示「此服務暫無人員」]
  I -->|是| J[客人選員工]
  J --> K[顯示 14 天日期格網]
  K --> L[客人選日期]
  L --> M[載入時段]
  M --> N{當天有時段?}
  N -->|否| EMPTY3[「這天沒有可預約時段」]
  N -->|是| O[客人選時段]
  O --> P[顯示確認頁]
  P --> Q[客人按「確認下訂」]
  Q --> R[POST booking]
  R --> S{成功?}
  S -->|是| OK[顯示「✓ 預約成功」]
  S -->|否| ERR2[Alert「預約失敗：原因」]
  ERR2 --> P

  classDef happy fill:#c8e6c9,stroke:#388e3c
  classDef bad fill:#ffcdd2,stroke:#c62828
  class OK happy
  class ERR1,ERR2,EMPTY1,EMPTY2,EMPTY3 bad
```

---

## 3. 後端 booking handler 內部處理

```mermaid
flowchart TD
  START([收到 POST /exec?action=booking]) --> PARSE[解析 body JSON]
  PARSE --> VERIFY[AuthService.verify idToken]
  VERIFY --> V_OK{成功?}
  V_OK -->|否 401| RETURN_401[回 unauthenticated]
  V_OK -->|是| GET_SVC[settings.getServiceById]
  GET_SVC --> SVC{找到?}
  SVC -->|否 404| R_NF1[回 service_not_found]
  SVC -->|是| GET_STAFF[settings.getStaffById]
  GET_STAFF --> STF{找到?}
  STF -->|否 404| R_NF2[回 staff_not_found]
  STF -->|是| CHARGE[PaymentAdapter.charge stub]
  CHARGE --> PAY{成功?}
  PAY -->|否 402| R_PAY[回 payment_failed]
  PAY -->|是| LOCK[LockService.tryLock 10s]
  LOCK --> L_OK{拿到鎖?}
  L_OK -->|否| R_LOCK[回 lock_timeout]
  L_OK -->|是| CONFLICT{slot 仍可預約?}
  CONFLICT -->|否| R_TAKEN[回 slot_taken]
  CONFLICT -->|是| WRITE[appendRow 到 Orders sheet]
  WRITE --> CAL_TRY{Calendar 寫入}
  CAL_TRY -->|成功| CAL_OK[更新 calendar_event_id]
  CAL_TRY -->|失敗| CAL_LOG[寫 Logs，不中斷]
  CAL_OK --> PUSH
  CAL_LOG --> PUSH
  PUSH[推 LINE 通知客人 + 員工<br/>失敗也只寫 Logs]
  PUSH --> SUCCESS[回 success + order_id]

  classDef ok fill:#c8e6c9
  classDef err fill:#ffcdd2
  classDef nop fill:#fff9c4
  class SUCCESS,CAL_OK ok
  class RETURN_401,R_NF1,R_NF2,R_PAY,R_LOCK,R_TAKEN err
  class CAL_LOG nop
```

---

## 4. 24 小時前提醒 cron（背景排程）

```mermaid
sequenceDiagram
  participant Trigger as GAS Time Trigger
  participant Reminder as Reminder.run
  participant Orders as OrdersRepo
  participant Sheet as Google Sheet
  participant API as LINE Messaging API
  participant Customer as 客人 LINE

  loop 每小時
    Trigger->>Reminder: reminderHourlyTrigger()
    Reminder->>Orders: listUpcomingForReminder<br/>(now+23h, now+25h)
    Orders->>Sheet: 讀 Orders 分頁<br/>filter status=confirmed AND<br/>reminded_at 空 AND<br/>start_at 在窗口內
    Sheet-->>Orders: 0~N 筆
    Orders-->>Reminder: orders list
    alt 有要提醒的訂單
      loop 對每筆訂單
        Reminder->>API: push「明天 HH:mm 預約提醒」
        API->>Customer: 訊息送達
        Reminder->>Sheet: 更新 reminded_at = now
        Note over Reminder: 失敗只寫 Logs，繼續下一筆
      end
    else 沒訂單
      Note over Reminder: 直接結束
    end
  end
```

---

## 5. 取消預約流程（v1 後端已實作，前端 UI 未做）

```mermaid
flowchart TD
  A[客人 LIFF 進「我的預約」<br/>v2 才會做] --> B[點某筆訂單的「取消」]
  B --> C[POST /exec?action=cancel<br/>{idToken, order_id}]
  C --> D[AuthService.verify idToken]
  D --> E{找到 order?}
  E -->|否| R1[回 order_not_found]
  E -->|是| F{訂單擁有者<br/>= 當前客人?}
  F -->|否| R2[回 not_owner]
  F -->|是| G{status = confirmed?}
  G -->|否| R3[回 already_cancelled]
  G -->|是| H{start_at - now > 24h?}
  H -->|否| R4[回 too_late]
  H -->|是| I[Orders.cancel<br/>status = cancelled]
  I --> J[CalendarSync.deleteEvent]
  J --> K[PaymentAdapter.refund stub]
  K --> L[推 LINE 通知員工取消]
  L --> M[回 success]

  classDef ok fill:#c8e6c9
  classDef err fill:#ffcdd2
  class M ok
  class R1,R2,R3,R4 err
```

---

## 6. SlotCalculator 演算法

```mermaid
flowchart TD
  IN[輸入：date / staffId / durationMin /<br/>schedule / holidays / orders] --> H{date 是<br/>該員工或全店假日?}
  H -->|是| EMPTY[回傳 空陣列]
  H -->|否| DOW[算出星期幾 0-6]
  DOW --> FIND{Schedule 有<br/>該員工 + 該星期幾?}
  FIND -->|否| EMPTY
  FIND -->|是| BOUNDS[算出當天<br/>start = combine date+start_time<br/>end = combine date+end_time]
  BOUNDS --> RANGES[從 orders 撈出該員工<br/>已訂區間 ranges]
  RANGES --> GRID[從 start 開始<br/>每 15 分鐘一個 slot]
  GRID --> LOOP{slot + duration<br/>≤ end?}
  LOOP -->|否| OUT[輸出 slot 列表]
  LOOP -->|是| CHECK{slot 與 ranges<br/>有重疊?}
  CHECK -->|是| NEXT[跳過<br/>t += 15min]
  CHECK -->|否| PUSH[加入結果<br/>t += 15min]
  NEXT --> LOOP
  PUSH --> LOOP

  classDef terminal fill:#c8e6c9
  class EMPTY,OUT terminal
```

---

## 7. 資料流（一個訂單從成立到完成）

```mermaid
stateDiagram-v2
  [*] --> Browsing: 客人開 LIFF
  Browsing --> Confirming: 選完服務/員工/時段
  Confirming --> Submitted: 按「確認下訂」
  Submitted --> Written: GAS LockService 寫入 Order
  Written --> Mirrored: Calendar 事件建立
  Mirrored --> Notified: 推送 LINE 訊息
  Notified --> Confirmed: 訂單狀態 confirmed
  Confirmed --> Reminding: cron 找到 24h 內訂單
  Reminding --> Reminded: reminded_at 填入
  Reminded --> Showed: 客人到場（人工處理）
  Showed --> Completed: 商家手動改 status = completed<br/>(v2 加後台時做)
  Confirmed --> Cancelling: 客人取消（>24h 前）
  Cancelling --> Refunded: 退款 + Calendar 刪 + 通知
  Refunded --> Cancelled: 訂單狀態 cancelled
  Cancelled --> [*]
  Completed --> [*]
```

---

## 8. 容錯處理（失敗時系統怎麼反應）

```mermaid
flowchart LR
  subgraph 訂單主流程
    A[寫入 Order] --> B[寫入 Calendar]
    B --> C[推 LINE]
  end

  subgraph 失敗處理
    A -.失敗.-> A_ERR[回 internal_error<br/>客人看到失敗]
    B -.失敗.-> B_LOG[寫 Logs<br/>訂單已成立，繼續]
    C -.失敗.-> C_LOG[寫 Logs<br/>訂單已成立，繼續]
  end

  subgraph 補救機制
    B_LOG -.之後.-> RECON[未來 v2 加對帳 cron<br/>掃 calendar_event_id 為空<br/>補建事件]
    C_LOG -.之後.-> RETRY[v2 可加 LINE 推播重試]
  end

  classDef critical fill:#ffcdd2,stroke:#c62828
  classDef nonblocking fill:#fff9c4,stroke:#f57f17
  classDef future fill:#e1bee7,stroke:#7b1fa2
  class A_ERR critical
  class B_LOG,C_LOG nonblocking
  class RECON,RETRY future
```

---

## 9. 部署 / 程式碼變動的流程（給未來改 code 的自己看）

```mermaid
flowchart TD
  EDIT[本機改 src/*.js] --> TEST[npm test<br/>30 個單元測試]
  TEST -->|不過| FIX[修到過為止]
  FIX --> TEST
  TEST -->|過| PUSH[clasp push --force]
  PUSH --> DEPLOY[clasp deploy --deploymentId X<br/>--description vX.X.X]
  DEPLOY --> VERIFY[curl 驗證 endpoint]
  VERIFY --> COMMIT[git commit]
  COMMIT --> END([結束])

  EDIT2[本機改 D:\line-oa-booking-liff\*.js] --> COMMIT2[git commit]
  COMMIT2 --> GHPUSH[git push to GitHub]
  GHPUSH --> WAIT[等 30 秒~1 分鐘<br/>Pages 自動部署]
  WAIT --> END2([結束])

  classDef step fill:#e3f2fd,stroke:#1976d2
  class EDIT,TEST,PUSH,DEPLOY,VERIFY,COMMIT,EDIT2,COMMIT2,GHPUSH,WAIT step
```

---

## 10. 商家後台的「使用者」流程（純 Google Workspace）

```mermaid
flowchart LR
  subgraph 設定階段
    A[加新服務] --> AS[Sheet → Services 分頁<br/>加一列]
    B[加新員工] --> BS[Sheet → Staff 分頁<br/>加一列]
    C[改班表] --> CS[Sheet → Schedule 分頁<br/>改 start/end_time]
    D[加休假] --> DS[Sheet → Holidays 分頁<br/>加日期]
  end

  subgraph 營運階段
    E[看今天訂單] --> ES[Google Calendar]
    F[看本月訂單] --> FS[Sheet → Orders 分頁<br/>filter status=confirmed]
    G[看收入] --> GS[Sheet → Orders<br/>SUM price]
    H[聯絡客人] --> HS[Sheet 看 line_user_id<br/>到 OA 對話搜尋]
  end

  AS -.5 分鐘內.-> LIVE[LIFF 看到新內容]
  BS -.同上.-> LIVE
  CS -.同上.-> LIVE
  DS -.同上.-> LIVE

  classDef ws fill:#fff3e0,stroke:#f57c00
  class AS,BS,CS,DS,ES,FS,GS,HS ws
```

> **重點**：商家完全不需要學任何後台介面，只用 Google Sheet + Google Calendar 就能管整個業務。Cache TTL = 5 分鐘，所以改 Sheet 後客人那邊最多 5 分鐘看到變更。

---

## 11. 帳號／服務地圖（這套系統用了哪些 Google + LINE 服務）

```mermaid
flowchart TB
  subgraph Google ["xxx69579575@gmail.com（商家 Google 帳號）"]
    direction LR
    GAS_P["Apps Script 專案<br/>LINE-OA-Booking-MVP"]
    SS["Spreadsheet<br/>LINE-OA-Booking-Data"]
    CAL["Calendar<br/>LINE-OA-Booking"]
  end

  subgraph LINE ["LINE Developers（XLINE-OA-Booking Provider）"]
    direction LR
    LOGIN["LINE Login Channel<br/>內含 LIFF App 預約系統<br/>Channel ID: 2010082504"]
    MSG["Messaging API Channel<br/>= LINE OA「預約系統」<br/>短號 @568enjev"]
  end

  subgraph GitHub ["xxx789666 GitHub"]
    REPO["Repo: line-oa-booking-liff<br/>public, Pages enabled"]
  end

  GAS_P -.讀寫.-> SS
  GAS_P -.讀寫.-> CAL
  GAS_P -.推播.-> MSG
  GAS_P -.驗證 idToken.-> LOGIN
  LOGIN -.LIFF URL 指向.-> REPO
  REPO -.fetch.-> GAS_P

  classDef google fill:#e3f2fd,stroke:#1976d2
  classDef line fill:#c8e6c9,stroke:#388e3c
  classDef github fill:#f5f5f5,stroke:#424242
  class GAS_P,SS,CAL google
  class LOGIN,MSG line
  class REPO github
```

---

## 看圖的方法

- **VSCode**: 安裝 `Markdown Preview Mermaid Support` 擴充
- **GitHub**: 推上去後 `.md` 在 web UI 自動 render
- **Obsidian / Typora / Notion**: 原生支援
- **單純看**: 把 mermaid 區塊複製到 https://mermaid.live/ 線上渲染

---

> 本文檔對應 git tag `v0.1.0-mvp`、GAS deployment v15。任何流程有變更請同步更新本檔。
