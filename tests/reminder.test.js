const Reminder = require('../src/triggers/reminder');

describe('Reminder cron', () => {
  beforeEach(() => installGasMocks({}));
  it('pushes reminders for orders in [now+23h, now+25h] window', () => {
    const captured = { pushed: [], marked: [] };
    Reminder._setDeps({
      orders: {
        listUpcomingForReminder: () => [
          { order_id: 'O1', line_user_id: 'U1', start_at: '2026-06-01T02:00:00Z',
            service_id: 'S1', staff_id: 'ST1', status: 'confirmed' }
        ],
        markReminded: (id) => captured.marked.push(id)
      },
      settings: {
        getServiceById: () => ({ name: '剪髮' }),
        getStaffById: () => ({ name: 'Alice' })
      },
      line: { pushReminder: (u, ctx) => captured.pushed.push([u, ctx]) },
      now: () => new Date('2026-05-31T03:00:00Z') // 23h before
    });
    Reminder.run();
    expect(captured.pushed.length).toBe(1);
    expect(captured.marked).toEqual(['O1']);
  });
});
