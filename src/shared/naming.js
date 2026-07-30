/**
 * File: naming.js
 * Phase 4A — Naming utilities for safe path components, title cleanup, and folder naming.
 * Pure functions — no browser APIs, no DOM access, no network requests.
 */

/**
 * @const {string[]} WINDOWS_RESERVED_NAMES
 * Windows device names that cannot be used as file or folder names.
 */
var WINDOWS_RESERVED_NAMES = [
  'CON', 'PRN', 'AUX', 'NUL', 'CLOCK$',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
];

/**
 * removeTenderTitlePrefix — Remove leading "Tender for the" from a title.
 * @param {string} title
 * @returns {string} Cleaned title, or "Unknown Tender" if nothing remains.
 */
function removeTenderTitlePrefix(title) {
  var normalized = normalizeWhitespace(title);
  if (normalized === '') return 'Unknown Tender';

  var pattern = /^[\s]*tender\s+for\s+the[\s]*/i;
  var result = normalized.replace(pattern, '');
  result = normalizeWhitespace(result);

  if (result === '') return 'Unknown Tender';
  return result;
}

/**
 * createSafeFallbackTitle — Normalize whitespace or return "Unknown Tender".
 * @param {*} value
 * @returns {string}
 */
function createSafeFallbackTitle(value) {
  var normalized = normalizeWhitespace(value);
  if (normalized === '') return 'Unknown Tender';
  return normalized;
}

/**
 * sanitizePathComponent — Return one safe Windows filename or folder component.
 * @param {*} value
 * @param {{ replacementSeparator?: string, maxLength?: number }} [options]
 * @returns {string}
 */
function sanitizePathComponent(value, options) {
  if (value === null || value === undefined) return 'Unknown Tender';
  if (typeof value !== 'string') value = String(value);

  options = options || {};
  var sep = typeof options.replacementSeparator === 'string' && options.replacementSeparator.length > 0
    ? options.replacementSeparator : '-';
  var maxLen = typeof options.maxLength === 'number' && options.maxLength > 0 ? options.maxLength : 100;

  var s = value;

  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/[\t\n\r]+/g, ' ');
  s = s.replace(/[<>:"\/\\|?*]/g, sep);
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  s = s.replace(/\x00/g, '');
  s = s.replace(/[ ]+/g, ' ');
  s = s.replace(new RegExp(escapeRegex(sep) + '+', 'g'), sep);
  s = s.trim();
  s = s.replace(new RegExp('[' + escapeRegex(sep) + '.]+$', 'g'), '');
  s = s.replace(new RegExp('^' + escapeRegex(sep) + '+', 'g'), '');
  s = s.replace(/\.\./g, '.');

  if (s === '' || s === '.') return 'Unknown Tender';

  var testStr = s.replace(new RegExp('[' + escapeRegex(sep) + ' .]', 'g'), '');
  if (testStr === '') return 'Unknown Tender';

  var dotIndex = s.indexOf('.');
  var namePart = dotIndex !== -1 ? s.substring(0, dotIndex) : s;
  var extPart = dotIndex !== -1 ? s.substring(dotIndex) : '';

  for (var ri = 0; ri < WINDOWS_RESERVED_NAMES.length; ri++) {
    if (namePart.toUpperCase() === WINDOWS_RESERVED_NAMES[ri]) {
      s = '_' + namePart + extPart;
      break;
    }
  }

  var chars = Array.from(s);
  if (chars.length > maxLen) {
    chars = chars.slice(0, maxLen);
    s = chars.join('');
    s = s.trim();
    s = s.replace(new RegExp('[' + escapeRegex(sep) + '.]+$', 'g'), '');
    s = s.replace(new RegExp('^' + escapeRegex(sep) + '+', 'g'), '');
    if (s === '' || s === '.') return 'Unknown Tender';
  }

  return s;
}

/**
 * preventPathTraversal — Ensure a path component cannot escape or become absolute.
 * @param {*} value
 * @returns {string}
 */
function preventPathTraversal(value) {
  if (typeof value !== 'string') return '';
  var s = value;
  s = s.replace(/\\/g, '/');
  s = s.replace(/^[a-zA-Z]:\/?/g, '');
  s = s.replace(/^\/+/, '');
  var parts = s.split('/');
  var result = [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] === '..') continue;
    if (parts[i] === '.' || parts[i] === '') continue;
    result.push(parts[i]);
  }
  return result.join('/');
}

/**
 * createTenderFolderName — Build a folder name: SEQUENCE_CLEANED_TITLE
 * @param {*} sequence
 * @param {string} originalTitle
 * @returns {string}
 */
function createTenderFolderName(sequence, originalTitle) {
  var seq = formatSequenceNumber(sequence);
  var title = normalizeWhitespace(originalTitle);
  title = removeTenderTitlePrefix(title);
  title = sanitizePathComponent(title);
  return seq + '_' + title;
}

/**
 * createBatchFolderPath — Build a relative batch folder path.
 * @param {*} paginationNumber
 * @param {Date} [date]
 * @returns {string}
 */
function createBatchFolderPath(paginationNumber, date) {
  var page = normalizePaginationNumber(paginationNumber);
  var timestamp = createLocalTimestamp(date);
  return 'Tender/' + timestamp + '_Page-' + page;
}

/**
 * escapeRegex — Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
