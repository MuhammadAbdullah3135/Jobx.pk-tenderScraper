const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');
const batchStateCode = readFileSync(join(base, 'src/shared/batch-state.js'), 'utf-8');

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
  }
};

eval(batchStateCode);

var SAMPLE_TENDERS = [
  { listingPosition: 1, originalListingTitle: 'Tender One', detailUrl: 'https://www.jobz.pk/one_tenders-1.html' },
  { listingPosition: 2, originalListingTitle: 'Tender Two', detailUrl: 'https://www.jobz.pk/two_tenders-2.html' },
  { listingPosition: 3, originalListingTitle: 'Tender Three', detailUrl: 'https://www.jobz.pk/three_tenders-3.html' }
];

// ---- 1. createEmptyBatchState ----
describe('createEmptyBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('returns an object', () => {
    var s = createEmptyBatchState();
    assert.strictEqual(typeof s, 'object');
    assert.notStrictEqual(s, null);
  });

  it('batchId is null', () => {
    assert.strictEqual(createEmptyBatchState().batchId, null);
  });

  it('pageNumber is null', () => {
    assert.strictEqual(createEmptyBatchState().pageNumber, null);
  });

  it('pageUrl is null', () => {
    assert.strictEqual(createEmptyBatchState().pageUrl, null);
  });

  it('createdAt and updatedAt are null', () => {
    var s = createEmptyBatchState();
    assert.strictEqual(s.createdAt, null);
    assert.strictEqual(s.updatedAt, null);
  });

  it('currentTenderIndex is 0', () => {
    assert.strictEqual(createEmptyBatchState().currentTenderIndex, 0);
  });

  it('totalTenders is 0', () => {
    assert.strictEqual(createEmptyBatchState().totalTenders, 0);
  });

  it('all count fields are 0', () => {
    var s = createEmptyBatchState();
    assert.strictEqual(s.processedCount, 0);
    assert.strictEqual(s.successCount, 0);
    assert.strictEqual(s.failedCount, 0);
    assert.strictEqual(s.skippedCount, 0);
  });

  it('batchStatus is Idle', () => {
    assert.strictEqual(createEmptyBatchState().batchStatus, 'Idle');
  });

  it('tenders is empty array', () => {
    var s = createEmptyBatchState();
    assert.ok(Array.isArray(s.tenders));
    assert.strictEqual(s.tenders.length, 0);
  });
});

// ---- 2. createBatchState ----
describe('createBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('produces a valid batch state', () => {
    var s = createBatchState(1, 'https://www.jobz.pk/tenders-1/', SAMPLE_TENDERS);
    assert.strictEqual(typeof s.batchId, 'string');
    assert.ok(s.batchId.length > 0);
    assert.strictEqual(s.pageNumber, 1);
    assert.strictEqual(s.pageUrl, 'https://www.jobz.pk/tenders-1/');
    assert.strictEqual(typeof s.createdAt, 'string');
    assert.strictEqual(s.updatedAt, s.createdAt);
    assert.strictEqual(s.currentTenderIndex, 0);
    assert.strictEqual(s.totalTenders, 3);
    assert.strictEqual(s.processedCount, 0);
    assert.strictEqual(s.batchStatus, 'Idle');
    assert.strictEqual(s.tenders.length, 3);
  });

  it('generates unique batchIds across calls', () => {
    var s1 = createBatchState(1, 'url', []);
    var s2 = createBatchState(1, 'url', []);
    assert.notStrictEqual(s1.batchId, s2.batchId);
  });

  it('sets pageNumber to null for non-positive values', () => {
    assert.strictEqual(createBatchState(0, 'url', []).pageNumber, null);
    assert.strictEqual(createBatchState(-1, 'url', []).pageNumber, null);
  });

  it('sets pageNumber to null for non-number', () => {
    assert.strictEqual(createBatchState(null, 'url', []).pageNumber, null);
    assert.strictEqual(createBatchState(undefined, 'url', []).pageNumber, null);
    assert.strictEqual(createBatchState('abc', 'url', []).pageNumber, null);
  });

  it('sets pageUrl to null for non-string', () => {
    assert.strictEqual(createBatchState(1, null, []).pageUrl, null);
    assert.strictEqual(createBatchState(1, undefined, []).pageUrl, null);
  });

  it('handles null tenders gracefully', () => {
    var s = createBatchState(1, 'url', null);
    assert.deepStrictEqual(s.tenders, []);
    assert.strictEqual(s.totalTenders, 0);
  });

  it('deep copies the tenders array', () => {
    var tenders = [{ listingPosition: 1, originalListingTitle: 'Test' }];
    var s = createBatchState(1, 'url', tenders);
    tenders.push({ listingPosition: 2, originalListingTitle: 'Extra' });
    assert.strictEqual(s.tenders.length, 1);
    assert.notStrictEqual(s.tenders, tenders);
  });

  it('accepts empty tenders array', () => {
    var s = createBatchState(1, 'url', []);
    assert.deepStrictEqual(s.tenders, []);
    assert.strictEqual(s.totalTenders, 0);
  });
});

// ---- 3. getBatchState ----
describe('getBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('returns empty state when storage is empty', function() {
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, null);
      assert.strictEqual(state.currentTenderIndex, 0);
      assert.strictEqual(state.totalTenders, 0);
      assert.strictEqual(state.batchStatus, 'Idle');
      assert.deepStrictEqual(state.tenders, []);
    });
  });

  it('returns previously saved state', function() {
    var original = createBatchState(2, 'https://www.jobz.pk/tenders-2/', SAMPLE_TENDERS);
    return saveBatchState(original).then(function() {
      return getBatchState().then(function(loaded) {
        assert.strictEqual(loaded.batchId, original.batchId);
        assert.strictEqual(loaded.pageNumber, 2);
        assert.strictEqual(loaded.totalTenders, 3);
        assert.strictEqual(loaded.tenders.length, 3);
      });
    });
  });

  it('returns empty state for non-object stored value', function() {
    mockData['tenderBatchState'] = 'not an object';
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, null);
      assert.strictEqual(state.currentTenderIndex, 0);
    });
  });

  it('returns empty state when stored value is null', function() {
    mockData['tenderBatchState'] = null;
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, null);
    });
  });

  it('recovers from partial state with missing fields', function() {
    mockData['tenderBatchState'] = { batchId: 'abc123' };
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, 'abc123');
      assert.strictEqual(state.pageNumber, null);
      assert.strictEqual(state.totalTenders, 0);
      assert.strictEqual(state.batchStatus, 'Idle');
    });
  });

  it('handles chrome.runtime.lastError gracefully', function() {
    chrome.runtime.lastError = { message: 'Storage error' };
    return getBatchState().then(function(state) {
      chrome.runtime.lastError = null;
      assert.strictEqual(state.batchId, null);
      assert.strictEqual(state.currentTenderIndex, 0);
    });
  });
});

// ---- 4. saveBatchState ----
describe('saveBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('saves state to storage', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      assert.ok(mockData.hasOwnProperty('tenderBatchState'));
      assert.strictEqual(mockData['tenderBatchState'].batchId, state.batchId);
    });
  });

  it('updates updatedAt on save', function() {
    var state = createBatchState(1, 'url', []);
    state.updatedAt = 'old-timestamp';
    return saveBatchState(state).then(function() {
      assert.notStrictEqual(mockData['tenderBatchState'].updatedAt, 'old-timestamp');
      assert.strictEqual(typeof mockData['tenderBatchState'].updatedAt, 'string');
    });
  });

  it('overwrites existing saved state', function() {
    var first = createBatchState(1, 'url', []);
    return saveBatchState(first).then(function() {
      var second = createBatchState(2, 'url2', []);
      return saveBatchState(second).then(function() {
        assert.strictEqual(mockData['tenderBatchState'].batchId, second.batchId);
        assert.strictEqual(mockData['tenderBatchState'].pageNumber, 2);
      });
    });
  });

  it('rejects invalid state', function() {
    return saveBatchState(null).then(function() {
      assert.fail('Should have rejected');
    }).catch(function(err) {
      assert.ok(err instanceof Error);
      assert.ok(err.message.indexOf('Invalid batch state') !== -1);
    });
  });

  it('rejects state with non-array tenders', function() {
    var state = createBatchState(1, 'url', []);
    state.tenders = 'not-an-array';
    return saveBatchState(state).then(function() {
      assert.fail('Should have rejected');
    }).catch(function(err) {
      assert.ok(err instanceof Error);
    });
  });

  it('persists tenders data in storage', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      var stored = mockData['tenderBatchState'];
      assert.strictEqual(stored.tenders.length, 3);
      assert.strictEqual(stored.tenders[0].originalListingTitle, 'Tender One');
    });
  });
});

// ---- 5. clearBatchState ----
describe('clearBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('removes state from storage', function() {
    var state = createBatchState(1, 'url', []);
    return saveBatchState(state).then(function() {
      return clearBatchState().then(function() {
        assert.strictEqual(mockData.hasOwnProperty('tenderBatchState'), false);
      });
    });
  });

  it('resolves when storage is already empty', function() {
    return clearBatchState().then(function() {
      assert.strictEqual(mockData.hasOwnProperty('tenderBatchState'), false);
    });
  });

  it('idempotent — calling twice does not error', function() {
    return clearBatchState().then(function() {
      return clearBatchState();
    });
  });

  it('getBatchState returns empty after clear', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return clearBatchState().then(function() {
        return getBatchState().then(function(loaded) {
          assert.strictEqual(loaded.batchId, null);
          assert.strictEqual(loaded.totalTenders, 0);
        });
      });
    });
  });
});

// ---- 6. updateBatchState ----
describe('updateBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('updates a single field', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return updateBatchState({ currentTenderIndex: 1 }).then(function(updated) {
        assert.strictEqual(updated.currentTenderIndex, 1);
        assert.strictEqual(updated.pageNumber, 1);
        assert.strictEqual(updated.totalTenders, 3);
      });
    });
  });

  it('updates multiple fields', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return updateBatchState({
        currentTenderIndex: 2,
        processedCount: 1,
        successCount: 1,
        batchStatus: 'Processing'
      }).then(function(updated) {
        assert.strictEqual(updated.currentTenderIndex, 2);
        assert.strictEqual(updated.processedCount, 1);
        assert.strictEqual(updated.successCount, 1);
        assert.strictEqual(updated.batchStatus, 'Processing');
      });
    });
  });

  it('preserves fields not in updates', function() {
    var state = createBatchState(5, 'some-url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return updateBatchState({ processedCount: 2 }).then(function(updated) {
        assert.strictEqual(updated.processedCount, 2);
        assert.strictEqual(updated.pageNumber, 5);
        assert.strictEqual(updated.tenders.length, 3);
        assert.strictEqual(updated.totalTenders, 3);
      });
    });
  });

  it('does not update updatedAt directly but save overwrites it', function() {
    var state = createBatchState(1, 'url', []);
    return saveBatchState(state).then(function() {
      return updateBatchState({ updatedAt: 'manually-set' }).then(function(updated) {
        assert.notStrictEqual(updated.updatedAt, 'manually-set');
        assert.strictEqual(typeof updated.updatedAt, 'string');
      });
    });
  });

  it('returns unchanged state for null updates', function() {
    var state = createBatchState(1, 'url', []);
    return saveBatchState(state).then(function() {
      return updateBatchState(null).then(function(updated) {
        assert.strictEqual(updated.batchId, state.batchId);
        assert.strictEqual(updated.pageNumber, 1);
      });
    });
  });

  it('persists updates to storage', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return updateBatchState({ batchStatus: 'Completed' }).then(function() {
        assert.strictEqual(mockData['tenderBatchState'].batchStatus, 'Completed');
      });
    });
  });
});

// ---- 7. validateBatchState ----
describe('validateBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('accepts a valid empty state', () => {
    var result = validateBatchState(createEmptyBatchState());
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it('accepts a fully populated valid state', () => {
    var state = createBatchState(3, 'https://www.jobz.pk/tenders-3/', SAMPLE_TENDERS);
    state.batchStatus = 'Processing';
    state.currentTenderIndex = 1;
    state.processedCount = 1;
    state.successCount = 1;
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, true);
  });

  it('rejects null', () => {
    var result = validateBatchState(null);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects non-object', () => {
    assert.strictEqual(validateBatchState('string').valid, false);
    assert.strictEqual(validateBatchState(42).valid, false);
    assert.strictEqual(validateBatchState(undefined).valid, false);
  });

  it('rejects non-string batchId', () => {
    var state = createEmptyBatchState();
    state.batchId = 123;
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(function(e) { return e.indexOf('batchId') !== -1; }));
  });

  it('rejects non-positive pageNumber', () => {
    var state = createEmptyBatchState();
    state.pageNumber = 0;
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, false);
  });

  it('rejects negative currentTenderIndex', () => {
    var state = createEmptyBatchState();
    state.currentTenderIndex = -1;
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, false);
  });

  it('rejects invalid batchStatus', () => {
    var state = createEmptyBatchState();
    state.batchStatus = 'Unknown';
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, false);
  });

  it('rejects non-array tenders', () => {
    var state = createEmptyBatchState();
    state.tenders = 'string';
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, false);
  });

  it('rejects negative count fields', () => {
    var state = createEmptyBatchState();
    state.processedCount = -1;
    assert.strictEqual(validateBatchState(state).valid, false);
    state = createEmptyBatchState();
    state.failedCount = -5;
    assert.strictEqual(validateBatchState(state).valid, false);
  });

  it('rejects non-numeric totalTenders', () => {
    var state = createEmptyBatchState();
    state.totalTenders = 'three';
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, false);
  });

  it('returns multiple errors simultaneously', () => {
    var state = {
      batchId: 123,
      pageNumber: 'abc',
      batchStatus: 'Bad',
      tenders: 'oops'
    };
    var result = validateBatchState(state);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length >= 4);
  });
});

// ---- 8. recoverBatchState ----
describe('recoverBatchState', () => {
  beforeEach(function() { mockData = {}; });

  it('returns valid empty state for null', () => {
    var r = recoverBatchState(null);
    assert.strictEqual(r.batchId, null);
    assert.strictEqual(r.currentTenderIndex, 0);
    assert.strictEqual(r.batchStatus, 'Idle');
  });

  it('returns valid empty state for undefined', () => {
    var r = recoverBatchState(undefined);
    assert.strictEqual(r.batchId, null);
    assert.strictEqual(r.totalTenders, 0);
  });

  it('returns valid empty state for non-object string', () => {
    var r = recoverBatchState('corrupted');
    assert.strictEqual(r.batchId, null);
  });

  it('returns valid empty state for number', () => {
    var r = recoverBatchState(42);
    assert.strictEqual(r.batchId, null);
  });

  it('returns valid empty state for array', () => {
    var r = recoverBatchState([1, 2, 3]);
    assert.strictEqual(r.batchId, null);
  });

  it('preserves valid batchId', () => {
    var r = recoverBatchState({ batchId: 'abc-123' });
    assert.strictEqual(r.batchId, 'abc-123');
  });

  it('preserves valid pageNumber', () => {
    var r = recoverBatchState({ pageNumber: 5 });
    assert.strictEqual(r.pageNumber, 5);
  });

  it('rejects non-positive pageNumber', () => {
    assert.strictEqual(recoverBatchState({ pageNumber: 0 }).pageNumber, null);
    assert.strictEqual(recoverBatchState({ pageNumber: -1 }).pageNumber, null);
  });

  it('preserves valid tenders array', () => {
    var r = recoverBatchState({ tenders: SAMPLE_TENDERS });
    assert.strictEqual(r.tenders.length, 3);
    assert.strictEqual(r.totalTenders, 3);
  });

  it('clamps out-of-bounds currentTenderIndex', () => {
    var r = recoverBatchState({ currentTenderIndex: 10, tenders: SAMPLE_TENDERS });
    assert.strictEqual(r.currentTenderIndex, 0);
    assert.strictEqual(r.tenders.length, 3);
  });

  it('preserves valid currentTenderIndex within bounds', () => {
    var r = recoverBatchState({ currentTenderIndex: 2, tenders: SAMPLE_TENDERS });
    assert.strictEqual(r.currentTenderIndex, 2);
  });

  it('preserves valid batchStatus', () => {
    assert.strictEqual(recoverBatchState({ batchStatus: 'Processing' }).batchStatus, 'Processing');
    assert.strictEqual(recoverBatchState({ batchStatus: 'Completed' }).batchStatus, 'Completed');
    assert.strictEqual(recoverBatchState({ batchStatus: 'Failed' }).batchStatus, 'Failed');
  });

  it('replaces invalid batchStatus with Idle', () => {
    var r = recoverBatchState({ batchStatus: 'BadStatus' });
    assert.strictEqual(r.batchStatus, 'Idle');
  });

  it('preserves valid count fields', () => {
    var r = recoverBatchState({ processedCount: 3, successCount: 2, failedCount: 1, skippedCount: 0 });
    assert.strictEqual(r.processedCount, 3);
    assert.strictEqual(r.successCount, 2);
    assert.strictEqual(r.failedCount, 1);
    assert.strictEqual(r.skippedCount, 0);
  });

  it('rejects negative counts', () => {
    var r = recoverBatchState({ processedCount: -5 });
    assert.strictEqual(r.processedCount, 0);
  });

  it('recovers totalTenders from tenders length when absent', () => {
    var r = recoverBatchState({ tenders: SAMPLE_TENDERS });
    assert.strictEqual(r.totalTenders, 3);
  });

  it('uses explicit totalTenders when provided', () => {
    var r = recoverBatchState({ totalTenders: 10, tenders: [] });
    assert.strictEqual(r.totalTenders, 10);
  });
});

// ---- 9. Serialization round-trip ----
describe('Serialization round-trip', () => {
  beforeEach(function() { mockData = {}; });

  it('save then load preserves all fields', function() {
    var state = createBatchState(2, 'https://www.jobz.pk/tenders-2/', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return getBatchState().then(function(loaded) {
        assert.strictEqual(loaded.batchId, state.batchId);
        assert.strictEqual(loaded.pageNumber, state.pageNumber);
        assert.strictEqual(loaded.pageUrl, state.pageUrl);
        assert.strictEqual(loaded.totalTenders, state.totalTenders);
        assert.strictEqual(loaded.currentTenderIndex, state.currentTenderIndex);
        assert.strictEqual(loaded.batchStatus, state.batchStatus);
        assert.strictEqual(loaded.tenders.length, state.tenders.length);
      });
    });
  });

  it('save, clear, then load returns empty state', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return clearBatchState().then(function() {
        return getBatchState().then(function(loaded) {
          assert.strictEqual(loaded.batchId, null);
          assert.strictEqual(loaded.totalTenders, 0);
        });
      });
    });
  });

  it('loaded state has fresh array (not shared reference)', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return getBatchState().then(function(loaded) {
        assert.notStrictEqual(loaded.tenders, state.tenders);
        assert.notStrictEqual(loaded.tenders, mockData['tenderBatchState'].tenders);
      });
    });
  });

  it('JSON serialization round-trips correctly', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    var json = JSON.stringify(state);
    var parsed = JSON.parse(json);
    assert.strictEqual(parsed.batchId, state.batchId);
    assert.strictEqual(parsed.tenders.length, 3);
    assert.strictEqual(parsed.batchStatus, 'Idle');
  });
});

// ---- 10. Storage corruption ----
describe('Storage corruption recovery', () => {
  beforeEach(function() { mockData = {}; });

  it('handles non-object stored value', function() {
    mockData['tenderBatchState'] = 'corrupted string';
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, null);
      assert.strictEqual(state.currentTenderIndex, 0);
    });
  });

  it('handles number stored value', function() {
    mockData['tenderBatchState'] = 42;
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchStatus, 'Idle');
    });
  });

  it('handles null stored value', function() {
    mockData['tenderBatchState'] = null;
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, null);
    });
  });

  it('handles partial corrupt state (missing tenders)', function() {
    mockData['tenderBatchState'] = { batchId: 'abc', currentTenderIndex: 5 };
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, 'abc');
      assert.strictEqual(state.currentTenderIndex, 0);
      assert.strictEqual(state.totalTenders, 0);
    });
  });

  it('handles invalid batchStatus in stored state', function() {
    mockData['tenderBatchState'] = {
      batchId: 'abc',
      batchStatus: 'RUNNING',
      tenders: [],
      currentTenderIndex: 0
    };
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchStatus, 'Idle');
    });
  });

  it('handles type mismatches in stored state', function() {
    mockData['tenderBatchState'] = {
      batchId: 'abc',
      pageNumber: 'one',
      currentTenderIndex: 'hello',
      totalTenders: 'many',
      batchStatus: 'Idle',
      tenders: []
    };
    return getBatchState().then(function(state) {
      assert.strictEqual(state.batchId, 'abc');
      assert.strictEqual(state.pageNumber, null);
      assert.strictEqual(state.currentTenderIndex, 0);
      assert.strictEqual(state.totalTenders, 0);
    });
  });

  it('state after corruption recovery passes validateBatchState', function() {
    mockData['tenderBatchState'] = { batchId: 42, currentTenderIndex: -3, batchStatus: 'BROKEN' };
    return getBatchState().then(function(state) {
      var validation = validateBatchState(state);
      assert.strictEqual(validation.valid, true);
    });
  });

  it('handles negative count fields in stored state', function() {
    mockData['tenderBatchState'] = {
      batchId: 'abc',
      processedCount: -10,
      successCount: -5,
      tenders: [],
      batchStatus: 'Idle',
      currentTenderIndex: 0
    };
    return getBatchState().then(function(state) {
      assert.strictEqual(state.processedCount, 0);
      assert.strictEqual(state.successCount, 0);
    });
  });
});

// ---- 11. Edge cases ----
describe('Edge cases', () => {
  beforeEach(function() { mockData = {}; });

  it('empty tender array is valid', function() {
    var state = createBatchState(1, 'url', []);
    assert.strictEqual(state.totalTenders, 0);
    var validation = validateBatchState(state);
    assert.strictEqual(validation.valid, true);
  });

  it('batchId is a non-empty string', function() {
    var state = createBatchState(1, 'url', []);
    assert.strictEqual(typeof state.batchId, 'string');
    assert.ok(state.batchId.length > 0);
  });

  it('pageUrl can contain special characters', function() {
    var state = createBatchState(1, 'https://www.jobz.pk/tenders-1/?q=test&x=1', []);
    assert.strictEqual(state.pageUrl, 'https://www.jobz.pk/tenders-1/?q=test&x=1');
  });

  it('updateBatchState with empty object does not change state', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return updateBatchState({}).then(function(updated) {
        assert.strictEqual(updated.batchId, state.batchId);
        assert.strictEqual(updated.currentTenderIndex, 0);
        assert.strictEqual(updated.totalTenders, 3);
      });
    });
  });

  it('saveBatchState handles large tender arrays', function() {
    var largeTenders = [];
    for (var i = 0; i < 100; i++) {
      largeTenders.push({ listingPosition: i + 1, originalListingTitle: 'Tender ' + (i + 1), detailUrl: 'https://www.jobz.pk/tender_' + (i + 1) + '_tenders-' + (i + 1) + '.html' });
    }
    var state = createBatchState(1, 'url', largeTenders);
    return saveBatchState(state).then(function() {
      assert.strictEqual(mockData['tenderBatchState'].tenders.length, 100);
    });
  });

  it('createBatchState truncates decimal pageNumber', function() {
    var state = createBatchState(3.7, 'url', []);
    assert.strictEqual(state.pageNumber, 3);
  });

  it('concurrent updates via sequential promises work', function() {
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return updateBatchState({ currentTenderIndex: 1 });
    }).then(function() {
      return updateBatchState({ currentTenderIndex: 2 });
    }).then(function() {
      return getBatchState().then(function(loaded) {
        assert.strictEqual(loaded.currentTenderIndex, 2);
      });
    });
  });

  it('clearBatchState does not affect other storage keys', function() {
    mockData['otherKey'] = 'otherValue';
    var state = createBatchState(1, 'url', SAMPLE_TENDERS);
    return saveBatchState(state).then(function() {
      return clearBatchState().then(function() {
        assert.strictEqual(mockData.hasOwnProperty('tenderBatchState'), false);
        assert.strictEqual(mockData['otherKey'], 'otherValue');
      });
    });
  });
});
