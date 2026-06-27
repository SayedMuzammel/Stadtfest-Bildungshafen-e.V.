/* ============================================================
   Speisekarte – App logic
   - Lädt Inhalte aus data/menu.json
   - Rendert Kategorien & Karten
   - Deep-Links pro Kategorie (#speisen, #getraenke, …)
   - Scrollspy, Reveal-Animationen, Dark Mode, PWA
   ============================================================ */
(function () {
  "use strict";

  const euro = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  });

  /* ---------- Helpers ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const el = (tag, cls) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  };

  // Generates an elegant inline SVG placeholder (used when a photo is missing)
  function placeholder(emoji, c1, c2) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="440" viewBox="0 0 640 440">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
      `</linearGradient></defs>` +
      `<rect width="640" height="440" fill="url(#g)"/>` +
      `<text x="50%" y="46%" font-size="150" text-anchor="middle" dominant-baseline="central">${emoji}</text>` +
      `<text x="50%" y="74%" font-size="26" fill="rgba(255,255,255,.85)" font-family="Mulish,Arial,sans-serif" text-anchor="middle">Foto folgt</text>` +
      `</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // Category-specific placeholder color pairs
  const PH_COLORS = {
    speisen: ["#ef7420", "#f6913f"],
    suessspeisen: ["#b5567d", "#e0779b"],
    getraenke: ["#28287c", "#3d3da6"],
    _default: ["#28287c", "#3d3da6"],
  };

  /* ---------- Render ---------- */
  function render(data) {
    const root = $("#menuRoot");
    const tabsInner = $("#tabsInner");
    root.innerHTML = "";
    tabsInner.innerHTML = "";

    data.categories.forEach((cat) => {
      // Tab
      const tab = el("a", "tab");
      tab.href = "#" + cat.id;
      tab.dataset.target = cat.id;
      tab.innerHTML =
        `<span class="tab__emoji" aria-hidden="true">${cat.emoji || ""}</span>` +
        `<span>${cat.name}</span>`;
      tabsInner.appendChild(tab);

      // Section
      const section = el("section", "section");
      section.id = cat.id;

      const head = el("div", "section__head");
      head.innerHTML =
        `<div class="section__emoji" data-reveal aria-hidden="true">${cat.emoji || ""}</div>` +
        `<h2 class="section__title" data-reveal>${cat.name}</h2>` +
        (cat.subtitle ? `<p class="section__subtitle" data-reveal>${cat.subtitle}</p>` : "");
      section.appendChild(head);

      const grid = el("div", "grid");
      const colors = PH_COLORS[cat.id] || PH_COLORS._default;

      cat.items.forEach((item, i) => {
        const card = el("article", "card");
        card.setAttribute("data-reveal", "");
        card.style.setProperty("--reveal-delay", (i % 4) * 0.08 + "s");

        const fallback = placeholder(cat.emoji || "🍴", colors[0], colors[1]);

        card.innerHTML =
          `<div class="card__media">` +
            `<span class="card__price">${euro.format(item.price)}</span>` +
            `<img class="card__img" loading="lazy" alt="${escapeHtml(item.name)}" ` +
            `src="${item.image || ""}" data-fallback="${fallback}" />` +
          `</div>` +
          `<div class="card__body">` +
            `<h3 class="card__name">${escapeHtml(item.name)}</h3>` +
            (item.desc ? `<p class="card__desc">${escapeHtml(item.desc)}</p>` : "") +
          `</div>`;

        const img = $(".card__img", card);
        img.addEventListener("error", function onErr() {
          img.removeEventListener("error", onErr);
          img.src = img.dataset.fallback;
        });
        // If no source given at all, go straight to placeholder
        if (!item.image) img.src = fallback;

        grid.appendChild(card);
      });

      section.appendChild(grid);
      root.appendChild(section);
    });

    // Footer content
    const f = data.festival || {};
    const orgEl = $("#footerOrg");
    if (orgEl && f.organizer) orgEl.textContent = f.organizer;
    const noteEl = $("#footerNote");
    if (noteEl && f.note) noteEl.textContent = f.note;
    renderSocial(f.social || {});

    initInteractions();
  }

  // Brand SVG icons (inline, inherit currentColor)
  const SOCIAL_ICONS = {
    instagram:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/>' +
      '<circle cx="17.4" cy="6.6" r="1.3" fill="currentColor" stroke="none"/></svg>',
    facebook:
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.46H15.2c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.9h-2.34V22C18.34 21.21 22 17.06 22 12.06z"/></svg>',
    website:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9.2"/><path d="M2.8 12h18.4M12 2.8c2.7 2.9 2.7 15.5 0 18.4M12 2.8c-2.7 2.9-2.7 15.5 0 18.4"/></svg>',
  };

  function renderSocial(social) {
    const wrap = $("#footerSocial");
    if (!wrap) return;
    const map = [
      ["instagram", "Instagram"],
      ["facebook", "Facebook"],
      ["website", "Webseite"],
    ];
    wrap.innerHTML = "";
    map.forEach(([key, label]) => {
      if (!social[key]) return;
      const a = el("a", "social-link");
      a.href = social[key];
      a.target = "_blank";
      a.rel = "noopener";
      a.setAttribute("aria-label", label);
      a.innerHTML = SOCIAL_ICONS[key] || "";
      wrap.appendChild(a);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  /* ---------- Interactions (after render) ---------- */
  // Assigned by setupScrollSpy; used by tab clicks for instant highlight.
  let setActiveTab = function () {};

  function initInteractions() {
    setupReveal();
    setupScrollSpy();
    setupTabClicks();
    handleDeepLink();
  }

  // Reveal-on-scroll
  function setupReveal() {
    const items = document.querySelectorAll("[data-reveal]:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      items.forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach((n) => io.observe(n));
  }

  // Highlight the active tab while scrolling (continuous, so it also
  // settles correctly at the end of a click-triggered smooth scroll).
  function setupScrollSpy() {
    const sections = Array.from(document.querySelectorAll(".section"));
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const tabsInner = document.getElementById("tabsInner");
    if (!sections.length) return;

    const OFFSET = 168; // sticky bunting + topbar + tabs height

    setActiveTab = (id) => {
      tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.target === id));
      const activeTab = tabs.find((t) => t.dataset.target === id);
      // Center the active tab in the horizontal strip WITHOUT scrolling the page
      if (activeTab && tabsInner) {
        const target = activeTab.offsetLeft - (tabsInner.clientWidth - activeTab.clientWidth) / 2;
        tabsInner.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      }
    };

    const currentId = () => {
      // At the very bottom, force the last section active
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        return sections[sections.length - 1].id;
      }
      let id = sections[0].id;
      for (const s of sections) {
        if (s.getBoundingClientRect().top <= OFFSET) id = s.id;
      }
      return id;
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setActiveTab(currentId());
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }

  // Smooth scroll + update hash; highlight immediately on click
  function setupTabClicks() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", (ev) => {
        ev.preventDefault();
        const id = tab.dataset.target;
        const target = document.getElementById(id);
        if (target) {
          setActiveTab(id); // instant highlight, before the scroll finishes
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(null, "", "#" + id);
        }
      });
    });
  }

  // On load, jump to the category in the URL hash (QR deep-link)
  function handleDeepLink() {
    const id = decodeURIComponent(location.hash.replace("#", ""));
    if (!id) return;
    const target = document.getElementById(id);
    if (target) {
      // Wait a tick so layout & sticky offsets are settled
      requestAnimationFrame(() => {
        setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      });
    }
  }

  /* ---------- Theme toggle ---------- */
  function setupTheme() {
    const toggle = $("#themeToggle");
    const meta = document.querySelector('meta[name="theme-color"]');
    const apply = (mode) => {
      document.documentElement.setAttribute("data-theme", mode);
      if (toggle) toggle.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
      if (meta) meta.setAttribute("content", mode === "dark" ? "#12122b" : "#28287c");
    };
    // current mode was set pre-paint by inline script; sync the control
    const current = document.documentElement.getAttribute("data-theme") || "light";
    apply(current);

    if (toggle) {
      toggle.addEventListener("click", () => {
        const next =
          document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        apply(next);
        try { localStorage.setItem("theme", next); } catch (e) {}
      });
    }
  }

  /* ---------- Scroll-to-top ---------- */
  function setupToTop() {
    const btn = $("#toTop");
    if (!btn) return;
    const onScroll = () => btn.classList.toggle("is-shown", window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    onScroll();
  }

  /* ---------- PWA service worker ---------- */
  function setupPWA() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
      });
    }
  }

  /* ---------- Boot ---------- */
  function showError() {
    const root = $("#menuRoot");
    if (root) {
      root.innerHTML =
        `<div class="error-box"><p>Die Speisekarte konnte nicht geladen werden.</p>` +
        `<p>Bitte Seite neu laden.</p></div>`;
    }
  }

  function boot() {
    setupTheme();
    setupToTop();
    setupPWA();

    fetch("data/menu.json", { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((data) => {
        document.title = `${data.festival.edition} ${data.festival.title} · Speisekarte`;
        render(data);
      })
      .catch((err) => {
        console.error("Menü-Ladefehler:", err);
        showError();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
