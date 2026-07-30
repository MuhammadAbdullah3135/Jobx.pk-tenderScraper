document.addEventListener('DOMContentLoaded', () => {
  var btn = document.getElementById('download-btn');
  var statusText = document.getElementById('status-text');
  var currentPageStatus = document.getElementById('current-page-status');
  var paginationInfo = document.getElementById('pagination-info');
  var tenderCountEl = document.getElementById('tender-count');
  var messageArea = document.getElementById('message-area');
  var completionSummary = document.getElementById('completion-summary');
  if (!statusText || !currentPageStatus || !paginationInfo || !tenderCountEl) return;

  var fatalWarningPatterns = ['could not be found', 'no valid tender listings'];
  var progressArea = document.getElementById('progress-area');
  var progressBar = document.getElementById('progress-bar');
  var processedCountEl = document.getElementById('processed-count');
  var successCountEl = document.getElementById('success-count');
  var failedCountEl = document.getElementById('failed-count');
  var skippedCountEl = document.getElementById('skipped-count');
  var remainingCountEl = document.getElementById('remaining-count');
  var currentTenderName = document.getElementById('current-tender-name');

  var cachedTenders = [];
  var cachedPageUrl = null;
  var batchActive = false;
  var batchUIControlled = false;

  if (typeof CHECK_CURRENT_PAGE === 'undefined') {
    currentPageStatus.textContent = 'Error';
    paginationInfo.textContent = 'Not available';
    if (messageArea) messageArea.textContent = 'Extension failed to load correctly.';
    return;
  }

  btn.disabled = true;
  statusText.textContent = 'Checking current page...';

  btn.addEventListener('click', function () {
    if (batchActive) return;
    if (cachedTenders.length === 0) return;
    if (typeof btn.onclick === 'function') return;
    startBatch();
  });

  try {
    chrome.runtime.sendMessage({ type: CHECK_CURRENT_PAGE }, function (response) {
      if (chrome.runtime.lastError) {
        renderUnsupported('Could not connect to the extension.');
        return;
      }

      if (!response || typeof response.supported !== 'boolean') {
        renderUnsupported('Received an invalid response.');
        return;
      }

      if (response.supported) {
        renderSupported(response);
      } else if (response.reason && response.reason.indexOf('cannot be inspected') !== -1) {
        if (!batchUIControlled) renderUninspectable(response.reason);
      } else {
        if (!batchUIControlled) renderUnsupported(response.reason);
      }
    });
  } catch (e) {
    renderUnsupported('An unexpected error occurred.');
  }

  chrome.storage.onChanged.addListener(function(changes, areaName) {
    if (areaName !== 'local') return;
    if (!changes[BATCH_STORAGE_KEY]) return;
    var newValue = changes[BATCH_STORAGE_KEY].newValue;
    if (newValue && typeof newValue === 'object') {
      updateBatchUI(recoverBatchState(newValue));
    }
  });

  restoreBatchFromStorage();

  function restoreBatchFromStorage() {
    chrome.storage.local.get(BATCH_STORAGE_KEY, function(result) {
      if (chrome.runtime.lastError) return;
      var raw = result && result[BATCH_STORAGE_KEY];
      if (!raw || typeof raw !== 'object') return;
      var state = recoverBatchState(raw);
      if (state.batchStatus === BATCH_STATUS_PROCESSING || state.batchStatus === BATCH_STATUS_COMPLETED || state.batchStatus === BATCH_STATUS_FAILED) {
        batchActive = true;
        batchUIControlled = true;
        updateBatchUI(state);
        if (state.batchStatus === BATCH_STATUS_PROCESSING) {
          chrome.runtime.sendMessage({ type: PROCESS_BATCH }, function() {});
        }
      }
    });
  }

  function startBatch() {
    var pageNum = null;
    var pagText = paginationInfo.textContent;
    if (pagText && pagText.indexOf('Page ') === 0) {
      pageNum = parseInt(pagText.substring(5), 10);
    }
    if (!Number.isFinite(pageNum) || pageNum < 1) pageNum = 1;

    if (completionSummary) completionSummary.style.display = 'none';

    var state = createBatchState(pageNum, cachedPageUrl, cachedTenders);
    saveBatchState(state).then(function() {
      batchActive = true;
      btn.disabled = true;
      btn.textContent = 'Processing...';
      updateBatchUI(state);
      if (messageArea) messageArea.textContent = 'Batch processing started.';
      chrome.runtime.sendMessage({ type: PROCESS_BATCH }, function(response) {
        if (chrome.runtime.lastError) {
          batchActive = false;
          btn.textContent = 'Download Current Page Tenders';
          btn.disabled = false;
          if (messageArea) messageArea.textContent = 'Failed to start batch processing.';
          return;
        }
      });
    }).catch(function(err) {
      if (messageArea) messageArea.textContent = 'Failed to create batch: ' + err.message;
    });
  }

  function updateBatchUI(state) {
    if (!state || !progressBar) return;

    var total = state.totalTenders || 0;
    var processed = state.processedCount || 0;
    var remaining = total - processed;
    if (remaining < 0) remaining = 0;
    var pct = total > 0 ? Math.round((processed / total) * 100) : 0;

    progressBar.value = pct;
    progressBar.max = 100;
    if (processedCountEl) processedCountEl.textContent = processed;
    if (successCountEl) successCountEl.textContent = state.successCount || 0;
    if (failedCountEl) failedCountEl.textContent = state.failedCount || 0;
    if (skippedCountEl) skippedCountEl.textContent = state.skippedCount || 0;
    if (remainingCountEl) remainingCountEl.textContent = remaining;

    if (progressArea) progressArea.style.display = '';

    if (state.batchStatus === BATCH_STATUS_COMPLETED) {
      if (btn) {
        btn.textContent = 'Start New Batch';
        btn.disabled = false;
        btn.onclick = function() {
          chrome.runtime.sendMessage({ type: RESET_BATCH }, function(response) {
            btn.textContent = 'Download Current Page Tenders';
            btn.onclick = startBatch;
            batchActive = false;
            batchUIControlled = false;
            if (completionSummary) completionSummary.style.display = 'none';
            if (progressArea) progressArea.style.display = 'none';
            cachedTenders = normalizeTenderArray(cachedTenders);
            var canEnable = cachedTenders.length > 0 && !batchActive;
            btn.disabled = !canEnable;
            if (messageArea) messageArea.textContent = 'Batch cleared. Ready for new batch.';
          });
        };
      }
      if (statusText) statusText.textContent = 'Batch: Completed (' + processed + ' of ' + total + ')';
      if (messageArea) messageArea.textContent = 'All tenders processed.';
      batchActive = false;
      if (completionSummary && state.completionSummary) {
        var s = state.completionSummary;
        document.getElementById('summary-completed-at').textContent = 'Completed: ' + (s.completedAt ? new Date(s.completedAt).toLocaleString() : 'N/A');
        document.getElementById('summary-duration').textContent = 'Duration: ' + (s.durationMs ? Math.round(s.durationMs / 1000) + 's' : 'N/A');
        document.getElementById('summary-total').textContent = s.totalTenders || 0;
        document.getElementById('summary-success').textContent = s.successCount || 0;
        document.getElementById('summary-failed').textContent = s.failedCount || 0;
        document.getElementById('summary-skipped').textContent = s.skippedCount || 0;
        completionSummary.style.display = '';
      }
    } else if (state.batchStatus === BATCH_STATUS_PROCESSING) {
      if (btn) {
        btn.textContent = 'Processing...';
        btn.disabled = true;
      }
      if (statusText) statusText.textContent = 'Batch: Processing (' + processed + ' of ' + total + ')';
      var currentIdx = state.currentTenderIndex || 0;
      if (currentIdx > 0 && currentIdx <= total && currentTenderName) {
        var currentTender = state.tenders[currentIdx - 1];
        var displayName = currentTender ? (currentTender.title || currentTender.originalListingTitle || 'Tender ' + currentIdx) : 'Tender ' + currentIdx;
        currentTenderName.textContent = displayName;
      } else if (currentTenderName) {
        var nextTender = state.tenders[currentIdx];
        var pendingName = nextTender ? (nextTender.title || nextTender.originalListingTitle || 'Tender ' + (currentIdx + 1)) : 'Tender ' + (currentIdx + 1);
        currentTenderName.textContent = 'Next: ' + pendingName;
      }
    }
  }

  function renderUnsupported(reason) {
    statusText.textContent = 'Current Page: Unsupported';
    currentPageStatus.textContent = 'Unsupported';
    paginationInfo.textContent = 'Not available';
    tenderCountEl.textContent = '0';
    if (messageArea) messageArea.textContent = reason || 'Please open a Jobz.pk tender listing page.';
    btn.disabled = true;
  }

  function renderUninspectable(reason) {
    statusText.textContent = 'Current Page: Cannot inspect';
    currentPageStatus.textContent = 'Cannot inspect';
    paginationInfo.textContent = 'Not available';
    tenderCountEl.textContent = '0';
    if (messageArea) messageArea.textContent = reason || 'The current browser tab cannot be inspected.';
    btn.disabled = true;
  }

  function renderSupported(response) {
    if (!batchUIControlled) {
      statusText.textContent = 'Current Page: Supported';
    }
    currentPageStatus.textContent = 'Supported';

    if (response.reason) {
      paginationInfo.textContent = 'Not available';
      if (messageArea) messageArea.textContent = response.reason;
    } else if (isValidPageNumber(response.pageNumber)) {
      paginationInfo.textContent = 'Page ' + response.pageNumber;
    } else {
      paginationInfo.textContent = 'Not available';
    }

    var validTenders = normalizeTenderArray(response.tenders);
    var count = validTenders.length;
    tenderCountEl.textContent = count;

    var warnings = Array.isArray(response.warnings) ? response.warnings : [];
    var hasFatalWarning = false;
    var nonfatalWarnings = [];

    for (var wi = 0; wi < warnings.length; wi++) {
      var w = warnings[wi];
      var isFatal = false;
      for (var fpi = 0; fpi < fatalWarningPatterns.length; fpi++) {
        if (w.indexOf(fatalWarningPatterns[fpi]) !== -1) {
          isFatal = true;
          break;
        }
      }
      if (isFatal) {
        hasFatalWarning = true;
      } else {
        nonfatalWarnings.push(w);
      }
    }

    var isStale = response.reason && response.reason.indexOf('page changed') !== -1;
    var isFatalInspection = response.reason && response.reason.indexOf('could not be inspected') !== -1;

    if (isStale || isFatalInspection) {
      if (messageArea) messageArea.textContent = response.reason;
    } else if (count === 0 && hasFatalWarning) {
      for (var wi = 0; wi < warnings.length; wi++) {
        var w = warnings[wi];
        var isFatal = false;
        for (var fpi = 0; fpi < fatalWarningPatterns.length; fpi++) {
          if (w.indexOf(fatalWarningPatterns[fpi]) !== -1) {
            isFatal = true;
            break;
          }
        }
        if (isFatal) {
          if (messageArea) messageArea.textContent = w;
          break;
        }
      }
    } else if (count === 0) {
      if (messageArea) messageArea.textContent = 'No tenders found on the current page.';
    } else if (nonfatalWarnings.length > 0 && !response.reason) {
      if (messageArea) messageArea.textContent = nonfatalWarnings.join('; ');
    }

    var canEnable = (
      count > 0 &&
      !isStale &&
      !response.reason &&
      !hasFatalWarning &&
      !batchActive
    );

    if (!batchUIControlled) {
      btn.disabled = !canEnable;
    }

    cachedTenders = validTenders;
    cachedPageUrl = response.pageUrl || null;
  }

  function normalizeTenderArray(tenders) {
    if (!Array.isArray(tenders)) return [];
    var valid = [];
    for (var i = 0; i < tenders.length; i++) {
      var t = tenders[i];
      if (t && typeof t === 'object' && typeof t.detailUrl === 'string' && typeof t.originalListingTitle === 'string') {
        valid.push(t);
      }
    }
    return valid;
  }

  function isValidPageNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.floor(value) === value;
  }

});
