<p align="center">
  <a href="https://outlap.lol">
    <img src="src/lib/assets/wordmark.svg" alt="Outlap" height="56">
  </a>
</p>

[Outlap](https://outlap.lol) shows upcoming motorsport sessions in your local
time zone, with series filters, country-specific viewing guides and Apple
Calendar subscriptions that stay up to date. Built with SvelteKit and TypeScript.

## Development

```bash
git submodule update --init --recursive
pnpm install
pnpm dev
```

```bash
pnpm check
pnpm build
```

## Schedule data

The [snapshot workflow](.github/workflows/snapshot.yml) fetches schedules hourly
and publishes `schedule.json` to the `data` branch for production. Failed sources
retain their last good data. Local development reuses the same GitHub snapshot,
fetching providers directly only for newly added series absent from that snapshot.
Series listed in the snapshot's source statuses count as present even when their
calendar is empty or their latest refresh failed. Dev rechecks the snapshot hourly;
if GitHub is unavailable, it keeps the in-memory schedule rather than scraping all
providers.

See [source adapters](src/lib/server/sources) for data providers. Session end
times are estimated when unpublished. Until a source publishes a season, its
announced calendar is read from the Wikipedia season article as all-day race
days, and replaced by the official timetable once it appears.

## Viewing guides

Expand a race to see where to watch it in your country: TV channels,
subscriptions and free streams. The country is detected from your connection
and can be changed in the panel. Availability and geoblocking depend on country,
series and round. Curated options include official guide links and checked dates;
uncertain coverage is labelled explicitly. See [viewing data and sources](docs/watching.md).

## Credits

Logos, track outlines and photos belong to their respective creators and are
used under their applicable terms. See [photo credits](src/lib/server/photos.json)
and [track credits](static/tracks/README.md).

## License

Source code is licensed under the [MIT License](LICENSE). Third-party assets
remain subject to their respective licenses and terms listed above.

## Shared calendar package

Common controls, date and ICS helpers, HTTP utilities, and schedule caching live
in [calendar-kit](https://github.com/szpolny/calendar-kit), included as a Git
submodule at `packages/calendar-kit`. Sport-specific behavior stays in this app.
The pnpm workspace dependency uses the exact commit pinned by this repo.

Clone with `--recurse-submodules`, or run `git submodule update --init --recursive`
after cloning or pulling. `pnpm install` and the app's development, check, test,
and build scripts build the package automatically. CI checks out submodules.
For external build services, initialize submodules before installing dependencies.

For shared changes, follow `packages/calendar-kit/README.md`: publish the package
commit to its Git remote first, then update and review the submodule pin here.
No npm publication is needed. Keep the first-paint theme script in `src/app.html`
and the shared theme toggle's configuration in agreement.
