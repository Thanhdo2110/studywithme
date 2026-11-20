/* ==========================================================================
   StudyWithMe — dữ liệu + store đồng bộ với API
   - Bootstrap do server sinh tại /api/bootstrap.js (window.__SWM_BOOTSTRAP__)
   - Mọi thay đổi được ghi qua REST API; UI vẫn đọc Store.state đồng bộ
   - Nếu mở trực tiếp bằng file:// sẽ dùng dữ liệu mẫu chỉ-đọc (chế độ offline)
   ========================================================================== */

(function () {
  "use strict";

  const DAY = 86400000;
  const STORAGE_KEY = "studywithme.v1";
  const BOOT = window.__SWM_BOOTSTRAP__ || null;

  const SUBJECT_PALETTE = {
    toan: { dark: "#6ad86c", light: "#2b7f3c" },
    ly: { dark: "#7aa2f7", light: "#2f6fd0" },
    hoa: { dark: "#e39ad4", light: "#a8478f" },
    anh: { dark: "#e9b949", light: "#8a6410" },
    van: { dark: "#f0926a", light: "#b34d24" },
    dgnl: { dark: "#9a8cf7", light: "#6247c4" },
  };

  const themeAtLoad = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

  const SUBJECTS = [
    { id: "toan", name: "Toán", color: SUBJECT_PALETTE.toan[themeAtLoad] },
    { id: "ly", name: "Vật lý", color: SUBJECT_PALETTE.ly[themeAtLoad] },
    { id: "hoa", name: "Hóa học", color: SUBJECT_PALETTE.hoa[themeAtLoad] },
    { id: "anh", name: "Tiếng Anh", color: SUBJECT_PALETTE.anh[themeAtLoad] },
    { id: "van", name: "Ngữ văn", color: SUBJECT_PALETTE.van[themeAtLoad] },
    { id: "dgnl", name: "ĐGNL", color: SUBJECT_PALETTE.dgnl[themeAtLoad] },
  ];

  const SUBJECT_MAP = SUBJECTS.reduce((acc, s) => ((acc[s.id] = s), acc), {});

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const startOfToday = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const parseISO = (s) => {
    const [y, m, d] = String(s).split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mockMinutes(date) {
    const seed = Math.floor(date.getTime() / DAY) + 911;
    const rnd = mulberry32(seed);
    const wd = date.getDay();
    const base = wd === 0 || wd === 6 ? 168 : 108;
    let m = Math.round(base + rnd() * 118 - 34);
    if (rnd() < 0.08) m = 0;
    const diff = Math.round((startOfToday().getTime() - date.getTime()) / DAY);
    if (diff >= 0 && diff < 12 && m < 40) m = 42 + Math.floor(rnd() * 30);
    return Math.max(0, Math.min(298, m));
  }

  function weekDates(offset = 0) {
    const today = startOfToday();
    const dow = (today.getDay() + 6) % 7;
    const monday = addDays(today, -dow + offset * 7);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }

  const todayISO = iso(startOfToday());

  const MEMBER_POOL = [
    ["Minh Anh", "🌙"], ["Bảo Nam", "🐧"], ["Khánh Linh", "🌿"], ["Gia Huy", "⚡"],
    ["Thu Trang", "🍊"], ["Đức Anh", "🦉"], ["Ngọc Mai", "🌸"], ["Hoàng Long", "🐯"],
    ["Phương Thảo", "☁️"], ["Tuấn Kiệt", "🚀"], ["Hà My", "🫧"], ["Quang Hưng", "🎧"],
    ["Yến Nhi", "🍋"], ["Trung Hiếu", "🧩"], ["Lê Vy", "🌷"], ["Đông Nghi", "🪐"],
    ["Việt Dũng", "🏀"], ["Thanh Hà", "🍵"], ["Công Minh", "🐨"], ["Ánh Tuyết", "❄️"],
  ];

  /* Dữ liệu mẫu cho chế độ mở trực tiếp file:// (không có server) ---------- */

  const DEFAULT_ROOMS = [
    { id: "toan-12-ham-so", name: "Ôn Toán 12 · Chuyên đề Hàm số", subject: "toan", type: "community", host: "Minh Anh", hostEmoji: "🌙", capacity: 20, joined: 14, topic: "Luyện 50 câu cực trị & tương giao đồ thị", live: true },
    { id: "ly-12-song-co", name: "Vật lý · Sóng cơ & Điện xoay chiều", subject: "ly", type: "community", host: "Gia Huy", hostEmoji: "⚡", capacity: 20, joined: 19, topic: "Chữa đề giữa kỳ, tập trung phần sóng dừng", live: true },
    { id: "hoa-huu-co", name: "Hóa hữu cơ · Cấp tốc 45 phút", subject: "hoa", type: "community", host: "Khánh Linh", hostEmoji: "🌿", capacity: 20, joined: 8, topic: "Dãy đồng đẳng, este và bài tập đốt cháy", live: true },
    { id: "dgnl-doc-hieu", name: "Luyện đề ĐGNL · Đọc hiểu", subject: "dgnl", type: "community", host: "Thu Trang", hostEmoji: "🍊", capacity: 20, joined: 11, topic: "20 câu đọc hiểu, chữa kỹ lỗi suy luận", live: true },
    { id: "anh-writing", name: "Tiếng Anh · Writing Task 2", subject: "anh", type: "group", host: "Ngọc Mai", hostEmoji: "🌸", capacity: 8, joined: 5, topic: "Viết 2 bài argument essay, chữa chéo", live: true },
    { id: "van-nghi-luan", name: "Ngữ văn · Nghị luận xã hội", subject: "van", type: "community", host: "Hà My", hostEmoji: "🫧", capacity: 20, joined: 9, topic: "Lập dàn ý cho 3 đề thi thử", live: false },
  ];

  const DEFAULT_TODOS = [
    { id: "t1", text: "Giải 20 câu cực trị hàm số", subject: "toan", done: true },
    { id: "t2", text: "Ôn lại bảng biến thiên & tiệm cận", subject: "toan", done: true },
    { id: "t3", text: "Làm đề sóng cơ 40 câu", subject: "ly", done: false },
    { id: "t4", text: "Học thuộc dãy đồng đẳng este", subject: "hoa", done: false },
    { id: "t5", text: "Viết lại 5 câu Writing Task 2", subject: "anh", done: false },
    { id: "t6", text: "Đọc 2 bài nghị luận mẫu", subject: "van", done: true },
    { id: "t7", text: "Luyện 30 câu logic ĐGNL", subject: "dgnl", done: false },
  ];

  const DEFAULT_SCHEDULE = [
    { id: "s1", day: 0, start: "19:00", duration: 90, subject: "toan", note: "Hàm số & đồ thị" },
    { id: "s2", day: 0, start: "20:40", duration: 60, subject: "ly", note: "Sóng cơ" },
    { id: "s3", day: 1, start: "18:30", duration: 60, subject: "hoa", note: "Este – lipit" },
    { id: "s4", day: 1, start: "20:00", duration: 90, subject: "toan", note: "Luyện đề 90 phút" },
    { id: "s5", day: 2, start: "19:00", duration: 60, subject: "anh", note: "Writing Task 2" },
    { id: "s6", day: 2, start: "20:20", duration: 60, subject: "dgnl", note: "Đọc hiểu" },
    { id: "s7", day: 3, start: "19:30", duration: 60, subject: "van", note: "Nghị luận xã hội" },
    { id: "s8", day: 4, start: "18:00", duration: 120, subject: "toan", note: "Đề minh họa 2026" },
    { id: "s9", day: 4, start: "20:30", duration: 60, subject: "ly", note: "Điện xoay chiều" },
    { id: "s10", day: 5, start: "08:00", duration: 120, subject: "dgnl", note: "Thi thử trên máy" },
    { id: "s11", day: 5, start: "14:00", duration: 90, subject: "anh", note: "Listening + Writing" },
    { id: "s12", day: 6, start: "09:00", duration: 90, subject: "hoa", note: "Tổng ôn hữu cơ" },
    { id: "s13", day: 6, start: "19:00", duration: 60, subject: "toan", note: "Chữa lỗi sai" },
  ];

  const DEFAULT_DOCS = [
    { id: "d1", title: "Đề minh họa 2026 — Bộ GD&ĐT", meta: "PDF · 2.4 MB", icon: "file" },
    { id: "d2", title: "Công thức trọng tâm cần nhớ", meta: "Ghi chú · 12 phút đọc", icon: "book" },
    { id: "d3", title: "Checklist ôn thi 30 ngày cuối", meta: "Bảng tính", icon: "file" },
  ];

  const DEFAULT_MESSAGES = [
    { id: "m1", author: "Minh Anh", emoji: "🌙", time: "19:02", text: "Mọi người bắt đầu ca 50/10 nhé, mình bật đồng hồ trước 🔥" },
    { id: "m2", author: "Bảo Nam", emoji: "🐧", time: "19:03", text: "Ok, mình đang mở đề Toán, ai cần chữa câu nào cứ gửi lên." },
    { id: "m3", author: "Khánh Linh", emoji: "🌿", time: "19:04", text: "Cho mình xin link đề minh họa với, mình vào sau 2 phút." },
    { id: "m4", author: "Minh Anh", emoji: "🌙", time: "19:04", text: "Mình ghim ở bảng tài liệu bên trái rồi nha." },
  ];

  const SHOP_FALLBACK = [
    { id: "winter", name: "Khung Mùa đông", icon: "❄️", price: 400, desc: "Tuyết rơi quanh avatar" },
    { id: "cat", name: "Mèo đồng hành", icon: "🐱", price: 800, desc: "Thú cưng ngồi cạnh khi học" },
    { id: "neon", name: "Khung Neon", icon: "✨", price: 250, desc: "Viền phát sáng dịu mắt" },
  ];

  function fallbackDaily() {
    const daily = {};
    for (let i = 0; i < 400; i++) {
      const date = addDays(startOfToday(), -i);
      daily[iso(date)] = mockMinutes(date);
    }
    return daily;
  }

  function emptyGarden() {
    return { plant: null, pet: null, plants: {}, pets: {} };
  }

  function normalizeGarden(raw) {
    const garden = emptyGarden();
    if (!raw || typeof raw !== "object") return garden;
    if (typeof raw.plant === "string") garden.plant = raw.plant;
    if (typeof raw.pet === "string") garden.pet = raw.pet;
    ["plants", "pets"].forEach((key) => {
      const source = raw[key];
      if (!source || typeof source !== "object") return;
      Object.keys(source).forEach((id) => {
        const level = Number(source[id]);
        /* Cấp tối đa = 6, khớp với GARDEN_MAX_LEVEL của server và MAX_LEVEL
           của garden.js. Kẹp sai về 5 sẽ làm đồng hành cấp 6 tụt cấp mỗi khi
           tải lại trang. */
        if (Number.isFinite(level) && level >= 1) garden[key][id] = Math.min(6, Math.floor(level));
      });
    });
    return garden;
  }

  function fallbackState() {
    const daily = {};
    const totalFocus = 0;
    return {
      profile: {
        name: "Khách",
        grade: "",
        exam: "",
        examDate: "",
        targetSchool: "",
        goalHours: 4,
        avatar: "🦊",
        accent: "green",
        theme: "light",
        bio: "",
        stars: 0,
        streak: 0,
        reminders: true,
        sounds: true,
        heartbeat: true,
      },
      rooms: DEFAULT_ROOMS.map((r) => ({ ...r })),
      myRooms: [],
      todos: [],
      schedule: [],
      docsByRoom: { "toan-12-ham-so": DEFAULT_DOCS.map((d) => ({ ...d })) },
      messagesByRoom: { "toan-12-ham-so": DEFAULT_MESSAGES.map((m) => ({ ...m })) },
      notebooks: {},
      owned: [],
      garden: emptyGarden(),
      shop: SHOP_FALLBACK,
      totalFocus,
      daily,
      bySubject: {},
      hours: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      todayMinutes: 0,
      offline: true,
      account: { id: "offline", email: null, name: "Khách", isGuest: true },
    };
  }

  function normalize(raw) {
    const base = fallbackState();
    if (!raw || typeof raw !== "object") return base;
    const state = {
      ...base,
      ...raw,
      profile: { ...base.profile, ...(raw.profile || {}) },
      todos: Array.isArray(raw.todos) ? raw.todos : base.todos,
      schedule: Array.isArray(raw.schedule) ? raw.schedule : base.schedule,
      rooms: Array.isArray(raw.rooms) ? raw.rooms : base.rooms,
      myRooms: Array.isArray(raw.myRooms) ? raw.myRooms : base.myRooms,
      notebooks: raw.notebooks || {},
      docsByRoom: raw.docsByRoom || {},
      owned: Array.isArray(raw.owned) ? raw.owned : [],
      garden: normalizeGarden(raw.garden),
      daily: raw.daily || {},
      bySubject: raw.bySubject || {},
      hours: Array.isArray(raw.hours) ? raw.hours : base.hours,
      shop: Array.isArray(raw.shop) && raw.shop.length ? raw.shop : SHOP_FALLBACK,
      offline: false,
    };
    state.profile.reminders = Boolean(state.profile.reminders);
    state.profile.sounds = Boolean(state.profile.sounds);
    state.profile.heartbeat = Boolean(state.profile.heartbeat);
    return state;
  }

  function mirrorProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile }));
    } catch (err) {
      /* chế độ riêng tư có thể chặn localStorage */
    }
  }

  const state = normalize(BOOT && BOOT.state);
  const account = (BOOT && BOOT.account) || state.account || { id: "offline", isGuest: true };

  /* Chỉ gửi lên server những sổ nháp thực sự thay đổi — tránh đẩy toàn bộ
     nội dung mọi phòng trong mỗi lần lưu. */
  const notebookSnapshot = { ...(state.notebooks || {}) };
  function resetNotebookSnapshot() {
    Object.keys(notebookSnapshot).forEach((key) => delete notebookSnapshot[key]);
    Object.assign(notebookSnapshot, state.notebooks || {});
  }
  function dirtyNotebooks() {
    const out = {};
    const current = state.notebooks || {};
    Object.keys(current).forEach((roomId) => {
      if (notebookSnapshot[roomId] !== current[roomId]) out[roomId] = current[roomId];
    });
    return out;
  }

  // Áp dụng giao diện ngay khi store khởi động để tránh nháy màu.
  document.documentElement.dataset.theme = state.profile.theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.accent = state.profile.accent || "green";
  mirrorProfile(state.profile);

  /* ------------------------------------------------------------------------ */
  /* API helpers                                                              */
  /* ------------------------------------------------------------------------ */

  let offlineWarned = false;

  async function api(path, options = {}) {
    if (!window.fetch || options.offline) {
      throw new Error("Không có kết nối tới máy chủ StudyWithMe.");
    }
    const opts = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: {},
    };
    if (options.keepalive) opts.keepalive = true;
    if (options.body !== undefined) {
      if (typeof FormData !== "undefined" && options.body instanceof FormData) {
        opts.body = options.body;
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(options.body);
      }
    }
    const res = await fetch(path, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (!res.ok) {
      const error = new Error((data && data.error) || "Máy chủ không phản hồi. Vui lòng thử lại.");
      error.status = res.status;
      error.code = data && data.code;
      throw error;
    }
    return data;
  }

  function reportError(err) {
    if (!err) return;
    if (window.console) console.warn("[StudyWithMe]", err);
    if (err.code === "REGISTRATION_REQUIRED") {
      /* Khách bị chặn tạo/vào phòng: đưa thẳng vào bảng Đăng ký. */
      if (window.UI && window.UI.openAuth) window.UI.openAuth("register");
      return;
    }
    if (err.status === 401) {
      if (window.UI && window.UI.toast) window.UI.toast("Phiên đăng nhập đã hết hạn. Hãy tải lại trang.", "warning");
      return;
    }
    if (!offlineWarned && window.UI && window.UI.toast) {
      offlineWarned = true;
      window.UI.toast(err.message || "Không lưu được thay đổi.", "danger");
      setTimeout(() => (offlineWarned = false), 4000);
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Store                                                                    */
  /* ------------------------------------------------------------------------ */

  let persistTimer = null;
  let version = 0;
  let pendingVersion = 0;

  function profilePayload() {
    const p = state.profile;
    return {
      name: p.name,
      grade: p.grade,
      exam: p.exam,
      examDate: p.examDate,
      targetSchool: p.targetSchool,
      currentSchool: p.currentSchool,
      gender: p.gender,
      goalHours: p.goalHours,
      avatar: p.avatar,
      accent: p.accent,
      theme: p.theme,
      bio: p.bio,
      reminders: p.reminders,
      sounds: p.sounds,
      heartbeat: p.heartbeat,
    };
  }

  function applySaved(saved) {
    if (!saved) return;
    if (saved.profile) {
      const keep = state.profile;
      state.profile = { ...keep, ...saved.profile };
      mirrorProfile(state.profile);
    }
    if (Array.isArray(saved.todos)) state.todos = saved.todos;
    if (Array.isArray(saved.schedule)) state.schedule = saved.schedule;
    if (window.Shell) window.Shell.refresh();
  }

  const Store = {
    state,
    account,
    get online() {
      return !state.offline;
    },
    get shop() {
      return state.shop || SHOP_FALLBACK;
    },

    /* Ghi thay đổi vào server (gộp nhiều thao tác trong ~180ms) */
    save() {
      this.persist();
    },

    update(fn) {
      fn(this.state);
      this.persist();
    },

    persist(immediate) {
      if (state.offline) {
        mirrorProfile(state.profile);
        return;
      }
      mirrorProfile(state.profile);
      version += 1;
      pendingVersion = version;
      if (persistTimer) clearTimeout(persistTimer);
      const flush = () => {
        persistTimer = null;
        const target = pendingVersion;
        const notebooks = dirtyNotebooks();
        const payload = {
          profile: profilePayload(),
          todos: state.todos,
          schedule: state.schedule,
        };
        if (Object.keys(notebooks).length) payload.notebooks = notebooks;
        api("/api/me/state", { method: "PUT", body: payload })
          .then((saved) => {
            Object.assign(notebookSnapshot, notebooks);
            if (target === pendingVersion) applySaved(saved);
          })
          .catch(reportError);
      };
      if (immediate) flush();
      else persistTimer = setTimeout(flush, 180);
    },

    /* Làm mới state từ server (sau khi đổi tab / focus) */
    async refresh() {
      if (state.offline) return null;
      try {
        const data = await api("/api/me");
        if (data && data.state) {
          Object.assign(state, normalize(data.state));
          this.account = data.account || account;
          mirrorProfile(state.profile);
          resetNotebookSnapshot();
        }
        return data;
      } catch (err) {
        reportError(err);
        return null;
      }
    },

    /* Phòng học ---------------------------------------------------------- */
    async createRoom(payload) {
      const data = await api("/api/rooms", { method: "POST", body: payload });
      const room = data.room;
      const index = state.rooms.findIndex((r) => r.id === room.id);
      if (index >= 0) state.rooms[index] = room;
      else state.rooms.unshift(room);
      this.upsertMyRoom(room);
      return room;
    },

    /* Ghi một phòng vào "Phòng của tôi" ngay sau khi tạo/vào phòng, để danh
       sách đúng mà không cần gọi thêm API. */
    upsertMyRoom(room) {
      if (!room || !room.id) return;
      if (!Array.isArray(state.myRooms)) state.myRooms = [];
      const entry = { ...room, role: room.mine ? "host" : "member" };
      const index = state.myRooms.findIndex((item) => item.id === room.id);
      if (index >= 0) state.myRooms[index] = { ...state.myRooms[index], ...entry };
      else state.myRooms.unshift(entry);
    },

    async loadRoom(roomId) {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST" });
      const index = state.rooms.findIndex((r) => r.id === data.room.id);
      if (index >= 0) state.rooms[index] = data.room;
      else state.rooms.push(data.room);
      state.notebooks[data.room.id] = data.notebook || "";
      state.docsByRoom[data.room.id] = data.docs || [];
      if (data.messages) state.messagesByRoom[data.room.id] = data.messages;
      this.upsertMyRoom(data.room);
      return data;
    },

    /* Giải tán nhóm (chủ phòng) ------------------------------------------ */
    async closeRoom(roomId) {
      await api(`/api/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
      state.rooms = state.rooms.filter((room) => room.id !== roomId);
      state.myRooms = (state.myRooms || []).filter((room) => room.id !== roomId);
      delete state.notebooks[roomId];
      delete state.docsByRoom[roomId];
      if (state.messagesByRoom) delete state.messagesByRoom[roomId];
    },

    /* Rời phòng (thành viên) --------------------------------------------- */
    async leaveRoom(roomId) {
      await api(`/api/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
      const room = state.rooms.find((item) => item.id === roomId);
      if (room && room.type === "community") room.inRoom = false;
      else state.rooms = state.rooms.filter((item) => item.id !== roomId);
      state.myRooms = (state.myRooms || []).filter((item) => item.id !== roomId);
    },

    /* Hỏi lại trạng thái phòng (danh sách thành viên) mà không join lại —
       dùng cho vòng lặp poll 15s để người mất kết nối biến mất realtime. */
    async pollRoom(roomId) {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}`);
      const index = state.rooms.findIndex((item) => item.id === data.room.id);
      if (index >= 0) state.rooms[index] = data.room;
      return data;
    },

    async refreshMyRooms() {
      const data = await api("/api/me/rooms");
      state.myRooms = data.rooms || [];
      return state.myRooms;
    },

    async sendMessage(roomId, text) {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        body: { text },
      });
      const list = state.messagesByRoom[roomId] || (state.messagesByRoom[roomId] = []);
      /* SSE có thể đến trước khi POST trả về — nếu đã có thì thay bằng bản
         chính thức từ POST (đúng cờ me); chưa có thì đẩy mới. */
      const index = list.findIndex((m) => m.id === data.message.id);
      if (index >= 0) list[index] = data.message;
      else list.push(data.message);
      if (list.length > 120) state.messagesByRoom[roomId] = list.slice(-120);
      return data.message;
    },

    async addDoc(roomId, payload) {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/docs`, {
        method: "POST",
        body: payload,
      });
      const list = state.docsByRoom[roomId] || (state.docsByRoom[roomId] = []);
      /* SSE "docs" có thể đến trước khi POST trả về — chỉ thêm nếu chưa có. */
      if (!list.some((d) => d.id === data.doc.id)) list.unshift(data.doc);
      return data.doc;
    },

    async deleteDoc(roomId, docId) {
      const data = await api(`/api/rooms/${encodeURIComponent(roomId)}/docs/${encodeURIComponent(docId)}`, {
        method: "DELETE",
      });
      const list = state.docsByRoom[roomId] || [];
      state.docsByRoom[roomId] = list.filter((doc) => doc.id !== docId);
      return data;
    },

    /* Study Stars -------------------------------------------------------- */
    async buy(itemId) {
      const data = await api("/api/shop/buy", { method: "POST", body: { id: itemId } });
      state.profile.stars = data.stars;
      state.owned = data.owned;
      return data;
    },

    /* Vườn học tập ------------------------------------------------------- */
    async chooseCompanion(kind, id) {
      const data = await api("/api/garden/choose", { method: "POST", body: { kind, id } });
      state.garden = normalizeGarden(data.garden);
      state.profile.stars = data.stars;
      if (window.Shell) window.Shell.refresh();
      return data;
    },

    async tendGarden(kind, id) {
      const data = await api("/api/garden/tend", { method: "POST", body: { kind, id } });
      state.garden = normalizeGarden(data.garden);
      state.profile.stars = data.stars;
      if (window.Shell) window.Shell.refresh();
      return data;
    },

    /* Focus -------------------------------------------------------------- */
    async sendFocus(seconds, roomId, keepalive) {
      if (state.offline || !seconds || seconds < 1) return null;
      try {
        const data = await api("/api/focus", {
          method: "POST",
          keepalive: Boolean(keepalive),
          body: { seconds: Math.round(seconds), roomId: roomId || "" },
        });
        state.profile.stars = data.stars;
        state.profile.streak = data.streak;
        state.totalFocus = data.totalMinutes;
        state.todayMinutes = data.todayMinutes;
        if (data.day) {
          const previous = state.daily[data.day] || 0;
          state.daily[data.day] = data.todayMinutes;
          if (data.subject) {
            const delta = Math.max(0, (data.todayMinutes || 0) - previous);
            state.bySubject[data.subject] = (state.bySubject[data.subject] || 0) + delta;
          }
        }
        if (window.Shell) window.Shell.refresh();
        return data;
      } catch (err) {
        reportError(err);
        return null;
      }
    },

    /* Tài khoản ---------------------------------------------------------- */
    async login(email, password) {
      const data = await api("/api/auth/login", { method: "POST", body: { email, password } });
      return data;
    },
    async register(name, email, password) {
      const data = await api("/api/auth/register", { method: "POST", body: { name, email, password } });
      return data;
    },
    async guest() {
      return api("/api/auth/guest", { method: "POST" });
    },
    async logout() {
      try {
        await api("/api/auth/logout", { method: "POST" });
      } catch (err) {
        reportError(err);
      }
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        /* ignore */
      }
      window.location.href = "index.html";
    },
    async reset() {
      const data = await api("/api/me/reset", { method: "POST" });
      return data;
    },
  };

  function daysUntil(dateStr) {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
    const target = parseISO(dateStr);
    const diff = target.getTime() - startOfToday().getTime();
    return Math.max(0, Math.ceil(diff / DAY));
  }

  function formatMinutes(mins) {
    const m = Math.max(0, Math.round(mins || 0));
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (!h) return `${mm}p`;
    if (!mm) return `${h}h`;
    return `${h}h ${pad(mm)}p`;
  }

  function longDate(d) {
    const wd = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    return `${wd[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  function clockToMinutes(clock) {
    const [h, m] = clock.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToClock(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${pad(h)}:${pad(m)}`;
  }

  function roomTypeLabel(type) {
    return type === "solo" ? "Cá nhân" : type === "group" ? "Nhóm bạn" : "Cộng đồng";
  }

  function roomTypeIcon(type) {
    return type === "solo" ? "user" : type === "group" ? "lock" : "globe";
  }

  function minutesForDay(date) {
    const key = iso(date);
    if (state && state.daily && Object.prototype.hasOwnProperty.call(state.daily, key)) {
      return Number(state.daily[key]) || 0;
    }
    return state && state.offline ? mockMinutes(date) : 0;
  }

  function defaultState() {
    return fallbackState();
  }

  window.DATA = {
    DAY,
    SUBJECTS,
    SUBJECT_MAP,
    MEMBER_POOL,
    DEFAULT_ROOMS,
    DEFAULT_DOCS,
    DEFAULT_MESSAGES,
    SHOP: SHOP_FALLBACK,
    HOUR_H: 43,
    DAY_START: 6 * 60,
    DAY_END: 24 * 60,
    pad,
    iso,
    addDays,
    parseISO,
    startOfToday,
    todayISO,
    weekDates,
    minutesForDay,
    mulberry32,
    daysUntil,
    formatMinutes,
    longDate,
    clockToMinutes,
    minutesToClock,
    roomTypeLabel,
    roomTypeIcon,
    defaultState,
  };

  window.Store = Store;
})();
