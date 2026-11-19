from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

rows = [
["TC-01","Smoke","Truy cập route","Website đang chạy","Mở các route","/api/health và 7 trang","Tất cả 200","200","PASS","P0"],
["TC-02","Auth","Đăng ký dữ liệu sai","Không đăng nhập","Gửi name/email/password sai","Payload không hợp lệ","400 BAD_NAME/BAD_EMAIL","400","PASS","P0"],
["TC-03","Dashboard","Tài khoản mới sạch","Tài khoản guest mới","Mở dashboard và reload","Guest mới","Không có to-do/focus/Sao/chuỗi giả","Đạt","PASS","P0"],
["TC-04","Profile","Nhập Khối lớp","Profile mới","Nhập Lớp 11 và lưu","Lớp 11","Lưu 11 và hiển thị Lớp 11","Đạt","PASS","P1"],
["TC-05","Profile","Nhập Kỳ thi","Profile mới","Nhập kỳ thi tự do","Tên kỳ thi","Kỳ thi được lưu","Đạt","PASS","P1"],
["TC-06","Profile","Ngày thi trống","Profile mới","Nhập kỳ thi không nhập ngày","examDate rỗng","Không D-0","D-0","FAIL","P2"],
["TC-07","Room","Tạo phòng cộng đồng","Guest đăng nhập","Nhập tên/môn/topic","Sinh học","Phòng tạo và môn hiển thị đúng","Đạt","PASS","P0"],
["TC-08","Room","Tên phòng trống","Guest đăng nhập","Nhập tên trống submit","Tên rỗng","Chặn và giữ modal","Chặn","PASS","P1"],
["TC-09","Room","Môn tự nhập","Guest đăng nhập","Nhập Sinh học","custom:Sinh học","Lưu và hiển thị Sinh học","Đạt","PASS","P0"],
["TC-10","Room","Vào/rời phòng","Hai session khác nhau","Join và leave","Room group","Leave xóa khỏi Phòng của tôi","Đạt","PASS","P0"],
["TC-11","Room","Giải tán phòng","Tài khoản chủ phòng","Xác nhận dissolve","Room group","Room bị xoá","Đạt","PASS","P0"],
["TC-12","Room","Phòng chưa mở","Room is_live=false","Join bằng user khác","Room chưa mở","409 ROOM_NOT_OPEN","409","PASS","P0"],
["TC-13","Room","Phòng đầy","Capacity 2/base 1","User thứ hai join","Capacity","409 ROOM_FULL","409","PASS","P0"],
["TC-14","Chat","Gửi chat trong phòng","Đã join","Gửi tin hợp lệ","QA chat","Tin xuất hiện và lưu","Đạt","PASS","P1"],
["TC-15","Chat","Gửi trước khi join","Chưa join","POST message","Room","403 NOT_ROOM_MEMBER","403","PASS","P1"],
["TC-16","Timer","Chạy và tạm dừng","Trong room","Start 2s/pause","25:00","Timer 24:58","24:58","PASS","P1"],
["TC-17","Timer","Chuỗi sau 2 giây","Trong room","Start 2s/pause","0 phút","Chuỗi 0 ngày","1 ngày","FAIL","P2"],
["TC-18","Responsive","Mobile layout","Chromium viewport","Mở dashboard và menu","487px tool viewport","Không overflow và menu mở","Đạt","PASS","P1"],
]

wb = Workbook()
ws = wb.active
ws.title = "Test Cases"
headers = ["Test Case ID","Module","Scenario","Preconditions","Test Steps","Test Data","Expected Result","Actual Result","Status","Priority"]
ws.append(headers)
for row in rows:
    ws.append(row)

for cell in ws[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="2F6FD0")
    cell.alignment = Alignment(horizontal="center")

for col in range(1, len(headers)+1):
    ws.column_dimensions[get_column_letter(col)].width = 22
ws.freeze_panes = "A2"
ws.auto_filter.ref = ws.dimensions
for row in ws.iter_rows():
    for cell in row:
        cell.alignment = Alignment(wrap_text=True, vertical="top")

bugs = wb.create_sheet("Bug Summary")
bugs.append(["Bug ID","Title","Severity","Priority","Status"])
bugs.append(["BUG-001","Chuỗi 1 ngày sau 2 giây","Medium","P2","Resolved"])
bugs.append(["BUG-002","D-0 khi chưa có ngày thi","Medium","P2","Resolved"])
bugs.append(["BUG-003","Ngày hợp lệ hiển thị D-null","High","P1","Resolved"])
for cell in bugs[1]:
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = PatternFill("solid", fgColor="B34D24")

wb.save("qa-reports/04-test-cases.xlsx")
