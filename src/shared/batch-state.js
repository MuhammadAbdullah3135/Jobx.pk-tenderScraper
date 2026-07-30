var BATCH_STORAGE_KEY = 'tenderBatchState';
var DUPLICATE_STORAGE_KEY = 'processedTenderIds';

var BATCH_STATUS_IDLE = 'Idle';
var BATCH_STATUS_PROCESSING = 'Processing';
var BATCH_STATUS_COMPLETED = 'Completed';
var BATCH_STATUS_FAILED = 'Failed';

var VALID_BATCH_STATUSES = [
  BATCH_STATUS_IDLE,
  BATCH_STATUS_PROCESSING,
  BATCH_STATUS_COMPLETED,
  BATCH_STATUS_FAILED
];

function createEmptyBatchState() {
  return {
    batchId: null,
    pageNumber: null,
    pageUrl: null,
    createdAt: null,
    updatedAt: null,
    currentTenderIndex: 0,
    totalTenders: 0,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    batchStatus: BATCH_STATUS_IDLE,
    retryConfig: {
      maxRetries: 1,
      baseDelayMs: 2000
    },
    completionSummary: null,
    tenders: []
  };
}

function createBatchState(pageNumber, pageUrl, tenders) {
  var state = createEmptyBatchState();
  state.batchId = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  state.pageNumber = typeof pageNumber === 'number' && Number.isFinite(pageNumber) && pageNumber > 0 ? Math.trunc(pageNumber) : null;
  state.pageUrl = typeof pageUrl === 'string' ? pageUrl : null;
  state.createdAt = new Date().toISOString();
  state.updatedAt = state.createdAt;
  if (Array.isArray(tenders)) {
    state.tenders = tenders.slice();
    state.totalTenders = state.tenders.length;
  }
  return state;
}

function getBatchState() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(BATCH_STORAGE_KEY, function(result) {
      if (chrome.runtime.lastError) {
        resolve(recoverBatchState(null));
        return;
      }
      var raw = result && result[BATCH_STORAGE_KEY];
      resolve(recoverBatchState(raw));
    });
  });
}

function saveBatchState(state) {
  return new Promise(function(resolve, reject) {
    var validation = validateBatchState(state);
    if (!validation.valid) {
      reject(new Error('Invalid batch state: ' + validation.errors.join('; ')));
      return;
    }
    state.updatedAt = new Date().toISOString();
    var toStore = {};
    toStore[BATCH_STORAGE_KEY] = state;
    chrome.storage.local.set(toStore, function() {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function clearBatchState() {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.remove(BATCH_STORAGE_KEY, function() {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function updateBatchState(updates) {
  return getBatchState().then(function(state) {
    if (!updates || typeof updates !== 'object') return state;
    for (var key in updates) {
      if (updates.hasOwnProperty(key) && key !== 'updatedAt') {
        state[key] = updates[key];
      }
    }
    return saveBatchState(state).then(function() {
      return state;
    });
  });
}

function validateBatchState(state) {
  var errors = [];
  if (!state || typeof state !== 'object') {
    return { valid: false, errors: ['State must be an object.'] };
  }
  if (state.batchId !== null && typeof state.batchId !== 'string') {
    errors.push('batchId must be a string or null.');
  }
  if (state.pageNumber !== null && (!Number.isFinite(state.pageNumber) || state.pageNumber < 1)) {
    errors.push('pageNumber must be a positive integer or null.');
  }
  if (state.pageUrl !== null && typeof state.pageUrl !== 'string') {
    errors.push('pageUrl must be a string or null.');
  }
  if (state.createdAt !== null && typeof state.createdAt !== 'string') {
    errors.push('createdAt must be a string or null.');
  }
  if (state.updatedAt !== null && typeof state.updatedAt !== 'string') {
    errors.push('updatedAt must be a string or null.');
  }
  if (typeof state.currentTenderIndex !== 'number' || !Number.isFinite(state.currentTenderIndex) || state.currentTenderIndex < 0) {
    errors.push('currentTenderIndex must be a non-negative integer.');
  }
  if (typeof state.totalTenders !== 'number' || !Number.isFinite(state.totalTenders) || state.totalTenders < 0) {
    errors.push('totalTenders must be a non-negative integer.');
  }
  if (typeof state.processedCount !== 'number' || !Number.isFinite(state.processedCount) || state.processedCount < 0) {
    errors.push('processedCount must be a non-negative integer.');
  }
  if (typeof state.successCount !== 'number' || !Number.isFinite(state.successCount) || state.successCount < 0) {
    errors.push('successCount must be a non-negative integer.');
  }
  if (typeof state.failedCount !== 'number' || !Number.isFinite(state.failedCount) || state.failedCount < 0) {
    errors.push('failedCount must be a non-negative integer.');
  }
  if (typeof state.skippedCount !== 'number' || !Number.isFinite(state.skippedCount) || state.skippedCount < 0) {
    errors.push('skippedCount must be a non-negative integer.');
  }
  if (VALID_BATCH_STATUSES.indexOf(state.batchStatus) === -1) {
    errors.push('batchStatus must be one of: Idle, Processing, Completed, Failed.');
  }
  if (!Array.isArray(state.tenders)) {
    errors.push('tenders must be an array.');
  }
  if (state.retryConfig) {
    if (state.retryConfig.maxRetries !== undefined && (typeof state.retryConfig.maxRetries !== 'number' || !Number.isFinite(state.retryConfig.maxRetries) || state.retryConfig.maxRetries < 1)) {
      errors.push('retryConfig.maxRetries must be a positive integer.');
    }
    if (state.retryConfig.baseDelayMs !== undefined && (typeof state.retryConfig.baseDelayMs !== 'number' || !Number.isFinite(state.retryConfig.baseDelayMs) || state.retryConfig.baseDelayMs < 0)) {
      errors.push('retryConfig.baseDelayMs must be a non-negative integer.');
    }
  } else if (state.retryConfig !== undefined && state.retryConfig !== null) {
    errors.push('retryConfig must be an object or null.');
  }
  if (state.completionSummary !== null && typeof state.completionSummary !== 'object') {
    errors.push('completionSummary must be an object or null.');
  }
  return { valid: errors.length === 0, errors: errors };
}

function recoverBatchState(raw) {
  var state = createEmptyBatchState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return state;
  }
  if (typeof raw.batchId === 'string') {
    state.batchId = raw.batchId;
  }
  if (Number.isFinite(raw.pageNumber) && raw.pageNumber > 0) {
    state.pageNumber = Math.trunc(raw.pageNumber);
  }
  if (typeof raw.pageUrl === 'string') {
    state.pageUrl = raw.pageUrl;
  }
  if (typeof raw.createdAt === 'string') {
    state.createdAt = raw.createdAt;
  }
  if (typeof raw.updatedAt === 'string') {
    state.updatedAt = raw.updatedAt;
  }
  if (Number.isFinite(raw.currentTenderIndex) && raw.currentTenderIndex >= 0) {
    state.currentTenderIndex = Math.trunc(raw.currentTenderIndex);
  }
  if (Array.isArray(raw.tenders)) {
    state.tenders = raw.tenders.slice();
    state.totalTenders = state.tenders.length;
  }
  if (typeof raw.totalTenders === 'number' && Number.isFinite(raw.totalTenders) && raw.totalTenders >= 0) {
    state.totalTenders = raw.totalTenders;
  }
  if (Number.isFinite(raw.processedCount) && raw.processedCount >= 0) {
    state.processedCount = Math.trunc(raw.processedCount);
  }
  if (Number.isFinite(raw.successCount) && raw.successCount >= 0) {
    state.successCount = Math.trunc(raw.successCount);
  }
  if (Number.isFinite(raw.failedCount) && raw.failedCount >= 0) {
    state.failedCount = Math.trunc(raw.failedCount);
  }
  if (Number.isFinite(raw.skippedCount) && raw.skippedCount >= 0) {
    state.skippedCount = Math.trunc(raw.skippedCount);
  }
  if (VALID_BATCH_STATUSES.indexOf(raw.batchStatus) !== -1) {
    state.batchStatus = raw.batchStatus;
  }
  if (raw.retryConfig && typeof raw.retryConfig === 'object') {
    if (typeof raw.retryConfig.maxRetries === 'number' && Number.isFinite(raw.retryConfig.maxRetries) && raw.retryConfig.maxRetries >= 1) {
      state.retryConfig.maxRetries = Math.trunc(raw.retryConfig.maxRetries);
    }
    if (typeof raw.retryConfig.baseDelayMs === 'number' && Number.isFinite(raw.retryConfig.baseDelayMs) && raw.retryConfig.baseDelayMs >= 0) {
      state.retryConfig.baseDelayMs = Math.trunc(raw.retryConfig.baseDelayMs);
    }
  }
  if (raw.completionSummary && typeof raw.completionSummary === 'object') {
    state.completionSummary = {
      completedAt: typeof raw.completionSummary.completedAt === 'string' ? raw.completionSummary.completedAt : null,
      totalTenders: Number.isFinite(raw.completionSummary.totalTenders) ? Math.trunc(raw.completionSummary.totalTenders) : 0,
      successCount: Number.isFinite(raw.completionSummary.successCount) ? Math.trunc(raw.completionSummary.successCount) : 0,
      failedCount: Number.isFinite(raw.completionSummary.failedCount) ? Math.trunc(raw.completionSummary.failedCount) : 0,
      skippedCount: Number.isFinite(raw.completionSummary.skippedCount) ? Math.trunc(raw.completionSummary.skippedCount) : 0,
      durationMs: Number.isFinite(raw.completionSummary.durationMs) ? Math.trunc(raw.completionSummary.durationMs) : 0
    };
  }
  if (state.currentTenderIndex > state.tenders.length) {
    state.currentTenderIndex = 0;
  }
  return state;
}

function getProcessedTenderIds() {
  return new Promise(function(resolve) {
    chrome.storage.local.get(DUPLICATE_STORAGE_KEY, function(result) {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      var ids = result && result[DUPLICATE_STORAGE_KEY];
      if (Array.isArray(ids)) {
        resolve(ids);
      } else {
        resolve([]);
      }
    });
  });
}

function addProcessedTenderId(tenderId) {
  if (!tenderId || typeof tenderId !== 'string') return Promise.resolve();
  return getProcessedTenderIds().then(function(ids) {
    if (ids.indexOf(tenderId) !== -1) return;
    ids.push(tenderId);
    var toStore = {};
    toStore[DUPLICATE_STORAGE_KEY] = ids;
    return new Promise(function(resolve, reject) {
      chrome.storage.local.set(toStore, function() {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  });
}

function isTenderProcessed(tenderId) {
  if (!tenderId || typeof tenderId !== 'string') return Promise.resolve(false);
  return getProcessedTenderIds().then(function(ids) {
    return ids.indexOf(tenderId) !== -1;
  });
}

function clearProcessedTenderIds() {
  return new Promise(function(resolve, reject) {
    chrome.storage.local.remove(DUPLICATE_STORAGE_KEY, function() {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

// resetBatch is defined in batch-processor.js
