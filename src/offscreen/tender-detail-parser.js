// Phase 5B — Tender Detail HTML Parser
// Pure helper functions tested in Node; DOMParser integration in offscreen document only.

var METADATA_LABEL_ALIASES = {
  datePosted: [
    'date posted', 'posted date', 'posted on', 'date published',
    'publish date', 'published date', 'date', 'publish on', 'created date'
  ],
  category: [
    'category', 'tender category', 'category type', 'category/type'
  ],
  province: [
    'province', 'province / area', 'province/area', 'region', 'province area'
  ],
  location: [
    'location', 'tender location', 'place', 'area', 'city'
  ],
  subcategory: [
    'subcategory', 'sub category', 'sub-category', 'type'
  ],
  sector: [
    'sector', 'industry', 'sector type', 'sector/industry'
  ],
  newspaper: [
    'newspaper', 'news paper', 'daily', 'publication', 'published in'
  ],
  lastDate: [
    'last date', 'closing date', 'deadline', 'due date',
    'submission date', 'last date of submission', 'bid submission date',
    'last date to submit', 'closing', 'late date'
  ]
};

var ALLOWED_IMAGE_HOSTS = ['www.jobz.pk', 'jobz.pk'];

var IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

var UNWANTED_IMAGE_PATTERNS = [
  'logo', 'favicon', 'avatar', 'spinner', 'loading', 'tracking',
  'pixel', 'social_icon', 'share_icon', 'facebook_icon',
  'banner', 'advertisement', 'promotion', 'promo_banner',
  'google_adsense', 'captcha', 'thumbnail_'
];

var DESCRIPTION_MAX_LENGTH = 50000;

// ---- Pure Helper Functions ----

function normalizeLabel(label) {
  if (typeof label !== 'string') return '';
  return label
    .toLowerCase()
    .replace(/\u00A0/g, ' ')
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/[ ]+/g, ' ')
    .replace(/:+$/g, '')
    .replace(/\*+$/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
}

function matchLabel(label, aliases) {
  var normalized = normalizeLabel(label);
  if (!normalized) return false;

  for (var i = 0; i < aliases.length; i++) {
    var alias = normalizeLabel(aliases[i]);
    if (!alias) continue;
    if (normalized === alias) return true;
    if (normalized.indexOf(alias) !== -1) return true;
    if (alias.indexOf(normalized) !== -1) return true;
  }
  return false;
}

function addWarning(warnings, warning) {
  if (!Array.isArray(warnings)) return [warning];
  for (var i = 0; i < warnings.length; i++) {
    if (warnings[i] === warning) return warnings;
  }
  warnings.push(warning);
  return warnings;
}

function isValidImageUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') return false;
  var trimmed = url.trim();

  if (trimmed.indexOf('http:') !== 0 && trimmed.indexOf('https:') !== 0) return false;
  if (trimmed.indexOf('data:') === 0 || trimmed.indexOf('blob:') === 0) return false;
  if (trimmed.indexOf('javascript:') === 0) return false;

  var pathPart = trimmed.replace(/[?#].*$/, '');
  var lastDot = pathPart.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return false;
  var ext = pathPart.substring(lastDot).toLowerCase();
  var hasValidExt = false;
  for (var i = 0; i < IMAGE_EXTENSIONS.length; i++) {
    if (ext === IMAGE_EXTENSIONS[i]) {
      hasValidExt = true;
      break;
    }
  }
  if (!hasValidExt) return false;

  var filename = pathPart.split('/').pop() || '';
  var filenameLower = filename.toLowerCase();
  for (var j = 0; j < UNWANTED_IMAGE_PATTERNS.length; j++) {
    if (filenameLower.indexOf(UNWANTED_IMAGE_PATTERNS[j]) !== -1) return false;
  }

  return true;
}

function isImageAllowedHost(url) {
  if (typeof url !== 'string') return false;
  try {
    var parsed = new URL(url);
    var host = parsed.hostname.toLowerCase();
    for (var i = 0; i < ALLOWED_IMAGE_HOSTS.length; i++) {
      if (host === ALLOWED_IMAGE_HOSTS[i]) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function canonicalizeImageUrl(url, sourceUrl) {
  if (typeof url !== 'string' || url.trim() === '') return null;
  var trimmed = url.trim();

  if (trimmed.indexOf('http://') === 0 || trimmed.indexOf('https://') === 0) {
    try {
      var parsed = new URL(trimmed);
      if (parsed.protocol === 'http:') parsed.protocol = 'https:';
      parsed.hash = '';
      return parsed.href;
    } catch (e) {
      return null;
    }
  }

  if (typeof sourceUrl !== 'string') return null;
  try {
    var resolved = new URL(trimmed, sourceUrl);
    if (resolved.protocol === 'http:') resolved.protocol = 'https:';
    resolved.hash = '';
    return resolved.href;
  } catch (e) {
    return null;
  }
}

function truncateDescription(text, maxLength) {
  if (typeof text !== 'string') return '';
  if (typeof maxLength !== 'number' || maxLength < 1) maxLength = DESCRIPTION_MAX_LENGTH;

  var chars = Array.from(text);
  if (chars.length <= maxLength) return text;

  var truncated = chars.slice(0, maxLength).join('');
  var lastSpace = truncated.lastIndexOf(' ', truncated.length - 1);
  if (lastSpace >= 0 && lastSpace > maxLength - 100) {
    truncated = truncated.substring(0, lastSpace);
  }

  return truncated.trim() + '\n\nThe description was truncated.';
}

function normalizeCellText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u00A0/g, ' ')
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/[ ]+/g, ' ')
    .replace(/:+$/g, '')
    .trim();
}

// ---- DOM-dependent Extraction Functions ----

function stripUnwantedElements(doc) {
  if (!doc || !doc.body) return;

  var selectors = [
    'script', 'style', 'noscript', 'template', 'svg',
    '[style*="display:none"]', '[style*="display: none"]',
    '[hidden]', '.hidden',
    '.nav', '.navbar', '.navigation', 'nav',
    '.footer', 'footer',
    '.sidebar', 'aside',
    '.social-share', '.share-buttons',
    '.related-tenders', '.related-jobs',
    '.breadcrumb', '.breadcrumbs',
    '.advertisement', '.ad-container', '.google-ads',
    '.signup', '.login-form', '.newsletter', '.subscribe',
    '.comments', '#comments'
  ];

  var removals = doc.body.querySelectorAll(selectors.join(', '));
  for (var i = 0; i < removals.length; i++) {
    if (removals[i] && removals[i].parentNode) {
      removals[i].parentNode.removeChild(removals[i]);
    }
  }
}

function findMainContent(doc) {
  if (!doc || !doc.body) return null;

  var selectors = [
    '#tender-detail', '.tender-detail', '.detail-content',
    '.tender-details', '#content', '.content-area', '.main-content',
    '#main', 'main', '.post-content', '.entry-content',
    '.page-content', '.detail-page', '#detail'
  ];

  for (var i = 0; i < selectors.length; i++) {
    var el = doc.querySelector(selectors[i]);
    if (el) return el;
  }

  var body = doc.body;
  var candidates = body.querySelectorAll('div, section, article');
  var best = null;
  var bestCount = 0;

  for (var j = 0; j < candidates.length; j++) {
    var candidate = candidates[j];
    var text = candidate.textContent || '';
    if (text.length < 100) continue;

    var id = (candidate.id || '').toLowerCase();
    var cls = (candidate.className || '').toLowerCase();
    if (id.indexOf('nav') !== -1 || id.indexOf('footer') !== -1 || id.indexOf('sidebar') !== -1) continue;
    if (cls.indexOf('nav') !== -1 || cls.indexOf('footer') !== -1 || cls.indexOf('sidebar') !== -1) continue;

    var descendantCount = candidate.querySelectorAll('*').length;
    if (descendantCount > bestCount) {
      bestCount = descendantCount;
      best = candidate;
    }
  }

  return best || body;
}

function extractTableMetadata(doc, mainContent) {
  var result = {};
  if (!mainContent) return result;

  var tables = mainContent.querySelectorAll('table');
  for (var t = 0; t < tables.length; t++) {
    var table = tables[t];
    var rows = table.querySelectorAll('tr');

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var cells = row.querySelectorAll('th, td');
      if (cells.length < 2) continue;

      var labelCell = null;
      var valueCell = null;

      if (cells[0].tagName === 'TH' && cells[1].tagName === 'TD') {
        labelCell = cells[0];
        valueCell = cells[1];
      } else if (cells[0].tagName === 'TD' && cells[1].tagName === 'TD') {
        var firstText = cells[0].textContent || '';
        if (firstText.indexOf(':') !== -1 || firstText.trim().length < 50) {
          labelCell = cells[0];
          valueCell = cells[1];
        } else {
          continue;
        }
      } else {
        continue;
      }

      var rawLabel = labelCell.textContent || '';
      var rawValue = valueCell.textContent || '';
      var label = normalizeLabel(rawLabel);
      var value = normalizeCellText(rawValue);

      if (!label || !value) continue;

      for (var key in METADATA_LABEL_ALIASES) {
        if (result[key]) continue;
        if (matchLabel(label, METADATA_LABEL_ALIASES[key])) {
          result[key] = value;
        }
      }
    }
  }

  return result;
}

function extractDlMetadata(doc, mainContent) {
  var result = {};
  if (!mainContent) return result;

  var dls = mainContent.querySelectorAll('dl');
  for (var d = 0; d < dls.length; d++) {
    var dl = dls[d];
    var items = dl.querySelectorAll('dt');

    for (var i = 0; i < items.length; i++) {
      var dt = items[i];
      var dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== 'DD') continue;

      var rawLabel = dt.textContent || '';
      var rawValue = dd.textContent || '';
      var label = normalizeLabel(rawLabel);
      var value = normalizeCellText(rawValue);

      if (!label || !value) continue;

      for (var key in METADATA_LABEL_ALIASES) {
        if (result[key]) continue;
        if (matchLabel(label, METADATA_LABEL_ALIASES[key])) {
          result[key] = value;
        }
      }
    }
  }

  return result;
}

function extractDivMetadata(doc, mainContent) {
  var result = {};
  if (!mainContent) return result;

  var divs = mainContent.querySelectorAll('div[class*="row"], div[class*="field"], div[class*="item"], div[class*="detail"]');

  for (var d = 0; d < divs.length; d++) {
    var div = divs[d];
    var children = div.children;
    if (children.length < 2) continue;

    var labelEl = null;
    var valueEl = null;
    var first = children[0];
    var second = children[1];
    var firstText = first.textContent || '';

    if (firstText.indexOf(':') !== -1 || firstText.trim().length < 50) {
      if (first.className.indexOf('label') !== -1 || first.className.indexOf('title') !== -1 ||
          first.tagName === 'LABEL' || first.tagName === 'SPAN' || first.tagName === 'STRONG') {
        labelEl = first;
        valueEl = second;
      } else if (second.className.indexOf('value') !== -1 || second.className.indexOf('content') !== -1) {
        labelEl = first;
        valueEl = second;
      }
    }

    if (!labelEl || !valueEl) continue;

    var rawLabel = labelEl.textContent || '';
    var rawValue = valueEl.textContent || '';
    var label = normalizeLabel(rawLabel);
    var value = normalizeCellText(rawValue);

    if (!label || !value) continue;

    for (var key in METADATA_LABEL_ALIASES) {
      if (result[key]) continue;
      if (matchLabel(label, METADATA_LABEL_ALIASES[key])) {
        result[key] = value;
      }
    }
  }

  var labelSpans = mainContent.querySelectorAll('span.label, strong.label, .field-label, .detail-label');
  for (var s = 0; s < labelSpans.length; s++) {
    var labelEl2 = labelSpans[s];
    var rawLabel2 = labelEl2.textContent || '';
    var label2 = normalizeLabel(rawLabel2);
    if (!label2) continue;

    var next = labelEl2.nextElementSibling;
    if (!next) {
      var parent = labelEl2.parentNode;
      var siblings = parent.children;
      for (var si = 0; si < siblings.length; si++) {
        if (siblings[si] === labelEl2 && si + 1 < siblings.length) {
          next = siblings[si + 1];
          break;
        }
      }
    }
    if (!next) continue;

    var rawValue2 = next.textContent || '';
    var value2 = normalizeCellText(rawValue2);
    if (!value2) continue;

    for (var key2 in METADATA_LABEL_ALIASES) {
      if (result[key2]) continue;
      if (matchLabel(label2, METADATA_LABEL_ALIASES[key2])) {
        result[key2] = value2;
      }
    }
  }

  return result;
}

function extractAllMetadata(doc, mainContent) {
  var result = {};

  var tableMeta = extractTableMetadata(doc, mainContent);
  for (var k in tableMeta) result[k] = tableMeta[k];

  var dlMeta = extractDlMetadata(doc, mainContent);
  for (var k2 in dlMeta) {
    if (!result[k2]) result[k2] = dlMeta[k2];
  }

  var divMeta = extractDivMetadata(doc, mainContent);
  for (var k3 in divMeta) {
    if (!result[k3]) result[k3] = divMeta[k3];
  }

  return result;
}

function extractPageTitle(doc, mainContent, originalListingTitle) {
  if (mainContent) {
    var h1 = mainContent.querySelector('h1');
    if (h1) {
      var text = h1.textContent || '';
      text = normalizeCellText(text);
      if (text) {
        text = text.replace(/\s*[|-]\s*(Jobz\.pk|Jobz|Free Classifieds).*$/i, '').trim();
        if (text) return text;
      }
    }
  }

  var docTitle = doc.title || '';
  if (docTitle) {
    docTitle = normalizeCellText(docTitle);
    docTitle = docTitle.replace(/\s*[|-]\s*(Jobz\.pk|Jobz|Free Classifieds).*$/i, '').trim();
    if (docTitle) return docTitle;
  }

  if (typeof originalListingTitle === 'string' && originalListingTitle.trim()) {
    return normalizeCellText(originalListingTitle);
  }

  return 'Unknown Tender';
}

function extractDescription(doc) {
  if (!doc || !doc.body) return '';

  var descriptionSelectors = [
    '.tender-description', '#tender-description', '.description-content',
    '.description', '#description', '.detail-description',
    '.tender-detail-description', '.full-description'
  ];

  for (var i = 0; i < descriptionSelectors.length; i++) {
    var el = doc.querySelector(descriptionSelectors[i]);
    if (el) {
      var text = el.textContent || '';
      text = normalizeCellText(text);
      if (text.length > 20) return truncateDescription(text, DESCRIPTION_MAX_LENGTH);
    }
  }

  var headings = doc.querySelectorAll('h2, h3, h4, h5, strong');
  for (var h = 0; h < headings.length; h++) {
    var headingText = (headings[h].textContent || '').toLowerCase().trim();
    if (headingText.indexOf('description') !== -1 ||
        headingText.indexOf('tender details') !== -1 ||
        headingText.indexOf('details') !== -1) {
      var parent = headings[h].parentNode;
      var siblings = parent.children;
      var startCollecting = false;
      var parts = [];

      for (var s = 0; s < siblings.length; s++) {
        if (siblings[s] === headings[h]) {
          startCollecting = true;
          continue;
        }
        if (startCollecting) {
          var tag = siblings[s].tagName;
          if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5') break;
          if (tag === 'TABLE' || tag === 'DL') continue;

          var siblingText = siblings[s].textContent || '';
          if (siblingText.trim()) {
            parts.push(siblingText.trim());
          }
        }
      }

      if (parts.length > 0) {
        var combined = parts.join('\n\n');
        combined = normalizeCellText(combined);
        if (combined.length > 20) return truncateDescription(combined, DESCRIPTION_MAX_LENGTH);
      }
    }
  }

  return '';
}

function extractTenderImages(doc, mainContent, expectedTenderId, sourceUrl) {
  var images = [];
  if (!doc) return images;

  var imgElements = null;

  var adPicCont = doc.getElementById('ad-pic-cont');
  if (adPicCont) {
    imgElements = adPicCont.querySelectorAll('img');
  }

  if (!imgElements || imgElements.length === 0) {
    var adPicClass = doc.querySelector('.ad-pic-cont');
    if (adPicClass) {
      imgElements = adPicClass.querySelectorAll('img');
    }
  }

  if (!imgElements || imgElements.length === 0) {
    if (mainContent) {
      var allImgs = mainContent.querySelectorAll('img');
      var filtered = [];
      for (var fi = 0; fi < allImgs.length; fi++) {
        var fu = allImgs[fi].getAttribute('src') || '';
        if (!fu || fu.trim() === '') continue;
        var fc = canonicalizeImageUrl(fu, sourceUrl);
        if (fc && fc.indexOf('/images/tenders/') !== -1) {
          filtered.push(allImgs[fi]);
        }
      }
      imgElements = filtered;
    }
  }

  if (!imgElements || imgElements.length === 0) return images;

  for (var i = 0; i < imgElements.length; i++) {
    var url = imgElements[i].getAttribute('src') || '';
    if (!url || url.trim() === '') continue;

    if (!isValidImageUrl(url)) continue;

    var canonical = canonicalizeImageUrl(url, sourceUrl);
    if (!canonical) continue;

    if (!isImageAllowedHost(canonical)) continue;

    var isDuplicate = false;
    for (var j = 0; j < images.length; j++) {
      if (images[j] === canonical) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    images.push(canonical);
  }

  return images;
}

function extractJobDetailAsText(doc) {
  if (!doc) return '';
  var jobDetailEl = doc.querySelector('.job_detail');
  if (!jobDetailEl) return '';
  var rows = jobDetailEl.querySelectorAll('.row_job_detail');
  var parts = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var keyEl = row.querySelector('.job_detail_cell1');
    var valueEl = row.querySelector('.job_detail_cell2');
    if (!keyEl || !valueEl) continue;
    var key = normalizeCellText(keyEl.textContent || '');
    var value = normalizeCellText(valueEl.textContent || '');
    if (!key || !value) continue;
    parts.push(key + ': ' + value);
  }
  return parts.join('\r\n');
}

// ---- Main Entry Point ----

function parseTenderDetail(html, sourceUrl, expectedTenderId, originalListingTitle) {
  if (typeof html !== 'string') {
    return {
      success: false,
      code: 'INVALID_HTML',
      message: 'The HTML input must be a string.',
      metadata: null,
      pageTitle: null,
      tenderId: null,
      imageUrls: [],
      warnings: ['Invalid HTML input type.']
    };
  }

  var doc;
  try {
    doc = new DOMParser().parseFromString(html, 'text/html');
  } catch (e) {
    return {
      success: false,
      code: 'HTML_PARSE_FAILED',
      message: 'DOMParser failed to parse the tender HTML.',
      metadata: null,
      pageTitle: null,
      tenderId: null,
      imageUrls: [],
      warnings: ['DOMParser threw an exception.']
    };
  }

  if (!doc || !doc.documentElement) {
    return {
      success: false,
      code: 'NO_TENDER_CONTENT',
      message: 'The parsed document has no content.',
      metadata: null,
      pageTitle: null,
      tenderId: null,
      imageUrls: [],
      warnings: ['Parsed document has no document element.']
    };
  }

  var warnings = [];

  stripUnwantedElements(doc);

  var mainContent = findMainContent(doc);
  if (!mainContent) {
    addWarning(warnings, 'Could not identify a main content area. Using full body.');
    mainContent = doc.body;
  }

  var metadata = extractAllMetadata(doc, mainContent);

  var defaultMetadata = {
    datePosted: 'Not available',
    category: 'Not available',
    province: 'Not available',
    location: 'Not available',
    subcategory: 'Not available',
    sector: 'Not available',
    newspaper: 'Not available',
    lastDate: 'Not available'
  };
  for (var mKey in defaultMetadata) {
    if (!metadata[mKey] || metadata[mKey].trim() === '') {
      metadata[mKey] = defaultMetadata[mKey];
    }
  }

  var pageTitle = extractPageTitle(doc, mainContent, originalListingTitle);

  var tenderId = expectedTenderId;

  var description = extractDescription(doc);

  var imageUrls = extractTenderImages(doc, mainContent, expectedTenderId, sourceUrl);

  var detailsText = extractJobDetailAsText(doc);

  return {
    success: true,
    metadata: metadata,
    description: description || 'Not available',
    pageTitle: pageTitle,
    tenderId: tenderId,
    imageUrls: imageUrls,
    detailsText: detailsText,
    warnings: warnings
  };
}
