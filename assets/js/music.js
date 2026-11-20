/* ==========================================================================
   StudyWithMe — Thanh âm tập trung (modal nhạc nền trong phòng học)
   Bốn bài nhạc nền CC0, phát lặp lại, áp dụng cho mọi loại phòng.
   ========================================================================== */

(function () {
  "use strict";

  const { icon, toast } = window.UI;

  const TRACKS = [
    { name: "Piano tĩnh lặng", desc: "Piano nhẹ, không lời", src: "assets/audio/01-piano-tinh-lang.mp3" },
    { name: "Mưa & Piano", desc: "Tiếng mưa hoà cùng piano", src: "assets/audio/02-mua-va-piano.mp3" },
    { name: "Nhạc gõ Thái Hoàng", desc: "Tiếng gõ nhẹ nhàng, dễ chịu", src: "assets/audio/03-thu-gian.mp3" },
    { name: "Tần số tập trung", desc: "Tần 240 Hz · nên đeo tai nghe", src: "assets/audio/04-tan-so-tap-trung.mp3" },
  ];

  const STORAGE_KEY = "swm.music";

  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function savePrefs(next) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      /* localStorage bị chặn — nhạc vẫn phát, chỉ không nhớ lựa chọn */
    }
  }

  function init() {
    const list = document.getElementById("musicList");
    const range = document.getElementById("musicVolume");
    const trigger = document.getElementById("musicOpen");
    const label = document.getElementById("musicLabel");
    const eq = document.getElementById("musicEq");
    const status = document.getElementById("musicStatus");
    const stopBtn = document.getElementById("musicStop");
    const volValue = document.getElementById("musicVolumeValue");
    if (!list || !range || !trigger) return;

    const prefs = readPrefs();
    let index = Number.isInteger(prefs.track) && prefs.track >= 0 && prefs.track < TRACKS.length ? prefs.track : -1;
    let playing = false;

    const audio = new Audio();
    audio.loop = true;
    audio.preload = "none";

    const volumeOf = () => Math.round(audio.volume * 100);

    list.innerHTML = TRACKS.map(
      (track, i) => `<button type="button" class="music-track" data-track="${i}" aria-pressed="false">
        <span class="mt-ico">${icon("music")}</span>
        <span class="mt-text"><b>${track.name}</b><span>${track.desc}</span></span>
        <span class="mt-action">${icon("play")}</span>
      </button>`
    ).join("");

    const rows = () => Array.prototype.slice.call(list.querySelectorAll(".music-track"));

    function paint() {
      rows().forEach((row, i) => {
        const active = playing && i === index;
        row.classList.toggle("is-playing", active);
        row.setAttribute("aria-pressed", String(active));
        row.querySelector(".mt-action").innerHTML = icon(active ? "pause" : "play");
      });

      const current = playing && TRACKS[index] ? TRACKS[index].name : "";
      trigger.classList.toggle("is-playing", playing);
      if (label) label.textContent = current || "Thanh âm tập trung";
      if (eq) eq.classList.toggle("hidden", !playing);
      if (status) status.textContent = current ? `Đang phát · ${current}` : "Chọn một bài để phát";
      if (stopBtn) stopBtn.disabled = !playing;
      if (volValue) volValue.textContent = `${volumeOf()}%`;
    }

    function pause() {
      audio.pause();
      playing = false;
      paint();
    }

    function play(nextIndex) {
      if (!TRACKS[nextIndex]) return;
      if (nextIndex !== index || !audio.getAttribute("src")) {
        audio.src = TRACKS[nextIndex].src;
      }
      index = nextIndex;
      audio
        .play()
        .then(() => {
          playing = true;
          savePrefs({ track: index, volume: volumeOf() });
          paint();
        })
        .catch(() => {
          playing = false;
          paint();
          toast("Trình duyệt chặn phát nhạc. Hãy bấm lại vào bài.", "warning");
        });
    }

    list.addEventListener("click", (event) => {
      const row = event.target.closest(".music-track");
      if (!row) return;
      const next = Number(row.dataset.track);
      if (playing && next === index) pause();
      else play(next);
    });

    range.addEventListener("input", () => {
      audio.volume = Math.min(100, Math.max(0, Number(range.value) || 0)) / 100;
      savePrefs({ track: index, volume: volumeOf() });
      if (volValue) volValue.textContent = `${volumeOf()}%`;
    });

    if (stopBtn) stopBtn.addEventListener("click", pause);

    audio.addEventListener("error", () => {
      playing = false;
      paint();
      toast("Không tải được bài nhạc này. Kiểm tra kết nối rồi thử lại.", "danger");
    });

    const savedVolume = Number.isFinite(Number(prefs.volume)) ? Number(prefs.volume) : 45;
    audio.volume = Math.min(100, Math.max(0, savedVolume)) / 100;
    range.value = String(volumeOf());
    paint();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
