/* ==========================================================================
   StudyWithMe — Room picker
   Biểu mẫu mở phòng cá nhân + bảng chọn "Phòng đang mở" (room.html không
   kèm ?room). Độc lập với phần phòng thật để room.js gọn lại.
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { icon, escapeHTML, toast } = window.UI;

  /* ---------------------------------------------------------------------- */
  /* Biểu mẫu "Mở phòng cá nhân" — người dùng tự nhập tên và chọn môn          */
  /* ---------------------------------------------------------------------- */

  function renderSoloForm() {
    const page = document.querySelector(".page--room");
    if (!page) {
      window.location.href = "dashboard.html";
      return;
    }
    const lastName = (Store.state.profile.name || "").trim().split(" ").slice(-1)[0] || "bạn";
    page.innerHTML = `
      <div class="room-picker solo-form">
        <div class="picker-head">
          <h1>Mở phòng cá nhân</h1>
          <p>${icon("lock")} Không gian riêng của bạn — không ai làm phiền.</p>
        </div>
        <form id="soloForm" class="panel solo-panel" autocomplete="off">
          <div class="panel-body solo-panel-body">
            <div class="field">
              <label for="soloName">Tên phòng</label>
              <input class="input" id="soloName" maxlength="60" value="Phòng của ${escapeHTML(lastName)}">
              <span class="field-hint">Ví dụ: Góc học tối, Phòng của ${escapeHTML(lastName)}…</span>
            </div>
          </div>
          <div class="solo-foot">
            <button type="submit" class="btn btn-primary btn-sm">${icon("arrow-right")} Mở phòng</button>
            <a class="btn btn-ghost btn-sm" href="dashboard.html">Về Sảnh chính</a>
          </div>
        </form>
      </div>`;

    document.getElementById("soloForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const name = document.getElementById("soloName").value.trim() || `Phòng của ${lastName}`;
      try {
        const created = await Store.createRoom({ type: "solo", name });
        window.location.href = `room.html?room=${encodeURIComponent(created.id)}`;
      } catch (err) {
        toast(err.message || "Không mở được phòng cá nhân.", "danger");
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Bảng chọn "Phòng đang mở" — khi vào room.html không kèm ?room             */
  /* ---------------------------------------------------------------------- */

  function renderRoomPicker() {
    const page = document.querySelector(".page--room");
    if (!page) {
      window.location.href = "dashboard.html";
      return;
    }
    const subOf = (id) => (typeof id === "string" && id.startsWith("custom:"))
      ? { name: id.slice(7), color: "#959590" }
      : D.SUBJECT_MAP[id] || { name: "", color: "#8a8a85" };
    const rooms = (Store.state.rooms || []).filter((r) => r.live && r.type !== "solo");
    const cards = rooms
      .map((room) => {
        const sub = subOf(room.subject);
        const full = !room.inRoom && !room.mine && room.joined >= room.capacity;
        return `
        <article class="room-card">
          <div class="room-card-top">
            ${room.type !== "community" ? `<span class="tag">${icon(D.roomTypeIcon(room.type))} ${D.roomTypeLabel(room.type)}</span>` : ""}
            <span class="room-live"><i></i> LIVE</span>
          </div>
          <h3>${escapeHTML(room.name)}</h3>
          <div class="room-host"><span>${escapeHTML(room.hostEmoji || "")}</span><span>Chủ phòng: ${escapeHTML(room.host)}</span></div>
          <div class="room-capacity">
            <div class="cap-top"><span>Chỗ ngồi</span><b>${room.joined} / ${room.capacity}</b></div>
            <div class="bar"><span style="width:${Math.min(100, Math.round((room.joined / room.capacity) * 100))}%"></span></div>
          </div>
          <div class="room-foot">
            ${full
              ? '<button type="button" class="btn btn-soft btn-sm" disabled>Đã đầy</button>'
              : `<a class="btn btn-accent btn-sm" href="room.html?room=${encodeURIComponent(room.id)}">Vào phòng ${icon("arrow-right")}</a>`}
          </div>
        </article>`;
      })
      .join("");

    page.innerHTML = `
      <div class="room-picker">
        <div class="picker-head">
          <h1>Phòng đang mở</h1>
          <p>${icon("info")} Chọn một phòng để vào — bạn không bị nhảy tự động vào phòng nào.</p>
        </div>
        <div class="room-grid">${cards}</div>
        ${rooms.length ? "" : '<p class="hint">Chưa có phòng nhóm nào đang LIVE. Hãy mở phòng cá nhân hoặc tạo phòng nhóm từ Sảnh chính.</p>'}
        <div class="picker-actions">
          <a class="btn btn-primary btn-sm" href="room.html?type=solo">${icon("lock")} Mở phòng cá nhân</a>
          <a class="btn btn-ghost btn-sm" href="dashboard.html">Về Sảnh chính ${icon("arrow-right")}</a>
        </div>
      </div>`;
  }


  window.RoomPicker = { renderSoloForm, render: renderRoomPicker };
})();
