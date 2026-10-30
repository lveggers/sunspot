# Optional Google sign-in

Google is an optional choice on `/profile`. New visitors sign up simply by choosing their Google account. Anonymous profiles, invitation viewing and named RSVPs remain available without registration. The Vercel protection on the private map is separate and remains unchanged.

Auth.js handles the Google OpenID Connect flow, PKCE, CSRF, encrypted HttpOnly session cookies and sign-out. The app requests only `openid email profile`, requires verified Google email, and keys account records by a SHA-256 digest of Google's stable subject rather than trusting a submitted email or ID. Google access/refresh tokens are not exposed in the session or stored in profile records. Sessions last up to 30 days.

Signed-in name, photo and preferred activity are stored in the existing Redis database under `sunspot:profiles:v1`, separate from expiring hangouts. They persist until explicitly removed operationally; no new storage service is added. `/api/account` derives identity from the verified server session, returns no-store responses and enforces same-origin, bounded, validated writes. Concurrent first visits preserve the winning record. A later Google login does not overwrite an edited SunSpot profile.

The first profile uses Google's given name and, when available, a sanitized 192px avatar fetched only from permitted Google image hosts. Profile photos are never fetched from URLs submitted to the profile API. The existing thumbnail validation and metadata removal also apply to account edits. Account email is shown only to its owner and is never sent to hangout participants.

Local profiles are not silently uploaded or replaced. A signed-in user can explicitly choose “Use the profile from this device”, review it and save. Account profiles live only in browser memory, so signing out does not leave that account's profile in the anonymous local profile. Language choices, hangout ownership credentials and RSVP management remain browser-local in this version; signing in does not recover old host/guest tokens on a different device. The profile screen explains the limitation.

## Provider setup

Google Cloud project: `sunspot-509215` (SunSpot).

Configure a Web application OAuth client with these exact authorized redirect URIs:

- `https://sunspot-private.vercel.app/api/auth/callback/google`
- `https://sunspot-hangouts.vercel.app/api/auth/callback/google`
- `http://localhost:4175/api/auth/callback/google` (optional developer testing)

Server-only configuration on both Vercel projects: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET` (a cryptographically random secret). Never use `NEXT_PUBLIC_` for these values. Do not put Vercel share/bypass tokens in Google settings or application links. The two domains use their own cookies; signing into the same Google account on each retrieves the same saved profile.

Google's consent configuration must be External and published for general access, or suitable test users must be listed while Testing. No billing upgrade is needed for the basic login setup. Missing configuration leaves Google login visibly unavailable while anonymous features remain usable. Preview deployments need an explicitly authorized OAuth callback before attempting real Google sign-in.

## Verification

`npm test` includes account isolation, forged identity rejection, CSRF protection, payload limits, retained edits, concurrent initialization and disabled configuration. `scripts/verify-account.mjs` uses locally signed synthetic Auth.js sessions on localhost only to exercise profile persistence across independent browser contexts, logout, account separation, 320px layout, and Google OAuth/PKCE initiation. It does **not** claim to complete Google consent. A real Google sign-in and production persistence check must be recorded separately after credentials are installed.

Google OAuth client `SunSpot Web` is configured and its audience is **External / In production**. The three server-only variables are installed as sensitive values for Production and Preview in both Vercel projects. Public privacy information is available at `/privacy` in Swedish, Danish and English.

Deployment checks on 20 September 2026 passed on the stable production URLs: private Google button enabled, anonymous account response, mobile profile and privacy navigation, public recipient routes and preserved private Vercel protection. The real Google flow reached account selection and consent on the public origin. The owner was asked to approve basic profile/email access; that final consent and subsequent real callback remain pending. No real Google login success is claimed yet.

The local browser checks also cover account photo synchronization. The profile API rejects a save if the browser's expected account differs from the currently verified session, including account switches in another tab.
