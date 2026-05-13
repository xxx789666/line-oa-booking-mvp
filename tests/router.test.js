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
