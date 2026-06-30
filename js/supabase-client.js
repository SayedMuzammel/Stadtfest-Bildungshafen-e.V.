/* ============================================================
   Supabase – Client-Initialisierung
   Stellt window.BH bereit:
     BH.ready        -> boolean (ist alles konfiguriert?)
     BH.client       -> Supabase-Client
     BH.bucket       -> Name des Storage-Buckets
     BH.publicUrl()  -> öffentliche URL eines Bildpfads
   ============================================================ */
(function () {
  "use strict";

  const cfg = window.BH_CONFIG || {};
  const configured =
    !!window.supabase &&
    typeof cfg.SUPABASE_URL === "string" &&
    typeof cfg.SUPABASE_ANON_KEY === "string" &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT-ID") &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR-PUBLIC-ANON-KEY") &&
    cfg.SUPABASE_URL.startsWith("http");

  if (!configured) {
    window.BH = {
      ready: false,
      reason: !window.supabase
        ? "Supabase-Bibliothek nicht geladen."
        : "Bitte js/supabase-config.js mit deinen Projektdaten ausfüllen.",
    };
    return;
  }

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  const bucket = cfg.BUCKET || "menu-images";

  window.BH = {
    ready: true,
    client,
    bucket,
    TABLES: { settings: "site_settings", categories: "categories", items: "menu_items" },
    publicUrl(path) {
      if (!path) return "";
      return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    },
  };
})();
