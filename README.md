# SarmaxStream

SarmaxStream is a Vite/React web application with Vercel serverless API routes and Supabase-backed app services.

## Local development

- Node.js 22 or newer
- npm install
- npm run dev
- npm run build

## Shared API rate limiting

For production deployments with more than one serverless instance, configure both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel. The API uses an atomic Redis counter with expiry, shared across instances.

If neither variable is configured, the API falls back to a per-instance in-memory limiter suitable only for local development or a single long-lived process. If only one variable is configured, or Redis is unavailable, rate-limited endpoints fail closed with HTTP 503.

## Caching

API endpoints opt into shared caching individually where responses are public and safe to cache. The Vercel configuration does not apply a blanket public CDN cache policy to every API response.
