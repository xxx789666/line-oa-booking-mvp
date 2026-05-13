// src/service/calendar.js
var CalendarSync = (function () {
  function _calId() {
    return PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  }

  function createBookingEvent({ customerName, serviceName, staffName, startAt, endAt, orderId, price }) {
    const cal = CalendarApp.getCalendarById(_calId());
    const title = `${customerName} - ${serviceName} (${staffName})`;
    const description = `訂單 #${orderId}\n金額 NT$ ${price}`;
    const event = cal.createEvent(title, new Date(startAt), new Date(endAt), { description });
    return event.getId();
  }

  function deleteEvent(eventId) {
    if (!eventId) return;
    try {
      const cal = CalendarApp.getCalendarById(_calId());
      const ev = cal.getEventById(eventId);
      if (ev) ev.deleteEvent();
    } catch (e) {
      // log but don't fail caller
      LogService.warn('CalendarSync', 'deleteEvent failed', { eventId, err: String(e) });
    }
  }

  return { createBookingEvent, deleteEvent };
})();

if (typeof module !== 'undefined') module.exports = CalendarSync;
