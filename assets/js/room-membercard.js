/* ==========================================================================
   StudyWithMe — Member card
   Thẻ hồ sơ thành viên khi bấm avatar trong danh sách phòng. room.js gọi
   qua facade window.MemberCard.open(member).
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const { icon, escapeHTML, avatarHTML, openModal } = window.UI;
  /* garden.js nạp SAU module này (defer theo thứ tự script) — tra cứu lúc
     gọi thay vì lúc nạp, nếu không sẽ bắt được undefined. */
  const Garden = () => window.Garden;

  /* ---------------------------------------------------------------------- */
  /* Thẻ hồ sơ thành viên (bấm avatar trong danh sách phòng)                 */
  /* ---------------------------------------------------------------------- */

  let memberModal = null;

  async function fetchMemberProfile(userId) {
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/profile`, { credentials: "same-origin" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || "Không tải được hồ sơ thành viên.");
    return data;
  }

  function pillText(examDate) {
    const days = D.daysUntil(examDate);
    return days === null ? "Chưa đặt ngày thi" : days === 0 ? "Hôm nay thi" : `D-${days}`;
  }

  function memberCardHTML(data) {
    const g = data.garden || {};
    const flowers = g.plant && Number(g.plantLevel) >= 6 ? Garden()?.flowerbedFor(g.plant, data.id) : "";
    const petBadge = Garden()?.petBadgeFor(g.pet, Number(g.petLevel) || 0);
    const pet = petBadge ? `<span class="study-pet study-pet--hero" title="Người bạn đồng hành" aria-hidden="true">${petBadge}</span>` : "";
    const bio = data.bio || "Người này chưa viết dòng giới thiệu nào.";
    return `<section class="panel profile-hero member-card">
      ${flowers}
      <span class="cosmetic-wrap">
        ${avatarHTML(data.avatar, data.name, "avatar--xl")}
        ${pet}
      </span>
      <h2>${escapeHTML(data.name)}</h2>
      <p class="ph-sub">${escapeHTML(data.targetSchool || "Chưa đặt mục tiêu")}</p>
      <div class="ph-pills">
        <span class="pill">${escapeHTML(data.currentSchool || "Chưa cập nhật trường")}</span>
        <span class="pill pill--accent">${data.grade ? `Lớp ${escapeHTML(String(data.grade))}` : "Chưa chọn lớp"}</span>
        <span class="pill">${data.gender === "nu" ? "Nữ" : "Nam"}</span>
      </div>
      <p class="member-card-bio">${escapeHTML(bio)}</p>
      <div class="profile-stats">
        <div class="profile-stat"><b>${D.formatMinutes(Number(data.totalFocus) || 0)}</b><span>giờ học 90 ngày</span></div>
        <div class="profile-stat"><b>${Number(data.stars || 0).toLocaleString("vi-VN")}</b><span>Study Stars</span></div>
        <div class="profile-stat"><b>${Number(data.streak || 0)} ngày</b><span>chuỗi ngày</span></div>
      </div>
    </section>`;
  }

  function ensureMemberModal() {
    if (memberModal) return memberModal;
    memberModal = document.createElement("div");
    memberModal.className = "modal";
    memberModal.id = "memberCardModal";
    memberModal.setAttribute("aria-hidden", "true");
    memberModal.innerHTML = `
      <div class="modal-panel member-modal" role="dialog" aria-modal="true" aria-label="Hồ sơ thành viên">
        <button class="modal-close" data-close aria-label="Đóng">${icon("x")}</button>
        <div id="memberCardBody"></div>
      </div>`;
    document.body.appendChild(memberModal);
    return memberModal;
  }

  async function openMemberCard(member) {
    const modal = ensureMemberModal();
    const body = modal.querySelector("#memberCardBody");
    body.innerHTML = `<section class="panel profile-hero member-card is-loading"><p class="member-card-loading">Đang mở hồ sơ…</p></section>`;
    openModal(modal);
    try {
      const data = await fetchMemberProfile(member.id);
      body.innerHTML = memberCardHTML(data);
    } catch (err) {
      body.innerHTML = `<section class="panel profile-hero member-card"><p class="member-card-loading">${escapeHTML(err.message || "Không tải được hồ sơ.")}</p></section>`;
    }
  }


  window.MemberCard = { open: openMemberCard };
})();
