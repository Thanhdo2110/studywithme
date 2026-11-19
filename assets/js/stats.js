/* ==========================================================================
   StudyWithMe — Stats (heatmap, charts, report card export)
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { icon, escapeHTML, toast } = window.UI;

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
    renderSubjectBars();
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

  function renderSubjectBars() {
    const by = Store.state.bySubject || {};
    const knownIds = ["toan", "ly", "hoa", "anh", "dgnl", "van"];
    const ids = [...new Set([...knownIds, ...Object.keys(by).filter((id) => id.startsWith("custom:"))])];
    const totalMinutes = ids.reduce((sum, id) => sum + Math.max(0, Number(by[id]) || 0), 0);

    let rows;
    if (totalMinutes > 0) {
      rows = ids
        .map((id) => ({
          id,
          mins: Math.max(0, Number(by[id]) || 0),
          w: Math.round((Math.max(0, Number(by[id]) || 0) / totalMinutes) * 100),
        }))
        .filter((item) => item.mins > 0)
        .sort((a, b) => b.mins - a.mins);
    } else {
      rows = [];
    }

    const wrap = document.getElementById("subjectBars");
    if (!rows.length) {
      wrap.innerHTML = `<div class="empty" style="padding:28px 10px"><span>Chưa có dữ liệu môn học.</span></div>`;
      return;
    }
    wrap.innerHTML = rows
      .map((item) => {
        const sub = typeof item.id === "string" && item.id.startsWith("custom:")
          ? { name: item.id.slice(7), color: "#959590" }
          : D.SUBJECT_MAP[item.id] || { name: "Khác", color: "#959590" };
        return `<div class="subject-bar" style="--c:${sub.color}">
          <div class="subject-bar-top">
            <i style="background:${sub.color}"></i>
            <b>${sub.name}</b>
            <span>${D.formatMinutes(item.mins)} · ${item.w}%</span>
          </div>
          <div class="bar"><span style="width:${item.w}%"></span></div>
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

  function todayTopSubject() {
    const todayIdx = (new Date().getDay() + 6) % 7;
    const items = Store.state.schedule.filter((s) => s.day === todayIdx);
    if (!items.length) return { name: "Chưa có môn", color: "#959590" };
    const sum = {};
    items.forEach((s) => (sum[s.subject] = (sum[s.subject] || 0) + Number(s.duration)));
    const id = Object.keys(sum).sort((a, b) => sum[b] - sum[a])[0];
    if (typeof id === "string" && id.startsWith("custom:")) return { name: id.slice(7), color: "#959590" };
    return D.SUBJECT_MAP[id] || { name: "Chưa có môn", color: "#959590" };
  }

  function reportData() {
    const todayMinutes = D.minutesForDay(new Date());
    const done = Store.state.todos.filter((t) => t.done).length;
    const streak = Store.state.profile.streak || 0;
    return {
      minutes: todayMinutes,
      stars: todayMinutes,
      streak,
      tasksDone: done,
      tasksTotal: Store.state.todos.length,
      subject: todayTopSubject(),
      date: new Date(),
      quote: `“Chuỗi ${streak} ngày không phải may mắn. Là bạn đã quay lại.”`,
    };
  }

  function renderReport() {
    const r = reportData();
    document.getElementById("reportMinutes").textContent = D.formatMinutes(r.minutes);
    document.getElementById("reportSub").textContent = `Hôm nay · ${r.subject.name}`;
    document.getElementById("reportStars").textContent = `+${r.stars}`;
    document.getElementById("reportStreak").textContent = `${r.streak} ngày`;
    document.getElementById("reportTasks").textContent = `${r.tasksDone} / ${r.tasksTotal}`;
    document.getElementById("reportFocus").textContent = r.subject.name;
    document.getElementById("reportQuote").textContent = r.quote;
    document.getElementById("reportDate").textContent =
      `Cập nhật ${D.longDate(r.date)} · ${D.pad(r.date.getHours())}:${D.pad(r.date.getMinutes())}`;
  }

  /* ---------------------------------------------------------------------- */
  /* Export report card as PNG                                              */
  /* ---------------------------------------------------------------------- */

  function hexToRgba(hex, alpha) {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawStar(ctx, cx, cy, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? outer : inner;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  async function exportReport() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const r = reportData();
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6ad86c";
    const W = 1000;
    const H = 620;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#111110";
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(840, 40, 10, 840, 40, 560);
    glow.addColorStop(0, hexToRgba(accent, 0.24));
    glow.addColorStop(0.6, hexToRgba(accent, 0.04));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // rounded border
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(26, 26, W - 52, H - 52, 26);
    else ctx.rect(26, 26, W - 52, H - 52);
    ctx.stroke();

    // decorative circles
    ctx.strokeStyle = hexToRgba(accent, 0.22);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(940, 560, 210, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(940, 560, 150, 0, Math.PI * 2); ctx.stroke();

    // brand mark
    ctx.fillStyle = accent;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(64, 60, 46, 46, 12);
    else ctx.rect(64, 60, 46, 46);
    ctx.fill();
    ctx.fillStyle = "#0d180d";
    drawStar(ctx, 87, 83, 14, 5.4);

    ctx.fillStyle = "#eeeeeb";
    ctx.font = "600 27px 'Instrument Sans', system-ui, sans-serif";
    ctx.fillText("StudyWithMe", 124, 92);

    // eyebrow
    ctx.fillStyle = "#7b7b76";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText("PHIẾU THÀNH TÍCH · HỌC TẬP TRUNG", 64, 154);

    // main number
    ctx.fillStyle = "#eeeeeb";
    ctx.font = "600 92px 'Instrument Sans', system-ui, sans-serif";
    ctx.fillText(D.formatMinutes(r.minutes), 60, 262);

    ctx.fillStyle = "#959590";
    ctx.font = "15px 'Instrument Sans', system-ui, sans-serif";
    const grade = String(Store.state.profile.grade || "").trim().replace(/^lớp\s+/i, "").trim();
    ctx.fillText(`Hôm nay · ${r.subject.name} · ${grade ? `Lớp ${grade}` : "Chưa chọn lớp"}`, 66, 298);

    // divider
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath(); ctx.moveTo(64, 336); ctx.lineTo(W - 64, 336); ctx.stroke();

    // stats
    const items = [
      ["STUDY STARS", `+${r.stars}`],
      ["CHUỖI NGÀY", `${r.streak} ngày`],
      ["VIỆC HOÀN THÀNH", `${r.tasksDone} / ${r.tasksTotal}`],
      ["MÔN NHIỀU NHẤT", r.subject.name],
    ];
    items.forEach(([label, value], i) => {
      const x = 64 + i * 224;
      ctx.fillStyle = "#7b7b76";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillText(label, x, 380);
      ctx.fillStyle = "#eeeeeb";
      ctx.font = "500 24px 'Instrument Sans', system-ui, sans-serif";
      ctx.fillText(value, x, 414);
      if (i > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath(); ctx.moveTo(x - 24, 360); ctx.lineTo(x - 24, 426); ctx.stroke();
      }
    });

    // quote
    ctx.fillStyle = "#959590";
    ctx.font = "italic 14px 'Instrument Sans', system-ui, sans-serif";
    ctx.fillText(r.quote, 64, 500);

    // footer
    ctx.strokeStyle = hexToRgba(accent, 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(64, 534); ctx.lineTo(120, 534); ctx.stroke();

    ctx.fillStyle = "#7b7b76";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText(
      `${D.longDate(r.date).toUpperCase()} · ${D.pad(r.date.getHours())}:${D.pad(r.date.getMinutes())} · STUDYWITHME.APP`,
      64,
      558
    );

    // accent corner
    ctx.fillStyle = accent;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W - 132, H - 78, 68, 26, 8);
    else ctx.rect(W - 132, H - 78, 68, 26);
    ctx.fill();
    ctx.fillStyle = "#0d180d";
    ctx.font = "600 11px 'Instrument Sans', system-ui, sans-serif";
    ctx.fillText("STUDY ON", W - 118, H - 60);

    const a = document.createElement("a");
    a.download = `StudyWithMe-phieu-thanh-tich-${D.iso(r.date)}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
    toast("Đã xuất phiếu thành tích dưới dạng ảnh PNG.");
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

  document.addEventListener("DOMContentLoaded", () => {
    renderHeatmap();
    renderHourChart();
    renderReport();
    initTooltip();

    document.querySelectorAll("#rangeSeg [data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        range = Number(btn.dataset.range);
        document.querySelectorAll("#rangeSeg [data-range]").forEach((b) => b.classList.toggle("active", b === btn));
        renderHeatmap();
        renderReport();
      });
    });

    document.getElementById("exportBtn").addEventListener("click", exportReport);
    document.getElementById("exportBtn2").addEventListener("click", exportReport);
  });
})();
