/* ==========================================================================
   StudyWithMe — App shell (sidebar + topbar)
   ========================================================================== */

(function () {
  "use strict";

  const { icon, avatarHTML, hydrateIcons, escapeHTML, toast } = window.UI;
  const D = window.DATA;

  const PAGES = {
    dashboard: "Sảnh chính",
    myrooms: "Phòng của tôi",
    planner: "Kế hoạch học tập",
    room: "Phòng học",
    stats: "Thống kê",
    profile: "Hồ sơ & cài đặt",
  };

  const NAV = [
    {
      label: "Không gian học",
      items: [
        { id: "dashboard", href: "dashboard.html", icon: "home", label: "Sảnh chính" },
        { id: "planner", href: "planner.html", icon: "calendar", label: "Kế hoạch học" },
        { id: "stats", href: "stats.html", icon: "chart", label: "Thống kê" },
        { id: "myrooms", href: "myroom.html", icon: "grid", label: "Phòng của tôi" },
        { id: "room", href: openRoomHref(), icon: "users", label: "Phòng đang mở", badge: "LIVE" },
      ],
    },
    {
      label: "Cộng đồng",
      items: [
        { id: "shop", href: "profile.html#shop", icon: "sparkles", label: "Cửa hàng Sao" },
      ],
    },
    {
      label: "Tài khoản",
      items: [
        { id: "profile", href: "profile.html", icon: "user", label: "Hồ sơ & cài đặt" },
        { id: "landing", href: "index.html", icon: "arrow-up-right", label: "Trang giới thiệu" },
      ],
    },
  ];

  let page = "dashboard";

  function openRoomHref() {
    try {
      const account = window.Store && window.Store.account;
      const accountId = account && account.id ? account.id : "guest";
      const lastId = localStorage.getItem(`studywithme.lastRoom.${accountId}`);
      return lastId ? `room.html?room=${encodeURIComponent(lastId)}` : "room.html";
    } catch (err) {
      return "room.html";
    }
  }

  function accountLabel() {
    const acc = (window.Store && window.Store.account) || {};
    return acc.isGuest === false ? "Tài khoản" : "Khách";
  }

  function formatGrade(value) {
    const grade = String(value || "").trim().replace(/^lớp\s+/i, "").trim();
    return grade ? `Lớp ${grade}` : "Chưa chọn lớp";
  }

  function sidebarHTML(profile) {
    const days = D.daysUntil(profile.examDate);
    const percent = days === null ? 0 : Math.min(100, Math.max(4, Math.round((1 - days / 365) * 100)));
    return `
      <div class="sidebar-top">
        <a class="brand" href="index.html" aria-label="StudyWithMe — trang chủ">
          <img class="brand-logo" src="assets/img/logo-horizontal.svg" alt="StudyWithMe — Học cùng nhau">
        </a>
        <button class="sidebar-close" data-sidebar-close aria-label="Đóng menu">${icon("x")}</button>
      </div>

      <nav class="side-nav" aria-label="Điều hướng chính">
        ${NAV.map(
          (group) => `
          <div class="side-group">
            <span class="side-label">${group.label}</span>
            ${group.items
              .map((item) => {
                const active = item.id === page ? " active" : "";
                return `<a class="side-link${active}" href="${item.href}">
                  ${icon(item.icon)}
                  <span>${item.label}</span>
                  ${item.badge ? `<span class="badge">${item.badge}</span>` : ""}
                  ${item.id === "community" ? '<span class="dot dot--live live-dot"></span>' : ""}
                </a>`;
              })
              .join("")}
          </div>`
        ).join("")}
      </nav>

      <div class="side-dday">
        <div class="side-dday-top">
          <b>${days === null ? "—" : `D-${days}`}</b>
          <span>${escapeHTML(profile.exam || "Chưa đặt kỳ thi")}</span>
        </div>
        <p>${days === null ? "Chưa đặt ngày thi" : `Còn ${days} ngày`} · ${escapeHTML(profile.targetSchool || "Chưa đặt mục tiêu")}</p>
        <div class="bar"><span style="width:${percent}%"></span></div>
      </div>

      <div class="side-user">
        ${avatarHTML(profile.avatar, profile.name)}
        <div class="grow">
          <b>${escapeHTML(profile.name.split(" ").slice(-2).join(" "))}</b>
          <span>${escapeHTML(formatGrade(profile.grade))} · ${accountLabel()}</span>
        </div>
        <a class="ico-btn" href="index.html" data-logout aria-label="Đăng xuất" data-tip="Đăng xuất">${icon("logout")}</a>
      </div>`;
  }

  function topbarHTML(profile) {
    return `
      <button class="btn-icon menu-btn" id="menuBtn" aria-label="Mở menu">${icon("menu")}</button>
      <div class="topbar-title">
        <span class="crumb">StudyWithMe</span>
        <span class="sep">/</span>
        <b>${PAGES[page] || "Sảnh chính"}</b>
      </div>
      <div class="topbar-search input-icon">
        <span data-icon="search"></span>
        <input class="input" id="globalSearch" type="search" placeholder="Tìm phòng, môn học, tài liệu…" autocomplete="off">
      </div>
      <div class="topbar-actions">
        <span class="stars-pill" data-tip="Study Stars tích lũy">${icon("star")}<b id="topStars">${profile.stars.toLocaleString("vi-VN")}</b></span>
        <button class="btn-icon" id="notifBtn" aria-label="Thông báo">${icon("bell")}</button>
        <a class="topbar-user" href="profile.html" data-tip="${escapeHTML(profile.name)}" aria-label="Hồ sơ">
          ${avatarHTML(profile.avatar, profile.name)}
        </a>
      </div>`;
  }

  function build() {
    page = document.body.dataset.page || "dashboard";
    const sidebar = document.getElementById("appSidebar");
    const topbar = document.getElementById("topbar");
    if (!sidebar || !topbar) return;

    const profile = window.Store.state.profile;
    document.documentElement.dataset.accent = profile.accent || "green";
    document.documentElement.dataset.theme = profile.theme === "dark" ? "dark" : "light";
    sidebar.innerHTML = sidebarHTML(profile);
    topbar.innerHTML = topbarHTML(profile);

    if (!document.querySelector(".sidebar-overlay")) {
      const overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      document.body.appendChild(overlay);
    }

    hydrateIcons(sidebar);
    hydrateIcons(topbar);

    bind();
    // highlight shop anchor
    if (page === "profile" && location.hash === "#shop") {
      const shop = document.querySelector('.side-link[href="profile.html#shop"]');
      if (shop) shop.classList.add("active");
    }
  }

  function bind() {
    const sidebar = document.getElementById("appSidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    const menuBtn = document.getElementById("menuBtn");

    const openDrawer = () => {
      sidebar.classList.add("open");
      overlay.classList.add("open");
    };
    const closeDrawer = () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
    };

    if (menuBtn) menuBtn.addEventListener("click", openDrawer);
    if (overlay) overlay.addEventListener("click", closeDrawer);
    sidebar.querySelectorAll("[data-sidebar-close]").forEach((b) => b.addEventListener("click", closeDrawer));
    sidebar.querySelectorAll(".side-link").forEach((a) => a.addEventListener("click", closeDrawer));

    const logout = sidebar.querySelector("[data-logout]");
    if (logout) {
      logout.addEventListener("click", async (e) => {
        e.preventDefault();
        if (window.Store && window.Store.online) {
          await window.Store.logout();
          return;
        }
        window.location.href = "index.html";
      });
    }

    const notif = document.getElementById("notifBtn");
    if (notif) {
      notif.addEventListener("click", () => {
        toast("Chưa có thông báo mới.");
      });
    }

    const search = document.getElementById("globalSearch");
    if (search) {
      search.addEventListener("input", () => {
        window.dispatchEvent(new CustomEvent("shell:search", { detail: search.value.trim() }));
      });
      search.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && page !== "dashboard") {
          window.location.href = `dashboard.html?q=${encodeURIComponent(search.value.trim())}`;
        }
      });
    }

    // prefill search from query
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q && search) {
      search.value = q;
      setTimeout(() => window.dispatchEvent(new CustomEvent("shell:search", { detail: q })), 60);
    }
  }

  function refresh() {
    const profile = window.Store.state.profile;
    document.documentElement.dataset.accent = profile.accent || "green";
    document.documentElement.dataset.theme = profile.theme === "dark" ? "dark" : "light";
    const stars = document.getElementById("topStars");
    if (stars) stars.textContent = profile.stars.toLocaleString("vi-VN");

    const user = document.querySelector(".side-user");
    if (user) {
      user.innerHTML = `
        ${avatarHTML(profile.avatar, profile.name)}
        <div class="grow">
          <b>${escapeHTML(profile.name.split(" ").slice(-2).join(" "))}</b>
          <span>${escapeHTML(formatGrade(profile.grade))} · ${accountLabel()}</span>
        </div>
        <a class="ico-btn" href="index.html" data-logout aria-label="Đăng xuất" data-tip="Đăng xuất">${icon("logout")}</a>`;
    }

    const dday = document.querySelector(".side-dday");
    if (dday) {
      const days = D.daysUntil(profile.examDate);
      const percent = days === null ? 0 : Math.min(100, Math.max(4, Math.round((1 - days / 365) * 100)));
      dday.innerHTML = `
        <div class="side-dday-top"><b>${days === null ? "—" : `D-${days}`}</b><span>${escapeHTML(profile.exam || "Chưa đặt kỳ thi")}</span></div>
        <p>${days === null ? "Chưa đặt ngày thi" : `Còn ${days} ngày`} · ${escapeHTML(profile.targetSchool || "Chưa đặt mục tiêu")}</p>
        <div class="bar"><span style="width:${percent}%"></span></div>`;
    }

    const avatarLink = document.querySelector(".topbar-user");
    if (avatarLink) {
      avatarLink.innerHTML = avatarHTML(profile.avatar, profile.name);
      avatarLink.setAttribute("data-tip", profile.name);
      avatarLink.setAttribute("aria-label", `Hồ sơ của ${profile.name}`);
    }

    hydrateIcons();
  }

  window.Shell = { build, refresh, pagelabel: () => PAGES[page] || "" };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
