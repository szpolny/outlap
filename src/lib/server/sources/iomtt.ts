import type { MotorEvent } from '#lib/series.ts';
import { decodeEntities, fetchText } from '../util';
import type { Source } from './types';
import { MONTHS } from './wikipedia';

// The official schedule page covers the next TT: a fortnight of qualifying and race days on
// the Mountain Course, with races but no start times. It becomes one all-day event.
const PAGE = 'https://www.iomttraces.com/racing/page/schedule/';

export const iomtt: Source = {
	label: 'iomttraces.com',
	series: ['iomtt'],
	async load(years) {
		const html = await fetchText(PAGE);
		const year = Number(html.match(/schedule for the (\d{4}) Isle of Man TT/i)?.[1]);
		if (!year) throw new Error('no TT schedule on page');
		if (!years.includes(year)) return [];
		// Day headings: "MONDAY 31 MAY (UK Bank Holiday)".
		const days = [...decodeEntities(html.replace(/<[^>]*>/g, ' ')).matchAll(
			/\b(?:MON|TUES|WEDNES|THURS|FRI|SATUR|SUN)DAY\s+(\d{1,2})\s+([A-Z]+)/g
		)]
			.map(([, day, month]) => {
				const m = MONTHS.indexOf(month.toLowerCase()) + 1;
				return m === 0 ? null : `${year}-${String(m).padStart(2, '0')}-${day.padStart(2, '0')}`;
			})
			.filter((d): d is string => d !== null)
			.sort();
		if (days.length === 0) throw new Error('no days in TT schedule');
		const event: MotorEvent = {
			id: `iomtt-${year}`,
			series: 'iomtt',
			name: `Isle of Man TT ${year}`,
			location: 'Snaefell Mountain Course, Isle of Man',
			start: days[0],
			end: days.at(-1)!,
			allDay: true,
			sessions: [],
			url: PAGE
		};
		return [event];
	}
};
