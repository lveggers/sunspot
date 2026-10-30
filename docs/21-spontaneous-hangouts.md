# Spontaneous hangouts

SunSpot now supports “I’m here. Come by.” year-round. Sunshine is optional: the sun-only map filter starts off. Existing time, category and opening filters remain available.

## Flow

1. Open a place card and choose “Jag är här – kom!” (or “Bjud in hit” when planning).
2. Enter a first name, choose beer/coffee/food/just hanging, and 30–180 minutes.
3. Create, then tap “Dela med vänner”. A separate tap preserves native iOS share activation. Share cancellation never copies silently; unavailable sharing falls back to clipboard/manual text.
4. Friends open `/hang/[id]` without registration or Vercel login. They see the place, host, end time, guests, RSVP and Maps directions.
5. Guests can withdraw their own response. The host sees replies on refresh or within 30 seconds while visible, extends by 30 minutes (maximum six hours total), or ends the hangout.
6. Expired/ended invitations cannot accept responses or be extended. No “someone is here” claim remains. Data expires 24 hours after the scheduled end.

Swedish, Danish and English are supported. Language choices persist locally. Host and guest credentials stay in their original browser; clearing browser storage loses management access. An invitation link never contains these credentials or a private Vercel access token. Names, profile photos and attendance are visible to anyone holding the link, as disclosed before creation/joining.

## Storage and deployment

- `server/hangs.js`: input validation, public DTOs, host/guest authorization, expiry and shared mutation limits.
- `server/hang-store.js`: Upstash Redis REST, atomic compare-and-swap using EVAL, automatic TTL. Local SQLite fallback only outside Vercel.
- Production Redis: `sunspot-hangouts`, Frankfurt, free plan, automatic paid upgrades disabled.
- Private map project: `sunspot-private`, Vercel Authentication retained. Creates hangs and holds host browser credentials.
- Public recipient project: `sunspot-hangouts`, same source, `SUNSPOT_RECIPIENT_ONLY=1`. Public root is a small landing page; proxy restricts routes to hang pages/API/assets, and API creation is independently disabled. No private-app bypass token is distributed.
- Both projects share Redis REST credentials. Private project is linked to the integration; recipient project's encrypted variables reference the same database. Rotate both if credentials change.
- `SUNSPOT_PUBLIC_HANG_ORIGIN=https://sunspot-hangouts.vercel.app` in both projects ensures only public invitation links are shared.
- Required server-only storage variables: `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`). Never use `NEXT_PUBLIC_` for credentials.
- APIs and invitation pages are no-store/noindex; mutation origins must match the requesting app. No cross-origin CORS or in-memory production fallback.
- Creation is idempotent per browser-generated token; tokens are SHA-256 hashed in Redis. RSVP edits, closure and extension use CAS, preventing lost concurrent updates. Body size 32KB (including a bounded profile thumbnail), names 32 characters, 50 guests per hang. Mutation limits are 60 per credential/hang per ten minutes and 100 creates per ten minutes deployment-wide.

Local: `npm ci`, `vercel env pull .env.local`, `npm run dev`. Without Redis credentials, local data uses `.data/hangs.sqlite`. Host management happens on the private origin; friends use the public origin. Local testing without the configured public origin uses local invitation links.

## Solar information

Only a known estimated transition into shade produces an optional sun-until snapshot. It is bounded to three hours, labelled as an estimate at invitation time, and disappears when elapsed. Parks, unknown/pending estimates and forecast-horizon limits do not produce an exact countdown. Weather, trees, indoor/outdoor seating and later custom seat changes are not live-verified on the invitation page. No sunshine is required to create, open or join a hangout.

## Validation

`npm test`, `npm run lint`, `npm run build`; `npm run test:hangs` exercises map → create → share → independent anonymous guest → RSVP → reload → host → extend → withdraw → close, all three languages, small mobile width, missing link and no-map recipient loading. `test:share` aliases this current flow. `test:solar` verifies the sun filter can still be enabled explicitly. Browser tests use synthetic names and end their test hangs.

Native share activation and cancellation are tested in Chromium. A physical iPhone share sheet and installation/PWA are not part of this release. Replies refresh while the page is open; background push notifications are not implemented. The older `/invite` planning flow remains local-only; new shared hangouts use `/hang`.
