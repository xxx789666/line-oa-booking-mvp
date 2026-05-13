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
