beforeEach(() => installGasMocks({}));
const Time = require('../src/utils/time');

describe('Time', () => {
  it('formats a date as YYYY-MM-DD in Asia/Taipei', () => {
    const result = Time.toDateString(new Date('2026-05-13T15:00:00Z'));
    expect(result).toBe('2026-05-13');
  });

  it('combines date + HH:mm into ISO datetime in Taipei', () => {
    const result = Time.combine('2026-05-13', '09:30');
    expect(result.toISOString()).toBe('2026-05-13T01:30:00.000Z');
  });

  it('adds minutes to a date', () => {
    const start = new Date('2026-05-13T01:30:00Z');
    const after = Time.addMinutes(start, 60);
    expect(after.toISOString()).toBe('2026-05-13T02:30:00.000Z');
  });
});
