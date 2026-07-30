/**
 * Phase 4C — Comprehensive test hardening for all Phase 4 functions.
 * Covers 212 required test cases across all Phase 4A and Phase 4B modules.
 * Fills coverage gaps from phase4a.test.cjs and phase4b.test.cjs.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

var base = join(__dirname, '..');

var utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
var namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
var urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
var tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');

eval(utilitiesCode + '\n' + namingCode + '\n' + urlsCode + '\n' + tenderModelCode);

// ===========================================================================
// Whitespace normalization (cases 1–10)
// ===========================================================================
describe('normalizeWhitespace', () => {
  it('1. multiple spaces collapse', () => {
    assert.strictEqual(normalizeWhitespace('  a   b  '), 'a b');
  });

  it('2. tabs become spaces', () => {
    assert.strictEqual(normalizeWhitespace('a\tb'), 'a b');
  });

  it('3. newlines become spaces', () => {
    assert.strictEqual(normalizeWhitespace('a\nb'), 'a b');
  });

  it('4. carriage returns become spaces', () => {
    assert.strictEqual(normalizeWhitespace('a\rb'), 'a b');
  });

  it('5. non-breaking spaces normalize', () => {
    assert.strictEqual(normalizeWhitespace('a\u00A0b'), 'a b');
  });

  it('6. leading and trailing whitespace removed', () => {
    assert.strictEqual(normalizeWhitespace('  abc  '), 'abc');
  });

  it('7. null becomes empty string', () => {
    assert.strictEqual(normalizeWhitespace(null), '');
  });

  it('8. undefined becomes empty string', () => {
    assert.strictEqual(normalizeWhitespace(undefined), '');
  });

  it('9. numeric primitive handled safely', () => {
    assert.strictEqual(normalizeWhitespace(42), '42');
  });

  it('10. boolean primitive handled safely', () => {
    assert.strictEqual(normalizeWhitespace(true), 'true');
    assert.strictEqual(normalizeWhitespace(false), 'false');
  });
});

// ===========================================================================
// Prefix removal (cases 11–20)
// ===========================================================================
describe('removeTenderTitlePrefix', () => {
  it('11. standard prefix removed', () => {
    assert.strictEqual(removeTenderTitlePrefix('Tender for the Supply'), 'Supply');
  });

  it('12. uppercase prefix removed', () => {
    assert.strictEqual(removeTenderTitlePrefix('TENDER FOR THE Supply'), 'Supply');
  });

  it('13. mixed-case prefix removed', () => {
    assert.strictEqual(removeTenderTitlePrefix('Tender For The Supply'), 'Supply');
  });

  it('14. flexible whitespace inside prefix accepted', () => {
    assert.strictEqual(removeTenderTitlePrefix('Tender   for   the   Supply'), 'Supply');
  });

  it('15. leading whitespace before prefix accepted', () => {
    assert.strictEqual(removeTenderTitlePrefix('  Tender for the Supply'), 'Supply');
  });

  it('16. prefix in the middle preserved', () => {
    assert.strictEqual(removeTenderTitlePrefix('New Tender for the Supply'), 'New Tender for the Supply');
  });

  it('17. similar but incomplete prefix preserved', () => {
    assert.strictEqual(removeTenderTitlePrefix('Tender for School'), 'Tender for School');
  });

  it('18. prefix-only title becomes Unknown Tender', () => {
    assert.strictEqual(removeTenderTitlePrefix('Tender for the'), 'Unknown Tender');
  });

  it('19. empty title becomes Unknown Tender', () => {
    assert.strictEqual(removeTenderTitlePrefix(''), 'Unknown Tender');
  });

  it('20. null title becomes Unknown Tender', () => {
    assert.strictEqual(removeTenderTitlePrefix(null), 'Unknown Tender');
  });
});

// ===========================================================================
// Windows-safe sanitization (cases 21–60)
// ===========================================================================
describe('sanitizePathComponent', () => {
  it('21. < replaced', () => {
    assert.strictEqual(sanitizePathComponent('a<b'), 'a-b');
  });

  it('22. > replaced', () => {
    assert.strictEqual(sanitizePathComponent('a>b'), 'a-b');
  });

  it('23. : replaced', () => {
    assert.strictEqual(sanitizePathComponent('a:b'), 'a-b');
  });

  it('24. " replaced', () => {
    assert.strictEqual(sanitizePathComponent('a"b'), 'a-b');
  });

  it('25. / replaced', () => {
    assert.strictEqual(sanitizePathComponent('a/b'), 'a-b');
  });

  it('26. \\ replaced', () => {
    assert.strictEqual(sanitizePathComponent('a\\b'), 'a-b');
  });

  it('27. | replaced', () => {
    assert.strictEqual(sanitizePathComponent('a|b'), 'a-b');
  });

  it('28. ? replaced', () => {
    assert.strictEqual(sanitizePathComponent('a?b'), 'a-b');
  });

  it('29. * replaced', () => {
    assert.strictEqual(sanitizePathComponent('a*b'), 'a-b');
  });

  it('30. multiple invalid characters collapse predictably', () => {
    assert.strictEqual(sanitizePathComponent('a<:>b'), 'a-b');
  });

  it('31. ASCII control characters removed', () => {
    assert.strictEqual(sanitizePathComponent('a\x01b\x02c'), 'abc');
  });

  it('32. null characters removed', () => {
    assert.strictEqual(sanitizePathComponent('a\x00b'), 'ab');
  });

  it('33. tabs and newlines normalize safely', () => {
    assert.strictEqual(sanitizePathComponent('a\t\nb'), 'a b');
  });

  it('34. leading spaces removed', () => {
    assert.strictEqual(sanitizePathComponent('  abc'), 'abc');
  });

  it('35. trailing spaces removed', () => {
    assert.strictEqual(sanitizePathComponent('abc  '), 'abc');
  });

  it('36. trailing periods removed', () => {
    assert.strictEqual(sanitizePathComponent('abc...'), 'abc');
  });

  it('37. repeated replacement separators collapse', () => {
    assert.strictEqual(sanitizePathComponent('a---b'), 'a-b');
  });

  it('38. empty input becomes Unknown Tender', () => {
    assert.strictEqual(sanitizePathComponent(''), 'Unknown Tender');
  });

  it('39. invalid-only input becomes Unknown Tender', () => {
    assert.strictEqual(sanitizePathComponent('***'), 'Unknown Tender');
  });

  it('40. . becomes Unknown Tender', () => {
    assert.strictEqual(sanitizePathComponent('.'), 'Unknown Tender');
  });

  it('41. .. becomes Unknown Tender', () => {
    assert.strictEqual(sanitizePathComponent('..'), 'Unknown Tender');
  });

  it('42. ... becomes Unknown Tender', () => {
    assert.strictEqual(sanitizePathComponent('...'), 'Unknown Tender');
  });

  it('43. CON made safe', () => {
    assert.strictEqual(sanitizePathComponent('CON'), '_CON');
  });

  it('44. con made safe', () => {
    assert.strictEqual(sanitizePathComponent('con'), '_con');
  });

  it('45. CON.txt made safe', () => {
    assert.strictEqual(sanitizePathComponent('CON.txt'), '_CON.txt');
  });

  it('46. PRN made safe', () => {
    assert.strictEqual(sanitizePathComponent('PRN'), '_PRN');
  });

  it('47. AUX made safe', () => {
    assert.strictEqual(sanitizePathComponent('AUX'), '_AUX');
  });

  it('48. NUL made safe', () => {
    assert.strictEqual(sanitizePathComponent('NUL'), '_NUL');
  });

  it('49. CLOCK$ made safe', () => {
    assert.strictEqual(sanitizePathComponent('CLOCK$'), '_CLOCK$');
  });

  it('50. COM1 made safe', () => {
    assert.strictEqual(sanitizePathComponent('COM1'), '_COM1');
  });

  it('51. COM9 made safe', () => {
    assert.strictEqual(sanitizePathComponent('COM9'), '_COM9');
  });

  it('52. LPT1 made safe', () => {
    assert.strictEqual(sanitizePathComponent('LPT1'), '_LPT1');
  });

  it('53. LPT9 made safe', () => {
    assert.strictEqual(sanitizePathComponent('LPT9'), '_LPT9');
  });

  it('54. non-reserved similar names remain readable', () => {
    assert.strictEqual(sanitizePathComponent('CONTROL'), 'CONTROL');
    assert.strictEqual(sanitizePathComponent('CONSORTIUM'), 'CONSORTIUM');
    assert.strictEqual(sanitizePathComponent('COMMITTEE'), 'COMMITTEE');
    assert.strictEqual(sanitizePathComponent('COMPANY'), 'COMPANY');
  });

  it('55. long titles stay within documented limit', () => {
    var long = 'A'.repeat(200);
    assert.strictEqual(sanitizePathComponent(long).length, 100);
  });

  it('56. truncation does not end with space', () => {
    var s = 'A'.repeat(99) + '  ';
    var result = sanitizePathComponent(s);
    assert.strictEqual(result.length <= 100, true);
    assert.strictEqual(result.endsWith(' '), false);
  });

  it('57. truncation does not end with period', () => {
    var s = 'A'.repeat(99) + '...';
    var result = sanitizePathComponent(s);
    assert.strictEqual(result.length <= 100, true);
    assert.strictEqual(result.endsWith('.'), false);
  });

  it('58. truncation does not end with separator', () => {
    var s = 'A'.repeat(99) + '---';
    var result = sanitizePathComponent(s);
    assert.strictEqual(result.length <= 100, true);
    assert.strictEqual(result.endsWith('-'), false);
  });

  it('59. Unicode surrogate pair not split', () => {
    var emoji = '🍀'.repeat(55);
    var result = sanitizePathComponent(emoji);
    assert.strictEqual(Array.from(result).length, 55);
  });

  it('60. non-Latin readable Unicode remains usable', () => {
    var result = sanitizePathComponent('担当者選定');
    assert.strictEqual(result, '担当者選定');
  });
});

// ===========================================================================
// Path-traversal protection (cases 61–73)
// ===========================================================================
describe('preventPathTraversal', () => {
  it('61. ../../Secret cannot escape', () => {
    assert.strictEqual(preventPathTraversal('../../Secret'), 'Secret');
  });

  it('62. ..\\..\\Secret cannot escape', () => {
    assert.strictEqual(preventPathTraversal('..\\..\\Secret'), 'Secret');
  });

  it('63. /etc/passwd cannot become absolute', () => {
    var r = preventPathTraversal('/etc/passwd');
    assert.strictEqual(r.indexOf('/etc/'), -1);
  });

  it('64. \\Windows\\System32 cannot become absolute', () => {
    var r = preventPathTraversal('\\Windows\\System32');
    assert.strictEqual(r.indexOf('\\'), -1);
  });

  it('65. C:\\Windows\\System32 cannot become drive path', () => {
    var r = preventPathTraversal('C:\\Windows\\System32');
    assert.strictEqual(r.indexOf('C:'), -1);
    assert.strictEqual(r.indexOf('\\'), -1);
  });

  it('66. C:folder cannot become drive-relative', () => {
    var r = preventPathTraversal('C:folder');
    assert.strictEqual(r.indexOf(':'), -1);
  });

  it('67. \\\\server\\share cannot become network path', () => {
    var r = preventPathTraversal('\\\\server\\share');
    assert.strictEqual(r.indexOf('\\\\'), -1);
    assert.strictEqual(r.indexOf('\\'), -1);
  });

  it('68. //server/share cannot become network path', () => {
    var r = preventPathTraversal('//server/share');
    assert.strictEqual(r.indexOf('//'), -1);
  });

  it('69. generated paths contain no .. segment', () => {
    assert.strictEqual(createBatchFolderPath(1).indexOf('..'), -1);
    assert.strictEqual(createTenderFolderName(1, 'Test').indexOf('..'), -1);
  });

  it('70. generated paths use forward slashes only', () => {
    var batch = createBatchFolderPath(1);
    assert.strictEqual(batch.indexOf('\\'), -1);
    var folder = createTenderFolderName(1, 'Test');
    assert.strictEqual(folder.indexOf('\\'), -1);
  });

  it('71. generated batch path begins with Tender/', () => {
    assert.strictEqual(createBatchFolderPath(1).indexOf('Tender/'), 0);
  });

  it('72. generated path does not begin with slash', () => {
    var batch = createBatchFolderPath(1);
    assert.strictEqual(batch[0] !== '/' && batch[0] !== '\\', true);
    var folder = createTenderFolderName(1, 'Test');
    assert.strictEqual(folder[0] !== '/' && folder[0] !== '\\', true);
  });

  it('73. generated path does not end with slash', () => {
    var batch = createBatchFolderPath(1);
    assert.strictEqual(batch.endsWith('/'), false);
    assert.strictEqual(batch.endsWith('\\'), false);
  });
});

// ===========================================================================
// Sequence formatting (cases 74–86)
// ===========================================================================
describe('formatSequenceNumber', () => {
  it('74. 1 becomes 001', () => { assert.strictEqual(formatSequenceNumber(1), '001'); });
  it('75. 2 becomes 002', () => { assert.strictEqual(formatSequenceNumber(2), '002'); });
  it('76. 12 becomes 012', () => { assert.strictEqual(formatSequenceNumber(12), '012'); });
  it('77. 100 remains 100', () => { assert.strictEqual(formatSequenceNumber(100), '100'); });
  it('78. 999 remains 999', () => { assert.strictEqual(formatSequenceNumber(999), '999'); });
  it('79. 1000 remains 1000', () => { assert.strictEqual(formatSequenceNumber(1000), '1000'); });
  it('80. zero falls back to 001', () => { assert.strictEqual(formatSequenceNumber(0), '001'); });
  it('81. negative falls back to 001', () => { assert.strictEqual(formatSequenceNumber(-5), '001'); });

  it('82. decimal uses Math.floor (2.5 → 002)', () => {
    assert.strictEqual(formatSequenceNumber(2.5), '002');
  });

  it('83. NaN falls back to 001', () => { assert.strictEqual(formatSequenceNumber(NaN), '001'); });
  it('84. Infinity falls back to 001', () => { assert.strictEqual(formatSequenceNumber(Infinity), '001'); });
  it('85. invalid string falls back to 001', () => { assert.strictEqual(formatSequenceNumber('abc'), '001'); });
  it('86. valid numeric string handled consistently', () => {
    assert.strictEqual(formatSequenceNumber('7'), '007');
    assert.strictEqual(formatSequenceNumber(' 3 '), '003');
  });
});

// ===========================================================================
// Timestamp (cases 87–95)
// ===========================================================================
describe('createLocalTimestamp', () => {
  it('87. exact Date produces exact output', () => {
    assert.strictEqual(
      createLocalTimestamp(new Date(2026, 6, 28, 11, 42, 30)),
      '2026-07-28_11-42-30'
    );
  });

  it('88. month is padded', () => {
    assert.strictEqual(
      createLocalTimestamp(new Date(2026, 0, 5, 3, 4, 5)).substring(5, 7),
      '01'
    );
  });

  it('89. day is padded', () => {
    assert.strictEqual(
      createLocalTimestamp(new Date(2026, 0, 5, 3, 4, 5)).substring(8, 10),
      '05'
    );
  });

  it('90. hour is padded', () => {
    assert.strictEqual(
      createLocalTimestamp(new Date(2026, 0, 5, 3, 4, 5)).substring(11, 13),
      '03'
    );
  });

  it('91. minute is padded', () => {
    assert.strictEqual(
      createLocalTimestamp(new Date(2026, 0, 5, 3, 4, 5)).substring(14, 16),
      '04'
    );
  });

  it('92. second is padded', () => {
    assert.strictEqual(
      createLocalTimestamp(new Date(2026, 0, 5, 3, 4, 5)).substring(17, 19),
      '05'
    );
  });

  it('93. output contains no colon', () => {
    var r = createLocalTimestamp(new Date(2026, 6, 28, 11, 42, 30));
    assert.strictEqual(r.indexOf(':'), -1);
  });

  it('94. output contains no timezone', () => {
    var r = createLocalTimestamp(new Date(2026, 6, 28, 11, 42, 30));
    assert.strictEqual(r.indexOf('+'), -1);
    assert.strictEqual(r.indexOf('Z'), -1);
  });

  it('95. invalid Date uses current time', () => {
    var r = createLocalTimestamp('not-a-date');
    assert.ok(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(r));
  });
});

// ===========================================================================
// Pagination normalization (cases 96–105)
// ===========================================================================
describe('normalizePaginationNumber', () => {
  it('96. positive integer unchanged', () => { assert.strictEqual(normalizePaginationNumber(5), 5); });
  it('97. numeric string converts', () => { assert.strictEqual(normalizePaginationNumber('5'), 5); });
  it('98. decimal truncates toward zero', () => { assert.strictEqual(normalizePaginationNumber(2.8), 2); });
  it('99. zero becomes 1', () => { assert.strictEqual(normalizePaginationNumber(0), 1); });
  it('100. negative becomes 1', () => { assert.strictEqual(normalizePaginationNumber(-5), 1); });
  it('101. null becomes 1', () => { assert.strictEqual(normalizePaginationNumber(null), 1); });
  it('102. undefined becomes 1', () => { assert.strictEqual(normalizePaginationNumber(undefined), 1); });
  it('103. invalid string becomes 1', () => { assert.strictEqual(normalizePaginationNumber('abc'), 1); });
  it('104. Infinity becomes 1', () => { assert.strictEqual(normalizePaginationNumber(Infinity), 1); });
  it('105. NaN becomes 1', () => { assert.strictEqual(normalizePaginationNumber(NaN), 1); });
});

// ===========================================================================
// Batch-folder path (cases 106–115)
// ===========================================================================
describe('createBatchFolderPath', () => {
  var DATE = new Date(2026, 6, 28, 11, 42, 30);

  it('106. exact Date and page generate exact path', () => {
    assert.strictEqual(createBatchFolderPath(3, DATE), 'Tender/2026-07-28_11-42-30_Page-3');
  });

  it('107. invalid page uses Page 1', () => {
    var r = createBatchFolderPath(0, DATE);
    assert.ok(r.indexOf('Page-1') !== -1);
  });

  it('108. path begins with Tender/', () => {
    assert.strictEqual(createBatchFolderPath(1, DATE).indexOf('Tender/'), 0);
  });

  it('109. path contains timestamp', () => {
    var r = createBatchFolderPath(1, DATE);
    assert.ok(r.indexOf('2026-07-28_11-42-30') !== -1);
  });

  it('110. path contains Page-N', () => {
    assert.ok(createBatchFolderPath(5, DATE).indexOf('Page-5') !== -1);
  });

  it('111. path has no leading slash', () => {
    var r = createBatchFolderPath(1, DATE);
    assert.strictEqual(r[0] !== '/' && r[0] !== '\\', true);
  });

  it('112. path has no trailing slash', () => {
    var r = createBatchFolderPath(1, DATE);
    assert.strictEqual(r.endsWith('/'), false);
    assert.strictEqual(r.endsWith('\\'), false);
  });

  it('113. path contains no backslash', () => {
    assert.strictEqual(createBatchFolderPath(1, DATE).indexOf('\\'), -1);
  });

  it('114. path contains no traversal segment', () => {
    assert.strictEqual(createBatchFolderPath(1, DATE).indexOf('..'), -1);
  });

  it('115. path contains no invalid Windows timestamp chars', () => {
    var r = createBatchFolderPath(1, DATE);
    assert.strictEqual(r.indexOf(':'), -1);
    assert.strictEqual(r.indexOf('<'), -1);
    assert.strictEqual(r.indexOf('>'), -1);
    assert.strictEqual(r.indexOf('"'), -1);
    assert.strictEqual(r.indexOf('|'), -1);
    assert.strictEqual(r.indexOf('?'), -1);
    assert.strictEqual(r.indexOf('*'), -1);
  });
});

// ===========================================================================
// Tender-folder name (cases 116–125)
// ===========================================================================
describe('createTenderFolderName', () => {
  it('116. prefix is removed', () => {
    assert.strictEqual(createTenderFolderName(1, 'Tender for the Supply'), '001_Supply');
  });

  it('117. sequence is padded', () => {
    assert.strictEqual(createTenderFolderName(2, 'Test'), '002_Test');
  });

  it('118. invalid title is sanitized', () => {
    assert.strictEqual(createTenderFolderName(3, '***'), '003_Unknown Tender');
  });

  it('119. empty title uses fallback', () => {
    assert.strictEqual(createTenderFolderName(4, ''), '004_Unknown Tender');
  });

  it('120. prefix-only title uses fallback', () => {
    assert.strictEqual(createTenderFolderName(5, 'Tender for the'), '005_Unknown Tender');
  });

  it('121. long title remains within 104 chars', () => {
    var long = 'Tender for the ' + 'A'.repeat(200);
    var r = createTenderFolderName(1, long);
    assert.ok(r.length <= 104, 'folder name length ' + r.length + ' exceeds 104');
  });

  it('122. duplicate titles with different seq produce different names', () => {
    var r1 = createTenderFolderName(1, 'Test Tender');
    var r2 = createTenderFolderName(2, 'Test Tender');
    assert.notStrictEqual(r1, r2);
  });

  it('123. path-looking title remains safe component', () => {
    var r = createTenderFolderName(1, 'Tender for the ../../etc');
    assert.strictEqual(r.indexOf('/'), -1);
    assert.strictEqual(r.indexOf('..'), -1, 'component should not contain ".."');
  });

  it('124. reserved-name title remains safe', () => {
    var r = createTenderFolderName(1, 'Tender for the CON');
    assert.strictEqual(r.indexOf('_CON') !== -1, true);
    assert.strictEqual(r.indexOf('001_') === 0, true);
  });

  it('125. complete folder name has no slash or backslash', () => {
    var r = createTenderFolderName(1, 'Test Path/Name\\Bad');
    assert.strictEqual(r.indexOf('/'), -1);
    assert.strictEqual(r.indexOf('\\'), -1);
  });
});

// ===========================================================================
// Tender ID extraction (cases 126–137)
// ===========================================================================
describe('extractTenderId', () => {
  it('126. standard valid URL returns ID', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/x_tenders-66063.html'), '66063');
  });

  it('127. jobz.pk valid URL returns ID', () => {
    assert.strictEqual(extractTenderId('http://jobz.pk/x_tenders-123.html'), '123');
  });

  it('128. query string ignored', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/x_tenders-1.html?q=1'), '1');
  });

  it('129. fragment ignored', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/x_tenders-2.html#sec'), '2');
  });

  it('130. listing URL returns null', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/tenders-1/'), null);
  });

  it('131. home page returns null', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/'), null);
  });

  it('132. jobs URL returns null', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/jobs/'), null);
    assert.strictEqual(extractTenderId('https://www.jobz.pk/category/jobs-in-lahore/'), null);
  });

  it('133. unrelated host returns null', () => {
    assert.strictEqual(extractTenderId('https://example.com/x_tenders-5.html'), null);
  });

  it('134. JavaScript URL returns null', () => {
    assert.strictEqual(extractTenderId('javascript:void(0)'), null);
  });

  it('135. malformed URL returns null', () => {
    assert.strictEqual(extractTenderId('not-a-url'), null);
  });

  it('136. missing numeric ID returns null', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/tenders-page.html'), null);
  });

  it('137. arbitrary path number not extracted', () => {
    assert.strictEqual(extractTenderId('https://www.jobz.pk/tenders-5/'), null);
  });
});

// ===========================================================================
// Jobz.pk URL canonicalization (cases 138–149)
// ===========================================================================
describe('canonicalizeJobzUrl', () => {
  it('138. relative URL becomes absolute', () => {
    assert.strictEqual(canonicalizeJobzUrl('/page.html'), 'https://www.jobz.pk/page.html');
  });

  it('139. jobz.pk becomes www.jobz.pk', () => {
    var r = canonicalizeJobzUrl('http://jobz.pk/page.html');
    assert.ok(r.indexOf('www.jobz.pk') !== -1);
  });

  it('140. HTTP becomes HTTPS', () => {
    var r = canonicalizeJobzUrl('http://www.jobz.pk/page.html');
    assert.ok(r.indexOf('https://') === 0);
  });

  it('141. fragment removed', () => {
    assert.strictEqual(canonicalizeJobzUrl('https://www.jobz.pk/page.html#sec'), 'https://www.jobz.pk/page.html');
  });

  it('142. default HTTP port removed', () => {
    var r = canonicalizeJobzUrl('http://www.jobz.pk:80/page.html');
    assert.strictEqual(r, 'https://www.jobz.pk/page.html');
  });

  it('143. default HTTPS port removed', () => {
    var r = canonicalizeJobzUrl('https://www.jobz.pk:443/page.html');
    assert.strictEqual(r, 'https://www.jobz.pk/page.html');
  });

  it('144. path preserved', () => {
    assert.strictEqual(
      canonicalizeJobzUrl('https://www.jobz.pk/tenders-1/'),
      'https://www.jobz.pk/tenders-1/'
    );
  });

  it('145. query preserved for general canonicalization', () => {
    assert.strictEqual(
      canonicalizeJobzUrl('https://www.jobz.pk/page.html?q=1'),
      'https://www.jobz.pk/page.html?q=1'
    );
  });

  it('146. unrelated host returns null', () => {
    assert.strictEqual(canonicalizeJobzUrl('https://example.com/page.html'), null);
  });

  it('147. unsupported protocol returns null', () => {
    assert.strictEqual(canonicalizeJobzUrl('ftp://www.jobz.pk/'), null);
  });

  it('148. malformed URL returns null', () => {
    assert.strictEqual(canonicalizeJobzUrl('http://'), null);
  });

  it('149. empty input returns null', () => {
    assert.strictEqual(canonicalizeJobzUrl(''), null);
  });
});

// ===========================================================================
// Tender-detail validation (cases 150–165)
// ===========================================================================
describe('validateTenderDetailUrl', () => {
  it('150. valid canonical URL passes', () => {
    var r = validateTenderDetailUrl('https://www.jobz.pk/x_tenders-1.html');
    assert.strictEqual(r.valid, true);
  });

  it('151. valid HTTP URL passes after canonicalization', () => {
    var r = validateTenderDetailUrl('http://www.jobz.pk/x_tenders-2.html');
    assert.strictEqual(r.valid, true);
    assert.ok(r.canonicalUrl.indexOf('https://') === 0);
  });

  it('152. valid jobz.pk URL passes after host normalization', () => {
    var r = validateTenderDetailUrl('http://jobz.pk/x_tenders-3.html');
    assert.strictEqual(r.valid, true);
    assert.ok(r.canonicalUrl.indexOf('www.jobz.pk') !== -1);
  });

  it('153. relative detail URL passes', () => {
    var r = validateTenderDetailUrl('/x_tenders-4.html');
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.tenderId, '4');
  });

  it('154. listing pagination URL fails', () => {
    assert.strictEqual(validateTenderDetailUrl('https://www.jobz.pk/tenders-1/').valid, false);
  });

  it('155. home page fails', () => {
    assert.strictEqual(validateTenderDetailUrl('https://www.jobz.pk/').valid, false);
  });

  it('156. jobs page fails', () => {
    assert.strictEqual(validateTenderDetailUrl('https://www.jobz.pk/jobs/').valid, false);
  });

  it('157. category URL fails', () => {
    assert.strictEqual(validateTenderDetailUrl('https://www.jobz.pk/category/supply/').valid, false);
  });

  it('158. city URL fails', () => {
    assert.strictEqual(validateTenderDetailUrl('https://www.jobz.pk/lahore/').valid, false);
  });

  it('159. unrelated host fails', () => {
    assert.strictEqual(validateTenderDetailUrl('https://example.com/x_tenders-5.html').valid, false);
  });

  it('160. missing numeric ID fails', () => {
    var r = validateTenderDetailUrl('https://www.jobz.pk/no-id-here.html');
    assert.strictEqual(r.valid, false);
    assert.strictEqual(r.tenderId, null);
  });

  it('161. wrong extension fails', () => {
    assert.strictEqual(validateTenderDetailUrl('https://www.jobz.pk/x_tenders-1.php').valid, false);
  });

  it('162. query and fragment do not affect identity', () => {
    var r = validateTenderDetailUrl('https://www.jobz.pk/x_tenders-99.html?q=1#sec');
    assert.strictEqual(r.valid, true);
    assert.strictEqual(r.tenderId, '99');
  });

  it('163. returned canonical URL is HTTPS', () => {
    var r = validateTenderDetailUrl('http://jobz.pk/x_tenders-6.html');
    assert.ok(r.canonicalUrl.indexOf('https://') === 0);
  });

  it('164. returned canonical URL uses www.jobz.pk', () => {
    var r = validateTenderDetailUrl('http://jobz.pk/x_tenders-7.html');
    assert.ok(r.canonicalUrl.indexOf('www.jobz.pk') !== -1);
  });

  it('165. validation contains the correct tender ID', () => {
    var r = validateTenderDetailUrl('https://www.jobz.pk/x_tenders-888.html');
    assert.strictEqual(r.tenderId, '888');
  });
});

// ===========================================================================
// Normalized tender record (cases 166–204)
// ===========================================================================
var BUILD_INPUT = {
  listingPosition: 1,
  originalListingTitle: 'Tender for the Supply of Items by EED',
  city: 'LAHORE',
  datePosted: '22 Jul 2026',
  detailUrl: 'https://www.jobz.pk/build_tenders-66063.html'
};

describe('Normalized tender record', () => {
  it('166. complete valid input produces every required field', () => {
    var r = createNormalizedTenderRecord(BUILD_INPUT, 2);
    assert.strictEqual(typeof r.listingPosition, 'number');
    assert.strictEqual(typeof r.sequenceNumber, 'number');
    assert.strictEqual(typeof r.tenderId, 'string');
    assert.strictEqual(typeof r.originalListingTitle, 'string');
    assert.strictEqual(typeof r.title, 'string');
    assert.strictEqual(typeof r.city, 'string');
    assert.strictEqual(typeof r.listingDatePosted, 'string');
    assert.strictEqual(typeof r.datePosted, 'string');
    assert.strictEqual(typeof r.category, 'string');
    assert.strictEqual(typeof r.province, 'string');
    assert.strictEqual(typeof r.location, 'string');
    assert.strictEqual(typeof r.subcategory, 'string');
    assert.strictEqual(typeof r.sector, 'string');
    assert.strictEqual(typeof r.newspaper, 'string');
    assert.strictEqual(typeof r.lastDate, 'string');
    assert.strictEqual(typeof r.description, 'string');
    assert.strictEqual(typeof r.detailUrl, 'string');
    assert.ok(Array.isArray(r.imageUrls));
    assert.strictEqual(typeof r.paginationNumber, 'number');
    assert.strictEqual(typeof r.folderName, 'string');
    assert.strictEqual(typeof r.downloadStatus, 'string');
    assert.strictEqual(r.failureReason, null);
    assert.strictEqual(typeof r.fetchAttempts, 'number');
    assert.strictEqual(r.downloadedAt, null);
    assert.ok(Array.isArray(r.downloadIds));
    assert.ok(Array.isArray(r.downloadedFiles));
  });

  it('167. input object is not mutated', () => {
    var input = { listingPosition: 1, originalListingTitle: 'Test', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' };
    var frozen = JSON.stringify(input);
    createNormalizedTenderRecord(input, 1);
    assert.strictEqual(JSON.stringify(input), frozen);
  });

  it('168. listing position normalizes safely', () => {
    assert.strictEqual(createNormalizedTenderRecord({ listingPosition: 0, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' }, 1).listingPosition, 1);
  });

  it('169. sequence equals listing position', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 3, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-3.html' }, 1);
    assert.strictEqual(r.sequenceNumber, 3);
    assert.strictEqual(r.sequenceNumber, r.listingPosition);
  });

  it('170. original title normalizes whitespace', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: '  Test  Tender  ', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' }, 1);
    assert.strictEqual(r.originalListingTitle, 'Test Tender');
  });

  it('171. display title removes only initial prefix', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'Tender for the Supply', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-2.html' }, 1);
    assert.strictEqual(r.title, 'Supply');
  });

  it('172. missing title uses Unknown Tender', () => {
    assert.strictEqual(createNormalizedTenderRecord({ listingPosition: 1, city: 'X', datePosted: 'd' }, 1).originalListingTitle, 'Unknown Tender');
  });

  it('173. city normalizes', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'T', city: '  KARACHI  ', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' }, 1);
    assert.strictEqual(r.city, 'KARACHI');
  });

  it('174. missing city uses Not available', () => {
    assert.strictEqual(createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'T', datePosted: 'd' }, 1).city, 'Not available');
  });

  it('175. listing date copies into listingDatePosted', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: '22 Jul 2026', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' }, 1);
    assert.strictEqual(r.listingDatePosted, '22 Jul 2026');
  });

  it('176. missing listing date uses Not available', () => {
    assert.strictEqual(createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'T', city: 'X' }, 1).listingDatePosted, 'Not available');
  });

  it('177. datePosted remains Not available', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).datePosted, 'Not available');
  });

  it('178. category initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).category, 'Not available');
  });

  it('179. province initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).province, 'Not available');
  });

  it('180. location initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).location, 'Not available');
  });

  it('181. subcategory initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).subcategory, 'Not available');
  });

  it('182. sector initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).sector, 'Not available');
  });

  it('183. newspaper initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).newspaper, 'Not available');
  });

  it('184. last date initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).lastDate, 'Not available');
  });

  it('185. description initialized correctly', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).description, 'Not available');
  });

  it('186. valid detail URL canonicalizes', () => {
    var input = { listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'http://jobz.pk/x_tenders-555.html' };
    var r = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(r.detailUrl, 'https://www.jobz.pk/x_tenders-555.html');
  });

  it('187. tender ID derives correctly', () => {
    var r = createNormalizedTenderRecord(BUILD_INPUT, 1);
    assert.strictEqual(r.tenderId, '66063');
  });

  it('188. invalid detail URL becomes null', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/tenders-1/' }, 1);
    assert.strictEqual(r.detailUrl, null);
  });

  it('189. invalid detail URL produces null tender ID', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/tenders-1/' }, 1);
    assert.strictEqual(r.tenderId, null);
  });

  it('190. pagination normalizes', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 0).paginationNumber, 1);
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 3).paginationNumber, 3);
  });

  it('191. folder name matches sequence and title', () => {
    var r = createNormalizedTenderRecord({ listingPosition: 1, originalListingTitle: 'Tender for the Supply', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' }, 1);
    assert.strictEqual(r.folderName, '001_Supply');
  });

  it('192. download status is Pending', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).downloadStatus, 'Pending');
  });

  it('193. failure reason is null', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).failureReason, null);
  });

  it('194. fetch attempts are zero', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).fetchAttempts, 0);
  });

  it('195. downloaded timestamp is null', () => {
    assert.strictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).downloadedAt, null);
  });

  it('196. image URL array is empty', () => {
    assert.deepStrictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).imageUrls, []);
  });

  it('197. download ID array is empty', () => {
    assert.deepStrictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).downloadIds, []);
  });

  it('198. downloaded-files array is empty', () => {
    assert.deepStrictEqual(createNormalizedTenderRecord(BUILD_INPUT, 1).downloadedFiles, []);
  });

  it('199. arrays newly created on every factory call', () => {
    var r1 = createNormalizedTenderRecord(BUILD_INPUT, 1);
    var r2 = createNormalizedTenderRecord(BUILD_INPUT, 1);
    assert.notStrictEqual(r1.imageUrls, r2.imageUrls);
    assert.notStrictEqual(r1.downloadIds, r2.downloadIds);
    assert.notStrictEqual(r1.downloadedFiles, r2.downloadedFiles);
  });

  it('200. null input produces safe defaults', () => {
    var r = createNormalizedTenderRecord(null, 1);
    assert.strictEqual(r.listingPosition, 1);
    assert.strictEqual(r.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(r.city, 'Not available');
    assert.strictEqual(r.detailUrl, null);
    assert.strictEqual(r.downloadStatus, 'Pending');
  });

  it('201. undefined input produces safe defaults', () => {
    var r = createNormalizedTenderRecord(undefined, 1);
    assert.strictEqual(r.listingPosition, 1);
    assert.strictEqual(r.originalListingTitle, 'Unknown Tender');
  });

  it('202. empty object produces safe defaults', () => {
    var r = createNormalizedTenderRecord({}, 1);
    assert.strictEqual(r.listingPosition, 1);
    assert.strictEqual(r.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(r.paginationNumber, 1);
  });

  it('203. original nested input arrays are not reused', () => {
    var input = { listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html', imageUrls: ['pre-existing'] };
    var r = createNormalizedTenderRecord(input, 1);
    assert.deepStrictEqual(r.imageUrls, []);
    assert.notStrictEqual(r.imageUrls, input.imageUrls);
  });

  it('204. output record is a new object', () => {
    var input = { listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' };
    var r = createNormalizedTenderRecord(input, 1);
    assert.notStrictEqual(r, input);
  });
});

// ===========================================================================
// Batch normalization (cases 205–212)
// ===========================================================================
describe('createNormalizedTenderRecords', () => {
  it('205. input order is preserved', () => {
    var records = [
      { listingPosition: 1, originalListingTitle: 'A', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/a_tenders-1.html' },
      { listingPosition: 2, originalListingTitle: 'B', city: 'Y', datePosted: 'd', detailUrl: 'https://www.jobz.pk/b_tenders-2.html' }
    ];
    var r = createNormalizedTenderRecords(records, 1);
    assert.strictEqual(r[0].tenderId, '1');
    assert.strictEqual(r[1].tenderId, '2');
  });

  it('206. invalid detail URLs excluded from active records', () => {
    var records = [
      { listingPosition: 1, originalListingTitle: 'V', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/v_tenders-1.html' },
      { listingPosition: 2, originalListingTitle: 'I', city: 'Y', datePosted: 'd', detailUrl: 'https://www.jobz.pk/tenders-1/' }
    ];
    assert.strictEqual(createNormalizedTenderRecords(records, 1).length, 1);
  });

  it('207. raw input records are not mutated', () => {
    var records = [{ listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' }];
    var frozen = JSON.stringify(records);
    createNormalizedTenderRecords(records, 1);
    assert.strictEqual(JSON.stringify(records), frozen);
  });

  it('208. output is a new array', () => {
    var records = [{ listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' }];
    var r = createNormalizedTenderRecords(records, 1);
    assert.notStrictEqual(r, records);
  });

  it('209. duplicate references do not create shared state', () => {
    var record = { listingPosition: 1, originalListingTitle: 'T', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/x_tenders-1.html' };
    var r = createNormalizedTenderRecords([record, record], 1);
    assert.strictEqual(r.length, 2);
    assert.notStrictEqual(r[0].imageUrls, r[1].imageUrls);
  });

  it('210. empty input returns empty array', () => {
    assert.deepStrictEqual(createNormalizedTenderRecords([], 1), []);
  });

  it('211. nonarray input returns empty array', () => {
    assert.deepStrictEqual(createNormalizedTenderRecords(null, 1), []);
    assert.deepStrictEqual(createNormalizedTenderRecords(undefined, 1), []);
    assert.deepStrictEqual(createNormalizedTenderRecords({}, 1), []);
  });

  it('212. final usable count matches output length', () => {
    var records = [
      { listingPosition: 1, originalListingTitle: 'A', city: 'X', datePosted: 'd', detailUrl: 'https://www.jobz.pk/a_tenders-1.html' },
      { listingPosition: 2, originalListingTitle: 'B', city: 'Y', datePosted: 'd', detailUrl: 'https://www.jobz.pk/tenders-1/' }
    ];
    var r = createNormalizedTenderRecords(records, 1);
    assert.strictEqual(r.length, 1);
  });
});
