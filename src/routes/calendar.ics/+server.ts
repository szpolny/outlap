import { error } from '@sveltejs/kit';
import { SERIES, SERIES_IDS, isSeriesId } from '#lib/series.ts';
import { FILTER_KINDS, type SessionFilter } from '#lib/format.ts';
import { buildIcs } from '#lib/server/ics.ts';
import { getSchedule } from '#lib/server/schedule.ts';
import type { RequestHandler } from './$types';

// GET /calendar.ics?series=f1,motogp&sessions=main&alarm=15[&event=<id>][&download=1]
export const GET: RequestHandler = async ({ url }) => {
	const seriesParam = url.searchParams.get('series');
	const series = seriesParam ? seriesParam.split(',').filter(Boolean) : SERIES_IDS;
	if (series.length === 0 || !series.every(isSeriesId)) error(400, 'Unknown series');

	const sessions = (url.searchParams.get('sessions') ?? 'all') as SessionFilter;
	if (!(sessions in FILTER_KINDS)) error(400, 'sessions must be all, main or races');

	const alarm = Number(url.searchParams.get('alarm') ?? 0) || undefined;
	const eventId = url.searchParams.get('event');

	const { events } = await getSchedule();
	const selected = events.filter((e) =>
		eventId ? e.id === eventId : (series as string[]).includes(e.series)
	);
	if (eventId && selected.length === 0) error(404, 'Event not found');

	const name = eventId
		? selected[0].name
		: series.length === SERIES_IDS.length
			? 'Outlap'
			: `Outlap · ${series.map((s) => SERIES[s as keyof typeof SERIES].short).join(' + ')}`;

	const body = buildIcs(selected, { name, sessions: eventId ? 'all' : sessions, alarm });
	const filename = `${eventId ?? 'outlap'}.ics`;
	return new Response(body, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': `${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="${filename}"`,
			'cache-control': 'public, max-age=900'
		}
	});
};
