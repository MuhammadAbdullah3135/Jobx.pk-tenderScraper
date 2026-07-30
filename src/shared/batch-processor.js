var RETRY_DEFAULT_MAX_RETRIES = 1;
var RETRY_DEFAULT_BASE_DELAY_MS = 2000;

var _batchProcessingInProgress = false;

function isBatchProcessing() {
  return _batchProcessingInProgress;
}

function processBatch(processOneTenderFn) {
  if (_batchProcessingInProgress) {
    return Promise.reject(new Error('Batch processing is already in progress.'));
  }

  _batchProcessingInProgress = true;

  return getBatchState().then(function(state) {
    state.batchStatus = BATCH_STATUS_PROCESSING;
    return saveBatchState(state).then(function() {
      return _runProcessingLoop(state, processOneTenderFn);
    });
  }).catch(function(error) {
    _batchProcessingInProgress = false;
    return Promise.reject(error);
  });
}

function _runProcessingLoop(state, processOneTenderFn) {
  if (state.currentTenderIndex >= state.totalTenders) {
    state.batchStatus = BATCH_STATUS_COMPLETED;
    _batchProcessingInProgress = false;
    var createdAt = state.createdAt ? new Date(state.createdAt).getTime() : null;
    state.completionSummary = {
      completedAt: new Date().toISOString(),
      totalTenders: state.totalTenders,
      successCount: state.successCount,
      failedCount: state.failedCount,
      skippedCount: state.skippedCount,
      durationMs: createdAt !== null ? Date.now() - createdAt : 0,
      imageTotal: state.imageTotal || 0,
      imageDownloaded: state.imageDownloaded || 0,
      imageFailed: state.imageFailed || 0
    };
    return saveBatchState(state).then(function() {
      return state;
    });
  }

  var tenderIndex = state.currentTenderIndex;
  var tender = state.tenders[tenderIndex];

  // Checkpoint recovery: skip tenders already in a final state
  if (tender.downloadStatus === DOWNLOAD_STATUS_PARSE_FAILED || tender.downloadStatus === DOWNLOAD_STATUS_DOWNLOADED || tender.downloadStatus === DOWNLOAD_STATUS_DOWNLOAD_FAILED) {
    state.currentTenderIndex = tenderIndex + 1;
    return saveBatchState(state).then(function() {
      return _runProcessingLoop(state, processOneTenderFn);
    });
  }

  // Duplicate prevention: skip tenders already processed in a previous batch
  if (tender.tenderId && typeof tender.tenderId === 'string') {
    return isTenderProcessed(tender.tenderId).then(function(alreadyProcessed) {
      if (alreadyProcessed) {
        state.tenders[tenderIndex].downloadStatus = DOWNLOAD_STATUS_PARSED;
        state.processedCount++;
        state.skippedCount++;
        state.currentTenderIndex = tenderIndex + 1;
        return saveBatchState(state).then(function() {
          return _runProcessingLoop(state, processOneTenderFn);
        });
      }
      return _processCurrentTender(state, tenderIndex, tender, processOneTenderFn);
    });
  }

  return _processCurrentTender(state, tenderIndex, tender, processOneTenderFn);
}

function _processCurrentTender(state, tenderIndex, tender, processOneTenderFn) {
  // Download-only recovery: if parse already succeeded, skip to download step
  if (tender.downloadStatus === DOWNLOAD_STATUS_PARSED) {
    return _downloadTenderFile(tender, state).then(function(txtRecord) {
      state.tenders[tenderIndex] = txtRecord;
      return _downloadImageFiles(txtRecord, state);
    }).then(function(updatedRecord) {
      state.tenders[tenderIndex] = updatedRecord;
      state.processedCount++;
      state.successCount++;
      return addProcessedTenderId(updatedRecord.tenderId);
    }).then(function() {
      state.currentTenderIndex = tenderIndex + 1;
      return saveBatchState(state);
    }).then(function() {
      return _runProcessingLoop(state, processOneTenderFn);
    });
  }

  var maxRetries = (state.retryConfig && state.retryConfig.maxRetries) || RETRY_DEFAULT_MAX_RETRIES;
  var baseDelayMs = (state.retryConfig && state.retryConfig.baseDelayMs) || RETRY_DEFAULT_BASE_DELAY_MS;

  if (typeof tender.fetchAttempts !== 'number' || tender.fetchAttempts < 0) {
    tender.fetchAttempts = 0;
  }

  return _processTenderWithRetry(tender, processOneTenderFn, maxRetries, baseDelayMs)
    .then(function(mergedRecord) {
      state.tenders[tenderIndex] = mergedRecord;
      state.processedCount++;
      state.successCount++;
      return addProcessedTenderId(mergedRecord.tenderId).then(function() {
        return _downloadTenderFile(mergedRecord, state);
      }).then(function(txtRecord) {
        state.tenders[tenderIndex] = txtRecord;
        return _downloadImageFiles(txtRecord, state);
      });
    })
    .then(function(updatedRecord) {
      if (updatedRecord) {
        state.tenders[tenderIndex] = updatedRecord;
      }
    })
    .catch(function(error) {
      var failedTender = JSON.parse(JSON.stringify(tender));
      failedTender.downloadStatus = DOWNLOAD_STATUS_PARSE_FAILED;
      failedTender.failureReason = error && error.message ? error.message : 'Unknown error';
      failedTender.fetchAttempts = tender.fetchAttempts || 0;
      state.tenders[tenderIndex] = failedTender;
      state.processedCount++;
      state.failedCount++;
    })
    .then(function() {
      state.currentTenderIndex = tenderIndex + 1;
      return saveBatchState(state);
    })
    .then(function() {
      return _runProcessingLoop(state, processOneTenderFn);
    });
}

function _processTenderWithRetry(tender, processOneTenderFn, maxRetries, baseDelayMs) {
  if (_isPermanentlyInvalidUrl(tender.detailUrl)) {
    return Promise.reject(new Error('Invalid tender URL: ' + tender.detailUrl));
  }

  var attemptNum = (tender.fetchAttempts || 0);

  function doAttempt() {
    attemptNum++;
    tender.fetchAttempts = attemptNum;

    return processOneTenderFn(tender).then(function(mergedRecord) {
      mergedRecord.fetchAttempts = attemptNum;
      return mergedRecord;
    }).catch(function(error) {
      if (attemptNum < maxRetries) {
        var delay = _calculateRetryDelay(baseDelayMs, attemptNum);
        return _delay(delay).then(doAttempt);
      }
      throw error;
    });
  }

  return doAttempt();
}

function _isPermanentlyInvalidUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') return true;
  try {
    var parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return true;
    return false;
  } catch (e) {
    return true;
  }
}

function _calculateRetryDelay(baseDelayMs, attemptNum) {
  var delay = baseDelayMs * Math.pow(2, attemptNum - 1);
  var jitter = Math.random() * 1000;
  return Math.min(delay + jitter, 30000);
}

function _delay(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

function _downloadTenderFile(record, state) {
  try {
    var txtContent = generateTenderTxt(record);
    var url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(txtContent);
    var pageNum = state.pageNumber && Number.isFinite(state.pageNumber) && state.pageNumber > 0 ? state.pageNumber : 1;
    var createdAt = state.createdAt ? new Date(state.createdAt) : new Date();
    var batchFolder = createBatchFolderPath(pageNum, createdAt);
    var fileName = batchFolder + '/' + record.folderName + '/Tender.txt';

    return new Promise(function(resolve) {
      try {
        chrome.downloads.download({
          url: url,
          filename: fileName,
          conflictAction: 'overwrite'
        }, function(downloadId) {
          try {
            if (chrome.runtime.lastError) {
              record.downloadStatus = DOWNLOAD_STATUS_DOWNLOAD_FAILED;
              record.failureReason = chrome.runtime.lastError.message || 'Download failed';
            } else {
              record.downloadIds.push(downloadId);
              record.downloadedFiles.push(fileName);
              record.downloadedAt = new Date().toISOString();
              record.downloadStatus = DOWNLOAD_STATUS_DOWNLOADED;
            }
          } catch (e) {
            record.downloadStatus = DOWNLOAD_STATUS_DOWNLOAD_FAILED;
            record.failureReason = e.message || 'Download callback error';
          }
          resolve(record);
        });
      } catch (e) {
        record.downloadStatus = DOWNLOAD_STATUS_DOWNLOAD_FAILED;
        record.failureReason = e.message || 'Download initiation error';
        resolve(record);
      }
    }).then(function(record) {
      _downloadDetailsFile(record, batchFolder);
      return record;
    });
  } catch (e) {
    record.downloadStatus = DOWNLOAD_STATUS_DOWNLOAD_FAILED;
    record.failureReason = e.message || 'Download initiation error';
    return Promise.resolve(record);
  }
}

function _downloadDetailsFile(record, batchFolder) {
  if (!record.detailsText) return;
  try {
    var url = 'data:text/plain;charset=utf-8,' + encodeURIComponent(record.detailsText);
    var fileName = batchFolder + '/' + record.folderName + '/details.txt';
    chrome.downloads.download({
      url: url,
      filename: fileName,
      conflictAction: 'overwrite'
    }, function() {});
  } catch (e) {
    // details.txt is supplemental; do not affect record state
  }
}

function _getImageExtension(imageUrl) {
  if (typeof imageUrl !== 'string') return '.jpg';
  var match = imageUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|#|$)/i);
  return match ? '.' + match[1].toLowerCase() : '.jpg';
}

function _initiateImageDownload(imageUrl, fileName) {
  return new Promise(function(resolve, reject) {
    chrome.downloads.download({
      url: imageUrl,
      filename: fileName,
      conflictAction: 'overwrite'
    }, function(downloadId) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Download initiation failed'));
      } else if (typeof downloadId !== 'number' || downloadId <= 0) {
        reject(new Error('Download initiation returned invalid ID'));
      } else {
        resolve(downloadId);
      }
    });
  });
}

function _waitForDownloadComplete(downloadId, timeoutMs) {
  return new Promise(function(resolve) {
    var timeout = setTimeout(function() {
      resolve(false);
    }, timeoutMs || 30000);
    var handler = function(delta) {
      if (delta.id === downloadId && delta.state) {
        clearTimeout(timeout);
        if (typeof chrome.downloads.onChanged !== 'undefined' && chrome.downloads.onChanged.removeListener) {
          chrome.downloads.onChanged.removeListener(handler);
        }
        resolve(delta.state.current === 'complete');
      }
    };
    if (typeof chrome.downloads.onChanged !== 'undefined' && chrome.downloads.onChanged.addListener) {
      chrome.downloads.onChanged.addListener(handler);
    } else {
      clearTimeout(timeout);
      resolve(true);
    }
  });
}

function _downloadSingleImageWithRetry(imageUrl, index, record, batchFolder, maxRetries, baseDelayMs) {
  var ext = _getImageExtension(imageUrl);
  var fileName = batchFolder + '/' + record.folderName + '/image_' + (index + 1) + ext;
  var capturedDownloadId = null;

  function attempt(retryCount) {
    return _initiateImageDownload(imageUrl, fileName).then(function(downloadId) {
      capturedDownloadId = downloadId;
      return _waitForDownloadComplete(downloadId, 30000);
    }).then(function(success) {
      if (success) {
        record.downloadIds.push(capturedDownloadId);
        record.downloadedFiles.push(fileName);
        return;
      }
      throw new Error('Download interrupted for image ' + (index + 1));
    }).catch(function(error) {
      if (retryCount < maxRetries) {
        var delay = _calculateRetryDelay(baseDelayMs, retryCount + 1);
        return _delay(delay).then(function() {
          return attempt(retryCount + 1);
        });
      }
      throw error;
    });
  }

  return attempt(0);
}

function _downloadImageFiles(record, state) {
  var imageUrls = record.imageUrls || [];
  if (imageUrls.length === 0) return Promise.resolve(record);

  try {
    var pageNum = state.pageNumber && Number.isFinite(state.pageNumber) && state.pageNumber > 0 ? state.pageNumber : 1;
    var createdAt = state.createdAt ? new Date(state.createdAt) : new Date();
    var batchFolder = createBatchFolderPath(pageNum, createdAt);
    var maxRetries = (state.retryConfig && state.retryConfig.maxRetries) || RETRY_DEFAULT_MAX_RETRIES;
    var baseDelayMs = (state.retryConfig && state.retryConfig.baseDelayMs) || RETRY_DEFAULT_BASE_DELAY_MS;
    var totalImages = imageUrls.length;
    var succeeded = 0;
    var failed = 0;
    var errors = [];

    function downloadNext(index) {
      if (index >= totalImages) return Promise.resolve();
      return _downloadSingleImageWithRetry(imageUrls[index], index, record, batchFolder, maxRetries, baseDelayMs)
        .then(function() { succeeded++; })
        .catch(function(error) { failed++; errors.push(error.message || 'Image download failed'); })
        .then(function() { return downloadNext(index + 1); });
    }

    record.imageDownloadStatus = IMAGE_DOWNLOAD_STATUS_DOWNLOADING;

    return downloadNext(0).then(function() {
      record.imageDownloadStatus = failed === 0 ? IMAGE_DOWNLOAD_STATUS_SUCCEEDED : IMAGE_DOWNLOAD_STATUS_FAILED;
      if (failed > 0) {
        record.failureReason = succeeded > 0
          ? failed + ' of ' + totalImages + ' images failed'
          : 'All ' + totalImages + ' images failed';
      }
      if (succeeded > 0 && record.downloadedAt === null) {
        record.downloadedAt = new Date().toISOString();
      }
      state.imageTotal = (state.imageTotal || 0) + totalImages;
      state.imageDownloaded = (state.imageDownloaded || 0) + succeeded;
      state.imageFailed = (state.imageFailed || 0) + failed;
      return record;
    });
  } catch (e) {
    return Promise.resolve(record);
  }
}

function resetBatch() {
  _batchProcessingInProgress = false;
  return clearBatchState();
}
