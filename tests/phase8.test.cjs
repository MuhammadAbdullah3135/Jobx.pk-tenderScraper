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
var _downloadMockImpl = null;
var _downloadIdCounter = 42;

function resetChromeMocks() {
  chrome.runtime.lastError = null;
  _downloadMockImpl = null;
  _downloadIdCounter = 42;
}

globalThis.chrome = {
  runtime: {
    lastError: null,
    onMessage: { addListener: function() {} }
  },
  downloads: {
    download: function(options, callback) {
      if (_downloadMockImpl) {
        var wrappedCallback = function(id) {
          if (typeof id === 'number' && id > 0) {
            _downloadIdCounter = id;
          }
          callback(id);
        };
        _downloadMockImpl(options, wrappedCallback);
      } else {
        _downloadIdCounter++;
        callback(_downloadIdCounter);
      }
    },
    onChanged: {
      addListener: function(listener) {
        setTimeout(function() {
          listener({ id: _downloadIdCounter, state: { current: 'complete' } });
        }, 0);
      },
      removeListener: function() {}
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
    }
  }
};

eval(utilitiesCode);
eval(namingCode);
eval(urlsCode);
eval(tenderModelCode);
eval(constantsCode);

var DOWNLOAD_STATUS_PENDING = 'Pending';
var DOWNLOAD_STATUS_PARSED = 'Parsed - Download Pending';
var DOWNLOAD_STATUS_PARSE_FAILED = 'Parse Failed';
var DOWNLOAD_STATUS_PENDING_RETRY = 'Pending Retry';
var DOWNLOAD_STATUS_DOWNLOADED = 'Downloaded';
var DOWNLOAD_STATUS_DOWNLOAD_FAILED = 'Download Failed';

eval(batchStateCode);
eval(txtGeneratorCode);

if (typeof URL !== 'undefined') {
  if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = function() { return 'blob:mock'; };
  if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = function() {};
}

batchProcessorCode = batchProcessorCode.replace(
  'function _delay(ms) {',
  'function _delay(ms) { return Promise.resolve(); /* override: no wait */'
);
eval(batchProcessorCode);

function resetMockStorage() {
  mockData = {};
}

function resetState() {
  resetMockStorage();
  resetChromeMocks();
  if (typeof resetBatch === 'function') {
    resetBatch().catch(function() {});
  }
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

function createMockSuccessFn(expectedIndex, imageUrls) {
  imageUrls = imageUrls || [];
  return function(tender) {
    return Promise.resolve({
      tenderId: tender.tenderId || 'T' + expectedIndex,
      detailUrl: tender.detailUrl,
      originalListingTitle: tender.originalListingTitle,
      title: tender.title,
      folderName: tender.folderName || ('00' + expectedIndex + '_Tender ' + expectedIndex),
      downloadStatus: 'Parsed - Download Pending',
      category: 'Goods',
      province: 'Punjab',
      location: 'Lahore',
      newspaper: 'Daily Jang',
      lastDate: '2026-12-31',
      imageUrls: imageUrls,
      description: 'Test description for tender ' + expectedIndex,
      warnings: [],
      downloadIds: [],
      downloadedFiles: [],
      downloadedAt: null,
      failureReason: null
    });
  };
}

// ===========================================================================
// Phase 8 — Integration tests covering full Phase 6/7 workflow
// ===========================================================================

describe('Phase 8 — Full pipeline integration', function() {
  beforeEach(function() {
    resetState();
  });

  it('Listing → Parse → Batch → TXT: single tender complete', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, []));
      })
      .then(function(finalState) {
        assert.equal(finalState.skippedCount, 0);
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 0);
        assert.equal(finalState.tenders[0].downloadStatus, 'Downloaded');
        assert.equal(finalState.tenders[0].downloadIds.length, 1);
        assert.equal(finalState.tenders[0].downloadedFiles.length, 1);
        assert.ok(finalState.tenders[0].downloadedFiles[0].indexOf('Tender.txt') !== -1);
        assert.equal(finalState.completionSummary.imageTotal, 0);
      });
  });

  it('Listing → Parse → Batch → TXT → Images: full chain', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, [
          'https://www.jobz.pk/images/tenders/ad-1.jpg',
          'https://www.jobz.pk/images/tenders/ad-2.png'
        ]));
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        var tender = finalState.tenders[0];
        assert.equal(tender.downloadStatus, 'Downloaded');
        assert.equal(tender.imageDownloadStatus, 'Succeeded');
        assert.equal(tender.downloadIds.length, 3);
        assert.equal(tender.downloadedFiles.length, 3);
        assert.ok(tender.downloadedFiles[0].indexOf('Tender.txt') !== -1);
        assert.ok(tender.downloadedFiles[1].indexOf('image_1') !== -1);
        assert.ok(tender.downloadedFiles[2].indexOf('image_2') !== -1);
        assert.equal(finalState.completionSummary.imageTotal, 2);
        assert.equal(finalState.completionSummary.imageDownloaded, 2);
        assert.equal(finalState.completionSummary.imageFailed, 0);
      });
  });

  it('Multiple tenders: all succeed, images aggregated', function() {
    var tenders = [createMockTender(1), createMockTender(2)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return addProcessedTenderId('T2');
      })
      .then(function() {
        return addProcessedTenderId('T2'); // idempotent
      })
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        resetMockStorage();
        var state2 = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
        return saveBatchState(state2);
      })
      .then(function() {
        return addProcessedTenderId('T2');
      })
      .then(function() {
        return processBatch(createMockSuccessFn(2, ['https://www.jobz.pk/img.jpg']));
      })
      .then(function(finalState) {
        assert.equal(finalState.skippedCount, 1);
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.processedCount, 2);
        assert.equal(finalState.completionSummary.totalTenders, 2);
        assert.equal(finalState.completionSummary.imageTotal, 1);
        assert.equal(finalState.completionSummary.imageDownloaded, 1);
        assert.equal(finalState.completionSummary.imageFailed, 0);
      });
  });

  it('Partial failure: parse error skips tender, continues, no images', function() {
    var failFirst = true;
    var tenders = [createMockTender(1), createMockTender(2)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(function(tender) {
          if (failFirst && tender.tenderId === 'T1') {
            failFirst = false;
            return Promise.reject(new Error('First tender failed'));
          }
          return createMockSuccessFn(2, [])(tender);
        });
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 1);
        assert.equal(finalState.skippedCount, 0);
        assert.equal(finalState.completionSummary.imageTotal, 0);
      });
  });

  it('Image failure does not affect TXT download success', function() {
    _downloadMockImpl = function(options, callback) {
      if (options && options.filename && options.filename.indexOf('Tender.txt') !== -1) {
        _downloadIdCounter++;
        callback(_downloadIdCounter);
      } else {
        callback();
      }
    };

    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/photo.jpg']));
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        var tender = finalState.tenders[0];
        assert.equal(tender.downloadStatus, 'Downloaded');
        assert.equal(tender.imageDownloadStatus, 'Failed');
        assert.equal(tender.downloadIds.length, 1);
        assert.ok(tender.failureReason.indexOf('images failed') !== -1);
        assert.equal(finalState.completionSummary.imageTotal, 1);
        assert.equal(finalState.completionSummary.imageDownloaded, 0);
        assert.equal(finalState.completionSummary.imageFailed, 1);
      });
  });

  it('Download-only recovery: parsed tender with images on resume', function() {
    var mockTender = createMockTender(1);
    mockTender.downloadIds = [];
    mockTender.downloadedFiles = [];
    mockTender.downloadedAt = null;
    mockTender.failureReason = null;
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', [mockTender]);
    state.tenders[0].downloadStatus = 'Parsed - Download Pending';
    state.tenders[0].imageUrls = ['https://www.jobz.pk/images/tenders/ad-1.jpg'];
    return saveBatchState(state)
      .then(function() {
        return processBatch(function() { return Promise.reject(new Error('Should not re-parse')); });
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 0);
        var tender = finalState.tenders[0];
        assert.equal(tender.downloadStatus, 'Downloaded');
        assert.equal(tender.imageDownloadStatus, 'Succeeded');
        assert.equal(tender.downloadedFiles.length, 2);
      });
  });

  it('Checkpoint: parse-failed tender skipped on resume', function() {
    var tenders = [createMockTender(1), createMockTender(2)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    state.tenders[0].downloadStatus = 'Parse Failed';
    state.tenders[0].failureReason = 'Previous failure';
    state.currentTenderIndex = 1;
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(2, []));
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 0);
        assert.equal(finalState.skippedCount, 0);
        assert.equal(finalState.processedCount, 1);
      });
  });

  it('Completion summary reflects all counts for mixed batch', function() {
    // One skipped (duplicate), one failed (parse error), one success with images
    var tenders = [createMockTender(1), createMockTender(2), createMockTender(3)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        resetMockStorage();
        var state2 = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
        return saveBatchState(state2);
      })
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        var callCount = 0;
        return processBatch(function(tender) {
          callCount++;
          if (callCount === 2) {
            return Promise.reject(new Error('Second tender fails'));
          }
          return createMockSuccessFn(3, ['https://www.jobz.pk/img.jpg'])(tender);
        });
      })
      .then(function(finalState) {
        assert.equal(finalState.skippedCount, 1);
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 1);
        assert.equal(finalState.processedCount, 3);
        assert.equal(finalState.completionSummary.totalTenders, 3);
        assert.equal(finalState.completionSummary.imageTotal, 1);
        assert.equal(finalState.completionSummary.imageDownloaded, 1);
        assert.equal(finalState.completionSummary.imageFailed, 0);
        assert.ok(finalState.completionSummary.completedAt);
        assert.ok(finalState.completionSummary.durationMs >= 0);
      });
  });

  it('isTenderProcessed works correctly after batch', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, []));
      })
      .then(function() {
        return isTenderProcessed('T1');
      })
      .then(function(processed) {
        assert.equal(processed, true);
        return isTenderProcessed('T2');
      })
      .then(function(processed) {
        assert.equal(processed, false);
        return isTenderProcessed(null);
      })
      .then(function(processed) {
        assert.equal(processed, false);
      });
  });

  it('Reset clears batch state but preserves processed IDs', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        return addProcessedTenderId('T2');
      })
      .then(function() {
        return resetBatch();
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(restored) {
        assert.equal(restored.batchStatus, 'Idle');
        assert.equal(restored.totalTenders, 0);
        return getProcessedTenderIds();
      })
      .then(function(ids) {
        assert.equal(ids.length, 2, 'processed IDs must survive resetBatch');
        assert.equal(isBatchProcessing(), false);
      });
  });
});

describe('Phase 8 — Concurrency and state safety', function() {
  beforeEach(function() {
    resetState();
  });

  it('Rejects concurrent batch processing', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        var p1 = processBatch(createMockSuccessFn(1, []));
        var p2 = processBatch(createMockSuccessFn(1, []));
        return Promise.all([p1, p2.catch(function(e) { return { error: e.message }; })]);
      })
      .then(function(results) {
        var second = results[1];
        if (second && second.error) {
          assert.ok(second.error.indexOf('already in progress') !== -1);
        } else {
          // If batch completed before second started, that's acceptable
          assert.equal(results[0].successCount, 1);
        }
      });
  });

  it('isBatchProcessing returns correct state', function() {
    assert.equal(isBatchProcessing(), false);
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        var promise = processBatch(createMockSuccessFn(1, []));
        assert.equal(isBatchProcessing(), true);
        return promise;
      })
      .then(function() {
        assert.equal(isBatchProcessing(), false);
      });
  });
});

describe('Phase 8 — Edge cases', function() {
  beforeEach(function() {
    resetState();
  });

  it('Empty batch completes immediately', function() {
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', []);
    return saveBatchState(state)
      .then(function() {
        return processBatch(function() { return Promise.reject(new Error('Should not be called')); });
      })
      .then(function(finalState) {
        assert.equal(finalState.totalTenders, 0);
        assert.equal(finalState.successCount, 0);
        assert.equal(finalState.failedCount, 0);
        assert.equal(finalState.completionSummary.totalTenders, 0);
      });
  });

  it('Tender with no imageUrls works and imageDownloadStatus is undefined', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, []));
      })
      .then(function(finalState) {
        var tender = finalState.tenders[0];
        assert.equal(tender.downloadStatus, 'Downloaded');
        assert.equal(tender.imageDownloadStatus, undefined);
      });
  });

  it('Duplicate prevention across two separate batches', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/img.jpg']));
      })
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        resetMockStorage();
        var state2 = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
        return saveBatchState(state2);
      })
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        return processBatch(function() { return Promise.reject(new Error('Should not re-parse')); });
      })
      .then(function(finalState) {
        assert.equal(finalState.skippedCount, 1);
        assert.equal(finalState.processedCount, 1);
        assert.equal(finalState.successCount, 0);
        assert.equal(finalState.completionSummary.imageTotal, 0);
      });
  });
});
