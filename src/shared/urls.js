/**
 * File: urls.js
 * Phase 4A — URL normalization, canonicalization, tender ID extraction, and validation.
 * Pure functions — no browser APIs, no DOM access, no network requests.
 */

/**
 * canonicalizeJobzUrl — Canonicalize a Jobz.pk URL to https://www.jobz.pk/...
 * @param {string} value - Absolute or relative URL
 * @param {string} [baseUrl] - Optional trusted Jobz.pk base URL
 * @returns {string|null} Canonical URL or null if invalid
 */
function canonicalizeJobzUrl(value, baseUrl) {
  if (typeof value !== 'string' || value.trim() === '') return null;

  var trimmed = value.trim();
  var lower = trimmed.toLowerCase();

  if (lower.indexOf('javascript:') === 0) return null;
  if (lower.indexOf('mailto:') === 0) return null;
  if (lower.indexOf('tel:') === 0) return null;
  if (lower.indexOf('data:') === 0) return null;
  if (lower.indexOf('file:') === 0) return null;
  if (lower.indexOf('chrome:') === 0) return null;
  if (lower.indexOf('edge:') === 0) return null;
  if (lower.indexOf('about:') === 0) return null;

  var base = 'https://www.jobz.pk/';
  if (typeof baseUrl === 'string' && baseUrl.trim() !== '') {
    try {
      var parsedBase = new URL(baseUrl);
      if (parsedBase.hostname.indexOf('jobz.pk') !== -1) {
        base = parsedBase.href;
      }
    } catch (e) {}
  }

  try {
    var resolved = new URL(trimmed, base);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    var hostname = resolved.hostname.toLowerCase();
    if (hostname !== 'www.jobz.pk' && hostname !== 'jobz.pk') return null;
    resolved.protocol = 'https:';
    resolved.hostname = 'www.jobz.pk';
    resolved.port = '';
    resolved.hash = '';
    return resolved.href;
  } catch (e) {
    return null;
  }
}

/**
 * extractTenderId — Extract numeric tender ID from a valid Jobz.pk tender-detail URL.
 * @param {string} url
 * @returns {string|null} Tender ID as a string, or null
 */
function extractTenderId(url) {
  if (typeof url !== 'string') return null;

  try {
    var parsed = new URL(url);
    var hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'www.jobz.pk' && hostname !== 'jobz.pk') return null;

    var match = parsed.pathname.match(/_tenders-(\d+)\.html$/);
    if (!match) return null;

    var id = match[1];
    var num = parseInt(id, 10);
    if (!Number.isFinite(num) || num < 1) return null;

    return id;
  } catch (e) {
    return null;
  }
}

/**
 * validateTenderDetailUrl — Strict validation of a tender-detail URL.
 * @param {string} value
 * @returns {{ valid: boolean, canonicalUrl: string|null, tenderId: string|null }}
 */
function validateTenderDetailUrl(value) {
  var canonical = canonicalizeJobzUrl(value);
  if (!canonical) {
    return { valid: false, canonicalUrl: null, tenderId: null };
  }

  try {
    var stripped = new URL(canonical);
    stripped.search = '';
    stripped.hash = '';
    canonical = stripped.href;
  } catch (e) {}

  var id = extractTenderId(canonical);
  if (!id) {
    return { valid: false, canonicalUrl: canonical, tenderId: null };
  }

  return { valid: true, canonicalUrl: canonical, tenderId: id };
}
