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
