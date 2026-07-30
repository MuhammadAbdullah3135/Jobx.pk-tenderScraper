chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!message || message.type !== 'FETCH_TENDER_HTML') return false;

  var url = message.url;
  if (typeof url !== 'string' || url.trim() === '') {
    sendResponse({ success: false, code: 'INVALID_URL', message: 'No URL provided.' });
    return true;
  }

  fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'Accept': 'text/html,application/xhtml+xml' }
  })
    .then(function(response) {
      if (!response.ok) {
        sendResponse({
          success: false,
          code: 'HTTP_ERROR',
          message: 'The server returned an error response.',
          details: { status: response.status }
        });
        return null;
      }
      return response.text().then(function(html) {
        sendResponse({
          success: true,
          html: html,
          contentType: response.headers.get('content-type') || '',
          finalUrl: response.url
        });
      });
    })
    .catch(function(error) {
      sendResponse({
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Could not connect to the server.',
        details: null
      });
    });

  return true;
});
