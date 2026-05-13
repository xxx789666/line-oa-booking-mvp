describe('Jest harness', () => {
  beforeEach(() => { installGasMocks({}); });
  it('installs SpreadsheetApp', () => {
    expect(global.SpreadsheetApp).toBeDefined();
    expect(typeof SpreadsheetApp.openById).toBe('function');
  });
});
