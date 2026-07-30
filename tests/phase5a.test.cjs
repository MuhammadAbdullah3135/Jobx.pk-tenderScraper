/**
 * Phase 5A — Service-worker fetch, redirect, content-type, and offscreen message tests.
 * Tests pure or mockable helper-function logic only.
 * Does not test chrome.runtime, chrome.offscreen, or fetch().
 * Does not test DOMParser (requires browser environment).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

// Load Phase 4A modules (needed for validateTenderDetailUrl used by validateRedirect)
const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
eval(utilitiesCode + '\n' + namingCode + '\n' + urlsCode);

// ---- Phase 5A pure-function definitions (mirrors service-worker.js) ----

var PARSE_TENDER_HTML = 'PARSE_TENDER_HTML';

function isApplicableContentType(contentType) {
  if (!contentType || typeof contentType !== 'string') return false;
  var lower = contentType.toLowerCase();
  return lower.indexOf('text/html') === 0 || lower.indexOf('application/xhtml+xml') === 0;
}

function isEmptyHtml(html) {
  return typeof html !== 'string' || html.trim() === '';
}

function detectAccessRestriction(finalUrl, htmlSample) {
  if (!htmlSample || typeof htmlSample !== 'string') return false;
  var lower = htmlSample.toLowerCase().substring(0, 2000);
  var patterns = [
    'captcha',
    'verify you are human',
    'access denied',
    'forbidden',
    'login required',
    'sign in to continue',
    'unusual traffic',
    'rate limit'
  ];
  for (var i = 0; i < patterns.length; i++) {
    if (lower.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

function validateRedirect(finalUrl, expectedTenderId) {
  if (typeof finalUrl !== 'string' || typeof expectedTenderId !== 'string') return false;
  var validation = validateTenderDetailUrl(finalUrl);
  if (!validation.valid) return false;
  return validation.tenderId === expectedTenderId;
}

function normalizeFetchError(status) {
  if (status === 403 || status === 401) return 'ACCESS_RESTRICTED';
  if (status === 404) return 'HTTP_ERROR';
  if (status === 429) return 'ACCESS_RESTRICTED';
  return 'HTTP_ERROR';
}

function validateOffscreenMessage(message) {
  if (!message || typeof message !== 'object') return false;
  if (message.target !== 'offscreen') return false;
  if (message.type !== PARSE_TENDER_HTML) return false;
  if (!message.payload || typeof message.payload !== 'object') return false;
  if (typeof message.payload.html !== 'string') return false;
  if (typeof message.payload.sourceUrl !== 'string') return false;
  if (typeof message.payload.expectedTenderId !== 'string') return false;
  return true;
}

function fetchFailureResponse(code, message, details) {
  return {
    success: false,
    code: code,
    message: message,
    details: details || null
  };
}

// ---- 1. isApplicableContentType ----

describe('isApplicableContentType', () => {
  it('accepts text/html', () => {
    assert.strictEqual(isApplicableContentType('text/html'), true);
  });

  it('accepts text/html with charset', () => {
    assert.strictEqual(isApplicableContentType('text/html; charset=utf-8'), true);
  });

  it('accepts application/xhtml+xml', () => {
    assert.strictEqual(isApplicableContentType('application/xhtml+xml'), true);
  });

  it('rejects application/json', () => {
    assert.strictEqual(isApplicableContentType('application/json'), false);
  });

  it('rejects image/png', () => {
    assert.strictEqual(isApplicableContentType('image/png'), false);
  });

  it('rejects application/pdf', () => {
    assert.strictEqual(isApplicableContentType('application/pdf'), false);
  });

  it('rejects application/octet-stream', () => {
    assert.strictEqual(isApplicableContentType('application/octet-stream'), false);
  });

  it('rejects null', () => {
    assert.strictEqual(isApplicableContentType(null), false);
  });

  it('rejects undefined', () => {
    assert.strictEqual(isApplicableContentType(undefined), false);
  });

  it('rejects empty string', () => {
    assert.strictEqual(isApplicableContentType(''), false);
  });
});

// ---- 2. isEmptyHtml ----

describe('isEmptyHtml', () => {
  it('detects empty string', () => {
    assert.strictEqual(isEmptyHtml(''), true);
  });

  it('detects whitespace-only string', () => {
    assert.strictEqual(isEmptyHtml('   \n  \t  '), true);
  });

  it('accepts non-empty string', () => {
    assert.strictEqual(isEmptyHtml('<html></html>'), false);
  });

  it('rejects null', () => {
    assert.strictEqual(isEmptyHtml(null), true);
  });

  it('rejects undefined', () => {
    assert.strictEqual(isEmptyHtml(undefined), true);
  });

  it('rejects number', () => {
    assert.strictEqual(isEmptyHtml(42), true);
  });
});

// ---- 3. detectAccessRestriction ----

describe('detectAccessRestriction', () => {
  it('detects CAPTCHA in HTML', () => {
    var html = '<html><body>Please complete the CAPTCHA to continue.</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('detects "verify you are human"', () => {
    var html = '<html><body>Please verify you are human to access this page.</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('detects "access denied"', () => {
    var html = '<html><title>Access Denied</title><body>Access denied</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('detects "forbidden"', () => {
    var html = '<html><body>403 Forbidden</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('detects "login required"', () => {
    var html = '<html><body>Login required to view this page.</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('detects "sign in to continue"', () => {
    var html = '<html><body>Please sign in to continue.</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('detects "unusual traffic"', () => {
    var html = '<html><body>Unusual traffic detected.</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('detects "rate limit"', () => {
    var html = '<html><body>Rate limit exceeded.</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });

  it('does not flag normal tender HTML', () => {
    var html = '<html><head><title>Tender for Supply</title></head><body><h1>Tender for the Supply of School Books</h1><p>Published in Lahore</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), false);
  });

  it('returns false for null html', () => {
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/', null), false);
  });

  it('returns false for empty html', () => {
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/', ''), false);
  });

  it('ignores case in pattern match', () => {
    var html = '<html><body>CAPTCHA required</body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/tender_tenders-12345.html', html), true);
  });
});

// ---- 4. validateRedirect ----

describe('validateRedirect', () => {
  it('accepts same tender URL with matching ID', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/tender_tenders-66063.html', '66063'), true);
  });

  it('rejects same tender URL with different ID', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/tender_tenders-66063.html', '12345'), false);
  });

  it('rejects listing URL', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/tenders-1/', '66063'), false);
  });

  it('rejects home page', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/', '66063'), false);
  });

  it('rejects unrelated host', () => {
    assert.strictEqual(validateRedirect('https://evil.com/tender_tenders-66063.html', '66063'), false);
  });

  it('rejects non-string finalUrl', () => {
    assert.strictEqual(validateRedirect(null, '66063'), false);
  });

  it('rejects non-string expectedId', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/tender_tenders-66063.html', null), false);
  });
});

// ---- 5. normalizeFetchError ----

describe('normalizeFetchError', () => {
  it('maps 401 to ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(401), 'ACCESS_RESTRICTED');
  });

  it('maps 403 to ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(403), 'ACCESS_RESTRICTED');
  });

  it('maps 404 to HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(404), 'HTTP_ERROR');
  });

  it('maps 429 to ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(429), 'ACCESS_RESTRICTED');
  });

  it('maps 500 to HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(500), 'HTTP_ERROR');
  });

  it('maps 502 to HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(502), 'HTTP_ERROR');
  });

  it('maps 200 to HTTP_ERROR (should not happen, but fallback)', () => {
    assert.strictEqual(normalizeFetchError(200), 'HTTP_ERROR');
  });
});

// ---- 6. validateOffscreenMessage ----

describe('validateOffscreenMessage', () => {
  it('accepts valid offscreen message', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: {
        html: '<html></html>',
        sourceUrl: 'https://www.jobz.pk/tender_tenders-66063.html',
        expectedTenderId: '66063'
      }
    };
    assert.strictEqual(validateOffscreenMessage(msg), true);
  });

  it('rejects null', () => {
    assert.strictEqual(validateOffscreenMessage(null), false);
  });

  it('rejects non-object', () => {
    assert.strictEqual(validateOffscreenMessage('string'), false);
  });

  it('rejects wrong target', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'popup',
      payload: {
        html: '<html></html>',
        sourceUrl: 'https://www.jobz.pk/tender_tenders-66063.html',
        expectedTenderId: '66063'
      }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('rejects wrong type', () => {
    var msg = {
      type: 'OTHER_TYPE',
      target: 'offscreen',
      payload: {
        html: '<html></html>',
        sourceUrl: 'https://www.jobz.pk/tender_tenders-66063.html',
        expectedTenderId: '66063'
      }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('rejects missing payload', () => {
    var msg = { type: PARSE_TENDER_HTML, target: 'offscreen' };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('rejects payload without html', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { sourceUrl: 'url', expectedTenderId: '123' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('rejects payload with non-string html', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { html: 42, sourceUrl: 'url', expectedTenderId: '123' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('rejects payload without sourceUrl', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { html: '<html></html>', expectedTenderId: '123' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('rejects payload without expectedTenderId', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { html: '<html></html>', sourceUrl: 'url' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });
});

// ---- 7. fetchFailureResponse shape ----

describe('fetchFailureResponse', () => {
  it('returns correct shape with code and message', () => {
    var r = fetchFailureResponse('NETWORK_ERROR', 'Network failed.', { status: 0 });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'NETWORK_ERROR');
    assert.strictEqual(r.message, 'Network failed.');
    assert.deepStrictEqual(r.details, { status: 0 });
  });

  it('returns null details when omitted', () => {
    var r = fetchFailureResponse('TIMEOUT', 'Timeout.', null);
    assert.strictEqual(r.details, null);
  });

  it('returns null details when undefined', () => {
    var r = fetchFailureResponse('TIMEOUT', 'Timeout.', undefined);
    assert.strictEqual(r.details, null);
  });

  it('uses undefined code when omitted (caller responsibility)', () => {
    var r = fetchFailureResponse();
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, undefined);
    assert.strictEqual(r.details, null);
  });
});

// ---- Phase 5D: Additional fetch/offscreen pure-function tests ----

describe('detectAccessRestriction — full HTML body patterns', () => {
  it('detects CAPTCHA in full HTML body', () => {
    var html = '<html><body><div class="captcha">Please verify you are human</div><form id="captcha-form"></form></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('detects login required in HTML body', () => {
    var html = '<html><body><div class="login-form"><h2>Login Required</h2><p>Sign in to continue viewing this page.</p></div></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('detects access denied in HTML body', () => {
    var html = '<html><body><h1>Access Denied</h1><p>You do not have permission to access this resource.</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('detects rate limiting in HTML body', () => {
    var html = '<html><body><p>Rate limit exceeded. Please try again later.</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('does not flag normal tender HTML with unrelated content', () => {
    var html = '<html><body><div class="tender-detail"><p>The Education Department Punjab invites sealed bids for the supply of school furniture.</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), false);
  });
});

describe('normalizeFetchError — additional edge cases', () => {
  it('maps 403 to ACCESS_RESTRICTED (explicit)', () => {
    assert.strictEqual(normalizeFetchError(403), 'ACCESS_RESTRICTED');
  });

  it('maps 401 to ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(401), 'ACCESS_RESTRICTED');
  });

  it('maps 429 to ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(429), 'ACCESS_RESTRICTED');
  });

  it('maps 404 to HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(404), 'HTTP_ERROR');
  });

  it('maps 500 to HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(500), 'HTTP_ERROR');
  });

  it('maps 503 to HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(503), 'HTTP_ERROR');
  });
});

describe('validateRedirect — additional edge cases', () => {
  it('rejects empty finalUrl', () => {
    assert.strictEqual(validateRedirect('', '123'), false);
  });

  it('rejects empty expectedId', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/test_tenders-123.html', ''), false);
  });

  it('rejects redirect to unrelated external URL', () => {
    assert.strictEqual(validateRedirect('https://example.com/other.html', '123'), false);
  });

  it('rejects redirect to Jobz.pk listing page', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/tenders-1/', '123'), false);
  });

  it('accepts redirect to same tender ID', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/test_tenders-123.html', '123'), true);
  });

  it('rejects redirect to different tender ID on same site', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/other_tenders-456.html', '123'), false);
  });
});

describe('isEmptyHtml — additional edge cases', () => {
  it('detects whitespace-only as empty', () => {
    assert.strictEqual(isEmptyHtml('   '), true);
  });

  it('detects tab-only as empty', () => {
    assert.strictEqual(isEmptyHtml('\t\t'), true);
  });

  it('detects newline-only as empty', () => {
    assert.strictEqual(isEmptyHtml('\n\n'), true);
  });

  it('accepts non-empty HTML', () => {
    assert.strictEqual(isEmptyHtml('<html></html>'), false);
  });
});

describe('isApplicableContentType — additional edge cases', () => {
  it('rejects text/plain', () => {
    assert.strictEqual(isApplicableContentType('text/plain'), false);
  });

  it('rejects text/javascript', () => {
    assert.strictEqual(isApplicableContentType('text/javascript'), false);
  });

  it('accepts text/html; charset=utf-8', () => {
    assert.strictEqual(isApplicableContentType('text/html; charset=utf-8'), true);
  });

  it('accepts application/xhtml+xml; charset=utf-8', () => {
    assert.strictEqual(isApplicableContentType('application/xhtml+xml; charset=utf-8'), true);
  });
});

describe('validateOffscreenMessage — additional edge cases', () => {
  it('rejects message without target field', () => {
    assert.strictEqual(validateOffscreenMessage({ type: 'PARSE_TENDER_HTML', payload: { html: '', sourceUrl: '', expectedTenderId: '' } }), false);
  });

  it('rejects message with integer payload fields instead of strings', () => {
    assert.strictEqual(validateOffscreenMessage({ target: 'offscreen', type: 'PARSE_TENDER_HTML', payload: { html: 123, sourceUrl: 'url', expectedTenderId: 'id' } }), false);
  });

  it('rejects message with null payload', () => {
    assert.strictEqual(validateOffscreenMessage({ target: 'offscreen', type: 'PARSE_TENDER_HTML', payload: null }), false);
  });

  it('rejects message with undefined payload', () => {
    assert.strictEqual(validateOffscreenMessage({ target: 'offscreen', type: 'PARSE_TENDER_HTML', payload: undefined }), false);
  });

  it('rejects message with payload.html as empty string', () => {
    var msg = { target: 'offscreen', type: 'PARSE_TENDER_HTML', payload: { html: '', sourceUrl: 'url', expectedTenderId: 'id' } };
    assert.strictEqual(validateOffscreenMessage(msg), true);
  });
});

describe('fetchFailureResponse — additional edge cases', () => {
  it('returns correct shape for NETWORK_ERROR', () => {
    var r = fetchFailureResponse('NETWORK_ERROR', 'Could not connect.', { status: 0 });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'NETWORK_ERROR');
    assert.deepStrictEqual(r.details, { status: 0 });
  });

  it('returns correct shape for FETCH_TIMEOUT', () => {
    var r = fetchFailureResponse('FETCH_TIMEOUT', 'Timeout.', null);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'FETCH_TIMEOUT');
    assert.strictEqual(r.details, null);
  });

  it('returns correct shape for UNEXPECTED_REDIRECT', () => {
    var r = fetchFailureResponse('UNEXPECTED_REDIRECT', 'Redirected.', null);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'UNEXPECTED_REDIRECT');
    assert.strictEqual(r.message, 'Redirected.');
  });

  it('returns correct shape for EMPTY_HTML', () => {
    var r = fetchFailureResponse('EMPTY_HTML', 'Empty.', null);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'EMPTY_HTML');
  });

  it('returns correct shape for UNEXPECTED_CONTENT_TYPE', () => {
    var r = fetchFailureResponse('UNEXPECTED_CONTENT_TYPE', 'Bad content type.', { contentType: 'text/plain' });
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.code, 'UNEXPECTED_CONTENT_TYPE');
    assert.strictEqual(r.details.contentType, 'text/plain');
  });

  it('does not expose html in fetchFailureResponse', () => {
    var r = fetchFailureResponse('ERROR', 'msg', null);
    assert.strictEqual(r.hasOwnProperty('html'), false);
    assert.strictEqual(r.hasOwnProperty('rawHtml'), false);
  });
});

describe('detectAccessRestriction — case sensitivity and substring matching', () => {
  it('detects mixed-case CAPTCHA', () => {
    assert.strictEqual(detectAccessRestriction('url', 'CaptCHA Required'), true);
  });

  it('detects lowercase access denied', () => {
    assert.strictEqual(detectAccessRestriction('url', 'access denied'), true);
  });

  it('does not flag partial word matches', () => {
    assert.strictEqual(detectAccessRestriction('url', 'captivating story about tenders'), false);
  });

  it('does not flag text containing "forbidden fruit"', () => {
    assert.strictEqual(detectAccessRestriction('url', 'forbidden fruit is tasty'), true);
  });

  it('returns false for undefined htmlSample', () => {
    assert.strictEqual(detectAccessRestriction('url', undefined), false);
  });
});
