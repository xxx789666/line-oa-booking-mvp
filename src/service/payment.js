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
