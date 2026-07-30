const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

const constantsCode = readFileSync(join(base, 'src/shared/constants.js'), 'utf-8');
const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
const tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');
const batchStateCode = readFileSync(join(base, 'src/shared/batch-state.js'), 'utf-8');
const txtGeneratorCode = readFileSync(join(base, 'src/shared/txt-generator.js'), 'utf-8');
const batchProcessorCode = readFileSync(join(base, 'src/shared/batch-processor.js'), 'utf-8');

var mockData = {};

globalThis.chrome = {
  runtime: {
    lastError: null
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
    }
  },
  downloads: {
    download: function(options, callback) {
      callback(42);
    }
  }
};

eval(constantsCode);
eval(utilitiesCode);
eval(namingCode);
eval(urlsCode);
eval(tenderModelCode);
eval(batchStateCode);
eval(txtGeneratorCode);

// Mock browser APIs not available in Node.js
if (typeof URL !== 'undefined') {
  if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = function() { return 'blob:mock'; };
  if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = function() {};
}

var DOWNLOAD_STATUS_PARSE_FAILED = 'Parse Failed';
var DOWNLOAD_STATUS_PENDING = 'Pending';
var DOWNLOAD_STATUS_PARSED = 'Parsed - Download Pending';
var DOWNLOAD_STATUS_PENDING_RETRY = 'Pending Retry';
var DOWNLOAD_STATUS_DOWNLOADED = 'Downloaded';
var DOWNLOAD_STATUS_DOWNLOAD_FAILED = 'Download Failed';
var BATCH_STATUS_PROCESSING = 'Processing';
var BATCH_STATUS_COMPLETED = 'Completed';
var BATCH_STATUS_IDLE = 'Idle';
var BATCH_STATUS_FAILED = 'Failed';
var BATCH_STORAGE_KEY = 'tenderBatchState';

eval(batchProcessorCode);

_delay = function() {
  return Promise.resolve();
};

var RAW_TENDERS = [
  { listingPosition: 1, originalListingTitle: 'Supply of Medical Equipment', detailUrl: 'https://www.jobz.pk/medical_tenders-1001.html', city: 'LAHORE', datePosted: '1 Jan 2026' },
  { listingPosition: 2, originalListingTitle: 'Construction of Road', detailUrl: 'https://www.jobz.pk/road_tenders-1002.html', city: 'KARACHI', datePosted: '2 Jan 2026' },
  { listingPosition: 3, originalListingTitle: 'IT Equipment Procurement', detailUrl: 'https://www.jobz.pk/it_tenders-1003.html', city: 'ISLAMABAD', datePosted: '3 Jan 2026' }
];

function createNormalizedTenders(rawTenders, pageNum) {
  return rawTenders.map(function(t) {
    return createNormalizedTenderRecord(t, pageNum);
  });
}

function createMockProcessor(resultSpecs) {
  var callIndex = 0;
  var callOrder = [];
  var attempts = {};

  function processorFn(tender) {
    var id = tender.tenderId || 'unknown';
    if (!attempts[id]) attempts[id] = 0;
    attempts[id]++;
    callOrder.push({ index: callIndex, tenderId: id, attempt: attempts[id] });
    var spec = resultSpecs[callIndex];
    callIndex++;
    if (spec && spec.fail) {
      return Promise.reject(new Error(spec.errorMessage || 'Mock failure'));
    }
    var merged = JSON.parse(JSON.stringify(tender));
    merged.downloadStatus = DOWNLOAD_STATUS_PARSED;
    merged.fetchAttempts = attempts[id];
    merged.metadata = spec && spec.metadata ? spec.metadata : {};
    return Promise.resolve(merged);
  }

  processorFn.getCallOrder = function() { return callOrder; };
  processorFn.getCallCount = function() { return callIndex; };
  processorFn.reset = function() { callIndex = 0; callOrder = []; attempts = {}; };

  return processorFn;
}

function createSavedBatch(tenders, retryConfig) {
  var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
  if (retryConfig) {
    state.retryConfig = retryConfig;
  }
  return saveBatchState(state).then(function() {
    return state;
  });
}

function forceResumeCleanup() {
  _batchProcessingInProgress = false;
}

// ---- 1. Invalid URL rejection ----
describe('Phase 6D — Invalid URL rejection', () => {
  beforeEach(function() { mockData = {}; });

  it('rejects immediately for tender with null detailUrl', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    normTenders[0].detailUrl = null;
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.processedCount, 1);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.successCount, 0);
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_PARSE_FAILED);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 0);
        assert.strictEqual(mockProc.getCallCount(), 0);
      });
    });
  });

  it('rejects immediately for tender with empty detailUrl', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    normTenders[0].detailUrl = '';
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.processedCount, 1);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(mockProc.getCallCount(), 0);
      });
    });
  });

  it('rejects immediately for non-http URL', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    normTenders[0].detailUrl = 'ftp://invalid.com/file.html';
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(mockProc.getCallCount(), 0);
      });
    });
  });

  it('does not retry invalid URL even if retries are configured', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1]], 1);
    normTenders[0].detailUrl = null;
    return createSavedBatch(normTenders, { maxRetries: 5, baseDelayMs: 1 }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }, { fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.successCount, 1);
        assert.strictEqual(finalState.processedCount, 2);
        assert.strictEqual(mockProc.getCallCount(), 1);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 0);
        assert.strictEqual(finalState.tenders[1].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });
});

// ---- 2. Retry success ----
describe('Phase 6D — Retry success', () => {
  beforeEach(function() { mockData = {}; forceResumeCleanup(); });

  it('succeeds on first attempt with no retries needed', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1]], 1);
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }, { fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 1);
        assert.strictEqual(finalState.tenders[1].fetchAttempts, 1);
        assert.strictEqual(mockProc.getCallCount(), 2);
      });
    });
  });

  it('retries once after first failure and succeeds', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function(tender) {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Transient network error'));
        }
        var merged = JSON.parse(JSON.stringify(tender));
        merged.downloadStatus = DOWNLOAD_STATUS_PARSED;
        merged.fetchAttempts = callCount;
        return Promise.resolve(merged);
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 1);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.processedCount, 1);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 2);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.strictEqual(callCount, 2);
      });
    });
  });

  it('recovers after two failures and succeeds on third attempt', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 5, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function(tender) {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Timeout error ' + callCount));
        }
        var merged = JSON.parse(JSON.stringify(tender));
        merged.downloadStatus = DOWNLOAD_STATUS_PARSED;
        merged.fetchAttempts = callCount;
        return Promise.resolve(merged);
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 1);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 3);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.strictEqual(callCount, 3);
      });
    });
  });

  it('continues to next tender after first succeeds with retry', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1]], 1);
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var calls = [];
      var mockProc = function(tender) {
        calls.push(tender.tenderId);
        if (tender.tenderId === '1001' && calls.filter(function(id) { return id === '1001'; }).length === 1) {
          return Promise.reject(new Error('First attempt failed'));
        }
        var merged = JSON.parse(JSON.stringify(tender));
        merged.downloadStatus = DOWNLOAD_STATUS_PARSED;
        merged.fetchAttempts = calls.filter(function(id) { return id === tender.tenderId; }).length;
        return Promise.resolve(merged);
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 2);
        assert.strictEqual(finalState.tenders[1].fetchAttempts, 1);
        assert.strictEqual(calls.length, 3);
        assert.strictEqual(calls[0], '1001');
        assert.strictEqual(calls[1], '1001');
        assert.strictEqual(calls[2], '1002');
      });
    });
  });
});

// ---- 3. Retry exhaustion ----
describe('Phase 6D — Retry exhaustion', () => {
  beforeEach(function() { mockData = {}; forceResumeCleanup(); });

  it('permanently fails after exhausting maxRetries', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function() {
        callCount++;
        return Promise.reject(new Error('Persistent failure'));
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.successCount, 0);
        assert.strictEqual(finalState.processedCount, 1);
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_PARSE_FAILED);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 3);
        assert.strictEqual(callCount, 3);
      });
    });
  });

  it('fails with maxRetries=1 (no retry)', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 1, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function() {
        callCount++;
        return Promise.reject(new Error('Fatal error'));
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 1);
        assert.strictEqual(callCount, 1);
      });
    });
  });

  it('fails with maxRetries=2 (one retry then fail)', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 2, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function() {
        callCount++;
        return Promise.reject(new Error('Still failing'));
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 2);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_PARSE_FAILED);
        assert.strictEqual(callCount, 2);
      });
    });
  });

  it('continues to next tender after retry exhaustion on first', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1]], 1);
    return createSavedBatch(normTenders, { maxRetries: 2, baseDelayMs: 1 }).then(function() {
      var calls = [];
      var mockProc = function(tender) {
        calls.push(tender.tenderId);
        if (tender.tenderId === '1001') {
          return Promise.reject(new Error('Fatal'));
        }
        var merged = JSON.parse(JSON.stringify(tender));
        merged.downloadStatus = DOWNLOAD_STATUS_PARSED;
        merged.fetchAttempts = 1;
        return Promise.resolve(merged);
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 1);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 2);
        assert.strictEqual(finalState.tenders[1].fetchAttempts, 1);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_PARSE_FAILED);
        assert.strictEqual(finalState.tenders[1].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });
});

// ---- 4. Checkpoint recovery ----
describe('Phase 6D — Checkpoint recovery (skip finalized tenders)', () => {
  beforeEach(function() { mockData = {}; forceResumeCleanup(); });

  it('downloads already parsed tenders on resume', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1], RAW_TENDERS[2]], 1);
    return createSavedBatch(normTenders).then(function(state) {
      state.tenders[0].downloadStatus = DOWNLOAD_STATUS_PARSED;
      state.tenders[0].fetchAttempts = 1;
      state.currentTenderIndex = 1;
      state.processedCount = 1;
      state.successCount = 1;
      return saveBatchState(state);
    }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }, { fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 3);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(mockProc.getCallCount(), 2);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 1);
        assert.strictEqual(finalState.tenders[1].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.strictEqual(finalState.tenders[2].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });

  it('skips tenders already in Parse Failed status when resuming', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1], RAW_TENDERS[2]], 1);
    return createSavedBatch(normTenders).then(function(state) {
      state.tenders[0].downloadStatus = DOWNLOAD_STATUS_PARSE_FAILED;
      state.tenders[0].failureReason = 'Previous permanent failure';
      state.tenders[0].fetchAttempts = 3;
      state.currentTenderIndex = 1;
      state.processedCount = 1;
      state.failedCount = 1;
      return saveBatchState(state);
    }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }, { fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(mockProc.getCallCount(), 2);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_PARSE_FAILED);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 3);
      });
    });
  });

  it('skips mixed states and processes remaining', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1], RAW_TENDERS[2]], 1);
    return createSavedBatch(normTenders).then(function(state) {
      state.tenders[0].downloadStatus = DOWNLOAD_STATUS_PARSED;
      state.tenders[0].fetchAttempts = 1;
      state.tenders[1].downloadStatus = DOWNLOAD_STATUS_PARSE_FAILED;
      state.tenders[1].failureReason = 'Permanent error';
      state.tenders[1].fetchAttempts = 2;
      state.currentTenderIndex = 2;
      state.processedCount = 2;
      state.successCount = 1;
      state.failedCount = 1;
      return saveBatchState(state);
    }).then(function() {
      var mockProc = createMockProcessor([{ fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(mockProc.getCallCount(), 1);
        assert.strictEqual(finalState.tenders[2].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });

  it('resumes with no tenders already processed', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1]], 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([{ fail: false }, { fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(mockProc.getCallCount(), 2);
      });
    });
  });

  it('resumes with all tenders already processed', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1]], 1);
    return createSavedBatch(normTenders).then(function(state) {
      state.tenders[0].downloadStatus = DOWNLOAD_STATUS_PARSED;
      state.tenders[0].fetchAttempts = 1;
      state.tenders[1].downloadStatus = DOWNLOAD_STATUS_PARSED;
      state.tenders[1].fetchAttempts = 1;
      state.currentTenderIndex = 2;
      state.processedCount = 2;
      state.successCount = 2;
      return saveBatchState(state);
    }).then(function() {
      var mockProc = createMockProcessor([]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(mockProc.getCallCount(), 0);
      });
    });
  });
});

// ---- 5. Full resume after interruption ----
describe('Phase 6D — Full resume after interruption', () => {
  beforeEach(function() { mockData = {}; forceResumeCleanup(); });

  it('simulates service worker restart and resumes from checkpoint', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1], RAW_TENDERS[2]], 1);
    return createSavedBatch(normTenders, { maxRetries: 1, baseDelayMs: 1 }).then(function(state) {
      // Simulate that tender 0 was processed before the restart
      state.tenders[0].downloadStatus = DOWNLOAD_STATUS_PARSED;
      state.tenders[0].fetchAttempts = 1;
      state.currentTenderIndex = 1;
      state.processedCount = 1;
      state.successCount = 1;
      state.batchStatus = BATCH_STATUS_PROCESSING;
      return saveBatchState(state);
    }).then(function() {
      // Resume after simulated restart
      forceResumeCleanup();
      var mockProc = createMockProcessor([{ fail: false }, { fail: false }]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 3);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(mockProc.getCallCount(), 2);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 1);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_PARSED);
        assert.strictEqual(finalState.tenders[1].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.strictEqual(finalState.tenders[2].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });

  it('resumes correctly after interruption during retry delay', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1]], 1);
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var firstTenderCalls = 0;
      var mockProc = function(tender) {
        if (tender.tenderId === '1001') {
          firstTenderCalls++;
          return Promise.reject(new Error('Will fail first ' + firstTenderCalls + ' times'));
        }
        var merged = JSON.parse(JSON.stringify(tender));
        merged.downloadStatus = DOWNLOAD_STATUS_PARSED;
        merged.fetchAttempts = 1;
        return Promise.resolve(merged);
      };

      return processBatch(mockProc).then(function() {
        assert.ok(firstTenderCalls >= 3);
      });
    });
  });

  it('no reprocessing of completed tenders after multiple resumes', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0], RAW_TENDERS[1], RAW_TENDERS[2]], 1);
    return createSavedBatch(normTenders).then(function(state) {
      state.tenders[0].downloadStatus = DOWNLOAD_STATUS_PARSED;
      state.tenders[0].fetchAttempts = 1;
      state.currentTenderIndex = 1;
      state.processedCount = 1;
      state.successCount = 1;
      return saveBatchState(state);
    }).then(function() {
      forceResumeCleanup();
      var mockProc1 = createMockProcessor([{ fail: false }, { fail: false }]);
      return processBatch(mockProc1);
    }).then(function() {
      var stored = mockData[BATCH_STORAGE_KEY];
      assert.strictEqual(stored.currentTenderIndex, 3);
      assert.strictEqual(stored.processedCount, 3);

      // Second resume should immediately complete
      forceResumeCleanup();
      var mockProc2 = createMockProcessor([]);
      return processBatch(mockProc2).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 3);
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(mockProc2.getCallCount(), 0);
      });
    });
  });
});

// ---- 6. Retry config ----
describe('Phase 6D — Retry configuration', () => {
  beforeEach(function() { mockData = {}; forceResumeCleanup(); });

  it('uses default retryConfig when none is set', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    var state = createBatchState(1, 'url', normTenders);
    assert.strictEqual(state.retryConfig.maxRetries, 1);
    assert.strictEqual(state.retryConfig.baseDelayMs, 2000);
  });

  it('persists custom retryConfig through save and restore', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    var state = createBatchState(1, 'url', normTenders);
    state.retryConfig.maxRetries = 5;
    state.retryConfig.baseDelayMs = 1000;
    return saveBatchState(state).then(function() {
      return getBatchState().then(function(loaded) {
        assert.strictEqual(loaded.retryConfig.maxRetries, 5);
        assert.strictEqual(loaded.retryConfig.baseDelayMs, 1000);
      });
    });
  });

  it('validates retryConfig in batch state', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    var state = createBatchState(1, 'url', normTenders);
    state.retryConfig = { maxRetries: 0, baseDelayMs: 2000 };
    return saveBatchState(state).then(function() {
      assert.fail('Should have rejected invalid retryConfig');
    }).catch(function(err) {
      assert.ok(err.message.indexOf('maxRetries') !== -1);
    });
  });

  it('uses custom maxRetries from state', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 5, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function() {
        callCount++;
        return Promise.reject(new Error('Always fails'));
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 5);
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_PARSE_FAILED);
        assert.strictEqual(callCount, 5);
      });
    });
  });
});

// ---- 7. Edge cases ----
describe('Phase 6D — Edge cases', () => {
  beforeEach(function() { mockData = {}; forceResumeCleanup(); });

  it('handles empty batch with retryConfig', function() {
    return createSavedBatch([], { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var mockProc = createMockProcessor([]);
      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.batchStatus, BATCH_STATUS_COMPLETED);
        assert.strictEqual(finalState.processedCount, 0);
      });
    });
  });

  it('single tender retries then succeeds', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function(tender) {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Try ' + callCount));
        }
        var merged = JSON.parse(JSON.stringify(tender));
        merged.downloadStatus = DOWNLOAD_STATUS_PARSED;
        merged.fetchAttempts = callCount;
        return Promise.resolve(merged);
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.successCount, 1);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 3);
        assert.strictEqual(callCount, 3);
      });
    });
  });

  it('single tender exhausts all retries', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 3, baseDelayMs: 1 }).then(function() {
      var callCount = 0;
      var mockProc = function() {
        callCount++;
        return Promise.reject(new Error('Permanent error'));
      };

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 3);
        assert.strictEqual(callCount, 3);
      });
    });
  });

  it('tender with fetchAttempts preserved from previous failed run', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);
    return createSavedBatch(normTenders, { maxRetries: 5, baseDelayMs: 1 }).then(function(state) {
      state.tenders[0].fetchAttempts = 2;
      return saveBatchState(state);
    }).then(function() {
      var callCount = 0;
      var mockProc = function(tender) {
        callCount++;
        return Promise.reject(new Error('Still failing'));
      };

      return processBatch(mockProc).then(function(finalState) {
        // fetchAttempts starts from 2, so we should have 3 more attempts (2+3=5 max)
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 5);
        assert.strictEqual(callCount, 3);
      });
    });
  });
});
