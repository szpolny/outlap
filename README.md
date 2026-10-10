# Outlap

Upcoming motorsport sessions in your local time zone, with Apple Calendar
subscriptions that stay up to date. Built with SvelteKit 3 + TypeScript.

## Series and data sources

Schedules are fetched live (no hardcoded dates), cached in memory for an hour,
and re-validated in the background. If a source fails, the last good data keeps
being served and the page shows a warning.

| Series | Source |
| --- | --- |
| F1 | [Jolpica API](https://api.jolpi.ca) (Ergast successor); session times cross-checked against the sportstimes dataset |
| F2, F3 | [sportstimes/f1](https://github.com/sportstimes/f1) dataset (behind f1calendar.com) |
| MotoGP, Moto2, Moto3 | Official MotoGP API |
| WEC, ELMS | Official race pages on fiawec.com / europeanlemansseries.com |
| IndyCar, Indy NXT | Official schedule pages on indycar.com / indynxt.com |
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
| `series` | comma list of `f1,f2,f3,indycar,indynxt,motogp,moto2,moto3,wec,elms,wrc` (default: all) |
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
