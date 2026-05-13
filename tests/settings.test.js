const Settings = require('../src/repo/settings');

describe('SettingsRepo', () => {
  beforeEach(() => {
    installGasMocks({
      Services: [
        ['service_id', 'name', 'duration_min', 'price', 'description', 'is_active'],
        ['S001', '剪髮', 60, 800, '含洗髮', true],
        ['S002', '染髮', 120, 2500, '', true],
        ['S003', '頭皮舒緩', 30, 500, '', false]
      ],
      Staff: [
        ['staff_id', 'name', 'photo_url', 'line_user_id', 'is_active'],
        ['ST001', 'Alice', 'https://x/a.jpg', 'U_alice', true]
      ],
      Schedule: [
        ['staff_id', 'day_of_week', 'start_time', 'end_time'],
        ['ST001', 1, '09:00', '18:00']
      ],
      Holidays: [
        ['date', 'staff_id', 'reason'],
        ['2026-05-25', '', '國定假日']
      ],
      StaffServices: [
        ['staff_id', 'service_id'],
        ['ST001', 'S001'],
        ['ST001', 'S002']
      ]
    }, { properties: { SPREADSHEET_ID: 'fake-id' } });
  });

  it('lists only active services', () => {
    const result = Settings.listServices();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ service_id: 'S001', name: '剪髮', duration_min: 60 });
  });

  it('lists staff who can perform a given service', () => {
    const result = Settings.listStaffForService('S001');
    expect(result).toHaveLength(1);
    expect(result[0].staff_id).toBe('ST001');
  });

  it('returns the weekly schedule', () => {
    expect(Settings.getSchedule()).toEqual([
      { staff_id: 'ST001', day_of_week: 1, start_time: '09:00', end_time: '18:00' }
    ]);
  });

  it('returns holidays', () => {
    expect(Settings.getHolidays()).toEqual([
      { date: '2026-05-25', staff_id: '', reason: '國定假日' }
    ]);
  });
});
