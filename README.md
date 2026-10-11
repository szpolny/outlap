<p align="center">
  <a href="https://outlap.lol">
    <img src="src/lib/assets/wordmark.svg" alt="Outlap" height="56">
  </a>
</p>

[Outlap](https://outlap.lol) shows upcoming motorsport sessions in your local
time zone, with series filters and Apple Calendar subscriptions that stay up
to date. Built with SvelteKit and TypeScript.

## Development

```bash
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
retain their last good data. Local development fetches sources directly.

See [source adapters](src/lib/server/sources) for data providers. Session end
times are estimated when unpublished.

## Credits

Logos, track outlines and photos belong to their respective creators and are
used under their applicable terms. See [photo credits](src/lib/server/photos.json)
and [track credits](static/tracks/README.md).
