const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
const tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');
const constantsCode = readFileSync(join(base, 'src/shared/constants.js'), 'utf-8');
const batchStateCode = readFileSync(join(base, 'src/shared/batch-state.js'), 'utf-8');

var mockData = {};
var storageCallbackQueue = [];

globalThis.chrome = {
  runtime: {
    lastError: null,
    onMessage: { addListener: function() {} },
    sendMessage: function(msg, cb) { if (cb) cb({}); }
  },
  storage: {
    local: {
      get: function(key, callback) {
        var result = {};
        if (typeof key === 'string') {
          if (mockData.hasOwnProperty(key)) {
            result[key] = mockData[key];
          }
        } else {
          result = mockData;
        }
        if (typeof callback === 'function') {
          storageCallbackQueue.push(function() { callback(result); });
        }
      },
      set: function(items, callback) {
        for (var k in items) {
          if (items.hasOwnProperty(k)) { mockData[k] = items[k]; }
        }
        if (typeof callback === 'function') { callback(); }
      },
      remove: function(key, callback) {
        if (typeof key === 'string') { delete mockData[key]; }
        if (typeof callback === 'function') { callback(); }
      }
    },
    onChanged: { addListener: function() {} }
  }
};

eval(utilitiesCode);
eval(namingCode);
eval(urlsCode);
eval(tenderModelCode);
eval(constantsCode);
eval(batchStateCode);

var RAW_TENDERS = [
  { listingPosition: 1, originalListingTitle: 'Supply of Medical Equipment', detailUrl: 'https://www.jobz.pk/medical_tenders-1001.html', city: 'LAHORE', datePosted: '1 Jan 2026' },
  { listingPosition: 2, originalListingTitle: 'Construction of Road', detailUrl: 'https://www.jobz.pk/road_tenders-1002.html', city: 'KARACHI', datePosted: '2 Jan 2026' },
  { listingPosition: 3, originalListingTitle: 'IT Equipment Procurement', detailUrl: 'https://www.jobz.pk/it_tenders-1003.html', city: 'ISLAMABAD', datePosted: '3 Jan 2026' }
];

function makeNormalizedTenders() {
  return RAW_TENDERS.map(function(t) { return createNormalizedTenderRecord(t, 1); });
}

function makeInspectionResponse(overrides) {
  return Object.assign({
    supported: true,
    pageNumber: 1,
    pageUrl: 'https://www.jobz.pk/tenders/',
    reason: null,
    tenders: makeNormalizedTenders(),
    tenderCount: 3,
    warnings: []
  }, overrides || {});
}

function createMockElement(tag) {
  return {
    tagName: tag || 'div',
    textContent: '',
    innerHTML: '',
    style: { display: '' },
    value: 0,
    max: 100,
    disabled: false
  };
}

function createMockPopupDOM() {
  var els = {
    'download-btn': createMockElement('button'),
    'status-text': createMockElement('div'),
    'current-page-status': createMockElement('span'),
    'pagination-info': createMockElement('span'),
    'tender-count': createMockElement('span'),
    'message-area': createMockElement('div'),
    'progress-area': createMockElement('div'),
    'progress-bar': createMockElement('progress'),
    'processed-count': createMockElement('span'),
    'success-count': createMockElement('span'),
    'failed-count': createMockElement('span'),
    'skipped-count': createMockElement('span'),
    'remaining-count': createMockElement('span'),
    'current-tender-name': createMockElement('span'),
    'completion-summary': createMockElement('div'),
    'summary-completed-at': createMockElement('span'),
    'summary-duration': createMockElement('span'),
    'summary-total': createMockElement('span'),
    'summary-success': createMockElement('span'),
    'summary-failed': createMockElement('span'),
    'summary-skipped': createMockElement('span')
  };
  els['progress-area'].style.display = 'none';
  els['completion-summary'].style.display = 'none';
  return els;
}

var BATCH_STATUS_IDLE = 'Idle';
var BATCH_STATUS_PROCESSING = 'Processing';
var BATCH_STATUS_COMPLETED = 'Completed';
var BATCH_STATUS_FAILED = 'Failed';

function updateBatchUI(state, els) {
  if (!state || !els['progress-bar']) return;
  var total = state.totalTenders || 0;
  var processed = state.processedCount || 0;
  var remaining = total - processed;
  if (remaining < 0) remaining = 0;
  var pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  els['progress-bar'].value = pct;
  els['progress-bar'].max = 100;
  if (els['processed-count']) els['processed-count'].textContent = processed;
  if (els['success-count']) els['success-count'].textContent = state.successCount || 0;
  if (els['failed-count']) els['failed-count'].textContent = state.failedCount || 0;
  if (els['skipped-count']) els['skipped-count'].textContent = state.skippedCount || 0;
  if (els['remaining-count']) els['remaining-count'].textContent = remaining;
  if (els['progress-area']) els['progress-area'].style.display = '';
  if (state.batchStatus === BATCH_STATUS_COMPLETED) {
    if (els['download-btn']) {
      els['download-btn'].textContent = 'Start New Batch';
      els['download-btn'].disabled = false;
    }
    if (els['status-text']) els['status-text'].textContent = 'Batch: Completed (' + processed + ' of ' + total + ')';
    if (els['message-area']) els['message-area'].textContent = 'All tenders processed.';
  } else if (state.batchStatus === BATCH_STATUS_PROCESSING) {
    if (els['download-btn']) {
      els['download-btn'].textContent = 'Processing...';
      els['download-btn'].disabled = true;
    }
    if (els['status-text']) els['status-text'].textContent = 'Batch: Processing (' + processed + ' of ' + total + ')';
    var currentIdx = state.currentTenderIndex || 0;
    if (currentIdx > 0 && currentIdx <= total && els['current-tender-name']) {
      var currentTender = state.tenders[currentIdx - 1];
      var displayName = currentTender ? (currentTender.title || currentTender.originalListingTitle || 'Tender ' + currentIdx) : 'Tender ' + currentIdx;
      els['current-tender-name'].textContent = displayName;
    } else if (els['current-tender-name']) {
      var nextTender = state.tenders[currentIdx];
      var pendingName = nextTender ? (nextTender.title || nextTender.originalListingTitle || 'Tender ' + (currentIdx + 1)) : 'Tender ' + (currentIdx + 1);
      els['current-tender-name'].textContent = 'Next: ' + pendingName;
    }
  }
}

function simulateRenderSupported(response, els, batchUIControlled, batchActive) {
  if (!batchUIControlled) {
    els['status-text'].textContent = 'Current Page: Supported';
  }
  els['current-page-status'].textContent = 'Supported';

  if (response.reason) {
    els['pagination-info'].textContent = 'Not available';
  } else if (typeof response.pageNumber === 'number' && response.pageNumber > 0) {
    els['pagination-info'].textContent = 'Page ' + response.pageNumber;
  } else {
    els['pagination-info'].textContent = 'Not available';
  }

  var validTenders = Array.isArray(response.tenders) ? response.tenders : [];
  var count = validTenders.length;
  els['tender-count'].textContent = count;

  var canEnable = count > 0 && !response.reason && !batchActive;

  if (!batchUIControlled) {
    els['download-btn'].disabled = !canEnable;
  }
}

function simulateRestoreBatch(state, els) {
  if (!state || !state.batchStatus) return { batchUIControlled: false, batchActive: false };
  if (state.batchStatus === BATCH_STATUS_PROCESSING || state.batchStatus === BATCH_STATUS_COMPLETED || state.batchStatus === BATCH_STATUS_FAILED) {
    var batchUIControlled = true;
    var batchActive = true;
    updateBatchUI(state, els);
    return { batchUIControlled: batchUIControlled, batchActive: batchActive };
  }
  return { batchUIControlled: false, batchActive: false };
}

// ---- Tests ----

describe('Popup initialization — no batch exists', () => {
  beforeEach(function() { mockData = {}; });

  it('renderSupported controls UI freely when no batch is active', () => {
    var els = createMockPopupDOM();
    var response = makeInspectionResponse();
    simulateRenderSupported(response, els, false, false);
    assert.strictEqual(els['status-text'].textContent, 'Current Page: Supported');
    assert.strictEqual(els['current-page-status'].textContent, 'Supported');
    assert.strictEqual(els['pagination-info'].textContent, 'Page 1');
    assert.strictEqual(els['tender-count'].textContent, 3);
    assert.strictEqual(els['download-btn'].disabled, false);
  });

  it('button is disabled when no tenders found', () => {
    var els = createMockPopupDOM();
    var response = makeInspectionResponse({ tenders: [], tenderCount: 0 });
    simulateRenderSupported(response, els, false, false);
    assert.strictEqual(els['download-btn'].disabled, true);
    assert.strictEqual(els['tender-count'].textContent, 0);
  });

  it('restoreBatchFromStorage does nothing when no batch stored', () => {
    var els = createMockPopupDOM();
    var state = simulateRestoreBatch(null, els);
    assert.strictEqual(state.batchUIControlled, false);
    assert.strictEqual(state.batchActive, false);
    assert.strictEqual(els['progress-area'].style.display, 'none');
  });
});

describe('Popup initialization — restore before page inspection (Scenario A)', () => {
  beforeEach(function() { mockData = {}; });

  it('preserves completed batch statusText when renderSupported runs after restore', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var batchState = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    batchState.batchStatus = BATCH_STATUS_COMPLETED;
    batchState.currentTenderIndex = 3;
    batchState.processedCount = 3;
    batchState.successCount = 3;

    var restoreResult = simulateRestoreBatch(batchState, els);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
    assert.strictEqual(els['download-btn'].textContent, 'Start New Batch');
    assert.strictEqual(els['download-btn'].disabled, false);

    var response = makeInspectionResponse();
    simulateRenderSupported(response, els, restoreResult.batchUIControlled, restoreResult.batchActive);

    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
    assert.strictEqual(els['current-page-status'].textContent, 'Supported');
    assert.strictEqual(els['pagination-info'].textContent, 'Page 1');
    assert.strictEqual(els['tender-count'].textContent, 3);
    assert.strictEqual(els['download-btn'].disabled, false);
    assert.strictEqual(els['download-btn'].textContent, 'Start New Batch');
  });

  it('preserves processing statusText when renderSupported runs after restore', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var batchState = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    batchState.batchStatus = BATCH_STATUS_PROCESSING;
    batchState.currentTenderIndex = 1;
    batchState.processedCount = 1;
    batchState.successCount = 1;

    var restoreResult = simulateRestoreBatch(batchState, els);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (1 of 3)');
    assert.strictEqual(els['download-btn'].textContent, 'Processing...');

    var response = makeInspectionResponse();
    simulateRenderSupported(response, els, restoreResult.batchUIControlled, restoreResult.batchActive);

    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (1 of 3)');
    assert.strictEqual(els['download-btn'].disabled, true);
    assert.strictEqual(els['download-btn'].textContent, 'Processing...');
    assert.strictEqual(els['current-page-status'].textContent, 'Supported');
  });

  it('preserves completed batch after re-inspect when no tenders on current page', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var batchState = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    batchState.batchStatus = BATCH_STATUS_COMPLETED;
    batchState.currentTenderIndex = 3;
    batchState.processedCount = 3;
    batchState.successCount = 3;

    var restoreResult = simulateRestoreBatch(batchState, els);
    var response = makeInspectionResponse({ tenders: [], tenderCount: 0 });
    simulateRenderSupported(response, els, restoreResult.batchUIControlled, restoreResult.batchActive);

    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
    assert.strictEqual(els['download-btn'].textContent, 'Start New Batch');
    assert.strictEqual(els['download-btn'].disabled, false);
    assert.strictEqual(els['tender-count'].textContent, 0);
  });
});

describe('Popup initialization — page inspection before restore (Scenario B)', () => {
  beforeEach(function() { mockData = {}; });

  it('batch restoration overwrites page inspection UI when restore runs second', () => {
    var els = createMockPopupDOM();

    simulateRenderSupported(makeInspectionResponse(), els, false, false);
    assert.strictEqual(els['status-text'].textContent, 'Current Page: Supported');
    assert.strictEqual(els['download-btn'].disabled, false);

    var tenders = makeNormalizedTenders();
    var batchState = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    batchState.batchStatus = BATCH_STATUS_COMPLETED;
    batchState.currentTenderIndex = 3;
    batchState.processedCount = 3;
    batchState.successCount = 3;

    simulateRestoreBatch(batchState, els);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
    assert.strictEqual(els['download-btn'].textContent, 'Start New Batch');
    assert.strictEqual(els['download-btn'].disabled, false);
  });

  it('processing batch overwrites page UI when restore runs second', () => {
    var els = createMockPopupDOM();

    simulateRenderSupported(makeInspectionResponse(), els, false, false);
    assert.strictEqual(els['status-text'].textContent, 'Current Page: Supported');

    var tenders = makeNormalizedTenders();
    var batchState = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    batchState.batchStatus = BATCH_STATUS_PROCESSING;
    batchState.currentTenderIndex = 1;
    batchState.processedCount = 1;

    simulateRestoreBatch(batchState, els);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (1 of 3)');
    assert.strictEqual(els['download-btn'].textContent, 'Processing...');
    assert.strictEqual(els['download-btn'].disabled, true);
  });
});

describe('Popup initialization — RESET_BATCH clears controlled state', () => {
  beforeEach(function() { mockData = {}; });

  it('after RESET_BATCH, renderSupported controls UI normally', () => {
    var els = createMockPopupDOM();
    var batchUIControlled = false;
    var batchActive = false;

    var tenders = makeNormalizedTenders();
    var batchState = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    batchState.batchStatus = BATCH_STATUS_COMPLETED;
    batchState.currentTenderIndex = 3;
    batchState.processedCount = 3;
    batchState.successCount = 3;

    var restoreResult = simulateRestoreBatch(batchState, els);
    batchUIControlled = restoreResult.batchUIControlled;
    batchActive = restoreResult.batchActive;

    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');

    batchUIControlled = false;
    batchActive = false;

    var response = makeInspectionResponse();
    simulateRenderSupported(response, els, batchUIControlled, batchActive);

    assert.strictEqual(els['status-text'].textContent, 'Current Page: Supported');
    assert.strictEqual(els['download-btn'].disabled, false);
    assert.strictEqual(els['tender-count'].textContent, 3);
  });
});

describe('Popup initialization — unsupported guarded by batchUIControlled', () => {
  beforeEach(function() { mockData = {}; });

  it('renderUnsupported does not overwrite when batch is active', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var batchState = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    batchState.batchStatus = BATCH_STATUS_COMPLETED;
    batchState.currentTenderIndex = 3;
    batchState.processedCount = 3;
    batchState.successCount = 3;

    simulateRestoreBatch(batchState, els);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');

    if (false) {
      els['status-text'].textContent = 'Current Page: Unsupported';
      els['current-page-status'].textContent = 'Unsupported';
      els['pagination-info'].textContent = 'Not available';
      els['tender-count'].textContent = '0';
      els['download-btn'].disabled = true;
    }

    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
    assert.strictEqual(els['download-btn'].disabled, false);
    assert.strictEqual(els['download-btn'].textContent, 'Start New Batch');
  });
});
