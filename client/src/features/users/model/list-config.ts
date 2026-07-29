/**
 * Virtualization and paging constants for the user list.
 *
 * Collected here rather than inlined at the call site because they are coupled:
 * the page size has to be large enough that one fetch fills more than a screen
 * of virtualized rows, otherwise the list requests the next page immediately on
 * mount and infinite scroll degrades into a burst of round trips.
 */

/**
 * Rows per request. The API caps `limit` at 100; 50 comfortably overfills a
 * 1080p viewport at the row height below (~13 visible rows).
 */
export const USERS_PAGE_SIZE = 50;

/**
 * Hobbies shown on a card before the rest collapse into `+N`.
 */
export const MAX_VISIBLE_HOBBIES = 2;

/**
 * Estimated card height in pixels, including the gap below it.
 *
 * `@tanstack/react-virtual` only needs this to be close — it re-measures real
 * elements after mount. It matters for the initial scrollbar size, so a wildly
 * wrong value causes a visible jump on first paint.
 */
export const USER_CARD_ESTIMATED_HEIGHT = 112;

/**
 * Extra rows rendered above and below the viewport. Trades a little DOM for
 * blank-space-free fast scrolling; 5 is the usual sweet spot for cards this
 * size.
 */
export const VIRTUAL_OVERSCAN = 5;

/**
 * How close to the end of the list (in rows) the user must scroll before the
 * next page is requested. Large enough that the fetch usually completes before
 * they arrive, so the loading indicator rarely interrupts scrolling.
 */
export const INFINITE_SCROLL_THRESHOLD_ROWS = 10;

/**
 * Debounce for the search input.
 *
 * Search is server-side, so every keystroke would otherwise be a request. 300ms
 * is below the threshold where typing feels laggy and above the interval
 * between keystrokes for most typists.
 */
export const SEARCH_DEBOUNCE_MS = 300;
