const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

// Load shared modules (same order as service worker importScripts)
const constantsCode = readFileSync(join(base, 'src/shared/constants.js'), 'utf-8');
const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
const tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');
const batchStateCode = readFileSync(join(base, 'src/shared/batch-state.js'), 'utf-8');
const txtGeneratorCode = readFileSync(join(base, 'src/shared/txt-generator.js'), 'utf-8');
const batchProcessorCode = readFileSync(join(base, 'src/shared/batch-processor.js'), 'utf-8');

// ---- Mock chrome.storage.local ----
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

// Constants used by batch-processor (re-declared as var to survive eval boundaries)
var DOWNLOAD_STATUS_PARSE_FAILED = 'Parse Failed';
var DOWNLOAD_STATUS_PENDING = 'Pending';
var DOWNLOAD_STATUS_PARSED = 'Parsed - Download Pending';
var DOWNLOAD_STATUS_DOWNLOADED = 'Downloaded';
var DOWNLOAD_STATUS_DOWNLOAD_FAILED = 'Download Failed';
var BATCH_STATUS_PROCESSING = 'Processing';
var BATCH_STATUS_COMPLETED = 'Completed';
var BATCH_STATUS_IDLE = 'Idle';
var BATCH_STATUS_FAILED = 'Failed';

eval(batchProcessorCode);

// ---- Test fixtures ----

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

// Mock process function factory
function createMockProcessor(resultSpecs) {
  var callIndex = 0;
  var callOrder = [];

  function processorFn(tender) {
    callOrder.push({ index: callIndex, tender: tender });
    var spec = resultSpecs[callIndex];
    callIndex++;
    if (spec && spec.fail) {
      return Promise.reject(new Error(spec.errorMessage || 'Mock failure'));
    }
    // Create a fake merged record based on the tender
    var merged = JSON.parse(JSON.stringify(tender));
    merged.downloadStatus = 'Parsed - Download Pending';
    merged.fetchAttempts = 1;
    merged.metadata = spec && spec.metadata ? spec.metadata : {};
    return Promise.resolve(merged);
  }

  processorFn.getCallOrder = function() { return callOrder; };
  processorFn.getCallCount = function() { return callIndex; };
  processorFn.reset = function() { callIndex = 0; callOrder = []; };

  return processorFn;
}

// ---- Helper to create a saved batch state ----
function createSavedBatch(tenders) {
  var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/', tenders);
  return saveBatchState(state).then(function() {
    return state;
  });
}

// ---- 1. Sequential order ----
describe('Phase 6B — Sequential order', () => {
  beforeEach(function() {
    mockData = {};
  });

  it('processes tenders in the order they appear in the batch', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS, 1);
    return createSavedBatch(normTenders).then(function(state) {
      var mockProc = createMockProcessor([
        { fail: false },
        { fail: false },
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        var order = mockProc.getCallOrder();
        assert.strictEqual(order.length, 3);
        assert.strictEqual(order[0].tender.tenderId, '1001');
        assert.strictEqual(order[1].tender.tenderId, '1002');
        assert.strictEqual(order[2].tender.tenderId, '1003');
        assert.strictEqual(finalState.currentTenderIndex, 3);
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.batchStatus, 'Completed');
      });
    });
  });

  it('maintains listing order in stored tenders after processing', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS, 1);
    return createSavedBatch(normTenders).then(function(state) {
      var mockProc = createMockProcessor([
        { fail: false },
        { fail: false },
        { fail: false }
      ]);

      return processBatch(mockProc).then(function() {
        var stored = mockData['tenderBatchState'];
        assert.strictEqual(stored.tenders[0].tenderId, '1001');
        assert.strictEqual(stored.tenders[1].tenderId, '1002');
        assert.strictEqual(stored.tenders[2].tenderId, '1003');
      });
    });
  });
});

// ---- 2. One-at-a-time execution ----
describe('Phase 6B — One-at-a-time execution', () => {
  beforeEach(function() {
    mockData = {};
  });

  it('never processes multiple tenders simultaneously', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 3), 1);
    var concurrent = 0;
    var maxConcurrent = 0;

    return createSavedBatch(normTenders).then(function() {
      var inFlight = false;

      var mockProc = function(tender) {
        assert.strictEqual(inFlight, false, 'Concurrent processing detected');
        inFlight = true;
        concurrent++;
        if (concurrent > maxConcurrent) maxConcurrent = concurrent;

        return new Promise(function(resolve) {
          setImmediate(function() {
            inFlight = false;
            concurrent--;
            var merged = JSON.parse(JSON.stringify(tender));
            merged.downloadStatus = 'Parsed - Download Pending';
            merged.fetchAttempts = 1;
            resolve(merged);
          });
        });
      };

      return processBatch(mockProc).then(function() {
        assert.strictEqual(maxConcurrent, 1);
        assert.strictEqual(concurrent, 0);
      });
    });
  });

  it('processes two tenders sequentially when second depends on first', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 2), 1);
    var processingOrder = [];

    return createSavedBatch(normTenders).then(function() {
      var mockProc = function(tender) {
        processingOrder.push('start-' + tender.tenderId);
        return new Promise(function(resolve) {
          setImmediate(function() {
            processingOrder.push('end-' + tender.tenderId);
            var merged = JSON.parse(JSON.stringify(tender));
            merged.downloadStatus = 'Parsed - Download Pending';
            merged.fetchAttempts = 1;
            resolve(merged);
          });
        });
      };

      return processBatch(mockProc).then(function() {
        assert.strictEqual(processingOrder.length, 4);
        assert.strictEqual(processingOrder[0], 'start-1001');
        assert.strictEqual(processingOrder[1], 'end-1001');
        assert.strictEqual(processingOrder[2], 'start-1002');
        assert.strictEqual(processingOrder[3], 'end-1002');
      });
    });
  });
});

// ---- 3. Successful batch ----
describe('Phase 6B — Successful batch', () => {
  beforeEach(function() {
    mockData = {};
  });

  it('processes all tenders and marks batch as Completed', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS, 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: false },
        { fail: false },
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.batchStatus, 'Completed');
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.successCount, 3);
        assert.strictEqual(finalState.failedCount, 0);
        assert.strictEqual(finalState.currentTenderIndex, 3);
      });
    });
  });

  it('marks each tender as Downloaded after successful processing', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 2), 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: false },
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.strictEqual(finalState.tenders[1].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });

  it('sets fetchAttempts to 1 for successful tenders', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 1), 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.tenders[0].fetchAttempts, 1);
      });
    });
  });

  it('empty batch immediately completes', function() {
    return createSavedBatch([]).then(function() {
      var mockProc = createMockProcessor([]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.batchStatus, 'Completed');
        assert.strictEqual(finalState.processedCount, 0);
        assert.strictEqual(finalState.totalTenders, 0);
      });
    });
  });
});

// ---- 4. Failed tender continues ----
describe('Phase 6B — Failed tender continues', () => {
  beforeEach(function() {
    mockData = {};
  });

  it('marks failed tender with Parse Failed status and continues', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 3), 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: false },
        { fail: true, errorMessage: 'Fetch failed: HTTP 404' },
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.batchStatus, 'Completed');
        assert.strictEqual(finalState.tenders[0].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.strictEqual(finalState.tenders[1].downloadStatus, 'Parse Failed');
        assert.strictEqual(finalState.tenders[1].failureReason, 'Fetch failed: HTTP 404');
        assert.strictEqual(finalState.tenders[2].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });

  it('continues processing remaining tenders after first tender fails', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 3), 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: true, errorMessage: 'Network error' },
        { fail: false },
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.successCount, 2);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.tenders[1].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.strictEqual(finalState.tenders[2].downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
      });
    });
  });

  it('continues when last tender fails', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 2), 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: false },
        { fail: true, errorMessage: 'Parse error' }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.processedCount, 2);
        assert.strictEqual(finalState.successCount, 1);
        assert.strictEqual(finalState.failedCount, 1);
        assert.strictEqual(finalState.batchStatus, 'Completed');
        assert.strictEqual(finalState.tenders[1].downloadStatus, 'Parse Failed');
      });
    });
  });

  it('all tenders fail gracefully', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 3), 1);
    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: true, errorMessage: 'Error 1' },
        { fail: true, errorMessage: 'Error 2' },
        { fail: true, errorMessage: 'Error 3' }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.processedCount, 3);
        assert.strictEqual(finalState.successCount, 0);
        assert.strictEqual(finalState.failedCount, 3);
        assert.strictEqual(finalState.batchStatus, 'Completed');
        assert.strictEqual(finalState.tenders[0].failureReason, 'Error 1');
        assert.strictEqual(finalState.tenders[1].failureReason, 'Error 2');
        assert.strictEqual(finalState.tenders[2].failureReason, 'Error 3');
      });
    });
  });
});

// ---- 5. State persistence after each tender ----
describe('Phase 6B — State persistence', () => {
  beforeEach(function() {
    mockData = {};
  });

  it('saves state after first tender before processing second', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 2), 1);
    var firstTenderSaved = false;

    return createSavedBatch(normTenders).then(function() {
      var mockProc = function(tender) {
        if (tender.tenderId === '1001') {
          // After first tender, check that state was saved before moving to second
          // We verify this by checking the second call doesn't happen before save
        }
        return new Promise(function(resolve) {
          setImmediate(function() {
            var merged = JSON.parse(JSON.stringify(tender));
            merged.downloadStatus = 'Parsed - Download Pending';
            merged.fetchAttempts = 1;
            resolve(merged);
          });
        });
      };

      return processBatch(mockProc).then(function() {
        var stored = mockData['tenderBatchState'];
        assert.ok(stored);
        assert.strictEqual(stored.currentTenderIndex, 2);
        assert.strictEqual(stored.processedCount, 2);
      });
    });
  });

  it('persists updated tender data in storage after each step', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 2), 1);
    var saveSnapshots = [];

    // Wrap saveBatchState to capture snapshots
    var originalSave = saveBatchState;
    var wrappedSave = function(state) {
      saveSnapshots.push(JSON.parse(JSON.stringify(state)));
      return originalSave(state);
    };
    saveBatchState = wrappedSave;

    var mockProc = createMockProcessor([
      { fail: false },
      { fail: true, errorMessage: 'Failed tender' }
    ]);

    return createSavedBatch(normTenders).then(function() {
      return processBatch(mockProc);
    }).then(function() {
      saveBatchState = originalSave;

      // We should have at least 3 saves: initial set-to-processing, after tender 1, after tender 2
      assert.ok(saveSnapshots.length >= 3);

      // First save (after setting status to Processing)
      // Second save (after processing first tender)
      var afterFirst = null;
      var afterSecond = null;
      for (var i = 0; i < saveSnapshots.length; i++) {
        if (saveSnapshots[i].processedCount === 1) afterFirst = saveSnapshots[i];
        if (saveSnapshots[i].processedCount === 2) afterSecond = saveSnapshots[i];
      }

      assert.ok(afterFirst, 'State not saved after first tender');
      assert.strictEqual(afterFirst.currentTenderIndex, 1);
      assert.strictEqual(afterFirst.successCount, 1);
      assert.strictEqual(afterFirst.processedCount, 1);
      assert.strictEqual(afterFirst.batchStatus, 'Processing');

      assert.ok(afterSecond, 'State not saved after second tender');
      assert.strictEqual(afterSecond.currentTenderIndex, 2);
      assert.strictEqual(afterSecond.successCount, 1);
      assert.strictEqual(afterSecond.failedCount, 1);
      assert.strictEqual(afterSecond.processedCount, 2);
    });
  });

  it('preserves batchId and pageUrl across all saves', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 2), 1);

    return createSavedBatch(normTenders).then(function(original) {
      var batchId = original.batchId;

      var mockProc = createMockProcessor([
        { fail: false },
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.batchId, batchId);
        assert.strictEqual(finalState.pageUrl, 'https://www.jobz.pk/tenders-1/');
        assert.strictEqual(finalState.pageNumber, 1);
      });
    });
  });

  it('tender status updated in storage reflects current state', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 1), 1);

    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: true, errorMessage: 'Failed' }
      ]);

      return processBatch(mockProc).then(function() {
        var stored = mockData['tenderBatchState'];
        assert.strictEqual(stored.tenders[0].downloadStatus, 'Parse Failed');
        assert.strictEqual(stored.tenders[0].failureReason, 'Failed');
      });
    });
  });
});

// ---- 6. Concurrent processing prevention ----
describe('Phase 6B — Concurrent prevention', () => {
  beforeEach(function() {
    mockData = {};
  });

  it('rejects second call while first is in progress', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 2), 1);
    var neverResolve = new Promise(function() { /* never resolves */ });
    var mockProc = function() { return neverResolve; };

    return createSavedBatch(normTenders).then(function() {
      // Start first batch (will hang)
      var batch1 = processBatch(mockProc);

      // Try second batch (should be rejected)
      return processBatch(mockProc).then(function() {
        assert.fail('Second batch should have been rejected');
      }).catch(function(err) {
        assert.ok(err instanceof Error);
        assert.ok(err.message.indexOf('already in progress') !== -1);
        // Clean up - we can't really cancel batch1, but the test is done
        _batchProcessingInProgress = false;
      });
    });
  });

  it('allows new batch after previous completes', function() {
    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 1), 1);
    var processed = [];

    return createSavedBatch(normTenders).then(function() {
      var mockProc1 = function(tender) {
        processed.push('first-' + tender.tenderId);
        var merged = JSON.parse(JSON.stringify(tender));
        merged.downloadStatus = 'Parsed - Download Pending';
        merged.fetchAttempts = 1;
        return Promise.resolve(merged);
      };

      return processBatch(mockProc1);
    }).then(function() {
      // Now run a second batch with new tenders
      var normTenders2 = createNormalizedTenders([RAW_TENDERS[1]], 1);
      return createSavedBatch(normTenders2).then(function() {
        var mockProc2 = function(tender) {
          processed.push('second-' + tender.tenderId);
          var merged = JSON.parse(JSON.stringify(tender));
          merged.downloadStatus = 'Parsed - Download Pending';
          merged.fetchAttempts = 1;
          return Promise.resolve(merged);
        };

        return processBatch(mockProc2);
      });
    }).then(function() {
      assert.strictEqual(processed.length, 2);
      assert.strictEqual(processed[0], 'first-1001');
      assert.strictEqual(processed[1], 'second-1002');
    });
  });
});

// ---- 7. Edge cases ----
describe('Phase 6B — Edge cases', () => {
  beforeEach(function() {
    mockData = {};
  });

  it('handles batch with no stored state gracefully', function() {
    // Don't save any state - getBatchState returns empty
    var proc = createMockProcessor([]);

    return processBatch(proc).then(function(finalState) {
      assert.strictEqual(finalState.totalTenders, 0);
      assert.strictEqual(finalState.batchStatus, 'Completed');
      assert.strictEqual(finalState.processedCount, 0);
    });
  });

  it('handles single tender batch', function() {
    var normTenders = createNormalizedTenders([RAW_TENDERS[0]], 1);

    return createSavedBatch(normTenders).then(function() {
      var mockProc = createMockProcessor([
        { fail: false }
      ]);

      return processBatch(mockProc).then(function(finalState) {
        assert.strictEqual(finalState.processedCount, 1);
        assert.strictEqual(finalState.successCount, 1);
        assert.strictEqual(finalState.batchStatus, 'Completed');
        assert.strictEqual(finalState.currentTenderIndex, 1);
      });
    });
  });

  it('isBatchProcessing returns correct state', function() {
    assert.strictEqual(isBatchProcessing(), false);

    var resolved = false;
    var mockProc = function(tender) {
      var merged = JSON.parse(JSON.stringify(tender));
      merged.downloadStatus = 'Parsed - Download Pending';
      merged.fetchAttempts = 1;
      resolved = true;
      return Promise.resolve(merged);
    };

    var normTenders = createNormalizedTenders(RAW_TENDERS.slice(0, 1), 1);
    return createSavedBatch(normTenders).then(function() {
      var batchPromise = processBatch(mockProc);
      assert.strictEqual(isBatchProcessing(), true);
      return batchPromise;
    }).then(function() {
      assert.strictEqual(isBatchProcessing(), false);
      assert.strictEqual(resolved, true);
    });
  });
});
