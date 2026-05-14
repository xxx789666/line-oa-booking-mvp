# v2 金流串接備忘錄

> 寫於 MVP（v1，stub 金流）跑通之後，給未來自己看的工程清單。
> v1 commit ladder 終點：`v0.1.14-lazy-orders` / GAS deployment v15。
> v2 起點：先看本文檔，然後選金流商、串接。

## 1. v1 現狀（已完工）

- `src/service/payment.js` 是 stub：`charge()` 直接回 `{success:true,method:'stub'}`、`refund()` 同
- 訂單流程「按確認 → 直接寫 Order + Calendar + LINE 推播」，沒有真扣款
- 任何客人按下「確認下訂並付款」都會成功 — 適合 demo / 內部測試，**不能對真客人開放**

## 2. 選金流商（先做這個）

| 方案 | 適合 | 申請週期 | 月費 | 信用卡費率 |
|------|------|---------|------|----------|
| **綠界 ECPay** | 中小型商家、文件齊全 | 1-2 週 | 0 元起 | ~2.75% |
| **藍新 NewebPay** | 中型以上、客服較好 | 1-2 週 | 0 元起 | ~2.75% |
| TapPay | 想客製化付款體驗 | 較難 | 簽約 | 議價 |

**建議**：綠界。台灣最普及、技術文件最齊、Stack Overflow 解答最多。

申請時要的證件（個人/公司有差別）：
- 負責人身分證
- 商業登記/設立登記
- 銀行存摺封面（撥款用）
- 商品圖片/服務介紹（要與實際業務一致）

## 3. 串接工作清單

### 3-1. GAS Script Properties 加上金流商機密
新增 4 個 key（綠界舉例）：
| Key | 來源 |
|-----|------|
| `ECPAY_MERCHANT_ID` | 綠界後台 → 商店資訊 |
| `ECPAY_HASH_KEY` | 綠界後台 → 系統開發管理 → 系統介接設定 |
| `ECPAY_HASH_IV` | 同上 |
| `ECPAY_BASE_URL` | 測試環境：`https://payment-stage.ecpay.com.tw`；正式環境：`https://payment.ecpay.com.tw` |

**透過 GAS 編輯器 → ⚙ 專案設定 → 指令碼屬性手動加**，不要寫進 git。

### 3-2. 改 `src/service/payment.js`
完整替換 stub。`charge()` 變兩階段：
1. 產生交易單號（用 `Id.newOrderId()` 或新建 `txn_id`）
2. 組裝參數 + 計算 CheckMacValue（綠界的 hash 驗證碼）
3. 回前端「跳轉 URL + 表單欄位」（綠界 AIO 介接是 POST form，不是 redirect URL）

範例 `charge()` 簽名：
```javascript
function charge({ orderId, amount, itemName, customerEmail }) {
  // 回傳給前端：要產生哪些 hidden input 跳轉到金流頁
  return {
    success: true,
    method: 'ecpay',
    redirectUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
    formFields: {
      MerchantID: '...',
      MerchantTradeNo: '...',
      TotalAmount: amount,
      TradeDesc: '...',
      ItemName: itemName,
      ReturnURL: '<GAS Web App URL>?action=payment_callback',
      ClientBackURL: '<LIFF URL>?status=paid',
      ...
      CheckMacValue: '<hash>'
    }
  };
}
```

`refund()` 改呼叫綠界 AioRefund：
- POST 到 `https://payment-stage.ecpay.com.tw/Cashier/AioRefund` 或正式環境
- 帶 MerchantTradeNo / RefundAmount 等

### 3-3. 改前端 `app.js`（GitHub Pages repo）
原本 `submitBooking()` 走 `apiPost('booking', {...})` 直接 alert 成功。改成：
```javascript
async function submitBooking() {
  // 1. 先佔位 — POST 到 booking 拿 orderId + 金流參數
  const result = await apiPost('booking', {...});
  if (!result.success) { alert(...); return; }

  // 2. 如果是 stub（dev 模式），直接顯示成功
  if (result.payment.method === 'stub') {
    showSuccess(result.order_id);
    return;
  }

  // 3. 真實金流 — 動態建 form 跳轉
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = result.payment.redirectUrl;
  Object.entries(result.payment.formFields).forEach(([k, v]) => {
    const input = document.createElement('input');
    input.type = 'hidden'; input.name = k; input.value = v;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  // 客人從這裡跳到綠界網頁，付完款綠界 redirect 回 ClientBackURL
}
```

### 3-4. 後端新增 `?action=payment_callback`
**伺服器對伺服器的 callback**（不是客人瀏覽器）：
- 綠界扣款完成後會 POST 到我們設定的 `ReturnURL`
- payload 含 MerchantTradeNo、RtnCode（1=成功）、TradeAmt、CheckMacValue
- GAS doPost 接到 → 驗 CheckMacValue → 找到 Order → 設 `payment_status='paid'`
- 必須回 `1|OK` 字串（綠界要求的回覆格式，不是 JSON）

### 3-5. 訂單狀態流轉
`Orders.payment_status` 多兩種狀態：
| 狀態 | 意思 |
|------|------|
| `pending` | 客人點了確認、訂單已佔位、等付款回呼 |
| `paid` | callback 成功確認扣款 |
| `failed` | callback 顯示扣款失敗 / timeout |

### 3-6. 退款流程
1. 客人在 LIFF「我的預約」按取消（業務規則：start_at − now > 24h 才可取消）
2. 後端 `?action=cancel`：
   - 呼叫綠界 AioRefund → 等回應
   - 成功：訂單 `status='cancelled'`、刪 Calendar 事件、推 LINE
   - 失敗：訂單留 `confirmed`，回客人「退款失敗請聯絡客服」+ 在 Logs 記錄

## 4. 三個風險點（必須處理）

### 4-1. LockService 10 秒超時
v1 的 `OrdersRepo.create()` 用 `LockService.tryLock(10000)` 包整個訂單寫入。
但真實金流 redirect 出去後客人可能 2-30 分鐘才付完。如果還在鎖內，鎖會早就釋放，**等於沒鎖**。

**改法 — 兩階段預約**：
1. **階段一（鎖內 < 1 秒）**：寫 `Order.status='pending'`、`payment_status='pending'`，立刻釋放鎖
2. **階段二（鎖外）**：產生金流 URL → 回給前端
3. **階段三（callback）**：扣款成功 → 改成 `paid` + `confirmed`
4. **階段四（cron 補救）**：每 5 分鐘掃 pending 超過 30 分鐘的訂單 → 改成 `failed`、釋放時段

Slot 衝突檢查時要把 `pending` 訂單也算進去（不然兩個人同時可以下訂同一時段）。

### 4-2. 對帳
**信念**：金流商說扣款成功 → 訂單變 paid。
**現實**：callback 偶爾掉、網路抖、客人從別處操作。

每天跑 cron 對帳：
- 拉綠界當日訂單清單（綠界 AIO 查詢介面 `/Cashier/QueryTradeInfo/V5`）
- 跟 Orders sheet 比對：金流說 paid 但我們 pending → 補成 paid
- 金流說失敗但我們 paid → 警告（不太可能但要警示）
- 寫對帳結果到 `ReconciliationLog` 分頁

### 4-3. 退款的複合操作
`refund()` 失敗時不能假裝沒事。寫一個 `_handleCancel_atomic`：
```
try {
  退款 API（綠界）
} catch (e) {
  Logs.error('refund_failed', ...);
  推 LINE 給客人 + 商家：「退款處理中，請聯絡客服」
  return { success: false, requires_manual: true };
}
// 退款成功 → 才開始改訂單狀態 / 刪 Calendar / 推完成通知
```

不能先標 cancelled 再退款（顺序錯了會卡帳）。

## 5. 測試 checklist（v2 上線前）

- [ ] 綠界**測試環境** stub 卡號扣款 → 訂單變 paid
- [ ] 模擬 callback 失敗 → 訂單留 pending → cron 標 failed → 時段釋放
- [ ] 重複 callback（綠界會重試）→ 不重複加 paid
- [ ] 同時兩人搶同一時段 → 只有一人成功 pending → 兩階段都正確
- [ ] 退款流程：成功 / 失敗 / 退款延遲
- [ ] 客人從 LIFF 取消 vs 商家從 Sheet 手動取消（v2 加商家後台時）
- [ ] 切換到綠界**正式環境**前再跑一次全部
- [ ] 第一筆真客人訂單前先用自己卡測 1 筆 NT$ 1（最小可扣款）

## 6. 預估工時

| 工作 | 估時 |
|------|------|
| 申請金流商家、文件來回 | 1-2 週（等審核）|
| `PaymentAdapter` 重寫 | 4 小時 |
| 前端 form 跳轉 | 1 小時 |
| Callback endpoint + 驗 hash | 3 小時 |
| 兩階段預約 + cron 補救 | 6 小時 |
| 對帳 cron | 4 小時 |
| 退款流程改寫 | 3 小時 |
| 測試（含切正式環境） | 1 天 |
| **總計（不含等審核）** | **約 3 天** |

## 7. 開始實作前的 sanity check

- [ ] Sheet `Orders` 分頁多加欄位：`txn_id`（金流商交易單號）、`payment_url`（暫存的金流頁 URL）
- [ ] GAS Properties 多加 4 個（見 §3-1）
- [ ] LIFF Endpoint URL **不用改**（仍是 GitHub Pages）
- [ ] LIFF Scope 不用改（profile + openid 夠用）
- [ ] 不要刪舊 PaymentAdapter，先 rename 成 `PaymentAdapterStub`、加新的 `PaymentAdapterEcpay`，用 GAS Property `PAYMENT_MODE=stub|ecpay` 切換，方便切回 stub 除錯

---

**v2 起點檔案**：
- `src/service/payment.js`
- `src/main.js`（doPost 多 callback 路由）
- `src/repo/orders.js`（多 `_pending` 條件）
- `src/triggers/reminder.js`（多 reconciliation cron）
- LIFF 端 `app.js`
