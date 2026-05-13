// src/repo/orders.js
var OrdersRepo = (function () {
  const Time = (typeof module !== 'undefined') ? require('../utils/time') : null;
  const Id = (typeof module !== 'undefined') ? require('../utils/id') : null;
  const LockHelper = (typeof module !== 'undefined') ? require('../utils/lock') : null;

  const T = Time || (typeof globalThis !== 'undefined' ? globalThis.Time : null);
  const I = Id || (typeof globalThis !== 'undefined' ? globalThis.Id : null);
  const L = LockHelper || (typeof globalThis !== 'undefined' ? globalThis.LockHelper : null);

  const SHEET = 'Orders';

  function _ss() {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    return SpreadsheetApp.openById(id);
  }

  function _readAll() {
    const sheet = _ss().getSheetByName(SHEET);
    const rows = sheet.getDataRange().getValues();
    if (rows.length === 0) return { header: [], rows: [], sheet };
    const header = rows[0];
    const data = rows.slice(1).map((r, idx) => {
      const obj = { _rowIndex: idx + 2 };
      header.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
    return { header, rows: data, sheet };
  }

  function listForStaffOnDate(staffId, dateStr) {
    const { rows } = _readAll();
    return rows.filter(r =>
      r.status === 'confirmed' &&
      r.staff_id === staffId &&
      T.toDateString(new Date(r.start_at)) === dateStr
    );
  }

  function listByUser(lineUserId) {
    const { rows } = _readAll();
    return rows.filter(r => r.line_user_id === lineUserId && r.status === 'confirmed');
  }

  function findById(orderId) {
    const { rows } = _readAll();
    return rows.find(r => r.order_id === orderId) || null;
  }

  function listUpcomingForReminder(fromIso, toIso) {
    const { rows } = _readAll();
    return rows.filter(r =>
      r.status === 'confirmed' &&
      !r.reminded_at &&
      r.start_at >= fromIso && r.start_at <= toIso
    );
  }

  // CRUD operations added in Task 11
  return {
    listForStaffOnDate, listByUser, findById, listUpcomingForReminder,
    _internal: { _readAll }
  };
})();

if (typeof module !== 'undefined') module.exports = OrdersRepo;
