# Where to watch

Viewing information is curated in `src/lib/watch.ts` and resolved per event and
ISO country code. `WatchPanel.svelte` renders it in each expanded weekend, with
separate sections for support series. The country defaults to Cloudflare's
`cf-ipcountry` request header, the same geolocation broadcasters use for
geoblocking; a country picked in the panel is saved in the existing
`outlap:prefs` preference. It is independent of the time zone; we do not infer
broadcast eligibility from language or a shared time zone. Viewers can change it
in a searchable country dialog with flags from the `flag-icons` package.

Provider logos live in `src/lib/assets/providers` and are mapped by option name
in `src/lib/providers.ts`. Most were taken from each broadcaster's Wikipedia
infobox or Wikimedia Commons on 12 October 2026; the Eleven Sports, F1 TV,
FIAWEC+, SFgo and YouTube marks were supplied separately and trimmed to 96 px
WebP. Logos are shown in colour on a white tile in both themes, except
white-on-transparent marks (FIAWEC+, SFgo), which get a dark tile. Other
series-run services (INDYCAR LIVE, MotoGP VideoPass and so on) use the series
wordmark. REV TV has no logo on Wikimedia and falls back to a monogram. A test
fails if a new provider is added without a logo.

The initial guide covers 2026 and was checked on 12 October 2026. It is not a
live rights feed. Events outside 2026 link to the official guide without carrying
2026 rights forward. A provider marked “Check availability” is a lead to its
subscription/stream page, not a confirmed entitlement. Missing local coverage
falls back to the official guide. Free accounts are distinguished from free
streams, paid subscriptions and TV packages. Prices are intentionally omitted
because they vary by territory, package and offer.

## Sources

- [F1 broadcasters](https://www.formula1.com/en/information/f1-broadcast-information.45y3LNsT1D6VoK0ZmX8ciJ),
  [F2 broadcasters](https://www.fiaformula2.com/en/information/where-to-watch-us-f2.5KKoOKrH2MbJlUgtRMYDQy)
  and [F3 broadcasters](https://www.fiaformula3.com/en/information/where-to-watch-us-f3.49NWzWEKNAOq0g5MI9qbgi).
  Local entries for the support series are independently listed in their guides;
  their exact channel/package still needs checking. F1 TV Pro/Premium is conditional;
  Access is not a live race subscription. US coverage uses Apple TV. Channel 4 is
  labelled as highlights except for the British GP.
- [IMSA international coverage](https://www.imsa.com/internationalcoverage/) and
  [domestic coverage](https://www.imsa.com/domesticcoverage/). YouTube and IMSA.TV
  race feeds are for territories without local broadcast coverage. The Viaplay
  heading includes Poland and the Baltics, while its paragraph only names Nordic
  countries: those subscriptions are explicitly conditional. Chile's local deal
  is for the Rolex 24; other rounds remain conditional. US and its territories
  do not receive the international race stream. Practice or development-series
  streams can have different restrictions.
- [INDYCAR international broadcasters](https://www.indycar.com/how-to-follow/international),
  [2026 broadcaster announcement](https://www.indycar.com/news/2026/02/02-19-international-tv)
  and [2026 session access table](https://www.indycar.com/-/media/Files/2026/News/OTT_TERRITORIES_2026.pdf).
  INDYCAR LIVE race delays are separate from practice/qualifying and INDY NXT
  permissions; US is replay-only and Canada cannot stream INDYCAR races live.
  Only selected confirmed countries are labelled as available, with other
  territories directed to check entitlement.
- [NASCAR international broadcasters](https://www.nascar.com/international/how-to-watch)
  and [2026 US race channel schedule](https://www.nascar.com/wp-content/uploads/sites/7/2025/11/13/2026-NationalSeriesSchedules-Times.pdf).
  US Cup coverage uses the actual race session's date in America/New_York,
  not a practice date or the viewer's local date. An unrecognised/postponed date
  falls back to the guide. Listed channels cover the race, not every session.
- [MotoGP broadcasters](https://www.motogp.com/en/broadcasters) and
  [VideoPass](https://www.motogp.com/en/videopass). The same official VideoPass
  covers MotoGP, Moto2 and Moto3; local supporting-class listings need checking.
  US coverage is FOX Sports (FS1/FS2, COTA on FOX), per the
  [2026 renewal](https://awfulannouncing.com/fox/motogp-media-rights-deal-2026.html).
  The broadcaster page also lists Sportsnet (CA), 10 (AU) and DF1 (DE); they are
  not listed yet because they have no logo asset.
- [WorldSBK 2026 coverage](https://prod.worldsbk.com/en/news/2026/02/19/donde-ver-worldsbk-durante-toda-la-temporada-2026x/989565)
  and [VideoPass](https://www.worldsbk.com/en/videopass). ServusTV is conditional
  because German viewers need MagentaTV. ITV4 (GB) and SBS (AU) are highlights only.
- [Speedway 2026 coverage](https://fimspeedway.com/news/fim-speedway-where-to-watch-2026).
  FIM-MOTO.TV is conditional in markets without WBD coverage.
- [FIAWEC+ announcement](https://www.fiawec.com/en/news/fiawec-now-available-via-app-store-and-google-play/13256),
  [ELMS](https://plus.fiawec.com/en/european-le-mans-series) and
  [Le Mans Cup](https://plus.fiawec.com/en/michelin-le-mans-cup).
  WEC is paid with no 2026 race geoblocking; ELMS and Le Mans Cup are free with an account.
  US: [TNT Sports' 2026 deal](https://press.wbd.com/us/media-release/tnt-sports-acquires-multi-year-us-broadcast-rights-fia-world-endurance-championship)
  streams all races on HBO Max, with three on truTV.
- [Asian Le Mans Series season announcement](https://www.24h-lemans.com/en/news/asian-le-mans-series-sepang-set-to-kick-off-the-2025-2026-season-60167).
  The official YouTube channel is a conditional stream link, not a claim that a
  particular upcoming livestream has been published or is available everywhere.
- [Super Formula 2026 broadcast channels](https://superformula.net/sf3/race_/19958/).
  SFgo is global and paid; ABEMA is free but Japan-only.
- [DTM viewing guide](https://www.dtm.com/en/where-to-watch) and
  [2026 season announcement](https://www.dtm.com/fahrer.php/news/Top-drivers-premium-manufacturers-first-class-events-the-2026-DTM-season).
  YouTube is conditional because territory restrictions can vary by round.
- [Super GT media information](https://supergt.net/about-super-gt/media).
  J SPORTS is listed only for Japan. RACER+ is the 2026 US and Canada home for
  all rounds, per [RACER's season coverage](https://racer.com/2026/04/10/untitled).
  The guide is the fallback elsewhere; do not
  restore older Motorsport.tv entries without confirming a current agreement.
- [WRC broadcast guide](https://www.wrc.com/en/misc/broadcast-guide). The page
  is undated, so its local broadcasters (RACER+, REV TV, Sky, CANAL+, Stan) are
  conditional until it confirms 2026. Rally.TV is global.

## Maintenance

Recheck the official guide before changing a territory or provider. Update the
checked date alongside those changes. Add year/event exceptions when a deal or
channel applies only to a season or particular round. Never assume one series'
rights include its support series, or treat highlights/replays as full live race
coverage. Keep unconfirmed country entitlements conditional. When extending to
another season, review every affected source and update the season gate.

Run `pnpm test`, `pnpm check` and `pnpm build`. Watch tests cover IMSA geoblocking,
INDYCAR race delays versus INDY NXT, NASCAR race dates/channels, unknown countries,
future seasons and free-account versus subscription access.
