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
