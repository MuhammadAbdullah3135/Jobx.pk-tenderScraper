/**
 * File: tender-model.js
 * Phase 4B — Pure factory for normalized tender records.
 * Pure functions — no browser APIs, no DOM access, no network requests.
 * Uses Phase 4A utilities for standardization.
 *
 * Signature:
 *   createNormalizedTenderRecord(listingRecord, paginationNumber)
 *   createNormalizedTenderRecords(records, paginationNumber)
 */

/**
 * createNormalizedTenderRecord — Create one normalized tender object.
 * Never mutates the source record.
 * @param {*} listingRecord - Raw Phase 3 listing record (untrusted)
 * @param {*} paginationNumber - Current pagination page number
 * @returns {Object} A new normalized tender record
 */
function createNormalizedTenderRecord(listingRecord, paginationNumber) {
  if (!listingRecord || typeof listingRecord !== 'object') {
    listingRecord = {};
  }

  var position = normalizePaginationNumber(listingRecord.listingPosition);
  var sequence = position;

  var rawOriginalTitle = listingRecord.originalListingTitle;
  var originalTitle = normalizeWhitespace(rawOriginalTitle);
  if (originalTitle === '') originalTitle = 'Unknown Tender';

  var title = removeTenderTitlePrefix(rawOriginalTitle);

  var city = normalizeWhitespace(listingRecord.city);
  if (city === '') city = 'Not available';

  var listingDate = normalizeWhitespace(listingRecord.datePosted);
  if (listingDate === '') listingDate = 'Not available';

  var detailUrl = null;
  var tenderId = null;
  if (typeof listingRecord.detailUrl === 'string') {
    var validation = validateTenderDetailUrl(listingRecord.detailUrl);
    if (validation.valid) {
      detailUrl = validation.canonicalUrl;
      tenderId = validation.tenderId;
    }
  }

  var page = normalizePaginationNumber(paginationNumber);

  var folder = createTenderFolderName(sequence, rawOriginalTitle);

  return {
    listingPosition: position,
    sequenceNumber: sequence,
    tenderId: tenderId,
    originalListingTitle: originalTitle,
    title: title,
    city: city,
    listingDatePosted: listingDate,
    datePosted: 'Not available',
    category: 'Not available',
    province: 'Not available',
    location: 'Not available',
    subcategory: 'Not available',
    sector: 'Not available',
    newspaper: 'Not available',
    lastDate: 'Not available',
    description: 'Not available',
    detailsText: '',
    detailUrl: detailUrl,
    imageUrls: [],
    paginationNumber: page,
    folderName: folder,
    downloadStatus: 'Pending',
    failureReason: null,
    fetchAttempts: 0,
    downloadedAt: null,
    downloadIds: [],
    downloadedFiles: []
  };
}

/**
 * createNormalizedTenderRecords — Batch normalize listing records.
 * Preserves order. Filters records with invalid detail URLs.
 * Does not mutate input records or arrays.
 * @param {Array} records - Array of raw Phase 3 listing records
 * @param {*} paginationNumber - Current pagination page number
 * @returns {Array} New array of normalized tender records with valid detail URLs
 */
function createNormalizedTenderRecords(records, paginationNumber) {
  if (!Array.isArray(records)) return [];

  var result = [];
  for (var i = 0; i < records.length; i++) {
    var normalized = createNormalizedTenderRecord(records[i], paginationNumber);
    if (normalized.detailUrl !== null) {
      result.push(normalized);
    }
  }

  return result;
}

/**
 * mergeTenderListingAndDetail — Merge a normalized listing record with a parsed detail result.
 * Never mutates the listing record or parser result.
 * @param {Object} listingRecord - A normalized Phase 4B tender record
 * @param {Object} parserResult - A successful Phase 5B parser result (result.success === true)
 * @returns {Object} A new merged tender record
 */
function mergeTenderListingAndDetail(listingRecord, parserResult) {
  if (!listingRecord || typeof listingRecord !== 'object') {
    listingRecord = {};
  }
  if (!parserResult || typeof parserResult !== 'object') {
    parserResult = {};
  }

  var merged = {};
  for (var key in listingRecord) {
    if (listingRecord.hasOwnProperty(key)) {
      merged[key] = listingRecord[key];
    }
  }

  merged.imageUrls = Array.isArray(listingRecord.imageUrls) ? listingRecord.imageUrls.slice() : [];
  merged.downloadIds = Array.isArray(listingRecord.downloadIds) ? listingRecord.downloadIds.slice() : [];
  merged.downloadedFiles = Array.isArray(listingRecord.downloadedFiles) ? listingRecord.downloadedFiles.slice() : [];

  var metadata = parserResult.metadata || {};
  if (metadata.datePosted && metadata.datePosted !== 'Not available') {
    merged.datePosted = metadata.datePosted;
  }
  if (metadata.category && metadata.category !== 'Not available') {
    merged.category = metadata.category;
  }
  if (metadata.province && metadata.province !== 'Not available') {
    merged.province = metadata.province;
  }
  if (metadata.location && metadata.location !== 'Not available') {
    merged.location = metadata.location;
  }
  if (metadata.subcategory && metadata.subcategory !== 'Not available') {
    merged.subcategory = metadata.subcategory;
  }
  if (metadata.sector && metadata.sector !== 'Not available') {
    merged.sector = metadata.sector;
  }
  if (metadata.newspaper && metadata.newspaper !== 'Not available') {
    merged.newspaper = metadata.newspaper;
  }
  if (metadata.lastDate && metadata.lastDate !== 'Not available') {
    merged.lastDate = metadata.lastDate;
  }

  if (parserResult.description && parserResult.description !== 'Not available') {
    merged.description = parserResult.description;
  }

  if (typeof parserResult.detailsText === 'string') {
    merged.detailsText = parserResult.detailsText;
  }

  var parserImages = Array.isArray(parserResult.imageUrls) ? parserResult.imageUrls : [];
  var newImages = [];
  for (var i = 0; i < parserImages.length; i++) {
    var url = parserImages[i];
    var isDup = false;
    for (var j = 0; j < newImages.length; j++) {
      if (newImages[j] === url) {
        isDup = true;
        break;
      }
    }
    if (!isDup) {
      newImages.push(url);
    }
  }
  merged.imageUrls = newImages;

  var mergedWarnings = [];
  if (Array.isArray(parserResult.warnings)) {
    for (var w = 0; w < parserResult.warnings.length; w++) {
      mergedWarnings.push(parserResult.warnings[w]);
    }
  }

  if (parserResult.tenderId && listingRecord.tenderId && parserResult.tenderId !== listingRecord.tenderId) {
    mergedWarnings.push('Parser-reported ID "' + parserResult.tenderId + '" differs from URL-derived ID "' + listingRecord.tenderId + '". Using URL-derived ID.');
  }

  merged.warnings = mergedWarnings;

  merged.downloadStatus = 'Parsed - Download Pending';
  merged.failureReason = null;
  merged.fetchAttempts = 1;
  merged.downloadedAt = null;
  merged.downloadIds = [];
  merged.downloadedFiles = [];

  return merged;
}
