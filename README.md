# Common Strategy

A hosted Next.js surface for Common Strategy — the pooled Commons treasury account. One page: a live ring showing the pool's standing, who owns it pro rata, and how long the experiment has left.

The application deliberately has no demo fallback. When the Commons feed is missing or invalid it says so rather than inventing numbers.

## Live source

The pool's state is read from the public Commons API (`https://api.commonsmade.com`) for the account named by `COMMON_STRATEGY_HANDLE`, which defaults to `commonstrat`. The server fetches the account's leaderboard entry and its vouch ledger, derives every owner's pro-rata share from positive vouches only, and caches the result briefly. Browsers never call Commons directly — they poll `GET /api/common-strategy`, which is the only API route the app exposes.

`GET /api/common-strategy?quote=<handle>` prices what a vouch from that handle would contribute and own.

## Countdown

`NEXT_PUBLIC_COMMONS_CLOSE_AT` (ISO 8601) sets the official end of the Commons experiment and drives the countdown clock; without it the app tries to discover the close time from the Commons event metadata and otherwise shows "CLOSE TIME TBC". The time ring around the pool is scaled to the final stretch — the last 7 days, switching to the last 24 hours inside a day — so it stays legible and visibly moves at the end of the experiment; it does not depend on a start date. `NEXT_PUBLIC_COMMONS_OPEN_AT` remains optional and is no longer required. Both are build-time `NEXT_PUBLIC_*` variables, so redeploy after changing them.

## Development

```bash
npm install
npm run dev
```
