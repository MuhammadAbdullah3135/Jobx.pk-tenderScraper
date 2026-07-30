/**
 * Phase 4B — Normalized tender record factory tests
 * Tests createNormalizedTenderRecord and createNormalizedTenderRecords.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { join } = require('path');

const base = join(__dirname, '..');

const utilitiesCode = readFileSync(join(base, 'src/shared/utilities.js'), 'utf-8');
const namingCode = readFileSync(join(base, 'src/shared/naming.js'), 'utf-8');
const urlsCode = readFileSync(join(base, 'src/shared/urls.js'), 'utf-8');
const tenderModelCode = readFileSync(join(base, 'src/shared/tender-model.js'), 'utf-8');

eval(utilitiesCode + '\n' + namingCode + '\n' + urlsCode + '\n' + tenderModelCode);

var VALID_INPUT = {
  listingPosition: 1,
  originalListingTitle: 'Tender for the Supply of Items by EED',
  city: 'LAHORE',
  datePosted: '22 Jul 2026',
  detailUrl: 'https://www.jobz.pk/tender-for-the-supply-of-items-by-eed_tenders-66063.html'
};

var VALID_PAGINATION = 2;

// ---------------------------------------------------------------------------
// 1. Complete valid input
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — valid input', () => {
  it('produces the expected normalized object', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, VALID_PAGINATION);

    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
    assert.strictEqual(result.tenderId, '66063');
    assert.strictEqual(result.originalListingTitle, 'Tender for the Supply of Items by EED');
    assert.strictEqual(result.title, 'Supply of Items by EED');
    assert.strictEqual(result.city, 'LAHORE');
    assert.strictEqual(result.listingDatePosted, '22 Jul 2026');
    assert.strictEqual(result.datePosted, 'Not available');
    assert.strictEqual(result.category, 'Not available');
    assert.strictEqual(result.province, 'Not available');
    assert.strictEqual(result.location, 'Not available');
    assert.strictEqual(result.subcategory, 'Not available');
    assert.strictEqual(result.sector, 'Not available');
    assert.strictEqual(result.newspaper, 'Not available');
    assert.strictEqual(result.lastDate, 'Not available');
    assert.strictEqual(result.description, 'Not available');
    assert.strictEqual(result.detailUrl, 'https://www.jobz.pk/tender-for-the-supply-of-items-by-eed_tenders-66063.html');
    assert.strictEqual(result.paginationNumber, 2);
    assert.strictEqual(result.folderName, '001_Supply of Items by EED');
    assert.strictEqual(result.downloadStatus, 'Pending');
    assert.strictEqual(result.failureReason, null);
    assert.strictEqual(result.fetchAttempts, 0);
    assert.strictEqual(result.downloadedAt, null);
    assert.deepStrictEqual(result.imageUrls, []);
    assert.deepStrictEqual(result.downloadIds, []);
    assert.deepStrictEqual(result.downloadedFiles, []);
  });
});

// ---------------------------------------------------------------------------
// 2. Input immutability
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — immutability', () => {
  it('does not mutate the input record', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Tender for the Supply of Items by EED',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66063.html'
    };
    var frozen = JSON.stringify(input);
    createNormalizedTenderRecord(input, 1);
    assert.strictEqual(JSON.stringify(input), frozen);
  });
});

// ---------------------------------------------------------------------------
// 3. Whitespace-normalized title
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — title whitespace', () => {
  it('normalizes whitespace in original listing title', () => {
    var input = {
      listingPosition: 2,
      originalListingTitle: '  Tender   for   the   Supply  ',
      city: 'KARACHI',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66064.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.originalListingTitle, 'Tender for the Supply');
    assert.strictEqual(result.title, 'Supply');
  });
});

// ---------------------------------------------------------------------------
// 4. Prefix removal
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — prefix removal', () => {
  it('removes initial Tender for the from display title', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.title, 'Supply of Items by EED');
  });

  it('preserves original listing title capitalization', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'TENDER FOR THE Construction',
      city: 'ISLAMABAD',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66065.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.originalListingTitle, 'TENDER FOR THE Construction');
    assert.strictEqual(result.title, 'Construction');
  });
});

// ---------------------------------------------------------------------------
// 5. Missing title
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — missing title', () => {
  it('uses Unknown Tender when title is empty', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: '',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66066.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(result.title, 'Unknown Tender');
  });

  it('uses Unknown Tender when title is whitespace', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: '   ',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66066.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(result.title, 'Unknown Tender');
  });

  it('uses Unknown Tender when title is missing', () => {
    var input = {
      listingPosition: 1,
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66066.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(result.title, 'Unknown Tender');
  });

  it('uses Unknown Tender when title is null', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: null,
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66066.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(result.title, 'Unknown Tender');
  });
});

// ---------------------------------------------------------------------------
// 6. Missing city
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — missing city', () => {
  it('uses Not available when city is empty', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test Tender',
      city: '',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66067.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.city, 'Not available');
  });

  it('uses Not available when city is whitespace', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test Tender',
      city: '   ',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66067.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.city, 'Not available');
  });

  it('uses Not available when city is missing', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test Tender',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66067.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.city, 'Not available');
  });
});

// ---------------------------------------------------------------------------
// 7. Missing listing date
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — missing listing date', () => {
  it('uses Not available when date is empty', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test Tender',
      city: 'LAHORE',
      datePosted: '',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66068.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingDatePosted, 'Not available');
  });

  it('uses Not available when date is missing', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test Tender',
      city: 'LAHORE',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66068.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingDatePosted, 'Not available');
  });
});

// ---------------------------------------------------------------------------
// 8. Listing date separate from datePosted
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — date separation', () => {
  it('listingDatePosted is set from input, datePosted is Not available', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.listingDatePosted, '22 Jul 2026');
    assert.strictEqual(result.datePosted, 'Not available');
    assert.notStrictEqual(result.listingDatePosted, result.datePosted);
  });
});

// ---------------------------------------------------------------------------
// 9. datePosted initializes to Not available
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — datePosted default', () => {
  it('datePosted is always Not available on creation', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.datePosted, 'Not available');
  });
});

// ---------------------------------------------------------------------------
// 10. Future detail fields
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — future detail fields', () => {
  it('all future detail-page metadata initializes to Not available', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.category, 'Not available');
    assert.strictEqual(result.province, 'Not available');
    assert.strictEqual(result.location, 'Not available');
    assert.strictEqual(result.subcategory, 'Not available');
    assert.strictEqual(result.sector, 'Not available');
    assert.strictEqual(result.newspaper, 'Not available');
    assert.strictEqual(result.lastDate, 'Not available');
    assert.strictEqual(result.description, 'Not available');
  });
});

// ---------------------------------------------------------------------------
// 11. Valid detail URL canonicalization
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — URL canonicalization', () => {
  it('canonicalizes valid http jobz.pk detail URL', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'http://jobz.pk/sample_tenders-12345.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, 'https://www.jobz.pk/sample_tenders-12345.html');
    assert.strictEqual(result.tenderId, '12345');
  });

  it('canonicalizes relative detail URL', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: '/sample_tenders-99999.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, 'https://www.jobz.pk/sample_tenders-99999.html');
    assert.strictEqual(result.tenderId, '99999');
  });
});

// ---------------------------------------------------------------------------
// 12. Tender ID extraction
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — tender ID extraction', () => {
  it('extracts tender ID from valid URL', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.tenderId, '66063');
  });
});

// ---------------------------------------------------------------------------
// 13. Invalid detail URL
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — invalid detail URL', () => {
  it('sets detailUrl to null for listing page URL', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/tenders-1/'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.tenderId, null);
  });

  it('sets detailUrl to null for unrelated host', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://example.com/test_tenders-555.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.tenderId, null);
  });

  it('sets detailUrl to null for empty URL', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: ''
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.tenderId, null);
  });

  it('sets detailUrl to null for missing URL', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test',
      city: 'LAHORE',
      datePosted: '22 Jul 2026'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.tenderId, null);
  });

  it('sets detailUrl to null for javascript URL', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Test',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'javascript:void(0)'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.tenderId, null);
  });
});

// ---------------------------------------------------------------------------
// 14. Pagination normalization
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — pagination normalization', () => {
  it('uses provided pagination number', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 5);
    assert.strictEqual(result.paginationNumber, 5);
  });

  it('falls back to 1 for null pagination', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, null);
    assert.strictEqual(result.paginationNumber, 1);
  });

  it('falls back to 1 for undefined pagination', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, undefined);
    assert.strictEqual(result.paginationNumber, 1);
  });

  it('falls back to 1 for zero pagination', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 0);
    assert.strictEqual(result.paginationNumber, 1);
  });

  it('truncates decimal pagination', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 3.7);
    assert.strictEqual(result.paginationNumber, 3);
  });
});

// ---------------------------------------------------------------------------
// 15. Folder name
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — folder name', () => {
  it('matches sequence and cleaned title', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.folderName, '001_Supply of Items by EED');
  });

  it('uses Unknown Tender in folder when title is unusable', () => {
    var input = {
      listingPosition: 5,
      originalListingTitle: '***',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66070.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.folderName, '005_Unknown Tender');
  });

  it('uses Unknown Tender in folder for empty title', () => {
    var input = {
      listingPosition: 3,
      originalListingTitle: '',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/sample_tenders-66071.html'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.folderName.indexOf('003_Unknown Tender') === 0, true);
  });
});

// ---------------------------------------------------------------------------
// 16. Download status
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — download status', () => {
  it('initializes downloadStatus to Pending', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.downloadStatus, 'Pending');
  });
});

// ---------------------------------------------------------------------------
// 17. Fetch attempts
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — fetch attempts', () => {
  it('initializes fetchAttempts to 0', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.fetchAttempts, 0);
  });
});

// ---------------------------------------------------------------------------
// 18. Failure reason
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — failure reason', () => {
  it('initializes failureReason to null', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.failureReason, null);
  });
});

// ---------------------------------------------------------------------------
// 19. Downloaded timestamp
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — downloaded timestamp', () => {
  it('initializes downloadedAt to null', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.strictEqual(result.downloadedAt, null);
  });
});

// ---------------------------------------------------------------------------
// 20. Image URL array
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — image URL array', () => {
  it('initializes imageUrls as empty array', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.deepStrictEqual(result.imageUrls, []);
    assert.strictEqual(result.imageUrls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 21. Download ID array
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — download ID array', () => {
  it('initializes downloadIds as empty array', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.deepStrictEqual(result.downloadIds, []);
    assert.strictEqual(result.downloadIds.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 22. Downloaded files array
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — downloaded files array', () => {
  it('initializes downloadedFiles as empty array', () => {
    var result = createNormalizedTenderRecord(VALID_INPUT, 1);
    assert.deepStrictEqual(result.downloadedFiles, []);
    assert.strictEqual(result.downloadedFiles.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 23. Arrays not shared between records
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — array isolation', () => {
  it('every record gets its own new arrays', () => {
    var r1 = createNormalizedTenderRecord(VALID_INPUT, 1);
    var r2 = createNormalizedTenderRecord(VALID_INPUT, 1);

    assert.notStrictEqual(r1.imageUrls, r2.imageUrls);
    assert.notStrictEqual(r1.downloadIds, r2.downloadIds);
    assert.notStrictEqual(r1.downloadedFiles, r2.downloadedFiles);

    r1.imageUrls.push('test.jpg');
    assert.strictEqual(r2.imageUrls.length, 0);

    r2.downloadIds.push('abc');
    assert.strictEqual(r1.downloadIds.length, 0);

    r1.downloadedFiles.push('file.txt');
    assert.strictEqual(r2.downloadedFiles.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 24. Null input
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — null input', () => {
  it('returns safe record for null input', () => {
    var result = createNormalizedTenderRecord(null, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
    assert.strictEqual(result.tenderId, null);
    assert.strictEqual(result.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(result.title, 'Unknown Tender');
    assert.strictEqual(result.city, 'Not available');
    assert.strictEqual(result.listingDatePosted, 'Not available');
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.paginationNumber, 1);
    assert.strictEqual(result.folderName, '001_Unknown Tender');
    assert.strictEqual(result.downloadStatus, 'Pending');
  });
});

// ---------------------------------------------------------------------------
// 25. Undefined input
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — undefined input', () => {
  it('returns safe record for undefined input', () => {
    var result = createNormalizedTenderRecord(undefined, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
    assert.strictEqual(result.tenderId, null);
    assert.strictEqual(result.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(result.title, 'Unknown Tender');
    assert.strictEqual(result.city, 'Not available');
    assert.strictEqual(result.listingDatePosted, 'Not available');
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.paginationNumber, 1);
    assert.strictEqual(result.folderName, '001_Unknown Tender');
    assert.strictEqual(result.downloadStatus, 'Pending');
  });
});

// ---------------------------------------------------------------------------
// 26. Empty object input
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — empty object input', () => {
  it('returns safe record for empty object', () => {
    var result = createNormalizedTenderRecord({}, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
    assert.strictEqual(result.tenderId, null);
    assert.strictEqual(result.originalListingTitle, 'Unknown Tender');
    assert.strictEqual(result.title, 'Unknown Tender');
    assert.strictEqual(result.city, 'Not available');
    assert.strictEqual(result.listingDatePosted, 'Not available');
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.paginationNumber, 1);
    assert.strictEqual(result.folderName, '001_Unknown Tender');
    assert.strictEqual(result.downloadStatus, 'Pending');
  });
});

// ---------------------------------------------------------------------------
// 27. Decimal or invalid listing position
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — invalid listing position', () => {
  it('falls back to 1 for decimal listing position', () => {
    var input = { ...VALID_INPUT, listingPosition: 3.7 };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingPosition, 3);
    assert.strictEqual(result.sequenceNumber, 3);
  });

  it('falls back to 1 for zero listing position', () => {
    var input = { ...VALID_INPUT, listingPosition: 0 };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
  });

  it('falls back to 1 for negative listing position', () => {
    var input = { ...VALID_INPUT, listingPosition: -5 };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
  });

  it('falls back to 1 for NaN listing position', () => {
    var input = { ...VALID_INPUT, listingPosition: NaN };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
  });

  it('falls back to 1 for missing listing position', () => {
    var input = { ...VALID_INPUT };
    delete input.listingPosition;
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
  });
});

// ---------------------------------------------------------------------------
// 28. Numeric string listing position
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — numeric string position', () => {
  it('handles numeric string listing position', () => {
    var input = { ...VALID_INPUT, listingPosition: '5' };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingPosition, 5);
    assert.strictEqual(result.sequenceNumber, 5);
  });

  it('falls back to 1 for non-numeric string position', () => {
    var input = { ...VALID_INPUT, listingPosition: 'abc' };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.listingPosition, 1);
    assert.strictEqual(result.sequenceNumber, 1);
  });
});

// ---------------------------------------------------------------------------
// 29. Batch helper preserves order
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecords — order preservation', () => {
  it('preserves input order', () => {
    var records = [
      { listingPosition: 1, originalListingTitle: 'First Tender', city: 'LAHORE', datePosted: '22 Jul 2026', detailUrl: 'https://www.jobz.pk/first_tenders-1.html' },
      { listingPosition: 2, originalListingTitle: 'Second Tender', city: 'KARACHI', datePosted: '23 Jul 2026', detailUrl: 'https://www.jobz.pk/second_tenders-2.html' },
      { listingPosition: 3, originalListingTitle: 'Third Tender', city: 'ISLAMABAD', datePosted: '24 Jul 2026', detailUrl: 'https://www.jobz.pk/third_tenders-3.html' }
    ];
    var results = createNormalizedTenderRecords(records, 1);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].tenderId, '1');
    assert.strictEqual(results[1].tenderId, '2');
    assert.strictEqual(results[2].tenderId, '3');
  });

  it('returns empty array for null input', () => {
    assert.deepStrictEqual(createNormalizedTenderRecords(null, 1), []);
  });

  it('returns empty array for undefined input', () => {
    assert.deepStrictEqual(createNormalizedTenderRecords(undefined, 1), []);
  });

  it('returns empty array for non-array input', () => {
    assert.deepStrictEqual(createNormalizedTenderRecords({}, 1), []);
  });
});

// ---------------------------------------------------------------------------
// 30. Batch helper filters invalid detail URLs
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecords — invalid URL filtering', () => {
  it('filters records with invalid detail URLs', () => {
    var records = [
      { listingPosition: 1, originalListingTitle: 'Valid Tender', city: 'LAHORE', datePosted: '22 Jul 2026', detailUrl: 'https://www.jobz.pk/valid_tenders-1.html' },
      { listingPosition: 2, originalListingTitle: 'Invalid URL Tender', city: 'KARACHI', datePosted: '23 Jul 2026', detailUrl: 'https://www.jobz.pk/tenders-1/' },
      { listingPosition: 3, originalListingTitle: 'Another Valid', city: 'ISLAMABAD', datePosted: '24 Jul 2026', detailUrl: 'https://www.jobz.pk/another_tenders-2.html' }
    ];
    var results = createNormalizedTenderRecords(records, 1);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].tenderId, '1');
    assert.strictEqual(results[1].tenderId, '2');
  });

  it('filters all records when all URLs invalid', () => {
    var records = [
      { listingPosition: 1, originalListingTitle: 'Bad', city: 'LAHORE', datePosted: '22 Jul 2026', detailUrl: 'https://www.jobz.pk/tenders-1/' },
      { listingPosition: 2, originalListingTitle: 'Also Bad', city: 'KARACHI', datePosted: '23 Jul 2026', detailUrl: 'javascript:void(0)' }
    ];
    var results = createNormalizedTenderRecords(records, 1);
    assert.strictEqual(results.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 31. Phase 3 raw input unchanged after batch normalization
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecords — input immutability', () => {
  it('does not mutate raw records after batch normalization', () => {
    var records = [
      { listingPosition: 1, originalListingTitle: 'First Tender', city: 'LAHORE', datePosted: '22 Jul 2026', detailUrl: 'https://www.jobz.pk/first_tenders-1.html' },
      { listingPosition: 2, originalListingTitle: 'Second Tender', city: 'KARACHI', datePosted: '23 Jul 2026', detailUrl: 'https://www.jobz.pk/second_tenders-2.html' }
    ];
    var frozen = JSON.stringify(records);
    createNormalizedTenderRecords(records, 1);
    assert.strictEqual(JSON.stringify(records), frozen);
  });
});

// ---------------------------------------------------------------------------
// Additional: folder name still produces safe output even with invalid URL
// ---------------------------------------------------------------------------
describe('createNormalizedTenderRecord — folder name with invalid URL', () => {
  it('produces folder name even when detail URL is invalid', () => {
    var input = {
      listingPosition: 1,
      originalListingTitle: 'Tender for the Supply',
      city: 'LAHORE',
      datePosted: '22 Jul 2026',
      detailUrl: 'https://www.jobz.pk/tenders-1/'
    };
    var result = createNormalizedTenderRecord(input, 1);
    assert.strictEqual(result.detailUrl, null);
    assert.strictEqual(result.folderName, '001_Supply');
  });
});

// ---------------------------------------------------------------------------
// Additional: ensure no Phase 5 functionality present
// ---------------------------------------------------------------------------
describe('Phase 4B — no Phase 5 code', () => {
  it('does not contain Phase 5 Chrome API calls, fetch, or storage usage', () => {
    var code = tenderModelCode;
    assert.strictEqual(code.indexOf('chrome.downloads.download'), -1);
    assert.strictEqual(code.indexOf('chrome.storage'), -1);
    assert.strictEqual(code.indexOf('chrome.offscreen'), -1);
    assert.strictEqual(code.indexOf('fetch('), -1);
    assert.strictEqual(code.indexOf('XMLHttpRequest'), -1);
    assert.strictEqual(code.indexOf('createOffscreen'), -1);
    assert.strictEqual(code.indexOf('chrome.download'), -1);
  });
});
