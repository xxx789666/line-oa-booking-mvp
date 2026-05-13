const Auth = require('../src/auth');

describe('AuthService', () => {
  beforeEach(() => {
    installGasMocks({}, {
      properties: { LINE_CHANNEL_ID: 'CHAN-123' },
      urlFetchFn: (url, opts) => {
        if (url.includes('/oauth2/v2.1/verify')) {
          return {
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({
              sub: 'U_alice',
              name: 'Alice',
              picture: 'https://x/a.jpg',
              aud: 'CHAN-123',
              exp: Math.floor(Date.now() / 1000) + 600
            })
          };
        }
        return { getResponseCode: () => 400, getContentText: () => '{}' };
      }
    });
  });

  it('verifies a valid idToken and returns user profile', () => {
    const result = Auth.verify('fake-token');
    expect(result.userId).toBe('U_alice');
    expect(result.displayName).toBe('Alice');
  });

  it('rejects an invalid idToken', () => {
    global.UrlFetchApp.fetch = jest.fn(() => ({
      getResponseCode: () => 400,
      getContentText: () => '{"error":"invalid_token"}'
    }));
    expect(() => Auth.verify('bad-token')).toThrow(/unauthenticated/);
  });

  it('rejects when audience does not match LINE_CHANNEL_ID', () => {
    global.UrlFetchApp.fetch = jest.fn(() => ({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        sub: 'U_x', name: 'X', picture: '',
        aud: 'WRONG-CHANNEL',
        exp: Math.floor(Date.now() / 1000) + 600
      })
    }));
    expect(() => Auth.verify('mismatched')).toThrow(/unauthenticated/);
  });
});
