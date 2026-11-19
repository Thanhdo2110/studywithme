/* ==========================================================================
   StudyWithMe — Dashboard (Sảnh chính)
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { icon, hydrateIcons, escapeHTML, avatarHTML, toast } = window.UI;

  let activeSubject = "all";
  let activeQuery = "";
  let newRoomType = "community";

  const TYPE_INFO = {
    community: { label: "Cộng đồng", icon: "globe", hint: "Phòng Cộng đồng hiển thị công khai ở Sảnh chính. Sức chứa tối đa 20 người." },
    group: { label: "Nhóm bạn", icon: "lock", hint: "Phòng Nhóm riêng tư, chỉ người có link mới vào được. Sức chứa tối đa 8 người." },
    solo: { label: "Cá nhân", icon: "user", hint: "Phòng Cá nhân chỉ dành cho bạn. Khung chat tự chuyển thành sổ nháp ghi chú." },
  };

  const CAPACITY = { community: 20, group: 8, solo: 1 };

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
    if (typeof id === "string" && id.startsWith("custom:")) {
      return { name: id.slice(7), color: "#959590" };
    }
    return D.SUBJECT_MAP[id] || { name: "Khác", color: "#959590" };
  }

  function subjectValue(value) {
    const name = value.trim();
    if (!name) return "";
    const known = D.SUBJECTS.find((item) => item.name.toLowerCase() === name.toLowerCase());
    return known ? known.id : `custom:${name}`;
  }

  function membersFor(room, n) {
    const offset = [...String(room.id)].reduce((a, c) => a + c.charCodeAt(0), 0) % D.MEMBER_POOL.length;
    const count = Math.min(n, Math.max(0, room.joined));
    return Array.from({ length: count }, (_, i) => D.MEMBER_POOL[(offset + i) % D.MEMBER_POOL.length]);
  }

  /* ---------------------------------------------------------------------- */

  function renderGreeting() {
    const profile = Store.state.profile;
    const hour = new Date().getHours();
    const part = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
    const shortName = profile.name.split(" ").slice(-1)[0];
    const el = document.getElementById("greeting");
    if (el) el.textContent = `${part}, ${shortName} 👋`;
  }

  function renderExam() {
    const profile = Store.state.profile;
    const days = D.daysUntil(profile.examDate);
    const percent = days === null ? 0 : Math.min(100, Math.max(0, Math.round((1 - days / 365) * 100)));
    const date = profile.examDate ? D.parseISO(profile.examDate) : null;
    const examSet = Boolean(profile.exam || profile.targetSchool);
    const dateSet = Boolean(profile.examDate && date);
    document.getElementById("examDays").textContent = dateSet ? `D-${days}` : "—";
    document.getElementById("examTitle").textContent =
      profile.exam && profile.targetSchool ? `${profile.exam} · ${profile.targetSchool}`
      : profile.exam || profile.targetSchool || "Chưa đặt mục tiêu kỳ thi";
    document.getElementById("examDate").textContent =
      dateSet ? `${D.pad(date.getDate())}/${D.pad(date.getMonth() + 1)}/${date.getFullYear()}` : "—";
    document.getElementById("examGoal").textContent = profile.goalHours;
    document.getElementById("examBar").style.width = dateSet ? `${percent}%` : "0%";
    document.getElementById("examLeftLabel").textContent = dateSet ? `Còn ${days} ngày` : "Chưa đặt ngày thi";
    document.getElementById("examPercentLabel").textContent = examSet ? `Mục tiêu: ${profile.goalHours} giờ/ngày` : "Chưa đặt mục tiêu";
  }

  function renderStats() {
    const s = Store.state;
    const todayMinutes = D.minutesForDay(new Date());
    const yesterday = D.minutesForDay(D.addDays(D.startOfToday(), -1));
    const diff = todayMinutes - yesterday;
    const diffPct = yesterday > 0 ? Math.round((diff / yesterday) * 100) : diff > 0 ? 100 : 0;
    const done = s.todos.filter((t) => t.done).length;
    const total = s.todos.length;
    const cards = [
      {
        label: "Hôm nay",
        value: D.formatMinutes(todayMinutes),
        icon: "clock",
        foot: diff === 0
          ? `Bằng hôm qua · mục tiêu ${s.profile.goalHours} giờ`
          : `<span class="${diff > 0 ? "up" : ""}">${diff > 0 ? icon("arrow-up") : "▼"} ${Math.abs(diffPct)}%</span> so với hôm qua`,
      },
      {
        label: "Chuỗi ngày",
        value: `${s.profile.streak} ngày`,
        icon: "flame",
        foot: todayMinutes > 0 ? "Hôm nay đã giữ chuỗi ✓" : "Học hôm nay để nối chuỗi",
      },
      {
        label: "Study Stars",
        value: s.profile.stars.toLocaleString("vi-VN"),
        icon: "star",
        foot: "Tổng Sao tích luỹ từ giờ học",
      },
      {
        label: "Việc cần làm",
        value: `${done}<small>/ ${total}</small>`,
        icon: "check-circle",
        foot: done === total ? "Đã hoàn thành tất cả 🎉" : `Còn ${total - done} việc hôm nay`,
      },
    ];

    const grid = document.getElementById("statGrid");
    grid.innerHTML = cards
      .map(
        (c) => `
        <article class="stat-card">
          <div class="stat-top">
            <span class="stat-label">${c.label}</span>
            <span class="stat-icon">${icon(c.icon)}</span>
          </div>
          <div class="stat-value">${c.value}</div>
          <div class="stat-foot">${c.foot}</div>
        </article>`
      )
      .join("");

    const railStreak = document.getElementById("railStreak");
    if (railStreak) railStreak.textContent = `${s.profile.streak} ngày`;
  }

  function renderFilters() {
    const wrap = document.getElementById("roomFilters");
    const used = [...new Set(Store.state.rooms.map((r) => r.subject))];
    const items = [{ id: "all", name: "Tất cả", color: "#eeeeeb" }, ...used.map((id) => subject(id))];
    wrap.innerHTML = items
      .map(
        (s) =>
          `<button class="chip${activeSubject === s.id ? " active" : ""}" data-filter="${s.id}">
             ${s.id !== "all" ? `<i style="width:6px;height:6px;border-radius:2px;background:${s.color}"></i>` : ""}
             ${escapeHTML(s.name)}
           </button>`
      )
      .join("");

    wrap.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeSubject = btn.dataset.filter;
        renderFilters();
        renderRooms();
      });
    });
  }

  function renderRooms() {
    const q = activeQuery.toLowerCase();
    const rooms = Store.state.rooms.filter((room) => {
      const okSubject = activeSubject === "all" || room.subject === activeSubject;
      const okQuery =
        !q ||
        room.name.toLowerCase().includes(q) ||
        room.host.toLowerCase().includes(q) ||
        (room.topic || "").toLowerCase().includes(q);
      return okSubject && okQuery && room.type !== "solo";
    });

    const grid = document.getElementById("roomGrid");
    const empty = document.getElementById("roomEmpty");
    document.getElementById("roomCount").textContent = `${rooms.length} phòng`;

    if (!rooms.length) {
      grid.innerHTML = "";
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    grid.innerHTML = rooms
      .map((room) => {
        const sub = subject(room.subject);
        const type = TYPE_INFO[room.type] || TYPE_INFO.community;
        const percent = Math.min(100, Math.round((room.joined / room.capacity) * 100));
        /* Người đã ở trong phòng (hoặc chủ phòng) vẫn vào được khi phòng đầy. */
        const canEnter = room.inRoom || room.mine;
        const unavailable = !room.live && !canEnter;
        const isFull = unavailable || (!canEnter && room.joined >= room.capacity);
        const people = membersFor(room, 4);
        return `
        <article class="room-card">
          <div class="room-card-top">
            <span class="room-subject" style="color:${sub.color}">
              <i style="background:${sub.color}"></i>${escapeHTML(sub.name)}
            </span>
            ${room.type !== "community" ? `<span class="tag">${icon(type.icon)} ${type.label}</span>` : ""}
            ${room.live ? '<span class="room-live"><i></i> LIVE</span>' : '<span class="room-live" style="color:var(--text-4)">SẮP MỞ</span>'}
          </div>
          <h3>${escapeHTML(room.name)}</h3>
          <div class="room-host">
            ${avatarHTML(room.hostEmoji || "", room.host)}
            <span>Chủ phòng: ${escapeHTML(room.host)}</span>
          </div>
          ${room.topic ? `<p style="font-size:11.5px;color:var(--text-3);line-height:1.55;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">${escapeHTML(room.topic)}</p>` : ""}
          <div class="room-capacity">
            <div class="cap-top">
              <span>Chỗ ngồi</span>
              <b>${room.joined} / ${room.capacity}</b>
            </div>
            <div class="bar${percent >= 85 ? " warn" : ""}"><span style="width:${percent}%"></span></div>
          </div>
          <div class="room-foot">
            <div class="avatar-stack">
              ${people.map(([name, emoji]) => avatarHTML(emoji, name)).join("")}
            </div>
            ${room.joined > people.length ? `<span class="more">+${room.joined - people.length}</span>` : ""}
            <a class="btn ${isFull ? "btn-soft" : "btn-accent"} btn-sm"
               href="${isFull ? "#" : `room.html?room=${encodeURIComponent(room.id)}`}"${isFull ? ' data-room-disabled="true" aria-disabled="true"' : ""}>
              ${unavailable ? "Sắp mở" : isFull ? "Đã đầy" : "Vào phòng"} ${!unavailable && !isFull ? icon("arrow-right") : ""}
            </a>
          </div>
        </article>`;
      })
      .join("");

    grid.querySelectorAll("[data-room-disabled]").forEach((link) => {
      link.addEventListener("click", (event) => event.preventDefault());
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Phòng của tôi                                                          */
  /* ---------------------------------------------------------------------- */

  function renderTodaySchedule() {
    const todayIdx = (new Date().getDay() + 6) % 7;
    const items = Store.state.schedule
      .filter((s) => s.day === todayIdx)
      .sort((a, b) => D.clockToMinutes(a.start) - D.clockToMinutes(b.start));

    const wrap = document.getElementById("todaySchedule");
    const count = document.getElementById("todayScheduleCount");
    if (count) count.innerHTML = `<span class="dot"></span> ${items.length} ca học`;
    if (!items.length) {
      wrap.innerHTML = `<div class="empty" style="padding:24px 10px">
        ${icon("calendar")}
        <span>Hôm nay chưa có ca học.<br><a href="planner.html" style="color:var(--accent)">Thêm một ca ngay →</a></span>
      </div>`;
      return;
    }

    wrap.innerHTML = `<div class="mini-schedule">${items
      .slice(0, 4)
      .map((item) => {
        const sub = subject(item.subject);
        const start = D.clockToMinutes(item.start);
        const end = start + item.duration;
        return `<div class="mini-slot">
          <time>${D.minutesToClock(start)}</time>
          <div class="info" style="--c:${sub.color}">
            <b>${escapeHTML(sub.name)} · ${escapeHTML(item.note || "Ca học")}</b>
            <span>${D.minutesToClock(start)} – ${D.minutesToClock(end)} · ${D.formatMinutes(item.duration)}</span>
          </div>
        </div>`;
      })
      .join("")}</div>`;
  }

  function renderFriends() {
    document.getElementById("friendsList").innerHTML =
      `<div class="empty" style="padding:18px 10px"><span>Chưa có thông tin bạn học đang trực tuyến.</span></div>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Create room                                                            */
  /* ---------------------------------------------------------------------- */

  function initCreateRoom() {
    const form = document.getElementById("createRoomForm");
    const select = document.getElementById("roomSubject");
    const picker = document.getElementById("typePicker");
    const hint = document.getElementById("roomTypeHint");

    select.value = "Toán";

    picker.querySelectorAll("[data-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        newRoomType = btn.dataset.type;
        picker.querySelectorAll("[data-type]").forEach((b) => b.classList.toggle("active", b === btn));
        hint.textContent = TYPE_INFO[newRoomType].hint;
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isGuestAccount()) {
        askRegister();
        return;
      }
      const nameEl = document.getElementById("roomName");
      const name = nameEl.value.trim();
      if (!name && newRoomType !== "solo") {
        nameEl.focus();
        toast("Hãy đặt tên cho phòng học.", "warning");
        return;
      }
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const room = await Store.createRoom({
          name,
          subject: subjectValue(select.value),
          type: newRoomType,
          topic: document.getElementById("roomTopic").value.trim(),
        });

        window.UI.closeModal("createRoomModal");

        if (room.type !== "community") {
          toast(`Đã tạo phòng ${D.roomTypeLabel(room.type).toLowerCase()} “${room.name}”. Đang mở phòng…`);
          setTimeout(() => {
            window.location.href = `room.html?room=${encodeURIComponent(room.id)}`;
          }, 550);
          return;
        }

        activeSubject = "all";
        activeQuery = "";
        renderFilters();
        renderRooms();
        form.reset();
        newRoomType = "community";
        picker.querySelectorAll("[data-type]").forEach((b) => b.classList.toggle("active", b.dataset.type === "community"));
        hint.textContent = TYPE_INFO.community.hint;
        toast(`Đã tạo “${room.name}”. Chia sẻ link để rủ bạn vào học!`);
      } catch (err) {
        toast(err.message || "Không tạo được phòng học. Vui lòng thử lại.", "danger");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  

  document.addEventListener("DOMContentLoaded", () => {
    renderGreeting();
    renderExam();
    renderStats();
    renderFilters();
    renderRooms();
    renderTodaySchedule();
    renderFriends();
    initCreateRoom();
    gateCreateRoomButton();

    const params = new URLSearchParams(location.search);
    if (params.get("q")) {
      activeQuery = params.get("q");
      renderRooms();
    }

    window.addEventListener("shell:search", (e) => {
      activeQuery = (e.detail || "").trim();
      renderRooms();
    });
  });
})();
