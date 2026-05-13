const Payment = require('../src/service/payment');
beforeEach(() => installGasMocks({}));

describe('PaymentAdapter (stub)', () => {
  it('always succeeds for v1 stub', () => {
    const r = Payment.charge({ orderId: 'X', amount: 100 });
    expect(r.success).toBe(true);
    expect(r.method).toBe('stub');
  });
  it('refund always succeeds', () => {
    expect(Payment.refund({ orderId: 'X', amount: 100 }).success).toBe(true);
  });
});
