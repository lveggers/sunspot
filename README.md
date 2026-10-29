# SunSpot

SunSpot helps you find possible direct sunlight at parks, bars and
restaurants in Copenhagen, choose a time and invite friends.

## Run locally

With Docker:

```bash
docker compose up -d --build
```

Open [127.0.0.1:3085](http://127.0.0.1:3085); no login is required. Source
changes reload automatically. Set `SUNSPOT_PORT` to use another local port.
Optional `.env.local` values are loaded; invitation storage and the public
origin are always local. The private Docker subnet can be overridden with
`SUNSPOT_SUBNET` if it conflicts with another local network.
Invitations and weather cache persist in the
`sunspot-development_data` Docker volume. Stop with `docker compose down`
without `--volumes` to retain them. After changing dependencies, stop the
app, rebuild, and run `docker compose run --rm app npm ci` before starting
it again.

Without Docker:

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

- One Copenhagen paper-theatre opening with three outcomes: sun, no confirmed
  sun, or sun with Golden Hour. Puppets descend on visible strings, with
  hanging weather props in a compact panel over a darkened map. Search settings
  stay folded until opened; the functional interface stays free of characters.
  The original gallery remains available through a text button.
  [Visual system](docs/visual-identity.md) · [Opening motion](docs/character-animation-plan.md).
- Confirmed sunny, open places stand out in color against a faded grey map.
  Real weather and the partner's actual offer determine the opening scene.
- A remembered Danish, English or Swedish interface, including map controls,
  partner offers, vouchers and invitations.
- An area, day and time finder, starting at the current Copenhagen time.
  Choose a district or search within 1.5 km of your location, then find up
  to eight ranked places on a focused map, get walking directions and
  invite friends. Dates cover the next seven days.
- Independent park, bar and restaurant filters; partial shade does not
  exclude an entire park.
- 163 places, 139 OSM park areas and a building-shadow model with 19,523
  buildings. Solar analysis and shadow rasterization run in separate Web
  Workers and follow the selected time. Older browsers use a throttled
  canvas fallback.
- MET Norway forecasts for the selected time, invitations, guest RSVPs and
  host cancellation.
- Sunny and confirmed-open places are the default. Cloud, precipitation,
  stale or unavailable forecasts and unknown opening hours are excluded
  from that selection; the filters allow inspecting other conditions.
- Editable seating points and in-app solar warnings. System notifications
  require user activation and a running app; this is not background push.
- Golden Hour offers with drink-specific cutouts in the opening scene,
  public offer links and one-hour phone vouchers. Partner activation and new claims require
  server-verified building exposure, fresh weather and confirmed opening.
  A claimed voucher keeps its original expiry and can be redeemed once.
- A separate interactive Golden Hour example explicitly labels simulated
  sunshine, weather and a 10 DKK beer offer. Its ticket is not redeemable
  and never calls the real offer-claim API.

## Partner portal

Open [/partner](http://127.0.0.1:3085/partner). In Docker development, use
the **Fyll i lokal demoinloggning** button or the synthetic account
`demo@sunspot.local` / `sunspot-local-demo`. This account belongs to the
local Café Stefanshus demonstration; its offers and vouchers are explicitly
marked as demo. The initial offer is a private draft, never an active offer.
Demo access and persisted demo records are disabled in production.

Create an offer draft, then activate it when the server confirms sunshine
and opening hours at the registered venue. The campaign lasts one hour;
each visitor's voucher lasts one hour from claiming, even if the campaign
ends earlier. Changing the phone clock or claiming again cannot extend it.
The partner portal validates the voucher before marking it redeemed.

Partner accounts are bound to their venue and use hashed passwords and
expiring cookie sessions. Real partner account provisioning and agreements
are required before a live launch; no real partnerships or offers are
created by this development setup.

## Verification

```bash
npm test                 # node's built-in test runner (tests/*.test.js)
npm run lint
npm run build
npm run test:browser     # requires a running app on port 3000
npm run test:solar
npm run test:map         # grouping, mobile layout, worker/fallback and responsiveness
npm run test:golden-hour # offer/partner UI, sharing and server-anchored voucher states
npm run test:identity    # artwork, scene controls, mock labels and mobile map access
npm run test:language    # DA/EN/SV, navigation, form state and coupon timing
npm run test:experience  # three opening scenes, puppet strings/drop and figure-free functional screens
```

For browser tests, install Chromium with `npx playwright install chromium`,
or set `SUNSPOT_BROWSER_PATH` to an existing Chrome executable. Override
the app URL with `SUNSPOT_URL=http://localhost:4174`. Tests create and
cancel their own local invitations.

With the Docker development app running, install the browser inside the
container and run the checks there:

```bash
docker compose exec app npx playwright install --with-deps chromium
docker compose exec -e SUNSPOT_URL=http://127.0.0.1:3085 app npm run test:browser
docker compose exec -e SUNSPOT_URL=http://127.0.0.1:3085 app npm run test:solar
docker compose exec -e SUNSPOT_URL=http://127.0.0.1:3085 app npm run test:map
docker compose exec -e SUNSPOT_URL=http://127.0.0.1:3085 app npm run test:golden-hour
docker compose exec -e SUNSPOT_URL=http://127.0.0.1:3085 app npm run test:identity
docker compose exec -e SUNSPOT_URL=http://127.0.0.1:3085 app npm run test:language
docker compose exec -e SUNSPOT_URL=http://127.0.0.1:3085 app npm run test:experience
```

Use your configured port if `SUNSPOT_PORT` differs. Browser dependencies
must be reinstalled after recreating the development container.
Run browser checks sequentially. Production builds use a separate container
and private Next.js cache:

```bash
docker compose run --rm --no-deps -e NODE_ENV=production app npm run build
```

## Runtime and deployment

Use `npm run build && npm start` on a Node server with writable
**persistent storage** for invitations. `SUNSPOT_DATA_DIR` can select an
absolute path on that disk. Set `SUNSPOT_PUBLIC_ORIGIN` to the public
origin when running behind a reverse proxy so mutation-origin checks use
the correct host and scheme. The local SQLite pilot targets one server and
has a shared API request budget of 100 requests/minute per process.

**Invitations and Golden Hour require persistent hosting.** The Vercel runtime
explicitly returns a 503 response for these APIs rather than storing
them in a temporary filesystem (no persistent disk there). Map, solar
analysis and forecasts all work fine on Vercel — a shared database
is the next deployment work needed before invitations work there too.

Deployed at [sunspot-sigma.vercel.app](https://sunspot-sigma.vercel.app).

## Accuracy and sources

Building heights are often estimated, and trees, terrain and detailed roof
shapes are absent. Sunny means possible direct building-unobstructed
sunlight, not a cloud-free weather guarantee. Outside the building extract,
or at very low sun angles, the model reports unknown. OSM hours and seating
areas are approximate snapshots, not verified business availability.

- [OpenStreetMap contributors](https://www.openstreetmap.org/copyright):
  buildings, parks, places and benches, under ODbL.
  [Data provenance](data/README.md).
- [MET Norway Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation):
  weather forecasts.

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
