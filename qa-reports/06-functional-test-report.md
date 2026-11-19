# 06 - Functional Test Report

## Browser E2E thực thi
PASS:
- Mở dashboard với tài khoản guest.
- Giao diện mặc định sáng.
- Tạo phòng cộng đồng nhập môn “Sinh học”.
- Môn `custom:Sinh học` hiển thị “Sinh học”.
- Lưu “Lớp 11” và hiển thị “Lớp 11”, không “Lớp Lớp 11”.
- Lưu kỳ thi tự nhập.
- Vào phòng, gửi chat.
- Thêm mục tiêu.
- Chạy/tạm dừng đồng hồ.
- Chủ phòng giải tán phòng và điều hướng về dashboard.
- Tạo phòng với tên trống bị chặn và modal giữ mở.
- Mobile menu mở được.

FAIL:
- Kỳ thi có tên nhưng không có ngày thi vẫn hiển thị ngày hiện tại/D-0.
- 2 giây focus tạo chuỗi 1 ngày dù 0 phút.

