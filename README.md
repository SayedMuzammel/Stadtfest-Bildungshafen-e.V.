# 33. Interkulturelles Stadtfest – Speisekarte 🍽️

Eine schnelle, animierte und für Handy & PC optimierte Online-Speisekarte für das
**33. Interkulturelle Stadtfest** des **Bildungshafen e.V.** – gebaut mit reinem
HTML, CSS & JavaScript. Keine Datenbank, kein Server, keine Cookies. Inhalte
werden aus einer einzigen Datei (`data/menu.json`) geladen.

Jede Kategorie hat einen **eigenen Link** für einen **QR-Code**. Beim Scannen
öffnet sich dieselbe Speisekarte – direkt beim passenden Abschnitt.

---

## ✨ Funktionen
- **Eine Seite, drei Abschnitte** mit Deep-Links: `#speisen`, `#suessspeisen`, `#getraenke`
- **QR-Code-Generator** (`qr.html`) – pro Kategorie ein druckbarer Code
- **Dunkelmodus** (merkt sich die Auswahl)
- **Offline-fähig (PWA)** – lädt auch bei schlechtem Festival-WLAN
- **Animationen**: sanfte Einblendungen, Hover-Effekte, Scroll-Highlight der Tabs
- **Responsiv** für Handy, Tablet & PC, mit Druck-Ansicht
- **Platzhalter-Bilder**, bis echte Fotos eingefügt werden

---

## 📁 Projektstruktur
```
.
├── index.html              ← die Speisekarte
├── qr.html                 ← QR-Codes erstellen & drucken
├── data/menu.json          ← HIER Inhalte pflegen (Namen, Preise, Beschreibungen)
├── css/style.css           ← Design / Farben / Animationen
├── js/app.js               ← Logik (lädt die JSON, Animationen, Routing)
├── images/                 ← Fotos der Speisen (siehe images/README.md)
├── icons/                  ← App-Icons & Favicon
├── manifest.webmanifest    ← PWA-Konfiguration
└── service-worker.js       ← Offline-Cache
```

---

## ✏️ Inhalte ändern (für Nicht-Programmierer)
Alles steht in **`data/menu.json`**. Öffne die Datei in einem Texteditor.

**Preis oder Name ändern:** den Text zwischen den Anführungszeichen anpassen.
```json
{ "name": "Lahmacun", "desc": "Dünner Teigfladen …", "price": 5.00, "image": "images/lahmacun.jpg" }
```
- `price` ist eine Zahl mit Punkt (`5.00`) – die Anzeige macht daraus automatisch `5,00 €`.
- `image` ist der Pfad zum Foto. Fehlt das Foto, erscheint ein Platzhalter.

**Neues Gericht hinzufügen:** einen Block kopieren und in die passende
`"items": [ … ]`-Liste einfügen (Komma zwischen den Blöcken nicht vergessen).

**Neue Kategorie hinzufügen:** einen Kategorie-Block mit eigener `id`,
`name`, `emoji` und `items` ergänzen. Tab, Abschnitt **und** QR-Code entstehen
automatisch.

> Tipp: Nach dem Bearbeiten die Datei mit einem JSON-Prüfer (z. B.
> jsonlint.com) checken, damit kein Komma fehlt.

---

## 🌐 Veröffentlichen auf GitHub Pages
1. Neues Repository auf GitHub anlegen (z. B. `stadtfest-speisekarte`).
2. Diese Dateien hochladen (alle, inkl. Ordner).
3. **Settings → Pages → Build and deployment → Source: „Deploy from a branch“**,
   Branch `main`, Ordner `/ (root)`, **Save**.
4. Nach ein paar Minuten ist die Seite erreichbar unter:
   `https://DEINNAME.github.io/stadtfest-speisekarte/`

> Hinweis: Service Worker / PWA funktionieren nur über **HTTPS** – GitHub Pages
> liefert das automatisch. ✔️

---

## 🔳 QR-Codes erstellen
1. Veröffentlichte Seite öffnen und auf **„QR-Codes“** klicken (oder direkt
   `…/qr.html`).
2. Oben die **Adresse der veröffentlichten Speisekarte** eintragen
   (z. B. `https://DEINNAME.github.io/stadtfest-speisekarte/`).
3. Jede Kategorie zeigt ihren QR-Code → **PNG herunterladen** oder
   **„Alle drucken“**.
4. Codes ausdrucken und an den jeweiligen Ständen aufstellen.

*Die QR-Bilder werden über den Dienst api.qrserver.com erzeugt (Internet nötig,
nur beim Erstellen – nicht beim späteren Scannen durch Gäste).*

---

## 🖼️ Eigene Fotos einfügen
Fotos in den Ordner **`images/`** legen. Die erwarteten Dateinamen stehen in
[`images/README.md`](images/README.md). Kein Code-Wissen nötig.

---

## 🎨 Farben anpassen
Im Kopf von `css/style.css` stehen die Design-Variablen (`:root { … }`).
Z. B. `--harbor` (Hafen-Türkis), `--saffron` (Safran-Gelb), `--paprika` (Rot).

---

## 🧪 Lokal testen
Wegen `fetch()` der JSON-Datei am besten über einen kleinen lokalen Server
öffnen (nicht per Doppelklick auf die Datei):
```bash
# Python 3
python -m http.server 8000
# dann im Browser:  http://localhost:8000
```

---

Guten Appetit & afiyet olsun! · *Bildungshafen e.V.*
