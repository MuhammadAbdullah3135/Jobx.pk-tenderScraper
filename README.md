# Jobz.pk Tender Batch Downloader

A Chromium extension for organizing downloads of tender text and advertisement images from the currently opened Jobz.pk tender page.

## Current Status — Phase 8 (Complete)

Phase 8 hardens the complete download pipeline for production. It removes the temporary development Parse First Tender button and all associated dead code, eliminates the `verifyTenderId` stub and duplicate `resetBatch` function, improves error handling in the auto-resume path, adds comprehensive integration tests covering the full Listing → Parse → Batch → TXT → Images → Completion workflow, and updates all documentation.

Phase 7B downloads tender advertisement images into each tender's folder using `chrome.downloads` APIs with retry and completion tracking via `onChanged`. Phase 6B–6E implement the sequential batch processing loop with checkpoint recovery, retry with exponential backoff, duplicate prevention via `processedTenderIds`, and a `completionSummary` with image counts. Phase 5D hardened the Phase 5 pipeline. Phase 5C provided the merge helper. Phase 5B provided the tender-detail HTML parser. Phase 5A provided the fetch and offscreen lifecycle. Phase 4A–4C provided pure naming, path, URL, and normalization utilities with comprehensive test hardening.

### What has been delivered

1. **Phase 1**: Popup shell with status, pagination, and progress UI placeholders.
2. **Phase 2**: Tender listing URL validation, pagination detection (DOM element, heading/title, pathname), service-worker content-script injection, response normalization.
3. **Phase 3A**: Live DOM reconnaissance, section-discovery strategy, container identification, row-level interpretation prototype.
4. **Phase 3B**: Full current-page extraction of every valid tender row, canonical-URL deduplication, listing-position assignment, extraction response sent to popup.
5. **Phase 3C**: Popup button enablement based on extracted tenders, truthful click message, zero-tender/fatal-warning/unsupported/stale state handling, response normalization in popup, defensive DOM access, fresh inspection on every popup open.
6. **Phase 4A**: Pure naming, path, URL, pagination, timestamp, and normalization utilities in separate modules with 100 automated tests.
7. **Phase 4B**: Normalized tender-record factory (`createNormalizedTenderRecord`), batch normalization helper (`createNormalizedTenderRecords`), service-worker integration using the factory, and 60 automated tests for the tender model.
8. **Phase 4C**: Comprehensive test hardening with 212 additional test cases covering every Phase 4 function's edge cases, error paths, security invariants, and integration scenarios. All 372 tests pass with zero failures. No new runtime code added.
9. **Phase 5A**: Single tender-detail fetching, offscreen-document lifecycle (on-demand `DOM_PARSER` creation with reuse), service-worker-to-offscreener messaging with targeting, DOMParser-based HTML parsing, error handling for invalid URLs, fetch timeouts, HTTP errors, unexpected redirects, access restrictions, content-type rejection, and empty HTML. 56 pure-function tests for the new helper logic.
10. **Phase 5B**: Tender-detail HTML parser module with METADATA_LABEL_ALIASES configuration, label normalization and matching, multi-strategy metadata extraction (table, definition list, div containers), page title extraction, description extraction (selector-based and section-based), tender image URL extraction with host/path/filename filtering, ID mismatch detection, warning deduplication, and Unicode-safe description truncation. 76 pure-helper tests in Node.js. Fixture HTML files for browser-based DOMParser testing.
11. **Phase 5C**: Pure merge helper (`mergeTenderListingAndDetail`) in `tender-model.js`. Error-code mapping table (`getErrorMessage`) in `constants.js`. 56+ merge and popup-logic tests covering valid merge, immutability, field preservation, status reset, array isolation, partial metadata, error mapping.
12. **Phase 5D**: Comprehensive integration hardening with pure-logic tests covering fetch URL validation, HTTP status handling, redirect validation, access-restriction detection, offscreen message validation, HTML non-exposure in errors, merge behavior, pipeline simulation (listing → normalize → parse → merge), forbidden-functionality review, and offscreen lifecycle logic verification.
13. **Phase 6A**: Batch state persistence module (`batch-state.js`) with CRUD operations, validation, recovery from corrupt data, `processedTenderIds` duplicate tracking. 89 automated tests.
14. **Phase 6B**: Sequential batch processing loop (`batch-processor.js`) with one-at-a-time execution, state persistence after each tender, failure isolation (failed tenders don't block remaining), and concurrent processing prevention. 21 automated tests.
15. **Phase 6C**: Popup progress UI showing progress bar, processed/success/failed/skipped/remaining counters, current tender name, batch completion summary with timing, and storage-based state restoration on popup reopen.
16. **Phase 6D**: Retry logic with exponential backoff and jitter, checkpoint recovery (resume after interruption), download-only recovery for already-parsed tenders, retry configuration persistence. 28 automated tests.
17. **Phase 6E**: Duplicate prevention via persistent `processedTenderIds`, `completionSummary` with image aggregate counts, batch reset clearing all state and processed IDs. 15 automated tests.
18. **Phase 7B**: Advertisement image download for each parsed tender — `_downloadImageFiles` orchestrates sequential per-tender image downloads, `_initiateImageDownload` wraps `chrome.downloads.download`, `_waitForDownloadComplete` listens on `chrome.downloads.onChanged`, retry with exponential backoff per image, image aggregate counts in `completionSummary`, batch continues on individual image failure. 26 automated tests.
19. **Phase 8**: Production hardening — removed temporary development Parse First Tender button from popup and all associated code, removed `verifyTenderId()` stub and duplicate `resetBatch()` function, improved error logging in auto-resume path, deleted stale `test-output.txt`, updated README with full Phase 6–8 documentation, comprehensive integration tests covering Listing → Parse → Batch → TXT → Images → Completion, concurrency safety, checkpoint recovery, duplicate prevention, and edge cases.

## Supported Browsers

Chromium-based browsers (Chrome, Edge, Brave, Opera, etc.).

## Minimum Chromium Version

109

## Supported Website

```
https://www.jobz.pk/
```

Host permission is restricted to `www.jobz.pk`. The subdomain `www` is required.

## Supported Listing URL Pattern

```
https://www.jobz.pk/tenders-N/
```

where `N` is the page number (one or more digits).

## Live DOM Reconnaissance

The page was inspected live on 28 July 2026 at `https://www.jobz.pk/tenders-1/`.

### Observed Heading

```
Latest Tenders in Pakistan (Government & Private)
```

The heading is a visible element on the page. The document title also includes `Page N`.

### Section Structure

The main tender-listing section is a `<table>`-based layout near the heading. The table has three columns:

| Tender Title (linked) | Tender City | Date Posted |
|---|---|---|

Each row after the header row represents one tender.

### Row-Level Details

- **Tender title**: Anchor (`<a>`) text containing the tender description, with `href` ending in `_tenders-NNNNN.html`
- **City**: Text in the second column (e.g. LAHORE, KARACHI, ISLAMABAD)
- **Date**: Text in the third column (e.g. "22 Jul 2026")
- ~30 tenders per page

## Section-Discovery Strategy

1. **Heading match**: Scan `h1`, `h2`, `h3`, `h4`, `legend`, `caption` for visible elements whose normalized text contains both "tenders" and "pakistan" (case-insensitive).
2. **Sibling container search**: From the matching heading, search the parent for a likely container (table, `div.tender-listing`, `div.table-responsive`).
3. **Fallback global scan**: If no heading match, scan the page for visible tables/containers with 3+ rows containing `_tenders-` links.
4. **No match**: Return `null`.

## Repeated-Container Strategy

Within the discovered section, find rows using selectors in priority order:
1. `table > tbody > tr`
2. `table tr`
3. Other generic container selectors

Exclude header rows by checking for "Title", "City", "Date", "Location", or "Posted" text.

## Field Association

All fields (title, city, date) are extracted from the same repeated container (`<tr>`) using scoped `querySelectorAll`. No cross-row lookup is performed.

- **Title**: First `<a>` with `href` containing `_tenders-` within the row
- **City**: First matching city selector within the same row, excluding values matching the title
- **Date**: First matching date selector within the same row, excluding values matching city or title

## Extracted Tender Fields

Each retained tender record contains:

| Field | Type | Description |
|---|---|---|
| `listingPosition` | number | 1-based position after deduplication |
| `originalListingTitle` | string | Normalized anchor text |
| `city` | string | City name or `"Not available"` |
| `datePosted` | string | Posting date or `"Not available"` |
| `detailUrl` | string | Canonical HTTPS `www.jobz.pk` tender-detail URL |

## Text Normalization

The `normalizeText()` helper:
- Accepts unknown input safely, converting non-strings to `''`
- Replaces non-breaking spaces (`\u00A0`) with regular spaces
- Replaces tabs, newlines, and carriage returns with one space
- Collapses multiple spaces into one
- Trims leading and trailing whitespace

## Tender-Detail URL Validation

The `normalizeTenderUrl()` helper:
- Rejects empty, hash-only, `javascript:`, `mailto:`, and `tel:` URLs
- Resolves relative URLs against the current page URL
- Accepts only `http:` and `https:` protocols
- Accepts only `www.jobz.pk` or `jobz.pk` hostnames
- Normalizes hostname to `www.jobz.pk`
- Normalizes protocol to `https:`
- Removes URL fragments and query parameters
- Requires pathname ending in `_tenders-(\d+)\.html$`
- Returns `{ valid, url, id, reason }`

## Deduplication

Duplicate canonical URLs are removed in memory. Only the first retained occurrence is kept. If the first occurrence is hidden and a later visible occurrence exists, the visible occurrence replaces the hidden one. This handles responsive-design duplicate rows.

## Popup Behavior (Phase 3C)

### Supported page with valid tenders

```
Current Page: Supported
Pagination number: Page N
Tenders Detected: 30
```

The **Download Current Page Tenders** button is enabled.

### Supported page with zero tenders

```
Current Page: Supported
Pagination number: Page N
Tenders Detected: 0
No tenders found on the current page.
```

The button remains disabled.

### Supported page, section not found

```
Current Page: Supported
Pagination number: Not available
Tenders Detected: 0
The tender listing section could not be found. The webpage structure may have changed.
```

The button remains disabled.

### Supported page, no valid records found

```
Current Page: Supported
Pagination number: Page N
Tenders Detected: 0
The tender section was found, but no valid tender listings were detected.
```

The button remains disabled.

### Inspection failure on supported URL

```
Current Page: Supported
Pagination number: Not available
Tenders Detected: Not available
The page could not be inspected. Reload the page and try again.
```

The button remains disabled.

### Stale page

```
Current Page: Supported
The page changed while it was being inspected. Open the popup again.
```

The button remains disabled. Previous tender count is discarded.

### Unsupported page

```
Current Page: Unsupported
Tenders Detected: 0
Please open a Jobz.pk tender listing page.
```

The button remains disabled.

### Inaccessible page (chrome://, etc.)

```
Current Page: Cannot inspect
Tenders Detected: 0
The current browser tab cannot be inspected.
```

The button remains disabled.

### Truthful Phase 3 click message

When the enabled button is clicked:

```
Tender extraction is working. Batch downloading will be implemented in a later phase.
```

No download begins. No progress counters update. No files are created.

## Button Enablement Rules

The **Download Current Page Tenders** button is enabled only when ALL of the following are true:

1. The current page is supported (jobz.pk tender listing).
2. The inspection completed successfully.
3. The returned `tenders` value is a valid array.
4. The normalized tender count is greater than zero.
5. No fatal inspection error exists (no `reason`, no fatal warnings).
6. The inspected page has not changed (not stale).
7. No batch operation is running (always `false` in Phase 3).

The button is reset to disabled before every fresh popup inspection.

## Fatal vs Nonfatal Warnings

Fatal warnings (button remains disabled):
- Section not found
- No valid tender listings detected

Nonfatal warnings (button may be enabled when valid tenders remain):
- Optional city missing for a record
- Optional date missing for a record
- Fallback selector used
- Duplicate responsive markup removed

Nonfatal warnings are displayed in the message area but do not prevent enablement.

## Message Flow (Phase 3C)

```
Popup → Service Worker → Content Script (INSPECT_LISTING_PAGE)
→ Pagination detection + Full tender extraction
→ Normalized response (pagination + tenders) → Service Worker normalizes → Popup normalizes
→ Renders status, pagination, tender count → Enables or disables button
```

The content script runs both `inspectListingPage()` and `extractAllTenders()` on each inspection. The service worker normalizes the tender array (strips invalid records, reassigns positions). The popup re-normalizes before display.

## Response Normalization

All four stages (content script → service worker → popup → display) defensively validate:

```js
{
  supported,        // boolean
  pageNumber,       // positive integer or null
  pageUrl,          // string or null
  tenders,          // array (invalid records stripped)
  tenderCount,      // always derived from validated array length
  warnings,         // array of readable strings
  reason            // readable string or null
}
```

Invalid tender records (missing `detailUrl` or `originalListingTitle`) are stripped at every normalization step. `undefined`, `NaN`, Error objects, and stack traces are never displayed.

## Phase 4A — Pure Naming, Path, URL, and Normalization Utilities

Phase 4A splits pure utility functions into three shared modules. All functions are pure — they accept inputs, return new values, never mutate inputs, and never use browser APIs.

### Module organization

```
src/shared/utilities.js   — Whitespace, pagination, sequence, timestamp
src/shared/naming.js      — Title prefix, safe fallback, sanitize, path traversal, folder names
src/shared/urls.js        — URL canonicalization, tender ID extraction, tender-detail validation
```

### `utilities.js` (Phase 4A additions)

| Function | Purpose |
|---|---|
| `normalizeWhitespace(value)` | Normalize whitespace; null/undefined → `''` |
| `normalizePaginationNumber(value)` | Safe positive integer; truncates decimals; fallback 1 |
| `formatSequenceNumber(value)` | Minimum 3 digits (`1` → `"001"`); invalid → `"001"` |
| `createLocalTimestamp(date?)` | `YYYY-MM-DD_HH-mm-ss` using local browser time |

### `naming.js` — Title cleanup and safe naming

| Function | Purpose |
|---|---|
| `removeTenderTitlePrefix(title)` | Remove leading "Tender for the" (case-insensitive, flexible whitespace) |
| `createSafeFallbackTitle(value)` | Normalize whitespace or return `"Unknown Tender"` |
| `sanitizePathComponent(value, options?)` | Windows-safe path component; replaces `< > : " / \\ | ? *` with `-` |
| `preventPathTraversal(value)` | Remove `..`, drive letters, network paths from components |
| `createTenderFolderName(sequence, originalTitle)` | `SEQUENCE_CLEANED_TITLE` |
| `createBatchFolderPath(paginationNumber, date?)` | `Tender/YYYY-MM-DD_HH-mm-ss_Page-N` |

### `urls.js` — URL utilities

| Function | Purpose |
|---|---|
| `canonicalizeJobzUrl(value, baseUrl?)` | Canonicalize to `https://www.jobz.pk/...` |
| `extractTenderId(url)` | Extract numeric ID from `_tenders-(\d+)\.html$` |
| `validateTenderDetailUrl(value)` | `{ valid, canonicalUrl, tenderId }` |

### Title prefix behavior

- Removes `Tender for the` only at the beginning of the normalized title
- Case-insensitive matching
- Flexible whitespace between words
- Middle occurrences are preserved
- Remaining content is re-normalized
- Returns `Unknown Tender` when nothing remains

Examples:
```
"Tender for the Supply of School Books"       → "Supply of School Books"
"TENDER FOR THE Construction of Boundary Wall" → "Construction of Boundary Wall"
" Tender   for   the   Medical Equipment "      → "Medical Equipment"
"New Tender for the Supply of Books"            → "New Tender for the Supply of Books" (unchanged)
```

### Windows-safe naming

- Replaces `< > : " / \\ | ? *` with `-`
- Removes ASCII control characters
- Collapses repeated separators
- Removes leading/trailing whitespace, separators, and periods
- Handles empty, dot-only, and invalid-character-only inputs → `Unknown Tender`
- Length limit: 100 Unicode-safe characters (surrogate pairs preserved)
- Reserved Windows device names are prefixed with `_`

Reserved names handled: `CON`, `PRN`, `AUX`, `NUL`, `CLOCK$`, `COM1`–`COM9`, `LPT1`–`LPT9`, and these with extensions (`CON.txt`, `LPT1.csv`).

Examples:
```
"Supply: Books / Stationery?"              → "Supply- Books - Stationery"
"   Report...   "                          → "Report"
"***"                                      → "Unknown Tender"
".."                                       → "Unknown Tender"
"CON"                                      → "_CON"
"con.txt"                                  → "_con.txt"
```

### Tender ID extraction

Extracts the numeric ID from `_tenders-(\d+)\.html$` in the pathname. Returns the ID as a string. Returns `null` for listing pages, home page, category URLs, and unrelated hosts.

```
https://www.jobz.pk/tender-for-supply_tenders-66063.html  → "66063"
https://www.jobz.pk/tenders-1/                              → null
```

### URL canonicalization

- Accepts relative or absolute URLs
- Default base: `https://www.jobz.pk/`
- Normalizes `jobz.pk` → `www.jobz.pk`, HTTP → HTTPS
- Removes fragments (preserves query for general canonicalization; query is stripped in strict validation)
- Rejects `javascript:`, `mailto:`, `tel:`, `data:`, `file:`, `chrome:`, `edge:`, `about:` protocols
- Returns `null` for unrelated hostnames and unparseable input

### Tender-detail URL validation

Return type:

```js
{ valid: boolean, canonicalUrl: string|null, tenderId: string|null }
```

Must canonicalize successfully to `www.jobz.pk` HTTPS and match `_tenders-(\d+)\.html$`. Strips query parameters and fragments from the returned canonical URL.

### Batch folder path

```
createBatchFolderPath(3, new Date(2026, 6, 28, 11, 42, 30))
→ "Tender/2026-07-28_11-42-30_Page-3"
```

Always begins with `Tender/`. Uses `normalizePaginationNumber` and `createLocalTimestamp`. Remains relative — no leading `/`, no backslashes, no `..`.

### Tender folder name

```
createTenderFolderName(1, "Tender for the Supply of School Books")
→ "001_Supply of School Books"

createTenderFolderName(3, "***")
→ "003_Unknown Tender"
```

Process: normalize → prefix removal → sanitize → sequence prefix → join. The complete folder name is safe even when the cleaned title is a Windows reserved name (because the `NNN_` prefix ensures it's not the bare reserved name). Maximum folder name length: 4 (prefix + underscore) + 100 (sanitized title) = 104 Unicode code points.

No files are created or downloaded by any Phase 4A utility.

## Phase 4B — Normalized Tender Record Factory

Phase 4B adds a pure normalized tender-record factory (`createNormalizedTenderRecord`) that converts a Phase 3 listing record into a predictable normalized tender object. The factory uses Phase 4A utilities for all standardization steps.

### Module

```
src/shared/tender-model.js
```

### Functions

| Function | Purpose |
|---|---|
| `createNormalizedTenderRecord(listingRecord, paginationNumber)` | Normalize one raw listing record into a predictable tender object |
| `createNormalizedTenderRecords(records, paginationNumber)` | Batch version; filters records with invalid detail URLs, preserves order |

### Required normalized fields

| Field | Type | Description |
|---|---|---|
| `listingPosition` | number | Normalized position; falls back to 1 |
| `sequenceNumber` | number | Always equals `listingPosition` in Phase 4 |
| `tenderId` | string or null | Extracted from canonical detail URL; `null` if URL is invalid |
| `originalListingTitle` | string | Whitespace-normalized original title; `"Unknown Tender"` fallback |
| `title` | string | Display title with `"Tender for the"` prefix removed; `"Unknown Tender"` fallback |
| `city` | string | Normalized city; `"Not available"` fallback |
| `listingDatePosted` | string | Date from the listing row; `"Not available"` fallback |
| `datePosted` | string | Reserved for detail-page date; always `"Not available"` at creation |
| `category` | string | Reserved; `"Not available"` |
| `province` | string | Reserved; `"Not available"` |
| `location` | string | Reserved; `"Not available"` |
| `subcategory` | string | Reserved; `"Not available"` |
| `sector` | string | Reserved; `"Not available"` |
| `newspaper` | string | Reserved; `"Not available"` |
| `lastDate` | string | Reserved; `"Not available"` |
| `description` | string | Reserved; `"Not available"` |
| `detailUrl` | string or null | Canonicalized and validated; `null` for invalid URLs |
| `imageUrls` | array | New empty array |
| `paginationNumber` | number | Normalized via Phase 4A utility |
| `folderName` | string | Derived from sequence number and cleaned title (e.g. `"001_Supply of Items by EED"`) |
| `downloadStatus` | string | `"Pending"` |
| `failureReason` | string or null | `null` |
| `fetchAttempts` | number | `0` |
| `downloadedAt` | string or null | `null` |
| `downloadIds` | array | New empty array |
| `downloadedFiles` | array | New empty array |

### `listingDatePosted` versus `datePosted`

- `listingDatePosted` stores the date displayed in the listing row (e.g. `"22 Jul 2026"`). It is set from the Phase 3 record's `datePosted` field.
- `datePosted` is reserved for the detail-page field of the same name. It always initializes to `"Not available"`. The two fields are never confused or copied.

### Folder-name derivation

```
createTenderFolderName(sequenceNumber, originalListingTitle)
→ normalizeWhitespace → removeTenderTitlePrefix → sanitizePathComponent
→ "001_Supply of Items by EED"
```

Folder names are safe even when the detail URL is invalid.

### Tender ID derivation

The tender ID is extracted from the canonicalized detail URL using `validateTenderDetailUrl`. It is never extracted from the title, city, or other fields. Returns `null` when the URL is not a valid tender-detail URL.

### Invalid detail-URL handling

- The factory returns `detailUrl: null` and `tenderId: null` for invalid URLs.
- The service worker excludes records with `detailUrl: null` from the active tender collection sent to the popup.
- A diagnostic summary (`console.log`) reports invalid-URL counts when diagnostics are enabled.
- The popup count always reflects only records with valid detail URLs.
- The factory still produces a complete normalized object with a valid `folderName`, even when the URL is invalid.

### Phase 3 integration

1. Content script extracts raw Phase 3 records (unchanged from Phase 3).
2. Service worker receives raw records and iterates each record through `createNormalizedTenderRecord`.
3. Records with `detailUrl: null` are excluded from the response.
4. The popup receives normalized records and renders the count (unchanged Phase 3 popup behavior).
5. No detail page is fetched. No file or folder is created.

### Popup behavior

The popup continues to display only:

```
Current Page: Supported
Detected Pagination: Page N
Tenders Detected: COUNT
```

No record preview table is added. The button enablement rules and truthful Phase 3 click message are unchanged.

### Service-worker imports

The service worker now imports all Phase 4A modules and Phase 4B tender-model.js via `importScripts`:

```js
self.importScripts(
  chrome.runtime.getURL('src/shared/constants.js'),
  chrome.runtime.getURL('src/shared/utilities.js'),
  chrome.runtime.getURL('src/shared/naming.js'),
  chrome.runtime.getURL('src/shared/urls.js'),
  chrome.runtime.getURL('src/shared/tender-model.js')
);
```

### Node.js tests

```sh
npm test
```

Runs 372 tests: 100 Phase 4A pure utility tests + 60 Phase 4B tender-model tests + 212 Phase 4C comprehensive test-hardening tests. Uses Node.js built-in `node:test` and `node:assert/strict`.

### Confirmed exclusions

- No detail page is fetched.
- No file or folder is created.
- No storage is used.
- No batch-folder creation on disk.
- No download execution.
- No image extraction or downloading.
- No TXT, CSV, or JSON files.
- No reports.
- No persistent duplicate history.
- No retries.
- No offscreen-document creation at Phase 4B (Phase 5A adds this later).
- No progress updates.
- No automatic pagination.
- No context menus.
- No injected webpage buttons.
- Phase 5 is not implemented.

## Phase 4C — Comprehensive Test Hardening

Phase 4C adds 212 test cases across 24 test suites that exhaustively cover every Phase 4 function. No runtime code is added or modified.

### Test coverage by area

| Area | Tests | Key coverage |
|---|---|---|
| `normalizeWhitespace` | 10 | Multiple spaces, tabs, newlines, CR, non-breaking, null, undefined, primitives |
| `removeTenderTitlePrefix` | 10 | Case-insensitive, flexible whitespace, middle preservation, prefix-only, null |
| `sanitizePathComponent` | 40 | Every invalid character, control chars, null chars, trailing periods, separator collapse, empty/dot inputs, all 17 reserved names (bare and with extension), truncation with clean ending, surrogate pairs, Unicode |
| `preventPathTraversal` | 13 | Parent traversal, drive letters, network paths, mixed paths, batch path invariants |
| `formatSequenceNumber` | 13 | All valid forms, zero, negative, decimal (Math.floor), NaN, Infinity, invalid string, numeric string |
| `createLocalTimestamp` | 9 | Padded format, no colons, no timezone, invalid Date |
| `normalizePaginationNumber` | 10 | All valid/invalid inputs, Infinity, NaN |
| `createBatchFolderPath` | 10 | Exact path, invalid page, timestamp content, Page-N, no leading/trailing slash, no backslash, no traversal |
| `createTenderFolderName` | 10 | Prefix removal, padding, invalid title, empty title, prefix-only, long title, `..` safety, reserved names |
| `extractTenderId` | 12 | All URL variants, listing, home, jobs, unrelated, JavaScript, malformed, missing ID, arbitrary number |
| `canonicalizeJobzUrl` | 12 | Relative, host normalization, HTTP→HTTPS, fragment removal, port removal, path preservation, query preservation, unrelated host, unsupported protocol, malformed, empty |
| `validateTenderDetailUrl` | 16 | Valid/invalid URLs, query/fragment non-interference, canonical URL properties, tender ID |
| Normalized records | 39 | All 18 fields, immutability, missing fields, date separation, URL canonicalization, ID extraction, invalid URL handling, pagination, folder name, download state, null/undefined/empty input, array isolation |
| Batch normalization | 8 | Order preservation, invalid URL filtering, input immutability, empty/nonarray input, duplicate reference safety |

### Security invariants verified

- Path-traversal prevention: `../`, `..\\`, absolute paths, drive letters, network paths are all neutralized
- `..` sequences are removed from path components
- No generated path contains backslashes, leading slashes, trailing slashes, or path-traversal segments
- Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `CLOCK$`, `COM1`–`COM9`, `LPT1`–`LPT9`) are prefixed with `_`
- Malformed and unsupported URLs return `null` rather than throwing
- Array fields are freshly created per-record — no shared mutable state between records

### No Phase 5B+ code in Phase 4C

All test files are verified to contain no `chrome.downloads.download`, `XMLHttpRequest`, `fetch()`, `chrome.storage`, or `chrome.offscreen` calls.

## Phase 5A — Single Tender-Detail Fetching and Offscreen Parse Acknowledgement

Phase 5A proves the pipeline: validated tender URL → service-worker fetch → offscreen-document creation or reuse → HTML sent through runtime messaging → DOMParser parses HTML → minimal structured acknowledgement returned.

No visible detail tab is opened. No content script is injected. No metadata is extracted. No file is created or downloaded.

### Architecture

```
FETCH_AND_PARSE_TENDER_DETAIL message
→ Service worker validates URL (Phase 4 validateTenderDetailUrl)
→ Service worker fetches HTML (single GET, 20-second timeout)
→ Service worker validates redirect, content-type, access restrictions
→ Service worker ensures offscreen document (reuses if exists, creates if not)
→ Service worker sends PARSE_TENDER_HTML message with target: "offscreen"
→ Offscreen document checks target, validates payload, parses with DOMParser
→ Offscreen returns minimal acknowledgement { success, sourceUrl, expectedTenderId, documentCreated, hasDocumentElement, parsedTitle }
```

### Message types

| Constant | Direction | Purpose |
|---|---|---|
| `FETCH_AND_PARSE_TENDER_DETAIL` | Popup → Service worker | Request single-detail fetch and parse |
| `PARSE_TENDER_HTML` | Service worker → Offscreen | Send HTML for DOMParser acknowledgement |

### URL validation (before fetch)

Uses `validateTenderDetailUrl` from Phase 4A. The URL must:
- Canonicalize successfully to `https://www.jobz.pk/`
- Match `_tenders-(\d+)\.html$`
- Produce a valid tender ID
- Not be a listing URL, home page, or using an unsupported protocol

Invalid URLs are rejected before any network request with `INVALID_TENDER_URL`.

### Fetch implementation

```js
fetch(url, {
  method: 'GET',
  redirect: 'follow',
  headers: { 'Accept': 'text/html,application/xhtml+xml' },
  credentials: 'same-origin',
  signal: controller.signal   // AbortController with 20-second timeout
})
```

- 20-second timeout via `AbortController`
- No automatic retry
- `credentials: "same-origin"` (no manual cookie handling)

### Fetch error handling

| Error Code | When |
|---|---|
| `NETWORK_ERROR` | DNS failure, offline, connection refused |
| `FETCH_TIMEOUT` | Request exceeds 20-second timeout |
| `HTTP_ERROR` | Non-2xx response (except 401, 403, 429) |
| `ACCESS_RESTRICTED` | HTTP 401, 403, or 429 |
| `EMPTY_HTML` | Response body is empty or whitespace-only |
| `UNEXPECTED_CONTENT_TYPE` | Content-Type is not `text/html` or `application/xhtml+xml` |
| `UNEXPECTED_REDIRECT` | Final URL is not on `www.jobz.pk` or tender ID changed |
| `UNKNOWN_ERROR` | Unclassified failure |

### Final redirected URL validation

After fetching:
1. `response.url` is canonicalized via `canonicalizeJobzUrl`
2. Validated via `validateTenderDetailUrl` (must be a valid Jobz.pk tender-detail URL)
3. Tender ID from final URL must match the expected ID from the original request

Redirects to external hosts, home page, login page, listing pages, and unrelated paths are all rejected with `UNEXPECTED_REDIRECT`.

### Content-type checking

Only `text/html` and `application/xhtml+xml` are accepted. Missing content-type is tolerated if the body is non-empty and `DIAGNOSTIC_MODE` records the fallback. JSON, images, PDFs, binary, and plain access-denial output are rejected with `UNEXPECTED_CONTENT_TYPE`.

### Access-restriction detection

Before parsing, the first 2000 characters of the HTML are scanned for:
- `captcha`, `verify you are human`, `access denied`, `forbidden`
- `login required`, `sign in to continue`, `unusual traffic`, `rate limit`

Detection is case-insensitive. Normal tender HTML without these terms passes through. No access restriction is bypassed.

### Offscreen-document lifecycle

- Created only when a valid detail fetch needs parsing (not during popup open, listing inspection, pagination detection, or Phase 3 extraction)
- Uses `DOM_PARSER` reason with justification: "Parse fetched tender-detail HTML using DOMParser."
- `ensureOffscreenDocument()` checks for existing offscreen document via `chrome.runtime.getContexts()` (with `clients.matchAll()` fallback for Chrome 109–115)
- Module-level `offscreenCreationPromise` prevents duplicate creation calls
- Promise is cleared in `finally`-equivalent (both resolve and reject clear it)
- Handles service-worker restart (module-level variables reset)
- Handles creation failure (including "already exists" error)
- Recreates the document if the receiving end disappears during messaging (one retry, no HTML re-fetch)

### Offscreen message targeting

Messages include a `target: "offscreen"` field. The offscreen listener ignores messages with another target, unrelated type, or missing required payload. The service worker's own message handler also checks message types to avoid confusion.

### Minimal parse acknowledgement

The offscreen document returns:

```js
{
  success: true,
  sourceUrl: "https://www.jobz.pk/example_tenders-66063.html",
  expectedTenderId: "66063",
  documentCreated: true,
  hasDocumentElement: true,
  parsedTitle: "Document title when available"
}
```

This is an infrastructure acknowledgement only. No metadata, images, description, or files are extracted.

### Offscreen document setup

```html
<!-- src/offscreen/offscreen.html (Phase 5B update) -->
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Offscreen Document</title></head>
<body>
<script src="tender-detail-parser.js"></script>
<script src="offscreen.js"></script>
</body>
</html>
```

The offscreen document:
- Contains no visible UI
- Loads only local JavaScript (parser first, then message handler)
- Contains no inline script
- Performs no network requests
- Uses `chrome.runtime.onMessage` only
- Phase 5B: returns full structured parse result instead of minimal acknowledgement

### Parser-error handling

| Error Code | When |
|---|---|
| `INVALID_MESSAGE` | Payload is missing required fields or has wrong types |
| `HTML_PARSE_FAILED` | DOMParser exception or empty HTML |
| `NO_TENDER_CONTENT` | Parsed document has no `documentElement` |

### Phase 5A pure-function tests (56 tests)

| Suite | Tests | What it covers |
|---|---|---|
| `isApplicableContentType` | 10 | Valid HTML types, rejection of JSON/image/PDF/binary/null/empty |
| `isEmptyHtml` | 6 | Empty/whitespace detection, null/undefined/number rejection |
| `detectAccessRestriction` | 12 | All 8 restriction patterns, normal HTML not flagged, case insensitivity, null/empty input |
| `validateRedirect` | 7 | Matching/mismatching IDs, listing URL, home page, unrelated host, non-string inputs |
| `normalizeFetchError` | 7 | 401, 403, 404, 429, 500, 502, fallback 200 → correct error code |
| `validateOffscreenMessage` | 10 | Valid shape, null, non-object, wrong target, wrong type, missing fields, wrong types |
| `fetchFailureResponse` | 4 | Response shape, null/undefined details, omitted args |

Service-worker runtime code (`fetch()`, `chrome.runtime.sendMessage`, `chrome.offscreen.createDocument`) is not tested in Node.js tests. DOMParser integration requires a browser environment.

### Confirmed exclusions

Phase 5A does not implement:
- Complete metadata parsing (title, city, date, category, etc.)
- Description extraction
- Image extraction
- Record merging
- Parse First Tender popup button
- Full batch loop
- Retries of network fetch
- TXT generation
- Image downloading
- CSV, JSON, or report file generation
- Storage
- Persistent duplicate history
- Blob creation or object URLs
- Download calls
- Progress processing
- Phase 6 functionality

## Phase 5B — Tender Detail HTML Metadata Parsing

Phase 5B replaces the minimal offscreen parse acknowledgement with a full structured parser that extracts metadata fields, page title, description, and tender advertisement images from fetched tender-detail HTML. The parser uses DOMParser (available in the offscreen document) and pure helper functions (testable in Node.js).

### Architecture

```
FETCH_AND_PARSE_TENDER_DETAIL message
→ Service worker validates URL, fetches HTML, validates redirect/access/content-type
→ Service worker ensures offscreen document and sends PARSE_TENDER_HTML
→ Offscreen document validates payload, calls parseTenderDetail()
→ Parser parses HTML with DOMParser, strips unwanted elements (script, style, nav, etc.)
→ Finds main content area via prioritized selectors or fallback
→ Extracts metadata from tables, definition lists, and div containers (table > dl > div merge)
→ Extracts page title (h1 > doc.title > originalListingTitle)
→ Extracts description (verified selector > heading-adjacent > conservative fallback)
→ Extracts tender images (validates URL, checks host/path/filename, deduplicates, sorts preferred)
→ Returns structured result { success, metadata, description, pageTitle, tenderId, imageUrls, warnings }
```

### Module

```
src/offscreen/tender-detail-parser.js  — Parser module (loaded by offscreen.html)
src/offscreen/offscreen.html            — Updated to load tender-detail-parser.js
src/offscreen/offscreen.js              — Updated to call parser instead of minimal acknowledgement
```

### Parser entry point

```js
function parseTenderDetail(html, sourceUrl, expectedTenderId, originalListingTitle)
```

Returns:

```js
{
  success: true,
  metadata: {
    datePosted: "25 Jul 2026",
    category: "Goods",
    province: "Punjab",
    location: "Lahore",
    subcategory: "Medical Equipment",
    sector: "Health",
    newspaper: "Daily Jang",
    lastDate: "15 Aug 2026"
  },
  description: "The Education Department Punjab invites sealed bids...",
  pageTitle: "Supply of Medical Equipment to DHQ Hospital",
  tenderId: "66063",
  imageUrls: [
    "https://www.jobz.pk/images/tenders/ad-66063-page-001.jpg",
    "https://www.jobz.pk/images/tenders/ad-66063-page-002.jpg"
  ],
  warnings: []
}
```

### METADATA_LABEL_ALIASES

A centralized configuration object mapping each metadata field to an array of possible label aliases:

| Key | Aliases |
|---|---|
| `datePosted` | date posted, posted date, posted on, date published, publish date, published date, date, publish on, created date |
| `category` | category, tender category, category type, category/type |
| `province` | province, province / area, province/area, region, province area |
| `location` | location, tender location, place, area, city |
| `subcategory` | subcategory, sub category, sub-category, type |
| `sector` | sector, industry, sector type, sector/industry |
| `newspaper` | newspaper, news paper, daily, publication, published in |
| `lastDate` | last date, closing date, deadline, due date, submission date, last date of submission, bid submission date, last date to submit, closing, late date |

Labels are normalized (lowercase, trimmed, colons/asterisks/parentheticals removed) before matching. First-match wins per field.

### Extraction strategies (in priority order)

1. **Table rows** (`<tr><th>Label</th><td>Value</td></tr>` or `<tr><td>Label:</td><td>Value</td></tr>`)
2. **Definition lists** (`<dl><dt>Label</dt><dd>Value</dd></dl>`)
3. **Div containers** (divs with label/value class patterns, adjacent span+strong pairs)

Later strategies fill gaps without overwriting earlier matches.

### Image extraction rules

- Accepts `.jpg`, `.jpeg`, `.png`, `.webp` extensions
- Rejects: data:/blob:/javascript: URIs, external hosts, images smaller than 40×40 pixels (when dimensions available)
- Rejects filenames containing: logo, favicon, banner, advertisement, tracking pixel, captcha patterns
- Prefers `/images/tenders/` path and filenames containing `expectedTenderId`
- Deduplicates by canonical URL
- Sorts preferred images first, then others

### Description extraction

1. Verified selector match (`.tender-description`, `#description`, `.description-content`, etc.)
2. Section headed by "Description", "Tender Details", or "Details" (collects adjacent sibling content)
3. Conservative fallback (empty string if no description section found)
- Unicode-safe truncation at 50,000 characters with word-boundary preservation
- Appends "The description was truncated." warning when truncated
- Missing description returned as `"Not available"`

### Default values

| Field | Missing value |
|---|---|
| Human-readable metadata fields | `"Not available"` |
| Description | `"Not available"` |
| Page title | `"Unknown Tender"` |
| Tender ID | Retains `expectedTenderId` from source URL |
| Image URLs | `[]` |
| Warnings | `[]` |

### Pure helper functions (tested in Node.js)

| Function | Purpose |
|---|---|
| `normalizeLabel(label)` | Normalize label text for matching (lowercase, trim, remove colon/asterisk/parenthetical) |
| `matchLabel(label, aliases)` | Match a label against an alias list (exact, contains, bidirectional) |
| `addWarning(warnings, warning)` | Add deduplicated warning to array |
| `isValidImageUrl(url)` | Validate image URL (protocol, extension, unwanted filename patterns) |
| `isImageAllowedHost(url)` | Check if URL host is www.jobz.pk or jobz.pk |
| `canonicalizeImageUrl(url, sourceUrl)` | Resolve relative URLs, upgrade HTTP to HTTPS, remove fragments |
| `truncateDescription(text, maxLength)` | Unicode-safe truncation with word-boundary preservation |
| `normalizeCellText(value)` | Normalize table/div cell text (whitespace, colon removal) |

### DOM-dependent functions (browser/DOMParser required)

| Function | Purpose |
|---|---|
| `stripUnwantedElements(doc)` | Remove script, style, nav, footer, ads, social sharing from parsed document |
| `findMainContent(doc)` | Find main tender content container (prioritized selectors, fallback to body) |
| `extractTableMetadata(doc, mainContent)` | Extract label-value pairs from tables |
| `extractDlMetadata(doc, mainContent)` | Extract label-value pairs from definition lists |
| `extractDivMetadata(doc, mainContent)` | Extract label-value pairs from div containers |
| `extractAllMetadata(doc, mainContent)` | Merge results from all extraction strategies |
| `extractPageTitle(doc, mainContent, originalListingTitle)` | Extract tender page title |
| `extractDescription(doc)` | Extract tender description |
| `extractTenderImages(doc, mainContent, expectedTenderId, sourceUrl)` | Extract and filter tender advertisement images |
| `parseTenderDetail(html, sourceUrl, expectedTenderId, originalListingTitle)` | Main entry point |

### Test fixtures

Fixture HTML files in `tests/fixtures/` provide representative tender-detail page structures for browser-based DOMParser testing:

| Fixture | Purpose |
|---|---|
| `table-headers.html` | Standard table with `<th>` headers (all 8 metadata fields) |
| `definition-list.html` | `<dl>` definition list with aliased labels |
| `nested-div.html` | Div containers with span+strong label/value patterns |
| `missing-fields.html` | Empty and missing metadata cells |
| `noise.html` | Nav, sidebar, social sharing, related tenders, footer (should be stripped) |
| `no-valid-images.html` | Logo, spinner, social icons, banner (all should be rejected) |
| `conflicting-metadata.html` | Multiple values for the same field (first-match behavior) |
| `description-target.html` | Dedicated "Tender Description" section with multi-paragraph content |
| `images.html` | Mixed preferred, relative, lazy-loaded, and noise images |

### Offscreen response update

The offscreen document now returns a full structured parse result instead of the Phase 5A minimal acknowledgement:

**Phase 5A (replaced):**
```js
{ success, sourceUrl, expectedTenderId, documentCreated, hasDocumentElement, parsedTitle }
```

**Phase 5B:**
```js
{
  success: true,
  metadata: { datePosted, category, province, location, subcategory, sector, newspaper, lastDate },
  description: "Tender description text...",
  pageTitle: "Tender Page Title",
  tenderId: "66063",
  imageUrls: ["https://www.jobz.pk/images/tenders/ad-66063.jpg"],
  warnings: []
}
```

### Error codes

| Code | When |
|---|---|
| `INVALID_HTML` | HTML input is not a string |
| `HTML_PARSE_FAILED` | DOMParser exception |
| `NO_TENDER_CONTENT` | Parsed document has no `documentElement` |

### Confirmed exclusions

Phase 5B does not implement:
- Popup "Parse First Tender" button
- Image downloading
- TXT, CSV, JSON, or report file generation
- Record merging with normalized tender records
- Storage or duplicate history
- Blob creation or object URLs
- Download calls
- Progress processing
- Automatic batch loop
- Retries of network fetch or parse
- Phase 6 functionality

## Diagnostic Mode

A `DIAGNOSTIC_MODE` boolean constant controls development logging. It defaults to `false` and when enabled logs:
- Which section selector succeeded
- How many repeated-container candidates were found
- Why a sample URL was rejected
- Whether fallback selectors were used
- Candidate count, retained count, duplicate count, invalid-link count

## Controlled Diagnostics

No full-page HTML is logged. No sensitive browser information is exposed. Large extraction arrays are not logged by default. Diagnostics are for development use only.

## How to Load the Extension

1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `jobz-tender-downloader` directory.
5. The extension icon appears in the toolbar.

## How to Run Validation Tests

### Browser tests (Phases 1–3)

Open `tests/validation-tests.html` in any browser to run focused tests on URL validation, number parsing, pathname detection, response normalization, text normalization, tender-detail URL validation, tender response normalization, canonical-URL deduplication, and button enablement decisions (100+ tests). These tests do not require Chrome extension APIs.

### Node.js tests (Phases 4–8)

Each test file must be run individually due to shared global `chrome` mock state:

```sh
npx mocha tests/phase4a.test.cjs
npx mocha tests/phase4b.test.cjs
npx mocha tests/phase4c.test.cjs
npx mocha tests/phase5a.test.cjs
npx mocha tests/phase5b.test.cjs
npx mocha tests/phase5c.test.cjs
npx mocha tests/phase5d.test.cjs
npx mocha tests/phase6a.test.cjs
npx mocha tests/phase6b.test.cjs
npx mocha tests/phase6c.test.cjs
npx mocha tests/phase6d.test.cjs
npx mocha tests/phase6e.test.cjs
npx mocha tests/phase7b.test.cjs
npx mocha tests/phase8.test.cjs
```

Runs 1000+ tests across all test files:

| File | Tests | Scope |
|---|---|---|
| `tests/phase4a.test.cjs` | 100 | Phase 4A pure utility units |
| `tests/phase4b.test.cjs` | 60 | Phase 4B tender-model factory + batch |
| `tests/phase4c.test.cjs` | 212 | Phase 4C comprehensive test hardening |
| `tests/phase5a.test.cjs` | 80+ | Phase 5A fetch, redirect, content-type, offscreen message pure logic |
| `tests/phase5b.test.cjs` | 76 | Phase 5B tender-detail parser pure helpers |
| `tests/phase5c.test.cjs` | 80+ | Phase 5C merge helper and error mapping |
| `tests/phase5d.test.cjs` | 90+ | Phase 5D integration hardening, pipeline simulation |
| `tests/phase6a.test.cjs` | 89 | Phase 6A batch state CRUD, validation, recovery |
| `tests/phase6b.test.cjs` | 21 | Phase 6B batch processing loop |
| `tests/phase6c.test.cjs` | — | Phase 6C popup progress UI (mock DOM) |
| `tests/phase6d.test.cjs` | 28 | Phase 6D retry logic, checkpoint recovery |
| `tests/phase6e.test.cjs` | 15 | Phase 6E duplicate prevention, completion summary |
| `tests/phase7b.test.cjs` | 26 | Phase 7B image download helpers and integration |
| `tests/phase8.test.cjs` | 14 | Phase 8 full pipeline integration, concurrency, edge cases |

All tests use Node.js built-in `node:test` and `node:assert/strict`. No third-party test frameworks or extension runtime dependencies.

## Manual Test Steps

### Page inspection

1. Open `https://www.jobz.pk/tenders-1/` → Supported, Page 1, tender count displayed, button enabled.
2. Open `https://www.jobz.pk/tenders-15/` → Supported, Page 15, tender count displayed, button enabled.
3. Open `https://www.jobz.pk/example_tenders-66063.html` → Unsupported, count shows 0, button disabled.
4. Open `https://www.jobz.pk/` → Unsupported, count shows 0, button disabled.
5. Open `https://www.google.com/` → Unsupported, count shows 0, button disabled.
6. Open `chrome://extensions/` → Cannot inspect, count shows 0, button disabled.
7. Navigate to a different tab while the popup is still inspecting → Stale message, button disabled.
8. Reopen the popup repeatedly → Fresh inspection each time, no stale state retained.

### Batch download

1. Open `https://www.jobz.pk/tenders-1/` → verify page is Supported with tender count.
2. Click **Download Current Page Tenders** → batch starts, progress bar and counters update.
3. Each tender is fetched, parsed, a TXT file is saved in `Downloads/Tender/...`, and advertisement images are saved alongside.
4. On completion, a summary shows total/success/failed/skipped counts and image counts.
5. Click **Start New Batch** → state is cleared, ready for a new batch.

### Service worker restart

1. Start a batch download on a page with multiple tenders.
2. While the batch is running, go to `chrome://extensions` and click the refresh icon on the extension card.
3. Open the popup again → the batch auto-resumes from the last checkpointed tender (no data loss).

### Validation tests

1. Open `tests/validation-tests.html` in any browser.
2. Verify all tests pass (52+ tests across URL validation, normalization, deduplication, and button enablement).

## Current Limitations

- DOM pagination detection relies on common pagination CSS classes and ARIA attributes; unusual markup may not be detected.
- Section discovery relies on heading text containing both "tenders" and "pakistan"; non-standard headings may not be matched.
- Tender-detail URL validation requires the pathname to end with `_tenders-NNNNN.html`; unusual URL patterns may be rejected.
- Extraction is scoped to the first discovered tender section; unusual page layouts may not be fully parsed.
- Detail pages are fetched individually via the service worker's fetch pipeline.
- All image downloads in a batch are processed sequentially (one image at a time per tender). This is intentional to avoid overwhelming the download system but may be slower for tenders with many images.
- Image downloads that fail after exhausting retries are recorded with a failure reason but the batch continues. Interrupted image downloads are not retried on resume.
- No pagination is opened automatically — only the currently opened tender listing page is processed.
- Batch processing only works on the currently opened tab. The service worker must be active.
- The `processedTenderIds` duplicate history is stored locally in `chrome.storage.local` and persists across browser sessions.
- Test files cannot be run in parallel due to shared global `chrome` mock state; each file must be run individually.
