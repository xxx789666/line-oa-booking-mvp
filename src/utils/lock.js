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
