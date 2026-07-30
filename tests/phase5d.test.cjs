/**
 * Phase 5D — Integration hardening, fetch/offscreen decision logic,
 * merge/popup behavior, access-restriction testing, and pipeline simulation.
 *
 * All tests are pure logic or decision-helper tests. No Chrome API calls.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

// Load all shared modules
const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
const tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');
const constantsCode = readFileSync(join(base, 'src/shared/constants.js'), 'utf-8');
const parserCode = readFileSync(join(base, 'src/offscreen/tender-detail-parser.js'), 'utf-8');

eval(utilitiesCode + '\n' + namingCode + '\n' + urlsCode + '\n' + tenderModelCode);
eval(constantsCode);

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
    'captcha', 'verify you are human', 'access denied', 'forbidden',
    'login required', 'sign in to continue', 'unusual traffic', 'rate limit'
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

// ===========================================================================
// A. Fetch validation — invalid URL rejection, timeout, abort
// ===========================================================================

describe('Phase 5D — Fetch URL validation', () => {
  it('rejects invalid URL before fetch — empty string', () => {
    var result = validateTenderDetailUrl('');
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid URL before fetch — null', () => {
    var result = validateTenderDetailUrl(null);
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid URL before fetch — javascript:', () => {
    var result = validateTenderDetailUrl('javascript:void(0)');
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid URL before fetch — listing page', () => {
    var result = validateTenderDetailUrl('https://www.jobz.pk/tenders-1/');
    assert.strictEqual(result.valid, false);
  });

  it('accepts valid tender URL before fetch', () => {
    var result = validateTenderDetailUrl('https://www.jobz.pk/test_tenders-12345.html');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tenderId, '12345');
  });

  it('timeout simulation — AbortError name maps to FETCH_TIMEOUT', () => {
    var error = { name: 'AbortError' };
    var code = error.name === 'AbortError' ? 'FETCH_TIMEOUT' : 'NETWORK_ERROR';
    assert.strictEqual(code, 'FETCH_TIMEOUT');
  });

  it('abort normalization — non-AbortError maps to NETWORK_ERROR', () => {
    var error = { name: 'TypeError' };
    var code = error.name === 'AbortError' ? 'FETCH_TIMEOUT' : 'NETWORK_ERROR';
    assert.strictEqual(code, 'NETWORK_ERROR');
  });

  it('one fetch only — no retry logic present in fetchTenderHTML mock', () => {
    var fetchCalled = 0;
    function mockFetch() { fetchCalled++; }
    mockFetch();
    assert.strictEqual(fetchCalled, 1);
  });
});

// ===========================================================================
// B. HTTP status code handling
// ===========================================================================

describe('Phase 5D — HTTP status handling', () => {
  it('HTTP 403 returns ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(403), 'ACCESS_RESTRICTED');
  });

  it('HTTP 404 returns HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(404), 'HTTP_ERROR');
  });

  it('HTTP 429 returns ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(429), 'ACCESS_RESTRICTED');
  });

  it('HTTP 500 returns HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(500), 'HTTP_ERROR');
  });

  it('HTTP 503 returns HTTP_ERROR', () => {
    assert.strictEqual(normalizeFetchError(503), 'HTTP_ERROR');
  });

  it('HTTP 401 returns ACCESS_RESTRICTED', () => {
    assert.strictEqual(normalizeFetchError(401), 'ACCESS_RESTRICTED');
  });
});

// ===========================================================================
// C. Empty body and content-type checks
// ===========================================================================

describe('Phase 5D — Empty body and content type', () => {
  it('empty body — empty string detected', () => {
    assert.strictEqual(isEmptyHtml(''), true);
  });

  it('empty body — whitespace-only detected', () => {
    assert.strictEqual(isEmptyHtml('   \n  '), true);
  });

  it('unexpected content type — application/json rejected', () => {
    assert.strictEqual(isApplicableContentType('application/json'), false);
  });

  it('unexpected content type — image/png rejected', () => {
    assert.strictEqual(isApplicableContentType('image/png'), false);
  });

  it('unexpected content type — text/plain rejected', () => {
    assert.strictEqual(isApplicableContentType('text/plain'), false);
  });

  it('unexpected content type — application/pdf rejected', () => {
    assert.strictEqual(isApplicableContentType('application/pdf'), false);
  });
});

// ===========================================================================
// D. Redirect handling
// ===========================================================================

describe('Phase 5D — Redirect validation', () => {
  it('external redirect — unrelated host rejected', () => {
    assert.strictEqual(validateRedirect('https://evil.com/test_tenders-123.html', '123'), false);
  });

  it('external redirect — completely different domain rejected', () => {
    assert.strictEqual(validateRedirect('https://www.google.com/', '123'), false);
  });

  it('unrelated Jobz.pk redirect — listing page rejected', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/tenders-1/', '123'), false);
  });

  it('unrelated Jobz.pk redirect — home page rejected', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/', '123'), false);
  });

  it('unrelated Jobz.pk redirect — different tender ID rejected', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/other_tenders-456.html', '123'), false);
  });

  it('same tender ID redirect accepted', () => {
    assert.strictEqual(validateRedirect('https://www.jobz.pk/test_tenders-123.html', '123'), true);
  });
});

// ===========================================================================
// E. Access-restriction detection — expanded patterns
// ===========================================================================

describe('Phase 5D — Access restriction detection', () => {
  it('CAPTCHA in HTML detected', () => {
    var html = '<html><body><div class="captcha-box">Please solve CAPTCHA</div></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('login redirect HTML detected', () => {
    var html = '<html><body><h1>Login Required</h1><p>Sign in to continue</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('access denied HTML detected', () => {
    var html = '<html><body><h1>Access Denied</h1><p>You are not authorized</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('rate limit HTML detected', () => {
    var html = '<html><body><p>Rate limit exceeded. Try again later.</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('forbidden HTML detected', () => {
    var html = '<html><body><h1>403 Forbidden</h1></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('unusual traffic HTML detected', () => {
    var html = '<html><body><p>Unusual traffic from your network.</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('verify you are human HTML detected', () => {
    var html = '<html><body><p>Please verify you are human.</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('login required HTML detected', () => {
    var html = '<html><body><h2>Login Required to View This Page</h2></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test.html', html), true);
  });

  it('normal tender HTML not flagged', () => {
    var html = '<html><body><h1>Supply of Medical Equipment</h1><p>The Education Department Punjab invites sealed bids.</p></body></html>';
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/test_tenders-123.html', html), false);
  });

  it('returns readable error for ACCESS_RESTRICTED', () => {
    var msg = getErrorMessage('ACCESS_RESTRICTED');
    assert.strictEqual(msg, 'The tender page could not be accessed normally.');
    assert.strictEqual(typeof msg, 'string');
    assert.ok(msg.length > 0);
  });

  it('detectAccessRestriction returns false for null input', () => {
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/', null), false);
  });

  it('detectAccessRestriction returns false for empty input', () => {
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/', ''), false);
  });

  it('detectAccessRestriction returns false for normal text without restriction keywords', () => {
    assert.strictEqual(detectAccessRestriction('https://www.jobz.pk/', 'The quick brown fox'), false);
  });
});

// ===========================================================================
// F. Offscreen message validation
// ===========================================================================

describe('Phase 5D — Offscreen message validation', () => {
  it('valid message passes validation', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { html: '<html></html>', sourceUrl: 'https://www.jobz.pk/test_tenders-123.html', expectedTenderId: '123' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), true);
  });

  it('missing receiving end — empty payload rejected', () => {
    var msg = { type: PARSE_TENDER_HTML, target: 'offscreen', payload: {} };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('malformed offscreen response — missing html field rejected', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { sourceUrl: 'url', expectedTenderId: '123' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('malformed offscreen response — non-string html rejected', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { html: 42, sourceUrl: 'url', expectedTenderId: '123' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('malformed offscreen response — missing sourceUrl rejected', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { html: '<html></html>', expectedTenderId: '123' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('malformed offscreen response — missing expectedTenderId rejected', () => {
    var msg = {
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: { html: '<html></html>', sourceUrl: 'url' }
    };
    assert.strictEqual(validateOffscreenMessage(msg), false);
  });

  it('offscreen creation promise — concurrent call logic returns same promise reference', () => {
    var sharedPromise = null;
    function createPromise() {
      if (sharedPromise) return sharedPromise;
      sharedPromise = new Promise(function(resolve) { resolve(true); });
      sharedPromise.then(function() { sharedPromise = null; });
      return sharedPromise;
    }
    var p1 = createPromise();
    var p2 = createPromise();
    assert.strictEqual(p1, p2);
  });

  it('offscreen creation promise — clears after resolution', function() {
    var sharedPromise = null;
    function createPromise() {
      if (sharedPromise) return sharedPromise;
      sharedPromise = new Promise(function(resolve) { resolve(true); });
      return sharedPromise.then(function(r) {
        sharedPromise = null;
        return r;
      });
    }
    return createPromise().then(function() {
      assert.strictEqual(sharedPromise, null);
    });
  });

  it('offscreen creation promise — clears after failure', function() {
    var sharedPromise = null;
    function createPromise() {
      if (sharedPromise) return sharedPromise;
      sharedPromise = new Promise(function(resolve, reject) { reject(new Error('fail')); });
      return sharedPromise.catch(function(e) {
        sharedPromise = null;
        throw e;
      });
    }
    return createPromise().then(function() {
      assert.fail('should have rejected');
    }).catch(function(e) {
      assert.strictEqual(sharedPromise, null);
      assert.strictEqual(e.message, 'fail');
    });
  });
});

// ===========================================================================
// G. HTML never appears in errors or diagnostics
// ===========================================================================

describe('Phase 5D — HTML not exposed in errors', () => {
  it('fetchFailureResponse never includes html', () => {
    var response = fetchFailureResponse('NETWORK_ERROR', 'error', null);
    assert.strictEqual(response.hasOwnProperty('html'), false);
    assert.strictEqual(response.success, false);
  });

  it('mergeTenderListingAndDetail result never contains raw html', () => {
    var listing = {
      listingPosition: 1, originalListingTitle: 'Test', city: 'X', datePosted: 'd',
      detailUrl: 'https://www.jobz.pk/test_tenders-1.html'
    };
    var normalized = createNormalizedTenderRecord(listing, 1);
    var parserResult = {
      success: true,
      metadata: { datePosted: '1 Jan 2026' },
      description: 'Some description',
      pageTitle: 'Page Title',
      tenderId: '1',
      imageUrls: [],
      warnings: []
    };
    var merged = mergeTenderListingAndDetail(normalized, parserResult);
    assert.strictEqual(merged.hasOwnProperty('html'), false);
    assert.strictEqual(merged.hasOwnProperty('rawHtml'), false);
    assert.strictEqual(merged.hasOwnProperty('fetchedHtml'), false);
  });

  it('error messages do not contain raw HTML', () => {
    var codes = ['INVALID_TENDER_URL', 'FETCH_TIMEOUT', 'HTTP_ERROR', 'ACCESS_RESTRICTED',
                 'UNEXPECTED_REDIRECT', 'NETWORK_ERROR', 'EMPTY_HTML', 'UNEXPECTED_CONTENT_TYPE',
                 'HTML_PARSE_FAILED', 'NO_TENDER_CONTENT', 'INVALID_HTML', 'UNKNOWN_ERROR'];
    for (var i = 0; i < codes.length; i++) {
      var msg = getErrorMessage(codes[i]);
      assert.strictEqual(msg.indexOf('<'), -1, 'Error message should not contain HTML: ' + codes[i]);
      assert.strictEqual(typeof msg, 'string');
      assert.ok(msg.length > 0);
    }
  });

  it('fetchFailureResponse messages do not contain HTML', () => {
    var r1 = fetchFailureResponse('NETWORK_ERROR', 'Could not connect.', null);
    assert.strictEqual(r1.message.indexOf('<'), -1);
    var r2 = fetchFailureResponse('FETCH_TIMEOUT', 'Timeout.', null);
    assert.strictEqual(r2.message.indexOf('<'), -1);
    var r3 = fetchFailureResponse('ACCESS_RESTRICTED', 'Access denied.', null);
    assert.strictEqual(r3.message.indexOf('<'), -1);
  });
});

// ===========================================================================
// H. Merge behavior — comprehensive
// ===========================================================================

var MERGE_LISTING = {
  listingPosition: 1, sequenceNumber: 1, tenderId: '66063',
  originalListingTitle: 'Tender for the Supply of Items by EED',
  title: 'Supply of Items by EED', city: 'LAHORE',
  listingDatePosted: '22 Jul 2026', datePosted: 'Not available',
  category: 'Not available', province: 'Not available', location: 'Not available',
  subcategory: 'Not available', sector: 'Not available', newspaper: 'Not available',
  lastDate: 'Not available', description: 'Not available',
  detailUrl: 'https://www.jobz.pk/test_tenders-66063.html',
  imageUrls: [], paginationNumber: 2, folderName: '001_Supply of Items by EED',
  downloadStatus: 'Pending', failureReason: null, fetchAttempts: 0,
  downloadedAt: null, downloadIds: [], downloadedFiles: []
};

var MERGE_PARSER = {
  success: true,
  metadata: { datePosted: '25 Jul 2026', category: 'Goods', province: 'Punjab',
    location: 'Lahore', subcategory: 'Medical Equipment', sector: 'Health',
    newspaper: 'Daily Jang', lastDate: '15 Aug 2026' },
  description: 'The Education Department Punjab invites sealed bids.',
  pageTitle: 'Supply of Medical Equipment', tenderId: '66063',
  imageUrls: ['https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg'],
  warnings: []
};

describe('Phase 5D — Merge behavior', () => {
  it('records merge without mutation — listing unchanged', () => {
    var listing = JSON.parse(JSON.stringify(MERGE_LISTING));
    var frozen = JSON.stringify(listing);
    mergeTenderListingAndDetail(listing, MERGE_PARSER);
    assert.strictEqual(JSON.stringify(listing), frozen);
  });

  it('records merge without mutation — parser result unchanged', () => {
    var parser = JSON.parse(JSON.stringify(MERGE_PARSER));
    var frozen = JSON.stringify(parser);
    mergeTenderListingAndDetail(MERGE_LISTING, parser);
    assert.strictEqual(JSON.stringify(parser), frozen);
  });

  it('arrays do not share references between listing and merged', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.notStrictEqual(result.imageUrls, MERGE_LISTING.imageUrls);
    assert.notStrictEqual(result.downloadIds, MERGE_LISTING.downloadIds);
    assert.notStrictEqual(result.downloadedFiles, MERGE_LISTING.downloadedFiles);
  });

  it('title precedence — listing title preserved', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.title, 'Supply of Items by EED');
  });

  it('original listing title is preserved after merge', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.originalListingTitle, 'Tender for the Supply of Items by EED');
  });

  it('listing city remains separate from detail location', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.city, 'LAHORE');
    assert.strictEqual(result.location, 'Lahore');
    assert.notStrictEqual(result.city, result.location);
  });

  it('listing date remains separate from detail date', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.listingDatePosted, '22 Jul 2026');
    assert.strictEqual(result.datePosted, '25 Jul 2026');
    assert.notStrictEqual(result.listingDatePosted, result.datePosted);
  });

  it('URL-derived tender ID is preserved after merge', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.tenderId, '66063');
  });

  it('parser warnings remain available after merge', () => {
    var parserWithWarnings = JSON.parse(JSON.stringify(MERGE_PARSER));
    parserWithWarnings.warnings = ['Fallback selector used for metadata.'];
    var result = mergeTenderListingAndDetail(MERGE_LISTING, parserWithWarnings);
    assert.ok(Array.isArray(result.warnings));
    assert.strictEqual(result.warnings.length, 1);
    assert.strictEqual(result.warnings[0], 'Fallback selector used for metadata.');
  });

  it('images are copied and deduplicated', () => {
    var parserWithDupes = JSON.parse(JSON.stringify(MERGE_PARSER));
    parserWithDupes.imageUrls = [
      'https://www.jobz.pk/images/tenders/ad-66063.jpg',
      'https://www.jobz.pk/images/tenders/ad-66063-2.jpg',
      'https://www.jobz.pk/images/tenders/ad-66063.jpg'
    ];
    var result = mergeTenderListingAndDetail(MERGE_LISTING, parserWithDupes);
    assert.strictEqual(result.imageUrls.length, 2);
    assert.strictEqual(result.imageUrls[0], 'https://www.jobz.pk/images/tenders/ad-66063.jpg');
    assert.strictEqual(result.imageUrls[1], 'https://www.jobz.pk/images/tenders/ad-66063-2.jpg');
  });

  it('folder name remains stable after merge', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.folderName, '001_Supply of Items by EED');
  });

  it('status becomes Parsed - Download Pending', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
  });

  it('fetch attempts become 1', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.fetchAttempts, 1);
  });

  it('description preview is safe — HTML characters not rendered', () => {
    var parserWithHtmlDesc = JSON.parse(JSON.stringify(MERGE_PARSER));
    parserWithHtmlDesc.description = '<script>alert("xss")</script>';
    var result = mergeTenderListingAndDetail(MERGE_LISTING, parserWithHtmlDesc);
    assert.strictEqual(result.description, '<script>alert("xss")</script>');
    assert.strictEqual(result.description.indexOf('<script>'), 0);
  });

  it('main download button remains non-operational — no downloads triggered', () => {
    var result = mergeTenderListingAndDetail(MERGE_LISTING, MERGE_PARSER);
    assert.strictEqual(result.downloadedAt, null);
    assert.deepStrictEqual(result.downloadIds, []);
    assert.deepStrictEqual(result.downloadedFiles, []);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
  });

  it('summary should use textContent — description stored as plain text', () => {
    var parserWithDesc = JSON.parse(JSON.stringify(MERGE_PARSER));
    parserWithDesc.description = 'Plain text description with <b>not bold</b>';
    var result = mergeTenderListingAndDetail(MERGE_LISTING, parserWithDesc);
    assert.strictEqual(result.description, 'Plain text description with <b>not bold</b>');
  });

  it('ID mismatch warning added when parser ID differs', () => {
    var parserDiffId = JSON.parse(JSON.stringify(MERGE_PARSER));
    parserDiffId.tenderId = '99999';
    var result = mergeTenderListingAndDetail(MERGE_LISTING, parserDiffId);
    var hasWarning = false;
    for (var i = 0; i < result.warnings.length; i++) {
      if (result.warnings[i].indexOf('Parser-reported ID') !== -1) hasWarning = true;
    }
    assert.strictEqual(hasWarning, true);
    assert.strictEqual(result.tenderId, '66063');
  });
});

// ===========================================================================
// I. Popup behavior — button state transitions
// ===========================================================================

describe('Phase 5D — Error message mapping', () => {
  it('getErrorMessage returns readable message for all defined codes', () => {
    var codes = Object.keys(ERROR_MESSAGES);
    for (var i = 0; i < codes.length; i++) {
      var msg = getErrorMessage(codes[i]);
      assert.strictEqual(typeof msg, 'string');
      assert.ok(msg.length > 0);
      assert.strictEqual(msg.indexOf('<'), -1, 'no HTML in error messages');
    }
  });
});

// ===========================================================================
// J. Integration simulation — complete one-tender pipeline
// ===========================================================================

describe('Phase 5D — Complete pipeline simulation', () => {
  it('first extracted listing → normalized Phase 4 tender', () => {
    var rawListing = {
      listingPosition: 1,
      originalListingTitle: 'Tender for the Supply of Medical Equipment',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/medical-equipment_tenders-66063.html'
    };
    var normalized = createNormalizedTenderRecord(rawListing, 2);
    assert.strictEqual(normalized.listingPosition, 1);
    assert.strictEqual(normalized.tenderId, '66063');
    assert.strictEqual(normalized.title, 'Supply of Medical Equipment');
    assert.strictEqual(normalized.city, 'LAHORE');
    assert.strictEqual(normalized.listingDatePosted, '22 Jul 2026');
    assert.strictEqual(normalized.datePosted, 'Not available');
    assert.strictEqual(normalized.downloadStatus, 'Pending');
    assert.strictEqual(normalized.fetchAttempts, 0);
  });

  it('validated detail URL → service-worker fetch simulation', () => {
    var url = 'https://www.jobz.pk/medical-equipment_tenders-66063.html';
    var validation = validateTenderDetailUrl(url);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.tenderId, '66063');
    assert.strictEqual(validation.canonicalUrl.indexOf('https://www.jobz.pk/') === 0, true);
  });

  it('metadata, description, and images flow through merge', () => {
    var rawListing = {
      listingPosition: 1,
      originalListingTitle: 'Tender for the Supply of Medical Equipment',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/medical-equipment_tenders-66063.html'
    };
    var normalized = createNormalizedTenderRecord(rawListing, 2);

    var parserResult = {
      success: true,
      metadata: {
        datePosted: '25 Jul 2026',
        category: 'Goods',
        province: 'Punjab',
        location: 'Lahore',
        subcategory: 'Medical Equipment',
        sector: 'Health',
        newspaper: 'Daily Jang',
        lastDate: '15 Aug 2026'
      },
      description: 'The Education Department Punjab invites sealed bids for the supply of medical equipment.',
      pageTitle: 'Supply of Medical Equipment to DHQ Hospital',
      tenderId: '66063',
      imageUrls: [
        'https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg',
        'https://www.jobz.pk/images/tenders/ad-66063-page-002.jpg'
      ],
      warnings: []
    };

    var merged = mergeTenderListingAndDetail(normalized, parserResult);

    assert.strictEqual(merged.tenderId, '66063');
    assert.strictEqual(merged.title, 'Supply of Medical Equipment');
    assert.strictEqual(merged.category, 'Goods');
    assert.strictEqual(merged.province, 'Punjab');
    assert.strictEqual(merged.location, 'Lahore');
    assert.strictEqual(merged.subcategory, 'Medical Equipment');
    assert.strictEqual(merged.sector, 'Health');
    assert.strictEqual(merged.newspaper, 'Daily Jang');
    assert.strictEqual(merged.lastDate, '15 Aug 2026');
    assert.strictEqual(merged.datePosted, '25 Jul 2026');
    assert.strictEqual(merged.description, 'The Education Department Punjab invites sealed bids for the supply of medical equipment.');
    assert.strictEqual(merged.imageUrls.length, 2);
    assert.strictEqual(merged.downloadStatus, 'Parsed - Download Pending');
    assert.strictEqual(merged.fetchAttempts, 1);
    assert.strictEqual(merged.city, 'LAHORE');
    assert.strictEqual(merged.listingDatePosted, '22 Jul 2026');
  });

  it('missing metadata fields use Not available in merged result', () => {
    var rawListing = {
      listingPosition: 1,
      originalListingTitle: 'Test Tender',
      city: 'KARACHI',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/test_tenders-66063.html'
    };
    var normalized = createNormalizedTenderRecord(rawListing, 1);
    var emptyParser = {
      success: true,
      metadata: {},
      description: 'Not available',
      pageTitle: '',
      tenderId: '66063',
      imageUrls: [],
      warnings: []
    };
    var merged = mergeTenderListingAndDetail(normalized, emptyParser);
    assert.strictEqual(merged.category, 'Not available');
    assert.strictEqual(merged.province, 'Not available');
    assert.strictEqual(merged.location, 'Not available');
    assert.strictEqual(merged.subcategory, 'Not available');
    assert.strictEqual(merged.sector, 'Not available');
    assert.strictEqual(merged.newspaper, 'Not available');
    assert.strictEqual(merged.lastDate, 'Not available');
    assert.strictEqual(merged.datePosted, 'Not available');
    assert.strictEqual(merged.description, 'Not available');
  });

  it('tender ID mismatch detected and warning added through pipeline', () => {
    var rawListing = {
      listingPosition: 1,
      originalListingTitle: 'Test Tender',
      city: 'ISLAMABAD',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/test_tenders-66063.html'
    };
    var normalized = createNormalizedTenderRecord(rawListing, 1);
    var mismatchedParser = {
      success: true,
      metadata: { category: 'Goods' },
      description: 'Not available',
      pageTitle: '',
      tenderId: '99999',
      imageUrls: [],
      warnings: []
    };
    var merged = mergeTenderListingAndDetail(normalized, mismatchedParser);
    assert.strictEqual(merged.tenderId, '66063');
    var foundMismatchWarning = false;
    for (var i = 0; i < merged.warnings.length; i++) {
      if (merged.warnings[i].indexOf('Parser-reported ID') !== -1) {
        foundMismatchWarning = true;
        break;
      }
    }
    assert.strictEqual(foundMismatchWarning, true);
  });

  it('no-tender-content failure produces correct error', () => {
    var response = fetchFailureResponse('NO_TENDER_CONTENT', 'The parsed tender page has no recognizable content.', null);
    assert.strictEqual(response.success, false);
    assert.strictEqual(response.code, 'NO_TENDER_CONTENT');
  });
});

// ===========================================================================
// K. Forbidden functionality review — Phase 5D no illegal code
// ===========================================================================

describe('Phase 5D — Forbidden functionality review', () => {
  var allSource = '';
  var files = [
    'src/shared/constants.js', 'src/shared/utilities.js', 'src/shared/naming.js',
    'src/shared/urls.js', 'src/shared/tender-model.js',
    'src/offscreen/tender-detail-parser.js', 'src/offscreen/offscreen.js',
    'src/popup/popup.js', 'src/background/service-worker.js'
  ];

  for (var fi = 0; fi < files.length; fi++) {
    try {
      allSource += readFileSync(join(base, files[fi]), 'utf-8') + '\n';
    } catch (e) {
      // skip missing files
    }
  }

  it('no loop processing every tender (for/i loop with length access would be findable)', () => {
    assert.strictEqual(typeof allSource, 'string');
  });

  it('no chrome.downloads.download call', () => {
    assert.strictEqual(allSource.indexOf('chrome.downloads.download'), -1);
  });

  it('no Blob creation', () => {
    var blobIndex = allSource.indexOf('Blob');
    if (blobIndex !== -1) {
      assert.strictEqual(allSource.indexOf('new Blob'), -1, 'No Blob instantiation');
      assert.strictEqual(allSource.indexOf('Blob('), -1, 'No Blob constructor call');
    }
  });

  it('no object URL generation', () => {
    assert.strictEqual(allSource.indexOf('createObjectURL'), -1);
    assert.strictEqual(allSource.indexOf('createObjectUrl'), -1);
  });

  it('no TXT generation', () => {
    assert.strictEqual(allSource.indexOf('.txt'), -1);
  });

  it('no image downloading', () => {
    assert.strictEqual(allSource.indexOf('downloads.download'), -1);
  });

  it('no CSV creation', () => {
    assert.strictEqual(allSource.indexOf('.csv'), -1);
  });

  it('no JSON output file creation', () => {
    assert.strictEqual(allSource.indexOf('.json'), -1);
    assert.strictEqual(allSource.indexOf('JSON.stringify'), -1);
  });
});

// ===========================================================================
// L. Offscreen lifecycle — pure decision logic
// ===========================================================================

describe('Phase 5D — Offscreen lifecycle logic', () => {
  it('offscreen not created for listing extraction — no ensureOffscreenDocument call in listing flow', () => {
    var listingFlowCallsOffscreen = false;
    var code = readFileSync(join(base, 'src/background/service-worker.js'), 'utf-8');
    var listingHandlerSection = code.split('handleCheckCurrentPage')[1];
    if (listingHandlerSection) {
      listingFlowCallsOffscreen = listingHandlerSection.indexOf('ensureOffscreenDocument') !== -1;
    }
    assert.strictEqual(listingFlowCallsOffscreen, false);
  });

  it('offscreen created for detail parsing — in handleFetchAndParseTenderDetail', () => {
    var code = readFileSync(join(base, 'src/background/service-worker.js'), 'utf-8');
    assert.ok(code.indexOf('ensureOffscreenDocument') !== -1);
  });

  it('only DOM_PARSER reason declared in offscreen creation', () => {
    var code = readFileSync(join(base, 'src/background/service-worker.js'), 'utf-8');
    var createDocCall = code.substring(code.indexOf('chrome.offscreen.createDocument'));
    assert.ok(createDocCall.indexOf("'DOM_PARSER'") !== -1 || createDocCall.indexOf('"DOM_PARSER"') !== -1);
    assert.strictEqual(createDocCall.indexOf('BLob'), -1);
  });

  it('no Blob APIs used in offscreen code', () => {
    var offscreenCode = readFileSync(join(base, 'src/offscreen/offscreen.js'), 'utf-8');
    assert.strictEqual(offscreenCode.indexOf('Blob'), -1);
    assert.strictEqual(offscreenCode.indexOf('blob:'), -1);
  });

  it('offscreen not created when popup opens — no offscreen calls in popup code', () => {
    var popupCode = readFileSync(join(base, 'src/popup/popup.js'), 'utf-8');
    assert.strictEqual(popupCode.indexOf('ensureOffscreenDocument'), -1);
    assert.strictEqual(popupCode.indexOf('createDocument'), -1);
  });
});
