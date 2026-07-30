/**
 * Phase 5C — Merge helper and popup logic tests.
 * Tests mergeTenderListingAndDetail, description preview, error mapping.
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
const constantsCode = readFileSync(join(base, 'src/shared/constants.js'), 'utf-8');

eval(utilitiesCode + '\n' + namingCode + '\n' + urlsCode + '\n' + tenderModelCode);
eval(constantsCode);

var VALID_LISTING = {
  listingPosition: 1,
  sequenceNumber: 1,
  tenderId: '66063',
  originalListingTitle: 'Tender for the Supply of Items by EED',
  title: 'Supply of Items by EED',
  city: 'LAHORE',
  listingDatePosted: '22 Jul 2026',
  datePosted: 'Not available',
  category: 'Not available',
  province: 'Not available',
  location: 'Not available',
  subcategory: 'Not available',
  sector: 'Not available',
  newspaper: 'Not available',
  lastDate: 'Not available',
  description: 'Not available',
  detailUrl: 'https://www.jobz.pk/tender-for-the-supply-of-items-by-eed_tenders-66063.html',
  imageUrls: [],
  paginationNumber: 2,
  folderName: '001_Supply of Items by EED',
  downloadStatus: 'Pending',
  failureReason: null,
  fetchAttempts: 0,
  downloadedAt: null,
  downloadIds: [],
  downloadedFiles: []
};

var VALID_PARSER_RESULT = {
  success: true,
  metadata: {
    datePosted: '25 Jul 2026',
    category: 'Goods',
    province: 'Punjab',
    location: 'Lahore',
    subcategory: 'Medical Equipment',
    sector: 'Health',
    newspaper: 'Daily Jang',
    lastDate: '15 Aug 2026'
  },
  description: 'The Education Department Punjab invites sealed bids for the supply of medical equipment to DHQ Hospital.',
  pageTitle: 'Supply of Medical Equipment to DHQ Hospital',
  tenderId: '66063',
  imageUrls: [
    'https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg',
    'https://www.jobz.pk/images/tenders/ad-66063-page-002.jpg'
  ],
  warnings: []
};

// ---------------------------------------------------------------------------
// 1. Complete valid merge
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — valid merge', () => {
  it('produces merged object with all fields populated correctly', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);

    assert.strictEqual(result.tenderId, '66063');
    assert.strictEqual(result.title, 'Supply of Items by EED');
    assert.strictEqual(result.category, 'Goods');
    assert.strictEqual(result.province, 'Punjab');
    assert.strictEqual(result.location, 'Lahore');
    assert.strictEqual(result.subcategory, 'Medical Equipment');
    assert.strictEqual(result.sector, 'Health');
    assert.strictEqual(result.newspaper, 'Daily Jang');
    assert.strictEqual(result.lastDate, '15 Aug 2026');
    assert.strictEqual(result.datePosted, '25 Jul 2026');
    assert.strictEqual(result.description, 'The Education Department Punjab invites sealed bids for the supply of medical equipment to DHQ Hospital.');
    assert.strictEqual(result.imageUrls.length, 2);
    assert.strictEqual(result.imageUrls[0], 'https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg');
    assert.strictEqual(result.imageUrls[1], 'https://www.jobz.pk/images/tenders/ad-66063-page-002.jpg');
  });
});

// ---------------------------------------------------------------------------
// 2. Listing record immutability
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — listing immutability', () => {
  it('does not mutate the input listing record', () => {
    var listing = JSON.parse(JSON.stringify(VALID_LISTING));
    var frozen = JSON.stringify(listing);
    mergeTenderListingAndDetail(listing, VALID_PARSER_RESULT);
    assert.strictEqual(JSON.stringify(listing), frozen);
  });
});

// ---------------------------------------------------------------------------
// 3. Parser result immutability
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — parser immutability', () => {
  it('does not mutate the input parser result', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    var frozen = JSON.stringify(parser);
    mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.strictEqual(JSON.stringify(parser), frozen);
  });
});

// ---------------------------------------------------------------------------
// 4. Field preservation — listing fields stay unchanged
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — field preservation', () => {
  it('preserves listingPosition, sequenceNumber, tenderId, originalListingTitle, title, city, listingDatePosted, detailUrl, paginationNumber, folderName', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);

    assert.strictEqual(result.listingPosition, VALID_LISTING.listingPosition);
    assert.strictEqual(result.sequenceNumber, VALID_LISTING.sequenceNumber);
    assert.strictEqual(result.tenderId, VALID_LISTING.tenderId);
    assert.strictEqual(result.originalListingTitle, VALID_LISTING.originalListingTitle);
    assert.strictEqual(result.title, VALID_LISTING.title);
    assert.strictEqual(result.city, VALID_LISTING.city);
    assert.strictEqual(result.listingDatePosted, VALID_LISTING.listingDatePosted);
    assert.strictEqual(result.detailUrl, VALID_LISTING.detailUrl);
    assert.strictEqual(result.paginationNumber, VALID_LISTING.paginationNumber);
    assert.strictEqual(result.folderName, VALID_LISTING.folderName);
  });
});

// ---------------------------------------------------------------------------
// 5. datePosted from metadata overwrites listing's datePosted
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — datePosted from metadata', () => {
  it('overwrites listing datePosted with metadata datePosted', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.datePosted, '25 Jul 2026');
    assert.notStrictEqual(result.datePosted, VALID_LISTING.datePosted);
  });

  it('listingDatePosted remains unchanged when datePosted is overwritten', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.listingDatePosted, '22 Jul 2026');
    assert.strictEqual(result.datePosted, '25 Jul 2026');
  });
});

// ---------------------------------------------------------------------------
// 6. All metadata fields populated from parser
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — all metadata fields', () => {
  it('populates category, province, location, subcategory, sector, newspaper, lastDate from parser metadata', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.category, 'Goods');
    assert.strictEqual(result.province, 'Punjab');
    assert.strictEqual(result.location, 'Lahore');
    assert.strictEqual(result.subcategory, 'Medical Equipment');
    assert.strictEqual(result.sector, 'Health');
    assert.strictEqual(result.newspaper, 'Daily Jang');
    assert.strictEqual(result.lastDate, '15 Aug 2026');
  });
});

// ---------------------------------------------------------------------------
// 7. Description from parser
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — description', () => {
  it('sets description from parser result', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.description, VALID_PARSER_RESULT.description);
  });
});

// ---------------------------------------------------------------------------
// 8. Array isolation — merged record gets new arrays
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — array isolation', () => {
  it('imageUrls, downloadIds, downloadedFiles are new arrays not shared with listing', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);

    assert.notStrictEqual(result.imageUrls, VALID_LISTING.imageUrls);
    assert.notStrictEqual(result.downloadIds, VALID_LISTING.downloadIds);
    assert.notStrictEqual(result.downloadedFiles, VALID_LISTING.downloadedFiles);

    result.imageUrls.push('extra.jpg');
    assert.strictEqual(VALID_LISTING.imageUrls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 9. Image URLs copied and deduplicated from parser result
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — image deduplication', () => {
  it('copies image URLs from parser result into a new array', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.imageUrls.length, 2);
    assert.strictEqual(result.imageUrls[0], 'https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg');
  });

  it('deduplicates duplicate image URLs from parser result', () => {
    var parserWithDups = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parserWithDups.imageUrls = [
      'https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg',
      'https://www.jobz.pk/images/tenders/ad-66063-page-002.jpg',
      'https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg'
    ];
    var result = mergeTenderListingAndDetail(VALID_LISTING, parserWithDups);
    assert.strictEqual(result.imageUrls.length, 2);
  });

  it('preserves parser image order', () => {
    var parserWithOrder = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parserWithOrder.imageUrls = [
      'https://www.jobz.pk/images/tenders/z-first.jpg',
      'https://www.jobz.pk/images/tenders/a-second.jpg'
    ];
    var result = mergeTenderListingAndDetail(VALID_LISTING, parserWithOrder);
    assert.strictEqual(result.imageUrls[0], 'https://www.jobz.pk/images/tenders/z-first.jpg');
    assert.strictEqual(result.imageUrls[1], 'https://www.jobz.pk/images/tenders/a-second.jpg');
  });
});

// ---------------------------------------------------------------------------
// 10. Warnings from parser result preserved
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — parser warnings', () => {
  it('copies parser warnings into merged record', () => {
    var parserWithWarnings = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parserWithWarnings.warnings = ['Fallback selector used for metadata.', 'No description section found.'];
    var result = mergeTenderListingAndDetail(VALID_LISTING, parserWithWarnings);
    assert.strictEqual(result.warnings.length, 2);
    assert.strictEqual(result.warnings[0], 'Fallback selector used for metadata.');
    assert.strictEqual(result.warnings[1], 'No description section found.');
  });

  it('warnings array is a new copy', () => {
    var parserWithWarnings = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parserWithWarnings.warnings = ['Test warning.'];
    var result = mergeTenderListingAndDetail(VALID_LISTING, parserWithWarnings);
    assert.notStrictEqual(result.warnings, parserWithWarnings.warnings);
  });
});

// ---------------------------------------------------------------------------
// 11. ID mismatch warning
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — ID mismatch', () => {
  it('adds warning when parser ID differs from listing ID', () => {
    var parserDiffId = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parserDiffId.tenderId = '99999';
    var result = mergeTenderListingAndDetail(VALID_LISTING, parserDiffId);
    assert.strictEqual(result.tenderId, '66063');
    assert.ok(result.warnings.length >= 1);
    assert.ok(result.warnings[0].indexOf('Parser-reported ID "99999"') !== -1);
  });

  it('does not add ID mismatch warning when IDs match', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    var idWarnings = [];
    if (Array.isArray(result.warnings)) {
      for (var i = 0; i < result.warnings.length; i++) {
        if (result.warnings[i].indexOf('Parser-reported ID') !== -1) {
          idWarnings.push(result.warnings[i]);
        }
      }
    }
    assert.strictEqual(idWarnings.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 12. Status reset — downloadStatus, failureReason, fetchAttempts
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — status reset', () => {
  it('sets downloadStatus to Parsed - Download Pending', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
  });

  it('sets failureReason to null', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.failureReason, null);
  });

  it('sets fetchAttempts to 1', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.fetchAttempts, 1);
  });
});

// ---------------------------------------------------------------------------
// 13. downloadedAt, downloadIds, downloadedFiles reset
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — download state reset', () => {
  it('resets downloadedAt to null, downloadIds to [], downloadedFiles to []', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadedAt, null);
    assert.deepStrictEqual(result.downloadIds, []);
    assert.deepStrictEqual(result.downloadedFiles, []);
  });
});

// ---------------------------------------------------------------------------
// 14. Partial metadata — only some fields populated
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — partial metadata', () => {
  it('only overwrites fields present in parser metadata', () => {
    var partialParser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    partialParser.metadata = {
      datePosted: '26 Jul 2026',
      category: 'Services',
      province: 'Sindh'
    };
    var result = mergeTenderListingAndDetail(VALID_LISTING, partialParser);
    assert.strictEqual(result.datePosted, '26 Jul 2026');
    assert.strictEqual(result.category, 'Services');
    assert.strictEqual(result.province, 'Sindh');
    assert.strictEqual(result.location, 'Not available');
    assert.strictEqual(result.subcategory, 'Not available');
    assert.strictEqual(result.sector, 'Not available');
    assert.strictEqual(result.newspaper, 'Not available');
    assert.strictEqual(result.lastDate, 'Not available');
  });
});

// ---------------------------------------------------------------------------
// 15. Parser result with empty metadata
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — empty metadata', () => {
  it('leaves all detail fields as Not available when metadata is empty', () => {
    var emptyMetaParser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    emptyMetaParser.metadata = {};
    var result = mergeTenderListingAndDetail(VALID_LISTING, emptyMetaParser);
    assert.strictEqual(result.datePosted, 'Not available');
    assert.strictEqual(result.category, 'Not available');
    assert.strictEqual(result.province, 'Not available');
    assert.strictEqual(result.location, 'Not available');
    assert.strictEqual(result.subcategory, 'Not available');
    assert.strictEqual(result.sector, 'Not available');
    assert.strictEqual(result.newspaper, 'Not available');
    assert.strictEqual(result.lastDate, 'Not available');
  });
});

// ---------------------------------------------------------------------------
// 16. Parser result with no images
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — no images', () => {
  it('sets imageUrls to empty array when parser has no images', () => {
    var noImagesParser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    noImagesParser.imageUrls = [];
    var result = mergeTenderListingAndDetail(VALID_LISTING, noImagesParser);
    assert.deepStrictEqual(result.imageUrls, []);
    assert.strictEqual(result.imageUrls.length, 0);
  });

  it('handles missing imageUrls in parser result', () => {
    var missingImagesParser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    delete missingImagesParser.imageUrls;
    var result = mergeTenderListingAndDetail(VALID_LISTING, missingImagesParser);
    assert.deepStrictEqual(result.imageUrls, []);
  });
});

// ---------------------------------------------------------------------------
// 17. Parser result with no description
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — no description', () => {
  it('leaves description as Not available when parser has no description', () => {
    var noDescParser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    noDescParser.description = 'Not available';
    var result = mergeTenderListingAndDetail(VALID_LISTING, noDescParser);
    assert.strictEqual(result.description, 'Not available');
  });

  it('handles missing description in parser result', () => {
    var missingDescParser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    delete missingDescParser.description;
    var result = mergeTenderListingAndDetail(VALID_LISTING, missingDescParser);
    assert.strictEqual(result.description, 'Not available');
  });
});

// ---------------------------------------------------------------------------
// 18. Null/undefined listing record
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — null listing', () => {
  it('returns safe merged object for null listing', () => {
    var result = mergeTenderListingAndDetail(null, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
    assert.strictEqual(result.fetchAttempts, 1);
  });

  it('returns safe merged object for undefined listing', () => {
    var result = mergeTenderListingAndDetail(undefined, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
    assert.strictEqual(result.fetchAttempts, 1);
  });
});

// ---------------------------------------------------------------------------
// 19. Null/undefined parser result
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — null parser result', () => {
  it('returns listing copy with status reset for null parser result', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, null);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
    assert.strictEqual(result.fetchAttempts, 1);
  });

  it('returns listing copy with status reset for undefined parser result', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, undefined);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
    assert.strictEqual(result.fetchAttempts, 1);
  });
});

// ---------------------------------------------------------------------------
// 20. Empty object listing record
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — empty listing', () => {
  it('handles empty object as listing record', () => {
    var result = mergeTenderListingAndDetail({}, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
    assert.strictEqual(result.fetchAttempts, 1);
  });
});

// ---------------------------------------------------------------------------
// 21. No ID mismatch when IDs match
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — matching IDs', () => {
  it('does not add ID mismatch warning when tender IDs match', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    var mismatchFound = false;
    if (Array.isArray(result.warnings)) {
      for (var i = 0; i < result.warnings.length; i++) {
        if (result.warnings[i].indexOf('Parser-reported ID') !== -1) {
          mismatchFound = true;
          break;
        }
      }
    }
    assert.strictEqual(mismatchFound, false);
  });
});

// ---------------------------------------------------------------------------
// 22. Multiple parser warnings preserved
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — multiple warnings', () => {
  it('preserves all parser warnings in merged record', () => {
    var parserWithMultiple = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parserWithMultiple.warnings = ['Warning one.', 'Warning two.', 'Warning three.'];
    var result = mergeTenderListingAndDetail(VALID_LISTING, parserWithMultiple);
    assert.strictEqual(result.warnings.length, 3);
    assert.strictEqual(result.warnings[0], 'Warning one.');
    assert.strictEqual(result.warnings[1], 'Warning two.');
    assert.strictEqual(result.warnings[2], 'Warning three.');
  });
});

// ---------------------------------------------------------------------------
// 23. Error code mapping
// ---------------------------------------------------------------------------
describe('getErrorMessage — error code mapping', () => {
  it('returns readable message for INVALID_TENDER_URL', () => {
    assert.strictEqual(getErrorMessage('INVALID_TENDER_URL'), 'The selected tender URL is invalid.');
  });

  it('returns readable message for FETCH_TIMEOUT', () => {
    assert.strictEqual(getErrorMessage('FETCH_TIMEOUT'), 'The request timed out. Please try again.');
  });

  it('returns readable message for HTTP_ERROR', () => {
    assert.strictEqual(getErrorMessage('HTTP_ERROR'), 'The server returned an error response.');
  });

  it('returns readable message for ACCESS_RESTRICTED', () => {
    assert.strictEqual(getErrorMessage('ACCESS_RESTRICTED'), 'The tender page could not be accessed normally.');
  });

  it('returns readable message for HTML_PARSE_FAILED', () => {
    assert.strictEqual(getErrorMessage('HTML_PARSE_FAILED'), 'Failed to parse the tender HTML.');
  });

  it('returns fallback for unknown codes', () => {
    assert.strictEqual(getErrorMessage('UNKNOWN_CODE'), 'An unexpected error occurred.');
  });

  it('returns fallback for undefined code', () => {
    assert.strictEqual(getErrorMessage(undefined), 'An unexpected error occurred.');
  });
});

// ---------------------------------------------------------------------------
// 24. Description preview truncation
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — description preview', () => {
  it('stores full description in merged record (not truncated)', () => {
    var longDesc = 'A'.repeat(50000);
    var longParser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    longParser.description = longDesc;
    var result = mergeTenderListingAndDetail(VALID_LISTING, longParser);
    assert.strictEqual(result.description.length, 50000);
  });
});

// ---------------------------------------------------------------------------
// 25. listing with existing parser fields does not leak into merge
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — no cross-contamination', () => {
  it('city from listing is preserved separate from location from parser', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.city, 'LAHORE');
    assert.strictEqual(result.location, 'Lahore');
  });

  it('listingDatePosted from listing is preserved separate from datePosted from parser', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.listingDatePosted, '22 Jul 2026');
    assert.strictEqual(result.datePosted, '25 Jul 2026');
  });
});

// ---------------------------------------------------------------------------
// 26. Merge with null listing and null parser
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — double null', () => {
  it('does not throw when both inputs are null', () => {
    var result = mergeTenderListingAndDetail(null, null);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
  });
});

// ---------------------------------------------------------------------------
// 27. Title precedence — listing title preserved over pageTitle
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — title precedence', () => {
  it('preserves listing title, does not use pageTitle for title field', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.title, 'Supply of Items by EED');
    assert.notStrictEqual(result.title, VALID_PARSER_RESULT.pageTitle);
  });

  it('originalListingTitle remains unchanged after merge', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.originalListingTitle, 'Tender for the Supply of Items by EED');
  });
});

// ---------------------------------------------------------------------------
// 28. Description preview safety — HTML escaping
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — description preview safety', () => {
  it('description with HTML characters stored as plain text', () => {
    var parserWithHtmlDesc = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parserWithHtmlDesc.description = '<script>alert("xss")</script> & "quoted"';
    var result = mergeTenderListingAndDetail(VALID_LISTING, parserWithHtmlDesc);
    assert.strictEqual(result.description, '<script>alert("xss")</script> & "quoted"');
  });
});

// ---------------------------------------------------------------------------
// 29. Main download button remains non-operational (Phase 3C preserved)
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — main button non-operational', () => {
  it('merged record does not trigger any download', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
    assert.strictEqual(result.downloadedAt, null);
    assert.deepStrictEqual(result.downloadIds, []);
    assert.deepStrictEqual(result.downloadedFiles, []);
  });
});

// ---------------------------------------------------------------------------
// 30. Merge sets downloadStatus to Parsed - Download Pending
// ---------------------------------------------------------------------------
describe('Merge download status', () => {
  it('sets downloadStatus to Parsed - Download Pending after merge', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
  });
});

// ---------------------------------------------------------------------------
// 31. Error message mapping
// ---------------------------------------------------------------------------
describe('Error message mapping', () => {
  it('getErrorMessage returns readable message for all error codes', () => {
    var codes = ['INVALID_TENDER_URL', 'FETCH_TIMEOUT', 'HTTP_ERROR', 'ACCESS_RESTRICTED', 'UNEXPECTED_REDIRECT', 'NETWORK_ERROR', 'EMPTY_HTML', 'UNEXPECTED_CONTENT_TYPE', 'HTML_PARSE_FAILED', 'NO_TENDER_CONTENT', 'INVALID_HTML', 'UNKNOWN_ERROR'];
    var expected = ['The selected tender URL is invalid.', 'The request timed out. Please try again.', 'The server returned an error response.', 'The tender page could not be accessed normally.', 'The tender URL redirected to an unexpected page.', 'Could not connect to the server. Please check your internet connection.', 'The response contained no content.', 'The response was not HTML.', 'Failed to parse the tender HTML.', 'The parsed tender page has no recognizable content.', 'The HTML input was invalid.', 'An unexpected error occurred.'];
    for (var i = 0; i < codes.length; i++) {
      assert.strictEqual(getErrorMessage(codes[i]), expected[i], 'Code: ' + codes[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// 33. Fetched HTML never appears in merged result or error messages
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — no HTML exposure', () => {
  it('merged result does not contain raw HTML', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.hasOwnProperty('html'), false);
    assert.strictEqual(typeof result.description, 'string');
    assert(result.description.indexOf('<') === -1 || result.description === VALID_PARSER_RESULT.description);
  });
});

// ---------------------------------------------------------------------------
// 34. Folder name remains stable after merge
// ---------------------------------------------------------------------------
describe('mergeTenderListingAndDetail — folder name stability', () => {
  it('folderName is not changed by merge', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.folderName, VALID_LISTING.folderName);
  });
});

// ---------------------------------------------------------------------------
// Extra: Phase 5C download status values
// ---------------------------------------------------------------------------
describe('Phase 5C download status values', () => {
  it('merge sets downloadStatus to Parsed - Download Pending', () => {
    var result = mergeTenderListingAndDetail(VALID_LISTING, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
  });

  it('getErrorMessage works for all defined codes', () => {
    assert.strictEqual(getErrorMessage('INVALID_TENDER_URL'), 'The selected tender URL is invalid.');
    assert.strictEqual(getErrorMessage('FETCH_TIMEOUT'), 'The request timed out. Please try again.');
    assert.strictEqual(getErrorMessage('HTTP_ERROR'), 'The server returned an error response.');
    assert.strictEqual(getErrorMessage('ACCESS_RESTRICTED'), 'The tender page could not be accessed normally.');
    assert.strictEqual(getErrorMessage('HTML_PARSE_FAILED'), 'Failed to parse the tender HTML.');
    assert.strictEqual(getErrorMessage('UNKNOWN_CODE'), 'An unexpected error occurred.');
  });
});

// ===== Phase 5D additions: additional merge/display edge cases =====

describe('Phase 5D — Edge cases: metadata first-wins in merge', () => {
  it('metadata fields that exist in parser overwrite listing defaults', () => {
    var listing = JSON.parse(JSON.stringify(VALID_LISTING));
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.metadata = { datePosted: '26 Jul 2026', category: 'Services', province: 'Sindh' };
    var result = mergeTenderListingAndDetail(listing, parser);
    assert.strictEqual(result.datePosted, '26 Jul 2026');
    assert.strictEqual(result.category, 'Services');
    assert.strictEqual(result.province, 'Sindh');
    assert.strictEqual(result.location, 'Not available');
  });
});

describe('Phase 5D — Edge cases: parser with null description', () => {
  it('handles parser result with null description', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.description = null;
    var result = mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.strictEqual(result.description, 'Not available');
  });
});

describe('Phase 5D — Edge cases: parser with null metadata', () => {
  it('handles parser result with null metadata', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.metadata = null;
    var result = mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.strictEqual(result.datePosted, 'Not available');
    assert.strictEqual(result.category, 'Not available');
    assert.strictEqual(result.province, 'Not available');
  });
});

describe('Phase 5D — Edge cases: parser with undefined metadata', () => {
  it('handles parser result with undefined metadata', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.metadata = undefined;
    var result = mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.strictEqual(result.datePosted, 'Not available');
    assert.strictEqual(result.category, 'Not available');
  });
});

describe('Phase 5D — Edge cases: parser with null warnings', () => {
  it('handles parser result with null warnings', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.warnings = null;
    var result = mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.ok(Array.isArray(result.warnings));
    assert.strictEqual(result.warnings.length, 0);
  });
});

describe('Phase 5D — Edge cases: parser with undefined warnings', () => {
  it('handles parser result with undefined warnings', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.warnings = undefined;
    var result = mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.ok(Array.isArray(result.warnings));
    assert.strictEqual(result.warnings.length, 0);
  });
});

describe('Phase 5D — Edge cases: listing with null folderName', () => {
  it('handles listing with null folderName', () => {
    var listing = JSON.parse(JSON.stringify(VALID_LISTING));
    listing.folderName = null;
    var result = mergeTenderListingAndDetail(listing, VALID_PARSER_RESULT);
    assert.strictEqual(result.folderName, null);
  });
});

describe('Phase 5D — Edge cases: getErrorMessage for all known codes', () => {
  it('returns readable message for NETWORK_ERROR', () => {
    assert.strictEqual(getErrorMessage('NETWORK_ERROR'), 'Could not connect to the server. Please check your internet connection.');
  });

  it('returns readable message for EMPTY_HTML', () => {
    assert.strictEqual(getErrorMessage('EMPTY_HTML'), 'The response contained no content.');
  });

  it('returns readable message for UNEXPECTED_CONTENT_TYPE', () => {
    assert.strictEqual(getErrorMessage('UNEXPECTED_CONTENT_TYPE'), 'The response was not HTML.');
  });

  it('returns readable message for UNEXPECTED_REDIRECT', () => {
    assert.strictEqual(getErrorMessage('UNEXPECTED_REDIRECT'), 'The tender URL redirected to an unexpected page.');
  });

  it('returns readable message for INVALID_HTML', () => {
    assert.strictEqual(getErrorMessage('INVALID_HTML'), 'The HTML input was invalid.');
  });

  it('returns readable message for NO_TENDER_CONTENT', () => {
    assert.strictEqual(getErrorMessage('NO_TENDER_CONTENT'), 'The parsed tender page has no recognizable content.');
  });

  it('returns readable message for UNKNOWN_ERROR', () => {
    assert.strictEqual(getErrorMessage('UNKNOWN_ERROR'), 'An unexpected error occurred.');
  });
});

describe('Phase 5D — Edge cases: getErrorMessage with non-string codes', () => {
  it('returns fallback for null code', () => {
    assert.strictEqual(getErrorMessage(null), 'An unexpected error occurred.');
  });

  it('returns fallback for empty string code', () => {
    assert.strictEqual(getErrorMessage(''), 'An unexpected error occurred.');
  });

  it('returns fallback for numeric code', () => {
    assert.strictEqual(getErrorMessage(404), 'An unexpected error occurred.');
  });
});

describe('Phase 5D — Edge cases: merge with parser having partial imageUrls', () => {
  it('handles parser with empty imageUrls', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.imageUrls = [];
    var result = mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.deepStrictEqual(result.imageUrls, []);
  });

  it('handles parser with null imageUrls', () => {
    var parser = JSON.parse(JSON.stringify(VALID_PARSER_RESULT));
    parser.imageUrls = null;
    var result = mergeTenderListingAndDetail(VALID_LISTING, parser);
    assert.deepStrictEqual(result.imageUrls, []);
  });
});

describe('Phase 5D — Edge cases: merge with invalid listing fields', () => {
  it('handles listing with undefined originalListingTitle', () => {
    var listing = JSON.parse(JSON.stringify(VALID_LISTING));
    listing.originalListingTitle = undefined;
    var result = mergeTenderListingAndDetail(listing, VALID_PARSER_RESULT);
    assert.strictEqual(result.downloadStatus, 'Parsed - Download Pending');
  });

  it('handles listing with null city', () => {
    var listing = JSON.parse(JSON.stringify(VALID_LISTING));
    listing.city = null;
    var result = mergeTenderListingAndDetail(listing, VALID_PARSER_RESULT);
    assert.strictEqual(result.city, null);
    assert.strictEqual(result.location, 'Lahore');
  });
});
