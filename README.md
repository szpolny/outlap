<p align="center">
  <img src="src/lib/assets/favicon.svg" alt="Outlap logo" width="88" height="88">
</p>

# Outlap

Website: [outlap.lol](https://outlap.lol)

Upcoming motorsport sessions in your local time zone, with Apple Calendar
subscriptions that stay up to date. Built with SvelteKit 3 + TypeScript.

## Series and data sources

Schedules are scraped from the sources below every hour (no hardcoded dates).
If a source fails, its last good data keeps being served and the page shows a
warning.

| Series | Source |
| --- | --- |
| F1 | [Jolpica API](https://api.jolpi.ca) (Ergast successor); session times cross-checked against the sportstimes dataset |
| F2, F3 | [sportstimes/f1](https://github.com/sportstimes/f1) dataset (behind f1calendar.com) |
| MotoGP, Moto2, Moto3 | Official MotoGP API |
| Speedway GP | Official calendar data on fimspeedway.com |
| WEC, ELMS, Le Mans Cup | Official race pages on fiawec.com / europeanlemansseries.com / lemanscup.com |
| IMSA | Wikipedia season article (imsa.com blocks automated clients); all-day race days |
| IndyCar, Indy NXT | Official schedule pages on indycar.com / indynxt.com |
| NASCAR Cup Series | The nascar.com schedule feed (cf.nascar.com) |
| WRC | Wikipedia season article (wrc.com blocks automated clients); all-day events |

Start times are as published. End times are estimates, except for MotoGP,
which publishes them.

## Apple Calendar

- **Subscribe**: `webcal://<host>/calendar.ics?...`. Calendar re-fetches it
  (hinted hourly), so time changes come through automatically.
- **Download .ics**: a one-off snapshot.
- **Per event**: "Add this event" on each card.

Feed parameters:

| Param | Values |
| --- | --- |
| `series` | comma list of `f1,f2,f3,indycar,indynxt,nascar,motogp,moto2,moto3,sgp,wec,elms,lemanscup,imsa,wrc` (default: all) |
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

GitHub Actions refreshes the schedule hourly and when scraper files change.
The workflow runs `node scripts/snapshot.js` and publishes `schedule.json` to
the `data` branch. If a source fails, its events from the previous snapshot
are kept.
