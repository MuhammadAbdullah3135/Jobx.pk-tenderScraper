/**
 * Phase 4A — Pure utility tests
 * Tests whitespace normalization, title prefix removal, sanitization,
 * sequence formatting, ID extraction, URL canonicalization, validation,
 * pagination, timestamps, batch paths, and folder naming.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');

eval(utilitiesCode + '\n' + namingCode + '\n' + urlsCode);

// ---------------------------------------------------------------------------
// 1. Whitespace normalization
// ---------------------------------------------------------------------------
describe('normalizeWhitespace', () => {
  it('collapses multiple spaces', () => {
    assert.strictEqual(
      normalizeWhitespace('  Supply   of\nSchool\tBooks  '),
      'Supply of School Books'
    );
  });

  it('handles tabs and newlines', () => {
    assert.strictEqual(
      normalizeWhitespace('Hello\t\nWorld'),
      'Hello World'
    );
  });

  it('replaces non-breaking spaces', () => {
    assert.strictEqual(
      normalizeWhitespace('Punjab\u00A0Tender'),
      'Punjab Tender'
    );
  });

  it('returns empty string for null', () => {
    assert.strictEqual(normalizeWhitespace(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.strictEqual(normalizeWhitespace(undefined), '');
  });

  it('converts numbers to string', () => {
    assert.strictEqual(normalizeWhitespace(42), '42');
  });

  it('returns empty for whitespace-only input', () => {
    assert.strictEqual(normalizeWhitespace('   \t\n  '), '');
  });
});

// ---------------------------------------------------------------------------
// 2. Title prefix removal
// ---------------------------------------------------------------------------
describe('removeTenderTitlePrefix', () => {
  it('removes standard prefix', () => {
    assert.strictEqual(
      removeTenderTitlePrefix('Tender for the Supply of School Books'),
      'Supply of School Books'
    );
  });

  it('handles uppercase prefix', () => {
    assert.strictEqual(
      removeTenderTitlePrefix('TENDER FOR THE Construction of Boundary Wall'),
      'Construction of Boundary Wall'
    );
  });

  it('handles flexible internal prefix whitespace', () => {
    assert.strictEqual(
      removeTenderTitlePrefix(' Tender   for   the   Medical Equipment '),
      'Medical Equipment'
    );
  });

  it('preserves middle occurrence', () => {
    assert.strictEqual(
      removeTenderTitlePrefix('New Tender for the Supply of Books'),
      'New Tender for the Supply of Books'
    );
  });

  it('preserves non-prefix text', () => {
    assert.strictEqual(
      removeTenderTitlePrefix('Construction Tender for the City'),
      'Construction Tender for the City'
    );
  });

  it('returns Unknown Tender for prefix-only value', () => {
    assert.strictEqual(
      removeTenderTitlePrefix('Tender for the'),
      'Unknown Tender'
    );
  });

  it('returns Unknown Tender for empty input', () => {
    assert.strictEqual(removeTenderTitlePrefix(''), 'Unknown Tender');
  });

  it('returns Unknown Tender for whitespace input', () => {
    assert.strictEqual(removeTenderTitlePrefix('   '), 'Unknown Tender');
  });
});

// ---------------------------------------------------------------------------
// 3. Sanitization
// ---------------------------------------------------------------------------
describe('sanitizePathComponent', () => {
  it('replaces invalid Windows characters', () => {
    assert.strictEqual(
      sanitizePathComponent('Supply: Books / Stationery?'),
      'Supply- Books - Stationery'
    );
  });

  it('removes ASCII control characters', () => {
    assert.strictEqual(sanitizePathComponent('Test\x00File\x01Name'), 'TestFileName');
  });

  it('trims leading and trailing whitespace', () => {
    assert.strictEqual(sanitizePathComponent('   Report...   '), 'Report');
  });

  it('removes trailing periods', () => {
    assert.strictEqual(sanitizePathComponent('Report...'), 'Report');
  });

  it('collapses repeated separators', () => {
    assert.strictEqual(sanitizePathComponent('A---B'), 'A-B');
  });

  it('returns Unknown Tender for empty string', () => {
    assert.strictEqual(sanitizePathComponent(''), 'Unknown Tender');
  });

  it('returns Unknown Tender for invalid-character-only', () => {
    assert.strictEqual(sanitizePathComponent('***'), 'Unknown Tender');
  });

  it('returns Unknown Tender for dot-only string', () => {
    assert.strictEqual(sanitizePathComponent('..'), 'Unknown Tender');
  });

  it('handles Windows reserved name CON', () => {
    assert.strictEqual(sanitizePathComponent('CON'), '_CON');
  });

  it('handles reserved name with extension con.txt', () => {
    assert.strictEqual(sanitizePathComponent('con.txt'), '_con.txt');
  });

  it('handles reserved name LPT1', () => {
    assert.strictEqual(sanitizePathComponent('LPT1'), '_LPT1');
  });

  it('truncates long titles to 100 Unicode chars', () => {
    var long = 'A'.repeat(200);
    var result = sanitizePathComponent(long);
    assert.strictEqual(result.length, 100);
    assert.strictEqual(result, 'A'.repeat(100));
  });

  it('does not split Unicode surrogate pairs', () => {
    var emoji = '🍀'.repeat(60); // 60 × 2 code units = 120, but only 60 code points
    var result = sanitizePathComponent(emoji);
    // Each emoji is 2 code units but 1 code point; max 100 code points
    assert.strictEqual(Array.from(result).length, 60); // All fit
  });

  it('handles null input', () => {
    assert.strictEqual(sanitizePathComponent(null), 'Unknown Tender');
  });

  it('handles undefined input', () => {
    assert.strictEqual(sanitizePathComponent(undefined), 'Unknown Tender');
  });
});

// ---------------------------------------------------------------------------
// 4. Path-traversal prevention
// ---------------------------------------------------------------------------
describe('preventPathTraversal', () => {
  it('handles parent directory traversal input', () => {
    assert.strictEqual(preventPathTraversal('../../Secret'), 'Secret');
  });

  it('handles drive-letter input', () => {
    assert.strictEqual(preventPathTraversal('C:\\Windows\\System32'), 'Windows/System32');
  });

  it('handles network-path input', () => {
    var result = preventPathTraversal('\\\\server\\share');
    assert.strictEqual(result.indexOf('\\\\'), -1);
    assert.strictEqual(result.indexOf('\\'), -1);
    assert.ok(result.length > 0);
  });

  it('handles mixed traversal', () => {
    assert.strictEqual(preventPathTraversal('foo/../../bar'), 'foo/bar');
  });

  it('returns empty string for non-string input', () => {
    assert.strictEqual(preventPathTraversal(null), '');
    assert.strictEqual(preventPathTraversal(undefined), '');
    assert.strictEqual(preventPathTraversal(42), '');
  });
});

// ---------------------------------------------------------------------------
// 5. Sequence formatting
// ---------------------------------------------------------------------------
describe('formatSequenceNumber', () => {
  it('1 becomes 001', () => {
    assert.strictEqual(formatSequenceNumber(1), '001');
  });

  it('12 becomes 012', () => {
    assert.strictEqual(formatSequenceNumber(12), '012');
  });

  it('100 remains 100', () => {
    assert.strictEqual(formatSequenceNumber(100), '100');
  });

  it('1000 remains 1000', () => {
    assert.strictEqual(formatSequenceNumber(1000), '1000');
  });

  it('invalid value becomes 001', () => {
    assert.strictEqual(formatSequenceNumber(-5), '001');
    assert.strictEqual(formatSequenceNumber(0), '001');
    assert.strictEqual(formatSequenceNumber(null), '001');
    assert.strictEqual(formatSequenceNumber(undefined), '001');
    assert.strictEqual(formatSequenceNumber('abc'), '001');
  });

  it('accepts numeric string', () => {
    assert.strictEqual(formatSequenceNumber('5'), '005');
  });
});

// ---------------------------------------------------------------------------
// 6. Tender ID extraction
// ---------------------------------------------------------------------------
describe('extractTenderId', () => {
  it('extracts ID from standard detail URL', () => {
    assert.strictEqual(
      extractTenderId('https://www.jobz.pk/tender-for-the-supply-of-items_tenders-66063.html'),
      '66063'
    );
  });

  it('extracts ID with query string', () => {
    assert.strictEqual(
      extractTenderId('https://www.jobz.pk/example_tenders-12345.html?tracking=abc'),
      '12345'
    );
  });

  it('extracts ID with fragment', () => {
    assert.strictEqual(
      extractTenderId('https://www.jobz.pk/example_tenders-777.html#section'),
      '777'
    );
  });

  it('returns null for listing URL', () => {
    assert.strictEqual(
      extractTenderId('https://www.jobz.pk/tenders-1/'),
      null
    );
  });

  it('returns null for unrelated URL', () => {
    assert.strictEqual(
      extractTenderId('https://www.example.com/sample_tenders-123.html'),
      null
    );
  });

  it('returns null for invalid URL', () => {
    assert.strictEqual(extractTenderId('not-a-url'), null);
  });

  it('returns null for non-string input', () => {
    assert.strictEqual(extractTenderId(null), null);
    assert.strictEqual(extractTenderId(undefined), null);
  });
});

// ---------------------------------------------------------------------------
// 7. URL canonicalization
// ---------------------------------------------------------------------------
describe('canonicalizeJobzUrl', () => {
  it('resolves relative Jobz.pk URL', () => {
    assert.strictEqual(
      canonicalizeJobzUrl('/sample_tenders-66063.html'),
      'https://www.jobz.pk/sample_tenders-66063.html'
    );
  });

  it('normalizes jobz.pk to www.jobz.pk', () => {
    var result = canonicalizeJobzUrl('http://jobz.pk/sample_tenders-66063.html');
    assert.ok(result.indexOf('www.jobz.pk') !== -1);
  });

  it('normalizes HTTP to HTTPS', () => {
    var result = canonicalizeJobzUrl('http://www.jobz.pk/sample_tenders-66063.html');
    assert.ok(result.indexOf('https://') === 0);
  });

  it('removes fragment', () => {
    var result = canonicalizeJobzUrl('https://www.jobz.pk/sample.html#section');
    assert.strictEqual(result.indexOf('#'), -1);
  });

  it('returns null for unrelated host', () => {
    assert.strictEqual(
      canonicalizeJobzUrl('https://example.com/sample_tenders-66063.html'),
      null
    );
  });

  it('returns null for JavaScript URL', () => {
    assert.strictEqual(canonicalizeJobzUrl('javascript:alert(1)'), null);
  });

  it('returns null for mailto URL', () => {
    assert.strictEqual(canonicalizeJobzUrl('mailto:test@example.com'), null);
  });

  it('returns null for tel URL', () => {
    assert.strictEqual(canonicalizeJobzUrl('tel:12345'), null);
  });

  it('returns null for data URL', () => {
    assert.strictEqual(canonicalizeJobzUrl('data:text/plain,hello'), null);
  });

  it('returns null for empty string', () => {
    assert.strictEqual(canonicalizeJobzUrl(''), null);
  });

  it('returns null for non-string input', () => {
    assert.strictEqual(canonicalizeJobzUrl(null), null);
  });
});

// ---------------------------------------------------------------------------
// 8. Tender detail URL validation
// ---------------------------------------------------------------------------
describe('validateTenderDetailUrl', () => {
  it('validates valid tender URL', () => {
    var result = validateTenderDetailUrl('https://www.jobz.pk/sample_tenders-66063.html');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tenderId, '66063');
    assert.ok(result.canonicalUrl.indexOf('https://www.jobz.pk/') === 0);
  });

  it('validates HTTP jobz.pk tender URL', () => {
    var result = validateTenderDetailUrl('http://jobz.pk/another-example_tenders-123.html');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tenderId, '123');
    assert.ok(result.canonicalUrl.indexOf('https://www.jobz.pk/') === 0);
  });

  it('rejects listing URL', () => {
    var result = validateTenderDetailUrl('https://www.jobz.pk/tenders-1/');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.tenderId, null);
  });

  it('rejects home page', () => {
    var result = validateTenderDetailUrl('https://www.jobz.pk/');
    assert.strictEqual(result.valid, false);
  });

  it('rejects unrelated host', () => {
    var result = validateTenderDetailUrl('https://example.com/sample_tenders-66063.html');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.canonicalUrl, null);
  });

  it('rejects missing numeric ID', () => {
    var result = validateTenderDetailUrl('https://www.jobz.pk/no-id-here.html');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.tenderId, null);
  });

  it('rejects JavaScript URL', () => {
    var result = validateTenderDetailUrl('javascript:void(0)');
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.canonicalUrl, null);
  });

  it('rejects empty string', () => {
    var result = validateTenderDetailUrl('');
    assert.strictEqual(result.valid, false);
  });
});

// ---------------------------------------------------------------------------
// 9. Pagination normalization
// ---------------------------------------------------------------------------
describe('normalizePaginationNumber', () => {
  it('returns same for positive number', () => {
    assert.strictEqual(normalizePaginationNumber(3), 3);
  });

  it('parses numeric string', () => {
    assert.strictEqual(normalizePaginationNumber('3'), 3);
  });

  it('truncates decimal toward zero', () => {
    assert.strictEqual(normalizePaginationNumber(2.8), 2);
  });

  it('returns 1 for zero', () => {
    assert.strictEqual(normalizePaginationNumber(0), 1);
  });

  it('returns 1 for negative value', () => {
    assert.strictEqual(normalizePaginationNumber(-5), 1);
  });

  it('returns 1 for invalid string', () => {
    assert.strictEqual(normalizePaginationNumber('abc'), 1);
  });

  it('returns 1 for null', () => {
    assert.strictEqual(normalizePaginationNumber(null), 1);
  });

  it('returns 1 for undefined', () => {
    assert.strictEqual(normalizePaginationNumber(undefined), 1);
  });
});

// ---------------------------------------------------------------------------
// 10. Timestamp
// ---------------------------------------------------------------------------
describe('createLocalTimestamp', () => {
  it('returns correct format for exact date', () => {
    var result = createLocalTimestamp(new Date(2026, 6, 28, 11, 42, 30));
    assert.strictEqual(result, '2026-07-28_11-42-30');
  });

  it('pads single-digit month and day', () => {
    var result = createLocalTimestamp(new Date(2026, 0, 5, 3, 4, 5));
    assert.strictEqual(result, '2026-01-05_03-04-05');
  });

  it('handles invalid date by returning current timestamp', () => {
    var result = createLocalTimestamp('not-a-date');
    // Should return something like YYYY-MM-DD_HH-mm-ss
    assert.ok(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(result));
  });

  it('handles no argument', () => {
    var result = createLocalTimestamp();
    assert.ok(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(result));
  });
});

// ---------------------------------------------------------------------------
// 11. Batch folder path
// ---------------------------------------------------------------------------
describe('createBatchFolderPath', () => {
  it('returns correct batch path', () => {
    var date = new Date(2026, 6, 28, 11, 42, 30);
    assert.strictEqual(
      createBatchFolderPath(3, date),
      'Tender/2026-07-28_11-42-30_Page-3'
    );
  });

  it('uses pagination fallback for invalid page', () => {
    var date = new Date(2026, 6, 28, 11, 42, 30);
    var result = createBatchFolderPath(0, date);
    assert.ok(result.indexOf('Page-1') !== -1);
  });

  it('has no leading slash', () => {
    var date = new Date(2026, 6, 28, 11, 42, 30);
    var result = createBatchFolderPath(1, date);
    assert.ok(result[0] !== '/' && result[0] !== '\\');
    assert.strictEqual(result[0], 'T');
  });

  it('has no backslashes', () => {
    var date = new Date(2026, 6, 28, 11, 42, 30);
    var result = createBatchFolderPath(1, date);
    assert.strictEqual(result.indexOf('\\'), -1);
  });

  it('has no path traversal', () => {
    var date = new Date(2026, 6, 28, 11, 42, 30);
    var result = createBatchFolderPath(1, date);
    assert.strictEqual(result.indexOf('..'), -1);
  });
});

// ---------------------------------------------------------------------------
// 12. Tender folder name
// ---------------------------------------------------------------------------
describe('createTenderFolderName', () => {
  it('removes prefix and includes sequence', () => {
    assert.strictEqual(
      createTenderFolderName(1, 'Tender for the Supply of School Books'),
      '001_Supply of School Books'
    );
  });

  it('uses sanitized title for invalid title', () => {
    assert.strictEqual(
      createTenderFolderName(3, '***'),
      '003_Unknown Tender'
    );
  });

  it('uses fallback for empty title', () => {
    assert.strictEqual(
      createTenderFolderName(2, ''),
      '002_Unknown Tender'
    );
  });

  it('produces different names for different sequences', () => {
    var name1 = createTenderFolderName(1, 'Test Tender');
    var name2 = createTenderFolderName(2, 'Test Tender');
    assert.notStrictEqual(name1, name2);
    assert.ok(name1.indexOf('001_') === 0);
    assert.ok(name2.indexOf('002_') === 0);
  });

  it('sanitizes reserved name in title', () => {
    var result = createTenderFolderName(2, 'Tender for the CON');
    // Title "CON" becomes "_CON" after sanitization
    assert.ok(result.indexOf('_CON') !== -1);
    // The complete name starts with "002_", so it's not itself a reserved name
    assert.ok(result.indexOf('002_') === 0);
  });
});

// ---------------------------------------------------------------------------
// 13. Safe fallback title
// ---------------------------------------------------------------------------
describe('createSafeFallbackTitle', () => {
  it('returns normalized value for usable input', () => {
    assert.strictEqual(createSafeFallbackTitle('  Hello  '), 'Hello');
  });

  it('returns Unknown Tender for empty input', () => {
    assert.strictEqual(createSafeFallbackTitle(''), 'Unknown Tender');
  });

  it('returns Unknown Tender for whitespace input', () => {
    assert.strictEqual(createSafeFallbackTitle('   '), 'Unknown Tender');
  });

  it('returns Unknown Tender for null', () => {
    assert.strictEqual(createSafeFallbackTitle(null), 'Unknown Tender');
  });
});

// ---------------------------------------------------------------------------
// 14. Edge cases
// ---------------------------------------------------------------------------
describe('Edge cases', () => {
  it('validateTenderDetailUrl removes query from canonical URL', () => {
    var result = validateTenderDetailUrl('https://www.jobz.pk/test_tenders-555.html?tracking=abc');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.tenderId, '555');
    assert.strictEqual(result.canonicalUrl.indexOf('?'), -1);
  });

  it('normalizeWhitespace does not modify capitalization', () => {
    assert.strictEqual(normalizeWhitespace('  TENDER   TITLE  '), 'TENDER TITLE');
  });

  it('normalizeWhitespace does not remove punctuation', () => {
    assert.strictEqual(normalizeWhitespace('Tender: Supply (Books)'), 'Tender: Supply (Books)');
  });

  it('sanitizePathComponent allows underscores', () => {
    assert.strictEqual(sanitizePathComponent('my_file_name'), 'my_file_name');
  });

  it('sanitizePathComponent allows hyphens', () => {
    assert.strictEqual(sanitizePathComponent('multi-word-title'), 'multi-word-title');
  });

  it('extractTenderId works with no-www jobz.pk', () => {
    assert.strictEqual(
      extractTenderId('http://jobz.pk/sample_tenders-987.html'),
      '987'
    );
  });

  it('batch path uses correct separators', () => {
    var date = new Date(2026, 6, 28, 11, 42, 30);
    var result = createBatchFolderPath(1, date);
    assert.strictEqual(result.match(/\//g).length, 1); // Only one slash
    assert.strictEqual(result.match(/_/g).length, 2); // Two underscores (ts + Page)
  });
});
