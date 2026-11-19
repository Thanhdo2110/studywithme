# 07 - API Test Report

## Regression
19/19 test pass.

## Negative API
- Đăng ký dữ liệu không hợp lệ: 400.
- Unknown room không authenticated: 401 (không rò rỉ dữ liệu).
- `ROOM_FULL`: test suite 409.
- `ROOM_NOT_OPEN`: test suite 409.
- Not room member gửi chat: 403.

## Evidence
Kết quả health, route và negative checks lưu trong shell test output.

