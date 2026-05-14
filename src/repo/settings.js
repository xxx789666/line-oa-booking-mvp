// src/repo/settings.js
var SettingsRepo = (function () {
  const _CACHE_TTL_MS = 5 * 60 * 1000;
  let _cache = {};

  function _ss() {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    return SpreadsheetApp.openById(id);
  }

  function _trim(v) {
    if (typeof v === 'string') return v.trim();
    // Google Sheets auto-converts "10:00" cells into Date objects anchored at
    // 1899-12-30. Re-stringify as "HH:mm" using spreadsheet's timezone so the
    // hour reflects what the user typed (e.g. 10:00 Taipei not 02:00 UTC).
    if (v instanceof Date && v.getUTCFullYear() < 1950) {
      if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
        var tz = (typeof Session !== 'undefined' && Session.getScriptTimeZone)
          ? Session.getScriptTimeZone() : 'Asia/Taipei';
        return Utilities.formatDate(v, tz, 'HH:mm');
      }
      // Jest fallback
      var hh = String(v.getUTCHours()).padStart(2, '0');
      var mm = String(v.getUTCMinutes()).padStart(2, '0');
      return hh + ':' + mm;
    }
    return v;
  }

  function _readSheet(sheetName) {
    const cached = _cache[sheetName];
    if (cached && (Date.now() - cached.at < _CACHE_TTL_MS)) return cached.data;
    const sheet = _ss().getSheetByName(sheetName);
    if (!sheet) throw new Error('sheet_not_found:' + sheetName);
    const rows = sheet.getDataRange().getValues();
    if (rows.length === 0) return [];
    const header = rows[0].map(_trim);
    const data = rows.slice(1).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = _trim(r[i]); });
      return obj;
    });
    _cache[sheetName] = { at: Date.now(), data };
    return data;
  }

  function listServices() {
    return _readSheet('Services').filter(r => r.is_active === true);
  }

  function listStaff() {
    return _readSheet('Staff').filter(r => r.is_active === true);
  }

  function listStaffForService(serviceId) {
    const links = _readSheet('StaffServices').filter(r => r.service_id === serviceId);
    const ids = new Set(links.map(l => l.staff_id));
    return listStaff().filter(s => ids.has(s.staff_id));
  }

  function getSchedule() {
    return _readSheet('Schedule');
  }

  function getHolidays() {
    return _readSheet('Holidays');
  }

  function getServiceById(serviceId) {
    return _readSheet('Services').find(s => s.service_id === serviceId);
  }

  function getStaffById(staffId) {
    return _readSheet('Staff').find(s => s.staff_id === staffId);
  }

  function invalidateCache() {
    _cache = {};
  }

  return {
    listServices, listStaff, listStaffForService,
    getSchedule, getHolidays,
    getServiceById, getStaffById, invalidateCache
  };
})();

if (typeof module !== 'undefined') module.exports = SettingsRepo;
