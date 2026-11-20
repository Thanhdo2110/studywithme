/* ==========================================================================
   StudyWithMe — Vườn học tập: cây trồng & thú cưng nuôi bằng Study Star
   - Chọn 1 trong 5 cây trồng và 1 trong 5 thú cưng
   - Mỗi lần tưới nước / cho ăn: cây lớn lên thật (SVG vẽ dần thân, lá bung,
     hoa nở) chứ không đổi ảnh. 6 mốc: hạt → nảy mầm → thân → phân cành →
     tán lá → kết quả.
   ========================================================================== */

(function () {
  "use strict";

  const Store = window.Store;
  const { icon, escapeHTML, toast } = window.UI;

  const COSTS = [30, 60, 100, 150, 220]; // cây trồng
  const PET_COSTS = COSTS.map((c) => c * 3); // thú cưng đắt gấp 3 lần
  const MAX_LEVEL = 6;

  /* ---------------------------------------------------------------------- */
  /* SVG helpers                                                             */
  /* ---------------------------------------------------------------------- */

  let seq = 0;
  const stub = () => Math.min(seq++, 10);

  const LEAF_SHAPES = {
    oval: (l) =>
      `M0 0 C ${l * 0.3} ${-l * 0.44} ${l * 0.82} ${-l * 0.4} ${l} 0 C ${l * 0.82} ${l * 0.4} ${l * 0.3} ${l * 0.44} 0 0 Z`,
    narrow: (l) =>
      `M0 0 C ${l * 0.34} ${-l * 0.18} ${l * 0.76} ${-l * 0.15} ${l} 0 C ${l * 0.76} ${l * 0.15} ${l * 0.34} ${l * 0.18} 0 0 Z`,
    needle: (l) =>
      `M0 0 C ${l * 0.4} ${-l * 0.11} ${l * 0.72} ${-l * 0.08} ${l} 0 C ${l * 0.72} ${l * 0.08} ${l * 0.4} ${l * 0.11} 0 0 Z`,
  };

  /* Thân: vẽ dài dần bằng stroke-dash (pathLength = 1). */
  function stem(d, at, color, w) {
    return `<path class="gs" data-at="${at}" style="--i:${stub()}" pathLength="1" d="${d}" fill="none" stroke="${color}" stroke-width="${w || 3}" stroke-linecap="round"/>`;
  }

  /* Lá: bung ra từ gốc lá. */
  function leaf(x, y, angle, len, color, at, shape) {
    const d = (LEAF_SHAPES[shape] || LEAF_SHAPES.oval)(len);
    return `<g transform="translate(${x} ${y}) rotate(${angle})"><g class="gp" data-at="${at}" style="--i:${stub()};--r:-16deg"><path d="${d}" fill="${color}"/></g></g>`;
  }

  /* Nhóm phần tử chỉ hiện từ mốc `at` (kèm `until` nếu cần ẩn lại). */
  function grow(inner, at, until) {
    return `<g class="gp" data-at="${at}"${until ? ` data-until="${until}"` : ""} style="--i:${stub()}">${inner}</g>`;
  }

  /* Hoa: các cánh bung ra quanh nhụy. */
  function bloom(cx, cy, r, petal, core, at, count) {
    const n = count || 9;
    const petals = Array.from({ length: n }, (_, k) => {
      const a = ((360 / n) * k).toFixed(1);
      return `<ellipse cx="${(r * 0.62).toFixed(2)}" cy="0" rx="${(r * 0.52).toFixed(2)}" ry="${(r * 0.3).toFixed(2)}" fill="${petal}" transform="rotate(${a}) rotate(${k % 2 ? 7 : -7})"/>`;
    }).join("");
    return `<g transform="translate(${cx} ${cy})"><g class="gp" data-at="${at}" style="--i:${stub()};--r:-40deg">${petals}<circle r="${(r * 0.42).toFixed(2)}" fill="${core}"/></g></g>`;
  }

  function mound() {
    return `<ellipse class="g-shadow" cx="60" cy="116" rx="33" ry="6.5"/>
      <path class="g-mound" d="M26 114 C 36 106, 84 106, 94 114 C 84 119, 36 119, 26 114 Z"/>`;
  }

  function seedArt(color) {
    return `<g transform="translate(60 110)"><g class="gp seed" data-at="1" style="--i:0"><ellipse rx="8" ry="5.6" fill="${color}" transform="rotate(-16)"/><path d="M-2.6 -1.4 C -1 -2.8, 1.2 -2.6, 2.4 -1.2" stroke="rgba(255,255,255,.5)" stroke-width="1" fill="none" stroke-linecap="round"/></g></g>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Cây trồng                                                               */
  /* ---------------------------------------------------------------------- */

  function sunflowerArt() {
    const S = "#5f9350";
    const L = "#7cc473";
    return (
      mound() +
      seedArt("#a07840") +
      stem("M60 110 L60 92", 2, S, 2.8) +
      leaf(60, 94, -32, 14, L, 2) +
      leaf(60, 94, -148, 14, L, 2) +
      stem("M60 92 L60 80", 3, S, 3) +
      leaf(60, 90, -22, 14, L, 3) +
      leaf(60, 85, -158, 13, L, 3) +
      stem("M60 82 L60 63", 4, S, 3.2) +
      leaf(60, 74, -16, 15, L, 4) +
      stem("M60 63 L60 50", 5, S, 3.2) +
      leaf(60, 67, -168, 14, L, 5) +
      grow(`<circle cx="60" cy="44" r="7.6" fill="#8fbf6f"/><circle cx="60" cy="44" r="4.2" fill="#abd48b"/>`, 5, 5) +
      bloom(60, 44, 15, "#f6b93b", "#7a4b22", 6, 12)
    );
  }

  function roseArt() {
    const S = "#4f7f52";
    const L = "#69a865";
    const R = "#ef6f83";
    return (
      mound() +
      seedArt("#8c5a4a") +
      stem("M60 110 C 58 102, 60 97, 58 90", 2, S, 2.4) +
      leaf(58, 97, -42, 10, L, 2) +
      leaf(58, 97, -138, 10, L, 2) +
      stem("M58 90 C 52 84, 48 80, 46 74", 3, S, 2.6) +
      stem("M58 90 C 64 84, 68 80, 70 74", 3, S, 2.6) +
      leaf(51, 82, -38, 12, L, 3) +
      leaf(65, 82, -142, 12, L, 3) +
      stem("M58 90 C 58 82, 58 76, 58 70", 4, S, 2.8) +
      leaf(58, 79, -20, 13, L, 4) +
      leaf(47, 75, -118, 11, L, 4) +
      leaf(69, 75, -62, 11, L, 4) +
      grow(`<ellipse cx="58" cy="67" rx="5" ry="6.4" fill="#ef6f83"/><ellipse cx="46" cy="71" rx="4.4" ry="5.6" fill="#ef6f83"/><ellipse cx="70" cy="71" rx="4.4" ry="5.6" fill="#ef6f83"/>`, 5, 5) +
      bloom(58, 66, 10, "#ef6f83", "#c9435d", 6, 7) +
      bloom(46, 71, 9, "#f2879b", "#c9435d", 6, 7) +
      bloom(70, 71, 9, "#f2879b", "#c9435d", 6, 7)
    );
  }

  function cherryArt() {
    const S = "#8a5c46";
    const L = "#6fb877";
    const P = "#f7b8cd";
    const blossom = (x, y) =>
      `<circle cx="${x}" cy="${y}" r="4.2" fill="${P}"/><circle cx="${x}" cy="${y}" r="1.6" fill="#fff3f8"/>`;
    return (
      mound() +
      seedArt("#8a5c46") +
      stem("M60 110 L58 94", 2, S, 4) +
      leaf(58, 98, -38, 12, L, 2) +
      leaf(58, 98, -142, 12, L, 2) +
      stem("M58 94 C 56 86, 52 82, 46 77", 3, S, 3.4) +
      stem("M58 94 C 62 86, 66 82, 72 77", 3, S, 3.4) +
      leaf(52, 86, -52, 12, L, 3) +
      leaf(64, 86, -128, 12, L, 3) +
      stem("M58 94 L58 76", 4, S, 3) +
      stem("M46 77 C 44 71, 42 67, 40 63", 4, S, 2.6) +
      stem("M72 77 C 74 71, 76 67, 78 63", 4, S, 2.6) +
      grow(
        `<ellipse cx="58" cy="62" rx="25" ry="15" fill="${L}"/><ellipse cx="39" cy="53" rx="14" ry="9.5" fill="${L}"/><ellipse cx="77" cy="53" rx="14" ry="9.5" fill="${L}"/><ellipse cx="58" cy="48" rx="17" ry="11" fill="${L}"/>`,
        5
      ) +
      grow(
        [blossom(44, 50), blossom(56, 44), blossom(70, 50), blossom(50, 60), blossom(66, 61), blossom(60, 54), blossom(36, 60), blossom(80, 60), blossom(58, 68)].join(""),
        6
      )
    );
  }

  function cactusArt() {
    const C = "#63b87a";
    const D = "#4f9c66";
    const spine = (x, y, a) =>
      `<g transform="translate(${x} ${y}) rotate(${a})"><g class="gp" data-at="5" style="--i:${stub()}"><path d="M0 0 L5 0" stroke="${D}" stroke-width="1" stroke-linecap="round"/></g></g>`;
    return (
      mound() +
      seedArt("#8a6f52") +
      stem("M60 110 L60 96", 2, C, 15) +
      stem("M60 96 L60 82", 3, C, 15) +
      stem("M60 82 L60 68", 4, C, 14) +
      stem("M53 92 C 44 92, 41 88, 41 81", 4, C, 9) +
      stem("M67 86 C 76 86, 79 81, 79 74", 4, C, 9) +
      spine(52, 100, 200) +
      spine(68, 98, 20) +
      spine(52, 88, 195) +
      spine(68, 84, 15) +
      spine(56, 74, 210) +
      spine(64, 72, 10) +
      grow(`<ellipse cx="50" cy="98" rx="2" ry="1" fill="${D}" opacity=".6"/><ellipse cx="70" cy="90" rx="2" ry="1" fill="${D}" opacity=".6"/>`, 5) +
      bloom(60, 62, 8, "#ff9db1", "#f26d8d", 6, 6)
    );
  }

  function bambooArt() {
    const S = "#8cb972";
    const D = "#6d9b56";
    const L = "#7fc98f";
    const node = (y, at) => `<rect class="gp" data-at="${at}" style="--i:${stub()}" x="56" y="${y}" width="8" height="1.8" rx="0.9" fill="${D}"/>`;
    return (
      mound() +
      seedArt("#a0894f") +
      stem("M60 110 L60 94", 2, S, 7) +
      stem("M60 94 L60 76", 3, S, 7) +
      node(94, 3) +
      stem("M60 76 L60 58", 4, S, 7.5) +
      node(76, 4) +
      leaf(60, 80, -140, 15, L, 4, "narrow") +
      leaf(60, 74, -34, 14, L, 4, "narrow") +
      stem("M60 58 L60 42", 5, S, 7.5) +
      node(58, 5) +
      leaf(61, 66, -160, 13, L, 5, "narrow") +
      leaf(59, 60, -18, 13, L, 5, "narrow") +
      leaf(61, 50, -144, 14, L, 5, "narrow") +
      leaf(59, 46, -30, 14, L, 5, "narrow") +
      grow(`<ellipse cx="60" cy="60" rx="3" ry="2" fill="#cfe8a0" opacity=".8"/>`, 6, 5) +
      grow(
        `<ellipse cx="54" cy="48" rx="2.4" ry="1.6" fill="#e6f0b6" transform="rotate(-20 54 48)"/><ellipse cx="66" cy="44" rx="2.4" ry="1.6" fill="#e6f0b6" transform="rotate(18 66 44)"/><ellipse cx="60" cy="38" rx="2.4" ry="1.6" fill="#e6f0b6"/>`,
        6
      ) +
      leaf(60, 40, -128, 12, "#a7d97f", 6, "needle") +
      leaf(60, 38, -52, 12, "#a7d97f", 6, "needle")
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Thú cưng                                                                */
  /* ---------------------------------------------------------------------- */

  const PET_ART = {
    meo: { body: "#e9a15b", belly: "#fbe6cb", accent: "#c9762f", ears: "cat", tail: "cat" },
    cun: { body: "#c99a6b", belly: "#f7e7d3", accent: "#8a5f38", ears: "dog", tail: "dog" },
    tho: { body: "#efe7f8", belly: "#ffffff", accent: "#d68fae", ears: "rabbit", tail: "puff" },
    "cu-meo": { body: "#b08e74", belly: "#f3e3cd", accent: "#e6a24a", ears: "owl", tail: "owl" },
    rong: { body: "#8fb8f0", belly: "#dbe9ff", accent: "#4d7fd0", ears: "dragon", tail: "dragon", wings: true },
  };

  function earsShape(cfg) {
    const { body, accent } = cfg;
    if (cfg.ears === "cat") {
      return `<path d="M46 66 L49 45 L60 58 Z" fill="${body}"/><path d="M74 66 L71 45 L60 58 Z" fill="${body}"/><path d="M50 62 L52 50 L58 59 Z" fill="${accent}" opacity=".4"/><path d="M70 62 L68 50 L62 59 Z" fill="${accent}" opacity=".4"/>`;
    }
    if (cfg.ears === "dog") {
      return `<ellipse cx="43" cy="70" rx="6.4" ry="12" fill="${accent}" transform="rotate(16 43 70)"/><ellipse cx="77" cy="70" rx="6.4" ry="12" fill="${accent}" transform="rotate(-16 77 70)"/>`;
    }
    if (cfg.ears === "rabbit") {
      return `<ellipse cx="52" cy="54" rx="5.4" ry="14" fill="${body}" transform="rotate(-8 52 54)"/><ellipse cx="68" cy="54" rx="5.4" ry="14" fill="${body}" transform="rotate(8 68 54)"/><ellipse cx="52" cy="55" rx="2.6" ry="9" fill="${accent}" opacity=".35" transform="rotate(-8 52 55)"/><ellipse cx="68" cy="55" rx="2.6" ry="9" fill="${accent}" opacity=".35" transform="rotate(8 68 55)"/>`;
    }
    if (cfg.ears === "owl") {
      return `<path d="M46 61 L47 46 L57 57 Z" fill="${body}"/><path d="M74 61 L73 46 L63 57 Z" fill="${body}"/>`;
    }
    return `<path d="M49 59 L46 42 L58 55 Z" fill="${accent}"/><path d="M71 59 L74 42 L62 55 Z" fill="${accent}"/>`;
  }

  function tailShape(cfg, level) {
    if (level < 4) return "";
    const { body, accent, belly } = cfg;
    if (cfg.tail === "cat") {
      return `<path d="M75 101 C 90 102, 94 88, 86 80" stroke="${body}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    }
    if (cfg.tail === "dog") {
      return `<path d="M74 98 C 85 96, 88 88, 84 82" stroke="${body}" stroke-width="5.5" fill="none" stroke-linecap="round"/>`;
    }
    if (cfg.tail === "puff") {
      return `<circle cx="76" cy="100" r="7" fill="${body}"/><circle cx="76" cy="100" r="4.2" fill="${belly}"/>`;
    }
    if (cfg.tail === "owl") {
      return `<path d="M74 102 L84 97 L79 104 Z" fill="${body}"/>`;
    }
    return `<path d="M74 99 C 88 100, 93 90, 96 82" stroke="${body}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M95 83 L104 75 L99 90 Z" fill="${accent}"/>`;
  }

  function creatureArt(cfg, scale, level) {
    const eyes =
      cfg.ears === "owl"
        ? `<circle cx="53" cy="71" r="6.4" fill="#fff"/><circle cx="67" cy="71" r="6.4" fill="#fff"/><circle cx="53" cy="71" r="3" fill="#2a2f38"/><circle cx="67" cy="71" r="3" fill="#2a2f38"/>`
        : `<circle cx="54" cy="71" r="3.2" fill="#252b34"/><circle cx="66" cy="71" r="3.2" fill="#252b34"/><circle cx="55" cy="70" r="1.1" fill="#fff"/><circle cx="67" cy="70" r="1.1" fill="#fff"/>`;
    const face =
      cfg.ears === "owl"
        ? `<path d="M60 75 L56 82 L64 82 Z" fill="${cfg.accent}"/>`
        : `<ellipse cx="60" cy="79" rx="2.8" ry="2" fill="${cfg.accent}"/><path d="M56 83 C 58 86, 62 86, 64 83" stroke="${cfg.accent}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    const wings =
      level >= 6 && cfg.wings
        ? `<path d="M46 94 C 30 88, 22 74, 26 65 C 34 78, 40 84, 48 86 Z" fill="${cfg.accent}" opacity=".7"/><path d="M74 94 C 90 88, 98 74, 94 65 C 86 78, 80 84, 72 86 Z" fill="${cfg.accent}" opacity=".7"/>`
        : "";
    const legs =
      level >= 3
        ? `<rect x="48" y="101" width="10" height="9" rx="4.4" fill="${cfg.belly}"/><rect x="62" y="101" width="10" height="9" rx="4.4" fill="${cfg.belly}"/>`
        : "";
    return `<g transform="translate(60 116) scale(${scale}) translate(-60 -116)">
      ${tailShape(cfg, level)}${wings}
      <ellipse cx="60" cy="94" rx="16" ry="14" fill="${cfg.body}"/>
      <ellipse cx="60" cy="99" rx="9.5" ry="8" fill="${cfg.belly}"/>
      ${legs}
      <circle cx="60" cy="72" r="16" fill="${cfg.body}"/>
      ${earsShape(cfg)}${eyes}${face}
      ${level >= 6 ? `<circle class="g-aura" cx="60" cy="86" r="33" fill="none" stroke="${cfg.accent}" stroke-width="1.2" stroke-dasharray="3 6" opacity=".55"/>` : ""}
    </g>`;
  }

  function eggArt(cfg) {
    return `<ellipse cx="60" cy="90" rx="17" ry="21" fill="${cfg.body}"/>
      <ellipse cx="53" cy="81" rx="5" ry="7" fill="#ffffff" opacity=".45" transform="rotate(-18 53 81)"/>
      <circle cx="67" cy="97" r="2.4" fill="${cfg.belly}" opacity=".65"/>
      <circle cx="59" cy="103" r="1.8" fill="${cfg.belly}" opacity=".55"/>
      <circle cx="72" cy="87" r="1.6" fill="${cfg.belly}" opacity=".55"/>`;
  }

  function hatchArt(cfg) {
    return `<path d="M43 89 L48 93 L52 87 L57 93 L60 87 L64 93 L68 87 L72 93 L77 89 C 77 107, 43 107, 43 89 Z" fill="${cfg.belly}" stroke="${cfg.body}" stroke-width="1.6"/>
      <circle cx="60" cy="77" r="12" fill="${cfg.body}"/>
      ${earsShape(cfg)}
      <circle cx="55" cy="76" r="2.6" fill="#252b34"/><circle cx="65" cy="76" r="2.6" fill="#252b34"/>
      <ellipse cx="60" cy="82" rx="2.4" ry="1.8" fill="${cfg.accent}"/>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Danh mục                                                               */
  /* ---------------------------------------------------------------------- */

  const PLANTS = [
    { id: "huong-duong", name: "Hướng dương", desc: "Luôn hướng về phía ánh sáng", tint: "#f0b429", art: sunflowerArt },
    { id: "hong", name: "Hoa hồng", desc: "Dịu dàng nhưng đầy gai", tint: "#ef6f83", art: roseArt },
    { id: "anh-dao", name: "Anh đào", desc: "Nở rộ sau những ngày kiên trì", tint: "#f2a0c0", art: cherryArt },
    { id: "xuong-rong", name: "Xương rồng", desc: "Bền bỉ ngay cả khi khô hạn", tint: "#63b87a", art: cactusArt },
    { id: "tre", name: "Tre xanh", desc: "Mỗi ngày cao thêm một đốt", tint: "#7fc98f", art: bambooArt },
  ];

  const PETS = [
    { id: "meo", name: "Mèo con", desc: "Nằm cạnh bạn suốt ca học", tint: "#e9a15b" },
    { id: "cun", name: "Cún con", desc: "Vui vẻ chờ bạn hoàn thành mục tiêu", tint: "#c99a6b" },
    { id: "tho", name: "Thỏ trắng", desc: "Lặng lẽ nghe bạn đọc bài", tint: "#c3b8e8" },
    { id: "cu-meo", name: "Cú mèo", desc: "Thức cùng bạn những đêm ôn thi", tint: "#9db6d8" },
    { id: "rong", name: "Rồng con", desc: "Lớn lên nhờ từng phút tập trung", tint: "#8fb8f0" },
  ];

  const PET_SCALE = { 3: 0.7, 4: 0.82, 5: 0.96, 6: 1.02 };

  function plantSVG(id, level) {
    const entry = PLANTS.find((item) => item.id === id) || PLANTS[0];
    seq = 0;
    return `<svg class="g-svg g-svg--plant" viewBox="0 0 120 130" data-stage="${level}" role="img" aria-label="Cây ${escapeHTML(entry.name)}">${entry.art()}</svg>`;
  }

  function petSVG(id, level, ready) {
    const cfg = PET_ART[id] || PET_ART.meo;
    const entry = PETS.find((item) => item.id === id) || PETS[0];
    const stage = (lv, inner) => {
      const on = ready && lv === level ? " on" : "";
      return `<g class="pet-stage${on}" data-at="${lv}" data-until="${lv}">${inner}</g>`;
    };
    return `<svg class="g-svg g-svg--pet" viewBox="0 0 120 130" data-stage="${level}" role="img" aria-label="${escapeHTML(entry.name)}">
      <ellipse class="g-shadow" cx="60" cy="118" rx="25" ry="5.5"/>
      ${stage(1, eggArt(cfg))}
      ${stage(2, hatchArt(cfg))}
      ${[3, 4, 5, 6].map((lv) => stage(lv, creatureArt(cfg, PET_SCALE[lv], lv))).join("")}
    </svg>`;
  }

  function applyStage(svg, stage) {
    if (!svg) return;
    svg.dataset.stage = String(stage);
    svg.querySelectorAll("[data-at]").forEach((el) => {
      const at = Number(el.dataset.at);
      const until = el.dataset.until ? Number(el.dataset.until) : Infinity;
      el.classList.toggle("on", stage >= at && stage <= until);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Truy cập dữ liệu                                                       */
  /* ---------------------------------------------------------------------- */

  const root = () => document.getElementById("gardenPanel");
  let pickKind = null;
  let busy = null;
  let audioCtx = null;

  function catalogFor(kind) {
    return kind === "plant" ? PLANTS : PETS;
  }

  function levelOf(kind, id) {
    const garden = Store.state.garden || {};
    const levels = garden[kind === "plant" ? "plants" : "pets"] || {};
    return Math.min(MAX_LEVEL, Math.max(1, Number(levels[id]) || 1));
  }

  function entryFor(kind, id) {
    return catalogFor(kind).find((item) => item.id === id) || null;
  }

  function paintStars(value) {
    const el = document.getElementById("gardenStars");
    if (el) el.textContent = `${Math.round(value).toLocaleString("vi-VN")} ★`;
    const input = document.getElementById("pStars");
    if (input) input.value = Math.round(value).toLocaleString("vi-VN");
  }

  function starsLabel() {
    const stars = Number(Store.state.profile.stars || 0);
    paintStars(stars);
    return stars;
  }

  /* Sao trừ dần mượt mà thay vì nhảy số. */
  function animateStars(from, to) {
    const start = Number(from) || 0;
    const end = Number(to) || 0;
    if (start === end) return paintStars(end);
    const el = document.getElementById("gardenStars");
    if (el) {
      el.classList.remove("is-paying");
      void el.offsetWidth;
      el.classList.add("is-paying");
      window.setTimeout(() => el.classList.remove("is-paying"), 900);
    }
    const t0 = performance.now();
    const dur = 720;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      paintStars(start + (end - start) * eased);
      if (p < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------------- */
  /* Picker                                                                 */
  /* ---------------------------------------------------------------------- */

  function choiceHTML(kind, item, activeId) {
    const active = activeId === item.id;
    const art = kind === "plant" ? plantSVG(item.id, MAX_LEVEL) : petSVG(item.id, MAX_LEVEL);
    return `<button type="button" class="garden-choice${active ? " is-active" : ""}"
      data-pick="${kind}" data-id="${item.id}" aria-pressed="${active}" style="--tint:${item.tint}">
      <span class="gc-scene" aria-hidden="true">
        <span class="gc-glow"></span>
        <span class="gc-art">${art}</span>
      </span>
      <b>${escapeHTML(item.name)}</b>
      <span class="gc-desc">${escapeHTML(item.desc)}</span>
      <span class="gc-state">${active ? icon("check") + " Đang chọn" : "Chọn"}</span>
    </button>`;
  }

  function pickerHTML(kind) {
    const garden = Store.state.garden || {};
    const activeId = garden[kind] || null;
    const title = kind === "plant" ? "Chọn cây trồng của bạn" : "Chọn thú cưng đồng hành";
    const note =
      kind === "plant"
        ? "Cây lớn lên nhờ những phút tập trung — từ hạt mầm tới ngày kết quả."
        : "Thú cưng sẽ ở cạnh bạn mỗi khi học, lớn dần theo từng ca tập trung.";
    const step = kind === "plant" ? 1 : 2;
    return `<div class="garden-picker">
      <div class="garden-picker-head">
        <div class="garden-picker-top">
          <span class="garden-step">${activeId ? "Đổi lựa chọn" : `Bước ${step} / 2`}</span>
          <span class="garden-step-dots" aria-hidden="true"><i class="on"></i><i class="${step === 2 ? "on" : ""}"></i></span>
        </div>
        <h3>${title}</h3>
        <p>${note}</p>
      </div>
      <div class="garden-choices" role="listbox" aria-label="${title}">
        ${catalogFor(kind).map((item) => choiceHTML(kind, item, activeId)).join("")}
      </div>
      ${activeId ? '<button type="button" class="btn btn-ghost btn-sm garden-cancel" data-cancel>Giữ lựa chọn hiện tại</button>' : ""}
    </div>`;
  }

  /* ---------------------------------------------------------------------- */
  /* Thẻ vườn                                                               */
  /* ---------------------------------------------------------------------- */

  function canSVG() {
    return `<svg class="garden-tool garden-tool--can" viewBox="0 0 52 40" aria-hidden="true">
      <path d="M15 12 h18 a4 4 0 0 1 4 4 v12 a6 6 0 0 1 -6 6 H21 a6 6 0 0 1 -6 -6 Z" fill="currentColor" opacity=".9"/>
      <path d="M15 14 L4 6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M37 10 a5 5 0 1 0 0.1 0" fill="none" stroke="currentColor" stroke-width="2.6"/>
      <path d="M4 6 l-3 -1" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    </svg>`;
  }

  function bowlSVG() {
    return `<svg class="garden-tool garden-tool--bowl" viewBox="0 0 52 26" aria-hidden="true">
      <path d="M6 10 h40 a20 17 0 0 1 -40 0 Z" fill="currentColor" opacity=".85"/>
      <ellipse cx="26" cy="10" rx="8" ry="2.6" fill="#ffffff" opacity=".32"/>
    </svg>`;
  }

  function trackHTML(level) {
    const ratio = (level - 1) / (MAX_LEVEL - 1);
    const nodes = Array.from({ length: MAX_LEVEL }, (_, i) => {
      const n = i + 1;
      const state = n < level ? " is-done" : n === level ? " is-current" : "";
      return `<i class="gt-node${state}"></i>`;
    }).join("");
    return `<div class="garden-track" aria-hidden="true" style="--ratio:${ratio.toFixed(3)}">
      <span class="gt-rail"></span>
      <span class="gt-fill"></span>
      ${nodes}
    </div>`;
  }

  /* Bối cảnh SVG: đồi, thảm cỏ, hoa — dày dần theo cấp. */
  function tuft(x, y, scale, i) {
    return `<g class="sc-tuft" transform="translate(${x} ${y}) scale(${scale})" style="--i:${i}">
      <path d="M0 0 C-4 -5 -6 -9 -7 -14"/>
      <path d="M0 0 C0 -6 0.6 -11 1.5 -17"/>
      <path d="M0 0 C4 -5 6.5 -8 8 -12"/>
    </g>`;
  }

  function wildFlower(x, y, scale, i) {
    return `<g class="sc-flower" transform="translate(${x} ${y}) scale(${scale})" style="--i:${i}">
      <path class="sc-flower-stem" d="M0 0 C-1 -4 0.8 -7 0 -10"/>
      <circle class="sc-petal" cx="0" cy="-2.5" r="1.9"/>
      <circle class="sc-petal" cx="2.4" cy="-0.8" r="1.9"/>
      <circle class="sc-petal" cx="1.5" cy="2" r="1.9"/>
      <circle class="sc-petal" cx="-1.5" cy="2" r="1.9"/>
      <circle class="sc-petal" cx="-2.4" cy="-0.8" r="1.9"/>
      <circle class="sc-flower-core" cy="-10" r="1.5"/>
    </g>`;
  }

  function scenerySVG(level) {
    const deco = [];
    if (level >= 2) {
      deco.push(tuft(34, 147, 1, 0), tuft(263, 150, 0.9, 1));
    }
    if (level >= 3) {
      deco.push(wildFlower(50, 144, 1, 2), wildFlower(245, 141, 0.9, 3));
    }
    if (level >= 4) {
      deco.push(
        tuft(78, 152, 0.82, 4),
        tuft(224, 153, 0.88, 5),
        '<ellipse class="sc-pebble" cx="152" cy="151" rx="4.6" ry="2.2"/>',
        '<ellipse class="sc-pebble" cx="138" cy="154" rx="3" ry="1.6"/>'
      );
    }
    if (level >= 5) {
      deco.push(
        wildFlower(21, 151, 0.9, 6),
        wildFlower(280, 148, 0.82, 7),
        tuft(112, 157, 0.72, 8),
        tuft(192, 157, 0.72, 9)
      );
    }
    if (level >= 6) {
      deco.push(wildFlower(66, 154, 0.7, 10), wildFlower(232, 155, 0.7, 11));
    }

    return `<svg class="garden-scenery" viewBox="0 0 300 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path class="sc-hill sc-hill--far" d="M-12 119 C 38 101 78 114 118 105 C 166 94 208 111 250 100 C 274 94 292 101 312 95 L312 168 L-12 168 Z"/>
      <path class="sc-hill sc-hill--near" d="M-12 133 C 32 120 74 131 116 125 C 164 118 204 131 246 123 C 272 118 292 126 312 119 L312 168 L-12 168 Z"/>
      <path class="sc-ground" d="M-12 147 C 48 138 102 149 154 143 C 212 136 260 146 312 140 L312 168 L-12 168 Z"/>
      ${deco.join("")}
    </svg>`;
  }

  function moteHTML(level) {
    const count = Math.min(9, 2 + level);
    return Array.from({ length: count }, (_, i) => {
      const x = 8 + Math.random() * 84;
      const y = 26 + Math.random() * 54;
      return `<i class="garden-mote" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--d:${(Math.random() * 4).toFixed(2)}s;--t:${(3.4 + Math.random() * 2.6).toFixed(2)}s;--s:${(0.8 + Math.random() * 0.9).toFixed(2)}"></i>`;
    }).join("");
  }

  function sceneHTML(kind, level, max, art) {
    return `<div class="garden-scene garden-scene--${kind}${max ? " is-max" : ""}" data-level="${level}">
      <span class="garden-sun" aria-hidden="true"></span>
      <span class="garden-cloud c1" aria-hidden="true"></span>
      <span class="garden-cloud c2" aria-hidden="true"></span>
      <span class="garden-cloud c3" aria-hidden="true"></span>
      ${scenerySVG(level)}
      <span class="garden-motes" aria-hidden="true">${moteHTML(level)}</span>
      <span class="garden-halo" aria-hidden="true"></span>
      ${kind === "plant" ? canSVG() : bowlSVG()}
      ${kind === "pet" ? '<span class="garden-cushion" aria-hidden="true"></span><span class="garden-hearts" aria-hidden="true"><i></i><i></i><i></i></span>' : ""}
      ${level >= 3 ? '<span class="garden-butterfly" aria-hidden="true">🦋</span>' : ""}
      <div class="garden-actor">${art}</div>
      <span class="garden-fx" aria-hidden="true"></span>
    </div>`;
  }

  function nextHTML(kind, level) {
    if (level >= MAX_LEVEL) {
      return `<p class="garden-next is-max">${icon("sparkles")} Đã trọn vẹn — không còn gì để chăm sóc</p>`;
    }
    const cost = (kind === "plant" ? COSTS : PET_COSTS)[level - 1];
    return `<p class="garden-next">${icon("star")} Còn <b>${cost.toLocaleString("vi-VN")} ★</b> để chăm sóc lượt tiếp theo</p>`;
  }

  function tendButtonHTML(kind, level) {
    const max = level >= MAX_LEVEL;
    if (max) {
      return `<button type="button" class="btn btn-ghost btn-sm garden-tend is-max" disabled>
        ${icon("trophy")} ${kind === "plant" ? "Đã kết quả" : "Huyền thoại"}
      </button>`;
    }
    const cost = (kind === "plant" ? COSTS : PET_COSTS)[level - 1];
    const action = kind === "plant" ? "Tưới nước" : "Cho ăn";
    return `<button type="button" class="btn btn-accent btn-sm garden-tend" data-tend="${kind}">
      ${icon(kind === "plant" ? "droplet" : "heart")}
      <span>${action}</span>
      <span class="gt-cost">${cost.toLocaleString("vi-VN")} ★</span>
    </button>`;
  }

  function cardHTML(kind) {
    const garden = Store.state.garden || {};
    const id = garden[kind];
    const entry = entryFor(kind, id);
    if (!entry) return "";
    const level = levelOf(kind, id);
    const max = level >= MAX_LEVEL;
    const art = kind === "plant" ? plantSVG(id, level) : petSVG(id, level);
    const label = kind === "plant" ? "Cây trồng" : "Thú cưng";

    return `<article class="garden-card" data-card="${kind}" style="--tint:${entry.tint}">
      <header class="garden-card-head">
        <span class="garden-tag">${icon(kind === "plant" ? "sprout" : "heart")} ${label}</span>
        <button type="button" class="garden-change" data-change="${kind}">Đổi</button>
      </header>

      ${sceneHTML(kind, level, max, art)}

      <div class="garden-meta">
        <b>${escapeHTML(entry.name)}</b>
        <span class="garden-meta-note">${max ? "Đã trọn vẹn" : "Mỗi lần tưới, lớn thêm một mốc"}</span>
      </div>
      ${trackHTML(level)}
      ${nextHTML(kind, level)}
      ${tendButtonHTML(kind, level)}
      <p class="sr-only" data-live aria-live="polite"></p>
    </article>`;
  }

  function render() {
    const host = root();
    if (!host) return;
    const garden = Store.state.garden || {};
    starsLabel();

    if (pickKind || !garden.plant || !garden.pet) {
      host.innerHTML = pickerHTML(pickKind || (garden.plant ? "pet" : "plant"));
      host.querySelectorAll(".gc-art .g-svg").forEach((svg) => applyStage(svg, MAX_LEVEL));
      return;
    }

    host.innerHTML = `<div class="garden-cards">${cardHTML("plant")}${cardHTML("pet")}</div>
      <p class="garden-note">${icon("star")} Mỗi phút tập trung hợp lệ nhận 1 Sao. Sao dùng để tưới cây và cho thú cưng ăn.</p>`;
    host.querySelectorAll(".g-svg").forEach((svg) => applyStage(svg, Number(svg.dataset.stage) || 1));
  }

  /* ---------------------------------------------------------------------- */
  /* Animation                                                               */
  /* ---------------------------------------------------------------------- */

  /* Cập nhật bối cảnh tại chỗ sau khi lên cấp (không render lại để giữ
     hiệu ứng lớn lên của SVG). */
  function refreshScene(scene, kind, level, max) {
    scene.classList.toggle("is-max", max);
    scene.dataset.level = String(level);

    const old = scene.querySelector(".garden-scenery");
    if (old) old.outerHTML = scenerySVG(level);

    if (level >= 3 && !scene.querySelector(".garden-butterfly")) {
      const fly = document.createElement("span");
      fly.className = "garden-butterfly";
      fly.setAttribute("aria-hidden", "true");
      fly.textContent = "🦋";
      const actor = scene.querySelector(".garden-actor");
      scene.insertBefore(fly, actor || null);
    }
  }

  function refreshCard(card, kind, level) {
    const entry = entryFor(kind, (Store.state.garden || {})[kind]);
    const max = level >= MAX_LEVEL;

    const meta = card.querySelector(".garden-meta");
    if (meta) {
      meta.innerHTML = `<b>${escapeHTML(entry ? entry.name : "")}</b><span class="garden-meta-note">${max ? "Đã trọn vẹn" : "Mỗi lần tưới, lớn thêm một mốc"}</span>`;
    }

    const track = card.querySelector(".garden-track");
    if (track) {
      const ratio = (level - 1) / (MAX_LEVEL - 1);
      track.style.setProperty("--ratio", ratio.toFixed(3));
      track.querySelectorAll(".gt-node").forEach((node, i) => {
        const n = i + 1;
        node.classList.toggle("is-done", n < level);
        node.classList.toggle("is-current", n === level);
      });
    }

    const next = card.querySelector(".garden-next");
    if (next) next.outerHTML = nextHTML(kind, level);

    const btn = card.querySelector(".garden-tend");
    if (btn) {
      btn.outerHTML = tendButtonHTML(kind, level);
      const fresh = card.querySelector(".garden-tend");
      if (fresh) {
        fresh.classList.add("just-paid");
        window.setTimeout(() => fresh.classList.remove("just-paid"), 900);
      }
    }

    const live = card.querySelector("[data-live]");
    if (live) {
      live.textContent = `${entry ? entry.name : "Bạn nhỏ"} vừa lớn thêm một mốc${max ? " và đã trọn vẹn" : ""}.`;
    }
  }

  function chime(level) {
    if (Store.state.profile.sounds === false) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = audioCtx || new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t0 = audioCtx.currentTime + 0.02;
      const base = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98][Math.max(0, Math.min(5, level - 1))];
      const notes = [base * 0.75, base, base * 1.25, base * 1.5];
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = i % 2 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, t0 + i * 0.085);
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.085);
        gain.gain.exponentialRampToValueAtTime(0.07, t0 + i * 0.085 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.085 + 0.5);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t0 + i * 0.085);
        osc.stop(t0 + i * 0.085 + 0.55);
      });
    } catch (err) {
      /* Âm thanh là phần thưởng thêm — bỏ qua nếu trình duyệt chặn. */
    }
  }

  function celebrateHTML(entry) {
    const palette = [entry.tint, "#ffd66b", "#ffffff", "#9fe3a7", entry.tint];
    const confetti = Array.from({ length: 24 }, (_, i) => {
      const angle = (-90 + (Math.random() * 168 - 84)) * (Math.PI / 180);
      const dist = 52 + Math.random() * 96;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist + 26;
      const color = palette[i % palette.length];
      return `<span class="garden-confetti" style="--tx:${tx.toFixed(0)}px;--ty:${ty.toFixed(0)}px;--rot:${(Math.random() * 620 - 310).toFixed(0)}deg;--c:${color};--d:${(Math.random() * 0.18).toFixed(2)}s;--w:${(3 + Math.random() * 4).toFixed(1)}px;--h:${(5 + Math.random() * 7).toFixed(1)}px"></span>`;
    }).join("");
    return `<span class="garden-flash"></span>
      <span class="garden-rays"></span>
      <span class="garden-wave"></span>
      <span class="garden-wave w2"></span>
      ${confetti}`;
  }

  function playTend(kind, level) {
    const card = document.querySelector(`.garden-card[data-card="${kind}"]`);
    if (!card) return;
    const scene = card.querySelector(".garden-scene");
    const svg = card.querySelector(".g-svg");
    const fx = card.querySelector(".garden-fx");
    const entry = entryFor(kind, (Store.state.garden || {})[kind]);
    if (!scene || !svg || !fx || !entry) return;

    const max = level >= MAX_LEVEL;
    scene.classList.add(kind === "plant" ? "is-watering" : "is-feeding");

    const drops = kind === "plant" ? 10 : 8;
    fx.innerHTML = Array.from({ length: drops }, (_, i) => {
      const x = 16 + Math.random() * 68;
      return `<span class="garden-drop" style="--x:${x.toFixed(1)}%;--d:${(i * 0.06).toFixed(2)}s"></span>`;
    }).join("");

    /* Nạp năng lượng: cây rung nhẹ, hào quang sáng dần. */
    window.setTimeout(() => scene.classList.add("is-charging"), 560);

    /* Bùng nổ: đổi giai đoạn SVG, vòng sáng, pháo giấy, biển "Lên cấp". */
    window.setTimeout(() => {
      scene.classList.remove("is-charging");
      scene.classList.add("is-evolving");
      applyStage(svg, level);
      refreshScene(scene, kind, level, max);
      refreshCard(card, kind, level);

      fx.innerHTML = celebrateHTML(entry);
      const banner = document.createElement("span");
      banner.className = "garden-levelup";
      banner.innerHTML = `<small>Lớn thêm</small><b>${level}</b>`;
      scene.appendChild(banner);
      window.setTimeout(() => banner.classList.add("is-out"), 1600);
      window.setTimeout(() => banner.remove(), 2200);

      card.classList.add("is-levelup");
      chime(level);
    }, 1180);

    window.setTimeout(() => {
      scene.classList.remove("is-watering", "is-feeding", "is-evolving");
      card.classList.remove("is-levelup");
      busy = null;
    }, 3100);
  }

  /* ---------------------------------------------------------------------- */
  /* Sự kiện                                                                */
  /* ---------------------------------------------------------------------- */

  async function pick(kind, id, btn) {
    btn.disabled = true;
    try {
      await Store.chooseCompanion(kind, id);
      pickKind = null;
      render();
      const entry = entryFor(kind, id);
      toast(kind === "plant" ? `Đã gieo ${entry.name.toLowerCase()}!` : `${entry.name} đã về nhà!`);
    } catch (err) {
      toast(err.message || "Không chọn được. Hãy thử lại.", "danger");
      render();
    }
  }

  async function tend(kind, btn) {
    const id = (Store.state.garden || {})[kind];
    if (!id) return;
    if (busy) return;
    const level = levelOf(kind, id);
    if (level >= MAX_LEVEL) {
      toast("Đồng hành này đã ở giai đoạn cuối.");
      return;
    }
    const cost = (kind === "plant" ? COSTS : PET_COSTS)[level - 1];
    const stars = Number(Store.state.profile.stars || 0);
    if (stars < cost) {
      toast(`Cần thêm ${(cost - stars).toLocaleString("vi-VN")} ★. Hãy học thêm một ca nhé!`, "warning");
      return;
    }

    btn.disabled = true;
    busy = kind;
    try {
      const data = await Store.tendGarden(kind, id);
      const next = Math.min(MAX_LEVEL, Number(data.level) || level + 1);
      animateStars(stars, data.stars);
      playTend(kind, next);
      if (window.Shell) window.Shell.refresh();
      if (next >= MAX_LEVEL) {
        window.setTimeout(() => {
          toast(kind === "plant" ? "Cây đã kết quả — giai đoạn cuối!" : "Thú cưng đã thành huyền thoại!");
        }, 1500);
      }
    } catch (err) {
      busy = null;
      toast(err.message || "Không chăm sóc được. Hãy thử lại.", "danger");
      render();
    }
  }

  function bind() {
    const host = root();
    if (!host) return;
    host.addEventListener("click", (event) => {
      const pickBtn = event.target.closest("[data-pick]");
      if (pickBtn) {
        pick(pickBtn.dataset.pick, pickBtn.dataset.id, pickBtn);
        return;
      }
      const changeBtn = event.target.closest("[data-change]");
      if (changeBtn) {
        pickKind = changeBtn.dataset.change;
        render();
        return;
      }
      if (event.target.closest("[data-cancel]")) {
        pickKind = null;
        render();
        return;
      }
      const tendBtn = event.target.closest("[data-tend]");
      if (tendBtn) tend(tendBtn.dataset.tend, tendBtn);
    });
  }

  /* Thú cưng / cây trồng đang chọn hiện cạnh avatar ở đầu trang hồ sơ.
     Giống như thú cưng: hiện từ mốc thứ 2 (đã nảy mầm / nở khỏi trứng). */
  function petBadgeFor(petId, level) {
    const entry = entryFor("pet", petId);
    if (!entry || level < 2) return "";
    return `<span class="garden-hero-pet" style="--tint:${entry.tint}">${petSVG(petId, level, true)}</span>`;
  }

  function heroPet() {
    const garden = Store.state.garden || {};
    if (!garden.pet) return "";
    return petBadgeFor(garden.pet, levelOf("pet", garden.pet));
  }

  /* Hoa mini theo bảng màu của từng loại cây — dùng trang trí avatar khi
     cây đã trọn vẹn (mốc cuối). */
  const PLANT_FLOWER = {
    "huong-duong": { petal: "#f6b93b", core: "#7a4b22" },
    "hong": { petal: "#ef6f83", core: "#c9435d" },
    "anh-dao": { petal: "#f7b8cd", core: "#fff3f8" },
    "xuong-rong": { petal: "#ff9db1", core: "#f26d8d" },
    "tre": { petal: "#cfe8a0", core: "#a7d97f" },
  };

  function flowerBadge(id) {
    const f = PLANT_FLOWER[id] || PLANT_FLOWER["huong-duong"];
    const n = 6;
    let petals = "";
    for (let k = 0; k < n; k++) {
      petals += `<ellipse cx="4.4" cy="0" rx="4" ry="2.4" fill="${f.petal}" transform="rotate(${((360 / n) * k).toFixed(1)})"/>`;
    }
    return `<svg viewBox="0 0 14 14" aria-hidden="true"><g transform="translate(7 7)">${petals}<circle r="2.4" fill="${f.core}"/></g></svg>`;
  }

  /* Nền hoa rải ngẫu nhiên khắp hero: chia lưới ô rồi cho mỗi hoa lệch trong
     ô của nó — phủ đều toàn nền, không cụm về một chỗ. Seed theo tài khoản
     + loại cây nên bố cục ổn định qua mỗi lần tải, mỗi vườn mỗi khác. */
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const HERO_FLOWER_GRID = { cols: 4, rows: 3 };

  /* Nền hoa toàn khung: loang màu hoa + hoa nở rải ngẫu nhiên. Dùng cho cả
     trang hồ sơ (khi cây của mình trọn vẹn) và thẻ hồ sơ thành viên trong
     phòng (khi cây của họ trọn vẹn). */
  function flowerbedFor(plantId, seedKey) {
    const entry = PLANTS.find((item) => item.id === plantId);
    if (!entry) return "";
    const rnd = (window.DATA && window.DATA.mulberry32
      ? window.DATA.mulberry32(hashSeed(entry.id + "|" + (seedKey || "")))
      : Math.random);
    const { cols, rows } = HERO_FLOWER_GRID;
    let flowers = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols + (rnd() - 0.5) * (0.55 / cols)) * 100;
        const y = ((r + 0.5) / rows + (rnd() - 0.5) * (0.55 / rows)) * 100;
        const s = 15 + rnd() * 12;
        const rot = Math.round(rnd() * 60 - 30);
        flowers += `<i class="hero-flower" style="--s:${s.toFixed(1)}px;--rot:${rot}deg;left:${x.toFixed(1)}%;top:${y.toFixed(1)}%">${flowerBadge(entry.id)}</i>`;
      }
    }
    return `<span class="hero-flowerbed" style="--tint:${entry.tint}" title="Cây ${escapeHTML(entry.name)} đã trọn vẹn — hoa điểm nền" aria-hidden="true">${flowers}</span>`;
  }

  function heroFlowerbed() {
    const garden = Store.state.garden || {};
    if (!garden.plant) return "";
    const level = levelOf("plant", garden.plant);
    if (level < MAX_LEVEL) return "";
    return flowerbedFor(garden.plant, (Store.account && Store.account.id) || "");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!root()) return;
    bind();
    render();
  });

  window.Garden = { render, heroPet, heroFlowerbed, flowerbedFor, petBadgeFor };
})();
