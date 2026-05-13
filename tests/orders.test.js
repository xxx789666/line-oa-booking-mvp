const Orders = require('../src/repo/orders');

const ORDERS_HEADER = [
  'order_id', 'created_at', 'line_user_id', 'customer_name',
  'service_id', 'staff_id', 'start_at', 'end_at', 'price',
  'payment_method', 'payment_status', 'status', 'reminded_at',
  'calendar_event_id', 'note'
];

describe('OrdersRepo (read)', () => {
  beforeEach(() => {
    installGasMocks({
      Orders: [
        ORDERS_HEADER,
        ['ORD-1', '2026-05-12T00:00:00Z', 'U_alice', 'Alice', 'S001', 'ST001',
         '2026-05-13T02:00:00Z', '2026-05-13T03:00:00Z', 800,
         'stub', 'paid', 'confirmed', '', 'evt-1', ''],
        ['ORD-2', '2026-05-12T00:00:00Z', 'U_bob', 'Bob', 'S002', 'ST001',
         '2026-05-13T05:00:00Z', '2026-05-13T07:00:00Z', 2500,
         'stub', 'paid', 'cancelled', '', 'evt-2', '']
      ]
    }, { properties: { SPREADSHEET_ID: 'fake-id' } });
  });

  it('lists confirmed orders for a given staff and date range', () => {
    const result = Orders.listForStaffOnDate('ST001', '2026-05-13');
    expect(result).toHaveLength(1);
    expect(result[0].order_id).toBe('ORD-1');
  });

  it('lists my (line_user_id) active orders', () => {
    const result = Orders.listByUser('U_alice');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('confirmed');
  });

  it('finds an order by id', () => {
    expect(Orders.findById('ORD-1').customer_name).toBe('Alice');
    expect(Orders.findById('NOPE')).toBeNull();
  });
});
