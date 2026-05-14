// src/repo/orders.js
var OrdersRepo = (function () {
  // Lazy module resolution — globals may not exist when this IIFE runs.
  function _T() { return (typeof module !== 'undefined') ? require('../utils/time') : Time; }
  function _I() { return (typeof module !== 'undefined') ? require('../utils/id') : Id; }
  function _L() { return (typeof module !== 'undefined') ? require('../utils/lock') : LockHelper; }

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
      _T().toDateString(new Date(r.start_at)) === dateStr
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

  function _conflict(rows, staffId, startAtIso) {
    return rows.some(r =>
      r.status === 'confirmed' &&
      r.staff_id === staffId &&
      r.start_at === startAtIso
    );
  }

  function create(input) {
    return _L().withLock(function () {
      const { header, rows, sheet } = _readAll();
      if (_conflict(rows, input.staff_id, input.start_at)) {
        const err = new Error('slot_taken');
        err.code = 'slot_taken';
        throw err;
      }
      const orderId = _I().newOrderId();
      const newRow = {
        order_id: orderId,
        created_at: new Date().toISOString(),
        line_user_id: input.line_user_id,
        customer_name: input.customer_name,
        service_id: input.service_id,
        staff_id: input.staff_id,
        start_at: input.start_at,
        end_at: input.end_at,
        price: input.price,
        payment_method: input.payment_method || 'stub',
        payment_status: 'paid',
        status: 'confirmed',
        reminded_at: '',
        calendar_event_id: '',
        note: input.note || ''
      };
      sheet.appendRow(header.map(h => newRow[h] !== undefined ? newRow[h] : ''));
      return orderId;
    });
  }

  function _updateRow(orderId, patch) {
    const { header, rows, sheet } = _readAll();
    const target = rows.find(r => r.order_id === orderId);
    if (!target) throw new Error('order_not_found');
    Object.entries(patch).forEach(([key, val]) => {
      const colIdx = header.indexOf(key);
      if (colIdx === -1) return;
      sheet.getRange(target._rowIndex, colIdx + 1).setValue(val);
    });
  }

  function cancel(orderId) {
    _updateRow(orderId, { status: 'cancelled' });
  }

  function markReminded(orderId) {
    _updateRow(orderId, { reminded_at: new Date().toISOString() });
  }

  function setCalendarEventId(orderId, eventId) {
    _updateRow(orderId, { calendar_event_id: eventId });
  }

  return {
    listForStaffOnDate, listByUser, findById, listUpcomingForReminder,
    create, cancel, markReminded, setCalendarEventId,
    _internal: { _readAll }
  };
})();

if (typeof module !== 'undefined') module.exports = OrdersRepo;
