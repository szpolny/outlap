import { FILTER_KINDS } from '#lib/format.ts';
import { DEFAULT_LIMIT, MAX_LIMIT } from '#lib/api.ts';
import { SERIES_IDS } from '#lib/series.ts';

// OpenAPI description of /api/v1, served at /api/v1/openapi.json. Keep it in step with
// src/lib/server/api.ts and the docs page at src/routes/api/+page.svelte.

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const error = (description: string) => ({ description, content: { 'application/json': { schema: ref('Error') } } });
const ok = (schema: object) => ({ description: 'OK', content: { 'application/json': { schema } } });

const SESSION_KINDS = FILTER_KINDS.all;
const sessionsParam = {
	name: 'sessions',
	in: 'query',
	description: 'Which sessions to include: all, main (qualifying, sprints and races) or races (sprints and races). Timed events left with no sessions are dropped.',
	schema: { type: 'string', enum: Object.keys(FILTER_KINDS), default: 'all' }
};

export function openapi(origin: string) {
	return {
		openapi: '3.1.0',
		info: {
			title: 'Outlap API',
			version: '1.0.0',
			description: 'Read-only motorsport schedules in UTC. Free, no key required. See the guide at /api.',
			license: { name: 'MIT', identifier: 'MIT' }
		},
		externalDocs: { url: `${origin}/api` },
		servers: [{ url: `${origin}/api/v1` }],
		paths: {
			'/events': {
				get: {
					operationId: 'listEvents',
					summary: 'List events',
					description: 'Events overlapping the requested window, ordered by start and paginated. Without from and to, every event in the current and next season.',
					parameters: [
						{
							name: 'series',
							in: 'query',
							description: 'Comma-separated series ids. Defaults to every series.',
							schema: { type: 'string' },
							example: 'f1,motogp'
						},
						{
							name: 'from',
							in: 'query',
							description: 'Only events ending after this instant. A date means 00:00 UTC that day.',
							schema: { type: 'string' },
							example: '2026-03-01'
						},
						{
							name: 'to',
							in: 'query',
							description: 'Only events starting before this instant. A date includes that whole UTC day.',
							schema: { type: 'string' },
							example: '2026-03-31T23:59:59Z'
						},
						sessionsParam,
						{
							name: 'limit',
							in: 'query',
							description: 'Events per page.',
							schema: { type: 'integer', minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT }
						},
						{
							name: 'cursor',
							in: 'query',
							description: 'nextCursor from the previous page. Keep the other parameters the same.',
							schema: { type: 'string' }
						}
					],
					responses: {
						200: ok({
							type: 'object',
							required: ['generatedAt', 'events', 'nextCursor'],
							properties: {
								generatedAt: { type: 'string', format: 'date-time' },
								events: { type: 'array', items: ref('Event') },
								nextCursor: { type: ['string', 'null'], description: 'Cursor for the next page; null on the last page.' }
							}
						}),
						400: error('Invalid parameter')
					}
				}
			},
			'/events/{id}': {
				get: {
					operationId: 'getEvent',
					summary: 'Get an event',
					parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: 'f1-2026-1' }],
					responses: {
						200: ok({
							type: 'object',
							required: ['generatedAt', 'event'],
							properties: { generatedAt: { type: 'string', format: 'date-time' }, event: ref('Event') }
						}),
						404: error('No event has this id')
					}
				}
			},
			'/series': {
				get: {
					operationId: 'listSeries',
					summary: 'List series',
					responses: {
						200: ok({ type: 'object', required: ['series'], properties: { series: { type: 'array', items: ref('Series') } } })
					}
				}
			},
			'/status': {
				get: {
					operationId: 'getStatus',
					summary: 'Snapshot freshness',
					description: 'When the schedule was built and whether each data source refreshed. A failed source keeps serving its last good data.',
					responses: {
						200: ok({
							type: 'object',
							required: ['generatedAt', 'sources'],
							properties: { generatedAt: { type: 'string', format: 'date-time' }, sources: { type: 'array', items: ref('Source') } }
						})
					}
				}
			}
		},
		components: {
			schemas: {
				SeriesId: { type: 'string', enum: SERIES_IDS },
				Event: {
					type: 'object',
					required: ['id', 'series', 'name', 'start', 'end', 'allDay', 'calendarUrl', 'sessions'],
					properties: {
						id: { type: 'string', description: 'Stable across refreshes.', example: 'f1-2026-1' },
						series: ref('SeriesId'),
						name: { type: 'string', example: 'Australian Grand Prix' },
						round: { type: 'integer' },
						location: { type: 'string' },
						start: { type: 'string', description: 'ISO 8601 UTC date-time, or YYYY-MM-DD when allDay.' },
						end: { type: 'string', description: 'ISO 8601 UTC date-time, or an inclusive YYYY-MM-DD when allDay.' },
						allDay: { type: 'boolean', description: 'True until the organiser publishes a timetable. All-day events have no sessions.' },
						url: { type: 'string', format: 'uri', description: 'Event page on the series site or Wikipedia.' },
						calendarUrl: { type: 'string', format: 'uri', description: 'iCalendar feed of this event.' },
						sessions: { type: 'array', items: ref('Session') }
					}
				},
				Session: {
					type: 'object',
					required: ['name', 'kind', 'start', 'end', 'estimatedEnd'],
					properties: {
						name: { type: 'string', example: 'Qualifying' },
						kind: { type: 'string', enum: SESSION_KINDS },
						start: { type: 'string', format: 'date-time' },
						end: { type: 'string', format: 'date-time' },
						estimatedEnd: { type: 'boolean', description: 'True when the organiser publishes only the start time.' }
					}
				},
				Series: {
					type: 'object',
					required: ['id', 'name', 'short', 'color', 'group'],
					properties: {
						id: ref('SeriesId'),
						name: { type: 'string', example: 'Formula 1' },
						short: { type: 'string', example: 'F1' },
						color: { type: 'string', example: '#e10600' },
						group: { type: 'string', example: 'Single-seater' }
					}
				},
				Source: {
					type: 'object',
					required: ['source', 'series', 'ok'],
					properties: {
						source: { type: 'string' },
						series: { type: 'array', items: ref('SeriesId') },
						ok: { type: 'boolean' },
						fetchedAt: { type: 'string', format: 'date-time', description: 'When the data now served was fetched.' }
					}
				},
				Error: {
					type: 'object',
					required: ['error'],
					properties: {
						error: {
							type: 'object',
							required: ['status', 'message'],
							properties: { status: { type: 'integer' }, message: { type: 'string' } }
						}
					}
				}
			}
		}
	};
}
