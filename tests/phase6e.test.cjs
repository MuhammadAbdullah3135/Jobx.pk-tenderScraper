var { describe, it, beforeEach } = require('node:test');
var assert = require('node:assert/strict');
var { readFileSync } = require('fs');
var { join } = require('path');

var base = join(__dirname, '..');

var utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
var namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
var urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
var tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');
var constantsCode = readFileSync(join(base, 'src/shared/constants.js'), 'utf-8');
var batchStateCode = readFileSync(join(base, 'src/shared/batch-state.js'), 'utf-8');
var txtGeneratorCode = readFileSync(join(base, 'src/shared/txt-generator.js'), 'utf-8');
var batchProcessorCode = readFileSync(join(base, 'src/shared/batch-processor.js'), 'utf-8');

var mockData = {};
var onChangedListeners = [];

globalThis.chrome = {
  runtime: {
    lastError: null,
    onMessage: { addListener: function() {} }
  },
  downloads: {
    download: function(options, callback) {
      callback(42);
    }
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
      addListener: function(listener) {
        onChangedListeners.push(listener);
      }
    }
  }
};

eval(utilitiesCode);
eval(namingCode);
eval(urlsCode);
eval(tenderModelCode);
eval(constantsCode);
// Re-export const values as vars so they survive eval scope boundaries
var DOWNLOAD_STATUS_PENDING = 'Pending';
var DOWNLOAD_STATUS_PARSED = 'Parsed - Download Pending';
var DOWNLOAD_STATUS_PARSE_FAILED = 'Parse Failed';
var DOWNLOAD_STATUS_PENDING_RETRY = 'Pending Retry';
var DOWNLOAD_STATUS_DOWNLOADED = 'Downloaded';
var DOWNLOAD_STATUS_DOWNLOAD_FAILED = 'Download Failed';
var PROCESS_BATCH = 'PROCESS_BATCH';
var RESET_BATCH = 'RESET_BATCH';
eval(batchStateCode);
eval(txtGeneratorCode);

// Mock browser APIs not available in Node.js
if (typeof URL !== 'undefined') {
  if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = function() { return 'blob:mock'; };
  if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = function() {};
}
// Patch _delay to resolve immediately for fast tests
batchProcessorCode = batchProcessorCode.replace(
  'function _delay(ms) {',
  'function _delay(ms) { return Promise.resolve(); /* ' + 'override: no wait */'
);
eval(batchProcessorCode);

function resetMockStorage() {
  mockData = {};
  onChangedListeners = [];
}

function createMockTender(index) {
  return {
    tenderId: 'T' + index,
    detailUrl: 'https://www.jobz.pk/tender-' + index,
    originalListingTitle: 'Tender ' + index,
    title: 'Tender ' + index,
    downloadStatus: 'Pending'
  };
}

function createMockSuccessFn(expectedIndex) {
  return function(tender) {
    return Promise.resolve({
      tenderId: tender.tenderId || 'T' + expectedIndex,
      detailUrl: tender.detailUrl,
      originalListingTitle: tender.originalListingTitle,
      title: tender.title,
      downloadStatus: DOWNLOAD_STATUS_PARSED,
      category: 'Test',
      province: 'Test',
      location: 'Test City',
      newspaper: 'Test News',
      lastDate: '2026-12-31',
      imageUrls: [],
      description: 'Test description',
      warnings: []
    });
  };
}

function createMockFailFn(message) {
  return function() {
    return Promise.reject(new Error(message || 'Test failure'));
  };
}

describe('Phase 6E — Duplicate prevention', function() {
  beforeEach(function() {
    resetMockStorage();
    // Clear in-memory flag so each test starts fresh
    if (typeof resetBatch === 'function') {
      resetBatch().catch(function() {});
    }
  });

  it('adds processed tender ID to persistent storage after success', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function() {
        return getProcessedTenderIds();
      })
      .then(function(ids) {
        assert.ok(Array.isArray(ids));
        assert.equal(ids.length, 1);
        assert.equal(ids[0], 'T1');
      });
  });

  it('skips tender whose ID is already in processed storage', function() {
    var tenders = [createMockTender(1), createMockTender(2)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function() {
        // Add T1 to processed IDs
        return addProcessedTenderId('T1');
      })
      .then(function() {
        // Create a new batch with T1 and T2
        resetMockStorage();
        mockData = {};
        var tenders2 = [createMockTender(1), createMockTender(2)];
        var state2 = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders2);
        return saveBatchState(state2);
      })
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        return processBatch(createMockSuccessFn(2));
      })
      .then(function(finalState) {
        assert.equal(finalState.skippedCount, 1);
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.processedCount, 2);
      });
  });

  it('does not skip tenders without a tenderId', function() {
    var tender = createMockTender(1);
    delete tender.tenderId;
    var tenders = [tender];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(function(t) {
          return Promise.resolve({
            tenderId: 'generated-id',
            detailUrl: t.detailUrl,
            originalListingTitle: t.originalListingTitle,
            title: 'Test',
            downloadStatus: DOWNLOAD_STATUS_PARSED
          });
        });
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.skippedCount, 0);
      });
  });

  it('stores multiple tender IDs across a batch', function() {
    var tenders = [createMockTender(1), createMockTender(2), createMockTender(3)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    var callCount = 0;
    return saveBatchState(state)
      .then(function() {
        return processBatch(function(tender) {
          callCount++;
          return Promise.resolve({
            tenderId: 'T' + callCount,
            detailUrl: tender.detailUrl,
            originalListingTitle: tender.originalListingTitle,
            title: tender.title,
            downloadStatus: DOWNLOAD_STATUS_PARSED
          });
        });
      })
      .then(function() {
        return getProcessedTenderIds();
      })
      .then(function(ids) {
        assert.equal(ids.length, 3);
        assert.ok(ids.indexOf('T1') !== -1);
        assert.ok(ids.indexOf('T2') !== -1);
        assert.ok(ids.indexOf('T3') !== -1);
      });
  });
});

describe('Phase 6E — Completion summary', function() {
  beforeEach(function() {
    resetMockStorage();
    if (typeof resetBatch === 'function') {
      resetBatch().catch(function() {});
    }
  });

  it('populates completionSummary on batch completion', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function(finalState) {
        assert.ok(finalState.completionSummary !== null && typeof finalState.completionSummary === 'object');
        assert.equal(finalState.completionSummary.totalTenders, 1);
        assert.equal(finalState.completionSummary.successCount, 1);
        assert.equal(finalState.completionSummary.failedCount, 0);
        assert.equal(finalState.completionSummary.skippedCount, 0);
        assert.equal(typeof finalState.completionSummary.completedAt, 'string');
        assert.ok(finalState.completionSummary.durationMs >= 0);
      });
  });

  it('includes failures and skips in completionSummary', function() {
    var tenders = [createMockTender(1), createMockTender(2)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        return processBatch(function(tender) {
          if (tender.tenderId === 'T2') {
            return Promise.reject(new Error('Process failure'));
          }
          return createMockSuccessFn(1)(tender);
        });
      })
      .then(function(finalState) {
        assert.equal(finalState.completionSummary.totalTenders, 2);
        assert.equal(finalState.completionSummary.successCount, 0);
        assert.equal(finalState.completionSummary.failedCount, 1);
        assert.equal(finalState.completionSummary.skippedCount, 1);
      });
  });

  it('completionSummary reflects duration accurately', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function(finalState) {
        assert.ok(finalState.completionSummary.durationMs >= 0);
        assert.ok(finalState.completionSummary.durationMs < 5000);
      });
  });

  it('zero tenders produces completionSummary immediately', function() {
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', []);
    return saveBatchState(state)
      .then(function() {
        return processBatch(function() { return Promise.resolve({}); });
      })
      .then(function(finalState) {
        assert.ok(finalState.completionSummary !== null);
        assert.equal(finalState.completionSummary.totalTenders, 0);
        assert.equal(finalState.completionSummary.successCount, 0);
        assert.ok(finalState.completionSummary.durationMs >= 0);
      });
  });
});

describe('Phase 6E — Batch reset', function() {
  beforeEach(function() {
    resetMockStorage();
    if (typeof resetBatch === 'function') {
      resetBatch().catch(function() {});
    }
  });

  it('clears batch state from storage', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return getBatchState();
      })
      .then(function(saved) {
        assert.equal(saved.batchStatus, BATCH_STATUS_IDLE);
      })
      .then(function() {
        return resetBatch();
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(cleared) {
        assert.equal(cleared.batchStatus, BATCH_STATUS_IDLE);
        assert.equal(cleared.totalTenders, 0);
      });
  });

  it('clears processed tender IDs', function() {
    return addProcessedTenderId('T1')
      .then(function() {
        return addProcessedTenderId('T2');
      })
      .then(function() {
        return getProcessedTenderIds();
      })
      .then(function(ids) {
        assert.equal(ids.length, 2);
      })
      .then(function() {
        return resetBatch();
      })
      .then(function() {
        return getProcessedTenderIds();
      })
      .then(function(ids) {
        assert.equal(ids.length, 0);
      });
  });

  it('allows new batch to start after reset', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function() {
        return resetBatch();
      })
      .then(function() {
        var tenders2 = [createMockTender(2)];
        var state2 = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders2);
        return saveBatchState(state2);
      })
      .then(function() {
        return processBatch(createMockSuccessFn(2));
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.skippedCount, 0);
      });
  });

  it('isBatchProcessing returns false after reset', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function() {
        return resetBatch();
      })
      .then(function() {
        assert.equal(isBatchProcessing(), false);
      });
  });
});

describe('Phase 6E — State cleanup', function() {
  beforeEach(function() {
    resetMockStorage();
    if (typeof resetBatch === 'function') {
      resetBatch().catch(function() {});
    }
  });

  it('clears _batchProcessingInProgress after completion', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function() {
        assert.equal(isBatchProcessing(), false);
      });
  });

  it('persists completed state in storage after batch finishes', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        assert.equal(persisted.batchStatus, BATCH_STATUS_COMPLETED);
        assert.equal(persisted.successCount, 1);
      });
  });

  it('reset clears both batch state and processed IDs', function() {
    var tenders = [createMockTender(1), createMockTender(2)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1));
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        assert.equal(persisted.batchStatus, BATCH_STATUS_COMPLETED);
        return getProcessedTenderIds();
      })
      .then(function(ids) {
        assert.equal(ids.length, 2);
      })
      .then(function() {
        return resetBatch();
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(clearedState) {
        assert.equal(clearedState.batchStatus, BATCH_STATUS_IDLE);
        return getProcessedTenderIds();
      })
      .then(function(clearedIds) {
        assert.equal(clearedIds.length, 0);
      });
  });
});
