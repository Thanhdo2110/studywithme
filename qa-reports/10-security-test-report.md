# 10 - Security Test Report

## Security headers
PASS:
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera/microphone/geolocation disabled
- CSP: được đặt

## Origin/CSRF
- Request ghi cross-origin được server kiểm tra theo Origin.
- Cookie Has `HttpOnly`, `SameSite=Lax`; Secure áp dụng HTTPS.

## Areas not executed
- SQL injection full fuzzing.
- XSS payload matrix.
- Distributed brute-force/load.
- Dependency/SAST scanning.
- Penetration test có chủ đích.

