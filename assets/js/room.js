/* ==========================================================================
   StudyWithMe — Study room
   Không gian tập trung (không 2D): đồng hồ, thành viên, mục tiêu, tài liệu, chat.
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { icon, hydrateIcons, escapeHTML, avatarHTML, toast, copyText } = window.UI;

  const RING_C = 2 * Math.PI * 108;
  const params = new URLSearchParams(location.search);

  let room;
  let members = [];
  let isSolo = false;

  const timer = {
    mode: "countdown",
    total: 25 * 60,
    remain: 25 * 60,
    elapsed: 0,
    running: false,
    handle: null,
    preset: 25,
  };

  let focusSeconds = 0;
  let baseFocus = D.minutesForDay(new Date());
  let pendingFocus = 0;
  let focusHandle = null;
  let eventSource = null;
  let chatMessages = [];
  let lastSent = 0;
  let activePane = "chat";
  let hbRemain = 15 * 60;
  let hbHandle = null;

  const pad2 = (n) => String(n).padStart(2, "0");
  const subOf = (id) => {
    if (typeof id === "string" && id.startsWith("custom:")) {
      return { name: id.slice(7), color: "#959590" };
    }
    return D.SUBJECT_MAP[id] || { name: "Khác", color: "#959590" };
  };
  const nowClock = () => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const hash = (str) => [...String(str)].reduce((a, c) => a + c.charCodeAt(0), 0);

  function fmtTimer(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(r)}` : `${pad2(m)}:${pad2(r)}`;
  }

  function fmtHb(sec) {
    const s = Math.max(0, sec);
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  }

  /* ---------------------------------------------------------------------- */
  /* Resolve room                                                           */
  /* ---------------------------------------------------------------------- */

  /* Không có ?room: mở phòng cộng đồng đang mở đầu tiên. */
  /* Không có ?room: mở phòng gần đây, nếu không có thì mở phòng cộng đồng
     đang LIVE đầu tiên ("Vào một phòng mẫu" từ trang chủ). */
  function defaultRoomId() {
    const accountId = Store.account && Store.account.id ? Store.account.id : "guest";
    const lastId = localStorage.getItem(`studywithme.lastRoom.${accountId}`);
    if (lastId) {
      const last = (Store.state.rooms || []).find((room) => room.id === lastId);
      if (last && (last.type !== "solo" || last.mine)) return last.id;
    }
    const sample = (Store.state.rooms || []).find((room) => room.live && room.type === "community");
    return sample ? sample.id : null;
  }

  /* ---------------------------------------------------------------------- */
  /* Header                                                                 */
  /* ---------------------------------------------------------------------- */

  function renderHeader() {
    const profile = Store.state.profile;
    const sub = subOf(room.subject);
    const total = isSolo ? 1 : Math.max(1, members.length || room.joined || 1);

    document.getElementById("roomName").textContent = room.name;

    const pill = document.getElementById("roomTypePill");
    pill.innerHTML = `${icon(D.roomTypeIcon(room.type))} <span>${D.roomTypeLabel(room.type)}</span>`;
    hydrateIcons(pill);

    document.getElementById("roomSubjectMeta").innerHTML =
      `<span style="display:inline-flex;align-items:center;gap:5px">
        <i style="width:6px;height:6px;border-radius:2px;background:${sub.color};display:block"></i>
        ${escapeHTML(sub.name)}
      </span>`;

    document.getElementById("roomCapacityMeta").textContent = `${total} / ${room.capacity} chỗ`;
    document.getElementById("roomTopicMeta").textContent = room.topic || "Buổi học tập trung";
    document.getElementById("memberCount").textContent = `${total} / ${room.capacity}`;

    document.title = `${room.name} — StudyWithMe`;

    const invitePanel = document.getElementById("invitePanel");
    if (isSolo) invitePanel.classList.add("hidden");

    const meta = document.querySelector(".room-title .meta");
    if (meta) {
      const dots = meta.querySelectorAll(".dot");
      dots.forEach((d) => d.classList.toggle("hidden", !room.live));
    }

    if (room.host === profile.name) {
      document.getElementById("chatTitle").textContent = isSolo ? "Sổ nháp cá nhân" : "Chat nhóm";
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Members                                                                */
  /* ---------------------------------------------------------------------- */

  function buildMembers() {
    if (members.length) return;
    const profile = Store.state.profile;
    const total = isSolo ? 1 : Math.min(room.capacity, Math.max(1, room.joined || 1));
    const offset = hash(room.id) % D.MEMBER_POOL.length;
    const used = new Set();
    const list = [];

    for (let i = 0; i < total; i++) {
      const seat = i + 1;

      if (i === 0) {
        list.push({
          name: room.host,
          emoji: room.hostEmoji || "🌙",
          seat,
          status: "study",
          minutes: 45,
          host: true,
          me: room.host === profile.name,
        });
        continue;
      }

      if (i === 2 && room.host !== profile.name && !isSolo) {
        list.push({
          name: profile.name,
          emoji: profile.avatar,
          seat,
          status: "study",
          minutes: baseFocus,
          me: true,
        });
        continue;
      }

      let pick = null;
      for (let k = 0; k < D.MEMBER_POOL.length; k++) {
        const candidate = D.MEMBER_POOL[(offset + k + i) % D.MEMBER_POOL.length];
        if (!used.has(candidate[0]) && candidate[0] !== profile.name) {
          used.add(candidate[0]);
          pick = candidate;
          break;
        }
      }
      if (!pick) continue;

      const status = i % 6 === 0 ? "rest" : i % 9 === 0 ? "idle" : "study";
      list.push({
        name: pick[0],
        emoji: pick[1],
        seat,
        status,
        minutes: 15 + ((i * 17) % 85),
        host: false,
        me: false,
      });
    }

    members = list;
  }

  function ownCosmeticFrame() {
    const owned = Store.state.owned || [];
    return ["neon", "winter"].find((id) => owned.includes(id)) || "";
  }

  function initPet() {
    if (!(Store.state.owned || []).includes("cat")) return;
    const ring = document.querySelector(".ring-wrap");
    if (!ring || ring.querySelector(".study-pet")) return;
    const pet = document.createElement("span");
    pet.className = "study-pet";
    pet.textContent = "🐱";
    pet.title = "Mèo đồng hành của bạn";
    pet.setAttribute("aria-hidden", "true");
    ring.appendChild(pet);
  }

  function renderMembers() {
    const wrap = document.getElementById("membersList");
    const statusLabel = { study: "Đang học", rest: "Nghỉ 5 phút", idle: "Chờ vào" };
    const frame = ownCosmeticFrame();

    wrap.innerHTML = members
      .map(
        (m) => `<div class="member${m.me ? " me" : ""}">
          ${m.me && frame ? `<span class="cosmetic-wrap cosmetic-wrap--inline ${frame}">${avatarHTML(m.emoji, m.name)}</span>` : avatarHTML(m.emoji, m.name)}
          <div class="m-info">
            <b>${escapeHTML(m.name)}${m.me ? "<em>BẠN</em>" : ""}${m.host && !m.me ? "<em>CHỦ PHÒNG</em>" : ""}</b>
            <span class="${m.status}"><i></i>${statusLabel[m.status]} · ${D.formatMinutes(m.minutes)}</span>
          </div>
          <span class="seat">#${pad2(m.seat)}</span>
        </div>`
      )
      .join("");
  }

  /* ---------------------------------------------------------------------- */
  /* Goals                                                                  */
  /* ---------------------------------------------------------------------- */

  function renderGoals() {
    const wrap = document.getElementById("goalsList");
    const todos = [...Store.state.todos].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 6);

    if (!todos.length) {
      wrap.innerHTML = `<div class="todo-empty">Chưa có mục tiêu. Thêm một việc nhỏ bên dưới.</div>`;
      return;
    }

    wrap.innerHTML = todos
      .map((t) => {
        const s = subOf(t.subject);
        return `<div class="goal">
          <label class="check">
            <input type="checkbox" data-goal="${t.id}" ${t.done ? "checked" : ""}>
            <span class="box"></span>
            <span class="check-text">${escapeHTML(t.text)}</span>
          </label>
          <span class="tag" style="color:${s.color};border-color:${s.color}44">${s.name}</span>
        </div>`;
      })
      .join("");

    wrap.querySelectorAll("[data-goal]").forEach((input) => {
      input.addEventListener("change", () => {
        Store.update((s) => {
          const item = s.todos.find((t) => t.id === input.dataset.goal);
          if (item) item.done = input.checked;
        });
        if (input.checked) toast("Đã tick một mục tiêu. Đều đều là được.");
        renderGoals();
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Documents                                                              */
  /* ---------------------------------------------------------------------- */

  function renderDocs() {
    const wrap = document.getElementById("docList");
    const docs = (Store.state.docsByRoom && Store.state.docsByRoom[room.id]) || [];
    if (!docs.length) {
      wrap.innerHTML = `<div class="empty" style="padding:26px 14px">${icon("pin")}<span>Chưa có tài liệu nào được ghim.</span></div>`;
      return;
    }

    wrap.innerHTML = docs
      .map(
        (doc) => `<div class="doc">
          <span class="doc-ico">${icon(doc.icon || "file")}</span>
          <div class="doc-info">
            <b>${escapeHTML(doc.title)}</b>
            <span>${escapeHTML(doc.meta || "Tài liệu")}</span>
          </div>
          <div class="doc-actions">
            <button class="doc-open" data-doc-open="${doc.id}" aria-label="Mở tài liệu">${icon("external-link")}</button>
            ${doc.createdBy && Store.account && doc.createdBy === Store.account.id
              ? `<button class="doc-delete" data-doc-delete="${doc.id}" aria-label="Xóa tài liệu">${icon("trash")}</button>`
              : ""}
          </div>
        </div>`
      )
      .join("");

    wrap.querySelectorAll("[data-doc-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const doc = docs.find((d) => d.id === btn.dataset.docOpen);
        if (doc && doc.url) {
          window.open(doc.url, "_blank", "noopener");
          return;
        }
        toast("Tài liệu đã được ghim trên máy chủ. Bản xem trước trực tuyến sẽ sớm có mặt.");
      });
    });

    wrap.querySelectorAll("[data-doc-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const doc = docs.find((d) => d.id === btn.dataset.docDelete);
        if (!doc) return;
        if (!window.confirm(`Xóa tài liệu “${doc.title}”? Tất cả thành viên trong phòng sẽ không còn thấy tài liệu này.`)) return;
        btn.disabled = true;
        try {
          await Store.deleteDoc(room.id, doc.id);
          renderDocs();
          toast("Đã xóa tài liệu.");
        } catch (err) {
          btn.disabled = false;
          toast(err.message || "Không xóa được tài liệu.", "danger");
        }
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Timer                                                                  */
  /* ---------------------------------------------------------------------- */

  function timerDisplayValue() {
    if (timer.mode === "stopwatch") return fmtTimer(timer.elapsed);
    if (timer.mode === "countdown") return fmtTimer(timer.remain);
    return "25:00";
  }

  function renderTimer() {
    const display = document.getElementById("timerDisplay");
    const ring = document.getElementById("ringFg");
    const status = document.getElementById("timerStatus");
    const toggle = document.getElementById("timerToggle");
    const done = document.getElementById("timerDone");
    const label = document.getElementById("timerLabel");

    display.textContent = timerDisplayValue();
    ring.style.strokeDasharray = String(RING_C);

    let ratio;
    if (timer.mode === "stopwatch") {
      ratio = (timer.elapsed % (25 * 60)) / (25 * 60);
    } else {
      ratio = timer.total ? timer.remain / timer.total : 0;
    }
    ring.style.strokeDashoffset = String(RING_C * (1 - Math.max(0, Math.min(1, ratio))));

    status.classList.toggle("running", timer.running);
    if (timer.running) {
      status.innerHTML = "<i></i> Đang tập trung";
    } else if (timer.mode === "countdown" && timer.remain === 0) {
      status.innerHTML = "<i></i> Đã hoàn thành";
    } else if (timer.elapsed > 0) {
      status.innerHTML = "<i></i> Tạm dừng";
    } else {
      status.innerHTML = "<i></i> Sẵn sàng";
    }

    done.classList.toggle("hidden", !(timer.mode === "countdown" && timer.remain === 0));

    if (timer.running) {
      toggle.classList.remove("paused");
      toggle.innerHTML = `${icon("pause")} <span>Tạm dừng</span>`;
    } else {
      toggle.classList.add("paused");
      const text = timer.remain === 0 && timer.mode === "countdown" ? "Ca mới" : timer.elapsed > 0 ? "Tiếp tục" : "Bắt đầu";
      toggle.innerHTML = `${icon("play")} <span>${text}</span>`;
    }

    label.textContent =
      timer.mode === "countdown" ? `Ca tập trung ${timer.preset} phút` : "Đếm xuôi · không giới hạn";

    // local focus counters
    const focusMin = baseFocus + Math.floor(pendingFocus / 60);
    document.getElementById("todayFocus").textContent = D.formatMinutes(focusMin);
    document.getElementById("todayStars").textContent = `+${Math.floor(focusSeconds / 60)}`;
    const roomStreak = document.getElementById("roomStreak");
    if (roomStreak) roomStreak.textContent = `${Store.state.profile.streak || 0} ngày`;

    if (timer.running) {
      document.title = `${timerDisplayValue()} · ${room.name}`;
    }
  }

  function stopTicking() {
    if (timer.handle) clearInterval(timer.handle);
    timer.handle = null;
  }

  function flushFocus(keepalive) {
    const seconds = pendingFocus;
    if (seconds < 1) return;
    pendingFocus = 0;
    Store.sendFocus(seconds, room.id, keepalive).then((data) => {
      if (!data) return;
      baseFocus = data.todayMinutes;
      renderTimer();
    });
  }

  function startTimer() {
    if (timer.running) return;
    if (timer.mode === "countdown" && timer.remain <= 0) {
      timer.remain = timer.total;
      timer.elapsed = 0;
    }
    timer.running = true;
    renderTimer();
    saveTimerState();

    timer.handle = setInterval(() => {
      if (timer.mode === "countdown") {
        timer.remain = Math.max(0, timer.remain - 1);
        timer.elapsed++;
        focusSeconds++;
        pendingFocus++;
        if (timer.remain === 0) completeSession();
        else {
          saveTimerState();
          renderTimer();
        }
      } else {
        timer.elapsed++;
        focusSeconds++;
        pendingFocus++;
        saveTimerState();
        renderTimer();
      }
    }, 1000);
  }

  function pauseTimer() {
    timer.running = false;
    stopTicking();
    flushFocus();
    renderTimer();
    saveTimerState();
    document.title = `${room.name} — StudyWithMe`;
  }

  function resetTimer() {
    stopTicking();
    timer.running = false;
    flushFocus();
    timer.elapsed = 0;
    timer.remain = timer.total;
    document.title = `${room.name} — StudyWithMe`;
    renderTimer();
    saveTimerState();
    toast("Đã đặt lại đồng hồ.");
  }

  function completeSession() {
    stopTicking();
    timer.running = false;
    const minutes = Math.round(timer.total / 60);
    flushFocus();
    renderTimer();
    toast(`Hoàn thành ca ${minutes} phút! Giờ học và Study Stars đã được cộng vào tài khoản.`);
    document.title = `${room.name} — StudyWithMe`;
    saveTimerState();
  }

  function setMode(mode) {
    if (mode === timer.mode) return;
    pauseTimer();
    timer.mode = mode;
    timer.elapsed = 0;
    timer.remain = timer.total;
    document.querySelectorAll("#modeSeg [data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    renderTimer();
    saveTimerState();
  }

  function setPreset(mins) {
    pauseTimer();
    timer.mode = "countdown";
    timer.preset = mins;
    timer.total = mins * 60;
    timer.remain = timer.total;
    timer.elapsed = 0;
    document.querySelectorAll("#modeSeg [data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === "countdown"));
    document.querySelectorAll("#timerPresets [data-preset]").forEach((b) => b.classList.toggle("active", Number(b.dataset.preset) === mins));
    renderTimer();
    saveTimerState();
  }

  function timerStorageKey() {
    return `studywithme.timer.${room.id}`;
  }

  function saveTimerState() {
    try {
      localStorage.setItem(timerStorageKey(), JSON.stringify({
        mode: timer.mode,
        preset: timer.preset,
        total: timer.total,
        remain: timer.remain,
        elapsed: timer.elapsed,
        running: false,
      }));
    } catch (err) {
      /* Không ảnh hưởng học khi bộ nhớ trình duyệt bị chặn. */
    }
  }

  function loadTimerState() {
    try {
      const saved = JSON.parse(localStorage.getItem(timerStorageKey()) || "null");
      if (!saved || typeof saved !== "object") return;
      if (saved.mode === "stopwatch" || saved.mode === "countdown") timer.mode = saved.mode;
      if (Number.isFinite(saved.preset) && saved.preset > 0) timer.preset = Number(saved.preset);
      if (Number.isFinite(saved.total) && saved.total > 0) timer.total = Number(saved.total);
      if (Number.isFinite(saved.remain)) timer.remain = Math.max(0, Math.min(timer.total, Number(saved.remain)));
      if (Number.isFinite(saved.elapsed)) timer.elapsed = Math.max(0, Number(saved.elapsed));
      timer.running = false;
    } catch (err) {
      /* Bỏ qua dữ liệu timer cũ hoặc không hợp lệ. */
    }
  }

  function initTimer() {
    loadTimerState();
    document.getElementById("timerToggle").addEventListener("click", () => {
      if (timer.running) pauseTimer();
      else startTimer();
    });
    document.getElementById("timerReset").addEventListener("click", resetTimer);
    document.querySelectorAll("#timerPresets [data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => setPreset(Number(btn.dataset.preset)));
    });
    document.querySelectorAll("#modeSeg [data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => setMode(btn.dataset.mode));
    });
    renderTimer();
  }

  /* ---------------------------------------------------------------------- */
  /* Heartbeat                                                              */
  /* ---------------------------------------------------------------------- */

  function initHeartbeat() {
    const pill = document.getElementById("heartbeat");
    const time = document.getElementById("hbTimer");
    const confirm = document.getElementById("hbConfirm");
    const profile = Store.state.profile;

    if (!profile.heartbeat) {
      pill.classList.remove("warn");
      time.textContent = "đang tắt";
      confirm.classList.add("hidden");
      pill.querySelector("span:nth-child(2)").textContent = "Heartbeat đang tắt trong cài đặt";
      return;
    }

    const tick = () => {
      hbRemain = Math.max(0, hbRemain - 1);
      time.textContent = fmtHb(hbRemain);
      if (hbRemain === 0) {
        pill.classList.add("warn");
        time.textContent = "cần xác nhận";
        if (timer.running) pauseTimer();
        toast("Heartbeat hết hạn. Xác nhận để tiếp tục cộng giờ học.", "warning");
      }
    };
    hbHandle = setInterval(tick, 1000);

    confirm.addEventListener("click", () => {
      hbRemain = 15 * 60;
      time.textContent = fmtHb(hbRemain);
      pill.classList.remove("warn");
      toast("Đã xác nhận tương tác. Tiếp tục giữ nhịp nhé!");
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Chat                                                                   */
  /* ---------------------------------------------------------------------- */

  function scrollChat() {
    const wrap = document.getElementById("chatMessages");
    wrap.scrollTop = wrap.scrollHeight;
  }

  function renderMessages() {
    const wrap = document.getElementById("chatMessages");
    if (!wrap) return;
    const msgs = chatMessages;
    wrap.innerHTML =
      `<div class="chat-day">Gần đây · ${Math.max(1, members.length)} người trong phòng</div>` +
      msgs
        .map(
          (m) => `<div class="msg${m.me ? " me" : ""}">
            ${avatarHTML(m.emoji, m.author)}
            <div class="bubble-wrap">
              <div class="who"><b>${escapeHTML(m.author)}</b><time>${escapeHTML(m.time)}</time></div>
              <div class="bubble">${escapeHTML(m.text)}</div>
            </div>
          </div>`
        )
        .join("");
    scrollChat();
  }

  function pushMessage(msg) {
    if (!msg || !msg.id) return;
    // Store.sendMessage đã đẩy tin nhắn vào cùng mảng state.messagesByRoom,
    // nên có thể tin nhắn đã có sẵn — vẫn phải vẽ lại giao diện.
    if (!chatMessages.some((item) => item.id === msg.id)) chatMessages.push(msg);
    if (chatMessages.length > 120) chatMessages = chatMessages.slice(-120);
    renderMessages();
  }

  function connectEvents() {
    if (isSolo || !window.EventSource) return;
    try {
      eventSource = new EventSource(`/api/events?room=${encodeURIComponent(room.id)}`);
    } catch (err) {
      return;
    }

    eventSource.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.userId && Store.account && msg.userId === Store.account.id) return;
        pushMessage(msg);
      } catch (err) {
        /* bỏ qua sự kiện hỏng */
      }
    });

    eventSource.addEventListener("presence", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!Array.isArray(data.members) || !data.members.length) return;
        members = data.members;
        renderMembers();
        document.getElementById("memberCount").textContent = `${members.length} / ${room.capacity}`;
        document.getElementById("roomCapacityMeta").textContent = `${members.length} / ${room.capacity} chỗ`;
      } catch (err) {
        /* bỏ qua */
      }
    });

    /* Chủ phòng bấm "Giải tán nhóm" — mọi người được đưa về Sảnh chính. */
    eventSource.addEventListener("closed", () => {
      toast("Chủ phòng đã giải tán nhóm này.", "warning");
      setTimeout(() => (window.location.href = "dashboard.html"), 900);
    });

    eventSource.addEventListener("focus", (event) => {
      try {
        const data = JSON.parse(event.data);
        const member = members.find((m) => m.id === data.userId);
        if (member && typeof data.todayMinutes === "number") {
          member.minutes = data.todayMinutes;
          renderMembers();
        }
      } catch (err) {
        /* bỏ qua */
      }
    });
  }

  function initChat() {
    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (isSolo) return;
      const text = input.value.trim();
      if (!text) return;

      const now = Date.now();
      if (now - lastSent < 1000) {
        toast("Chậm một chút — giới hạn 1 tin nhắn mỗi giây.", "warning");
        return;
      }
      lastSent = now;
      input.value = "";

      try {
        const message = await Store.sendMessage(room.id, text);
        pushMessage(message);
      } catch (err) {
        input.value = text;
        lastSent = 0;
        toast(err.message || "Không gửi được tin nhắn.", "danger");
      }
    });
  }

  function setPane(pane) {
    activePane = pane;
    const chatMessages = document.getElementById("chatMessages");
    const notebook = document.getElementById("notebookPane");
    const chatForm = document.getElementById("chatForm");
    const title = document.getElementById("chatTitle");

    if (isSolo) pane = "note";

    document.querySelectorAll("#chatSeg [data-pane]").forEach((b) => {
      b.classList.toggle("active", b.dataset.pane === pane);
    });

    const noteOn = pane === "note";
    chatMessages.classList.toggle("hidden", noteOn);
    notebook.classList.toggle("hidden", !noteOn);
    chatForm.classList.toggle("hidden", noteOn);
    title.textContent = noteOn ? (isSolo ? "Sổ nháp cá nhân" : "Sổ nháp") : "Chat nhóm";

    if (noteOn) document.getElementById("notebookArea").focus({ preventScroll: true });
  }

  function initNotebook() {
    const area = document.getElementById("notebookArea");
    const count = document.getElementById("noteCount");
    const saved = document.getElementById("noteSaved");
    let saveHandle = null;

    const key = room.id;
    area.value = Store.state.notebooks[key] || "";
    const updateCount = () => {
      const words = area.value.trim() ? area.value.trim().split(/\s+/).length : 0;
      count.textContent = `${words} từ`;
    };
    updateCount();

    area.addEventListener("input", () => {
      updateCount();
      saved.textContent = "Đang lưu…";
      clearTimeout(saveHandle);
      saveHandle = setTimeout(() => {
        Store.update((s) => {
          s.notebooks[key] = area.value;
        });
        saved.innerHTML = `${icon("check")} Đã lưu`;
        hydrateIcons(saved);
      }, 450);
    });

    document.querySelectorAll("#chatSeg [data-pane]").forEach((btn) => {
      btn.addEventListener("click", () => setPane(btn.dataset.pane));
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Docs modal                                                             */
  /* ---------------------------------------------------------------------- */

  function initDocModal() {
    const form = document.getElementById("docForm");
    document.getElementById("addDocBtn").addEventListener("click", () => window.UI.openModal("docModal"));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById("docFile");
      const file = fileInput.files && fileInput.files[0];
      const titleInput = document.getElementById("docName");
      const title = titleInput.value.trim() || (file ? file.name : "");
      const metaInput = document.getElementById("docMeta");
      const meta = metaInput.value.trim() || (file ? `${file.type || "Tệp"} · ${Math.max(1, Math.round(file.size / 1024))} KB` : "Tài liệu");
      const url = document.getElementById("docUrl").value.trim();
      if (!title) {
        titleInput.focus();
        toast("Hãy đặt tên tài liệu hoặc chọn một tệp.", "warning");
        return;
      }
      if (!file && !url) {
        toast("Hãy chọn tệp hoặc nhập liên kết tài liệu.", "warning");
        return;
      }

      const submit = form.querySelector('[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        if (file) {
          const formData = new FormData();
          formData.append("title", title);
          formData.append("meta", meta);
          formData.append("url", url);
          formData.append("file", file);
          await Store.addDoc(room.id, formData);
        } else {
          await Store.addDoc(room.id, { title, meta, url });
        }
        window.UI.closeModal("docModal");
        form.reset();
        renderDocs();
        toast("Đã ghim tài liệu lên bảng chung.");
      } catch (err) {
        toast(err.message || "Không ghim được tài liệu.", "danger");
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Misc UI                                                                */
  /* ---------------------------------------------------------------------- */

  function initMisc() {
    const link = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}room.html?room=${encodeURIComponent(room.id)}`;
    document.getElementById("inviteLink").value = isSolo ? "Phòng cá nhân — không có link mời" : link;

    const invite = () => {
      if (isSolo) {
        toast("Phòng Cá nhân không thể mời người khác.", "warning");
        return;
      }
      copyText(link, "Đã sao chép link mời. Gửi cho bạn của bạn nhé!");
    };

    document.getElementById("inviteBtn").addEventListener("click", invite);
    document.getElementById("copyInvite").addEventListener("click", invite);

    document.getElementById("goalForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("goalInput");
      const text = input.value.trim();
      if (!text) return;
      Store.update((s) => {
        s.todos.push({ id: `t-${Date.now()}`, text, subject: room.subject, done: false });
      });
      input.value = "";
      renderGoals();
      toast("Đã thêm mục tiêu cho buổi học.");
    });

    document.getElementById("membersToggle").addEventListener("click", () => {
      const col = document.getElementById("membersCol");
      col.classList.toggle("mobile-open");
      col.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    document.querySelectorAll("[data-scroll]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = document.getElementById(btn.dataset.scroll);
        if (!target) return;
        document.querySelectorAll("[data-scroll]").forEach((b) => b.classList.toggle("active", b === btn));
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* "Rời phòng" với thành viên, "Giải tán nhóm"/"Xoá phòng" với chủ phòng. */
  function initRoomActions() {
    const btn = document.getElementById("leaveRoomBtn");
    if (!btn) return;

    const isHost = Boolean(room.mine);
    const label = isHost ? (room.type === "solo" ? "Xoá phòng" : "Giải tán nhóm") : "Rời phòng";
    btn.innerHTML = `${icon(isHost ? "trash" : "logout")} <span>${label}</span>`;
    if (isHost) btn.classList.add("btn-danger");

    btn.addEventListener("click", async () => {
      const question = isHost
        ? `Giải tán “${room.name}”? Tin nhắn, tài liệu và sổ nháp của phòng sẽ bị xoá với tất cả mọi người.`
        : `Rời khỏi “${room.name}”? Phòng sẽ biến mất khỏi “Phòng của tôi” cho tới khi bạn vào lại.`;
      if (!window.confirm(question)) return;

      btn.disabled = true;
      /* Đóng SSE trước: nếu để mở, EventSource tự kết nối lại và phòng vừa
         rời sẽ được tham gia lại ngay lập tức. */
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (focusHandle) {
        clearInterval(focusHandle);
        focusHandle = null;
      }
      try {
        if (isHost) await Store.closeRoom(room.id);
        else await Store.leaveRoom(room.id);
        try {
          const accountId = Store.account && Store.account.id ? Store.account.id : "guest";
          if (localStorage.getItem(`studywithme.lastRoom.${accountId}`) === room.id) {
            localStorage.removeItem(`studywithme.lastRoom.${accountId}`);
          }
        } catch (err) {
          /* Không cản điều hướng sau rời hoặc giải tán. */
        }
        toast(isHost ? "Đã giải tán phòng." : "Đã rời phòng.");
        setTimeout(() => (window.location.href = "dashboard.html"), 450);
      } catch (err) {
        btn.disabled = false;
        toast(err.message || "Không thực hiện được. Vui lòng thử lại.", "danger");
      }
    });
  }

  /* ---------------------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", async () => {
    /* Khách (chưa đăng ký) không được vào phòng — mở thẳng bảng Đăng ký ngay
       trên trang phòng. Đăng ký/đăng nhập thành công sẽ về Sảnh chính theo
       redirect mặc định; đóng bảng mà chưa đăng ký thì về trang chủ. */
    if (!(Store.account && Store.account.isGuest === false)) {
      const modal = document.getElementById("authModal");
      if (window.UI && window.UI.openAuth && modal) {
        window.UI.openAuth("register");
        const watcher = new MutationObserver(() => {
          if (modal.getAttribute("aria-hidden") !== "true") return;
          watcher.disconnect();
          /* Đã đăng ký/đăng nhập thành công: ui.js sẽ tự về Sảnh chính. */
          if (modal.dataset.authDone === "1") return;
          if (!(Store.account && Store.account.isGuest === false)) {
            window.location.href = "index.html";
          }
        });
        watcher.observe(modal, { attributes: true, attributeFilter: ["aria-hidden"] });
      } else {
        window.location.href = "index.html";
      }
      return;
    }

    const typeParam = params.get("type");
    let roomId = params.get("room");

    if (!roomId && typeParam === "solo") {
      try {
        const created = await Store.createRoom({
          type: "solo",
          subject: "toan",
          name: `Phòng của ${Store.state.profile.name.split(" ").slice(-1)[0]}`,
          topic: "Không gian riêng — không ai làm phiền",
        });
        roomId = created.id;
        history.replaceState(null, "", `room.html?room=${encodeURIComponent(created.id)}`);
      } catch (err) {
        toast(err.message || "Không mở được phòng cá nhân.", "danger");
        setTimeout(() => (window.location.href = "dashboard.html"), 1100);
        return;
      }
    }

    if (!roomId) {
      roomId = defaultRoomId();
      if (!roomId) {
        toast("Chưa có phòng nào để mở. Hãy tạo một phòng mới.", "warning");
        window.location.replace("dashboard.html");
        return;
      }
    }

    /* Luôn mở đúng phòng trong ?room — kể cả phòng Nhóm mình chưa tham gia
       (mở bằng link mời). Trước đây id không có trong danh sách bị thay bằng
       một phòng khác nên link mời không mở đúng phòng. */
    room = null;
    isSolo = typeParam === "solo";

    try {
      const data = await Store.loadRoom(roomId);
      room = data.room;
      members = data.members || [];
      chatMessages = data.messages || [];
      isSolo = room.type === "solo";
      try {
        const accountId = Store.account && Store.account.id ? Store.account.id : "guest";
        localStorage.setItem(`studywithme.lastRoom.${accountId}`, room.id);
        localStorage.removeItem("studywithme.lastRoom");
      } catch (err) {
        /* Không cản việc vào phòng nếu localStorage bị chặn. */
      }
    } catch (err) {
      toast(err.message || "Không vào được phòng học.", "danger");
      setTimeout(() => (window.location.href = "dashboard.html"), 1200);
      return;
    }

    renderHeader();
    buildMembers();
    renderMembers();
    initPet();
    renderGoals();
    renderDocs();
    initTimer();
    initHeartbeat();
    initMisc();
    initRoomActions();

    initChat();
    initNotebook();
    initDocModal();

    renderMessages();
    connectEvents();

    if (isSolo) {
      document.getElementById("chatSeg").classList.add("hidden");
      setPane("note");
      document.getElementById("chatInput").placeholder = "Sổ nháp cá nhân…";
      document.querySelector(".chat-hint").innerHTML = `${icon("lock")} Phòng cá nhân không mở kết nối thời gian thực`;
      hydrateIcons(document.querySelector(".chat-hint"));
    }

    focusHandle = setInterval(() => flushFocus(), 30000);

    // Ghi nhận phần giờ học còn lại khi rời trang
    window.addEventListener("beforeunload", () => {
      stopTicking();
      if (hbHandle) clearInterval(hbHandle);
      if (focusHandle) clearInterval(focusHandle);
      if (eventSource) eventSource.close();
      flushFocus(true);
    });
  });
})();
