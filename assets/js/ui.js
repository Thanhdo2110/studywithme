/* ==========================================================================
   StudyWithMe — Shared UI helpers (icons, toast, modal, auth, avatars)
   ========================================================================== */

(function () {
  "use strict";

  const ICONS = {
    logo: '<path d="M12 1.6c.5 3 1.8 4.3 4.8 4.8-3 .5-4.3 1.8-4.8 4.8-.5-3-1.8-4.3-4.8-4.8C10.2 5.9 11.5 4.6 12 1.6z" fill="currentColor" stroke="none"/><path d="M3 10.2 10 6v8l-7 4z"/><path d="M21 10.2 14 6v8l7 4z"/><path d="M12 11.4v8.2"/><path d="M6.8 15.4c1.7 1.1 3.4 1.7 5.2 1.7s3.5-.6 5.2-1.7"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.2 9.6V21h13.6V9.6"/><path d="M9.8 21v-5.4h4.4V21"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9.5 3v18"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M8 2.5v4M16 2.5v4M3 9.5h18"/><path d="M7.5 13h2M12 13h2M16.5 13h1M7.5 17h2M12 17h2"/>',
    chart: '<path d="M3 3v17.5h18"/><path d="M7.5 16.5v-5M12 16.5V7.5M16.5 16.5v-7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21v-1a7.5 7.5 0 0 1 15 0v1"/>',
    star: '<path d="M12 2.9l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.75 6.19 20.8 7.3 14.33 2.6 9.75l6.5-.95z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.4 16.4 21 21"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    "arrow-right": '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
    "arrow-left": '<path d="M19.5 12h-15M10.5 18l-6-6 6-6"/>',
    "arrow-up-right": '<path d="M7 17 17 7M8.2 7H17v8.8"/>',
    "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    play: '<path d="M6.5 4.2 20 12 6.5 19.8z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="4.5" width="3.6" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="13.9" y="4.5" width="3.6" height="15" rx="1" fill="currentColor" stroke="none"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 2.9-6.6L3 8"/><path d="M3 3v5h5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.8-5.1"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1L11 4.9"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20l1-1"/>',
    send: '<path d="M21.5 2.5 11 13"/><path d="M21.5 2.5 15 21.5l-4-8.5-8.5-4z"/>',
    pin: '<path d="M12 17v5"/><path d="M9 10.7a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.7V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
    file: '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h6"/><path d="M8.5 13h7M8.5 17h4.5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19V5a2.5 2.5 0 0 1 2.5-2.5z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.8 2.2"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    zap: '<path d="M13 2 3.5 14H12l-1 8 9.5-12H12z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    logout: '<path d="M9.5 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4.5"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    "chevron-left": '<path d="m15 6-6 6 6 6"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z"/>',
    lock: '<rect x="3.5" y="10.5" width="17" height="11" rx="2"/><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"/>',
    notebook: '<path d="M12.5 20.5H21"/><path d="M16.6 3.6a2.1 2.1 0 0 1 3 3L7 19.2l-4 1 1-4z"/>',
    download: '<path d="M21 15.5v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M12 15V3"/>',
    trash: '<path d="M3.5 6.5h17"/><path d="M8.5 6.5v-2h7v2"/><path d="M19 6.5 18 20.5H6L5 6.5"/><path d="M10 11v5.5M14 11v5.5"/>',
    coffee: '<path d="M17 8.5h1a3.5 3.5 0 1 1 0 7h-1"/><path d="M3.5 8.5h13.5v8a4 4 0 0 1-4 4h-5.5a4 4 0 0 1-4-4z"/><path d="M6.5 2.5v2M10.5 2.5v2M14.5 2.5v2"/>',
    moon: '<path d="M21 12.9A9 9 0 1 1 11.1 3a7 7 0 0 0 9.9 9.9z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
    volume: '<path d="M11 5 6 9H2.5v6H6l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
    music: '<path d="M9.5 18V5.5l10-2v12"/><circle cx="6.9" cy="18" r="2.6"/><circle cx="16.9" cy="15.5" r="2.6"/>',
    sprout: '<path d="M12 21v-8.5"/><path d="M12 12.5c0-4-2.7-6.7-6.6-6.7 0 4 2.7 6.7 6.6 6.7z"/><path d="M12 10.6c0-4 2.7-6.7 6.6-6.7 0 4-2.7 6.7-6.6 6.7z"/>',
    droplet: '<path d="M12 3.4c3.3 3.7 5.6 6.5 5.6 9.2a5.6 5.6 0 0 1-11.2 0c0-2.7 2.3-5.5 5.6-9.2z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    alert: '<path d="M10.3 3.2 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><path d="M12 9v4.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
    edit: '<path d="M12 20.5h9"/><path d="M16.6 3.6a2.1 2.1 0 0 1 3 3L7 19.2l-4 1 1-4z"/>',
    trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3"/>',
    sparkles: '<path d="M12 3.2l1.85 4.55L18.4 9.6l-4.55 1.85L12 16l-1.85-4.55L5.6 9.6l4.55-1.85z"/><path d="M19 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z"/><path d="M5 3l.6 1.4L7 5l-1.4.6L5 7l-.6-1.4L3 5l1.4-.6z"/>',
    timer: '<path d="M10 2.5h4"/><path d="M12 14l3.2-3.2"/><circle cx="12" cy="14" r="7.5"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    graduation: '<path d="M22 9.5 12 4 2 9.5l10 5.5z"/><path d="M6 12v5c0 1.8 2.7 3.2 6 3.2s6-1.4 6-3.2v-5"/>',
    "book-open": '<path d="M12 6.5C10.5 5 8 4.2 4 4.2v14c4 0 6.5.8 8 2.3 1.5-1.5 4-2.3 8-2.3v-14c-4 0-6.5.8-8 2.3z"/><path d="M12 6.5v14"/>',
    activity: '<path d="M3 12h4l2.5-6 4 12L16 12h5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    "external-link": '<path d="M14 4h6v6"/><path d="M20 4 10.5 13.5"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    "log-in": '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>',
    camera: '<path d="M4 7h3l1.5-2h7L17 7h3a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V8.5A1.5 1.5 0 0 1 4 7z"/><circle cx="12" cy="13" r="3.6"/>',
    "volume-x": '<path d="M11 5 6 9H2.5v6H6l5 4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14.2-1.5 7 5-2.6 5 2.6-1.5-7"/>',
  };

  const GOOGLE_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>';

  function icon(name, cls) {
    const body = ICONS[name] || ICONS.sparkles;
    return `<svg class="ico${cls ? " " + cls : ""}" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function hydrateIcons(root) {
    (root || document).querySelectorAll("[data-icon]").forEach((el) => {
      const name = el.getAttribute("data-icon");
      el.innerHTML = icon(name);
      el.removeAttribute("data-icon");
    });
  }

  function escapeHTML(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const AVATAR_TONES = ["a", "b", "c", "d"];
  function avatarHTML(emoji, name, cls) {
    if (emoji) return `<span class="avatar ${cls || ""}" aria-hidden="true">${escapeHTML(emoji)}</span>`;
    const tone = AVATAR_TONES[(String(name || "").charCodeAt(0) + (name || "").length) % 4];
    return `<span class="avatar avatar--${tone} ${cls || ""}" aria-hidden="true">${initials(name)}</span>`;
  }

  /* ---------------------------------------------------------------------- */

  function toast(message, type) {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type ? ` toast--${type}` : "");
    const ico = type === "danger" ? "alert" : type === "warning" ? "alert" : "check-circle";
    el.innerHTML = `${icon(ico)}<span>${escapeHTML(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 260);
    }, 3400);
  }

  let openCount = 0;
  function openModal(id) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    openCount++;
    document.body.style.overflow = "hidden";
    const focusable = el.querySelector("input:not([type=hidden]), select, textarea, button.btn-accent");
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 120);
  }

  function closeModal(id) {
    const el = typeof id === "string" ? document.getElementById(id) : id;
    if (!el) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.body.style.overflow = "";
  }

  function initModals() {
    document.addEventListener("click", (e) => {
      const closer = e.target.closest("[data-close]");
      if (closer) {
        const modal = closer.closest(".modal");
        if (modal) closeModal(modal);
        return;
      }
      if (e.target.classList && e.target.classList.contains("modal")) closeModal(e.target);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = document.querySelectorAll(".modal.open");
      if (open.length) closeModal(open[open.length - 1]);
    });
    document.querySelectorAll("[data-open-modal]").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.getAttribute("data-open-modal")));
    });
  }

  function copyText(text, successMsg) {
    const done = () => toast(successMsg || "Đã sao chép liên kết.");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { toast("Không sao chép được, hãy copy thủ công.", "warning"); }
    ta.remove();
  }

  /* ---------------------------------------------------------------------- */
  /* Auth modal (đăng nhập / đăng ký / khách)                                */
  /* ---------------------------------------------------------------------- */

  function injectAuthModal() {
    if (document.getElementById("authModal")) return;
    const wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "authModal";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = `
      <div class="modal-panel auth-panel" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button class="modal-close" data-close aria-label="Đóng">${icon("x")}</button>
        <div class="auth-brand">
          <img class="brand-logo brand-logo--light" src="assets/img/logo-horizontal.png" alt="StudyWithMe — Học cùng nhau">
          <img class="brand-logo brand-logo--dark" src="assets/img/logo-horizontal-dark.png" alt="StudyWithMe — Học cùng nhau">
          <h3 id="authTitle">Vào học cùng StudyWithMe</h3>
          <p>Không webcam, không ồn ào. Chỉ có bạn, kế hoạch học và những người cùng tiến.</p>
        </div>
        <div class="seg auth-seg" id="authTabs" role="tablist" aria-label="Chọn cách đăng nhập">
          <button type="button" data-auth-mode="login" class="active" role="tab" aria-selected="true">Đăng nhập</button>
          <button type="button" data-auth-mode="register" role="tab" aria-selected="false">Đăng ký</button>
        </div>
        <form class="auth-form" id="authForm" novalidate>
          <div class="field hidden" id="authNameField">
            <label for="authName">Họ và tên</label>
            <input class="input" id="authName" name="name" maxlength="60" autocomplete="name" placeholder="Họ và tên của bạn">
          </div>
          <div class="field">
            <label for="authEmail">Email</label>
            <input class="input" id="authEmail" name="email" type="email" maxlength="160" autocomplete="email" placeholder="ban@example.com" required>
          </div>
          <div class="field">
            <label for="authPassword">Mật khẩu</label>
            <input class="input" id="authPassword" name="password" type="password" minlength="8" maxlength="128" autocomplete="current-password" placeholder="Ít nhất 8 ký tự" required>
          </div>
          <p class="auth-error hidden" id="authError" role="alert"></p>
          <button class="btn btn-accent btn-block" type="submit" id="authSubmit">${icon("log-in")} Đăng nhập</button>
        </form>
        <div class="auth-note">
          Chỉ tài khoản đã đăng ký mới tạo và vào được phòng học. Dữ liệu học tập được lưu trên máy chủ StudyWithMe.
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const form = wrap.querySelector("#authForm");
    const nameField = wrap.querySelector("#authNameField");
    const nameInput = wrap.querySelector("#authName");
    const emailInput = wrap.querySelector("#authEmail");
    const passInput = wrap.querySelector("#authPassword");
    const errorEl = wrap.querySelector("#authError");
    const submitBtn = wrap.querySelector("#authSubmit");
    const tabs = wrap.querySelectorAll("[data-auth-mode]");
    let mode = "login";

    const setMode = (next) => {
      mode = next === "register" ? "register" : "login";
      nameField.classList.toggle("hidden", mode !== "register");
      nameInput.required = mode === "register";
      passInput.autocomplete = mode === "register" ? "new-password" : "current-password";
      submitBtn.innerHTML = mode === "register" ? `${icon("user")} Tạo tài khoản` : `${icon("log-in")} Đăng nhập`;
      errorEl.classList.add("hidden");
      tabs.forEach((tab) => {
        const active = tab.dataset.authMode === mode;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      hydrateIcons(submitBtn);
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => setMode(tab.dataset.authMode));
    });

    const fail = (message) => {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.classList.add("hidden");
      const email = emailInput.value.trim();
      const password = passInput.value;
      const name = nameInput.value.trim();

      if (!email) return fail("Hãy nhập email của bạn.");
      if (password.length < 8) return fail("Mật khẩu cần ít nhất 8 ký tự.");
      if (mode === "register" && name.length < 2) return fail("Hãy nhập họ và tên của bạn.");
      /* Không chặn theo Store.offline: chế độ offline chỉ là bootstrap trống
         (phiên cũ hết hạn) chứ máy chủ vẫn chạy — login/register vẫn hoạt động,
         lỗi (nếu có) sẽ do api() trả về ở catch dưới. */

      submitBtn.disabled = true;
      try {
        const data =
          mode === "register" ? await Store.register(name, email, password) : await Store.login(email, password);
        toast(mode === "register" ? "Đã tạo tài khoản. Chào mừng bạn!" : "Đăng nhập thành công. Chào mừng trở lại!");
        /* Đánh dấu đã xác thực xong để trang phòng không về trang chủ do nhầm
           modal đóng mà phiên chưa kịp cập nhật. */
        wrap.dataset.authDone = "1";
        closeModal(wrap);
        /* Khách vào từ một phòng (?room=…) hoặc vừa bấm "Vào phòng" thì đi thẳng
           vào phòng đó, không quay ra Sảnh chính. */
        const next = afterAuthUrl || (currentRoomUrl() ? location.href : (data && data.redirect) || "dashboard.html");
        afterAuthUrl = null;
        setTimeout(() => (window.location.href = next), 420);
      } catch (err) {
        fail(err.message || "Không đăng nhập được. Vui lòng thử lại.");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  function initAuthTriggers() {
    document.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-open-auth]");
      if (!trigger) return;
      e.preventDefault();
      openModal("authModal");
    });
  }

  /* Đích quay lại sau khi đăng nhập/đăng ký — ví dụ phòng khách vừa bấm "Vào phòng". */
  let afterAuthUrl = null;

  /* Đang đứng ngay trong một phòng học (?room=…) thì xác thực xong ở lại phòng đó. */
  function currentRoomUrl() {
    return /(^|\/)room\.html$/.test(location.pathname) && new URLSearchParams(location.search).get("room");
  }

  /* Mở bảng đăng nhập/đăng ký chủ động — guests bị chặn tạo/vào phòng sẽ
     được đưa thẳng vào tab Đăng ký. */
  function openAuth(mode, options) {
    injectAuthModal();
    const modal = document.getElementById("authModal");
    if (!modal) return;
    afterAuthUrl = (options && options.afterAuth) || null;
    if (mode === "register") {
      const tab = modal.querySelector('[data-auth-mode="register"]');
      if (tab) tab.click();
    }
    openModal(modal);
  }

  /* ---------------------------------------------------------------------- */
  /* Reveal + header                                                         */
  /* ---------------------------------------------------------------------- */

  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    items.forEach((el) => io.observe(el));
  }

  function initHeaderScroll() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    hydrateIcons();
    initModals();
    injectAuthModal();
    initAuthTriggers();
    initReveal();
    initHeaderScroll();
  });

  /* --------------------------------------------------------------------------
     Chuỗi ngày — mascot ngọn lửa và dải 7 ngày
     -------------------------------------------------------------------------- */

  function streakMascot(extraClass) {
    return `<svg class="streak-mascot${extraClass ? ` ${extraClass}` : ""}" viewBox="0 0 64 84" aria-hidden="true" focusable="false">
      <path d="M32 2c2.2 8.4 9.5 12.5 9.5 22.4 0 8.2-4.2 13.9-9.5 13.9s-9.5-5.7-9.5-13.9C22.5 14.5 29.8 10.4 32 2z" fill="#f2502b"/>
      <path d="M32 13.5c1.4 5.4 5.8 8.4 5.8 15 0 5.6-2.6 9.4-5.8 9.4s-5.8-3.8-5.8-9.4c0-6.6 4.4-9.6 5.8-15z" fill="#ff9a3c"/>
      <ellipse cx="32" cy="30.5" rx="3.6" ry="5.2" fill="#ffe96b"/>
      <rect x="13" y="33" width="38" height="45" rx="16" fill="#7ed957"/>
      <rect x="15" y="41" width="34" height="5.5" rx="2" fill="#f2f5ec"/>
      <rect x="19" y="70" width="11" height="10" rx="5" fill="#7ed957"/>
      <rect x="34" y="70" width="11" height="10" rx="5" fill="#7ed957"/>
      <rect x="6.5" y="50" width="7.5" height="11" rx="3.8" fill="#7ed957"/>
      <rect x="50" y="50" width="7.5" height="11" rx="3.8" fill="#7ed957"/>
      <circle cx="26" cy="53" r="3.4" fill="#243021"/>
      <circle cx="38" cy="53" r="3.4" fill="#243021"/>
      <path d="M29 61.5c1.7 1.9 4.3 1.9 6 0" stroke="#243021" stroke-width="1.8" stroke-linecap="round" fill="none"/>
    </svg>`;
  }

  /* completed: số ngày đã giữ trong chuỗi hiện tại (dải luôn đủ 7 ô) */
  function streakWeek(completed, opts) {
    const done = Math.max(0, Math.min(7, Number(completed) || 0));
    const compact = Boolean(opts && opts.compact);
    const cells = Array.from({ length: 7 }, (_, i) => {
      const n = i + 1;
      const on = n <= done;
      return `<span class="streak-day${on ? " on" : ""}"><i>${on ? icon("flame") : ""}</i>${compact ? "" : `<em>${n}</em>`}</span>`;
    }).join("");
    return `<div class="streak-week" role="img" aria-label="Chuỗi ${done} trên 7 ngày">${cells}</div>`;
  }

  /* Thẻ streak đầy đủ — dùng ở trang Thống kê */
  function streakCard(streak) {
    const s = Math.max(0, Number(streak) || 0);
    const left = Math.max(0, 7 - s);
    const subtitle = s === 0
      ? "Học ít nhất một phút hôm nay để mở chuỗi đầu tiên."
      : "Hôm nay bạn đang cháy. Quay lại vào mai để nối chuỗi tiếp.";
    return `${streakMascot()}
      <div class="streak-title">${s} ngày streak!</div>
      <p class="streak-sub">${subtitle}</p>
      ${streakWeek(s)}
      <div class="streak-reward">
        <span class="streak-reward-thumb" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="streak-reward-text">
          <b>Mở khoá chủ đề Streak Fire</b>
          <span>${left > 0 ? `Còn ${left} ngày tới chuỗi 7 ngày.` : "Đã mở khoá — chuỗi 7 ngày hoàn thành!"}</span>
        </span>
      </div>
      <a class="btn btn-soft btn-sm streak-cta" href="room.html">${icon("flame")} Giữ chuỗi</a>`;
  }

  window.UI = {
    icon,
    hydrateIcons,
    streakMascot,
    streakWeek,
    streakCard,
    escapeHTML,
    initials,
    avatarHTML,
    toast,
    openModal,
    closeModal,
    openAuth,
    copyText,
    GOOGLE_SVG,
  };
})();
