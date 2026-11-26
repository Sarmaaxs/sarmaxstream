# Fix notes — SarmaxStream

## Changes
- Added the missing Android bridge detection and IndexedDB offline-music storage modules.
- Added the missing `/music/downloads` page, including saved offline tracks, playback, removal, and recent download-job status.
- Fixed a duplicate `timeRef` declaration in the music player and ensured offline catalog tracks bypass online catalog resolution.
- Replaced the serverless-unsafe in-memory-only API limiter with an Upstash Redis atomic counter when configured. On Vercel, rate-limited API routes fail closed with HTTP 503 until both Redis credentials are set; local development can still use the in-memory fallback.
- Removed blanket CDN cache headers from the global Vercel rule so API responses are not accidentally publicly cached. Static assets retain their explicit long-lived cache policy.

## Required Vercel settings
Set both environment variables in the Vercel project before deploying:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Without them, the rate-limited API endpoints intentionally return HTTP 503 on Vercel. Do not paste these secrets into source files or chat.

## Verification
- `npm run build`: passed (Vite emits a non-fatal `__dirname` configuration warning).
- `node --test test/guard.test.js`: 3 passed, 0 failed.
- `node --check api/*.js`: passed.

## Known limitation
The existing Android JavaScript bridge does not expose a direct on-device YouTube downloader. The broken, unimplemented client-side fallback was removed; the normal server download route and saving to IndexedDB / the phone's file system remain available.
