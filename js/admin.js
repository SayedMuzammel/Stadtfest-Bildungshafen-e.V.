/* ============================================================
   Speisekarte – Admin / Verwaltung
   - Login (Supabase Auth, E-Mail + Passwort)
   - CRUD: Einstellungen, Kategorien, Produkte
   - Bild-Upload in Supabase Storage
   - Einmaliger Import aus data/menu.json + images/
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const el = (t, cls) => { const n = document.createElement(t); if (cls) n.className = cls; return n; };
  const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ş/g, "s").replace(/İ/g, "i")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function keyFromName(originalName, prefix) {
    const base = String(originalName).split("/").pop();
    const dot = base.lastIndexOf(".");
    const name = dot > 0 ? base.slice(0, dot) : base;
    const ext = (dot > 0 ? base.slice(dot + 1) : "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    return "items/" + (prefix ? prefix + "-" : "") + (slugify(name) || "bild") + "." + ext;
  }
  function showMsg(node, text, kind) {
    if (!node) return;
    node.textContent = text || "";
    node.className = "msg" + (kind === "ok" ? " msg--ok" : kind === "error" ? " msg--error" : "");
  }

  let BHc, T, draft = null, state = { categories: [], items: [], currentCatId: null };

  /* ---------- Theme toggle ---------- */
  function setupTheme() {
    const toggle = $("#themeToggle");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    setupTheme();

    if (!window.BH || !window.BH.ready) {
      $("#notConfigured").hidden = false;
      return;
    }
    BHc = window.BH.client;
    T = window.BH.TABLES;

    wireLogin();
    wireDashboard();

    BHc.auth.getSession().then(({ data }) => {
      if (data.session) showDashboard(data.session.user);
      else showLogin();
    });
    BHc.auth.onAuthStateChange((_event, session) => {
      if (session) showDashboard(session.user);
      else showLogin();
    });
  }

  function showLogin() {
    $("#loginView").hidden = false;
    $("#dashboard").hidden = true;
  }
  function showDashboard(user) {
    $("#loginView").hidden = true;
    $("#dashboard").hidden = false;
    $("#whoEmail").textContent = user && user.email ? user.email : "Admin";
    loadSettings();
    loadCategories();
  }

  /* ---------- Auth ---------- */
  function wireLogin() {
    const form = $("#loginForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("#loginBtn");
      const msg = $("#loginMsg");
      btn.disabled = true;
      showMsg(msg, "Anmeldung läuft …", "");
      const { error } = await BHc.auth.signInWithPassword({
        email: $("#email").value.trim(),
        password: $("#password").value,
      });
      btn.disabled = false;
      if (error) showMsg(msg, "Anmeldung fehlgeschlagen: " + error.message, "error");
      else showMsg(msg, "", "");
    });
    $("#logoutBtn").addEventListener("click", () => BHc.auth.signOut());
  }

  /* ---------- Dashboard wiring ---------- */
  function wireDashboard() {
    $$(".tabbar button").forEach((b) =>
      b.addEventListener("click", () => {
        $$(".tabbar button").forEach((x) => x.classList.toggle("active", x === b));
        $$(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + b.dataset.panel));
      })
    );
    $("#settingsForm").addEventListener("submit", saveSettings);
    $("#newCatForm").addEventListener("submit", createCategory);
    $("#itemCatSelect").addEventListener("change", (e) => { draft = null; state.currentCatId = e.target.value; renderItemList(); });
    $("#addItemBtn").addEventListener("click", addDraft);
    $("#importBtn").addEventListener("click", runImport);
  }

  /* ---------- Settings ---------- */
  async function loadSettings() {
    const { data } = await BHc.from(T.settings).select("*").eq("id", 1).maybeSingle();
    const s = data || {};
    const soc = s.social || {};
    $("#s_edition").value = s.edition || "";
    $("#s_title").value = s.title || "";
    $("#s_organizer").value = s.organizer || "";
    $("#s_tagline").value = s.tagline || "";
    $("#s_note").value = s.note || "";
    $("#s_instagram").value = soc.instagram || "";
    $("#s_facebook").value = soc.facebook || "";
    $("#s_website").value = soc.website || "";
  }

  async function saveSettings(e) {
    e.preventDefault();
    const msg = $("#settingsMsg");
    showMsg(msg, "Speichern …", "");
    const payload = {
      id: 1,
      edition: $("#s_edition").value.trim(),
      title: $("#s_title").value.trim(),
      organizer: $("#s_organizer").value.trim(),
      tagline: $("#s_tagline").value.trim(),
      note: $("#s_note").value.trim(),
      social: {
        instagram: $("#s_instagram").value.trim(),
        facebook: $("#s_facebook").value.trim(),
        website: $("#s_website").value.trim(),
      },
      updated_at: new Date().toISOString(),
    };
    const { error } = await BHc.from(T.settings).upsert(payload, { onConflict: "id" });
    showMsg(msg, error ? "Fehler: " + error.message : "Gespeichert ✓", error ? "error" : "ok");
  }

  /* ---------- Categories ---------- */
  async function loadCategories() {
    const { data, error } = await BHc.from(T.categories).select("*").order("sort_order", { ascending: true });
    if (error) { console.error(error); return; }
    state.categories = data || [];
    renderCatList();
    populateCatSelect();
    if (!state.currentCatId && state.categories[0]) state.currentCatId = state.categories[0].id;
    if (state.currentCatId) { $("#itemCatSelect").value = state.currentCatId; renderItemList(); }
  }

  function populateCatSelect() {
    const sel = $("#itemCatSelect");
    sel.innerHTML = "";
    state.categories.forEach((c) => {
      const o = el("option");
      o.value = c.id;
      o.textContent = (c.emoji ? c.emoji + " " : "") + c.name;
      sel.appendChild(o);
    });
  }

  async function createCategory(e) {
    e.preventDefault();
    const msg = $("#newCatMsg");
    const name = $("#nc_name").value.trim();
    if (!name) return;
    const slug = slugify($("#nc_slug").value || name);
    const payload = {
      name, slug,
      emoji: $("#nc_emoji").value.trim(),
      subtitle: $("#nc_subtitle").value.trim(),
      sort_order: state.categories.length,
    };
    const { error } = await BHc.from(T.categories).insert(payload);
    if (error) { showMsg(msg, "Fehler: " + error.message, "error"); return; }
    showMsg(msg, "Angelegt ✓", "ok");
    $("#newCatForm").reset();
    loadCategories();
  }

  function renderCatList() {
    const wrap = $("#catList");
    wrap.innerHTML = "";
    state.categories.forEach((c, idx) => {
      const box = el("div", "card-box");
      const grid = el("div", "grid2");
      grid.innerHTML =
        field("Emoji", `cat_emoji_${c.id}`, c.emoji || "", "text") +
        field("Name", `cat_name_${c.id}`, c.name || "", "text") +
        field("Kurzkennung (slug)", `cat_slug_${c.id}`, c.slug || "", "text") +
        field("Untertitel", `cat_sub_${c.id}`, c.subtitle || "", "text");
      box.appendChild(grid);

      const actions = el("div", "row-actions");
      actions.appendChild(btn("Speichern", "btn btn--sm", () => saveCategory(c.id)));
      actions.appendChild(btn("↑", "btn btn--ghost btn--sm", () => moveCategory(idx, -1), idx === 0));
      actions.appendChild(btn("↓", "btn btn--ghost btn--sm", () => moveCategory(idx, 1), idx === state.categories.length - 1));
      actions.appendChild(btn("Löschen", "btn btn--danger btn--sm", () => deleteCategory(c)));
      const m = el("span", "msg"); m.id = `cat_msg_${c.id}`;
      actions.appendChild(m);
      box.appendChild(actions);
      wrap.appendChild(box);
    });
  }

  async function saveCategory(id) {
    const msg = $(`#cat_msg_${id}`);
    const patch = {
      emoji: $(`#cat_emoji_${id}`).value.trim(),
      name: $(`#cat_name_${id}`).value.trim(),
      slug: slugify($(`#cat_slug_${id}`).value),
      subtitle: $(`#cat_sub_${id}`).value.trim(),
    };
    const { error } = await BHc.from(T.categories).update(patch).eq("id", id);
    showMsg(msg, error ? "Fehler: " + error.message : "Gespeichert ✓", error ? "error" : "ok");
    if (!error) { populateCatSelect(); }
  }

  async function moveCategory(fromIdx, dir) {
    await reorder(state.categories, fromIdx, fromIdx + dir, T.categories);
    loadCategories();
  }

  async function deleteCategory(c) {
    if (!confirm(`Kategorie „${c.name}“ inkl. aller Produkte wirklich löschen?`)) return;
    // Remove associated images from storage first (avoid orphans)
    const { data: items } = await BHc.from(T.items).select("image_path").eq("category_id", c.id);
    const paths = (items || []).map((i) => i.image_path).filter(Boolean);
    if (paths.length) await BHc.storage.from(window.BH.bucket).remove(paths);
    const { error } = await BHc.from(T.categories).delete().eq("id", c.id);
    if (error) { alert("Fehler: " + error.message); return; }
    if (state.currentCatId === c.id) state.currentCatId = null;
    loadCategories();
  }

  /* ---------- Items ---------- */
  async function renderItemList() {
    const wrap = $("#itemList");
    const catId = state.currentCatId;
    if (!catId) { wrap.innerHTML = "<p class='hint'>Bitte zuerst eine Kategorie anlegen.</p>"; return; }

    // Loading indicator
    wrap.innerHTML = '<div class="list-loading"><span class="mini-spin"></span> Produkte werden geladen …</div>';

    const { data, error } = await BHc.from(T.items)
      .select("*").eq("category_id", catId)
      .order("sort_order", { ascending: true });

    // Drop stale result if the user switched category mid-load
    if (state.currentCatId !== catId) return;

    if (error) { wrap.innerHTML = "<p class='msg msg--error'>" + error.message + "</p>"; return; }
    state.items = data || [];

    wrap.innerHTML = "";
    if (draft) wrap.appendChild(buildDraftRow());          // unsaved new product at the top
    state.items.forEach((it, idx) => wrap.appendChild(buildItemRow(it, idx)));
    if (!state.items.length && !draft) {
      wrap.innerHTML = "<p class='hint'>Noch keine Produkte. Mit „+ Neues Produkt“ hinzufügen.</p>";
    }
  }

  // Editor for an existing (saved) item
  function buildItemRow(it, idx) {
    const row = el("div", "item-row");

    const col = el("div", "thumb-wrap");
    const img = el("img", "thumb");
    img.alt = it.name || "";
    img.src = it.image_path ? window.BH.publicUrl(it.image_path) : transparentPx();
    const fileBtn = el("label", "btn btn--ghost btn--sm file-btn");
    fileBtn.textContent = "Bild …";
    const file = el("input"); file.type = "file"; file.accept = "image/*";
    file.addEventListener("change", () => uploadItemImage(it, file.files[0], img, $(`#it_msg_${it.id}`)));
    fileBtn.appendChild(file);
    col.appendChild(img); col.appendChild(fileBtn);
    row.appendChild(col);

    const body = el("div");
    const grid = el("div", "grid2");
    grid.innerHTML =
      field("Name", `it_name_${it.id}`, it.name || "", "text") +
      field("Menge (optional, z. B. „5 Stück“)", `it_qty_${it.id}`, it.quantity || "", "text") +
      field("Preis (€)", `it_price_${it.id}`, it.price != null ? it.price : "", "number", "0.01");
    body.appendChild(grid);
    const descWrap = el("div", "field");
    descWrap.innerHTML = `<label>Beschreibung</label><textarea id="it_desc_${it.id}">${escapeHtml(it.description || "")}</textarea>`;
    body.appendChild(descWrap);

    const actions = el("div", "row-actions");
    const avail = el("label");
    avail.style.cssText = "display:flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;";
    const cb = el("input"); cb.type = "checkbox"; cb.id = `it_avail_${it.id}`; cb.checked = it.is_available !== false;
    avail.appendChild(cb); avail.appendChild(document.createTextNode("verfügbar"));
    actions.appendChild(avail);
    actions.appendChild(btn("Speichern", "btn btn--sm", () => saveItem(it.id)));
    actions.appendChild(btn("↑", "btn btn--ghost btn--sm", () => moveItem(idx, -1), idx === 0));
    actions.appendChild(btn("↓", "btn btn--ghost btn--sm", () => moveItem(idx, 1), idx === state.items.length - 1));
    actions.appendChild(btn("Löschen", "btn btn--danger btn--sm", () => deleteItem(it)));
    const m = el("span", "msg"); m.id = `it_msg_${it.id}`;
    actions.appendChild(m);
    body.appendChild(actions);

    row.appendChild(body);
    return row;
  }

  // "+ Neues Produkt" -> only opens an editor; nothing is saved until "Speichern"
  function addDraft() {
    if (!state.currentCatId) { alert("Bitte zuerst eine Kategorie anlegen."); return; }
    if (draft) { const n = document.getElementById("draft_name"); if (n) n.focus(); return; }
    draft = { name: "", quantity: "", price: "", desc: "", available: true, imageFile: null, imageUrl: "" };
    const wrap = $("#itemList");
    const hint = wrap.querySelector(".hint"); if (hint) hint.remove();   // remove "no products yet"
    wrap.insertBefore(buildDraftRow(), wrap.firstChild);                 // prepend, no refetch
    const n = document.getElementById("draft_name"); if (n) n.focus();
  }

  // Editor for the unsaved draft
  function buildDraftRow() {
    const row = el("div", "item-row item-row--draft");

    const col = el("div", "thumb-wrap");
    const img = el("img", "thumb");
    img.alt = "Vorschau";
    img.src = draft.imageUrl || transparentPx();
    const fileBtn = el("label", "btn btn--ghost btn--sm file-btn");
    fileBtn.textContent = "Bild …";
    const file = el("input"); file.type = "file"; file.accept = "image/*";
    file.addEventListener("change", () => {
      const f = file.files[0];
      if (!f) return;
      draft.imageFile = f;
      draft.imageUrl = URL.createObjectURL(f);
      img.src = draft.imageUrl;
    });
    fileBtn.appendChild(file);
    col.appendChild(img); col.appendChild(fileBtn);
    row.appendChild(col);

    const body = el("div");
    const badge = el("div", "draft-badge"); badge.textContent = "Neues Produkt – noch nicht gespeichert";
    body.appendChild(badge);
    const grid = el("div", "grid2");
    grid.innerHTML =
      `<div class="field"><label>Name</label><input id="draft_name" type="text" value="${escapeHtml(draft.name)}" /></div>` +
      `<div class="field"><label>Menge (optional, z. B. „5 Stück“)</label><input id="draft_qty" type="text" value="${escapeHtml(draft.quantity)}" /></div>` +
      `<div class="field"><label>Preis (€)</label><input id="draft_price" type="number" step="0.01" value="${escapeHtml(String(draft.price))}" /></div>`;
    body.appendChild(grid);
    const descWrap = el("div", "field");
    descWrap.innerHTML = `<label>Beschreibung</label><textarea id="draft_desc">${escapeHtml(draft.desc)}</textarea>`;
    body.appendChild(descWrap);

    const actions = el("div", "row-actions");
    const avail = el("label");
    avail.style.cssText = "display:flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;";
    const cb = el("input"); cb.type = "checkbox"; cb.id = "draft_avail"; cb.checked = true;
    avail.appendChild(cb); avail.appendChild(document.createTextNode("verfügbar"));
    actions.appendChild(avail);
    actions.appendChild(btn("Speichern", "btn btn--sm", saveDraft));
    actions.appendChild(btn("Abbrechen", "btn btn--ghost btn--sm", cancelDraft));
    const m = el("span", "msg"); m.id = "draft_msg";
    actions.appendChild(m);
    body.appendChild(actions);

    row.appendChild(body);
    return row;
  }

  function cancelDraft() { draft = null; renderItemList(); }

  async function saveDraft() {
    const msg = $("#draft_msg");
    const name = $("#draft_name").value.trim();
    if (!name) { showMsg(msg, "Bitte einen Namen eingeben.", "error"); return; }
    showMsg(msg, "Speichern …", "");
    const { data, error } = await BHc.from(T.items).insert({
      category_id: state.currentCatId,
      name,
      quantity: $("#draft_qty").value.trim(),
      description: $("#draft_desc").value.trim(),
      price: parseFloat($("#draft_price").value) || 0,
      sort_order: state.items.length,
      is_available: $("#draft_avail").checked,
    }).select("id").single();
    if (error) { showMsg(msg, "Fehler: " + error.message, "error"); return; }

    // Upload the chosen image now that the row has an id
    if (draft.imageFile && data) {
      const key = keyFromName(draft.imageFile.name, String(Date.now()));
      const { error: upErr } = await BHc.storage.from(window.BH.bucket)
        .upload(key, draft.imageFile, { upsert: true, contentType: draft.imageFile.type || "image/jpeg" });
      if (!upErr) await BHc.from(T.items).update({ image_path: key }).eq("id", data.id);
    }
    draft = null;
    renderItemList();
  }

  async function saveItem(id) {
    const msg = $(`#it_msg_${id}`);
    const patch = {
      name: $(`#it_name_${id}`).value.trim(),
      quantity: $(`#it_qty_${id}`).value.trim(),
      description: $(`#it_desc_${id}`).value.trim(),
      price: parseFloat($(`#it_price_${id}`).value) || 0,
      is_available: $(`#it_avail_${id}`).checked,
    };
    const { error } = await BHc.from(T.items).update(patch).eq("id", id);
    showMsg(msg, error ? "Fehler: " + error.message : "Gespeichert ✓", error ? "error" : "ok");
  }

  async function moveItem(fromIdx, dir) {
    await reorder(state.items, fromIdx, fromIdx + dir, T.items);
    renderItemList();
  }

  async function deleteItem(it) {
    if (!confirm(`Produkt „${it.name}“ löschen?`)) return;
    if (it.image_path) await BHc.storage.from(window.BH.bucket).remove([it.image_path]);
    const { error } = await BHc.from(T.items).delete().eq("id", it.id);
    if (error) { alert("Fehler: " + error.message); return; }
    renderItemList();
  }

  async function uploadItemImage(it, fileObj, imgEl, msg) {
    if (!fileObj) return;
    showMsg(msg, "Bild wird hochgeladen …", "");
    const key = keyFromName(fileObj.name, String(Date.now()));
    const { error: upErr } = await BHc.storage.from(window.BH.bucket)
      .upload(key, fileObj, { upsert: true, contentType: fileObj.type || "image/jpeg" });
    if (upErr) { showMsg(msg, "Upload-Fehler: " + upErr.message, "error"); return; }

    const oldPath = it.image_path;
    const { error: dbErr } = await BHc.from(T.items).update({ image_path: key }).eq("id", it.id);
    if (dbErr) { showMsg(msg, "DB-Fehler: " + dbErr.message, "error"); return; }
    it.image_path = key;
    if (imgEl) imgEl.src = window.BH.publicUrl(key) + "?t=" + Date.now();
    if (oldPath && oldPath !== key) BHc.storage.from(window.BH.bucket).remove([oldPath]);
    showMsg(msg, "Bild aktualisiert ✓", "ok");
  }

  /* ---------- Shared reorder ---------- */
  async function reorder(list, fromIdx, toIdx, table) {
    if (toIdx < 0 || toIdx >= list.length) return;
    const arr = list.slice();
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    await Promise.all(arr.map((row, i) => BHc.from(table).update({ sort_order: i }).eq("id", row.id)));
  }

  /* ---------- Importer (one-time migration) ---------- */
  async function runImport() {
    if (!confirm("Import startet jetzt und ERSETZT alle vorhandenen Kategorien & Produkte. Fortfahren?")) return;
    const btnEl = $("#importBtn");
    const logEl = $("#importLog");
    btnEl.disabled = true;
    logEl.hidden = false;
    logEl.textContent = "";
    const log = (m) => { logEl.textContent += m + "\n"; logEl.scrollTop = logEl.scrollHeight; };

    try {
      log("Lade data/menu.json …");
      const data = await fetch("data/menu.json", { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error("menu.json nicht gefunden (HTTP " + r.status + ")");
        return r.json();
      });

      // 1) Settings
      log("Schreibe Einstellungen …");
      const f = data.festival || {};
      await BHc.from(T.settings).upsert({
        id: 1, edition: f.edition || "", title: f.title || "", organizer: f.organizer || "",
        tagline: f.tagline || "", note: f.note || "", social: f.social || {},
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      // 2) Wipe existing data (cascade removes items)
      log("Lösche bestehende Kategorien/Produkte …");
      await BHc.from(T.items).delete().not("id", "is", null);
      await BHc.from(T.categories).delete().not("id", "is", null);

      // 3) Categories + items
      const cats = data.categories || [];
      for (let ci = 0; ci < cats.length; ci++) {
        const cat = cats[ci];
        log(`\nKategorie: ${cat.name}`);
        const { data: insCat, error: cErr } = await BHc.from(T.categories).insert({
          slug: slugify(cat.id || cat.name), name: cat.name, emoji: cat.emoji || "",
          subtitle: cat.subtitle || "", sort_order: ci,
        }).select("id").single();
        if (cErr) throw new Error("Kategorie '" + cat.name + "': " + cErr.message);
        const categoryId = insCat.id;

        const items = cat.items || [];
        for (let ii = 0; ii < items.length; ii++) {
          const item = items[ii];
          let imagePath = null;
          if (item.image) {
            try {
              const blob = await fetch(encodeURI(item.image), { cache: "no-cache" }).then((r) => {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.blob();
              });
              const key = keyFromName(item.image);
              const { error: upErr } = await BHc.storage.from(window.BH.bucket)
                .upload(key, blob, { upsert: true, contentType: blob.type || "image/jpeg" });
              if (upErr) throw upErr;
              imagePath = key;
              log(`  ✓ ${item.name} (Bild ok)`);
            } catch (imgErr) {
              log(`  ⚠ ${item.name} – Bild fehlt/ Fehler: ${imgErr.message}`);
            }
          } else {
            log(`  • ${item.name} (kein Bild)`);
          }
          // Your data stored the quantity inside the name ("Sarma - 5 Stück") -> split it out
          let itName = item.name, itQty = "";
          const dash = String(item.name || "").split(" - ");
          if (dash.length === 2) { itName = dash[0].trim(); itQty = dash[1].trim(); }
          const { error: iErr } = await BHc.from(T.items).insert({
            category_id: categoryId, name: itName, quantity: itQty, description: item.desc || "",
            price: Number(item.price) || 0, image_path: imagePath, sort_order: ii, is_available: true,
          });
          if (iErr) throw new Error("Produkt '" + item.name + "': " + iErr.message);
        }
      }

      log("\n✅ Import abgeschlossen. Die Speisekarte lädt jetzt live aus Supabase.");
      showMsg($("#importMsg"), "Fertig ✓", "ok");
      try { localStorage.removeItem("bh_menu_cache_v1"); } catch (e) {}
      state.currentCatId = null;
      loadCategories();
    } catch (err) {
      console.error(err);
      log("\n❌ Fehler: " + err.message);
      showMsg($("#importMsg"), "Abgebrochen: " + err.message, "error");
    } finally {
      btnEl.disabled = false;
    }
  }

  /* ---------- small helpers ---------- */
  function field(label, id, value, type, step) {
    return `<div class="field"><label>${escapeHtml(label)}</label>` +
      `<input id="${id}" type="${type || "text"}"${step ? ` step="${step}"` : ""} value="${escapeHtml(String(value))}" /></div>`;
  }
  function btn(label, cls, onClick, disabled) {
    const b = el("button", cls); b.type = "button"; b.textContent = label;
    if (disabled) b.disabled = true; else b.addEventListener("click", onClick);
    return b;
  }
  function transparentPx() {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#e9e4d8"/>' +
      '<text x="50%" y="54%" font-size="34" text-anchor="middle" dominant-baseline="middle">🍴</text></svg>');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
