// src/triggers/reminder.js
var Reminder = (function () {
  let _deps = null;
  function _D() {
    if (_deps) return _deps;
    return {
      orders: OrdersRepo, settings: SettingsRepo, line: LineMessenger,
      now: () => new Date()
    };
  }

  function run() {
    const d = _D();
    const now = d.now();
    const fromIso = new Date(now.getTime() + 23 * 3600 * 1000).toISOString();
    const toIso = new Date(now.getTime() + 25 * 3600 * 1000).toISOString();
    const upcoming = d.orders.listUpcomingForReminder(fromIso, toIso);

    upcoming.forEach(o => {
      try {
        const svc = d.settings.getServiceById(o.service_id);
        const staff = d.settings.getStaffById(o.staff_id);
        d.line.pushReminder(o.line_user_id, {
          serviceName: svc ? svc.name : '',
          staffName: staff ? staff.name : '',
          startAt: new Date(o.start_at)
        });
        d.orders.markReminded(o.order_id);
      } catch (e) {
        if (typeof LogService !== 'undefined') {
          LogService.warn('Reminder', 'failed', { orderId: o.order_id, err: String(e) });
        }
      }
    });
  }

  // GAS entry — called by Time Trigger
  function reminderHourlyTrigger() { run(); }

  return { run, reminderHourlyTrigger, _setDeps(d) { _deps = d; } };
})();

// expose top-level for GAS trigger registration
function reminderHourlyTrigger() { Reminder.reminderHourlyTrigger(); }

if (typeof module !== 'undefined') module.exports = Reminder;
