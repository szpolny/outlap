// Shared by Super GT and Super Formula, whose official sites are in Japanese and race at the
// same circuits. Timetables are published in local time.

export const JAPAN_TZ = 'Asia/Tokyo';

interface Circuit {
	name: string;
	/** town and prefecture */
	place: string;
}

const CIRCUITS: [RegExp, Circuit][] = [
	[/fuji|富士/i, { name: 'Fuji Speedway', place: 'Oyama, Shizuoka' }],
	[/suzuka|鈴鹿/i, { name: 'Suzuka Circuit', place: 'Suzuka, Mie' }],
	[/motegi|もてぎ/i, { name: 'Mobility Resort Motegi', place: 'Motegi, Tochigi' }],
	[/okayama|岡山/i, { name: 'Okayama International Circuit', place: 'Mimasaka, Okayama' }],
	[/sugo/i, { name: 'Sportsland SUGO', place: 'Murata, Miyagi' }],
	[/autopolis|オートポリス/i, { name: 'Autopolis', place: 'Hita, Oita' }]
];

/** The circuit named in `text`, in English. */
export function findCircuit(text: string): Circuit | undefined {
	return CIRCUITS.find(([match]) => match.test(text))?.[1];
}

/** 2026, 4, 3 -> "2026-04-03" */
export function isoDay(year: number, month: number, day: number): string {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
