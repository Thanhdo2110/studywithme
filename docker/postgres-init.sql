-- Chạy một lần khi volume Postgres được khởi tạo.
-- Database riêng cho test để `npm test` có thể xoá sạch schema mà không đụng dữ liệu dev.
CREATE DATABASE swm_test OWNER swm;
