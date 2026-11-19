# 05 - Smoke Test Report

## Docker
Tất cả container đều Healthy:
- swm-frontend
- swm-backend
- swm-postgres
- swm-redis

## Route
PASS:
- `/`, `/dashboard.html`, `/myroom.html`, `/planner.html`
- `/room.html`, `/stats.html`, `/profile.html`
- `/api/health`, `/api/bootstrap.js`

## API Health
`/api/health` trả 200.

## Baseline
18/18 integration test pass trong Docker và môi trường local.

