/**
 * Phase 5B — Tender detail HTML parser pure-helper tests.
 * Tests pure functions defined in tender-detail-parser.js that do not require DOMParser.
 * DOMParser-dependent functions (parseTenderDetail, stripUnwantedElements, etc.)
 * require a browser environment and are not tested here.
 *
 * Fixture HTML files for browser testing are in tests/fixtures/.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');
const parserCode = readFileSync(join(base, 'src/offscreen/tender-detail-parser.js'), 'utf-8');
eval(parserCode);

// ---- 1. METADATA_LABEL_ALIASES structure ----

describe('METADATA_LABEL_ALIASES', () => {
  it('has all 8 metadata keys', () => {
    var expectedKeys = ['datePosted', 'category', 'province', 'location', 'subcategory', 'sector', 'newspaper', 'lastDate'];
    for (var i = 0; i < expectedKeys.length; i++) {
      assert.strictEqual(METADATA_LABEL_ALIASES.hasOwnProperty(expectedKeys[i]), true, 'Missing key: ' + expectedKeys[i]);
    }
  });

  it('each key maps to an array with at least one alias', () => {
    for (var key in METADATA_LABEL_ALIASES) {
      assert.ok(Array.isArray(METADATA_LABEL_ALIASES[key]), 'Value for ' + key + ' is not an array');
      assert.ok(METADATA_LABEL_ALIASES[key].length >= 1, 'Value for ' + key + ' is empty');
    }
  });

  it('each alias is a non-empty string', () => {
    for (var key in METADATA_LABEL_ALIASES) {
      var aliases = METADATA_LABEL_ALIASES[key];
      for (var i = 0; i < aliases.length; i++) {
        assert.strictEqual(typeof aliases[i], 'string', 'Alias for ' + key + '[' + i + '] is not a string');
        assert.ok(aliases[i].length > 0, 'Alias for ' + key + '[' + i + '] is empty');
      }
    }
  });

  it('does not have duplicate aliases within a key', () => {
    for (var key in METADATA_LABEL_ALIASES) {
      var aliases = METADATA_LABEL_ALIASES[key];
      for (var i = 0; i < aliases.length; i++) {
        for (var j = i + 1; j < aliases.length; j++) {
          assert.notStrictEqual(normalizeLabel(aliases[i]), normalizeLabel(aliases[j]),
            'Duplicate alias in ' + key + ': "' + aliases[i] + '" and "' + aliases[j] + '"');
        }
      }
    }
  });
});

// ---- 2. normalizeLabel ----

describe('normalizeLabel', () => {
  it('lowercases the label', () => {
    assert.strictEqual(normalizeLabel('Date Posted'), 'date posted');
  });

  it('trims whitespace', () => {
    assert.strictEqual(normalizeLabel('  Last Date  '), 'last date');
  });

  it('removes trailing colons', () => {
    assert.strictEqual(normalizeLabel('Category:'), 'category');
  });

  it('removes trailing asterisks', () => {
    assert.strictEqual(normalizeLabel('Province*'), 'province');
  });

  it('removes parenthetical content', () => {
    assert.strictEqual(normalizeLabel('Last Date of Submission (Date)'), 'last date of submission');
  });

  it('normalizes non-breaking spaces', () => {
    assert.strictEqual(normalizeLabel('Date\u00A0Posted'), 'date posted');
  });

  it('collapses multiple spaces', () => {
    assert.strictEqual(normalizeLabel('Bid   Submission   Date'), 'bid submission date');
  });

  it('handles empty string', () => {
    assert.strictEqual(normalizeLabel(''), '');
  });

  it('handles non-string input', () => {
    assert.strictEqual(normalizeLabel(null), '');
    assert.strictEqual(normalizeLabel(undefined), '');
    assert.strictEqual(normalizeLabel(42), '');
  });

  it('preserves meaningful internal spaces', () => {
    assert.strictEqual(normalizeLabel('Tender Category'), 'tender category');
  });
});

// ---- 3. matchLabel ----

describe('matchLabel', () => {
  it('exact match', () => {
    assert.strictEqual(matchLabel('Date Posted', ['date posted', 'posted date']), true);
  });

  it('alias contained in label', () => {
    assert.strictEqual(matchLabel('Last Date of Submission', ['last date']), true);
  });

  it('label contained in alias', () => {
    assert.strictEqual(matchLabel('date', ['date posted', 'posted date']), true);
  });

  it('no match returns false', () => {
    assert.strictEqual(matchLabel('Tender Number', ['date posted']), false);
  });

  it('handles label with colon', () => {
    assert.strictEqual(matchLabel('Category:', ['category']), true);
  });

  it('handles label with parenthetical', () => {
    assert.strictEqual(matchLabel('Last Date (PKR)', ['last date']), true);
  });

  it('returns false for empty label', () => {
    assert.strictEqual(matchLabel('', ['date posted']), false);
  });

  it('returns false for non-string label', () => {
    assert.strictEqual(matchLabel(null, ['date posted']), false);
  });

  it('works with case-insensitive matching', () => {
    assert.strictEqual(matchLabel('DATE POSTED', ['date posted']), true);
  });

  it('matches against multiple aliases', () => {
    assert.strictEqual(matchLabel('Deadline', ['last date', 'closing date', 'deadline']), true);
  });
});

// ---- 4. addWarning ----

describe('addWarning', () => {
  it('adds a warning to an array', () => {
    var arr = [];
    addWarning(arr, 'test warning');
    assert.deepStrictEqual(arr, ['test warning']);
  });

  it('deduplicates identical warnings', () => {
    var arr = ['warning one'];
    addWarning(arr, 'warning one');
    assert.deepStrictEqual(arr, ['warning one']);
    assert.strictEqual(arr.length, 1);
  });

  it('creates array from null/undefined', () => {
    var result = addWarning(null, 'new warning');
    assert.deepStrictEqual(result, ['new warning']);
  });

  it('preserves existing warnings while adding new ones', () => {
    var arr = ['first', 'second'];
    addWarning(arr, 'third');
    assert.deepStrictEqual(arr, ['first', 'second', 'third']);
  });

  it('returns the array reference', () => {
    var arr = [];
    var returned = addWarning(arr, 'test');
    assert.strictEqual(returned, arr);
  });
});

// ---- 5. isValidImageUrl ----

describe('isValidImageUrl', () => {
  it('accepts https image URL with .jpg', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/tenders/ad-66063.jpg'), true);
  });

  it('accepts http image URL (protocol tolerant)', () => {
    assert.strictEqual(isValidImageUrl('http://www.jobz.pk/images/tenders/ad-66063.png'), true);
  });

  it('accepts .jpeg extension', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/tenders/photo.jpeg'), true);
  });

  it('accepts .webp extension', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/tenders/photo.webp'), true);
  });

  it('accepts URL with query string', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/tenders/ad-66063.jpg?w=600'), true);
  });

  it('rejects data: URI', () => {
    assert.strictEqual(isValidImageUrl('data:image/png;base64,iVBORw0KGgo='), false);
  });

  it('rejects blob: URI', () => {
    assert.strictEqual(isValidImageUrl('blob:https://www.jobz.pk/uuid-123'), false);
  });

  it('rejects javascript: URI', () => {
    assert.strictEqual(isValidImageUrl('javascript:void(0)'), false);
  });

  it('rejects URL with logo in filename', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/logo.png'), false);
  });

  it('rejects URL with favicon in filename', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/favicon.ico'), false);
  });

  it('rejects URL with banner in filename', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/banner-top.jpg'), false);
  });

  it('rejects URL with advertisement in filename', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/advertisement-1.jpg'), false);
  });

  it('rejects URL with tracking pixel', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/tracking-pixel.png'), false);
  });

  it('rejects URL without image extension', () => {
    assert.strictEqual(isValidImageUrl('https://www.jobz.pk/images/tenders/ad-66063'), false);
  });

  it('rejects empty string', () => {
    assert.strictEqual(isValidImageUrl(''), false);
  });

  it('rejects non-string input', () => {
    assert.strictEqual(isValidImageUrl(null), false);
    assert.strictEqual(isValidImageUrl(undefined), false);
  });
});

// ---- 6. isImageAllowedHost ----

describe('isImageAllowedHost', () => {
  it('accepts www.jobz.pk', () => {
    assert.strictEqual(isImageAllowedHost('https://www.jobz.pk/images/test.jpg'), true);
  });

  it('accepts jobz.pk (without www)', () => {
    assert.strictEqual(isImageAllowedHost('https://jobz.pk/images/test.jpg'), true);
  });

  it('rejects external host', () => {
    assert.strictEqual(isImageAllowedHost('https://other-site.com/images/test.jpg'), false);
  });

  it('rejects non-string input', () => {
    assert.strictEqual(isImageAllowedHost(null), false);
    assert.strictEqual(isImageAllowedHost(undefined), false);
  });

  it('rejects malformed URL', () => {
    assert.strictEqual(isImageAllowedHost('not-a-url'), false);
  });
});

// ---- 7. canonicalizeImageUrl ----

describe('canonicalizeImageUrl', () => {
  it('keeps absolute HTTPS URL unchanged', () => {
    var url = 'https://www.jobz.pk/images/tenders/ad-66063.jpg';
    assert.strictEqual(canonicalizeImageUrl(url, 'https://www.jobz.pk/tender_tenders-66063.html'), url);
  });

  it('upgrades HTTP to HTTPS', () => {
    var result = canonicalizeImageUrl('http://www.jobz.pk/images/tenders/ad-66063.jpg', 'https://www.jobz.pk/tender_tenders-66063.html');
    assert.strictEqual(result, 'https://www.jobz.pk/images/tenders/ad-66063.jpg');
  });

  it('resolves relative URL', () => {
    var result = canonicalizeImageUrl('/images/tenders/ad-66063.jpg', 'https://www.jobz.pk/tender_tenders-66063.html');
    assert.strictEqual(result, 'https://www.jobz.pk/images/tenders/ad-66063.jpg');
  });

  it('removes fragment from URL', () => {
    var result = canonicalizeImageUrl('https://www.jobz.pk/images/tenders/ad-66063.jpg#section', 'https://www.jobz.pk/tender_tenders-66063.html');
    assert.strictEqual(result, 'https://www.jobz.pk/images/tenders/ad-66063.jpg');
  });

  it('returns null for empty URL', () => {
    assert.strictEqual(canonicalizeImageUrl('', 'https://www.jobz.pk/'), null);
  });

  it('returns null for non-string URL', () => {
    assert.strictEqual(canonicalizeImageUrl(null, 'https://www.jobz.pk/'), null);
    assert.strictEqual(canonicalizeImageUrl(undefined, 'https://www.jobz.pk/'), null);
  });

  it('returns null for unresolvable relative URL without sourceUrl', () => {
    assert.strictEqual(canonicalizeImageUrl('/images/test.jpg', null), null);
  });
});

// ---- 8. truncateDescription ----

describe('truncateDescription', () => {
  it('returns short text unchanged', () => {
    var text = 'Short description.';
    assert.strictEqual(truncateDescription(text, 50000), text);
  });

  it('returns empty string for non-string input', () => {
    assert.strictEqual(truncateDescription(null, 50000), '');
    assert.strictEqual(truncateDescription(undefined, 50000), '');
    assert.strictEqual(truncateDescription(42, 50000), '');
  });

  it('uses default maxLength when not provided', () => {
    var long = 'a'.repeat(60000);
    var result = truncateDescription(long);
    assert.ok(result.length < 55000);
    assert.ok(result.indexOf('truncated') !== -1);
  });

  it('appends truncation warning when truncated', () => {
    var long = 'a'.repeat(60000);
    var result = truncateDescription(long, 100);
    assert.ok(result.indexOf('The description was truncated.') !== -1);
  });

  it('preserves Unicode characters during truncation', () => {
    var star = '\u{1F31F}';
    var text = star.repeat(30);
    var result = truncateDescription(text, 10);
    assert.ok(result.indexOf(star) !== -1, 'Expected star in result, got: ' + JSON.stringify(result));
    assert.ok(result.indexOf('\uFFFD') === -1);
  });

  it('returns empty string for empty input', () => {
    assert.strictEqual(truncateDescription('', 50000), '');
  });

  it('does not truncate text exactly at maxLength', () => {
    var exact = 'a'.repeat(100);
    assert.strictEqual(truncateDescription(exact, 100), exact);
  });

  it('uses 1 as minimum maxLength', () => {
    var result = truncateDescription('Hello world', 1);
    assert.ok(result.indexOf('The description was truncated.') !== -1);
  });
});

// ---- 9. normalizeCellText ----

describe('normalizeCellText', () => {
  it('trims whitespace', () => {
    assert.strictEqual(normalizeCellText('  Lahore  '), 'Lahore');
  });

  it('removes trailing colons', () => {
    assert.strictEqual(normalizeCellText('Lahore:'), 'Lahore');
  });

  it('collapses multiple spaces', () => {
    assert.strictEqual(normalizeCellText('Lahore   City'), 'Lahore City');
  });

  it('normalizes non-breaking spaces', () => {
    assert.strictEqual(normalizeCellText('Lahore\u00A0City'), 'Lahore City');
  });

  it('handles empty string', () => {
    assert.strictEqual(normalizeCellText(''), '');
  });

  it('handles non-string input', () => {
    assert.strictEqual(normalizeCellText(null), '');
    assert.strictEqual(normalizeCellText(undefined), '');
  });

  it('preserves meaningful punctuation', () => {
    assert.strictEqual(normalizeCellText('15 Aug 2026'), '15 Aug 2026');
  });

  it('handles whitespace-only input', () => {
    assert.strictEqual(normalizeCellText('   \n  '), '');
  });
});

// ---- 10. DOMParser not available in Node ----

describe('DOMParser availability', () => {
  it('DOMParser is not available in Node.js (informational)', () => {
    assert.strictEqual(typeof DOMParser, 'undefined');
  });

  it('parseTenderDetail requires DOMParser (informational)', () => {
    assert.strictEqual(typeof parseTenderDetail, 'function');
  });

  it('fixture files are available for browser testing', () => {
    var fixtureDir = join(base, 'tests', 'fixtures');
    var files = require('fs').readdirSync(fixtureDir);
    assert.ok(files.length > 0, 'fixtures directory should contain files');
    assert.ok(files.some(function(f) { return f.indexOf('.html') !== -1; }), 'should contain .html files');
  });
});
