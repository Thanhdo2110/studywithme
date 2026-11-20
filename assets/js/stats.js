/* ==========================================================================
   StudyWithMe — Stats (heatmap, charts, streak, achievements)
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { icon, escapeHTML, streakCard } = window.UI;

  let range = 90;
  let model = null;
  let stats = null;

  const tooltip = document.getElementById("heatTooltip");
  const WEEK_MS = 7 * D.DAY;

  const levelOf = (m) => (m <= 0 ? 0 : m < 50 ? 1 : m < 100 ? 2 : m < 160 ? 3 : 4);

  function buildModel(days) {
    const today = D.startOfToday();
    const start = D.addDays(today, -(days - 1));
    const offset = (start.getDay() + 6) % 7;
    const gridStart = D.addDays(start, -offset);
    const totalDays = Math.round((today.getTime() - gridStart.getTime()) / D.DAY) + 1;
    const weeks = Math.ceil(totalDays / 7);
    const cells = [];

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = D.addDays(gridStart, w * 7 + d);
        const isFuture = date.getTime() > today.getTime();
        const inRange = date.getTime() >= start.getTime() && !isFuture;
        cells.push({
          date,
          inRange,
          future: isFuture,
          minutes: inRange ? D.minutesForDay(date) : 0,
        });
      }
    }

    const inRange = cells.filter((c) => c.inRange);
    const total = inRange.reduce((sum, c) => sum + c.minutes, 0);
    const best = inRange.reduce((a, b) => (b.minutes > a.minutes ? b : a), inRange[0] || { minutes: 0, date: today });

    // streak (up to 365 days, not limited by range)
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const date = D.addDays(today, -i);
      if (D.minutesForDay(date) > 0) streak++;
      else break;
    }

    return { days, start, today, gridStart, weeks, cells, total, avg: Math.round(total / days), best, streak };
  }

  function renderHeatmap() {
    model = buildModel(range);
    stats = model;

    const grid = document.getElementById("heatGrid");
    const months = document.getElementById("heatMonths");

    grid.style.gridTemplateColumns = `repeat(${model.weeks}, 12px)`;
    grid.innerHTML = model.cells
      .map((cell) => {
        if (!cell.inRange && !cell.future) {
          return `<div class="heat-cell" style="visibility:hidden"></div>`;
        }
        if (cell.future) {
          return `<div class="heat-cell future"></div>`;
        }
        const level = levelOf(cell.minutes);
        return `<div class="heat-cell" data-level="${level}" data-date="${D.iso(cell.date)}" data-minutes="${cell.minutes}" title="${D.longDate(cell.date)} · ${D.formatMinutes(cell.minutes)}"></div>`;
      })
      .join("");

    // month labels
    const segments = [];
    for (let w = 0; w < model.weeks; w++) {
      const weekStart = D.addDays(model.gridStart, w * 7);
      const m = weekStart.getMonth();
      if (!segments.length || segments[segments.length - 1].m !== m) {
        segments.push({ m, n: 0 });
      }
      segments[segments.length - 1].n++;
    }
    months.innerHTML = segments
      .map((s) => `<span style="width:${s.n * 15}px">T${s.m + 1}</span>`)
      .join("");

    document.getElementById("heatRange").textContent =
      range === 90 ? "90 ngày gần nhất" : range === 180 ? "6 tháng gần nhất" : "1 năm gần nhất";
    document.getElementById("heatTotal").textContent = D.formatMinutes(model.total);
    const studied = model.cells.filter((c) => c.inRange && c.minutes > 0).length;
    document.getElementById("heatDays").textContent = `${studied} / ${model.days}`;
    document.getElementById("heatAvg").textContent = D.formatMinutes(model.avg);
    document.getElementById("heatStreak").textContent = `${Store.state.profile.streak || 0} ngày`;
    document.getElementById("heatBest").textContent =
      model.best.minutes > 0 ? `${D.formatMinutes(model.best.minutes)} · ${D.longDate(model.best.date)}` : "—";

    renderKpis();
    renderRecentChart();
  }

  /* Chuỗi dài nhất trong dữ liệu đang có — thay cho con số ghi cứng trước đây. */
  function longestStreak() {
    const daily = Store.state.daily || {};
    const days = Object.keys(daily)
      .filter((key) => Number(daily[key]) > 0)
      .sort();
    let best = 0;
    let run = 0;
    let prev = null;
    days.forEach((key) => {
      const time = D.parseISO(key).getTime();
      run = prev !== null && Math.round((time - prev) / D.DAY) === 1 ? run + 1 : 1;
      if (run > best) best = run;
      prev = time;
    });
    return Math.max(best, Store.state.profile.streak || 0);
  }

  function renderKpis() {
    const cards = [
      {
        label: "Tổng thời gian",
        value: D.formatMinutes(model.total),
        icon: "clock",
        foot: `${range} ngày · ${(model.total / 60).toFixed(1)} giờ`,
      },
      {
        label: "Trung bình / ngày",
        value: D.formatMinutes(model.avg),
        icon: "activity",
        foot: `Mục tiêu ${Store.state.profile.goalHours} giờ/ngày`,
      },
      {
        label: "Chuỗi hiện tại",
        value: `${Store.state.profile.streak || 0} ngày`,
        icon: "flame",
        foot: `Dài nhất: ${longestStreak()} ngày`,
      },
      {
        label: "Ngày tốt nhất",
        value: D.formatMinutes(model.best.minutes),
        icon: "trophy",
        foot: model.best.date ? D.longDate(model.best.date) : "—",
      },
    ];

    document.getElementById("kpiGrid").innerHTML = cards
      .map(
        (c) => `<article class="stat-card">
          <div class="stat-top">
            <span class="stat-label">${c.label}</span>
            <span class="stat-icon">${icon(c.icon)}</span>
          </div>
          <div class="stat-value">${c.value}</div>
          <div class="stat-foot">${c.foot}</div>
        </article>`
      )
      .join("");
  }

  /* 14 ngày gần nhất: cột phút học từng ngày, hôm nay nổi bật. */
  function renderRecentChart() {
    const daily = Store.state.daily || {};
    const wrap = document.getElementById("recentChart");
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const date = D.addDays(new Date(), -i);
      const key = D.iso(date);
      days.push({ key, date, minutes: Math.max(0, Number(daily[key]) || 0) });
    }
    const max = Math.max(30, ...days.map((d) => d.minutes));
    wrap.innerHTML = days
      .map((d) => {
        const h = Math.round((d.minutes / max) * 100);
        const dow = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.date.getDay()];
        const label = `${d.date.getDate()}/${d.date.getMonth() + 1}`;
        return `<div class="recent-col${d.key === D.iso(new Date()) ? " today" : ""}" title="${D.longDate(d.date)} · ${D.formatMinutes(d.minutes)}">
          <span class="r-mins">${D.formatMinutes(d.minutes)}</span>
          <span class="r-bar" style="height:${Math.max(2, h)}%"></span>
          <span class="r-dow">${dow}</span>
          <span class="r-label">${label}</span>
        </div>`;
      })
      .join("");
  }

  function renderHourChart() {
    const source = Array.isArray(Store.state.hours) ? Store.state.hours : [];
    let values = Array.from({ length: 18 }, (_, i) => Math.max(0, Number(source[6 + i]) || 0));
    const max = Math.max(...values);
    document.getElementById("hourChart").innerHTML = values
      .map((v, i) => {
        const hour = 6 + i;
        const height = Math.max(3, Math.round((v / max) * 100));
        return `<div class="hour-col" title="${D.pad(hour)}:00 · ${v} phút">
          <div class="h-bar" style="height:${height}%"></div>
          <span class="h-label">${hour % 3 === 0 ? D.pad(hour) : ""}</span>
        </div>`;
      })
      .join("");
  }

  /* ---------------------------------------------------------------------- */

  function initTooltip() {
    const grid = document.getElementById("heatGrid");

    const move = (e) => {
      const pad = 14;
      let x = e.clientX + pad;
      let y = e.clientY - 38;
      const rect = tooltip.getBoundingClientRect();
      if (x + rect.width > window.innerWidth - 8) x = e.clientX - rect.width - pad;
      if (y < 8) y = e.clientY + 18;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    };

    grid.addEventListener("mouseover", (e) => {
      const cell = e.target.closest(".heat-cell[data-date]");
      if (!cell) return;
      const date = D.parseISO(cell.dataset.date);
      tooltip.innerHTML = `<b>${D.formatMinutes(Number(cell.dataset.minutes))}</b> · ${D.longDate(date)}`;
      tooltip.classList.add("on");
      move(e);
    });
    grid.addEventListener("mousemove", (e) => {
      if (tooltip.classList.contains("on")) move(e);
    });
    grid.addEventListener("mouseleave", () => tooltip.classList.remove("on"));
    grid.addEventListener("mouseout", (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(".heat-cell")) {
        tooltip.classList.remove("on");
      }
    });
  }

  /* Thành tích tính từ dữ liệu thật: streak, tổng phút (daily), giờ bắt đầu
     sớm (hours), độ đều (7 ngày gần nhất), Sao (profile.stars). */
  function renderAchievements() {
    const list = document.getElementById("achList");
    if (!list) return;
    const daily = Store.state.daily || {};
    const hours = Array.isArray(Store.state.hours) ? Store.state.hours : [];
    const streak = Math.max(0, Number(Store.state.profile.streak) || 0);
    const stars = Math.max(0, Number(Store.state.profile.stars) || 0);

    const totalMinutes = Object.values(daily).reduce((a, v) => a + Math.max(0, Number(v) || 0), 0);

    let early = 0;
    for (let h = 0; h < 6; h++) early += Math.max(0, Number(hours[h]) || 0);

    let last7 = 0;
    for (let i = 0; i < 7; i++) {
      const key = D.iso(D.addDays(new Date(), -i));
      if ((Number(daily[key]) || 0) >= 20) last7 += 1;
    }

    const defs = [
      { ico: "flame", name: "Chuỗi 7 ngày", desc: "Học ít nhất 20 phút mỗi ngày", need: 7, have: streak, unit: "ngày" },
      { ico: "clock", name: "100 giờ", desc: "Tổng thời gian tập trung", need: 6000, have: totalMinutes, unit: "phút" },
      { ico: "sun", name: "Chim sớm", desc: "Bắt đầu học trước 6:00 sáng", need: 1, have: early > 0 ? 1 : 0, unit: "" },
      { ico: "shield", name: "Đều đặn", desc: "5 trong 7 ngày gần nhất có học", need: 5, have: last7, unit: "ngày" },
      { ico: "trophy", name: "30 ngày bền bỉ", desc: "Chuỗi 30 ngày liên tiếp", need: 30, have: streak, unit: "ngày" },
      { ico: "star", name: "Bậc thầy tập trung", desc: "Đạt 5.000 Study Stars", need: 5000, have: stars, unit: "★" },
    ];

    let done = 0;
    list.innerHTML = defs
      .map((a) => {
        const pass = a.have >= a.need;
        if (pass) done += 1;
        const status = pass ? "ĐẠT" : `${Math.min(a.have, a.need)}/${a.need}`;
        return `<div class="achievement${pass ? "" : " locked"}">
          <span class="ach-ico" data-icon="${a.ico}"></span>
          <div><b>${a.name}</b><span>${a.desc}</span></div>
          <span class="status">${status}</span>
        </div>`;
      })
      .join("");

    const hint = document.getElementById("achHint");
    if (hint) hint.textContent = `${done} / ${defs.length}`;
    if (window.UI.hydrateIcons) window.UI.hydrateIcons(list);
  }

  function renderStreakCard() {
    const wrap = document.getElementById("streakWidget");
    if (wrap) wrap.innerHTML = streakCard(Store.state.profile.streak);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderStreakCard();
    renderAchievements();
    renderHeatmap();
    renderHourChart();
    initTooltip();

    document.querySelectorAll("#rangeSeg [data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        range = Number(btn.dataset.range);
        document.querySelectorAll("#rangeSeg [data-range]").forEach((b) => b.classList.toggle("active", b === btn));
        renderHeatmap();
      });
    });

  });
})();
