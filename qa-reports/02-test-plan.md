# 02 - Test Plan

## Scope
- Smoke, browser E2E, responsive desktop/mobile.
- API, database read-only, security headers, negative/edge.
- Regression 19 test tích hợp.

## Out of scope
- Production load/stress.
- JMeter/k6 because không có SLA hoặc môi trường tải được cấp phép.
- Firefox/Edge automated cross-browser.
- Insecure file upload: app hiện không upload file.

## Environment
- Frontend: http://localhost:3000
- Backend: http://127.0.0.1:3001
- Docker services: healthy.
- Browser: Chromium integrated Playwright.

## Exit criteria
- Không còn Critical/High chưa xác minh.
- Smoke/18 API regression pass.
- E2E core flows pass.
- Report có bằng chứng.

