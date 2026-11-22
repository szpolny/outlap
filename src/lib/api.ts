// Public API constants shared by the server and the docs page.

/** Events per page of /api/v1/events */
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 500;

/** The launch notice on the calendar, shown for a month until dismissed. Bump `id` to announce again. */
export const API_NOTICE = { id: 'api-v1', until: '2026-12-22T00:00:00Z' };
