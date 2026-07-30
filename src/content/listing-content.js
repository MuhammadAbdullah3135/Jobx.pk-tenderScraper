// ---- Phase 2 ----
if (!globalThis.__tenderContentInjected) {
  globalThis.__tenderContentInjected = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === INSPECT_LISTING_PAGE) {
      var paginationResult = inspectListingPage();
      var extractionResult = extractAllTenders();

      sendResponse({
        success: paginationResult.success,
        pageNumber: paginationResult.pageNumber,
        detectionSource: paginationResult.detectionSource,
        inspectedUrl: paginationResult.inspectedUrl,
        reason: paginationResult.reason,
        tenders: extractionResult.tenders,
        tenderCount: extractionResult.tenderCount,
        warnings: extractionResult.warnings
      });
      return true;
    }
  });
}

var DIAGNOSTIC_MODE = false;

var SECTION_HEADING_KEYWORDS = ['tenders', 'pakistan'];

var SECTION_HEADING_SELECTORS = ['h1', 'h2', 'h3', 'h4', 'legend', 'caption'];

var SECTION_SIBLING_SELECTORS = [
  'table',
  'div.tender-listing',
  'div.listing-table',
  'div.table-responsive',
  'section',
  'div.first_big_4col'
];

var CONTAINER_SELECTORS = [
  'table > tbody > tr',
  'table tr',
  'div.tender-item',
  'div.listing-item',
  'li.tender-item',
  'li.listing-item',
  'div.row',
  'div.row_container'
];

var HEADER_ROW_SELECTORS = ['tr th', 'tr.header', 'thead tr', 'div.row_container .bold'];

var TITLE_SELECTORS = ['a[href*="_tenders-"]', 'a[href*="tenders"]', 'a.tender-title', 'td:first-child a', 'div.cell31 a', 'a'];

var CITY_SELECTORS = [
  'td:nth-child(2)',
  'td.city',
  'span.city',
  'div.city',
  '.tender-city',
  '.location',
  'td:nth-child(3)',
  'div.cell32'
];

var DATE_SELECTORS = [
  'td:nth-child(3)',
  'td.date',
  'span.date',
  'div.date',
  '.tender-date',
  '.posting-date',
  'td:nth-child(4)',
  'div.cell33'
];

// ---- Phase 2 functions (preserved) ----

function inspectListingPage() {
  var result = {
    success: false,
    pageNumber: null,
    detectionSource: null,
    inspectedUrl: window.location.href,
    reason: null
  };

  var pageFromPagination = detectPaginationElement();
  if (pageFromPagination !== null) {
    result.success = true;
    result.pageNumber = pageFromPagination;
    result.detectionSource = 'pagination-element';
    return result;
  }

  var headingResult = detectHeadingOrTitle();
  if (headingResult !== null) {
    result.success = true;
    result.pageNumber = headingResult.number;
    result.detectionSource = headingResult.source;
    return result;
  }

  var pathnameNumber = detectPathname();
  if (pathnameNumber !== null) {
    result.success = true;
    result.pageNumber = pathnameNumber;
    result.detectionSource = 'pathname';
    return result;
  }

  result.success = true;
  result.pageNumber = 1;
  result.detectionSource = 'fallback';
  return result;
}

function detectPaginationElement() {
  var containerSelectors = [
    'nav[aria-label*="pagination" i]',
    '[role="navigation"][aria-label*="pagination" i]',
    '.pagination',
    '.pager',
    '.paging',
    '.page-numbers',
    'ul.pagination',
    'ol.pagination'
  ];

  for (var ci = 0; ci < containerSelectors.length; ci++) {
    var containers;
    try {
      containers = document.querySelectorAll(containerSelectors[ci]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < containers.length; i++) {
      var num = extractPageFromContainer(containers[i]);
      if (num !== null) {
        return num;
      }
    }
  }
  return null;
}

function extractPageFromContainer(container) {
  var indicatorSelectors = [
    '[aria-current="page"]',
    '.active',
    '.current',
    '.selected',
    'strong'
  ];

  for (var si = 0; si < indicatorSelectors.length; si++) {
    var elements;
    try {
      elements = container.querySelectorAll(indicatorSelectors[si]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < elements.length; i++) {
      if (!isVisible(elements[i])) continue;
      var num = extractNumber(elements[i].textContent);
      if (num !== null) {
        return num;
      }
    }
  }

  var liSelectors = ['li.active', 'li.current', 'li.selected'];
  for (var si = 0; si < liSelectors.length; si++) {
    var elements;
    try {
      elements = container.querySelectorAll(liSelectors[si]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < elements.length; i++) {
      if (!isVisible(elements[i])) continue;
      var num = extractNumber(elements[i].textContent);
      if (num !== null) {
        return num;
      }
    }
  }

  return null;
}

function isVisible(el) {
  if (!el || !el.getClientRects || el.getClientRects().length === 0) return false;
  if (el.hidden) return false;
  var style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  return true;
}

function extractNumber(text) {
  if (!text) return null;
  var match = text.trim().match(/(\d+)/);
  if (!match) return null;
  var num = parseInt(match[1], 10);
  if (!Number.isFinite(num) || num < 1 || num > 100000) return null;
  return num;
}

function detectHeadingOrTitle() {
  var headingSelectors = ['h1', 'h2', 'h3'];
  for (var hi = 0; hi < headingSelectors.length; hi++) {
    var headings;
    try {
      headings = document.querySelectorAll(headingSelectors[hi]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < headings.length; i++) {
      if (!isVisible(headings[i])) continue;
      var num = extractNumberFromPageText(headings[i].textContent);
      if (num !== null) {
        return { number: num, source: 'heading' };
      }
    }
  }

  if (document.title) {
    var num = extractNumberFromPageText(document.title);
    if (num !== null) {
      return { number: num, source: 'document-title' };
    }
  }

  return null;
}

function extractNumberFromPageText(text) {
  if (!text) return null;
  var match = text.match(/[Pp]age\s*(\d+)/);
  if (match) {
    var num = parseInt(match[1], 10);
    if (Number.isFinite(num) && num >= 1 && num <= 100000) return num;
  }
  return null;
}

function detectPathname() {
  var match = window.location.pathname.match(/^\/tenders-(\d+)\/?$/);
  if (match) {
    var num = parseInt(match[1], 10);
    if (Number.isFinite(num) && num >= 1) return num;
  }
  return null;
}

// ---- Phase 3A: Section discovery ----

function discoverTenderSection() {
  var headingEl = findTenderHeading();
  if (headingEl) {
    var sibling = findNearbyContainer(headingEl);
    if (sibling) {
      if (DIAGNOSTIC_MODE) console.log('Section found via heading sibling:', sibling.tagName);
      return sibling;
    }
  }

  for (var si = 0; si < SECTION_SIBLING_SELECTORS.length; si++) {
    var tables;
    try {
      tables = document.querySelectorAll(SECTION_SIBLING_SELECTORS[si]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < tables.length; i++) {
      if (!isVisible(tables[i])) continue;
      var rows = findTenderRows(tables[i]);
      if (rows && rows.length > 2) {
        if (DIAGNOSTIC_MODE) console.log('Section found via selector:', SECTION_SIBLING_SELECTORS[si], 'rows:', rows.length);
        return tables[i];
      }
    }
  }

  if (DIAGNOSTIC_MODE) console.log('Tender section not found');
  return null;
}

function findTenderHeading() {
  for (var hi = 0; hi < SECTION_HEADING_SELECTORS.length; hi++) {
    var elements;
    try {
      elements = document.querySelectorAll(SECTION_HEADING_SELECTORS[hi]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < elements.length; i++) {
      if (!isVisible(elements[i])) continue;
      var text = normalizeText(elements[i].textContent);
      var lowerText = text.toLowerCase();
      var matchesHeading = false;
      for (var ki = 0; ki < SECTION_HEADING_KEYWORDS.length; ki++) {
        if (lowerText.indexOf(SECTION_HEADING_KEYWORDS[ki]) !== -1) {
          matchesHeading = true;
        } else {
          matchesHeading = false;
          break;
        }
      }
      if (matchesHeading) {
        if (DIAGNOSTIC_MODE) console.log('Tender heading found:', text, 'in', elements[i].tagName);
        return elements[i];
      }
    }
  }
  return null;
}

function findNearbyContainer(headingEl) {
  if (!headingEl || !headingEl.parentElement) return null;

  var parent = headingEl.parentElement;
  for (var si = 0; si < SECTION_SIBLING_SELECTORS.length; si++) {
    var sibling;
    try {
      sibling = parent.querySelector(SECTION_SIBLING_SELECTORS[si]);
    } catch (e) {
      continue;
    }
    if (sibling && sibling !== headingEl) {
      var rows = findTenderRows(sibling);
      if (rows && rows.length > 2) {
        return sibling;
      }
    }
  }

  if (parent !== document.body) {
    var potential = parent.querySelector('table');
    if (potential) {
      var rows = findTenderRows(potential);
      if (rows && rows.length > 2) {
        return potential;
      }
    }
  }

  return null;
}

function findTenderRows(container) {
  if (!container) return null;

  for (var ci = 0; ci < CONTAINER_SELECTORS.length; ci++) {
    var rows;
    try {
      rows = container.querySelectorAll(CONTAINER_SELECTORS[ci]);
    } catch (e) {
      continue;
    }
    if (rows && rows.length > 0) {
      var detailCount = 0;
      for (var i = 0; i < rows.length; i++) {
        if (rowContainsTenderLink(rows[i])) {
          detailCount++;
        }
      }
      if (detailCount >= 1) {
        return rows;
      }
    }
  }
  return null;
}

function rowContainsTenderLink(row) {
  for (var ti = 0; ti < TITLE_SELECTORS.length; ti++) {
    var links;
    try {
      links = row.querySelectorAll(TITLE_SELECTORS[ti]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href && href.indexOf('_tenders-') !== -1) {
        return true;
      }
    }
  }
  return false;
}

// ---- Phase 3B: Full page extraction ----

function extractAllTenders() {
  var section = discoverTenderSection();
  if (!section) {
    return {
      tenders: [],
      tenderCount: 0,
      warnings: ['The tender listing section could not be found. The webpage structure may have changed.']
    };
  }

  var rows = findTenderRows(section);
  if (!rows || rows.length === 0) {
    return {
      tenders: [],
      tenderCount: 0,
      warnings: ['The tender section was found, but no valid tender listings were detected.']
    };
  }

  var candidates = [];

  for (var i = 0; i < rows.length; i++) {
    if (isHeaderRow(rows[i])) continue;
    if (!rowContainsTenderLink(rows[i])) continue;

    var interpreted = interpretSingleRow(rows[i]);
    if (!interpreted) continue;
    if (!interpreted.validUrl) continue;
    if (normalizeText(interpreted.title) === '') continue;

    candidates.push({
      rowElement: rows[i],
      isVisible: isVisible(rows[i]),
      title: interpreted.title,
      city: interpreted.city,
      date: interpreted.date,
      canonicalUrl: interpreted.validUrl
    });
  }

  if (candidates.length === 0) {
    return {
      tenders: [],
      tenderCount: 0,
      warnings: ['The tender section was found, but no valid tender listings were detected.']
    };
  }

  var urlMap = {};
  var deduplicated = [];

  for (var ci = 0; ci < candidates.length; ci++) {
    var url = candidates[ci].canonicalUrl;
    if (urlMap[url] !== undefined) {
      var existing = deduplicated[urlMap[url]];
      if (!existing.isVisible && candidates[ci].isVisible) {
        deduplicated[urlMap[url]] = candidates[ci];
      }
      continue;
    }
    urlMap[url] = deduplicated.length;
    deduplicated.push(candidates[ci]);
  }

  var tenders = [];
  for (var di = 0; di < deduplicated.length; di++) {
    tenders.push({
      listingPosition: di + 1,
      originalListingTitle: deduplicated[di].title,
      city: deduplicated[di].city,
      datePosted: deduplicated[di].date,
      detailUrl: deduplicated[di].canonicalUrl
    });
  }

  return {
    tenders: tenders,
    tenderCount: tenders.length,
    warnings: []
  };
}

// ---- Phase 3A: Row-level interpretation ----

function inspectFirstTenderRow() {
  var section = discoverTenderSection();
  if (!section) {
    return { found: false, row: null, reason: 'Tender section not found.' };
  }

  var rows = findTenderRows(section);
  if (!rows || rows.length === 0) {
    return { found: false, row: null, reason: 'No tender rows found.' };
  }

  for (var i = 0; i < rows.length; i++) {
    if (!isVisible(rows[i])) continue;
    if (isHeaderRow(rows[i])) continue;
    if (!rowContainsTenderLink(rows[i])) continue;

    var interpreted = interpretSingleRow(rows[i]);
    if (interpreted && interpreted.validUrl) {
      return {
        found: true,
        row: interpreted,
        containerTag: rows[i].tagName,
        rowIndex: i + 1,
        reason: null
      };
    }
  }

  return { found: false, row: null, reason: 'No visible valid tender row found.' };
}

function isHeaderRow(row) {
  for (var hi = 0; hi < HEADER_ROW_SELECTORS.length; hi++) {
    var cells;
    try {
      cells = row.querySelectorAll(HEADER_ROW_SELECTORS[hi]);
    } catch (e) {
      continue;
    }
    if (cells && cells.length > 0) {
      var text = normalizeText(row.textContent).toLowerCase();
      if (text.indexOf('title') !== -1 || text.indexOf('city') !== -1 || text.indexOf('date') !== -1 || text.indexOf('location') !== -1 || text.indexOf('posted') !== -1) {
        return true;
      }
    }
  }
  return false;
}

function interpretSingleRow(row) {
  if (!row) return null;

  var detailAnchor = null;
  var detailHref = null;
  var title = '';

  for (var ti = 0; ti < TITLE_SELECTORS.length; ti++) {
    var links;
    try {
      links = row.querySelectorAll(TITLE_SELECTORS[ti]);
    } catch (e) {
      continue;
    }
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (href && href.indexOf('_tenders-') !== -1) {
        detailAnchor = links[i];
        detailHref = href;
        break;
      }
    }
    if (detailAnchor) break;
  }

  if (!detailAnchor) {
    return null;
  }

  title = normalizeText(detailAnchor.textContent);
  if (title === '') {
    title = normalizeText(detailAnchor.getAttribute('title') || '');
  }

  var result = {
    title: title,
    rawHref: detailHref,
    validUrl: null,
    city: 'Not available',
    date: 'Not available'
  };

  var urlResult = typeof normalizeTenderUrl === 'function'
    ? normalizeTenderUrl(detailHref, window.location.href)
    : null;

  if (urlResult && urlResult.valid) {
    result.validUrl = urlResult.url;
  }

  for (var ci = 0; ci < CITY_SELECTORS.length; ci++) {
    var cells;
    try {
      cells = row.querySelectorAll(CITY_SELECTORS[ci]);
    } catch (e) {
      continue;
    }
    if (cells && cells.length > 0) {
      var cityText = normalizeText(cells[0].textContent);
      if (cityText !== '' && cityText !== result.title) {
        result.city = cityText;
        break;
      }
    }
  }

  for (var di = 0; di < DATE_SELECTORS.length; di++) {
    var cells;
    try {
      cells = row.querySelectorAll(DATE_SELECTORS[di]);
    } catch (e) {
      continue;
    }
    if (cells && cells.length > 0) {
      var dateText = normalizeText(cells[0].textContent);
      if (dateText !== '' && dateText !== result.city && dateText !== result.title) {
        result.date = dateText;
        break;
      }
    }
  }

  return result;
}
