(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { icon, escapeHTML, avatarHTML, toast } = window.UI;

  let activeFilter = "all";
  let activeQuery = "";

  /* Khách (chưa đăng ký) không tạo được phòng — đưa thẳng vào bảng Đăng ký. */
  function isGuestAccount() {
    return !(Store.account && Store.account.isGuest === false);
  }

  function askRegister() {
    window.UI.closeModal("createRoomModal");
    window.UI.openAuth("register");
  }

  /* Khách bấm "Tạo phòng" sẽ mở luôn bảng Đăng ký thay vì form tạo phòng. */
  function gateCreateRoomButton() {
    if (!isGuestAccount()) return;
    document.querySelectorAll('[data-open-modal="createRoomModal"]').forEach((btn) => {
      btn.removeAttribute("data-open-modal");
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        askRegister();
      });
    });
  }

  function subject(id) {
    if (id === "mixed") return { name: "", color: "#8a8a85" };
    if (typeof id === "string" && id.startsWith("custom:")) {
      return { name: id.slice(7), color: "#959590" };
    }
    return D.SUBJECT_MAP[id] || { name: "", color: "#8a8a85" };
  }

  function subjectValue(value) {
    const name = value.trim();
    if (!name) return "";
    const known = D.SUBJECTS.find((item) => item.name.toLowerCase() === name.toLowerCase());
    return known ? known.id : `custom:${name}`;
  }

  function isHost(room) {
    return room.role === "host" || room.mine;
  }

  function membersFor(room, count) {
    const offset = [...String(room.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % D.MEMBER_POOL.length;
    const length = Math.min(count, Math.max(0, room.joined));
    return Array.from({ length }, (_, index) => D.MEMBER_POOL[(offset + index) % D.MEMBER_POOL.length]);
  }

  function render() {
    const allRooms = Array.isArray(Store.state.myRooms) ? Store.state.myRooms : [];
    const query = activeQuery.toLowerCase();
    const rooms = allRooms.filter((room) => {
      if (activeFilter === "host" && !isHost(room)) return false;
      if (activeFilter === "member" && isHost(room)) return false;
      if (!query) return true;
      return room.name.toLowerCase().includes(query) ||
        (room.topic || "").toLowerCase().includes(query) ||
        D.roomTypeLabel(room.type).toLowerCase().includes(query);
    });

    document.getElementById("myroomTotal").textContent = allRooms.length;
    document.getElementById("myroomHosted").textContent = allRooms.filter(isHost).length;
    document.getElementById("myroomJoined").textContent = allRooms.filter((room) => !isHost(room)).length;
    document.getElementById("myroomCount").textContent = `${rooms.length} phòng`;

    const list = document.getElementById("myroomList");
    const empty = document.getElementById("myroomEmpty");
    if (!rooms.length) {
      list.innerHTML = "";
      empty.classList.remove("hidden");
      window.UI.hydrateIcons(empty);
      return;
    }
    empty.classList.add("hidden");

    list.innerHTML = rooms.map((room) => {
      const sub = subject(room.subject);
      const host = isHost(room);
      const percent = room.capacity ? Math.min(100, Math.round((room.joined / room.capacity) * 100)) : 0;
      const people = membersFor(room, 4);
      const unavailable = room.live === false && !host;
      return `
        <article class="room-card">
          <div class="room-card-top">
            <span class="tag">${icon(D.roomTypeIcon(room.type))} ${D.roomTypeLabel(room.type)}</span>
            <span class="myroom-role${host ? " myroom-role--host" : ""}">${host ? "CHỦ PHÒNG" : "THÀNH VIÊN"}</span>
          </div>
          <h3>${escapeHTML(room.name)}</h3>
          <div class="room-host">
            ${avatarHTML(room.hostEmoji || "", room.host || "Chủ phòng")}
            <span>Chủ phòng: ${escapeHTML(room.host || "Bạn")}</span>
          </div>
          ${room.topic ? `<p style="font-size:11.5px;color:var(--text-3);line-height:1.55;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">${escapeHTML(room.topic)}</p>` : ""}
          <div class="room-capacity">
            <div class="cap-top">
              <span>Chỗ ngồi${room.active === false ? " · vắng mặt" : ""}</span>
              <b>${room.joined} / ${room.capacity}</b>
            </div>
            <div class="bar${percent >= 85 ? " warn" : ""}"><span style="width:${percent}%"></span></div>
          </div>
          <div class="room-foot">
            <div class="avatar-stack">
              ${people.map(([name, emoji]) => avatarHTML(emoji, name)).join("")}
            </div>
            ${room.joined > people.length ? `<span class="more">+${room.joined - people.length}</span>` : ""}
            <div class="myroom-card-actions">
              <a class="btn ${unavailable ? "btn-soft" : "btn-accent"} btn-sm"
                 href="${unavailable ? "#" : `room.html?room=${encodeURIComponent(room.id)}`}"
                 ${unavailable ? 'data-room-disabled="true" aria-disabled="true"' : ""}>
                ${unavailable ? "Sắp mở" : "Vào phòng"} ${unavailable ? "" : icon("arrow-right")}
              </a>
            <button class="btn btn-ghost btn-sm" type="button"
              data-room-action="${host ? "dissolve" : "leave"}" data-room-id="${escapeHTML(room.id)}">
              ${icon(host ? "trash" : "logout")}
            </button>
            </div>
          </div>
        </article>`;
    }).join("");

    list.querySelectorAll("[data-room-disabled]").forEach((link) => {
      link.addEventListener("click", (event) => event.preventDefault());
    });

    /* Khách bấm "Vào phòng": mở bảng Đăng ký/Đăng nhập, xong vào thẳng phòng đó. */
    if (isGuestAccount()) {
      list.querySelectorAll('a[href^="room.html?room="]').forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          window.UI.openAuth("register", { afterAuth: link.getAttribute("href") });
        });
      });
    }
    list.querySelectorAll("[data-room-action]").forEach((button) => {
      button.addEventListener("click", () => handleAction(button));
    });
  }

  async function handleAction(button) {
    const roomId = button.dataset.roomId;
    const room = (Store.state.myRooms || []).find((item) => item.id === roomId);
    if (!room) return;
    const dissolve = button.dataset.roomAction === "dissolve";
    const question = dissolve
      ? `Giải tán “${room.name}”? Tin nhắn, tài liệu và sổ nháp của phòng sẽ bị xoá với tất cả mọi người.`
      : `Rời khỏi “${room.name}”? Phòng sẽ biến mất khỏi danh sách Phòng của tôi cho tới khi bạn vào lại.`;
    if (!window.confirm(question)) return;

    button.disabled = true;
    try {
      if (dissolve) await Store.closeRoom(roomId);
      else await Store.leaveRoom(roomId);
      render();
      toast(dissolve ? "Đã giải tán phòng." : "Đã rời phòng.");
    } catch (err) {
      button.disabled = false;
      toast(err.message || "Không thực hiện được. Vui lòng thử lại.", "danger");
    }
  }

  function initCreateRoom() {
    const form = document.getElementById("createRoomForm");
    const picker = document.getElementById("typePicker");
    const hint = document.getElementById("roomTypeHint");
    let roomType = "community";
    const hints = {
      community: "Phòng Cộng đồng hiển thị công khai ở Sảnh chính.",
      group: "Phòng Nhóm bạn chỉ người có link mới vào được.",
      solo: "Phòng Cá nhân dành riêng cho bạn.",
    };

    picker.querySelectorAll("[data-type]").forEach((button) => {
      button.addEventListener("click", () => {
        roomType = button.dataset.type;
        picker.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("active", item === button));
        hint.textContent = hints[roomType];
      });
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (isGuestAccount()) {
        askRegister();
        return;
      }
      const name = document.getElementById("roomName").value.trim();
      if (!name && roomType !== "solo") {
        document.getElementById("roomName").focus();
        toast("Hãy đặt tên cho phòng học.", "warning");
        return;
      }
      try {
        const room = await Store.createRoom({
          name,
          type: roomType,
          topic: document.getElementById("roomTopic").value.trim(),
        });
        window.UI.closeModal("createRoomModal");
        form.reset();
        render();
        toast(`Đã tạo “${room.name}”.`);
      } catch (err) {
        toast(err.message || "Không tạo được phòng học.", "danger");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
        render();
      });
    });
    window.addEventListener("shell:search", (event) => {
      activeQuery = (event.detail || "").trim();
      render();
    });
    render();
    initCreateRoom();
    gateCreateRoomButton();
  });
})();
