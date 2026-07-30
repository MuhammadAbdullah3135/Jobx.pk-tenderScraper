const CHECK_CURRENT_PAGE = 'CHECK_CURRENT_PAGE';
const INSPECT_LISTING_PAGE = 'INSPECT_LISTING_PAGE';
const FETCH_AND_PARSE_TENDER_DETAIL = 'FETCH_AND_PARSE_TENDER_DETAIL';
const PARSE_TENDER_HTML = 'PARSE_TENDER_HTML';
const FETCH_TENDER_HTML = 'FETCH_TENDER_HTML';
const PROCESS_BATCH = 'PROCESS_BATCH';
const RESET_BATCH = 'RESET_BATCH';

const DOWNLOAD_STATUS_PENDING = 'Pending';
const DOWNLOAD_STATUS_PARSED = 'Parsed - Download Pending';
const DOWNLOAD_STATUS_PARSE_FAILED = 'Parse Failed';
const DOWNLOAD_STATUS_PENDING_RETRY = 'Pending Retry';
const DOWNLOAD_STATUS_DOWNLOADED = 'Downloaded';
const DOWNLOAD_STATUS_DOWNLOAD_FAILED = 'Download Failed';

var IMAGE_DOWNLOAD_STATUS_PENDING = 'Pending';
var IMAGE_DOWNLOAD_STATUS_DOWNLOADING = 'Downloading';
var IMAGE_DOWNLOAD_STATUS_SUCCEEDED = 'Succeeded';
var IMAGE_DOWNLOAD_STATUS_FAILED = 'Failed';

var ERROR_MESSAGES = {
  INVALID_TENDER_URL: 'The selected tender URL is invalid.',
  FETCH_TIMEOUT: 'The request timed out. Please try again.',
  HTTP_ERROR: 'The server returned an error response.',
  ACCESS_RESTRICTED: 'The tender page could not be accessed normally.',
  UNEXPECTED_REDIRECT: 'The tender URL redirected to an unexpected page.',
  NETWORK_ERROR: 'Could not connect to the server. Please check your internet connection.',
  EMPTY_HTML: 'The response contained no content.',
  UNEXPECTED_CONTENT_TYPE: 'The response was not HTML.',
  HTML_PARSE_FAILED: 'Failed to parse the tender HTML.',
  NO_TENDER_CONTENT: 'The parsed tender page has no recognizable content.',
  INVALID_HTML: 'The HTML input was invalid.',
  UNKNOWN_ERROR: 'An unexpected error occurred.'
};

function getErrorMessage(code) {
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
}
