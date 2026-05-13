// tests/__mocks__/gas.js
function createSheetMock(rows) {
  const data = rows.map(r => [...r]);
  return {
    getDataRange: () => ({ getValues: () => data.map(r => [...r]) }),
    getLastRow: () => data.length,
    getLastColumn: () => (data[0] || []).length,
    appendRow: (row) => { data.push([...row]); },
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < numRows; i++) {
          const r = [];
          for (let j = 0; j < numCols; j++) {
            r.push(data[row - 1 + i] ? data[row - 1 + i][col - 1 + j] : '');
          }
          out.push(r);
        }
        return out;
      },
      setValues: (values) => {
        values.forEach((rowVals, i) => {
          if (!data[row - 1 + i]) data[row - 1 + i] = [];
          rowVals.forEach((v, j) => { data[row - 1 + i][col - 1 + j] = v; });
        });
      },
      setValue: (v) => { data[row - 1][col - 1] = v; }
    }),
    _data: () => data
  };
}

function createSpreadsheetMock(sheets) {
  const sheetMocks = {};
  Object.entries(sheets).forEach(([name, rows]) => {
    sheetMocks[name] = createSheetMock(rows);
  });
  return {
    getSheetByName: (name) => sheetMocks[name] || null,
    _sheets: sheetMocks
  };
}

module.exports = {
  installGlobals(spreadsheets = {}, extra = {}) {
    const spreadsheetMock = createSpreadsheetMock(spreadsheets);
    global.SpreadsheetApp = {
      openById: () => spreadsheetMock,
      getActiveSpreadsheet: () => spreadsheetMock
    };
    global.UrlFetchApp = {
      fetch: jest.fn(extra.urlFetchFn || (() => ({
        getResponseCode: () => 200,
        getContentText: () => '{}'
      })))
    };
    global.LockService = {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {}
      })
    };
    global.CalendarApp = {
      getCalendarById: () => ({
        createEvent: jest.fn(() => ({ getId: () => 'evt-' + Math.random() })),
        getEventById: jest.fn(() => ({ deleteEvent: jest.fn() }))
      })
    };
    global.PropertiesService = {
      getScriptProperties: () => {
        const store = extra.properties || {};
        return {
          getProperty: (k) => store[k] || null,
          setProperty: (k, v) => { store[k] = v; },
          getProperties: () => ({ ...store })
        };
      }
    };
    global.Utilities = {
      getUuid: () => 'uuid-' + Math.random().toString(36).slice(2, 10),
      formatDate: (d, tz, fmt) => new Date(d).toISOString()
    };
    global.Logger = { log: () => {} };
    return { spreadsheetMock };
  }
};
