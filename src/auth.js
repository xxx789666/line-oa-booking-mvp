// src/auth.js
var AuthService = (function () {
  function verify(idToken) {
    if (!idToken) {
      const e = new Error('unauthenticated'); e.code = 'unauthenticated'; throw e;
    }
    const channelId = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ID');
    const res = UrlFetchApp.fetch(
      'https://api.line.me/oauth2/v2.1/verify',
      {
        method: 'post',
        contentType: 'application/x-www-form-urlencoded',
        payload: 'id_token=' + encodeURIComponent(idToken) + '&client_id=' + encodeURIComponent(channelId),
        muteHttpExceptions: true
      }
    );
    if (res.getResponseCode() !== 200) {
      const e = new Error('unauthenticated'); e.code = 'unauthenticated'; throw e;
    }
    const body = JSON.parse(res.getContentText());
    if (body.aud !== channelId) {
      const e = new Error('unauthenticated'); e.code = 'unauthenticated'; throw e;
    }
    return {
      userId: body.sub,
      displayName: body.name,
      pictureUrl: body.picture || ''
    };
  }
  return { verify };
})();

if (typeof module !== 'undefined') module.exports = AuthService;
