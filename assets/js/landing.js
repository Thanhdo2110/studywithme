/* ==========================================================================
   StudyWithMe — Landing interactions
   ========================================================================== */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    /* Mini heatmap in hero window ------------------------------------------ */
    const mini = document.querySelector("[data-heat-mini]");
    if (mini) {
      let seed = 20261117;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 80; i++) {
        const cell = document.createElement("i");
        const r = rnd();
        if (r > 0.84) cell.className = "l4";
        else if (r > 0.65) cell.className = "l3";
        else if (r > 0.44) cell.className = "l2";
        else if (r > 0.2) cell.className = "l1";
        frag.appendChild(cell);
      }
      mini.appendChild(frag);
    }

    /* Mode tabs ------------------------------------------------------------- */
    const tabs = document.querySelectorAll(".modes-tabs [data-mode]");
    const panels = document.querySelectorAll(".mode-panel");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const mode = tab.dataset.mode;
        tabs.forEach((t) => {
          const on = t === tab;
          t.classList.toggle("active", on);
          t.setAttribute("aria-selected", String(on));
        });
        panels.forEach((panel) => panel.classList.toggle("active", panel.id === `mode-${mode}`));
      });
    });

    /* Mobile navigation ----------------------------------------------------- */
    const navToggle = document.getElementById("navToggle");
    const mobileNav = document.getElementById("mobileNav");
    if (navToggle && mobileNav) {
      const setOpen = (open) => {
        mobileNav.classList.toggle("open", open);
        navToggle.setAttribute("aria-expanded", String(open));
        navToggle.innerHTML = `<span data-icon="${open ? "x" : "menu"}"></span>`;
        window.UI.hydrateIcons(navToggle);
      };
      navToggle.addEventListener("click", () => setOpen(!mobileNav.classList.contains("open")));
      mobileNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));
      window.addEventListener("resize", () => {
        if (window.innerWidth > 1080) setOpen(false);
      });
    }

    /* FAQ: only one open at a time ------------------------------------------ */
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach((item) => {
      item.addEventListener("toggle", () => {
        if (!item.open) return;
        faqItems.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });
  });
})();
