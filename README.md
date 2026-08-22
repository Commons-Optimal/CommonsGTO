# Commons GTO

A hosted Next.js strategy surface for the Commons Vouch market. The application deliberately has no demo participant fallback: when the authoritative feed is missing or invalid, it returns a clear unavailable state.

## Live source

Set `COMMONS_API_URL` to the authoritative structured leaderboard endpoint discovered for the official Commons deployment. The adapter accepts a participant array directly or under `participants`, `leaderboard`, `users`, or `data`; it validates every score and derives the rank-1000 cutoff only from the returned snapshot. `COMMONS_API_TOKEN` is an optional bearer token.

The source is cached for five minutes by Next.js. Browser requests use the server adapter through the rendered result page or `GET /api/strategy/:username`; browsers never scrape Commons themselves.

## Snapshot history

Connect a Vercel KV/Upstash REST database with `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Successful live fetches append participant count, cutoff, and selected leaderboard values to `commons:gto:snapshots`. Without the binding the app truthfully reports insufficient history and does not project a cutoff.

## Countdown

`NEXT_PUBLIC_COMMONS_CLOSE_AT` (ISO 8601) sets the official end of the Commons experiment and drives the countdown clock; until it is set the UI truthfully shows "CLOSE TIME TBC". `NEXT_PUBLIC_COMMONS_OPEN_AT` is optional — together with the close time it drives the draining time ring around the pool visualization. Both are build-time `NEXT_PUBLIC_*` variables, so redeploy after changing them.

## Development

```bash
npm install
npm run dev
```
