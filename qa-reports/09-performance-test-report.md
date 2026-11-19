# 09 - Performance Test Report

## Status: BLOCKED
Không có SLA hoặc ngưỡng P95/P99 được khách hàng thống nhất.
Không thực hiện k6/JMeter trên production theo nguyên tắc cấp phép.

## Đã kiểm tra
- Smoke route/health.
- API suite thời gian ngắn.

## Đề xuất ngưỡng tạm thời
- P95 API < 500ms trong môi trường test.
- P99 < 1s.
- Error rate < 1%.
- Không SLA, chỉ là tiêu chí đề xuất.

