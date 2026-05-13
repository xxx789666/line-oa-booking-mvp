// src/main.js
// GAS Web App entry points: doGet, doPost.
// Local exports include _dispatchGet/_dispatchPost for unit testing.

var _injectedRepos = null;
function _repos() {
  if (_injectedRepos) return _injectedRepos;
  return {
    settings: SettingsRepo,
    orders: OrdersRepo,
    auth: AuthService,
    slot: SlotCalculator,
    calendar: CalendarSync,
    line: LineMessenger,
    payment: PaymentAdapter
  };
}

function _ok(body) { return { type: 'json', body, status: 200 }; }
function _err(code, status) { return { type: 'json', body: { error: code }, status: status || 400 }; }

function _dispatchGet(e) {
  const p = (e && e.parameter) || {};
  const action = p.action;

  if (!action) {
    return { type: 'html', file: 'liff/index' };
  }

  try {
    const r = _repos();
    if (action === 'services') return _ok({ services: r.settings.listServices() });
    if (action === 'staff') {
      if (!p.service_id) return _err('missing_service_id');
      return _ok({ staff: r.settings.listStaffForService(p.service_id) });
    }
    if (action === 'availability') {
      if (!p.service_id || !p.staff_id || !p.date) return _err('missing_params');
      const svc = r.settings.getServiceById(p.service_id);
      if (!svc) return _err('service_not_found', 404);
      const orders = r.orders.listForStaffOnDate(p.staff_id, p.date);
      const slots = r.slot.compute({
        date: p.date,
        staffId: p.staff_id,
        durationMin: svc.duration_min,
        schedule: r.settings.getSchedule(),
        holidays: r.settings.getHolidays(),
        orders
      });
      return _ok({ slots });
    }
    if (action === 'myBookings') {
      if (!p.idToken) return _err('unauthenticated', 401);
      const user = r.auth.verify(p.idToken);
      return _ok({ orders: r.orders.listByUser(user.userId) });
    }
    return _err('unknown_action', 404);
  } catch (e) {
    const code = e && e.code ? e.code : 'internal_error';
    return _err(code, code === 'unauthenticated' ? 401 : 500);
  }
}

function doGet(e) {
  const out = _dispatchGet(e);
  if (out.type === 'html') {
    return HtmlService.createTemplateFromFile(out.file).evaluate()
      .setTitle('預約')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  return ContentService.createTextOutput(JSON.stringify(out.body))
    .setMimeType(ContentService.MimeType.JSON);
}

// Local-only DI hook
if (typeof module !== 'undefined') {
  module.exports = { _dispatchGet, _setRepos(r) { _injectedRepos = r; } };
}
