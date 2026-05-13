const Router = require('../src/main');

describe('doGet', () => {
  beforeEach(() => installGasMocks({}));

  it('returns LIFF HTML when no action param', () => {
    const out = Router._dispatchGet({ parameter: {} });
    expect(out.type).toBe('html');
  });

  it('returns services JSON for action=services', () => {
    // mock SettingsRepo via DI seam
    Router._setRepos({
      settings: { listServices: () => [{ service_id: 'S1', name: 'X' }] }
    });
    const out = Router._dispatchGet({ parameter: { action: 'services' } });
    expect(out.type).toBe('json');
    expect(out.body).toEqual({ services: [{ service_id: 'S1', name: 'X' }] });
    Router._setRepos(null);
  });
});

describe('doPost', () => {
  let captured;
  beforeEach(() => {
    installGasMocks({});
    captured = { pushed: [], created: null, eventCreated: null, cancelled: [] };
    Router._setRepos({
      auth: { verify: () => ({ userId: 'U_x', displayName: 'X' }) },
      settings: {
        getServiceById: (id) => ({ service_id: id, name: '剪髮', duration_min: 60, price: 800 }),
        getStaffById: (id) => ({ staff_id: id, name: 'Alice', line_user_id: 'U_alice' })
      },
      orders: {
        create: (input) => { captured.created = input; return 'ORD-NEW'; },
        findById: (id) => captured.cancelled.includes(id) ? null : {
          order_id: id, line_user_id: 'U_x', start_at: '2026-06-01T02:00:00Z',
          end_at: '2026-06-01T03:00:00Z', calendar_event_id: 'evt-1',
          status: 'confirmed', service_id: 'S1', staff_id: 'ST1', price: 800
        },
        cancel: (id) => captured.cancelled.push(id),
        setCalendarEventId: (id, ev) => { /* noop */ }
      },
      slot: { compute: () => ['09:00', '10:00'] },
      calendar: {
        createBookingEvent: () => { captured.eventCreated = true; return 'evt-1'; },
        deleteEvent: jest.fn()
      },
      line: {
        pushBookingConfirmed: (u, ctx) => captured.pushed.push(['cust', u, ctx]),
        pushOwnerNewOrder: (u, ctx) => captured.pushed.push(['owner', u, ctx]),
        pushOwnerCancelled: () => {}
      },
      payment: { charge: () => ({ success: true }), refund: () => ({ success: true }) }
    });
  });
  afterEach(() => Router._setRepos(null));

  it('creates a booking on POST action=booking', () => {
    const out = Router._dispatchPost({
      parameter: { action: 'booking' },
      postData: { contents: JSON.stringify({
        idToken: 'fake', service_id: 'S1', staff_id: 'ST1',
        start_at: '2026-06-01T02:00:00Z'
      })}
    });
    expect(out.body.order_id).toBe('ORD-NEW');
    expect(captured.eventCreated).toBe(true);
    expect(captured.pushed.length).toBe(2); // customer + owner
  });

  it('cancels an order on POST action=cancel', () => {
    const out = Router._dispatchPost({
      parameter: { action: 'cancel' },
      postData: { contents: JSON.stringify({
        idToken: 'fake', order_id: 'ORD-1'
      })}
    });
    expect(out.body.success).toBe(true);
    expect(captured.cancelled).toContain('ORD-1');
  });
});
