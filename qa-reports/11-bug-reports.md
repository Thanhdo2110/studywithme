# 11 - Bug Reports

## BUG-001
**Title:** [Room Timer] 2 giây focus được tính thành chuỗi 1 ngày  
**Severity:** Medium  
**Priority:** P2  
**Environment:** Docker, Chromium 2026-11-18  
**Preconditions:** Tài khoản guest mới, vào phòng, timer bắt đầu.  
**Steps:**
1. Bắt đầu timer.
2. Chờ khoảng 2 giây.
3. Tạm dừng.
**Expected:** 0 phút không tạo chuỗi mới.
**Actual:** UI hiển thị `1 ngày`; today focus vẫn `0p`.
**Evidence:** Browser result timer 24:58 và chuỗi 1 ngày.
**Root Cause:** `computeStreak` có thể tính dòng focus_daily có seconds > 0; chưa yêu cầu minute threshold.
**Suggested Fix:** Chỉ tính chuỗi khi ít nhất 1 phút hoàn thành trong ngày.

**Retest:** PASS — 2 giây không tạo chuỗi; UI 0 ngày và API streak 0.
**Status:** Resolved

## BUG-004
**Title:** [Room Navigation] “Phòng đang mở” đổi sang phòng đầu tiên thay vì phòng vừa xem  
**Severity:** High  
**Priority:** P1  
**Environment:** Docker, Chromium 2026-11-18  
**Preconditions:** Người dùng đã mở ít nhất một phòng.
**Steps:**
1. Vào phòng `Học Lập trình`.
2. Mở trang chủ.
3. Click mục `Phòng đang mở`.
**Expected:** Mở lại `Học Lập trình`.
**Actual Trước Fix:** Có thể mở phòng khác theo thứ tự mặc định.
**Root Cause:** `defaultRoomId()` luôn chọn phòng cộng đồng live đầu tiên và không lưu lịch sử phòng.
**Suggested Fix:** Lưu `studywithme.lastRoom` sau khi load thành công và dùng nó trong sidebar/default resolver.
**Retest:** PASS — sidebar href trỏ phòng vừa mở; browser reopen giữ tên `Phòng học Lập trình`.
**Status:** Resolved

## BUG-005
**Title:** [User Room State] Phòng cộng đồng được hiểu nhầm là đã thuộc “Phòng của tôi”  
**Severity:** Medium  
**Priority:** P1  
**Environment:** Docker, Chromium 2026-11-18  
**Preconditions:** Tài khoản mới/guest chưa vào hoặc tạo phòng nào.  
**Steps:**
1. Tạo hoặc mở session guest mới.
2. Mở Dashboard.
3. Kiểm tra “Phòng của tôi” và “Phòng đang mở”.
**Expected:** “Phòng của tôi” rỗng; seed rooms chỉ hiển thị ở “Phòng đang mở”/public.
**Actual:** Tài khoản mới không có `room_members`/`myRooms`, và không còn seed room mẫu.
**Evidence:** `/api/me/rooms` trả `[]`; `/api/me` có `rooms=[]` sau khi dọn seed; browser card count 0 ở cả hai khu vực.
**Root Cause:** Seed global tạo phòng cộng đồng mặc định cho mọi tài khoản dù chưa thao tác.
**Suggested Fix:** Loại seed global và chỉ hiện phòng thực do người dùng tạo.
**Retest:** PASS — guest mới có 0 phòng trong “Phòng của tôi” và 0 phòng trong “Phòng đang mở”.
**Status:** Resolved

## BUG-003
**Title:** [Profile] Ngày thi hợp lệ lưu nhưng dashboard hiển thị D-null  
**Severity:** High  
**Priority:** P1  
**Environment:** Docker, Chromium 2026-11-18  
**Preconditions:** Tài khoản guest mới.
**Steps:**
1. Mở Hồ sơ.
2. Chỉ nhập Ngày thi `2026-12-31`.
3. Lưu.
4. Reload và mở Dashboard.
**Expected:** Ngày thi lưu, D-Day hiển thị số ngày hợp lệ.
**Actual:** API lưu đúng, Dashboard hiển thị D-null/Còn null ngày.
**Evidence:** save 200; stored `2026-12-31`; D-null trước retest.
**Root Cause:** Regex kiểm tra ISO date trong `daysUntil` bị viết sai dấu escape.
**Suggested Fix:** Dùng regex `/^\d{4}-\d{2}-\d{2}$/` và guard `null`.
**Retest:** PASS — hiển thị `31/12/2026`, `D-43`, `Còn 43 ngày`.
**Status:** Resolved

## BUG-002
**Title:** [Profile] Kỳ thi không có ngày nhưng D-Day hiển thị ngày hôm nay/D-0  
**Severity:** Medium  
**Priority:** P2  
**Environment:** Docker, Chromium 2026-11-18  
**Preconditions:** Tài khoản guest; nhập kỳ thi và trường mục tiêu, để ngày thi trống.  
**Steps:**
1. Mở Hồ sơ.
2. Nhập kỳ thi.
3. Nhập trường mục tiêu.
4. Lưu.
**Expected:** Không hiển thị D-0; biểu thị chưa đặt ngày thi.
**Actual:** Hiển thị D-0 và ngày thi hiện tại.
**Evidence:** Sidebar `D-0`, dashboard `Ngày thi: 18/11/2026`.
**Root Cause:** Server/profile giữ hoặc mặc định ngày thi hiện tại thay vì rỗng.
**Suggested Fix:** Cho phép examDate rỗng; UI kiểm tra rỗng trước khi tính D-Day.

**Retest:** PASS — dashboard hiển thị “—”, “Chưa đặt ngày thi”; API examDate rỗng.
**Status:** Resolved

