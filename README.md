# Commons GTO

A hosted Next.js strategy surface for the Commons Vouch market. The application deliberately has no demo participant fallback: when the authoritative feed is missing or invalid, it returns a clear unavailable state.

## Live source

Set `COMMONS_API_URL` to the authoritative structured leaderboard endpoint discovered for the official Commons deployment. The adapter accepts a participant array directly or under `participants`, `leaderboard`, `users`, or `data`; it validates every score and derives the rank-1000 cutoff only from the returned snapshot. `COMMONS_API_TOKEN` is an optional bearer token.

The source is cached for five minutes by Next.js. Browser requests use the server adapter through the rendered result page or `GET /api/strategy/:username`; browsers never scrape Commons themselves.

## Snapshot history

Connect a Vercel KV/Upstash REST database with `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Successful live fetches append participant count, cutoff, and selected leaderboard values to `commons:gto:snapshots`. Without the binding the app truthfully reports insufficient history and does not project a cutoff.

## Development

```bash
npm install
npm run dev
```
