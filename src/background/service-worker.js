self.importScripts(
  chrome.runtime.getURL('src/shared/constants.js'),
  chrome.runtime.getURL('src/shared/utilities.js'),
  chrome.runtime.getURL('src/shared/naming.js'),
  chrome.runtime.getURL('src/shared/urls.js'),
  chrome.runtime.getURL('src/shared/tender-model.js'),
  chrome.runtime.getURL('src/shared/batch-state.js'),
  chrome.runtime.getURL('src/shared/txt-generator.js'),
  chrome.runtime.getURL('src/shared/batch-processor.js')
);

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === CHECK_CURRENT_PAGE) {
    handleCheckCurrentPage(sendResponse);
    return true;
  }
  if (message && message.type === FETCH_AND_PARSE_TENDER_DETAIL) {
    handleFetchAndParseTenderDetail(message.payload, sendResponse);
    return true;
  }
  if (message && message.type === PROCESS_BATCH) {
    handleProcessBatch(sendResponse);
    return true;
  }
  if (message && message.type === RESET_BATCH) {
    handleResetBatch(sendResponse);
    return true;
  }
});

function handleCheckCurrentPage(sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
      sendResponse(inaccessibleResponse(null));
      return;
    }

    var tab = tabs[0];
    if (!tab || !tab.id || !tab.url) {
      sendResponse(inaccessibleResponse(null));
      return;
    }

    var urlResult = checkPageUrl(tab.url);
    if (!urlResult.supported) {
      sendResponse(urlResult);
      return;
    }

    inspectPageViaContentScript(tab.id, tab.url, urlResult, sendResponse);
  });
}

function inspectPageViaContentScript(tabId, pageUrl, urlResult, sendResponse) {
  chrome.tabs.sendMessage(tabId, { type: INSPECT_LISTING_PAGE }, (response) => {
    if (chrome.runtime.lastError) {
      injectAndInspect(tabId, pageUrl, urlResult, sendResponse);
      return;
    }

    if (!response) {
      sendInspectionFailure(pageUrl, urlResult, sendResponse);
      return;
    }

    sendNormalizedResponse(response, pageUrl, urlResult, sendResponse);
  });
}

function injectAndInspect(tabId, pageUrl, urlResult, sendResponse) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['src/shared/constants.js', 'src/shared/utilities.js', 'src/content/listing-content.js']
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('Content script injection failed:', chrome.runtime.lastError.message || 'unknown error');
      sendInspectionFailure(pageUrl, urlResult, sendResponse);
      return;
    }

    chrome.tabs.sendMessage(tabId, { type: INSPECT_LISTING_PAGE }, (response) => {
      if (chrome.runtime.lastError || !response) {
        sendInspectionFailure(pageUrl, urlResult, sendResponse);
        return;
      }
      sendNormalizedResponse(response, pageUrl, urlResult, sendResponse);
    });
  });
}

function sendNormalizedResponse(inspectionResult, pageUrl, urlResult, sendResponse) {
  if (inspectionResult && inspectionResult.inspectedUrl && inspectionResult.inspectedUrl !== pageUrl) {
    sendResponse({
      supported: true,
      pageNumber: null,
      pageUrl: pageUrl,
      reason: 'The page changed while it was being inspected. Open the popup again.',
      tenders: [],
      tenderCount: 0,
      warnings: []
    });
    return;
  }

  var pageNumber = null;
  var reason = null;

  if (inspectionResult && inspectionResult.success && isPositiveInteger(inspectionResult.pageNumber)) {
    pageNumber = inspectionResult.pageNumber;
  } else if (isPositiveInteger(urlResult.pageNumber)) {
    pageNumber = urlResult.pageNumber;
  } else {
    reason = 'The page could not be inspected. Reload the page and try again.';
  }

  var tenders = [];
  var invalidUrlCount = 0;
  if (inspectionResult && Array.isArray(inspectionResult.tenders)) {
    for (var i = 0; i < inspectionResult.tenders.length; i++) {
      var t = inspectionResult.tenders[i];
      if (t && typeof t === 'object' && typeof t.detailUrl === 'string' && typeof t.originalListingTitle === 'string') {
        var normalized = createNormalizedTenderRecord(t, pageNumber);
        if (normalized.detailUrl !== null) {
          tenders.push(normalized);
        } else {
          invalidUrlCount++;
        }
      }
    }
    if (invalidUrlCount > 0 && typeof console !== 'undefined' && console.log) {
      console.log('Tender normalization: ' + inspectionResult.tenders.length + ' raw, ' + tenders.length + ' valid, ' + invalidUrlCount + ' invalid URLs');
    }
  }

  sendResponse({
    supported: true,
    pageNumber: pageNumber,
    pageUrl: pageUrl,
    reason: reason,
    tenders: tenders,
    tenderCount: tenders.length,
    warnings: inspectionResult && Array.isArray(inspectionResult.warnings) ? inspectionResult.warnings : []
  });
}

function sendInspectionFailure(pageUrl, urlResult, sendResponse) {
  sendResponse({
    supported: true,
    pageNumber: urlResult && isPositiveInteger(urlResult.pageNumber) ? urlResult.pageNumber : null,
    pageUrl: pageUrl,
    reason: 'The page could not be inspected. Reload the page and try again.',
    tenders: [],
    tenderCount: 0,
    warnings: []
  });
}

function checkPageUrl(url) {
  try {
    var parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'www.jobz.pk') {
      return unsupportedResponse(url);
    }
    var match = parsedUrl.pathname.match(/^\/tenders(?:-(\d+))?\/?$/);
    if (match) {
      var pageNumRaw = match[1];
      var pageNum = null;
      if (pageNumRaw !== undefined) {
        var parsed = parseInt(pageNumRaw, 10);
        if (isPositiveInteger(parsed)) {
          pageNum = parsed;
        }
      }
      return { supported: true, pageNumber: pageNum, pageUrl: url, reason: null };
    }
    return unsupportedResponse(url);
  } catch (e) {
    console.error('URL parsing error:', e);
    return inaccessibleResponse(url);
  }
}

function unsupportedResponse(url) {
  return {
    supported: false,
    pageNumber: null,
    pageUrl: url || null,
    reason: 'Please open a Jobz.pk tender listing page.'
  };
}

function inaccessibleResponse(url) {
  return {
    supported: false,
    pageNumber: null,
    pageUrl: url || null,
    reason: 'The current browser tab cannot be inspected.'
  };
}

function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.floor(value) === value;
}

// ---- Phase 5A ----

var DIAGNOSTIC_MODE = false;
var FETCH_TIMEOUT_MS = 20000;

// ---- Phase 5A: Pure helper functions ----

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
    'captcha',
    'verify you are human',
    'access denied',
    'forbidden',
    'login required',
    'sign in to continue',
    'unusual traffic',
    'rate limit'
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

// ---- Phase 5A: Offscreen lifecycle ----

var offscreenCreationPromise = null;

function ensureOffscreenDocument() {
  return new Promise(function(resolve, reject) {
    if (offscreenCreationPromise) {
      offscreenCreationPromise.then(resolve).catch(function() {
        offscreenCreationPromise = null;
        createOffscreenDocument().then(resolve).catch(reject);
      });
      return;
    }
    checkOffscreenExists(function(exists) {
      if (exists) {
        resolve(true);
        return;
      }
      createOffscreenDocument().then(resolve).catch(reject);
    });
  });
}

function checkOffscreenExists(callback) {
  if (typeof chrome.runtime.getContexts === 'function') {
    chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }, function(contexts) {
      var exists = false;
      if (contexts && contexts.length > 0) {
        for (var i = 0; i < contexts.length; i++) {
          if (contexts[i].documentUrl && contexts[i].documentUrl.indexOf('offscreen.html') !== -1) {
            exists = true;
            break;
          }
        }
      }
      callback(exists);
    });
  } else {
    try {
      clients.matchAll().then(function(clientList) {
        var exists = false;
        for (var i = 0; i < clientList.length; i++) {
          if (clientList[i].url && clientList[i].url.indexOf('offscreen.html') !== -1) {
            exists = true;
            break;
          }
        }
        callback(exists);
      }).catch(function() {
        callback(false);
      });
    } catch (e) {
      callback(false);
    }
  }
}

function createOffscreenDocument() {
  return new Promise(function(resolve, reject) {
    offscreenCreationPromise = new Promise(function(innerResolve, innerReject) {
      chrome.offscreen.createDocument({
        url: 'src/offscreen/offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'Parse fetched tender-detail HTML using DOMParser.'
      }, function() {
        if (chrome.runtime.lastError) {
          if (chrome.runtime.lastError.message && chrome.runtime.lastError.message.indexOf('already exists') !== -1) {
            innerResolve(true);
          } else {
            innerReject(chrome.runtime.lastError);
          }
        } else {
          innerResolve(true);
        }
      });
    });
    offscreenCreationPromise.then(function(result) {
      offscreenCreationPromise = null;
      resolve(result);
    }).catch(function(error) {
      offscreenCreationPromise = null;
      reject(error);
    });
  });
}

// ---- Phase 5A: Fetch helper ----

function fetchTenderHTML(url) {
  return new Promise(function(resolve) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function() {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': 'https://www.jobz.pk/tenders',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      credentials: 'include',
      signal: controller.signal
    }).then(function(response) {
      clearTimeout(timeoutId);

      if (!response.ok) {
        var code = normalizeFetchError(response.status);
        resolve(fetchFailureResponse(code, 'The server returned an error response.', { status: response.status }));
        return;
      }

      response.text().then(function(html) {
        if (isEmptyHtml(html)) {
          resolve(fetchFailureResponse('EMPTY_HTML', 'The response contained no content.', null));
          return;
        }
        resolve({
          success: true,
          html: html,
          contentType: response.headers.get('content-type') || '',
          finalUrl: response.url
        });
      }).catch(function() {
        resolve(fetchFailureResponse('UNKNOWN_ERROR', 'Failed to read the response body.', null));
      });
    }).catch(function(error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        resolve(fetchFailureResponse('FETCH_TIMEOUT', 'The request timed out. Please try again.', null));
      } else {
        resolve(fetchFailureResponse('NETWORK_ERROR', 'Could not connect to the server. Please check your internet connection.', null));
      }
    });
  });
}

// ---- Phase 5A: Main pipeline ----

function handleFetchAndParseTenderDetail(payload, sendResponse) {
  if (!payload || typeof payload.url !== 'string') {
    sendResponse(fetchFailureResponse('INVALID_TENDER_URL', 'The selected tender URL is invalid.', null));
    return;
  }

  var validation = validateTenderDetailUrl(payload.url);
  if (!validation.valid) {
    sendResponse(fetchFailureResponse('INVALID_TENDER_URL', 'The selected tender URL is invalid.', null));
    return;
  }

  var fetchUrl = validation.canonicalUrl;
  var expectedId = validation.tenderId;

  if (DIAGNOSTIC_MODE) console.log('Fetch URL validation passed:', fetchUrl);

  fetchTenderHTML(fetchUrl).then(function(fetchResult) {
    sendFetchedHTMLToOffscreen(fetchResult, fetchUrl, expectedId, payload.originalListingTitle || '', sendResponse);
  });
}

function sendFetchedHTMLToOffscreen(fetchResult, fetchUrl, expectedId, originalTitle, sendResponse) {
  if (!fetchResult.success) {
    sendResponse(fetchResult);
    return;
  }

  if (!validateRedirect(fetchResult.finalUrl, expectedId)) {
    if (DIAGNOSTIC_MODE) console.log('Redirect validation failed: finalUrl=' + fetchResult.finalUrl + ', expectedId=' + expectedId);
    sendResponse(fetchFailureResponse('UNEXPECTED_REDIRECT', 'The tender URL redirected to an unexpected page.', null));
    return;
  }

  if (!isApplicableContentType(fetchResult.contentType)) {
    sendResponse(fetchFailureResponse('UNEXPECTED_CONTENT_TYPE', 'The response was not HTML.', { contentType: fetchResult.contentType }));
    return;
  }

  if (detectAccessRestriction(fetchResult.finalUrl, fetchResult.html)) {
    sendResponse(fetchFailureResponse('ACCESS_RESTRICTED', 'The tender page could not be accessed normally.', null));
    return;
  }

  if (DIAGNOSTIC_MODE) console.log('HTML fetched, length=' + fetchResult.html.length + ', waiting for offscreen document');

  ensureOffscreenDocument().then(function() {
    if (DIAGNOSTIC_MODE) console.log('Offscreen document ready, sending HTML for parse acknowledgement');

    chrome.runtime.sendMessage({
      type: PARSE_TENDER_HTML,
      target: 'offscreen',
      payload: {
        html: fetchResult.html,
        sourceUrl: fetchResult.finalUrl,
        expectedTenderId: expectedId,
        originalListingTitle: originalTitle
      }
    }, function(offscreenResult) {
      if (chrome.runtime.lastError) {
        if (DIAGNOSTIC_MODE) console.log('First offscreen message failed, recreating and retrying');
        ensureOffscreenDocument().then(function() {
          chrome.runtime.sendMessage({
            type: PARSE_TENDER_HTML,
            target: 'offscreen',
            payload: {
              html: fetchResult.html,
              sourceUrl: fetchResult.finalUrl,
              expectedTenderId: expectedId,
              originalListingTitle: originalTitle
            }
          }, function(retryResult) {
            if (chrome.runtime.lastError) {
              sendResponse(fetchFailureResponse('UNKNOWN_ERROR', 'The parsing environment could not be reached.', null));
            } else {
              sendResponse(retryResult || fetchFailureResponse('UNKNOWN_ERROR', 'No parse result was returned.', null));
            }
          });
        }).catch(function() {
          sendResponse(fetchFailureResponse('UNKNOWN_ERROR', 'Could not recreate the parsing environment.', null));
        });
      } else {
        sendResponse(offscreenResult || fetchFailureResponse('UNKNOWN_ERROR', 'No parse result was returned.', null));
      }
    });
  }).catch(function() {
    sendResponse(fetchFailureResponse('UNKNOWN_ERROR', 'Could not create the parsing environment.', null));
  });
}

// ---- Content script fetch (bypasses Cloudflare by running in page context) ----

function fetchTenderHTMLViaContentScript(url) {
  return new Promise(function(resolve) {
    chrome.tabs.query({ url: 'https://www.jobz.pk/*' }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        resolve(null);
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: FETCH_TENDER_HTML, url: url }, function(response) {
        if (chrome.runtime.lastError || !response) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  });
}

function _parseTenderFromResult(result, tender, resolve, reject) {
  if (!result || !result.success) {
    reject(new Error((result && result.message) || 'Unknown error'));
  } else {
    try {
      var merged = mergeTenderListingAndDetail(tender, result);
      resolve(merged);
    } catch (e) {
      reject(new Error('Failed to merge tender data: ' + (e.message || 'unknown')));
    }
  }
}

// ---- Phase 6B: Batch processing ----

function processOneTenderForBatch(tender) {
  return new Promise(function(resolve, reject) {
    if (!tender || !tender.detailUrl) {
      reject(new Error('Invalid tender: missing detail URL'));
      return;
    }

    var payload = {
      url: tender.detailUrl,
      originalListingTitle: tender.originalListingTitle || ''
    };

    var validation = validateTenderDetailUrl(payload.url);
    if (!validation.valid) {
      reject(new Error('Invalid tender URL'));
      return;
    }

    var fetchUrl = validation.canonicalUrl;
    var expectedId = validation.tenderId;
    var originalTitle = payload.originalListingTitle || '';

    fetchTenderHTMLViaContentScript(fetchUrl).then(function(contentResult) {
      if (contentResult && contentResult.success) {
        sendFetchedHTMLToOffscreen(contentResult, fetchUrl, expectedId, originalTitle, function(parseResult) {
          _parseTenderFromResult(parseResult, tender, resolve, reject);
        });
      } else {
        handleFetchAndParseTenderDetail(payload, function(result) {
          _parseTenderFromResult(result, tender, resolve, reject);
        });
      }
    });
  });
}

function handleProcessBatch(sendResponse) {
  processBatch(processOneTenderForBatch).then(function(finalState) {
    sendResponse({ success: true, state: finalState });
  }).catch(function(error) {
    sendResponse({ success: false, error: error.message });
  });
}

function handleResetBatch(sendResponse) {
  resetBatch().then(function() {
    sendResponse({ success: true });
  }).catch(function(error) {
    sendResponse({ success: false, error: error.message });
  });
}

// Auto-resume on service worker restart
getBatchState().then(function(state) {
  if (state.batchStatus === BATCH_STATUS_PROCESSING && !_batchProcessingInProgress) {
    processBatch(processOneTenderForBatch).catch(function(err) {
      if (err && err.message !== 'Batch processing is already in progress.') {
        console.error('Auto-resume batch failed:', err.message);
      }
    });
  }
});
