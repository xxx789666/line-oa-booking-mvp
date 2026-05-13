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

function _dispatchPost(e) {
  const p = (e && e.parameter) || {};
  const action = p.action;
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (_) {}

  try {
    const r = _repos();
    if (action === 'booking') return _handleBooking(r, body);
    if (action === 'cancel') return _handleCancel(r, body);
    return _err('unknown_action', 404);
  } catch (e) {
    const code = e && e.code ? e.code : 'internal_error';
    return _err(code, code === 'unauthenticated' ? 401 : 500);
  }
}

function _handleBooking(r, body) {
  const user = r.auth.verify(body.idToken);
  const svc = r.settings.getServiceById(body.service_id);
  if (!svc) return _err('service_not_found', 404);
  const staff = r.settings.getStaffById(body.staff_id);
  if (!staff) return _err('staff_not_found', 404);

  const startAt = new Date(body.start_at);
  const endAt = new Date(startAt.getTime() + svc.duration_min * 60 * 1000);

  // Payment (stub for v1)
  const pay = r.payment.charge({ orderId: 'pending', amount: svc.price });
  if (!pay.success) return _err('payment_failed', 402);

  const orderId = r.orders.create({
    line_user_id: user.userId,
    customer_name: user.displayName,
    service_id: svc.service_id,
    staff_id: staff.staff_id,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    price: svc.price,
    payment_method: 'stub',
    note: body.note || ''
  });

  // Calendar (best-effort)
  try {
    const eventId = r.calendar.createBookingEvent({
      customerName: user.displayName, serviceName: svc.name, staffName: staff.name,
      startAt: startAt, endAt: endAt, orderId: orderId, price: svc.price
    });
    r.orders.setCalendarEventId(orderId, eventId);
  } catch (e) {
    if (typeof LogService !== 'undefined') LogService.warn('Booking', 'calendar_failed', { orderId });
  }

  // Push messages (best-effort)
  try {
    r.line.pushBookingConfirmed(user.userId, {
      serviceName: svc.name, staffName: staff.name, startAt: startAt, price: svc.price
    });
    if (staff.line_user_id) {
      r.line.pushOwnerNewOrder(staff.line_user_id, {
        customerName: user.displayName, serviceName: svc.name, startAt: startAt
      });
    }
  } catch (e) {
    if (typeof LogService !== 'undefined') LogService.warn('Booking', 'push_failed', { orderId });
  }

  return _ok({ order_id: orderId, success: true });
}

function _handleCancel(r, body) {
  const user = r.auth.verify(body.idToken);
  const order = r.orders.findById(body.order_id);
  if (!order) return _err('order_not_found', 404);
  if (order.line_user_id !== user.userId) return _err('not_owner', 403);
  if (order.status !== 'confirmed') return _err('already_cancelled');
  const now = Date.now();
  const start = new Date(order.start_at).getTime();
  if (start - now < 24 * 3600 * 1000) return _err('too_late');

  r.orders.cancel(order.order_id);
  r.calendar.deleteEvent(order.calendar_event_id);
  r.payment.refund({ orderId: order.order_id, amount: order.price });

  try {
    const svc = r.settings.getServiceById(order.service_id);
    const staff = r.settings.getStaffById(order.staff_id);
    if (staff && staff.line_user_id) {
      r.line.pushOwnerCancelled(staff.line_user_id, {
        customerName: user.displayName,
        serviceName: svc ? svc.name : '?',
        startAt: new Date(order.start_at)
      });
    }
  } catch (e) { /* swallow */ }

  return _ok({ success: true });
}

function doPost(e) {
  const out = _dispatchPost(e);
  return ContentService.createTextOutput(JSON.stringify(out.body))
    .setMimeType(ContentService.MimeType.JSON);
}

// Local-only DI hook
if (typeof module !== 'undefined') {
  module.exports = { _dispatchGet, _dispatchPost, _setRepos(r) { _injectedRepos = r; } };
}
