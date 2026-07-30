// ---- Phase 2/3C utilities (preserved) ----

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u00A0/g, ' ')
              .replace(/[\t\n\r]+/g, ' ')
              .replace(/[ ]+/g, ' ')
              .trim();
}

function normalizeTenderUrl(rawHref, currentUrl) {
  if (!rawHref || typeof rawHref !== 'string') {
    return { valid: false, url: null, id: null, reason: 'Empty or missing URL.' };
  }

  var trimmed = rawHref.trim();
  if (trimmed === '' || trimmed === '#') {
    return { valid: false, url: null, id: null, reason: 'Empty or hash-only URL.' };
  }

  var lower = trimmed.toLowerCase();

  if (lower.indexOf('javascript:') === 0) {
    return { valid: false, url: null, id: null, reason: 'JavaScript URL rejected.' };
  }
  if (lower.indexOf('mailto:') === 0) {
    return { valid: false, url: null, id: null, reason: 'Mailto URL rejected.' };
  }
  if (lower.indexOf('tel:') === 0) {
    return { valid: false, url: null, id: null, reason: 'Tel URL rejected.' };
  }

  var resolved;
  try {
    if (!currentUrl || typeof currentUrl !== 'string') {
      resolved = new URL(trimmed, 'https://www.jobz.pk');
    } else {
      resolved = new URL(trimmed, currentUrl);
    }
  } catch (e) {
    return { valid: false, url: null, id: null, reason: 'URL could not be parsed.' };
  }

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    return { valid: false, url: null, id: null, reason: 'Only HTTP and HTTPS URLs are accepted.' };
  }

  var hostname = resolved.hostname.toLowerCase();
  if (hostname !== 'www.jobz.pk' && hostname !== 'jobz.pk') {
    return { valid: false, url: null, id: null, reason: 'Hostname is not a supported Jobz.pk domain.' };
  }

  var pathname = resolved.pathname;
  var match = pathname.match(/_tenders-(\d+)\.html$/);
  if (!match) {
    return { valid: false, url: null, id: null, reason: 'Pathname does not match a tender-detail pattern.' };
  }

  var id = parseInt(match[1], 10);
  if (!Number.isFinite(id) || id < 1) {
    return { valid: false, url: null, id: null, reason: 'Tender ID is not a positive integer.' };
  }

  resolved.protocol = 'https:';
  resolved.hostname = 'www.jobz.pk';
  resolved.hash = '';
  resolved.search = '';

  return { valid: true, url: resolved.href, id: id, reason: null };
}

// ---- Phase 4A utilities ----

function normalizeWhitespace(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return String(value);
  return value.replace(/\u00A0/g, ' ')
              .replace(/[\t\n\r]+/g, ' ')
              .replace(/[ ]+/g, ' ')
              .trim();
}

function normalizePaginationNumber(value) {
  var num = 1;
  if (typeof value === 'number' && Number.isFinite(value)) {
    num = Math.trunc(value);
  } else if (typeof value === 'string') {
    var trimmed = value.trim();
    var parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) num = parsed;
  }
  if (!Number.isFinite(num) || num < 1) return 1;
  return num;
}

function formatSequenceNumber(value) {
  var num = 1;
  if (typeof value === 'number' && Number.isFinite(value)) {
    num = Math.floor(value);
  } else if (typeof value === 'string') {
    var trimmed = value.trim();
    var parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) num = parsed;
  }
  if (!Number.isFinite(num) || num < 1) num = 1;
  if (num < 10) return '00' + num;
  if (num < 100) return '0' + num;
  return String(num);
}

function createLocalTimestamp(date) {
  var d;
  if (date instanceof Date && !isNaN(date.getTime())) {
    d = date;
  } else {
    d = new Date();
  }
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  var h = String(d.getHours()).padStart(2, '0');
  var min = String(d.getMinutes()).padStart(2, '0');
  var s = String(d.getSeconds()).padStart(2, '0');
  return y + '-' + m + '-' + day + '_' + h + '-' + min + '-' + s;
}
