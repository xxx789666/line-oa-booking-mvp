// src/service/slot.js
var SlotCalculator = (function () {
  // Resolve Time module lazily — in GAS, var-declared top-level functions
  // form a single global namespace but eagerly capturing globalThis.Time at
  // IIFE construction can race with file load order.
  function _T() {
    if (typeof module !== 'undefined') return require('../utils/time');
    return Time; // global from src/utils/time.js
  }

  const GRID_MIN = 15;

  function _dow(dateStr) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  }

  function _isHoliday(dateStr, staffId, holidays) {
    return holidays.some(h =>
      h.date === dateStr && (h.staff_id === '' || h.staff_id === staffId)
    );
  }

  function compute({ date, staffId, durationMin, schedule, holidays, orders }) {
    if (_isHoliday(date, staffId, holidays)) return [];
    const dow = _dow(date);
    const sched = schedule.find(s => s.staff_id === staffId && s.day_of_week === dow);
    if (!sched) return [];

    const T = _T();
    const dayStart = T.combine(date, sched.start_time);
    const dayEnd = T.combine(date, sched.end_time);

    const ranges = orders
      .filter(o => o.staff_id === staffId)
      .map(o => [new Date(o.start_at).getTime(), new Date(o.end_at).getTime()]);

    const slots = [];
    for (let t = dayStart.getTime(); t + durationMin * 60000 <= dayEnd.getTime(); t += GRID_MIN * 60000) {
      const slotEnd = t + durationMin * 60000;
      const overlaps = ranges.some(([s, e]) => Math.max(t, s) < Math.min(slotEnd, e));
      if (!overlaps) slots.push(_T().formatHHmm(new Date(t)));
    }
    return slots;
  }

  return { compute };
})();

if (typeof module !== 'undefined') module.exports = SlotCalculator;
