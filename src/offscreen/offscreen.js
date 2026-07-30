const PARSE_TENDER_HTML = 'PARSE_TENDER_HTML';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return;
  if (message.type !== PARSE_TENDER_HTML) return;

  if (!message.payload || typeof message.payload.html !== 'string' || typeof message.payload.sourceUrl !== 'string' || typeof message.payload.expectedTenderId !== 'string') {
    sendResponse({
      success: false,
      code: 'INVALID_MESSAGE',
      message: 'The parse request was malformed.',
      details: null
    });
    return true;
  }

  if (message.payload.html === '') {
    sendResponse({
      success: false,
      code: 'HTML_PARSE_FAILED',
      message: 'Failed to parse the tender HTML.',
      details: null
    });
    return true;
  }

  try {
    var parserResult = parseTenderDetail(
      message.payload.html,
      message.payload.sourceUrl,
      message.payload.expectedTenderId,
      message.payload.originalListingTitle || ''
    );

    sendResponse(parserResult);
  } catch (e) {
    sendResponse({
      success: false,
      code: 'HTML_PARSE_FAILED',
      message: 'Failed to parse the tender HTML.',
      details: null
    });
  }

  return true;
});
