/* ====== EZ Websitebuilder – Editor ============================================
   Laeuft unter /website (builder/client/editor.html). Websites erweitern ihn
   mit Plugins (site.config.json -> editor.plugins) ueber window.EZ_EDITOR.
   ----------------------------------------------------------------------------
   Links die Seiten, rechts die echte Seite in einem Rahmen - wahlweise gross
   oder als Handy im Mockup. Bearbeitet wird direkt im Text. Gespeichert wird
   nur, was vom HTML abweicht; die Dateien bleiben der Standard.            */
const $ = (s, r = document) => r.querySelector(s);
const HERKUNFT = location.origin;
const BREITE_DESKTOP = 1440;
const BREITE_HANDY = 390;

const zustand = {
  seiten: [],
  aktuell: null,
  geaendert: false,
  feldFuerBild: null,
  feldFuerLink: null,   // gesetzt, wenn ein Knopf-Block seine Adresse bekommt
  auswahl: null,        // zuletzt gemeldete Auswahl aus dem Rahmen
  schriften: [],        // Schriftliste aus dem Rahmen
  design: {},           // Website-Design (global)
  menue: [],            // Menue-Eintraege (global)
  anker: [],            // Sprungmarken aller Seiten (vom Server)
  ankerSeite: {},       // Sprungmarken je Seite, live aus dem Rahmen
  designDirty: false,   // Design/Menue geaendert und noch nicht gespeichert
  seiteDirty: false,    // Inhalte dieser Seite geaendert und noch nicht gespeichert
  geraet: 'desktop',
  vorschau: false,
  modus: 'text'
};

/* Aktuelle Farbe einer Design-Einstellung, so wie die Seite sie zeigt -
   damit der Farbwaehler nicht mit Schwarz beginnt. */
const fw = (name) => (zustand.farbwerte || {})[name] || '#1d1d1f';

const rahmenEl = () => (zustand.geraet === 'mobil' ? $('#etFrameM') : $('#etFrame'));
const rahmen = () => rahmenEl().contentWindow;

/* ---------------- Grundlagen ---------------- */
async function api(pfad, opt = {}) {
  const r = await fetch(pfad, {
    method: opt.method || 'GET',
    credentials: 'same-origin',
    headers: opt.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opt.body ? JSON.stringify(opt.body) : undefined
  });
  if (r.status === 401) { location.href = document.body.dataset.login || '/'; throw new Error('Nicht angemeldet'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Das hat nicht geklappt.');
  return d;
}

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.className = 'toast show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
}

function stand(text, warnung) {
  const el = $('#etState');
  el.textContent = text;
  el.classList.toggle('warn', !!warnung);
}

function setzeGeaendert(an) {
  zustand.geaendert = an;
  if (!an) { zustand.designDirty = false; zustand.seiteDirty = false; }
  /* Der Knopf bleibt anklickbar: ein gesperrter Knopf wirkt kaputt.
     Ohne Änderung sagt er einfach, dass es nichts zu speichern gibt. */
  $('#etSave').classList.toggle('btn-primary', an);
  $('#etSave').classList.toggle('ruht', !an);
  stand(an ? 'nicht gespeichert' : 'gespeichert', an);
}

/* ---------------- Grösse: die Seite wird massstabsgetreu eingepasst ------- */
function passeGroesseAn() {
  const host = $('#etDesk');
  const scaler = $('#etScaler');
  if (!host || zustand.geraet !== 'desktop') return;
  /* Schmaler Bildschirm: die Seite wird in 1440 px geladen und verkleinert.
     Breiter Bildschirm: sie wird in voller Breite geladen - sonst bliebe
     rechts ein weisser Streifen neben der Seite stehen. */
  const breite = Math.max(BREITE_DESKTOP, host.clientWidth);
  const faktor = host.clientWidth / breite;
  scaler.style.width = breite + 'px';
  scaler.style.height = Math.round(host.clientHeight / faktor) + 'px';
  scaler.style.transform = `scale(${faktor})`;
}
window.addEventListener('resize', passeGroesseAn);

function setzeGeraet(g) {
  zustand.geraet = g;
  /* Den nicht sichtbaren Rahmen leeren, sonst laufen zwei Seiten parallel. */
  (g === 'mobil' ? $('#etFrame') : $('#etFrameM')).src = 'about:blank';
  $('#etDesk').hidden = g !== 'desktop';
  $('#etPhone').hidden = g !== 'mobil';
  document.querySelectorAll('#etDevice button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.dev === g)));
  passeGroesseAn();
  if (zustand.aktuell) ladeRahmen();
  /* Einmal je Sitzung erklaeren, was die Handy-Ansicht bedeutet. */
  if (g === 'mobil') {
    let gesagt = false;
    try { gesagt = sessionStorage.getItem('ez-mobilinfo') === '1'; } catch { /* egal */ }
    if (!gesagt) {
      try { sessionStorage.setItem('ez-mobilinfo', '1'); } catch { /* egal */ }
      setTimeout(() => toast('Hier bearbeitest du nur die Handy-Ansicht – '
        + 'diese Änderungen gehen nicht auf die große Ansicht über.'), 900);
    }
  }
}

/* ---------------- Seitenliste ---------------- */
async function ladeSeiten() {
  const d = await api('/api/pages');
  zustand.seiten = d.pages || [];
  const sel = $('#etPageSel');
  sel.innerHTML = '<option value="">Seite wählen …</option>' + zustand.seiten.map((p) =>
    `<option value="${p.slug}">${p.titel} · ${p.pfad}</option>`).join('');
  sel.addEventListener('change', () => {
    if (!sel.value) return;
    const vorher = zustand.aktuell?.slug || '';
    if (!oeffne(sel.value)) sel.value = vorher;
  });
}

async function ladeAnker() {
  try { zustand.anker = (await api('/api/anker')).anker || []; } catch { /* dann eben ohne */ }
}
/* Auswahl fuer Verlinkungen: alle Seiten und alle Sprungmarken. */
function zielOptionen(aktuell) {
  const seiten = zustand.seiten.map((p) => [p.pfad, p.titel]);
  const marken = new Map();
  for (const a of zustand.anker) marken.set(a.seite + '#' + a.name, `${a.seitentitel} → ${a.titel}`);
  for (const [pfad, liste] of Object.entries(zustand.ankerSeite)) {
    const seite = zustand.seiten.find((p) => p.pfad === pfad);
    for (const a of liste) marken.set(pfad + '#' + a.name, `${seite ? seite.titel : pfad} → ${a.titel}`);
  }
  const bekannt = new Set([...seiten.map(([pf]) => pf), ...marken.keys()]);
  const opt = (w, t) => `<option value="${w.replace(/"/g, '&quot;')}" ${aktuell === w ? 'selected' : ''}>${t}</option>`;
  const html = `<optgroup label="Seiten">${seiten.map(([w, t]) => opt(w, t)).join('')}</optgroup>`
    + (marken.size ? `<optgroup label="Sprungmarken (Anker)">${[...marken].sort((a, b) => a[1].localeCompare(b[1])).map(([w, t]) => opt(w, t)).join('')}</optgroup>` : '')
    + `<option value="__eigen" ${aktuell !== undefined && !bekannt.has(aktuell) ? 'selected' : ''}>Eigener Link (Adresse eintippen) …</option>`;
  return { html, bekannt };
}
function ladeRahmen() {
  const seite = zustand.aktuell;
  const url = seite.pfad + (seite.pfad.includes('?') ? '&' : '?')
    + (zustand.vorschau ? 'vorschau=1' : 'edit=1')
    /* Im Handy-Mockup gibt es keine echte Statusleiste - die Seite bekommt
       ihre Hoehe deshalb als Wert mit, damit die Vorschau stimmt. */
    + (zustand.geraet === 'mobil' ? '&island=47' : '');
  $('#etBusy').hidden = false;
  stand('lädt …');
  rahmenEl().src = url;
  passeGroesseAn();
}

function oeffne(slug) {
  const seite = zustand.seiten.find((p) => p.slug === slug);
  if (!seite) return false;
  if (zustand.seiteDirty
    && !confirm('Die Änderungen auf dieser Seite sind noch nicht gespeichert. Trotzdem wechseln?')) return false;
  zustand.aktuell = seite;
  zustand.vorschau = false;
  pluginKnoepfeZeigen();
  $('#etPreview').textContent = 'Vorschau';
  $('#etPage').textContent = seite.titel;
  $('#etPageSel').value = slug;
  /* Design und Menue gelten fuer alle Seiten - ungespeicherte Aenderungen
     daran wandern mit auf die naechste Seite. */
  const design = zustand.designDirty;
  setzeGeaendert(false);
  zustand.designDirty = design;
  ladeRahmen();
  return true;
}

/* ---------------- Speichern ----------------
   Die grosse Ansicht und das Handy koennen unterschiedliche Inhalte haben.
   Deshalb wird beim Speichern am Desktop gefragt, ob die Aenderung auch
   fuers Telefon gelten soll. Wer die Frage satt hat, merkt die Antwort
   fuer den Tag. Was am Telefon geaendert wird, bleibt dort. */
let wartetAufWerte = null;

const HEUTE = () => new Date().toISOString().slice(0, 10);
function merkeAntwort(ja) {
  try { localStorage.setItem('ez-mobil', HEUTE() + ':' + (ja ? 'ja' : 'nein')); } catch { /* egal */ }
}
function gemerkteAntwort() {
  try {
    const v = localStorage.getItem('ez-mobil') || '';
    const [tag, wert] = v.split(':');
    if (tag === HEUTE() && (wert === 'ja' || wert === 'nein')) return wert === 'ja';
  } catch { /* egal */ }
  return null;
}

function mobilFrage() {
  return new Promise((fertig) => {
    const gemerkt = gemerkteAntwort();
    if (gemerkt !== null) return fertig(gemerkt);
    const box = document.createElement('div');
    box.className = 'ez-hinweisfenster';
    box.innerHTML = `<div class="ez-hf-inner" role="dialog" aria-modal="true">
        <h3>Änderung auch für das Handy übernehmen?</h3>
        <p>Die Handy-Ansicht kann eigene Inhalte haben. Sagst du nein, bleibt dort
           alles so, wie es ist – nur die große Ansicht ändert sich.</p>
        <label class="ez-merk"><input type="checkbox"> Antwort für heute merken</label>
        <div class="ez-hf-knoepfe">
          <button class="btn btn-primary btn-sm" data-w="ja" type="button">Ja, auch mobil</button>
          <button class="btn btn-sm" data-w="nein" type="button">Nein, nur große Ansicht</button>
        </div>
      </div>`;
    document.body.appendChild(box);
    box.querySelectorAll('button[data-w]').forEach((b) =>
      b.addEventListener('click', () => {
        const ja = b.dataset.w === 'ja';
        if (box.querySelector('input').checked) merkeAntwort(ja);
        box.remove();
        fertig(ja);
      }));
    box.querySelector('button[data-w=ja]').focus();
  });
}

async function speichern() {
  if (!zustand.aktuell) return;
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts speichern.');
  if (!zustand.geaendert) return toast('Es gibt nichts zu speichern – die Seite ist aktuell.');
  /* Am Telefon gilt die Aenderung ohnehin nur dort - keine Frage noetig. */
  const mobilMit = zustand.geraet === 'mobil' ? null : await mobilFrage();
  stand('speichert …');
  wartetAufWerte = async (werte) => {
    try {
      const d = await api('/api/pages/' + zustand.aktuell.slug, { method: 'PUT', body: { fields: werte } });
      /* Der Rahmen rechnet ab jetzt vom gespeicherten Stand aus weiter. */
      rahmen()?.postMessage({ typ: 'ez-gespeichert', werte: d.fields || werte }, HERKUNFT);
      setzeGeaendert(false);
      ladeAnker();
      toast(zustand.geraet === 'mobil'
        ? 'Gespeichert – gilt nur für die Handy-Ansicht.'
        : mobilMit
          ? 'Gespeichert – gilt für beide Ansichten.'
          : 'Gespeichert – die Handy-Ansicht bleibt unverändert.');
    } catch (e) {
      stand('nicht gespeichert', true);
      toast(e.message);
    }
  };
  rahmen()?.postMessage({ typ: 'ez-sammeln', mobilMit }, HERKUNFT);
}

/* ---------------- Vorschau ---------------- */
function vorschauUm() {
  if (!zustand.aktuell) return;
  if (!zustand.vorschau && zustand.geaendert
    && !confirm('Für die Vorschau wird die Seite neu geladen. Nicht gespeicherte Änderungen gehen dabei verloren. Fortfahren?')) return;
  zustand.vorschau = !zustand.vorschau;
  $('#etPreview').textContent = zustand.vorschau ? 'Bearbeiten' : 'Vorschau';
  document.body.classList.toggle('preview', zustand.vorschau);
  if (zustand.vorschau) setzeGeaendert(false);
  ladeRahmen();
}

/* ---------------- Textwerkzeuge ---------------- */
function befehl(name, wert) {
  rahmen()?.postMessage({ typ: 'ez-befehl', befehl: name, wert }, HERKUNFT);
}
document.querySelectorAll('#etTools .tbtn').forEach((b) => {   /* alte Leiste - falls vorhanden */
  /* Den Fokus im Rahmen lassen, sonst geht die Auswahl verloren. */
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
    if (b.dataset.cmd === 'link') linkSheet(true);
    else befehl(b.dataset.cmd);
  });
});

function linkSheet(auf) {
  $('#linkSheet').classList.toggle('open', auf);
  $('#linkBack').classList.toggle('open', auf);
  if (auf) {
    $('#linkZiel').innerHTML = zielOptionen($('#linkUrl').value.trim() || undefined).html;
    setTimeout(() => $('#linkUrl').focus(), 80);
  }
}
$('#linkZiel').addEventListener('change', (e) => {
  if (e.target.value !== '__eigen') $('#linkUrl').value = e.target.value;
  $('#linkUrl').focus();
});
$('#linkOk').addEventListener('click', () => {
  const url = $('#linkUrl').value.trim();
  if (!url) return;
  if (zustand.feldFuerLink) {
    rahmen()?.postMessage({ typ: 'ez-setzen', feld: zustand.feldFuerLink, wert: url }, HERKUNFT);
    setzeGeaendert(true);
  } else {
    befehl('createLink', url);
  }
  $('#linkUrl').value = '';
  zustand.feldFuerLink = null;
  linkSheet(false);
});
$('#linkOff').addEventListener('click', () => {
  if (zustand.feldFuerLink) {
    rahmen()?.postMessage({ typ: 'ez-setzen', feld: zustand.feldFuerLink, wert: '#' }, HERKUNFT);
    setzeGeaendert(true);
    zustand.feldFuerLink = null;
  } else befehl('unlink');
  linkSheet(false);
});

/* Die Schriften auch im Editor laden - damit die Auswahl jede Schrift in
   ihrer eigenen Gestalt zeigt. */
let schriftenGeladen = false;
function schriftenLaden() {
  if (schriftenGeladen || !zustand.schriften.length) return;
  schriftenGeladen = true;
  const fam = zustand.schriften.filter((f) => f.google).map((f) => 'family=' + f.google).join('&');
  if (!fam) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?' + fam + '&display=swap';
  document.head.appendChild(l);
}

/* Schriftauswahl: ein Knopf mit der aktuellen Schrift, darunter eine Liste,
   in der jeder Name in seiner Schrift steht. */
const stapelAttr = (st) => String(st || 'inherit').replace(/"/g, "'");
function schriftWahlHtml(aktuell) {
  const f = zustand.schriften.find((x) => x.id === aktuell);
  return `<div class="es-schrift" id="esSchrift">
    <button type="button" class="es-schrift-knopf" data-tu="schriftauf" style="font-family:${stapelAttr(f && f.stapel)}">
      ${f ? f.name : 'Standardschrift'} <span>▾</span></button>
    <div class="es-schrift-liste" hidden>
      <button type="button" data-schrift="">Standardschrift</button>
      ${zustand.schriften.map((x) => `<button type="button" data-schrift="${x.id}" style="font-family:${stapelAttr(x.stapel)}"
        class="${x.id === aktuell ? 'ist-aktiv' : ''}">${x.name}</button>`).join('')}
    </div></div>`;
}

/* Hinweis mit Knopf (z. B. Rueckgaengig nach dem Loeschen). */
let aktionsToast = null;
function toastMitAktion(text, knopf, fn) {
  aktionsToast?.remove();
  const box = document.createElement('div');
  box.className = 'toast toast-aktion show';
  box.innerHTML = `<span>${text}</span><button type="button" class="btn btn-sm">${knopf}</button>`;
  box.querySelector('button').addEventListener('click', () => { box.remove(); aktionsToast = null; fn(); });
  document.body.appendChild(box);
  aktionsToast = box;
  setTimeout(() => { if (aktionsToast === box) { box.remove(); aktionsToast = null; } }, 8000);
}

/* Tastenkuerzel auch dann, wenn der Fokus in der Werkzeugleiste liegt. */
document.addEventListener('keydown', (e) => {
  const inFeld = e.target && (e.target.matches('input, select, textarea') || e.target.isContentEditable);
  const meta = e.metaKey || e.ctrlKey;
  if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); speichern(); return; }
  if (inFeld) return;
  const sende = (taste) => rahmen()?.postMessage({ typ: 'ez-taste', taste }, HERKUNFT);
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); sende('loeschen'); }
  else if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); sende(e.shiftKey ? 'vor' : 'zurueck'); }
  else if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); sende('vor'); }
  else if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); sende('duplizieren'); }
  else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); sende('hoch'); }
  else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); sende('runter'); }
  else if (e.key === 'Escape') sende('esc');
});

/* Nicht gespeicherte Aenderungen nicht still verlieren. */
window.addEventListener('beforeunload', (e) => {
  if (zustand.geaendert && !zustand.vorschau) { e.preventDefault(); e.returnValue = ''; }
});

/* Kurze Hilfe beim ersten Mal (und auf Knopfdruck). */
function hilfeZeigen() {
  const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const schritte = [
    { nr: 1, titel: 'Seite wählen', text: 'Oben links im Dropdown die Seite aussuchen, die du bearbeiten willst.',
      icon: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h4"/>') },
    { nr: 2, titel: 'Anklicken und tippen', text: 'Text änderst du direkt auf der Seite. Ein Klick wählt aus, dann einfach lostippen.',
      icon: svg('<path d="M5 3l14 9-6 1-3 6z"/>') },
    { nr: 3, titel: 'Bilder & Videos', text: 'Bild anklicken und am Rahmen auf „Tauschen“ – eigene Fotos oder Videos hochladen.',
      icon: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>') },
    { nr: 4, titel: 'Abschnitte hinzufügen', text: 'Das Plus zwischen zwei Abschnitten oder die Kacheln links: Text, Bild, Galerie, Formular …',
      icon: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>') },
    { nr: 5, titel: 'Gestalten', text: 'Links in der Leiste: Schrift, Größe, Farbe, Ausrichtung – und die Einstellungen jedes Abschnitts.',
      icon: svg('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 1-3 1-4a9 9 0 0 0-7-8Z"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7" r="1.2"/><circle cx="16" cy="10" r="1.2"/>') },
    { nr: 6, titel: 'Prüfen und speichern', text: 'Mit dem Telefonsymbol die Handy-Ansicht prüfen, dann oben rechts speichern.',
      icon: svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.8h2"/><path d="m16 8 2 2 4-4"/>') }
  ];
  const box = document.createElement('div');
  box.className = 'ez-hinweisfenster';
  box.innerHTML = `<div class="ez-hf-inner es-hilfe" role="dialog" aria-modal="true" aria-labelledby="esHilfeTitel">
    <button type="button" class="es-hilfe-zu" aria-label="Schließen">✕</button>
    <div class="es-hilfe-kopf">
      <span class="es-hilfe-marke">Website-Editor</span>
      <h3 id="esHilfeTitel">In sechs Schritten zur eigenen Seite</h3>
      <p>Alles, was du hier änderst, siehst du sofort. Erst „Speichern“ macht es für Besucher sichtbar.</p>
    </div>
    <div class="es-hilfe-raster">
      ${schritte.map((s) => `<div class="es-hilfe-karte">
        <div class="es-hilfe-icon">${s.icon}<b>${s.nr}</b></div>
        <h4>${s.titel}</h4><p>${s.text}</p></div>`).join('')}
    </div>
    <div class="es-hilfe-tipps">
      <span><b>Rechte Maustaste</b> – Schnellmenü am Element</span>
      <span><b>Verschieben</b> – am Rahmen anfassen und ziehen</span>
      <span><b>Rotes Symbol</b> – Abschnitt löschen oder Element ausblenden</span>
      <span><b>Abschnitt ziehen</b> – Abschnitt wählen, dann am Griff „Verschieben" zwischen die anderen ziehen</span>
      <span><b>Kopfzeile, Menü, Fußzeile</b> – Kopf- oder Fußzeile anklicken, dann „Bearbeiten …“: ein Fenster für alles</span>
      <span><b>Sprungmarken</b> – Abschnitt anklicken, unten „Sprungmarke“ setzen; danach im Menü oder an Buttons als Ziel wählbar</span>
      <span><b>Rückgängig</b> – ↶ oben oder ⌘/Strg+Z nimmt den letzten Schritt zurück, ↷ holt ihn wieder – auch nach dem Speichern</span>
      <span><b>Tasten</b> – ⌘/Strg+S speichern · ⌘/Strg+D Abschnitt duplizieren · Alt+↑/↓ verschieben · Entf löschen · Esc abwählen</span>
      <span><b>? Hilfe</b> – diese Übersicht jederzeit wieder öffnen</span>
    </div>
    <div class="ez-hf-knoepfe"><button class="btn btn-primary" type="button" data-los>Los geht's</button></div>
  </div>`;
  const zu = () => { box.remove(); try { localStorage.setItem('ez-hilfe', '1'); } catch { /* egal */ } };
  box.querySelector('[data-los]').addEventListener('click', zu);
  box.querySelector('.es-hilfe-zu').addEventListener('click', zu);
  box.addEventListener('click', (e) => { if (e.target === box) zu(); });
  document.body.appendChild(box);
  box.querySelector('[data-los]').focus();
}
$('#etHilfe')?.addEventListener('click', hilfeZeigen);
try { if (!localStorage.getItem('ez-hilfe')) setTimeout(hilfeZeigen, 600); } catch { /* egal */ }

/* ---------------- Seitenleiste: zwei Bereiche ---------------- */
function seitenTab(t) {
  document.querySelectorAll('#etSideTabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === t)));
  document.querySelectorAll('.es-pane').forEach((el) => { el.hidden = el.dataset.tab !== t; });
  $('#etSide').scrollTop = 0;
}
document.querySelectorAll('#etSideTabs button').forEach((b) => b.addEventListener('click', () => seitenTab(b.dataset.tab)));

/* ---------------- Website-Design (global) ---------------- */
function designLeiste() {
  const host = $('#etDesign');
  if (!host) return;
  /* Geoeffnete Bereiche bleiben beim Neuzeichnen offen. */
  const offen = new Set([...host.querySelectorAll('details[open]')].map((x) => x.dataset.teil));
  const d = zustand.design || {};
  const sende = (m) => rahmen()?.postMessage(m, HERKUNFT);
  const wahl = (name, titel, liste) => `<label class="es-feld"><span>${titel}</span>
    <select class="input" data-design="${name}">${liste.map(([w, t]) =>
      `<option value="${w}" ${(d[name] || '') === w ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const farbe = (name, titel, standard) => `<div class="es-feld"><span>${titel}</span>
    <div class="es-farbfeld"><input type="color" data-design="${name}" value="${d[name] || standard}">
      <code>${d[name] || 'Standard'}</code>
      <button type="button" class="btn btn-sm" data-design-reset="${name}" ${d[name] ? '' : 'hidden'}>Zurück</button></div></div>`;
  /* Ohne Einstellung gilt die Schrift aus dem Seiten-CSS - mit Namen zeigen. */
  const std = (name) => (zustand.standardSchrift || {})[name === 'titelschrift' ? 'titel' : 'text'] || '';
  const stdName = (name) => std(name) ? `${std(name)} (Standard)` : 'Standardschrift';
  const schrift = (name, titel) => {
    const f = zustand.schriften.find((x) => x.id === d[name]);
    return `<div class="es-feld"><span>${titel}</span>
      <div class="es-schrift" data-design-schrift="${name}">
        <button type="button" class="es-schrift-knopf" style="font-family:${stapelAttr(f ? f.stapel : std(name))}">${f ? f.name : stdName(name)} <span>▾</span></button>
        <div class="es-schrift-liste" hidden>
          <button type="button" data-schrift="" style="font-family:${stapelAttr(std(name))}">${stdName(name)}</button>
          ${zustand.schriften.map((x) => `<button type="button" data-schrift="${x.id}" style="font-family:${stapelAttr(x.stapel)}" class="${x.id === d[name] ? 'ist-aktiv' : ''}">${x.name}</button>`).join('')}
        </div></div></div>`;
  };
  host.innerHTML = `
    <details data-teil="schrift"><summary>Schriften &amp; Farben</summary><div>
      ${schrift('titelschrift', 'Überschriften')}
      ${schrift('textschrift', 'Fließtext')}
      ${farbe('titelfarbe', 'Farbe der Überschriften', fw('titelfarbe'))}
      ${farbe('textfarbe', 'Farbe der Texte', fw('textfarbe'))}
      ${farbe('akzent', 'Akzentfarbe (Buttons, Menü, Flächen)', fw('akzent'))}
      ${wahl('knopfform', 'Button-Form', [['', 'Standard (eckig)'], ['weich', 'Leicht gerundet'], ['rund', 'Rund']])}
    </div></details>
    <details data-teil="anim"><summary>Animationen</summary><div>
      ${wahl('heroanim', 'Startbilder (groß oben)', [['', 'Parallax'], ['parallaxzoom', 'Parallax mit Zoom'], ['kenburns', 'Langsamer Zoom (endlos)'], ['zoomin', 'Heranzoomen beim Laden'], ['einblenden', 'Sanft einblenden'], ['aus', 'Keine Bewegung']])}
      ${wahl('animation', 'Abschnitte', ANIM_LISTE)}
      ${wahl('bildanim', 'Bilder', [['', 'Keine'], ['einblenden', 'Einblenden'], ['hochschieben', 'Hochschieben'], ['zoom', 'Heranzoomen'], ['weich', 'Aus der Unschärfe'], ['enthuellen', 'Aufdecken (von oben)']])}
      ${wahl('titelanim', 'Überschriften', [['', 'Keine'], ['einblenden', 'Einblenden'], ['hochschieben', 'Hochschieben'], ['woerter', 'Wort für Wort'], ['weich', 'Aus der Unschärfe']])}
      ${wahl('knopfanim', 'Buttons erscheinen', [['', 'Keine'], ['einblenden', 'Einblenden'], ['hochschieben', 'Hochschieben'], ['zoom', 'Heranzoomen']])}
      ${wahl('knopfhover', 'Buttons beim Darüberfahren', [['', 'Wie bisher'], ['anheben', 'Anheben mit Schatten'], ['glanz', 'Lichtreflex'], ['fuellen', 'Mit Farbe füllen']])}
      ${wahl('animtempo', 'Tempo', [['schnell', 'Schnell'], ['', 'Normal'], ['langsam', 'Gemächlich']])}
      <button type="button" class="btn btn-sm" data-design-vorschau>▶ In der Vorschau ansehen</button>
      <p class="mut" style="margin:0">Im Editor bleibt alles ruhig, damit nichts beim Bearbeiten wegspringt. Einzelne Bilder, Überschriften oder Abschnitte bekommen in ihrer Leiste eine eigene Animation.</p>
    </div></details>`;

  host.querySelectorAll('details[data-teil]').forEach((x) => { if (offen.has(x.dataset.teil)) x.open = true; });
  host.querySelector('[data-design-vorschau]')?.addEventListener('click', () => {
    if (zustand.seiteDirty) return toast('Bitte zuerst speichern – die Vorschau zeigt den gespeicherten Stand.');
    if (zustand.geaendert) return toast('Bitte zuerst speichern, dann die Vorschau öffnen.');
    vorschauUm();
  });
  host.querySelectorAll('select[data-design]').forEach((el) => el.addEventListener('change', () => {
    designSetzen(el.dataset.design, el.value);
  }));
  host.querySelectorAll('input[type="color"][data-design]').forEach((el) => el.addEventListener('input', () => {
    designSetzen(el.dataset.design, el.value);
    el.parentElement.querySelector('code').textContent = el.value;
    el.parentElement.querySelector('[data-design-reset]').hidden = false;
  }));
  host.querySelectorAll('[data-design-reset]').forEach((b) => b.addEventListener('click', () => {
    designSetzen(b.dataset.designReset, '');
    designLeiste();
  }));
  host.querySelectorAll('[data-design-schrift]').forEach((box) => {
    const name = box.dataset.designSchrift;
    box.querySelector('.es-schrift-knopf').addEventListener('click', () => {
      const l = box.querySelector('.es-schrift-liste'); l.hidden = !l.hidden;
    });
    box.querySelectorAll('.es-schrift-liste button').forEach((b) => b.addEventListener('click', () => {
      designSetzen(name, b.dataset.schrift);
      designLeiste();
      const d = host.querySelector('details[data-teil="schrift"]'); if (d) d.open = true;
    }));
  });
}
/* Eine Design-Einstellung setzen: merken, an die Seite schicken, als
   ungespeichert markieren. Leerer Wert = Standard. */
function designSetzen(name, wert) {
  if (wert) zustand.design[name] = wert; else delete zustand.design[name];
  zustand.designDirty = true;
  rahmen()?.postMessage({ typ: 'ez-design', was: name, wert: wert || '' }, HERKUNFT);
  setzeGeaendert(true);
}
function menueSetzen(liste) {
  zustand.menue = liste;
  zustand.designDirty = true;
  rahmen()?.postMessage({ typ: 'ez-menue', eintraege: liste }, HERKUNFT);
  setzeGeaendert(true);
}
document.querySelectorAll('.es-pane-design [data-nd-tab]').forEach((b) =>
  b.addEventListener('click', () => navDialog(true, b.dataset.ndTab)));

/* ---------------- Kopfzeile, Menü & Fußzeile: das Fenster ----------------
   Alles, was Kopfzeile, Menue, Handy-Menue und Fusszeile betrifft, an
   einem Ort. Das Fenster schwebt ueber der Werkzeugleiste, die Seite
   bleibt sichtbar und zeigt jede Aenderung sofort. */
const ND = { offen: false, tab: 'eintraege' };

function navDialog(auf, tab) {
  const el = $('#navSheet');
  if (auf === false) {
    if (!ND.offen) return;
    ND.offen = false;
    el.classList.remove('open');
    rahmen()?.postMessage({ typ: 'ez-burger', offen: false }, HERKUNFT);
    return;
  }
  if (!zustand.aktuell) return toast('Bitte zuerst oben eine Seite wählen.');
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern – oben auf „Bearbeiten“ wechseln.');
  ND.offen = true;
  el.classList.add('open');
  ndTab(tab || ND.tab);
}
function ndTab(t) {
  ND.tab = t;
  document.querySelectorAll('#navTabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.nt === t)));
  ndRendern();
  $('#navSheet').scrollTop = 0;
  /* Handy-Menü: im Telefon aufklappen, sonst wieder zu. */
  rahmen()?.postMessage({ typ: 'ez-burger', offen: t === 'handy' && zustand.geraet === 'mobil' }, HERKUNFT);
}
$('#navClose').addEventListener('click', () => navDialog(false));
$('#navFertig').addEventListener('click', () => navDialog(false));
document.querySelectorAll('#navTabs button').forEach((b) => b.addEventListener('click', () => ndTab(b.dataset.nt)));
/* Das Fenster laesst sich am Kopf verschieben, falls es im Weg ist. */
(() => {
  const griff = $('#navGriff'); const box = $('#navSheet');
  let start = null;
  griff.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = box.getBoundingClientRect();
    start = { x: e.clientX - r.left, y: e.clientY - r.top };
    griff.setPointerCapture?.(e.pointerId);
  });
  griff.addEventListener('pointermove', (e) => {
    if (!start) return;
    box.style.left = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - start.x)) + 'px';
    box.style.top = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - start.y)) + 'px';
  });
  const ende = () => { start = null; };
  griff.addEventListener('pointerup', ende); griff.addEventListener('pointercancel', ende);
})();

const ND_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>';
function ndRendern() {
  const host = $('#navBody');
  const d = zustand.design || {};
  const wahl = (name, titel, liste, voll) => `<label class="es-feld${voll ? ' voll' : ''}"><span>${titel}</span>
    <select class="input" data-nd-design="${name}">${liste.map(([w, t]) =>
      `<option value="${w}" ${(d[name] || '') === w ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  const farbe = (name, titel, standard) => `<div class="es-feld"><span>${titel}</span>
    <div class="es-farbfeld"><input type="color" data-nd-design="${name}" value="${d[name] || standard}">
      <code>${d[name] || 'Standard'}</code>
      <button type="button" class="btn btn-sm" data-nd-reset="${name}" ${d[name] ? '' : 'hidden'}>Zurück</button></div></div>`;
  const hinweis = (html) => `<p class="nd-hinweis">${ND_ICON}<span>${html}</span></p>`;
  const zurueck = (keys) => `<button type="button" class="btn btn-sm btn-ghost nd-zurueck" data-nd-standard="${keys.join(',')}">↺ Auf Standard zurücksetzen</button>`;
  let h = '';

  if (ND.tab === 'eintraege') {
    const menue = zustand.menue || [];
    const { bekannt } = zielOptionen();
    h += hinweis('Das Menü steht oben auf <b>jeder Seite</b>. Reihenfolge mit den Pfeilen ändern. Ein Eintrag „als Button“ wird hervorgehoben – gut für <b>Tisch reservieren</b>. Als Ziel geht jede Seite oder eine <b>Sprungmarke</b> (Anker) auf einer Seite.');
    h += `<div class="nd-liste">${menue.map((e, i) => {
      const eigen = !bekannt.has(e.link);
      return `<div class="nd-zeile${e.knopf ? ' ist-knopf' : ''}" data-i="${i}">
        <span class="nd-nr">${i + 1}</span>
        <input class="input" data-nm="text" value="${String(e.text).replace(/"/g, '&quot;')}" placeholder="Bezeichnung" aria-label="Bezeichnung">
        <select class="input nd-link" data-nm="ziel" aria-label="Verlinkt mit">${zielOptionen(e.link).html}</select>
        <label class="nd-knopfhaken" title="Als hervorgehobener Button anzeigen"><input type="checkbox" data-nm="knopf" ${e.knopf ? 'checked' : ''}> Button</label>
        <span class="nd-werkzeuge">
          <button type="button" data-nm="hoch" title="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-nm="runter" title="Nach unten" ${i === menue.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="weg" data-nm="weg" title="Eintrag entfernen">✕</button>
        </span>
        ${eigen ? `<input class="input nd-eigen" data-nm="link" value="${String(e.link).replace(/"/g, '&quot;')}" placeholder="https://… oder /#oeffnungszeiten" aria-label="Eigener Link">` : ''}
      </div>`; }).join('')}</div>
      <button type="button" class="btn btn-sm nd-neu" data-nm="neu">+ Eintrag hinzufügen</button>
      <div class="nd-titel">Darstellung am Computer</div>
      <div class="nd-gruppe">
        ${wahl('menuausricht', 'Position', [['', 'Rechts'], ['mitte', 'Mitte'], ['links', 'Links neben dem Logo']])}
        ${wahl('menugroesse', 'Schriftgröße', [['klein', 'Klein'], ['', 'Normal'], ['gross', 'Groß']])}
        ${wahl('menugross', 'Schreibweise', [['', 'GROSSBUCHSTABEN'], ['aus', 'Normal']])}
        ${wahl('menuaktiv', 'Aktuelle Seite markieren', [['', 'Unterstrichen'], ['fett', 'Fett'], ['keine', 'Gar nicht']])}
        ${farbe('menufarbe', 'Farbe der Einträge', fw('menufarbe'))}
      </div>
      ${zurueck(['menuausricht', 'menugroesse', 'menugross', 'menuaktiv', 'menufarbe'])}`;
  }

  if (ND.tab === 'kopf') {
    h += hinweis('<b>Logo, Name und Ort</b> änderst du direkt auf der Seite – einfach anklicken. Hier stellst du ein, wie sich die Kopfzeile verhält und aussieht.');
    h += `<div class="nd-titel">Verhalten beim Scrollen</div>
      <div class="nd-gruppe">
        ${wahl('kopf', 'Kopfzeile', [['', 'Bleibt oben stehen'], ['mitlaufend', 'Scrollt mit der Seite weg']])}
        ${wahl('kopfeffekt', 'Effekt', [['', 'Keiner'], ['glas', 'Milchglas (durchscheinend)'], ['schatten', 'Weicher Schatten'], ['transparent', 'Transparent über dem Startbild']])}
      </div>
      <div class="nd-titel">Aussehen</div>
      <div class="nd-gruppe">
        ${wahl('kopfhoehe', 'Höhe', [['kompakt', 'Kompakt'], ['', 'Normal'], ['hoch', 'Hoch']])}
        ${wahl('logogroesse', 'Logo', [['klein', 'Klein'], ['', 'Normal'], ['gross', 'Groß']])}
        ${wahl('kopflinie', 'Linie unter der Kopfzeile', [['', 'Anzeigen'], ['aus', 'Ausblenden']])}
        ${farbe('kopffarbe', 'Hintergrundfarbe', fw('kopffarbe'))}
      </div>
      <p class="mut" style="margin:0;font-size:.74rem">„Transparent über dem Startbild“ wirkt nur auf Seiten mit großem Startbild – sonst bleibt die Kopfzeile weiß.</p>
      <div class="es-zeile"><button type="button" class="btn btn-sm" data-nd-zeigen="#siteNav">Zur Kopfzeile springen</button></div>
      ${zurueck(['kopf', 'kopfeffekt', 'kopfhoehe', 'logogroesse', 'kopflinie', 'kopffarbe'])}`;
  }

  if (ND.tab === 'handy') {
    const mobil = zustand.geraet === 'mobil';
    h += hinweis('Auf dem Handy steckt das Menü hinter dem <b>☰</b>. Die Einträge sind dieselben wie am Computer – hier geht es nur ums Aussehen.');
    h += mobil
      ? `<div class="nd-handy"><p>Das Menü ist im Telefon <b>aufgeklappt</b> – du siehst jede Änderung sofort. Zum Zuklappen reicht ein Tipp auf das ☰ oder auf „Fertig“.</p></div>`
      : `<div class="nd-handy"><p>Um das Handy-Menü zu sehen, wechselt der Editor in die Handy-Ansicht und klappt das Menü auf.</p>
           <button type="button" class="btn btn-sm btn-primary" data-nd="handyansicht">Am Handy ansehen</button></div>`;
    h += `<div class="nd-titel">Farbe des aufgeklappten Menüs</div>
      <div class="nd-karten" data-nd-karten="burgerstil">
        ${[['', 'Hell', 'hell'], ['dunkel', 'Dunkel', 'dunkel'], ['akzent', 'Akzentfarbe', 'akzent']].map(([w, t, cls]) =>
          `<button type="button" data-wert="${w}" aria-pressed="${(d.burgerstil || '') === w}"><span class="nd-probe ${cls}"><i></i><i></i></span>${t}</button>`).join('')}
      </div>
      <div class="nd-gruppe">
        ${wahl('burgerausricht', 'Einträge', [['', 'Linksbündig'], ['mitte', 'Zentriert']])}
        ${wahl('burgergroesse', 'Schriftgröße', [['', 'Normal'], ['gross', 'Groß']])}
      </div>
      <div class="nd-titel">Menü-Symbol ☰</div>
      <div class="nd-gruppe">
        ${farbe('burgerfarbe', 'Farbe des Symbols', fw('burgerfarbe'))}
      </div>
      <p class="mut" style="margin:0;font-size:.74rem">Schreibweise (Großbuchstaben) und Farbe der Einträge übernimmt das Handy-Menü von den <b>Menü-Einträgen</b>.</p>
      ${zurueck(['burgerstil', 'burgerausricht', 'burgergroesse', 'burgerfarbe'])}`;
  }

  if (ND.tab === 'fuss') {
    h += hinweis('Die <b>Texte</b> der Fußzeile (Öffnungszeiten, Kontakt, Rechtliches) änderst du direkt auf der Seite – anklicken und tippen. Hier geht es um Farben und Aufteilung.');
    h += `<div class="nd-gruppe">
        ${farbe('fussfarbe', 'Hintergrundfarbe', fw('fussfarbe'))}
        ${farbe('fussschrift', 'Schriftfarbe', fw('fussschrift'))}
        ${wahl('fusslayout', 'Aufteilung', [['', 'Vier Spalten'], ['zwei', 'Zwei Spalten'], ['zentriert', 'Alles zentriert untereinander']], true)}
      </div>
      <div class="es-zeile"><button type="button" class="btn btn-sm" data-nd-zeigen="#siteFoot">Zur Fußzeile springen</button></div>
      ${zurueck(['fussfarbe', 'fussschrift', 'fusslayout'])}`;
  }
  host.innerHTML = h;

  /* Verdrahten */
  host.querySelectorAll('select[data-nd-design]').forEach((el) => el.addEventListener('change', () => designSetzen(el.dataset.ndDesign, el.value)));
  host.querySelectorAll('input[type="color"][data-nd-design]').forEach((el) => el.addEventListener('input', () => {
    designSetzen(el.dataset.ndDesign, el.value);
    el.parentElement.querySelector('code').textContent = el.value;
    el.parentElement.querySelector('[data-nd-reset]').hidden = false;
  }));
  host.querySelectorAll('[data-nd-reset]').forEach((b) => b.addEventListener('click', () => { designSetzen(b.dataset.ndReset, ''); ndRendern(); }));
  host.querySelectorAll('[data-nd-standard]').forEach((b) => b.addEventListener('click', () => {
    b.dataset.ndStandard.split(',').forEach((k) => designSetzen(k, ''));
    ndRendern();
    toast('Zurückgesetzt.');
  }));
  host.querySelectorAll('[data-nd-karten]').forEach((box) => box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    designSetzen(box.dataset.ndKarten, b.dataset.wert);
    box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  })));
  host.querySelectorAll('[data-nd-zeigen]').forEach((b) => b.addEventListener('click', () => rahmen()?.postMessage({ typ: 'ez-zeigen', ziel: b.dataset.ndZeigen }, HERKUNFT)));
  host.querySelector('[data-nd="handyansicht"]')?.addEventListener('click', () => {
    if (geraetWechseln('mobil')) ndRendern();
  });

  /* Menue-Eintraege */
  const lesen = () => [...host.querySelectorAll('.nd-zeile')].map((z) => {
    const ziel = z.querySelector('[data-nm="ziel"]').value;
    const eigen = z.querySelector('[data-nm="link"]');
    return {
      text: z.querySelector('[data-nm="text"]').value.trim(),
      link: ziel === '__eigen' ? ((eigen && eigen.value.trim()) || '#') : ziel,
      knopf: z.querySelector('[data-nm="knopf"]').checked ? 1 : 0
    };
  });
  const uebernehmen = (liste, neuZeichnen) => {
    menueSetzen(liste.filter((e) => e.text));
    if (neuZeichnen) ndRendern();
  };
  host.querySelectorAll('.nd-zeile [data-nm]').forEach((el) => {
    const z = el.closest('.nd-zeile'); const i = Number(z.dataset.i);
    const nm = el.dataset.nm;
    if (nm === 'text') el.addEventListener('input', () => { const l = lesen(); if (l[i]) menueSetzen(l); });
    if (nm === 'link') el.addEventListener('change', () => uebernehmen(lesen(), false));
    if (nm === 'ziel') el.addEventListener('change', () => {
      const l = lesen();
      if (el.value === '__eigen') l[i].link = '';
      uebernehmen(l, true);
      if (el.value === '__eigen') host.querySelector(`.nd-zeile[data-i="${i}"] [data-nm="link"]`)?.focus();
    });
    if (nm === 'knopf') el.addEventListener('change', () => uebernehmen(lesen(), true));
    if (nm === 'weg') el.addEventListener('click', () => {
      const l = lesen(); const [weg] = l.splice(i, 1); uebernehmen(l, true);
      toastMitAktion(`„${weg.text}“ aus dem Menü entfernt.`, 'Rückgängig', () => { const m = zustand.menue.slice(); m.splice(i, 0, weg); uebernehmen(m, true); });
    });
    if (nm === 'hoch' || nm === 'runter') el.addEventListener('click', () => {
      const l = lesen(); const j = nm === 'hoch' ? i - 1 : i + 1;
      if (j < 0 || j >= l.length) return;
      [l[i], l[j]] = [l[j], l[i]]; uebernehmen(l, true);
    });
  });
  host.querySelector('[data-nm="neu"]')?.addEventListener('click', () => {
    const l = lesen(); l.push({ text: 'Neuer Eintrag', link: zustand.seiten[0]?.pfad || '/', knopf: 0 });
    uebernehmen(l, true);
    const letzte = host.querySelector('.nd-zeile:last-child [data-nm="text"]');
    if (letzte) { letzte.focus(); letzte.select(); }
  });
}

/* ---------------- Werkzeugleiste links ---------------- */
function blockEinfuegen(art) {
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts hinzufügen.');
  if (!zustand.aktuell) return toast('Bitte zuerst oben eine Seite wählen.');
  rahmen()?.postMessage({ typ: 'ez-block', art }, HERKUNFT);
  setzeGeaendert(true);
}
$('#etKacheln').querySelectorAll('button').forEach((b) => {
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => blockEinfuegen(b.dataset.art));
});

const AUSRICHT = [['left', 'Links'], ['center', 'Mitte'], ['right', 'Rechts']];
const ANIM_LISTE = [['', 'Keine'], ['einblenden', 'Einblenden'], ['hochschieben', 'Hochschieben'], ['zoom', 'Heranzoomen'],
  ['links', 'Von links'], ['rechts', 'Von rechts'], ['weich', 'Aus der Unschärfe']];
const GALERIE_TYPEN = [
  ['raster3', 'Raster · 3 Spalten'], ['raster2', 'Raster · 2 Spalten'], ['raster4', 'Raster · 4 Spalten'],
  ['mosaik', 'Mosaik'], ['slider', 'Slider'], ['slidervoll', 'Slider · volle Breite']
];

/* Zeigt zum gewaehlten Element die passenden Werkzeuge. */
function elementLeiste(info) {
  const host = $('#etElement');
  if (!info) {
    host.innerHTML = '<p class="es-leer">Nichts gewählt – auf der Seite ein Element anklicken.</p>';
    return;
  }
  if (info.art === 'menue' || info.art === 'fuss') {
    const kopf = info.art === 'menue';
    host.innerHTML = `<div class="es-name">${kopf ? 'Kopfzeile & Menü' : 'Fußzeile'}</div>
      <p class="es-leer">${kopf
        ? 'Logo, Name und Ort änderst du direkt auf der Seite. Menü-Einträge, Verhalten und Aussehen der Kopfzeile stellst du im Fenster ein.'
        : 'Die Texte der Fußzeile änderst du direkt auf der Seite. Farben und Aufteilung stellst du im Fenster ein.'}</p>
      <div class="es-nd-knoepfe">${(kopf
        ? [['eintraege', 'Menü-Einträge'], ['kopf', 'Kopfzeile'], ['handy', 'Handy-Menü']]
        : [['fuss', 'Fußzeile gestalten']]).map(([t, n]) => `<button type="button" data-nd-tab="${t}">${n}</button>`).join('')}</div>`;
    host.querySelectorAll('[data-nd-tab]').forEach((b) => b.addEventListener('click', () => navDialog(true, b.dataset.ndTab)));
    return;
  }
  const istText = info.art === 'text' || info.art === 'knopf';
  const istBild = info.art === 'bild' || info.art === 'hintergrund';
  const block = info.block;
  const name = block ? ({ bild: 'Bild-Block', video: 'Video-Block', galerie: 'Galerie', text: 'Text-Block',
    ueberschrift: 'Überschrift', button: 'Button', trenner: 'Trenner', zitat: 'Zitat', spalten: 'Zwei Spalten',
    einbettung: 'Video-Einbettung', formular: 'Formular' })[block.art] || 'Abschnitt'
    : ({ text: 'Text', knopf: 'Button', bild: 'Bild', hintergrund: 'Hintergrund', block: 'Abschnitt' })[info.art];

  let h = `<div class="es-name">${name}${info.versteckt ? ' <em>ausgeblendet</em>' : ''}</div>`;
  if (istBild) {
    const video = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(info.quelle || '') || String(info.quelle || '').startsWith('/video/');
    const pos = info.ausschnitt || 'mitte';
    h += `<div class="es-zeile">
      <button type="button" class="btn btn-sm btn-primary" data-tu="bild">Tauschen</button>
      ${video ? '' : '<button type="button" class="btn btn-sm" data-tu="zuschneiden">Zuschneiden</button>'}
      <button type="button" class="btn btn-sm" data-tu="video">Video</button></div>
      <div class="es-feld"><span>Einpassen</span>
        <div class="seg es-seg" role="group">
          ${[['', 'Standard'], ['fuellen', 'Ausfüllen'], ['ganz', 'Ganz zeigen']].map(([w, t]) =>
            `<button type="button" data-tu="einpassen" data-wie="${w}" aria-pressed="${(info.einpassen || '') === w}">${t}</button>`).join('')}
        </div></div>
      <div class="es-feld"><span>Sichtbarer Bereich</span>
        <div class="es-fokus" role="group" aria-label="Sichtbarer Bereich">
          ${['oben-links', 'oben', 'oben-rechts', 'links', 'mitte', 'rechts', 'unten-links', 'unten', 'unten-rechts'].map((w) =>
            `<button type="button" data-tu="fokus" data-wie="${w}" title="${w.replace('-', ' ')}" aria-pressed="${pos === w}"><i></i></button>`).join('')}
        </div></div>`;
  }
  if (istText) {
    h += `<div class="es-feld"><span>Schrift</span>${schriftWahlHtml(info.schrift)}</div>
      <div class="es-zeile">
        <span class="es-label">Größe</span>
        <button type="button" class="btn btn-sm" data-tu="kleiner">A−</button>
        <label class="es-px" title="Schriftgröße in Pixel – eintippen oder mit ↑ ↓ ändern"><input type="number" id="esGroesse" min="8" max="200" step="1" value="${info.groesse || info.groesseIst || ''}" placeholder="–"><span>px</span></label>
        <button type="button" class="btn btn-sm" data-tu="groesser">A+</button></div>
      <div class="es-zeile"><span class="es-label">Ausrichtung</span>${AUSRICHT.map(([w, t]) =>
        `<button type="button" class="btn btn-sm${info.ausricht === w ? ' btn-primary' : ''}" data-tu="ausricht" data-wie="${w}">${t}</button>`).join('')}</div>
      <div class="es-zeile"><span class="es-label">Farbe</span>
        <button type="button" class="es-farbe${!info.farbe ? ' ist-aktiv' : ''}" data-tu="farbe" data-farbe="" title="Standard" style="background:linear-gradient(135deg,#fff 50%,#1d1d1f 50%)"></button>
        ${Object.entries(zustand.farben || {}).map(([id, hex]) =>
          `<button type="button" class="es-farbe${info.farbe === id ? ' ist-aktiv' : ''}" data-tu="farbe" data-farbe="${id}" title="${id}" style="background:${hex}"></button>`).join('')}</div>
      <div class="es-zeile"><span class="es-label">Eigene Farbe</span>
        <input type="color" data-tu="farbefrei" value="${/^#/.test(info.farbe || '') ? info.farbe : (zustand.farbwerte?.textfarbe || '#1d1d1f')}" title="Beliebige Farbe wählen">
        <button type="button" class="btn btn-sm" data-tu="formatkopie" title="Schrift, Größe, Farbe und Ausrichtung merken">Format kopieren</button>
        ${info.formatDa ? '<button type="button" class="btn btn-sm btn-primary" data-tu="formateinf" title="Gemerktes Format hier anwenden">Format einfügen</button>' : ''}</div>
      <div class="es-zeile">
        <button type="button" class="btn btn-sm" data-tu="fett" title="Fett (Cmd/Strg + B)"><b>B</b></button>
        <button type="button" class="btn btn-sm" data-tu="kursiv" title="Kursiv (Cmd/Strg + I)"><i>I</i></button>
        <button type="button" class="btn btn-sm" data-tu="link">Link im Text</button>
        <button type="button" class="btn btn-sm" data-tu="format" title="Formatierung entfernen">Format ⌫</button>
        <button type="button" class="btn btn-sm" data-tu="undo" title="Rückgängig (Cmd/Strg + Z)">⟲</button>
        <button type="button" class="btn btn-sm" data-tu="redo" title="Wiederherstellen">⟳</button></div>`;
  }
  if (istBild || istText) {
    const liste = istBild ? [['', 'Wie Website-Design'], ['keine', 'Keine'], ['einblenden', 'Einblenden'], ['hochschieben', 'Hochschieben'], ['zoom', 'Heranzoomen'], ['links', 'Von links'], ['rechts', 'Von rechts'], ['weich', 'Aus der Unschärfe'], ['enthuellen', 'Aufdecken']]
      : [['', 'Wie Website-Design'], ['keine', 'Keine'], ['einblenden', 'Einblenden'], ['hochschieben', 'Hochschieben'], ['zoom', 'Heranzoomen'], ['links', 'Von links'], ['rechts', 'Von rechts'], ['weich', 'Aus der Unschärfe'], ['woerter', 'Wort für Wort']];
    h += `<label class="es-feld"><span>Animation</span><select class="input" data-tu="anim">${liste.map(([w, t]) =>
      `<option value="${w}" ${(info.anim || '') === w ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  }
  if (info.link !== null && info.link !== undefined) {
    h += `<div class="es-feld es-ziel"><span>Verlinkung</span>
      <select class="input" data-tu="linkziel" title="Seite oder Sprungmarke wählen">${zielOptionen(info.link || undefined).html}</select>
      <div class="es-zeile"><input class="input" data-tu="linkfeld" value="${String(info.link).replace(/"/g, '&quot;')}" placeholder="/seite, /seite#anker oder https://…">
      <button type="button" class="btn btn-sm" data-tu="linkok">OK</button></div></div>`;
  }
  if (info.anker) {
    const a = info.anker;
    const adresse = a.name ? `${a.seite}#${a.name}` : '';
    h += `<div class="es-anker">
      <span class="es-label">Sprungmarke (Anker) dieses Abschnitts</span>
      <div class="es-zeile"><input class="input" data-tu="ankername" value="${a.name}" placeholder="${a.vorschlag}" maxlength="40" spellcheck="false">
        <button type="button" class="btn btn-sm btn-primary" data-tu="ankerok">${a.name ? 'Ändern' : 'Setzen'}</button>
        ${a.name ? '<button type="button" class="btn btn-sm" data-tu="ankerweg" title="Sprungmarke entfernen">✕</button>' : ''}</div>
      ${a.name ? `<div class="es-zeile"><code>${adresse}</code><button type="button" class="btn btn-sm" data-tu="ankerkopie" title="Adresse in die Zwischenablage">Link kopieren</button></div>
        <p class="mut">Diese Adresse steht jetzt in der Zielauswahl von Menü-Einträgen und Buttons.</p>`
        : `<p class="mut">Mit einer Sprungmarke lässt sich dieser Abschnitt aus dem Menü oder von einem Button aus anspringen – wie „Öffnungszeiten“ auf der Startseite.${a.fest ? ` Fester Anker vorhanden: <code>${a.seite}#${a.fest}</code>` : ''}</p>`}
    </div>`;
  }
  if (block && block.opt) {
    const o = block.opt;
    const wahl = (name, titel, liste) => `<label class="es-feld"><span>${titel}</span>
      <select class="input" data-gal="${name}">${liste.map(([w, t]) =>
        `<option value="${w}" ${String(o[name]) === w ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    let extra = '';
    if (block.art === 'galerie') {
      extra += wahl('typ', 'Darstellung', GALERIE_TYPEN)
        + `<label class="es-feld"><span>Anzahl Bilder</span>
           <input class="input" type="number" min="2" max="10" step="1" data-gal="n" value="${o.n}"></label>
           <div class="es-slider" ${/slider/.test(o.typ) ? '' : 'hidden'}>
             <label class="es-feld"><span>Dauer je Bild (Sekunden)</span>
               <input class="input" type="number" min="1" max="30" step="0.5" data-gal="dauer" value="${o.dauer}"></label>
             ${wahl('effekt', 'Übergang', [['fade', 'Überblenden'], ['slide', 'Schieben']])}
           </div>`;
    }
    if (block.art === 'bild' || block.art === 'video') {
      extra += wahl('rundung', 'Ecken', [['keine', 'Eckig'], ['weich', 'Leicht gerundet'], ['rund', 'Stark gerundet']])
        + wahl('hoehe', 'Höhe', [['auto', 'Automatisch'], ['klein', 'Klein'], ['mittel', 'Mittel'], ['gross', 'Groß']])
        + wahl('unterschrift', 'Bildunterschrift', [['0', 'Ohne'], ['1', 'Anzeigen']]);
    }
    if (block.art === 'button') {
      extra += wahl('stil', 'Stil', [['dunkel', 'Dunkel'], ['hell', 'Hell'], ['umriss', 'Nur Umriss']])
        + wahl('groesse', 'Größe', [['normal', 'Normal'], ['gross', 'Groß']])
        + wahl('lage', 'Position', [['links', 'Links'], ['mitte', 'Mitte'], ['rechts', 'Rechts']]);
    }
    if (block.art === 'trenner') {
      extra += wahl('art', 'Art', [['abstand', 'Nur Abstand'], ['linie', 'Linie']])
        + wahl('hoehe', 'Höhe', [['klein', 'Klein'], ['auto', 'Normal'], ['mittel', 'Groß'], ['gross', 'Sehr groß']]);
    }
    if (block.art === 'spalten') {
      extra += wahl('bildseite', 'Bild steht', [['rechts', 'Rechts'], ['links', 'Links']]);
    }
    if (block.art === 'formular') {
      const felder = block.opt.felder || [{ typ: 'text', label: 'Name', pflicht: 1 },
        { typ: 'email', label: 'E-Mail-Adresse', pflicht: 1 }, { typ: 'textarea', label: 'Nachricht', pflicht: 1 }];
      const typen = [['text', 'Textzeile'], ['email', 'E-Mail'], ['tel', 'Telefon'], ['textarea', 'Textfeld (mehrzeilig)'],
        ['select', 'Auswahl'], ['checkbox', 'Häkchen'], ['date', 'Datum']];
      extra += `<div class="es-label" style="margin:.2rem 0">Formularfelder</div>
        <div class="es-formfelder">${felder.map((f) => `
          <div class="es-formfeld">
            <input class="input" data-feld="label" value="${String(f.label).replace(/"/g, '&quot;')}" placeholder="Bezeichnung">
            <select class="input" data-feld="typ">${typen.map(([w, t]) => `<option value="${w}" ${f.typ === w ? 'selected' : ''}>${t}</option>`).join('')}</select>
            ${f.typ === 'select' ? `<input class="input" data-feld="optionen" value="${String(f.optionen || '').replace(/"/g, '&quot;')}" placeholder="Optionen, durch Komma getrennt">` : ''}
            <label class="es-pflicht"><input type="checkbox" data-feld="pflicht" ${f.pflicht ? 'checked' : ''}> Pflichtfeld</label>
            <button type="button" class="es-formweg" data-feld="weg" title="Feld entfernen">✕</button>
          </div>`).join('')}</div>
        <button type="button" class="btn btn-sm" data-feld="neu">+ Feld hinzufügen</button>
        <p class="mut" style="margin:.2rem 0 0">Titel, Text und Knopfbeschriftung direkt auf der Seite anklicken und ändern.
          Eingaben landen als E-Mail bei euch.</p>`;
    }
    if (block.art === 'einbettung') {
      extra += `<label class="es-feld"><span>YouTube- oder Vimeo-Adresse</span>
        <input class="input" data-gal="url" value="${String(o.url || '').replace(/"/g, '&quot;')}" placeholder="https://www.youtube.com/watch?v=…"></label>`;
    }
    h += `<div class="es-galerie" id="etGalerie">
      <div class="es-label" style="margin-bottom:.3rem">Abschnitt-Einstellungen</div>
      ${extra}
      ${wahl('hg', 'Hintergrund', [['keine', 'Keiner'], ['hell', 'Hell'], ['dunkel', 'Dunkel'], ['akzent', 'Akzentfarbe']])}
      ${wahl('anim', 'Animation beim Scrollen', [['erben', 'Wie Website-Design'], ['keine', 'Keine'], ...ANIM_LISTE.slice(1)])}
      ${wahl('abstand', 'Abstand oben/unten', [['klein', 'Klein'], ['normal', 'Normal'], ['gross', 'Groß']])}
      ${block.art === 'galerie' && /slidervoll/.test(o.typ) ? '' : wahl('breite', 'Breite', [['schmal', 'Schmal'], ['normal', 'Normal'], ['voll', 'Volle Breite']])}
    </div>`;
  }
  h += `<div class="es-zeile es-unten">
    ${info.art !== 'block' ? '<button type="button" class="btn btn-sm" data-tu="reset" title="Größe, Lage, Schrift zurücksetzen">↺ Zurücksetzen</button>' : ''}
    ${block && info.art !== 'block' ? '<button type="button" class="btn btn-sm" data-tu="abschnitt" title="Den ganzen Abschnitt auswählen – dann lässt er sich am Griff „Verschieben" zwischen die anderen ziehen">Abschnitt wählen</button>' : ''}
    ${block ? `<button type="button" class="btn btn-sm" data-tu="hoch" title="Abschnitt nach oben (Alt + ↑)">↑</button>
               <button type="button" class="btn btn-sm" data-tu="runter" title="Abschnitt nach unten">↓</button>
               <button type="button" class="btn btn-sm" data-tu="kopie" title="Abschnitt duplizieren">⧉</button>` : ''}
    <button type="button" class="btn btn-sm es-rot" data-tu="weg">${block ? 'Abschnitt löschen' : (info.versteckt ? 'Einblenden' : 'Ausblenden')}</button>
  </div>`;
  if (info.inKopf || info.inFuss) {
    h += `<div class="es-zeile"><button type="button" class="btn btn-sm" data-nd-tab="${info.inKopf ? 'kopf' : 'fuss'}">${info.inKopf ? 'Kopfzeile & Menü gestalten …' : 'Fußzeile gestalten …'}</button></div>`;
  }
  host.innerHTML = h;
  host.querySelectorAll('[data-nd-tab]').forEach((b) => b.addEventListener('click', () => navDialog(true, b.dataset.ndTab)));

  const sende = (m) => rahmen()?.postMessage(m, HERKUNFT);
  host.querySelectorAll('[data-tu]').forEach((el) => {
    if (el.tagName === 'BUTTON') el.addEventListener('mousedown', (e) => e.preventDefault());
    const tu = el.dataset.tu;
    const aktion = () => {
      if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
      if (tu === 'bild') sende({ typ: 'ez-bild-oeffnen-aktiv', video: false });
      if (tu === 'video') sende({ typ: 'ez-bild-oeffnen-aktiv', video: true });
      if (tu === 'kleiner') groesse(zustand.shift ? -4 : -1);
      if (tu === 'groesser') groesse(zustand.shift ? 4 : 1);
      if (tu === 'ausricht') sende({ typ: 'ez-ausricht', wie: el.dataset.wie });
      if (tu === 'fett') befehl('bold');
      if (tu === 'kursiv') befehl('italic');
      if (tu === 'format') befehl('removeFormat');
      if (tu === 'farbe') { sende({ typ: 'ez-farbe', farbe: el.dataset.farbe }); host.querySelectorAll('.es-farbe').forEach((x) => x.classList.toggle('ist-aktiv', x === el)); }
      if (tu === 'farbefrei') { sende({ typ: 'ez-farbe', farbe: el.value }); host.querySelectorAll('.es-farbe').forEach((x) => x.classList.remove('ist-aktiv')); }
      if (tu === 'fokus') { sende({ typ: 'ez-ausschnitt', wie: el.dataset.wie }); host.querySelectorAll('[data-tu="fokus"]').forEach((x) => x.setAttribute('aria-pressed', String(x === el))); }
      if (tu === 'einpassen') sende({ typ: 'ez-einpassen', wie: el.dataset.wie });
      if (tu === 'anim') sende({ typ: 'ez-anim', wie: el.value });
      if (tu === 'zuschneiden') zuschneiden(info);
      if (tu === 'formatkopie') sende({ typ: 'ez-format-kopieren' });
      if (tu === 'formateinf') sende({ typ: 'ez-format-einfuegen' });
      if (tu === 'kopie') sende({ typ: 'ez-block-duplizieren' });
      if (tu === 'undo') befehl('undo');
      if (tu === 'redo') befehl('redo');
      if (tu === 'link') { zustand.feldFuerLink = null; linkSheet(true); }
      if (tu === 'reset') sende({ typ: 'ez-zuruecksetzen', was: 'alles' });
      if (tu === 'abschnitt') sende({ typ: 'ez-abschnitt-waehlen' });
      if (tu === 'hoch') sende({ typ: 'ez-block-verschieben', richtung: -1 });
      if (tu === 'runter') sende({ typ: 'ez-block-verschieben', richtung: 1 });
      if (tu === 'weg') sende({ typ: 'ez-loeschen' });
      if (tu === 'linkok') {
        const url = host.querySelector('[data-tu="linkfeld"]').value.trim() || '#';
        if (info.linkFeld) { sende({ typ: 'ez-setzen', feld: info.linkFeld, wert: url }); setzeGeaendert(true); toast('Verlinkung gesetzt.'); }
      }
      if (tu === 'linkziel') {
        if (el.value === '__eigen') { host.querySelector('[data-tu="linkfeld"]').focus(); return; }
        host.querySelector('[data-tu="linkfeld"]').value = el.value;
        if (info.linkFeld) { sende({ typ: 'ez-setzen', feld: info.linkFeld, wert: el.value }); setzeGeaendert(true); toast('Verlinkung gesetzt.'); }
      }
      if (tu === 'ankerok' || tu === 'ankername') {
        const feld = host.querySelector('[data-tu="ankername"]');
        const name = feld.value.trim() || info.anker.vorschlag;
        sende({ typ: 'ez-anker', bezug: info.anker.bezug, name, titel: info.anker.titelVorschlag });
      }
      if (tu === 'ankerweg') sende({ typ: 'ez-anker', bezug: info.anker.bezug, name: '' });
      if (tu === 'ankerkopie') {
        const adresse = location.origin + info.anker.seite + '#' + info.anker.name;
        navigator.clipboard?.writeText(adresse).then(() => toast('Link kopiert: ' + adresse)).catch(() => toast(adresse));
      }
      if (tu === 'schriftauf') {
        const liste = host.querySelector('.es-schrift-liste');
        liste.hidden = !liste.hidden;
      }
    };
    if (el.tagName === 'SELECT') el.addEventListener('change', aktion);
    else if (el.tagName === 'INPUT' && el.type === 'color') el.addEventListener('input', aktion);
    else if (el.tagName === 'INPUT') el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      host.querySelector(tu === 'ankername' ? '[data-tu="ankerok"]' : '[data-tu="linkok"]')?.click();
    });
    else el.addEventListener('click', aktion);
  });
  host.querySelectorAll('.es-schrift-liste button').forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
      const id = b.dataset.schrift;
      if (id) sende({ typ: 'ez-schrift', schrift: id });
      else sende({ typ: 'ez-zuruecksetzen', was: 'schrift' });
      const f = zustand.schriften.find((x) => x.id === id);
      const knopf = host.querySelector('.es-schrift-knopf');
      knopf.style.fontFamily = f ? f.stapel : 'inherit';
      knopf.innerHTML = (f ? f.name : 'Standardschrift') + ' <span>▾</span>';
      host.querySelector('.es-schrift-liste').hidden = true;
      host.querySelectorAll('.es-schrift-liste button').forEach((x) => x.classList.toggle('ist-aktiv', x === b));
    });
  });

  /* Formular: Felder bearbeiten */
  host.querySelectorAll('[data-feld]').forEach((el) => {
    const senden = () => {
      const felder = [...host.querySelectorAll('.es-formfeld')].map((z) => ({
        label: z.querySelector('[data-feld="label"]').value.trim(),
        typ: z.querySelector('[data-feld="typ"]').value,
        pflicht: z.querySelector('[data-feld="pflicht"]').checked ? 1 : 0,
        optionen: z.querySelector('[data-feld="optionen"]')?.value || ''
      })).filter((f) => f.label);
      sende({ typ: 'ez-galerie', id: block.id, opt: { ...block.opt, felder } });
      setzeGeaendert(true);
    };
    if (el.dataset.feld === 'weg') el.addEventListener('click', () => { el.closest('.es-formfeld').remove(); senden(); });
    else if (el.dataset.feld === 'neu') el.addEventListener('click', () => {
      const felder = [...(block.opt.felder || [{ typ: 'text', label: 'Name', pflicht: 1 },
        { typ: 'email', label: 'E-Mail-Adresse', pflicht: 1 }, { typ: 'textarea', label: 'Nachricht', pflicht: 1 }])];
      felder.push({ typ: 'text', label: 'Neues Feld', pflicht: 0 });
      sende({ typ: 'ez-galerie', id: block.id, opt: { ...block.opt, felder } });
      setzeGeaendert(true);
    });
    else el.addEventListener('change', senden);
  });

  /* Galerie-Einstellungen wirken sofort. */
  host.querySelectorAll('[data-gal]').forEach((el) => {
    el.addEventListener('change', () => {
      if (zustand.vorschau) return;
      const opt = {};
      host.querySelectorAll('[data-gal]').forEach((x) => { opt[x.dataset.gal] = x.value; });
      const sl = host.querySelector('.es-slider'); if (sl) sl.hidden = !/slider/.test(opt.typ);
      sende({ typ: 'ez-galerie', id: block.id, opt });
      setzeGeaendert(true);
    });
  });
}

$('#etMedien').addEventListener('click', () => {
  zustand.feldFuerBild = null;
  $('#imgTitle').textContent = 'Bilder & Videos verwalten';
  $('#imgSheet').classList.remove('video-zuerst');
  bildSheet(true);
  ladeBilder().catch((err) => { $('#imgMsg').textContent = err.message; });
});

/* ---------------- Hinzufuegen-Menue ---------------- */
function addMenue(auf) {
  if (!$('#etAddMenu')) return;
  $('#etAddMenu').hidden = !auf;
  $('#etAddBtn').setAttribute('aria-expanded', String(auf));
}
$('#etAddBtn')?.addEventListener('mousedown', (e) => e.preventDefault());
$('#etAddBtn')?.addEventListener('click', () => {
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts hinzufügen.');
  addMenue($('#etAddMenu').hidden);
});
$('#etAddMenu')?.querySelectorAll('button').forEach((b) => {
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    addMenue(false);
    rahmen()?.postMessage({ typ: 'ez-block', art: b.dataset.art }, HERKUNFT);
    setzeGeaendert(true);
    toast('Block eingefügt – er steht hinter dem gewählten Element, sonst am Seitenende. '
      + 'Rechtsklick auf den Block: nach oben, nach unten, entfernen.');
  });
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('#etAdd')) addMenue(false);
});
$('#linkCancel').addEventListener('click', () => linkSheet(false));
$('#linkClose').addEventListener('click', () => linkSheet(false));
$('#linkBack').addEventListener('click', () => linkSheet(false));

/* ---------------- Bilder ---------------- */
function bildSheet(auf) {
  $('#imgSheet').classList.toggle('open', auf);
  $('#imgBack').classList.toggle('open', auf);
  if (!auf) { zustand.feldFuerBild = null; $('#imgMsg').textContent = ''; }
}

const VORHANDEN = [
  '/img/site/foto-02.jpg', '/img/site/foto-03.jpg', '/img/site/foto-04.jpg',
  '/img/site/foto-05.jpg', '/img/site/foto-06.jpg', '/img/site/foto-07.jpg',
  '/img/site/foto-08.jpg', '/img/site/foto-09.jpg', '/img/site/foto-10.jpg',
  '/img/site/foto-11.jpg', '/img/site/foto-12.jpg', '/img/site/foto-13.jpg',
  '/img/site/foto-14.jpg', '/img/site/foto-15.jpg', '/img/site/foto-16.jpg',
  '/img/site/foto-17.jpg', '/img/site/foto-18.jpg', '/img/site/foto-19.jpg'
];

async function ladeBilder() {
  const [d, v] = await Promise.all([api('/api/images'), api('/api/videos').catch(() => ({ videos: [] }))]);
  const eigene = (d.images || []).map((i) => i.url);
  $('#imgGrid').innerHTML = [...eigene, ...VORHANDEN]
    .map((u) => `<button type="button" data-url="${u}"><img src="${u}" alt="" loading="lazy"></button>`)
    .join('');
  $('#imgGrid').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => waehleBild(b.dataset.url)));

  const videos = v.videos || [];
  const vg = $('#vidGrid');
  vg.hidden = !videos.length; $('#vidTitel').hidden = !videos.length;
  vg.innerHTML = videos.map((x) => `
    <button type="button" data-url="${x.url}" title="${(x.name || '').replace(/"/g, '')}">
      <video src="${x.url}" muted playsinline preload="metadata"></video>
      <span class="vidtag">Video · ${Math.round((x.size || 0) / 1048576 * 10) / 10} MB</span>
      <span class="vidweg" data-id="${x.id}" title="Video löschen">✕</span>
    </button>`).join('');
  vg.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', (e) => {
      if (e.target.closest('.vidweg')) return;
      waehleBild(b.dataset.url);
    });
    b.addEventListener('mouseenter', () => b.querySelector('video')?.play().catch(() => {}));
    b.addEventListener('mouseleave', () => { const el = b.querySelector('video'); if (el) { el.pause(); el.currentTime = 0; } });
  });
  vg.querySelectorAll('.vidweg').forEach((x) =>
    x.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Dieses Video aus der Ablage löschen? Seiten, die es verwenden, zeigen dann nichts mehr.')) return;
      try { await api('/api/videos/' + x.dataset.id, { method: 'DELETE' }); await ladeBilder(); }
      catch (err) { $('#imgMsg').textContent = err.message; }
    }));
}

/* Video roh hochladen - ohne Base64, mit Fortschritt. */
function videoHochladen(datei) {
  return new Promise((fertig, fehler) => {
    const typ = datei.type || (/\.mov$/i.test(datei.name) ? 'video/quicktime' : 'video/mp4');
    const x = new XMLHttpRequest();
    x.open('POST', '/api/videos');
    x.setRequestHeader('Content-Type', typ);
    x.setRequestHeader('X-Datei-Name', encodeURIComponent(datei.name || ''));
    x.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        $('#imgMsg').textContent = `Video wird hochgeladen … ${Math.round(ev.loaded / ev.total * 100)} %`;
      }
    };
    x.onerror = () => fehler(new Error('Übertragung abgebrochen.'));
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText || '{}'); } catch { /* egal */ }
      if (x.status === 401) { location.href = document.body.dataset.login || '/'; return fehler(new Error('Nicht angemeldet')); }
      if (x.status >= 200 && x.status < 300) fertig(d);
      else fehler(new Error(d.error || 'Das hat nicht geklappt.'));
    };
    x.send(datei);
  });
}

$('#vidFile').addEventListener('change', async (e) => {
  const datei = e.target.files?.[0];
  e.target.value = '';
  if (!datei) return;
  if (datei.size > 40 * 1024 * 1024) {
    $('#imgMsg').textContent = 'Das Video ist zu groß (höchstens 40 MB). Bitte kürzer schneiden oder stärker komprimieren.';
    return;
  }
  try {
    const d = await videoHochladen(datei);
    $('#imgMsg').textContent = 'Video hochgeladen.';
    await ladeBilder();
    waehleBild(d.url);
  } catch (err) {
    $('#imgMsg').textContent = err.message;
  }
});

function waehleBild(url) {
  if (!zustand.feldFuerBild) return;
  rahmen()?.postMessage({ typ: 'ez-setzen', feld: zustand.feldFuerBild, wert: url }, HERKUNFT);
  setzeGeaendert(true);
  bildSheet(false);
}

/* Bilder bleiben so scharf wie moeglich: Passt die Datei ins Limit, geht sie
   unveraendert raus - ohne neues Komprimieren, also ohne Qualitaetsverlust.
   Erst wenn sie zu gross ist, wird auf 3200 px heruntergerechnet. */
const MAX_KANTE = 3200;
const MAX_BYTES = 3.6 * 1024 * 1024;

function aufbereiten(datei) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(new Error('Datei nicht lesbar.'));
    leser.onload = () => {
      const quelle = leser.result;
      const bild = new Image();
      bild.onerror = () => fehler(new Error('Das ist kein gültiges Bild.'));
      bild.onload = () => {
        const passt = datei.size <= MAX_BYTES
          && Math.max(bild.width, bild.height) <= MAX_KANTE;
        if (passt) return fertig({ dataUrl: quelle, info: `${bild.width}×${bild.height} px, unverändert` });

        let faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height));
        let aus = '';
        /* Solange verkleinern, bis die Datei ins Limit passt. */
        for (let i = 0; i < 6; i++) {
          const c = document.createElement('canvas');
          c.width = Math.round(bild.width * faktor);
          c.height = Math.round(bild.height * faktor);
          c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
          aus = c.toDataURL('image/jpeg', 0.92);
          if (aus.length * 0.75 <= MAX_BYTES) {
            return fertig({ dataUrl: aus, info: `${c.width}×${c.height} px` });
          }
          faktor *= 0.8;
        }
        fertig({ dataUrl: aus, info: 'verkleinert' });
      };
      bild.src = quelle;
    };
    leser.readAsDataURL(datei);
  });
}

$('#imgFile').addEventListener('change', async (e) => {
  const datei = e.target.files?.[0];
  e.target.value = '';
  if (!datei) return;
  $('#imgMsg').textContent = 'Bild wird vorbereitet …';
  try {
    const { dataUrl, info } = await aufbereiten(datei);
    const d = await api('/api/images', { method: 'POST', body: { dataUrl, name: datei.name } });
    $('#imgMsg').textContent = 'Hochgeladen: ' + info;
    await ladeBilder();
    waehleBild(d.url);
  } catch (err) {
    $('#imgMsg').textContent = err.message;
  }
});

$('#imgClose').addEventListener('click', () => bildSheet(false));
$('#imgBack').addEventListener('click', () => bildSheet(false));

/* ---------------- Nachrichten aus dem Rahmen ---------------- */
window.addEventListener('message', (e) => {
  if (e.origin !== HERKUNFT || !e.data || typeof e.data !== 'object') return;
  if (e.data.typ === 'ez-bereit') {
    /* Kopf-/Fusszeile im Builder-Format? Sonst den Bereich dafuer ausblenden. */
    const nd = document.querySelector('.es-pane-design .es-nd');
    if (nd && e.data.rahmen !== undefined) nd.hidden = !e.data.rahmen;
    $('#etBusy').hidden = true;
    if (!zustand.vorschau) rahmen()?.postMessage({ typ: 'ez-schriften' }, HERKUNFT);
    /* Es gibt nur noch einen Modus - anklicken, tippen, ziehen. */
    stand(zustand.vorschau ? 'Vorschau' : 'bereit');
    passeGroesseAn();
  }
  if (e.data.typ === 'ez-geaendert') { zustand.seiteDirty = true; setzeGeaendert(true); }
  if (e.data.typ === 'ez-verlauf') {
    $('#etUndo').disabled = !e.data.zurueck;
    $('#etRedo').disabled = !e.data.vor;
  }
  if (e.data.typ === 'ez-hinweis') toast(e.data.text);
  if (e.data.typ === 'ez-groesse-ist') {
    const s1 = $('#etSize'); if (s1) s1.textContent = e.data.px + ' px';
    const g = $('#esGroesse'); if (g && document.activeElement !== g) g.value = e.data.px;
  }
  if (e.data.typ === 'ez-link-waehlen') {
    /* Knopf-Block: die Adresse ist ein eigenes Feld. Sonst: Link im Text. */
    zustand.feldFuerLink = String(e.data.feld || '').startsWith('link.') ? e.data.feld : null;
    if (zustand.feldFuerLink) $('#linkUrl').value = e.data.aktuell || '';
    linkSheet(true);
  }
  if (e.data.typ === 'ez-auswahl') {
    const el = $('#etSel');
    if (el) el.textContent = e.data.art
      ? `${e.data.art.charAt(0).toUpperCase() + e.data.art.slice(1)} gewählt`
      : 'nichts gewählt';
    zustand.auswahl = e.data.art ? e.data : null;
    elementLeiste(zustand.auswahl);
    if (e.data.art === 'menue') navDialog(true, ND.offen && ND.tab !== 'fuss' ? ND.tab : (e.data.burgerOffen ? 'handy' : 'eintraege'));
    else if (e.data.art === 'fuss') navDialog(true, 'fuss');
    else if (e.data.art) seitenTab('seite');
  }
  if (e.data.typ === 'ez-speichern') speichern();
  if (e.data.typ === 'ez-zuschneiden' && zustand.auswahl) zuschneiden(zustand.auswahl);
  if (e.data.typ === 'ez-esc') {
    if ($('#cropSheet')?.classList.contains('open')) { $('#cropSheet').classList.remove('open'); $('#cropBack').classList.remove('open'); }
    else if ($('#imgSheet').classList.contains('open')) bildSheet(false);
    else if ($('#linkSheet').classList.contains('open')) linkSheet(false);
    else if (ND.offen) navDialog(false);
  }
  if (e.data.typ === 'ez-geloescht') {
    toastMitAktion(`${e.data.name || 'Abschnitt'} gelöscht.`, 'Rückgängig', () => {
      rahmen()?.postMessage({ typ: 'ez-wiederherstellen' }, HERKUNFT);
    });
  }
  if (e.data.typ === 'ez-schrift-oeffnen') {
    seitenTab('seite');
    const l = $('#etElement .es-schrift-liste'); if (l) { l.hidden = false; l.scrollIntoView({ block: 'nearest' }); }
  }
  if (e.data.typ === 'ez-design-werte') {
    if (zustand.designDirty) {
      /* Der Rahmen wurde neu geladen (Seite oder Ansicht gewechselt) - er
         bekommt den ungespeicherten Design-Stand zurueck. */
      rahmen()?.postMessage({ typ: 'ez-design-alle', werte: zustand.design, menue: zustand.menue }, HERKUNFT);
      setzeGeaendert(true); zustand.designDirty = true;
    } else {
      zustand.design = e.data.werte || {};
      zustand.menue = e.data.menue || [];
    }
    designLeiste();
    if (ND.offen) { ndRendern(); if (ND.tab === 'handy' && zustand.geraet === 'mobil') rahmen()?.postMessage({ typ: 'ez-burger', offen: true }, HERKUNFT); }
  }
  if (e.data.typ === 'ez-anker-liste') {
    zustand.ankerSeite[e.data.seite] = e.data.liste || [];
    if (ND.offen && ND.tab === 'eintraege') ndRendern();
  }
  if (e.data.typ === 'ez-anker-oeffnen') {
    seitenTab('seite');
    const box = $('#etElement .es-anker');
    if (box) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.classList.add('pocht'); setTimeout(() => box.classList.remove('pocht'), 1600); box.querySelector('[data-tu="ankername"]')?.focus(); }
  }
  if (e.data.typ === 'ez-design-oeffnen') {
    navDialog(true, { menue: 'eintraege', kopf: 'kopf', handy: 'handy', fuss: 'fuss' }[e.data.was] || 'eintraege');
  }
  if (e.data.typ === 'ez-galerie-oeffnen') {
    const box = $('#etGalerie');
    if (box) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); box.classList.add('pocht');
      setTimeout(() => box.classList.remove('pocht'), 1600); }
  }
  if (e.data.typ === 'ez-schriftliste') {
    zustand.schriften = e.data.liste || [];
    zustand.standardSchrift = e.data.standard || {};
    if (e.data.farben) zustand.farben = e.data.farben;
    if (e.data.farbwerte) zustand.farbwerte = e.data.farbwerte;
    schriftenLaden();
    if (zustand.auswahl) elementLeiste(zustand.auswahl);
    /* Die Website-Design-Leiste wurde vielleicht schon ohne Schriftliste
       gezeichnet - jetzt mit allen Schriften neu. */
    designLeiste();
  }
  if (e.data.typ === 'ez-bild-waehlen') {
    zustand.feldFuerBild = e.data.feld;
    bildSheet(true);
    $('#imgTitle').textContent = e.data.video ? 'Video auswählen' : 'Bild oder Video auswählen';
    $('#imgSheet').classList.toggle('video-zuerst', !!e.data.video);
    ladeBilder().then(() => {
      if (e.data.video) $('#vidBox').scrollIntoView({ block: 'nearest' });
    }).catch((err) => { $('#imgMsg').textContent = err.message; });
  }
  if (e.data.typ === 'ez-werte' && wartetAufWerte) {
    const f = wartetAufWerte; wartetAufWerte = null;
    f(e.data.werte || {});
  }
});

/* ---------------- Knöpfe ---------------- */
$('#etSave').addEventListener('click', speichern);
['#etUndo', '#etRedo'].forEach((sel, i) => {
  const b = $(sel);
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
    rahmen()?.postMessage({ typ: i === 0 ? 'ez-rueckgaengig' : 'ez-wiederholen' }, HERKUNFT);
  });
});
$('#etPreview').addEventListener('click', vorschauUm);
$('#etReload').addEventListener('click', () => {
  if (!zustand.aktuell) return;
  if (zustand.geaendert && !confirm('Alle nicht gespeicherten Änderungen dieser Seite verwerfen?')) return;
  setzeGeaendert(false);
  ladeRahmen();
});
/* Ein Hinweisfenster, das man bewusst wegklicken muss - fuer Dinge, die
   sonst untergehen, etwa das fehlende Datum auf der Speisekarte. */
function hinweisZeigen(titel, text) {
  document.querySelector('.ez-hinweisfenster')?.remove();
  const box = document.createElement('div');
  box.className = 'ez-hinweisfenster';
  box.innerHTML = `<div class="ez-hf-inner" role="dialog" aria-modal="true">
      <h3></h3><p></p>
      <button class="btn btn-primary btn-sm" type="button">Verstanden</button>
    </div>`;
  box.querySelector('h3').textContent = titel;
  box.querySelector('p').textContent = text;
  box.querySelector('button').addEventListener('click', () => box.remove());
  box.addEventListener('click', (e) => { if (e.target === box) box.remove(); });
  document.body.appendChild(box);
  box.querySelector('button').focus();
}

/* Schriftgröße in 1-px-Schritten (mit gedrückter Umschalttaste 4 px)
   oder direkt als Zahl im Feld neben A− / A+. */
function groesse(schritt, px) {
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
  rahmen()?.postMessage({ typ: 'ez-groesse', schritt, px }, HERKUNFT);
}
document.addEventListener('keydown', (e) => { zustand.shift = e.shiftKey; });
document.addEventListener('keyup', (e) => { zustand.shift = e.shiftKey; });
document.addEventListener('mousedown', (e) => { zustand.shift = e.shiftKey; }, true);
document.addEventListener('change', (e) => {
  if (e.target.id !== 'esGroesse') return;
  const px = Math.round(Number(e.target.value));
  if (px >= 8 && px <= 200) groesse(0, px);
});
document.addEventListener('input', (e) => {
  /* Pfeiltasten und die kleinen Pfeile im Feld: sofort anwenden. */
  if (e.target.id !== 'esGroesse' || e.inputType) return;
  const px = Math.round(Number(e.target.value));
  if (px >= 8 && px <= 200) groesse(0, px);
});
document.addEventListener('keydown', (e) => {
  if (e.target.id === 'esGroesse' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
/* Reinklicken markiert die Zahl ganz - einfach die neue Größe tippen. */
document.addEventListener('focusin', (e) => {
  if (e.target.id !== 'esGroesse') return;
  e.target.select();
  e.target.dataset.frisch = '1';
});
document.addEventListener('mouseup', (e) => {
  if (e.target.id === 'esGroesse' && e.target.dataset.frisch) { e.preventDefault(); delete e.target.dataset.frisch; }
});
document.addEventListener('focusout', (e) => {
  if (e.target.id !== 'esGroesse') return;
  delete e.target.dataset.frisch;
  const px = Math.round(Number(e.target.value));
  if (px >= 8 && px <= 200) groesse(0, px);
});
['#etSmaller', '#etBigger'].forEach((sel, i) => {
  const b = $(sel);
  if (!b) return;
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', (e) => groesse((i === 0 ? -1 : 1) * (e.shiftKey ? 4 : 1)));
});

/* Schriftart für das gewählte Element. */
$('#etFont')?.addEventListener('mousedown', () => { zustand.schriftKlick = true; });
$('#etFont')?.addEventListener('change', (e) => {
  const id = e.target.value;
  e.target.value = '';
  if (!id) return;
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
  rahmen()?.postMessage({ typ: 'ez-schrift', schrift: id }, HERKUNFT);
});

/* Ausrichtung des gewählten Elements. */
document.querySelectorAll('.tbtn[data-align]').forEach((b) => {
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
    rahmen()?.postMessage({ typ: 'ez-ausricht', wie: b.dataset.align }, HERKUNFT);
  });
});

/* Ein Element auf den Ausgangszustand zurücksetzen. */
$('#etReset')?.addEventListener('mousedown', (e) => e.preventDefault());
$('#etReset')?.addEventListener('click', () => {
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
  rahmen()?.postMessage({ typ: 'ez-zuruecksetzen', was: 'alles' }, HERKUNFT);
});

function geraetWechseln(g) {
  if (g === zustand.geraet) return true;
  if (zustand.seiteDirty
    && !confirm('Beim Wechsel der Ansicht wird die Seite neu geladen. Nicht gespeicherte Änderungen an den Inhalten dieser Seite gehen verloren – Design und Menü bleiben erhalten. Fortfahren?')) return false;
  /* Design-Aenderungen ueberleben das Neuladen: der Rahmen bekommt sie zurueck. */
  const design = zustand.designDirty;
  setzeGeaendert(false);
  zustand.designDirty = design;
  if (design) zustand.geaendert = true;
  setzeGeraet(g);
  return true;
}
document.querySelectorAll('#etDevice button').forEach((b) =>
  b.addEventListener('click', () => geraetWechseln(b.dataset.dev)));
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (zustand.geaendert) speichern(); }
  if (e.key === 'Escape') {
    if ($('#cropSheet')?.classList.contains('open')) { $('#cropSheet').classList.remove('open'); $('#cropBack').classList.remove('open'); }
    else if ($('#imgSheet').classList.contains('open')) bildSheet(false);
    else if ($('#linkSheet').classList.contains('open')) linkSheet(false);
    else if (ND.offen) navDialog(false);
  }
});
window.addEventListener('beforeunload', (e) => {
  if (zustand.geaendert) { e.preventDefault(); e.returnValue = ''; }
});

/* ---------------- Start ---------------- */
(async () => {
  try {
    await ladeSeiten();
    ladeAnker();
    oeffne('index');
    passeGroesseAn();
  } catch (e) { toast(e.message); }
})();

/* ---------------- Plugins ----------------
   Eine Website kann den Editor um eigene Knoepfe erweitern (site.config.json
   -> editor.plugins). Ein Plugin ist ein kleines Modul, das window.EZ_EDITOR
   benutzt, etwa:
     EZ_EDITOR.knopf({ text: 'Karte aus PDF', seiten: ['speisekarte'], klick: () => ... });
*/
const pluginKnoepfe = [];
function pluginKnoepfeZeigen() {
  const slug = zustand.aktuell?.slug;
  for (const k of pluginKnoepfe) k.el.hidden = !(slug && (!k.seiten || k.seiten.includes(slug)));
}
window.EZ_EDITOR = {
  get seite() { return zustand.aktuell ? { ...zustand.aktuell } : null; },
  api,
  toast,
  hinweis: hinweisZeigen,
  stand,
  beschaeftigt(an) { $('#etBusy').hidden = !an; },
  setzen(feld, wert) {
    rahmen()?.postMessage({ typ: 'ez-setzen', feld, wert }, HERKUNFT);
    zustand.seiteDirty = true;
    setzeGeaendert(true);
  },
  knopf({ text, titel, seiten, klick }) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn-sm'; b.textContent = text; if (titel) b.title = titel;
    b.addEventListener('click', () => klick(window.EZ_EDITOR));
    $('.et-actions').prepend(b);
    pluginKnoepfe.push({ el: b, seiten: seiten || null });
    pluginKnoepfeZeigen();
    return b;
  },
  datei(accept) {
    return new Promise((fertig) => {
      const i = document.createElement('input');
      i.type = 'file'; if (accept) i.accept = accept;
      i.addEventListener('change', () => fertig(i.files?.[0] || null));
      i.click();
    });
  }
};

/* ---------------- Zuschneiden ----------------
   Ein Rahmen ueber dem Foto, an Ecken und Kanten verstellbar, mit festen
   Seitenverhaeltnissen, Drehen und Spiegeln. "Übernehmen" rechnet den
   Ausschnitt im Browser in voller Aufloesung aus, laedt ihn als neues Bild
   hoch und setzt es ein - das Original bleibt in der Mediathek. */
const SCHNITT = { feld: null, quelle: null, bild: null, drehung: 0, spiegel: false,
  box: { x: 0.05, y: 0.05, b: 0.9, h: 0.9 }, format: 0, platz: 0 };
function schnittFenster() {
  let el = $('#cropSheet');
  if (el) return el;
  document.body.insertAdjacentHTML('beforeend', `
    <div class="sheet-backdrop" id="cropBack"></div>
    <div class="sheet sheet-wide crop" id="cropSheet" role="dialog" aria-modal="true" aria-labelledby="cropTitel">
      <div class="sheet-head"><h2 id="cropTitel">Zuschneiden</h2>
        <button class="btn btn-icon btn-ghost" id="cropZu" aria-label="Schließen" type="button">✕</button></div>
      <div class="sheet-body">
        <div class="crop-buehne" id="cropBuehne">
          <div class="crop-flaeche" id="cropFlaeche">
            <img id="cropBild" alt="">
            <div class="crop-box" id="cropBox">
              <i class="crop-raster"></i>
              ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((g) => `<b class="crop-griff g-${g}" data-griff="${g}"></b>`).join('')}
            </div>
          </div>
        </div>
        <div class="crop-leiste">
          <div class="seg es-seg crop-formate" id="cropFormate"></div>
          <div class="crop-werkzeuge">
            <button type="button" class="btn btn-sm" data-crop="links" title="90° nach links drehen">⟲</button>
            <button type="button" class="btn btn-sm" data-crop="rechts" title="90° nach rechts drehen">⟳</button>
            <button type="button" class="btn btn-sm" data-crop="spiegel" title="Spiegeln">⇋</button>
            <button type="button" class="btn btn-sm btn-ghost" data-crop="zurueck">Zurücksetzen</button>
          </div>
        </div>
        <p class="mut crop-info" id="cropInfo"></p>
      </div>
      <div class="sheet-foot">
        <button class="btn btn-primary" type="button" id="cropOk">Übernehmen</button>
        <button class="btn" type="button" id="cropAbbruch">Abbrechen</button>
      </div>
    </div>`);
  el = $('#cropSheet');
  const zu = () => { el.classList.remove('open'); $('#cropBack').classList.remove('open'); };
  $('#cropZu').addEventListener('click', zu);
  $('#cropAbbruch').addEventListener('click', zu);
  $('#cropBack').addEventListener('click', zu);
  el.querySelectorAll('[data-crop]').forEach((b) => b.addEventListener('click', () => {
    const w = b.dataset.crop;
    if (w === 'links' || w === 'rechts') { SCHNITT.drehung = (SCHNITT.drehung + (w === 'rechts' ? 90 : 270)) % 360; schnittVorbereiten(true); }
    if (w === 'spiegel') { SCHNITT.spiegel = !SCHNITT.spiegel; schnittVorbereiten(false); }
    if (w === 'zurueck') { SCHNITT.drehung = 0; SCHNITT.spiegel = false; SCHNITT.format = 0; schnittVorbereiten(true); }
  }));
  /* Ziehen: Box verschieben oder an einem Griff verformen */
  const box = $('#cropBox');
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const flaeche = $('#cropFlaeche').getBoundingClientRect();
    const griff = e.target.dataset.griff || '';
    const start = { x: e.clientX, y: e.clientY, ...SCHNITT.box };
    box.setPointerCapture(e.pointerId);
    const bewegen = (ev) => {
      const dx = (ev.clientX - start.x) / flaeche.width, dy = (ev.clientY - start.y) / flaeche.height;
      let { x, y, b, h } = start;
      if (!griff) { x = Math.min(1 - b, Math.max(0, x + dx)); y = Math.min(1 - h, Math.max(0, y + dy)); }
      else {
        if (griff.includes('w')) { const nx = Math.min(x + b - 0.03, Math.max(0, x + dx)); b += x - nx; x = nx; }
        if (griff.includes('e')) b = Math.min(1 - x, Math.max(0.03, b + dx));
        if (griff.includes('n')) { const ny = Math.min(y + h - 0.03, Math.max(0, y + dy)); h += y - ny; y = ny; }
        if (griff.includes('s')) h = Math.min(1 - y, Math.max(0.03, h + dy));
        /* Festes Format: die andere Seite rechnet sich mit */
        const f = schnittFormat();
        if (f) {
          const bild = f * flaeche.height / flaeche.width;      // Breite in Anteilen je Anteil Hoehe
          if (griff === 'n' || griff === 's') { b = h * bild; if (x + b > 1) { b = 1 - x; h = b / bild; } }
          else { h = b / bild; if (y + h > 1) { h = 1 - y; b = h * bild; } if (griff.includes('n')) y = start.y + start.h - h; }
        }
      }
      SCHNITT.box = { x, y, b, h };
      schnittBoxZeigen();
    };
    const ende = () => { box.removeEventListener('pointermove', bewegen); box.removeEventListener('pointerup', ende); box.removeEventListener('pointercancel', ende); };
    box.addEventListener('pointermove', bewegen);
    box.addEventListener('pointerup', ende);
    box.addEventListener('pointercancel', ende);
  });
  $('#cropOk').addEventListener('click', schnittUebernehmen);
  window.addEventListener('resize', () => { if (el.classList.contains('open')) schnittBoxZeigen(); });
  return el;
}
/* Seitenverhaeltnis (Breite/Hoehe) des gewaehlten Formats, 0 = frei. */
function schnittFormat() {
  const f = SCHNITT.format;
  if (f === 'platz') return SCHNITT.platz || 0;
  if (f === 'original') return SCHNITT.bild ? SCHNITT.bild.width / SCHNITT.bild.height : 0;
  return Number(f) || 0;
}
function schnittFormateZeigen() {
  const liste = [['0', 'Frei'], ...(SCHNITT.platz ? [['platz', 'Wie der Platz']] : []), ['original', 'Original'],
    [String(1), '1:1'], [String(4 / 3), '4:3'], [String(3 / 2), '3:2'], [String(16 / 9), '16:9'], [String(3 / 4), '3:4'], [String(9 / 16), '9:16']];
  const host = $('#cropFormate');
  host.innerHTML = liste.map(([w, t]) => `<button type="button" data-format="${w}" aria-pressed="${String(SCHNITT.format) === w}">${t}</button>`).join('');
  host.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    SCHNITT.format = b.dataset.format === '0' ? 0 : b.dataset.format;
    schnittFormatAnwenden();
    schnittFormateZeigen();
  }));
}
/* Die Box auf das Format bringen - moeglichst gross, mittig um die alte. */
function schnittFormatAnwenden() {
  const f = schnittFormat();
  if (!f) return schnittBoxZeigen();
  const fl = $('#cropFlaeche').getBoundingClientRect();
  const verh = f * fl.height / fl.width;   // b/h in Anteilen
  let b = 1, h = b / verh;
  if (h > 1) { h = 1; b = h * verh; }
  const m = { x: SCHNITT.box.x + SCHNITT.box.b / 2, y: SCHNITT.box.y + SCHNITT.box.h / 2 };
  SCHNITT.box = { b, h, x: Math.min(1 - b, Math.max(0, m.x - b / 2)), y: Math.min(1 - h, Math.max(0, m.y - h / 2)) };
  schnittBoxZeigen();
}
function schnittBoxZeigen() {
  const { x, y, b, h } = SCHNITT.box;
  const box = $('#cropBox');
  box.style.left = x * 100 + '%'; box.style.top = y * 100 + '%';
  box.style.width = b * 100 + '%'; box.style.height = h * 100 + '%';
  const q = SCHNITT.gedreht;
  if (q) $('#cropInfo').textContent = `Ergebnis: ${Math.round(b * q.width)} × ${Math.round(h * q.height)} px`;
}
/* Gedrehtes/gespiegeltes Bild als Leinwand - darauf bezieht sich die Box. */
function schnittVorbereiten(boxNeu) {
  const q = SCHNITT.bild;
  const quer = SCHNITT.drehung % 180 !== 0;
  const c = document.createElement('canvas');
  c.width = quer ? q.height : q.width; c.height = quer ? q.width : q.height;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.rotate(SCHNITT.drehung * Math.PI / 180);
  if (SCHNITT.spiegel) g.scale(-1, 1);
  g.drawImage(q, -q.width / 2, -q.height / 2);
  SCHNITT.gedreht = c;
  $('#cropBild').src = c.toDataURL('image/jpeg', 0.85);
  $('#cropBild').onload = () => {
    if (boxNeu) SCHNITT.box = { x: 0, y: 0, b: 1, h: 1 };
    schnittFormateZeigen();
    if (boxNeu && SCHNITT.format) schnittFormatAnwenden(); else schnittBoxZeigen();
  };
}
async function zuschneiden(info) {
  if (zustand.vorschau) return toast('In der Vorschau lässt sich nichts ändern.');
  if (!info || !info.quelle) return toast('Bitte zuerst ein Bild anklicken.');
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(info.quelle) || info.quelle.startsWith('/video/')) return toast('Videos lassen sich nicht zuschneiden.');
  const el = schnittFenster();
  SCHNITT.feld = info.feld; SCHNITT.drehung = 0; SCHNITT.spiegel = false;
  SCHNITT.platz = info.masse && info.masse.h ? info.masse.b / info.masse.h : 0;
  SCHNITT.format = SCHNITT.platz ? 'platz' : 0;
  $('#cropInfo').textContent = 'Bild wird geladen …';
  el.classList.add('open'); $('#cropBack').classList.add('open');
  const bild = new Image();
  bild.onload = () => { SCHNITT.bild = bild; schnittVorbereiten(true); };
  bild.onerror = () => { $('#cropInfo').textContent = 'Das Bild ließ sich nicht laden.'; };
  bild.src = new URL(info.quelle, location.origin).href;
}
async function schnittUebernehmen() {
  const q = SCHNITT.gedreht;
  if (!q || !SCHNITT.feld) return;
  const { x, y, b, h } = SCHNITT.box;
  const sx = Math.round(x * q.width), sy = Math.round(y * q.height);
  const sb = Math.max(1, Math.round(b * q.width)), sh = Math.max(1, Math.round(h * q.height));
  /* Hoechstens 2400 px an der langen Seite - reicht fuer jeden Bildschirm. */
  const f = Math.min(1, 2400 / Math.max(sb, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sb * f); c.height = Math.round(sh * f);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(q, sx, sy, sb, sh, 0, 0, c.width, c.height);
  const png = /\.png(\?|$)/i.test(SCHNITT.bild.src);
  let dataUrl = c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9);
  if (png && dataUrl.length > 7_000_000) dataUrl = c.toDataURL('image/jpeg', 0.9);
  $('#cropOk').disabled = true;
  $('#cropInfo').textContent = 'Wird gespeichert …';
  try {
    const d = await api('/api/images', { method: 'POST', body: { dataUrl, name: 'zugeschnitten.' + (dataUrl.startsWith('data:image/png') ? 'png' : 'jpg') } });
    rahmen()?.postMessage({ typ: 'ez-setzen', feld: SCHNITT.feld, wert: d.url }, HERKUNFT);
    zustand.seiteDirty = true;
    setzeGeaendert(true);
    $('#cropSheet').classList.remove('open'); $('#cropBack').classList.remove('open');
    toast('Zugeschnitten – das Original bleibt in der Mediathek.');
  } catch (err) {
    $('#cropInfo').textContent = err.message;
  } finally {
    $('#cropOk').disabled = false;
  }
}
