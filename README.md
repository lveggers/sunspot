# SunSpot

SunSpot helps you find possible direct sunlight at parks, bars and
restaurants in Copenhagen, choose a time and invite friends.

## Run locally

Use Node 24 (`nvm use`; `.nvmrc` is included), or Node 22.13+ /
24.x / 26+ per `package.json`'s `engines`:

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No API keys are required.
Invitations and the MET Norway weather cache are stored in `.data/`,
excluded from Git.

## What's included

- Full-screen map, compact mobile controls and a continuous seven-day time
  slider. Nearby places form tappable groups at city scale; search and the
  list retain the full selection.
- Touchgrass, bar, restaurant and event filters; partial shade does not
  exclude an entire park.
- 163 places, 139 OSM park areas and a building-shadow model with 19,523
  buildings. Solar analysis and shadow rasterization run in separate Web
  Workers and follow the selected time. Older browsers use a throttled
  canvas fallback.
- Real events from Københavns Biblioteker, plus one manually-verified
  curated listing, with a weekly discovery list and rich event details.
  Markers follow event start/end times; fictional demo events are optional
  and off by default.
- MET Norway forecasts for the selected time, invitations, guest RSVPs and
  host cancellation.
- Editable seating points and in-app solar warnings. System notifications
  require user activation and a running app; this is not background push.

## Verification

```bash
npm test                 # node's built-in test runner (tests/*.test.js)
npm run lint
npm run build
npm run test:browser     # requires a running app on port 3000
npm run test:solar
npm run test:events      # event feed, mobile details and timeline behaviour
npm run test:map         # grouping, mobile layout, worker/fallback and responsiveness
npm run test:i18n        # language selection, persistence and mobile UI
npm run test:nearby      # daily timeline, explicit GPS, arrival-aware suggestions and evidence
```

For browser tests, install Chromium with `npx playwright install chromium`,
or set `SUNSPOT_BROWSER_PATH` to an existing Chrome executable. Override
the app URL with `SUNSPOT_URL=http://localhost:4174`. Tests create and
cancel their own local invitations.

## Runtime and deployment

Use `npm run build && npm start` on a Node server with writable
**persistent storage** for invitations. `SUNSPOT_DATA_DIR` can select an
absolute path on that disk. Set `SUNSPOT_PUBLIC_ORIGIN` to the public
origin when running behind a reverse proxy so mutation-origin checks use
the correct host and scheme. The local SQLite pilot targets one server and
has a shared API request budget of 100 requests/minute per process.

**Invitations are not ready for Vercel deployment.** The Vercel runtime
explicitly returns a 503 response for invitation APIs rather than storing
them in a temporary filesystem (no persistent disk there). Map, solar
analysis, events and forecasts all work fine on Vercel — a shared database
is the next deployment work needed before invitations work there too.

Deployed at [sunspot-sigma.vercel.app](https://sunspot-sigma.vercel.app).

## Nearby and daily planning

The map opens at the current Copenhagen time. Choose a day, then slide within that day; Nu returns to live time. Sol nära mig requests location only after an explicit tap, or uses a clearly labelled area centre. Up to three suggestions account for estimated walking time, sunlight throughout the visit and opening status. GPS stays in browser memory. [Behaviour, 20-place Nørrebro review and limitations](docs/18-nearby-and-trust.md).

## Languages

Choose Swedish, Danish or English under Filters. The browser remembers the choice.
Place names and organizer content remain in their original language.
[Languages, sharing and place cards](docs/19-languages-and-sharing.md).

## Accuracy and sources

Building heights are often estimated, and trees, terrain and detailed roof shapes are absent. Sunny means possible direct building-unobstructed sunlight, not a cloud-free weather guarantee. Outside the building extract, or at very low sun angles, the model reports unknown. OSM hours and seating areas are approximate snapshots, not verified business availability. Seven Nørrebro venues use dated first-party opening-hour reviews, expiring after 90 days. All seating points remain estimated or user-chosen; source-confirmed outdoor seating does not verify exact coordinates.

- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright):
  buildings, parks, places and benches, under ODbL.
  [Data provenance](data/README.md).
- [MET Norway Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation):
  weather forecasts.
- [Københavns Biblioteker](https://bibliotek.kk.dk/api/v1/events): live
  public event feed; [event sources and limitations](docs/15-eventkallor.md).

## History

This app began as a narrower Next.js/TypeScript prototype (shadows +
weather + sun-exposed benches/parks, see
[docs/superpowers/](docs/superpowers/)) before merging in a substantially
more capable rewrite: the build-time OSM data pipeline (replacing live
Overpass calls, which were rate-limit prone), more accurate prism-based
shadow geometry, off-main-thread rendering, and the event/invite feature.
Two regressions from the original prototype (a suncalc units bug, and a
"sun below horizon" false-positive) were fixed before that merge and are
covered by `tests/shadows.test.js` and `tests/parks.test.js`.

Product and prototype documentation under `docs/01`–`docs/17` (Swedish)
and `docs/superpowers/` (English) record that history in more detail.

Code license: [MIT](LICENSE). Geographic and weather data retain their own
attribution and license.
