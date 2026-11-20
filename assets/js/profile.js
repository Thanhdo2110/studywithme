/* ==========================================================================
   StudyWithMe — Profile, settings & Study Stars shop
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { escapeHTML, avatarHTML, toast } = window.UI;

  const AVATARS = ["🦊", "🐼", "🐯", "🐸", "🐧", "🦉", "🐨", "🐰", "🐙", "🦄", "🌙", "⭐"];

  const $ = (id) => document.getElementById(id);

  function normalizeGrade(value) {
    return String(value || "").trim().replace(/^lớp\s+/i, "").trim();
  }

  function displayGrade(value) {
    const grade = normalizeGrade(value);
    return grade ? `Lớp ${grade}` : "Chưa chọn lớp";
  }

  function applyAccent(accent) {
    document.documentElement.dataset.accent = accent || "green";
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  }

  function renderTheme() {
    const current = Store.state.profile.theme === "dark" ? "dark" : "light";
    document.querySelectorAll("#themeChoice [data-theme-opt]").forEach((btn) => {
      const active = btn.dataset.themeOpt === current;
      btn.setAttribute("aria-pressed", String(active));
      btn.classList.toggle("active", active);
    });
  }

  function initTheme() {
    document.querySelectorAll("#themeChoice [data-theme-opt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.themeOpt === "light" ? "light" : "dark";
        if (Store.state.profile.theme === theme) return;
        Store.update((s) => {
          s.profile.theme = theme;
        });
        applyTheme(theme);
        renderTheme();
        toast(theme === "light" ? "Đã chuyển sang giao diện sáng." : "Đã chuyển sang giao diện tối.");
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Hero                                                                    */
  /* ---------------------------------------------------------------------- */

  function renderHero() {
    const p = Store.state.profile;
    const days = D.daysUntil(p.examDate);
    const owned = Store.state.owned || [];
    const frame = ["neon", "winter"].find((id) => owned.includes(id)) || "";

    const gardenPet = window.Garden ? window.Garden.heroPet() : "";
    const gardenBed = window.Garden ? window.Garden.heroFlowerbed() : "";
    const petEmoji = gardenPet || (owned.includes("cat") ? "🐱" : "");

    $("heroAvatar").innerHTML = `<span class="cosmetic-wrap${frame ? ` ${frame}` : ""}">
      ${avatarHTML(p.avatar, p.name, "avatar--xl")}
      ${petEmoji ? `<span class="study-pet study-pet--hero" title="Người bạn đồng hành" aria-hidden="true">${petEmoji}</span>` : ""}
    </span>`;

    /* Nền hoa toàn khung hero khi cây trồng đã trọn vẹn — chèn vào đầu khung
       (trước khi render lại cần dọn lớp cũ để không chồng lớp). */
    const heroCard = document.getElementById("profileHero");
    if (heroCard) {
      const oldBed = heroCard.querySelector(".hero-flowerbed");
      if (oldBed) oldBed.remove();
      if (gardenBed) heroCard.insertAdjacentHTML("afterbegin", gardenBed);
    }
    $("heroName").textContent = p.name;
    $("heroSchool").textContent = p.targetSchool || "Chưa đặt mục tiêu";
    $("heroBio").textContent = p.bio || "Thêm một dòng giới thiệu để bạn học cùng biết bạn đang cày môn gì.";

    $("heroPills").innerHTML = `
      <span class="pill">${escapeHTML(p.currentSchool || "Chưa cập nhật trường")}</span>
      <span class="pill pill--accent">${escapeHTML(displayGrade(p.grade))}</span>
      <span class="pill">${p.gender === "nu" ? "Nữ" : "Nam"}</span>`;

    $("heroHours").textContent = D.formatMinutes(Store.state.totalFocus || 0);
    $("heroStars").textContent = Number(p.stars || 0).toLocaleString("vi-VN");
    $("heroStreak").textContent = `${p.streak || 0} ngày`;
  }

  /* ---------------------------------------------------------------------- */
  /* Avatar + accent                                                         */
  /* ---------------------------------------------------------------------- */

  function renderAvatars() {
    const current = Store.state.profile.avatar;
    const grid = $("avatarGrid");
    grid.innerHTML = AVATARS.map(
      (emoji) => `
      <button type="button" class="avatar-option${emoji === current ? " active" : ""}"
        data-avatar="${emoji}" aria-label="Chọn avatar ${emoji}" aria-pressed="${emoji === current}">${emoji}</button>`
    ).join("");
  }

  function renderAccents() {
    const current = Store.state.profile.accent || "green";
    document.querySelectorAll("#accentSwatches .swatch").forEach((btn) => {
      const active = btn.dataset.accent === current;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Form                                                                    */
  /* ---------------------------------------------------------------------- */

  function populateForm() {
    const p = Store.state.profile;
    $("pName").value = p.name || "";
    const grade = normalizeGrade(p.grade);
    $("pGrade").value = grade ? `Lớp ${grade}` : "";
    $("pSchool").value = p.targetSchool || "";
    $("pExam").value = p.exam || "";
    $("pDate").value = p.examDate || "";
    $("pCurrentSchool").value = p.currentSchool || "";
    $("pGender").value = p.gender || "";
    $("pGoal").value = String(p.goalHours || 4);
    $("pStars").value = Number(p.stars || 0).toLocaleString("vi-VN");
    $("pBio").value = p.bio || "";
  }

  function saveProfile(e) {
    e.preventDefault();
    const name = $("pName").value.trim();
    if (!name) {
      $("pName").focus();
      toast("Hãy nhập họ và tên của bạn.", "warning");
      return;
    }

    Object.assign(Store.state.profile, {
      name,
      grade: normalizeGrade($("pGrade").value),
      exam: $("pExam").value.trim(),
      examDate: $("pDate").value.trim(),
      targetSchool: $("pSchool").value.trim(),
      currentSchool: $("pCurrentSchool").value.trim(),
      gender: $("pGender").value,
      goalHours: Number($("pGoal").value) || 4,
      bio: $("pBio").value.trim(),
    });
    Store.persist(true);

    renderHero();
    renderAvatars();
    if (window.Shell) window.Shell.refresh();
    toast("Đã lưu thông tin học tập.");
  }

  /* ---------------------------------------------------------------------- */
  /* Settings switches                                                       */
  /* ---------------------------------------------------------------------- */

  function initSwitches() {
    const map = {
      setReminders: "reminders",
      setHeartbeat: "heartbeat",
    };

    Object.entries(map).forEach(([elId, key]) => {
      const el = $(elId);
      if (!el) return;
      el.checked = Boolean(Store.state.profile[key]);
      el.addEventListener("change", () => {
        Store.update((s) => {
          s.profile[key] = el.checked;
        });
        if (key === "heartbeat" && !el.checked) {
          toast("Heartbeat đã tắt. Phiên học sẽ không được xác thực.", "warning");
        } else {
          toast(el.checked ? "Đã bật tuỳ chọn." : "Đã tắt tuỳ chọn.");
        }
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Account                                                                 */
  /* ---------------------------------------------------------------------- */

  function renderAccount() {
    const acc = Store.account || {};
    const guest = acc.isGuest !== false;
    const badge = $("accountBadge");
    const info = $("accountInfo");
    const authBtn = $("accountAuthBtn");
    const logoutBtn = $("accountLogoutBtn");
    if (badge) badge.textContent = guest ? "Khách" : "Đã đăng nhập";
    if (info) {
      info.innerHTML = guest
        ? "Đang học ở chế độ khách. Tạo tài khoản để đồng bộ hồ sơ, lịch học và tiến độ trên mọi thiết bị."
        : `Đăng nhập với <b style="color:var(--text-2)">${escapeHTML(acc.email || "tài khoản StudyWithMe")}</b>. Hồ sơ và tiến độ được lưu trên máy chủ.`;
    }
    if (authBtn) authBtn.classList.toggle("hidden", !guest);
    if (logoutBtn) logoutBtn.classList.toggle("hidden", guest);
  }

  function initAccount() {
    renderAccount();
    const authBtn = $("accountAuthBtn");
    if (authBtn) {
      authBtn.addEventListener("click", () => window.UI.openModal("authModal"));
    }
    const logoutBtn = $("accountLogoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;
        await Store.logout();
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Wiring                                                                  */
  /* ---------------------------------------------------------------------- */

  document.addEventListener("DOMContentLoaded", () => {
    applyAccent(Store.state.profile.accent);
    applyTheme(Store.state.profile.theme);
    renderHero();
    renderAvatars();
    renderAccents();
    renderTheme();
    initTheme();
    populateForm();
    initSwitches();
    initAccount();

    $("profileForm").addEventListener("submit", saveProfile);

    $("resetForm").addEventListener("click", () => {
      populateForm();
      toast("Đã khôi phục giá trị đang lưu.");
    });

    $("avatarGrid").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-avatar]");
      if (!btn) return;
      const emoji = btn.dataset.avatar;
      if (emoji === Store.state.profile.avatar) return;
      Store.update((s) => {
        s.profile.avatar = emoji;
      });
      renderAvatars();
      renderHero();
      if (window.Shell) window.Shell.refresh();
      toast("Đã đổi avatar.");
    });

    $("accentSwatches").addEventListener("click", (e) => {
      const btn = e.target.closest(".swatch");
      if (!btn) return;
      const accent = btn.dataset.accent;
      applyAccent(accent);
      Store.update((s) => {
        s.profile.accent = accent;
      });
      renderAccents();
      toast("Đã áp dụng màu nhấn mới.");
    });

    $("confirmReset").addEventListener("click", async () => {
      const btn = $("confirmReset");
      btn.disabled = true;
      btn.textContent = "Đang đặt lại…";
      try {
        await Store.reset();
        window.UI.closeModal("resetModal");
        toast("Đã đặt lại dữ liệu học tập về trạng thái trống.");
        setTimeout(() => window.location.reload(), 520);
      } catch (err) {
        toast(err.message || "Không đặt lại được dữ liệu.", "danger");
        btn.disabled = false;
        btn.textContent = "Xoá & đặt lại";
      }
    });
  });
})();
