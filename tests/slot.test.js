beforeEach(() => installGasMocks({}));
const Slot = require('../src/service/slot');

describe('SlotCalculator', () => {
  const schedule = [
    { staff_id: 'S1', day_of_week: 3, start_time: '09:00', end_time: '12:00' }
  ];

  it('returns empty array when staff has no schedule that day', () => {
    const result = Slot.compute({
      date: '2026-05-12', // Tuesday (dow=2)
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [],
      orders: []
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when date is a shop-wide holiday', () => {
    const result = Slot.compute({
      date: '2026-05-13',
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [{ date: '2026-05-13', staff_id: '' }],
      orders: []
    });
    expect(result).toEqual([]);
  });

  it('returns 15-min slots that fit duration within working hours', () => {
    const result = Slot.compute({
      date: '2026-05-13', // Wednesday (dow=3)
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [],
      orders: []
    });
    // Working 09:00-12:00, 60min service → starts 09:00..11:00 step 15
    expect(result).toEqual([
      '09:00', '09:15', '09:30', '09:45',
      '10:00', '10:15', '10:30', '10:45',
      '11:00'
    ]);
  });

  it('excludes slots that overlap with existing orders', () => {
    const result = Slot.compute({
      date: '2026-05-13',
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [],
      orders: [
        {
          staff_id: 'S1',
          start_at: '2026-05-13T02:00:00.000Z', // 10:00 Taipei
          end_at:   '2026-05-13T03:00:00.000Z'  // 11:00 Taipei
        }
      ]
    });
    expect(result).not.toContain('09:30'); // would end 10:30, overlaps
    expect(result).not.toContain('10:00');
    expect(result).not.toContain('10:45');
    expect(result).toContain('09:00');
    expect(result).toContain('11:00');
  });

  it('ignores staff-specific holidays for other staff', () => {
    const result = Slot.compute({
      date: '2026-05-13',
      staffId: 'S1',
      durationMin: 60,
      schedule,
      holidays: [{ date: '2026-05-13', staff_id: 'S2' }],
      orders: []
    });
    expect(result.length).toBeGreaterThan(0);
  });
});
