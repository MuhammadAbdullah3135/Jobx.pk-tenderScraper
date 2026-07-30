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
var IMAGE_DOWNLOAD_STATUS_PENDING = 'Pending';
var IMAGE_DOWNLOAD_STATUS_DOWNLOADING = 'Downloading';
var IMAGE_DOWNLOAD_STATUS_SUCCEEDED = 'Succeeded';
var IMAGE_DOWNLOAD_STATUS_FAILED = 'Failed';
var PROCESS_BATCH = 'PROCESS_BATCH';
var RESET_BATCH = 'RESET_BATCH';

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
      downloadStatus: DOWNLOAD_STATUS_PARSED,
      category: 'Test',
      province: 'Test',
      location: 'Test City',
      newspaper: 'Test News',
      lastDate: '2026-12-31',
      imageUrls: imageUrls,
      description: 'Test description',
      warnings: [],
      downloadIds: [],
      downloadedFiles: [],
      downloadedAt: null,
      failureReason: null
    });
  };
}

function createMockFailFn(message) {
  return function() {
    return Promise.reject(new Error(message || 'Test failure'));
  };
}

// ---- Phase 7B: Image download core helpers ----
function resetState() {
  resetMockStorage();
  resetChromeMocks();
  if (typeof resetBatch === 'function') {
    resetBatch().catch(function() {});
  }
}

describe('Phase 7B — Image download helper: _getImageExtension', function() {
  it('returns .jpg for jpg URL', function() {
    assert.equal(_getImageExtension('https://example.com/image.jpg'), '.jpg');
  });

  it('returns .jpeg for jpeg URL', function() {
    assert.equal(_getImageExtension('https://example.com/image.jpeg'), '.jpeg');
  });

  it('returns .png for png URL', function() {
    assert.equal(_getImageExtension('https://example.com/image.png'), '.png');
  });

  it('returns .gif for gif URL', function() {
    assert.equal(_getImageExtension('https://example.com/image.gif'), '.gif');
  });

  it('returns .webp for webp URL', function() {
    assert.equal(_getImageExtension('https://example.com/image.webp'), '.webp');
  });

  it('returns .jpg for URL without extension', function() {
    assert.equal(_getImageExtension('https://example.com/image'), '.jpg');
  });

  it('returns .jpg for URL with query string but no extension', function() {
    assert.equal(_getImageExtension('https://example.com/image?w=200'), '.jpg');
  });

  it('extracts extension before query string', function() {
    assert.equal(_getImageExtension('https://example.com/photo.png?w=800&h=600'), '.png');
  });

  it('extracts extension before hash fragment', function() {
    assert.equal(_getImageExtension('https://example.com/banner.jpg#section'), '.jpg');
  });

  it('returns .jpg for null input', function() {
    assert.equal(_getImageExtension(null), '.jpg');
  });

  it('returns .jpg for undefined input', function() {
    assert.equal(_getImageExtension(undefined), '.jpg');
  });
});

describe('Phase 7B — Image download: no images scenario', function() {
  beforeEach(function() {
    resetState();
  });

  it('processes tender with no imageUrls successfully', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, []));
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 0);
        assert.equal(finalState.completionSummary.imageTotal, 0);
        assert.equal(finalState.completionSummary.imageDownloaded, 0);
        assert.equal(finalState.completionSummary.imageFailed, 0);
      });
  });

  it('tender with empty imageUrls has imageDownloadStatus undefined', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, []));
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        var tender = persisted.tenders[0];
        assert.equal(tender.downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.equal(tender.imageDownloadStatus, undefined);
      });
  });
});

describe('Phase 7B — Image download: single image', function() {
  beforeEach(function() {
    resetState();
  });

  it('downloads image for a tender with one image URL', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/photo.jpg']));
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        var tender = persisted.tenders[0];
        assert.equal(tender.downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.equal(tender.imageDownloadStatus, IMAGE_DOWNLOAD_STATUS_SUCCEEDED);
        assert.equal(tender.downloadedFiles.length, 2);
        assert.ok(tender.downloadedFiles[0].indexOf('Tender.txt') !== -1);
        assert.ok(tender.downloadedFiles[1].indexOf('image_1') !== -1);
        assert.equal(tender.downloadIds.length, 2);
      });
  });

  it('records image in completionSummary', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/photo.jpg']));
      })
      .then(function(finalState) {
        assert.equal(finalState.completionSummary.imageTotal, 1);
        assert.equal(finalState.completionSummary.imageDownloaded, 1);
        assert.equal(finalState.completionSummary.imageFailed, 0);
      });
  });
});

describe('Phase 7B — Image download: multiple images', function() {
  beforeEach(function() {
    resetState();
  });

  it('downloads multiple images for a single tender', function() {
    var imageUrls = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.png',
      'https://example.com/photo3.gif'
    ];
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, imageUrls));
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        var tender = persisted.tenders[0];
        assert.equal(tender.imageDownloadStatus, IMAGE_DOWNLOAD_STATUS_SUCCEEDED);
        assert.equal(tender.downloadedFiles.length, 4);
        assert.ok(tender.downloadedFiles[0].indexOf('Tender.txt') !== -1);
        assert.ok(tender.downloadedFiles[1].indexOf('image_1') !== -1);
        assert.ok(tender.downloadedFiles[2].indexOf('image_2') !== -1);
        assert.ok(tender.downloadedFiles[3].indexOf('image_3') !== -1);
        assert.equal(tender.downloadIds.length, 4);
      });
  });

  it('records all images in completionSummary', function() {
    var imageUrls = [
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/c.jpg'
    ];
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, imageUrls));
      })
      .then(function(finalState) {
        assert.equal(finalState.completionSummary.imageTotal, 3);
        assert.equal(finalState.completionSummary.imageDownloaded, 3);
        assert.equal(finalState.completionSummary.imageFailed, 0);
      });
  });

  it('images for multiple tenders are aggregated in summary', function() {
    var tenders = [createMockTender(1), createMockTender(2)];
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
            folderName: '00' + callCount + '_Tender ' + callCount,
            downloadStatus: DOWNLOAD_STATUS_PARSED,
            imageUrls: ['https://example.com/img' + callCount + '.jpg'],
            description: 'Test',
            warnings: [],
            downloadIds: [],
            downloadedFiles: [],
            downloadedAt: null,
            failureReason: null
          });
        });
      })
      .then(function(finalState) {
        assert.equal(finalState.completionSummary.imageTotal, 2);
        assert.equal(finalState.completionSummary.imageDownloaded, 2);
        assert.equal(finalState.completionSummary.imageFailed, 0);
      });
  });
});

describe('Phase 7B — Image download: failure handling', function() {
  beforeEach(function() {
    resetState();
  });

  it('continues batch if image download fails', function() {
    _downloadMockImpl = function(options, callback) {
      callback();
    };

    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/photo.jpg']));
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 0);
      });
  });

  it('marks imageDownloadStatus as Failed when image download fails', function() {
    _downloadMockImpl = function(options, callback) {
      callback();
    };

    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/photo.jpg']));
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        var tender = persisted.tenders[0];
        assert.equal(tender.imageDownloadStatus, IMAGE_DOWNLOAD_STATUS_FAILED);
        assert.ok(tender.failureReason);
        assert.ok(tender.failureReason.indexOf('images failed') !== -1);
      });
  });

  it('records image failures in completionSummary', function() {
    _downloadMockImpl = function(options, callback) {
      callback();
    };

    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/photo.jpg']));
      })
      .then(function(finalState) {
        assert.equal(finalState.completionSummary.imageTotal, 1);
        assert.equal(finalState.completionSummary.imageDownloaded, 0);
        assert.equal(finalState.completionSummary.imageFailed, 1);
      });
  });

  it('retries failed image download and succeeds on retry', function() {
    var attemptCount = 0;
    _downloadMockImpl = function(options, callback) {
      attemptCount++;
      if (attemptCount === 1) {
        callback();
      } else {
        callback(99);
      }
    };

    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/photo.jpg']));
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        var tender = persisted.tenders[0];
        assert.equal(tender.imageDownloadStatus, IMAGE_DOWNLOAD_STATUS_SUCCEEDED);
        // Should have TXT download ID + image download ID (99)
        assert.equal(tender.downloadIds.length, 2);
        assert.ok(tender.downloadIds.indexOf(99) !== -1);
      });
  });
});

describe('Phase 7B — Download-only recovery with images', function() {
  beforeEach(function() {
    resetState();
  });

  it('downloads images for already-parsed tender on resume', function() {
    var mockTender = createMockTender(1);
    mockTender.downloadIds = [];
    mockTender.downloadedFiles = [];
    mockTender.downloadedAt = null;
    mockTender.failureReason = null;
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', [mockTender]);
    // Simulate a tender that was parsed but download was interrupted
    state.tenders[0].downloadStatus = DOWNLOAD_STATUS_PARSED;
    state.tenders[0].imageUrls = ['https://example.com/photo.jpg'];
    return saveBatchState(state)
      .then(function() {
        return processBatch(function() { return Promise.reject(new Error('Should not re-parse')); });
      })
      .then(function(finalState) {
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.failedCount, 0);
      })
      .then(function() {
        return getBatchState();
      })
      .then(function(persisted) {
        var tender = persisted.tenders[0];
        assert.equal(tender.downloadStatus, DOWNLOAD_STATUS_DOWNLOADED);
        assert.equal(tender.imageDownloadStatus, IMAGE_DOWNLOAD_STATUS_SUCCEEDED);
        assert.equal(tender.downloadedFiles.length, 2);
      });
  });
});

describe('Phase 7B — Existing test compatibility', function() {
  beforeEach(function() {
    resetState();
  });

  it('adds processed tender ID with image download', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/img.jpg']));
      })
      .then(function() {
        return getProcessedTenderIds();
      })
      .then(function(ids) {
        assert.equal(ids.length, 1);
        assert.equal(ids[0], 'T1');
      });
  });

  it('populates completionSummary with image counts', function() {
    var tenders = [createMockTender(1)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, ['https://example.com/a.jpg', 'https://example.com/b.jpg']));
      })
      .then(function(finalState) {
        assert.equal(finalState.completionSummary.totalTenders, 1);
        assert.equal(finalState.completionSummary.successCount, 1);
        assert.equal(finalState.completionSummary.imageTotal, 2);
        assert.equal(finalState.completionSummary.imageDownloaded, 2);
        assert.ok(finalState.completionSummary.durationMs >= 0);
      });
  });

  it('skips duplicate tender even with images', function() {
    var tenders = [createMockTender(1), createMockTender(2)];
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders);
    return saveBatchState(state)
      .then(function() {
        return processBatch(createMockSuccessFn(1, []));
      })
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        resetMockStorage();
        var tenders2 = [createMockTender(1), createMockTender(2)];
        var state2 = createBatchState(1, 'https://www.jobz.pk/tenders-1', tenders2);
        return saveBatchState(state2);
      })
      .then(function() {
        return addProcessedTenderId('T1');
      })
      .then(function() {
        return processBatch(createMockSuccessFn(2, ['https://example.com/img.jpg']));
      })
      .then(function(finalState) {
        assert.equal(finalState.skippedCount, 1);
        assert.equal(finalState.successCount, 1);
        assert.equal(finalState.processedCount, 2);
        assert.equal(finalState.completionSummary.imageTotal, 1);
        assert.equal(finalState.completionSummary.imageDownloaded, 1);
      });
  });
});
