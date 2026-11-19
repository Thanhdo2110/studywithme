# 08 - Database Test Report

Kiểm tra read-only:
- users: 12
- rooms: 10
- room_members: 19
- messages: 16

Không chạy DROP/DELETE/TRUNCATE hoặc thay schema.

## Integrity
Không phát hiện vi phạm khóa ngoại trong kiểm tra CRUD tích hợp.
Concurrency và unique constraints seat chưa kiểm tra đầy đủ bằng test hai session browser thật.

