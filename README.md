<p align="center">
  <img src="src/lib/assets/favicon.svg" alt="Outlap logo" width="88" height="88">
</p>

# Outlap

Website: [outlap.lol](https://outlap.lol)

Upcoming motorsport sessions in your local time zone, with Apple Calendar
subscriptions that stay up to date. Built with SvelteKit 3 + TypeScript.

First-time visitors start with F1, IndyCar, MotoGP, WEC and WRC selected.
The series filters offer the full calendar, and selections are saved for future visits.

## Series and data sources

Schedules are scraped from the sources below every hour (no hardcoded dates;
see [Schedule snapshots](#schedule-snapshots)). If a source fails, its last good
data keeps being served and the page shows a warning.

| Series | Source |
| --- | --- |
| F1 | [Jolpica API](https://api.jolpi.ca) (Ergast successor); session times cross-checked against the sportstimes dataset |
| F2, F3 | [sportstimes/f1](https://github.com/sportstimes/f1) dataset (behind f1calendar.com) |
| MotoGP, Moto2, Moto3 | Official MotoGP API |
| Speedway GP | Official calendar data on fimspeedway.com |
| WEC, ELMS, Le Mans Cup | Official race pages on fiawec.com / europeanlemansseries.com / lemanscup.com |
| IMSA | Wikipedia season article (imsa.com blocks automated clients); all-day race days |
| IndyCar, Indy NXT | Official schedule pages on indycar.com / indynxt.com |
| Super Formula | Official race pages on superformula.net (Japanese); rounds without a published timetable are all-day events |
| WorldSBK | Official WorldSBK API |
| DTM | The api.dtm.com feed behind dtm.com; events without a published timetable are all-day events |
| Super GT | Official race pages on supergt.net (Japanese); rounds without a published timetable are all-day events |
| NASCAR Cup Series | The nascar.com schedule feed (cf.nascar.com) |
| WRC | Wikipedia season article (wrc.com blocks automated clients); all-day events |

Start times are as published. End times are estimates, except where the
source publishes them (MotoGP, DTM, and most non-race sessions for WorldSBK,
Super GT and Super Formula).

## Event visuals

Event cards include track outlines and venue photos where available.

Venue photos are Wikimedia Commons thumbnails kept in `static/photos/`, with
their credits in `src/lib/server/photos.json`. Speedway GP venues without a
freely licensed photo use FIMSpeedway.com press photos, which are free for
editorial use when credited to FIMSpeedway.com. A photo named in
`src/lib/server/venues.ts` needs an entry there to be shown.
SvelteKit's enhanced image plugin generates responsive formats at build time.
The event cards choose a size for the screen and defer photos below the viewport.
The source photo directory is linked under `src/lib/assets/` so Vite can process
it while `/photos/` URLs remain available to API clients.

## Apple Calendar

- **Subscribe**: `webcal://<host>/calendar.ics?...`. Calendar re-fetches it
  (hinted hourly), so time changes come through automatically.
- **Download .ics**: a one-off snapshot.
- **Per event**: "Add this event" on each card.

Feed parameters:

| Param | Values |
| --- | --- |
| `series` | comma list of `f1,f2,f3,indycar,indynxt,superformula,nascar,motogp,moto2,moto3,worldsbk,sgp,wec,elms,lemanscup,imsa,dtm,supergt,wrc` (default: all) |
| `sessions` | `all` (default), `main` (qualifying + sprints + races), `races` |
| `alarm` | minutes before start, e.g. `15` |
| `event` | a single event id |
| `download` | present → `Content-Disposition: attachment` |

Subscriptions need the server to be reachable by whatever fetches the feed. A
`localhost` URL works only in Calendar on the same Mac. iCloud and iPhone need
a public HTTPS deployment.

## Development

```bash
pnpm install
pnpm dev
pnpm check
```

## Schedule snapshots

1. `.github/workflows/snapshot.yml` runs hourly (and on pushes that touch the
   scrapers), runs `node scripts/snapshot.js`, and publishes `schedule.json`
   to the `data` branch. A source that fails keeps its events from the previous
   snapshot.

`pnpm dev` still scrapes the sources directly.

## Credits

Series logos, track outlines and venue photos are credited to their respective
creators and used under their applicable terms.
