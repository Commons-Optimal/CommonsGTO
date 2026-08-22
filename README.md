# Commons Optimal

A lightweight strategy layer for the Commons Vouch experiment. It calculates qualification gaps, vouch power, reciprocal match quality, efficient combinations, and defensive slash exposure.

## Run locally

```bash
npm install
npm run dev
```

The checked-in demo dataset is always labelled in the UI. To connect a structured public leaderboard endpoint, set:

```bash
COMMONS_API_URL=https://example.com/leaderboard.json
NEXT_PUBLIC_SITE_URL=https://your-deployment.example
```

The adapter accepts an array, or a `participants`, `leaderboard`, or `data` array, with common camelCase/snake_case score fields. Live responses are cached for 30 seconds. If the endpoint fails, the UI explicitly falls back to illustrative demo data rather than presenting stale data as live.
