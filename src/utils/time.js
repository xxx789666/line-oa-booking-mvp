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
