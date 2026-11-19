/* ==========================================================================
   StudyWithMe — Planner (Timeline + To-do)
   ========================================================================== */

(function () {
  "use strict";

  const D = window.DATA;
  const Store = window.Store;
  const { icon, hydrateIcons, escapeHTML, toast } = window.UI;

  const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  let weekOffset = 0;
  let selectedBlockId = null;

  const subOf = (id) => {
    if (typeof id === "string" && id.startsWith("custom:")) {
      return { name: id.slice(7), color: "#959590" };
    }
    return D.SUBJECT_MAP[id] || { name: "Khác", color: "#959590" };
  };

  function subjectValue(value) {
    const name = value.trim();
    if (!name) return "";
    const known = D.SUBJECTS.find((item) => item.name.toLowerCase() === name.toLowerCase());
    return known ? known.id : `custom:${name}`;
  }

  function todayIndex() {
    return (new Date().getDay() + 6) % 7;
  }

  function renderHeader() {
    const dates = D.weekDates(weekOffset);
    const head = document.getElementById("tlHead");
    const today = D.todayISO;

    head.innerHTML =
      `<div class="tl-corner"></div>` +
      dates
        .map((date, i) => {
          const isToday = D.iso(date) === today;
          return `<div class="tl-day${isToday ? " today" : ""}">
            <b>${DAY_NAMES[i]}</b>
            <span>${D.pad(date.getDate())}</span>
          </div>`;
        })
        .join("");

    const first = dates[0];
    const last = dates[6];
    const label = document.getElementById("weekLabel");
    label.textContent = `${D.pad(first.getDate())}/${D.pad(first.getMonth() + 1)} – ${D.pad(last.getDate())}/${D.pad(last.getMonth() + 1)}`;
    label.title = weekOffset === 0 ? "Tuần này" : weekOffset > 0 ? `+${weekOffset} tuần` : `${weekOffset} tuần`;
  }

  function renderHours() {
    const wrap = document.getElementById("tlHours");
    let html = "";
    for (let h = 6; h <= 24; h += 2) {
      const top = ((h * 60 - D.DAY_START) / 60) * D.HOUR_H;
      html += `<span class="tl-hour-label" style="top:${top}px">${D.pad(h)}:00</span>`;
    }
    wrap.innerHTML = html;
  }

  function renderTimeline() {
    renderHeader();
    renderHours();

    const dates = D.weekDates(weekOffset);
    const today = D.todayISO;
    const cols = document.getElementById("tlCols");

    cols.innerHTML = dates
      .map((date, dayIdx) => {
        const isToday = D.iso(date) === today;
        const items = Store.state.schedule
          .filter((s) => s.day === dayIdx)
          .sort((a, b) => D.clockToMinutes(a.start) - D.clockToMinutes(b.start));

        let blocks = items
          .map((item) => {
            const sub = subOf(item.subject);
            const start = D.clockToMinutes(item.start);
            const top = ((start - D.DAY_START) / 60) * D.HOUR_H;
            const height = Math.max(24, (item.duration / 60) * D.HOUR_H - 3);
            const end = start + item.duration;
            return `<button type="button" class="tl-block" data-block="${item.id}"
              style="top:${top}px;height:${height}px;--c:${sub.color}"
              title="${escapeHTML(item.note || sub.name)}">
              <b>${escapeHTML(sub.name)}</b>
              <span>${D.minutesToClock(start)}–${D.minutesToClock(end)}</span>
            </button>`;
          })
          .join("");

        // "now" marker
        if (isToday) {
          const now = new Date();
          const mins = now.getHours() * 60 + now.getMinutes();
          if (mins >= D.DAY_START && mins <= D.DAY_END) {
            const top = ((mins - D.DAY_START) / 60) * D.HOUR_H;
            blocks += `<div class="tl-now" style="top:${top}px" title="Bây giờ"></div>`;
          }
        }

        return `<div class="tl-col${isToday ? " today" : ""}">${blocks}</div>`;
      })
      .join("");

    const weekItems = Store.state.schedule;
    if (!weekItems.length) {
      cols.insertAdjacentHTML(
        "beforeend",
        `<div class="tl-empty">Chưa có ca học nào. Bấm “Thêm ca học” để bắt đầu tuần mới.</div>`
      );
    }

    cols.querySelectorAll("[data-block]").forEach((btn) => {
      btn.addEventListener("click", () => openBlock(btn.dataset.block));
    });
  }

  function renderSummary() {
    const items = Store.state.schedule;
    const total = items.reduce((sum, s) => sum + Number(s.duration), 0);
    const bySubject = {};
    items.forEach((s) => {
      bySubject[s.subject] = (bySubject[s.subject] || 0) + Number(s.duration);
    });
    const topId = Object.keys(bySubject).sort((a, b) => bySubject[b] - bySubject[a])[0];
    const top = topId ? subOf(topId) : null;
    const done = Store.state.todos.filter((t) => t.done).length;

    document.getElementById("plannerSummary").innerHTML = `
      <span class="summary-chip">${icon("clock")} Tuần này <b>${D.formatMinutes(total)}</b></span>
      <span class="summary-chip">${icon("calendar")} <b>${items.length}</b> ca học</span>
      <span class="summary-chip">${icon("book-open")} Nhiều nhất <b>${top ? top.name : "—"}</b></span>
      <span class="summary-chip">${icon("check-circle")} <b>${done}/${Store.state.todos.length}</b> việc đã xong</span>`;
  }

  function renderLegend() {
    const used = [...new Set(Store.state.schedule.map((s) => s.subject))];
    const wrap = document.getElementById("tlLegend");
    wrap.innerHTML =
      used
        .map((id) => {
          const s = subOf(id);
          return `<span><i style="background:${s.color}"></i>${escapeHTML(s.name)}</span>`;
        })
        .join("") +
      `<span class="spacer" style="margin-left:auto;color:var(--text-4)">Nhấn vào một khối để xem chi tiết</span>`;
  }

  function renderTodos() {
    const todos = [...Store.state.todos].sort((a, b) => Number(a.done) - Number(b.done));
    const done = todos.filter((t) => t.done).length;
    const total = todos.length;
    const percent = total ? Math.round((done / total) * 100) : 0;

    document.getElementById("todoDone").textContent = done;
    document.getElementById("todoTotal").textContent = total;
    document.getElementById("todoPercent").textContent = `${percent}%`;
    document.getElementById("todoBar").style.width = `${percent}%`;
    document.getElementById("todoHint").textContent = `${done} / ${total}`;

    const list = document.getElementById("todoList");
    if (!todos.length) {
      list.innerHTML = `<div class="todo-empty">Chưa có việc nào. Thêm một việc nhỏ để bắt đầu.</div>`;
      return;
    }

    list.innerHTML = todos
      .map((t) => {
        const s = subOf(t.subject);
        return `<div class="todo-item" data-todo-row="${t.id}">
          <label class="check">
            <input type="checkbox" data-todo="${t.id}" ${t.done ? "checked" : ""}>
            <span class="box"></span>
            <span class="check-text">${escapeHTML(t.text)}</span>
          </label>
          <span class="tag" style="color:${s.color};border-color:${s.color}44">${escapeHTML(s.name)}</span>
        </div>`;
      })
      .join("");

    list.querySelectorAll("[data-todo]").forEach((input) => {
      input.addEventListener("change", () => {
        Store.update((state) => {
          const item = state.todos.find((t) => t.id === input.dataset.todo);
          if (item) item.done = input.checked;
        });
        renderTodos();
        renderSummary();
        if (input.checked) toast("Đã hoàn thành một việc. Tiếp tục giữ nhịp nhé!");
      });
    });
  }

  function renderAll() {
    renderTimeline();
    renderSummary();
    renderLegend();
    renderTodos();
    hydrateIcons();
  }

  /* ---------------------------------------------------------------------- */

  function openBlock(id) {
    const item = Store.state.schedule.find((s) => s.id === id);
    if (!item) return;
    selectedBlockId = id;
    const sub = subOf(item.subject);
    const start = D.clockToMinutes(item.start);
    const end = start + Number(item.duration);

    const pill = document.getElementById("blockSubjectPill");
    pill.textContent = sub.name;
    pill.style.color = sub.color;
    pill.style.borderColor = `${sub.color}55`;

    document.getElementById("blockTitle").textContent = item.note || `Ca học ${sub.name}`;
    document.getElementById("blockTime").textContent = `${D.longDate(D.weekDates(weekOffset)[item.day])} · ${D.minutesToClock(start)} – ${D.minutesToClock(end)}`;
    document.getElementById("blockNote").textContent = item.note
      ? `Mục tiêu: ${item.note}. Khi vào phòng học, bạn có thể chọn ca ${item.duration} phút tương ứng.`
      : "Chưa có ghi chú cho ca học này.";
    document.getElementById("blockDuration").textContent = `${item.duration} phút`;
    window.UI.openModal("blockModal");
  }

  function initModals() {
    const form = document.getElementById("scheduleForm");
    const subjectSelect = document.getElementById("schSubject");

    subjectSelect.value = "Toán";
    document.getElementById("schDay").value = String(todayIndex());

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const subject = subjectValue(subjectSelect.value);
      const start = document.getElementById("schStart").value || "19:00";
      const duration = Number(document.getElementById("schDuration").value);
      const note = document.getElementById("schNote").value.trim() || `${subOf(subject).name} · ca học`;

      Store.update((state) => {
        state.schedule.push({
          id: `s-${Date.now()}`,
          day: Number(document.getElementById("schDay").value),
          start,
          duration,
          subject,
          note,
        });
      });

      window.UI.closeModal("scheduleModal");
      form.reset();
      document.getElementById("schStart").value = "19:00";
      renderAll();
      toast(`Đã thêm ca ${subOf(subject).name} · ${start}.`);
    });

    document.getElementById("deleteBlock").addEventListener("click", () => {
      if (!selectedBlockId) return;
      Store.update((state) => {
        state.schedule = state.schedule.filter((s) => s.id !== selectedBlockId);
      });
      window.UI.closeModal("blockModal");
      selectedBlockId = null;
      renderAll();
      toast("Đã xoá ca học khỏi timeline.");
    });

    document.getElementById("prevWeek").addEventListener("click", () => {
      weekOffset -= 1;
      renderAll();
    });
    document.getElementById("nextWeek").addEventListener("click", () => {
      weekOffset += 1;
      renderAll();
    });
    document.getElementById("todayWeek").addEventListener("click", () => {
      weekOffset = 0;
      renderAll();
    });
  }

  function initTodos() {
    const select = document.getElementById("todoSubject");
    select.value = "";

    document.getElementById("todoForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("todoInput");
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }
      Store.update((state) => {
        state.todos.push({
          id: `t-${Date.now()}`,
          text,
          subject: subjectValue(select.value),
          done: false,
        });
      });
      input.value = "";
      renderTodos();
      renderSummary();
      toast("Đã thêm việc mới vào danh sách.");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderAll();
    initModals();
    initTodos();
  });
})();
