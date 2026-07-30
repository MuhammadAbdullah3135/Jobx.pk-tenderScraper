const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

// Load shared modules
const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
const tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');
const constantsCode = readFileSync(join(base, 'src/shared/constants.js'), 'utf-8');
const batchStateCode = readFileSync(join(base, 'src/shared/batch-state.js'), 'utf-8');

// ---- Mock chrome.storage.local ----
var mockData = {};

globalThis.chrome = {
  runtime: {
    lastError: null,
    onMessage: { addListener: function() {} }
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
        callback(result);
      },
      set: function(items, callback) {
        for (var k in items) {
          if (items.hasOwnProperty(k)) {
            mockData[k] = items[k];
          }
        }
        callback();
      },
      remove: function(key, callback) {
        if (typeof key === 'string') {
          delete mockData[key];
        }
        callback();
      }
    },
    onChanged: {
      addListener: function() {}
    }
  }
};

eval(utilitiesCode);
eval(namingCode);
eval(urlsCode);
eval(tenderModelCode);
eval(constantsCode);
eval(batchStateCode);

// ---- Test fixtures ----

var RAW_TENDERS = [
  { listingPosition: 1, originalListingTitle: 'Supply of Medical Equipment', detailUrl: 'https://www.jobz.pk/medical_tenders-1001.html', city: 'LAHORE', datePosted: '1 Jan 2026' },
  { listingPosition: 2, originalListingTitle: 'Construction of Road', detailUrl: 'https://www.jobz.pk/road_tenders-1002.html', city: 'KARACHI', datePosted: '2 Jan 2026' },
  { listingPosition: 3, originalListingTitle: 'IT Equipment Procurement', detailUrl: 'https://www.jobz.pk/it_tenders-1003.html', city: 'ISLAMABAD', datePosted: '3 Jan 2026' }
];

function makeNormalizedTenders() {
  return RAW_TENDERS.map(function(t) {
    return createNormalizedTenderRecord(t, 1);
  });
}

// ---- Mock DOM elements for popup tests ----
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
  var elements = {
    'download-btn': createMockElement('button'),
    'status-text': createMockElement('div'),
    'current-page-status': createMockElement('span'),
    'pagination-info': createMockElement('span'),
    'tender-count': createMockElement('span'),
    'message-area': createMockElement('div'),
    'parse-btn': createMockElement('button'),
    'parse-summary': createMockElement('div'),
    'progress-area': createMockElement('div'),
    'progress-bar': createMockElement('progress'),
    'processed-count': createMockElement('span'),
    'success-count': createMockElement('span'),
    'failed-count': createMockElement('span'),
    'skipped-count': createMockElement('span'),
    'remaining-count': createMockElement('span'),
    'current-tender-name': createMockElement('span')
  };
  elements['progress-area'].style.display = 'none';
  return elements;
}

// ---- updateBatchUI (mirrors popup.js behavior) ----
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

  if (state.batchStatus === 'Completed') {
    if (els['download-btn']) {
      els['download-btn'].textContent = 'Batch Completed';
      els['download-btn'].disabled = true;
    }
    if (els['status-text']) els['status-text'].textContent = 'Batch: Completed (' + processed + ' of ' + total + ')';
    if (els['message-area']) els['message-area'].textContent = 'All tenders processed.';
  } else if (state.batchStatus === 'Processing') {
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

// ---- Tests ----

describe('Phase 6C — Progress updates', () => {
  beforeEach(function() { mockData = {}; });

  it('displays zero progress for initial state', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    state.batchStatus = 'Processing';

    updateBatchUI(state, els);

    assert.strictEqual(els['progress-bar'].value, 0);
    assert.strictEqual(els['processed-count'].textContent, 0);
    assert.strictEqual(els['success-count'].textContent, 0);
    assert.strictEqual(els['failed-count'].textContent, 0);
    assert.strictEqual(els['remaining-count'].textContent, 3);
    assert.strictEqual(els['progress-area'].style.display, '');
    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (0 of 3)');
    assert.strictEqual(els['download-btn'].textContent, 'Processing...');
    assert.strictEqual(els['download-btn'].disabled, true);
  });

  it('shows progress after processing one tender', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 1;
    state.processedCount = 1;
    state.successCount = 1;
    state.tenders[0].downloadStatus = 'Parsed - Download Pending';

    updateBatchUI(state, els);

    assert.strictEqual(els['progress-bar'].value, 33);
    assert.strictEqual(els['processed-count'].textContent, 1);
    assert.strictEqual(els['success-count'].textContent, 1);
    assert.strictEqual(els['failed-count'].textContent, 0);
    assert.strictEqual(els['remaining-count'].textContent, 2);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (1 of 3)');
    assert.ok(els['current-tender-name'].textContent.indexOf('Supply of Medical Equipment') !== -1);
  });

  it('shows partial progress at 2 of 3', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 2;
    state.processedCount = 2;
    state.successCount = 2;
    state.tenders[0].downloadStatus = 'Parsed - Download Pending';
    state.tenders[1].downloadStatus = 'Parsed - Download Pending';

    updateBatchUI(state, els);

    assert.strictEqual(els['progress-bar'].value, 67);
    assert.strictEqual(els['processed-count'].textContent, 2);
    assert.strictEqual(els['success-count'].textContent, 2);
    assert.strictEqual(els['remaining-count'].textContent, 1);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (2 of 3)');
    assert.ok(els['current-tender-name'].textContent.indexOf('Construction of Road') !== -1);
  });

  it('shows failures and successes together', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 2;
    state.processedCount = 2;
    state.successCount = 1;
    state.failedCount = 1;
    state.tenders[0].downloadStatus = 'Parsed - Download Pending';
    state.tenders[1].downloadStatus = 'Parse Failed';
    state.tenders[1].failureReason = 'HTTP 404';

    updateBatchUI(state, els);

    assert.strictEqual(els['success-count'].textContent, 1);
    assert.strictEqual(els['failed-count'].textContent, 1);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (2 of 3)');
    assert.strictEqual(els['remaining-count'].textContent, 1);
  });

  it('handles skipped count display', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Processing';
    state.processedCount = 1;
    state.skippedCount = 1;

    updateBatchUI(state, els);

    assert.strictEqual(els['skipped-count'].textContent, 1);
  });
});

describe('Phase 6C — Completed batch display', () => {
  beforeEach(function() { mockData = {}; });

  it('shows completed state with full progress', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    state.batchStatus = 'Completed';
    state.currentTenderIndex = 3;
    state.processedCount = 3;
    state.successCount = 2;
    state.failedCount = 1;

    updateBatchUI(state, els);

    assert.strictEqual(els['progress-bar'].value, 100);
    assert.strictEqual(els['processed-count'].textContent, 3);
    assert.strictEqual(els['success-count'].textContent, 2);
    assert.strictEqual(els['failed-count'].textContent, 1);
    assert.strictEqual(els['remaining-count'].textContent, 0);
    assert.strictEqual(els['download-btn'].textContent, 'Batch Completed');
    assert.strictEqual(els['download-btn'].disabled, true);
    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
    assert.strictEqual(els['message-area'].textContent, 'All tenders processed.');
  });

  it('shows completed state with zero tenders', () => {
    var els = createMockPopupDOM();
    var state = createBatchState(1, 'url', []);
    state.batchStatus = 'Completed';

    updateBatchUI(state, els);

    assert.strictEqual(els['progress-bar'].value, 0);
    assert.strictEqual(els['processed-count'].textContent, 0);
    assert.strictEqual(els['remaining-count'].textContent, 0);
    assert.strictEqual(els['download-btn'].textContent, 'Batch Completed');
    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (0 of 0)');
  });

  it('shows zero remaining when processed equals total', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Completed';
    state.currentTenderIndex = 3;
    state.processedCount = 3;
    state.successCount = 3;
    state.failedCount = 0;

    updateBatchUI(state, els);

    assert.strictEqual(els['remaining-count'].textContent, 0);
    assert.strictEqual(els['failed-count'].textContent, 0);
  });
});

describe('Phase 6C — State restoration on reopen', () => {
  beforeEach(function() { mockData = {}; });

  it('restores processing state from storage', function() {
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 2;
    state.processedCount = 2;
    state.successCount = 2;

    return saveBatchState(state).then(function() {
      var els = createMockPopupDOM();
      return new Promise(function(resolve) {
        chrome.storage.local.get(BATCH_STORAGE_KEY, function(result) {
          var raw = result && result[BATCH_STORAGE_KEY];
          assert.ok(raw);
          var restored = recoverBatchState(raw);
          assert.strictEqual(restored.batchStatus, 'Processing');
          assert.strictEqual(restored.currentTenderIndex, 2);
          assert.strictEqual(restored.processedCount, 2);

          updateBatchUI(restored, els);
          assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (2 of 3)');
          assert.strictEqual(els['processed-count'].textContent, 2);
          assert.strictEqual(els['download-btn'].textContent, 'Processing...');
          assert.strictEqual(els['download-btn'].disabled, true);
          resolve();
        });
      });
    });
  });

  it('restores completed state from storage', function() {
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
    state.batchStatus = 'Completed';
    state.currentTenderIndex = 3;
    state.processedCount = 3;
    state.successCount = 3;

    return saveBatchState(state).then(function() {
      var els = createMockPopupDOM();
      return new Promise(function(resolve) {
        chrome.storage.local.get(BATCH_STORAGE_KEY, function(result) {
          var raw = result && result[BATCH_STORAGE_KEY];
          var restored = recoverBatchState(raw);

          updateBatchUI(restored, els);
          assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
          assert.strictEqual(els['download-btn'].textContent, 'Batch Completed');
          assert.strictEqual(els['download-btn'].disabled, true);
          assert.strictEqual(els['message-area'].textContent, 'All tenders processed.');
          resolve();
        });
      });
    });
  });

  it('returns empty state when no batch in storage', function() {
    return new Promise(function(resolve) {
      chrome.storage.local.get(BATCH_STORAGE_KEY, function(result) {
        var raw = result && result[BATCH_STORAGE_KEY];
        assert.strictEqual(raw, undefined);
        resolve();
      });
    });
  });
});

describe('Phase 6C — Storage synchronization', () => {
  beforeEach(function() { mockData = {}; });

  it('updateBatchUI reads all counts from stored state', function() {
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 1;
    state.processedCount = 1;
    state.successCount = 1;

    return saveBatchState(state).then(function() {
      return new Promise(function(resolve) {
        chrome.storage.local.get(BATCH_STORAGE_KEY, function(result) {
          var raw = result && result[BATCH_STORAGE_KEY];
          var loaded = recoverBatchState(raw);
          assert.strictEqual(loaded.totalTenders, 3);
          assert.strictEqual(loaded.processedCount, 1);
          assert.strictEqual(loaded.successCount, 1);
          assert.strictEqual(loaded.batchStatus, 'Processing');
          resolve();
        });
      });
    });
  });

  it('handleStorageChange updates all elements correctly', function() {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 1;
    state.processedCount = 1;
    state.successCount = 1;

    updateBatchUI(state, els);

    assert.strictEqual(els['progress-bar'].value, 33);
    assert.strictEqual(els['success-count'].textContent, 1);
    assert.strictEqual(els['remaining-count'].textContent, 2);

    // Update state to simulate second tender processed
    state.currentTenderIndex = 2;
    state.processedCount = 2;
    state.successCount = 2;

    updateBatchUI(state, els);

    assert.strictEqual(els['progress-bar'].value, 67);
    assert.strictEqual(els['processed-count'].textContent, 2);
    assert.strictEqual(els['success-count'].textContent, 2);
    assert.strictEqual(els['remaining-count'].textContent, 1);
  });

  it('multiple storage updates show cumulative progress', function() {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Processing';

    // Step 1: Update with first tender processed
    state.currentTenderIndex = 1;
    state.processedCount = 1;
    state.successCount = 1;
    updateBatchUI(state, els);
    assert.strictEqual(els['processed-count'].textContent, 1);

    // Step 2: Update with second tender processed
    state.currentTenderIndex = 2;
    state.processedCount = 2;
    state.successCount = 2;
    updateBatchUI(state, els);
    assert.strictEqual(els['processed-count'].textContent, 2);

    // Step 3: Complete
    state.currentTenderIndex = 3;
    state.processedCount = 3;
    state.successCount = 3;
    state.batchStatus = 'Completed';
    updateBatchUI(state, els);
    assert.strictEqual(els['processed-count'].textContent, 3);
    assert.strictEqual(els['download-btn'].textContent, 'Batch Completed');
  });
});

describe('Phase 6C — Button state management', () => {
  beforeEach(function() { mockData = {}; });

  it('download button shows correct text during processing', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Processing';

    updateBatchUI(state, els);

    assert.strictEqual(els['download-btn'].textContent, 'Processing...');
    assert.strictEqual(els['download-btn'].disabled, true);
  });

  it('download button shows correct text after completion', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Completed';
    state.currentTenderIndex = 3;
    state.processedCount = 3;

    updateBatchUI(state, els);

    assert.strictEqual(els['download-btn'].textContent, 'Batch Completed');
    assert.strictEqual(els['download-btn'].disabled, true);
  });

  it('status text reflects batch progress accurately', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 2;
    state.processedCount = 2;

    updateBatchUI(state, els);

    assert.strictEqual(els['status-text'].textContent, 'Batch: Processing (2 of 3)');

    state.batchStatus = 'Completed';
    state.currentTenderIndex = 3;
    state.processedCount = 3;

    updateBatchUI(state, els);

    assert.strictEqual(els['status-text'].textContent, 'Batch: Completed (3 of 3)');
  });

  it('current tender name shows most recently processed tender', () => {
    var els = createMockPopupDOM();
    var tenders = makeNormalizedTenders();
    var state = createBatchState(1, 'url', tenders);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 2;
    state.processedCount = 2;
    state.successCount = 2;

    updateBatchUI(state, els);

    // currentTenderIndex=2 means tender at index 1 was last processed
    assert.ok(els['current-tender-name'].textContent.indexOf('Construction of Road') !== -1);
  });
});
