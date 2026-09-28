/* ====== EZ Websitebuilder – Laufzeit =========================================
   Laeuft auf jeder Seite der Website und im Editor-Rahmen:
   - baut Kopf- und Fusszeile aus der Vorlage der Website (window.EZ_SITE)
   - legt die im Editor gespeicherten Inhalte ueber das HTML
   - bringt Bloecke, Galerien, Formulare, Menue, Design und Animationen
   - im Editor (?edit=1 im Rahmen): Auswaehlen, Tippen, Ziehen, Rechtsklick,
     Rueckgaengig - und meldet alles an den Editor (builder/client/editor.js)

   Die Website liefert vorher ihre Eigenheiten in window.EZ_SITE (siehe
   builder/README.md) - alles dort ist optional. Einbinden:
     <script src="/js/site.js"></script>           (EZ_SITE der Website)
     <script src="/builder/runtime.js"></script>    (diese Datei)      */
(function ezLaufzeit() {
if (window.__ezLaufzeit) return;
/* Uebergang: eine aeltere site.js bringt die Laufzeit noch selbst mit. */
if (typeof window.baueRahmen === 'function' && !window.EZ_SITE) return;
window.__ezLaufzeit = true;

const SITE = Object.assign({
  menue: [],                   // Standardmenue: [{ text, link, knopf }]
  kopf: null,                  // () => HTML der Kopfzeile (mit #burger und #navlinks)
  kopfKlasse: '',
  fuss: null,                  // () => HTML der Fusszeile
  fussKlasse: '',
  abschnitte: 'section, header, [data-ez-abschnitt], .ezblock[data-block]',
  hero: '[data-ez-hero]',      // grosse Startbilder
  heroEbene: '[data-ez-hero-bild]',
  designVariablen: {},         // Website-Design -> CSS-Variablen der Website
  farben: { weiss: '#ffffff', schwarz: '#111111', grau: '#6e6e73', akzent: '#0071e3' },
  beispielbilder: [],
  knopfKlasse: 'ez-knopf',
  knopfText: 'Mehr erfahren',
  standardLink: '/',
  beispielZitat: '„Ein Satz, der hängen bleibt.“',
  formularZiel: '/api/builder/formular'
}, window.EZ_SITE || {});
const DESIGN_VARIABLEN = Object.assign({
  titelschrift: '--ez-titelschrift', textschrift: '--ez-textschrift', titelfarbe: '--titelfarbe',
  textfarbe: '--ez-text', akzent: '--ez-akzent', knopfform: '--ez-radius', fussfarbe: '--fussfarbe',
  menufarbe: '--menufarbe', kopffarbe: '--kopffarbe', fussschrift: '--fussschrift'
}, SITE.designVariablen || {});
const KNOPF = SITE.knopfKlasse;
const PLATZHALTER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#e8e8ed"/><path d="M620 640l150-190 110 130 80-90 170 150z" fill="#c7c7cc"/><circle cx="1010" cy="400" r="46" fill="#c7c7cc"/></svg>');
const BILD = (i) => SITE.beispielbilder.length ? SITE.beispielbilder[i % SITE.beispielbilder.length] : PLATZHALTER;
/* Die Bildebenen der grossen Startbilder (fuer Parallax und Co.). */
const heroEbenen = () => [...document.querySelectorAll(SITE.hero)]
  .flatMap((h) => [...h.querySelectorAll(SITE.heroEbene)]);

/* ====== Kopfzeile, Menue, Fusszeile ======
   Kopf und Fuss muessen stehen, bevor die gespeicherten Inhalte darueber
   gelegt werden - deshalb eine benannte Funktion statt eines Ereignisses. */
let rahmenSteht = false;
/* Das Menue als Ganzes: eine Liste aus Eintraegen {text, link, knopf}.
   Der Editor bearbeitet die Liste, nicht einzelne Links. */
const MENUE_STANDARD = (SITE.menue || []).map((e) => ({ text: String(e.text || ''), link: String(e.link || '#'), knopf: e.knopf ? 1 : 0 }));
let menueDaten = MENUE_STANDARD.map((e) => ({ ...e }));
function menueBauen() {
  const host = document.getElementById('navlinks');
  if (!host) return;
  const here = location.pathname.replace(/\/$/, '') || '/';
  host.innerHTML = menueDaten.map((e) => {
    const h = String(e.link || '#');
    const base = h.split('#')[0].replace(/\/$/, '') || '/';
    const on = !h.includes('#') && (here === base || (base !== '/' && here.startsWith(base)));
    const cls = [e.knopf ? 'navcta' : '', on ? 'on' : ''].filter(Boolean).join(' ');
    return `<a href="${h.replace(/"/g, '')}"${cls ? ` class="${cls}"` : ''}>${String(e.text || '').replace(/[<>]/g, '')}</a>`;
  }).join('');
  /* Im Editor bleibt das Menue offen - dort steuert es das Bearbeitungsfenster. */
  host.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    if (!document.body.classList.contains('ez-edit')) navOffen(false);
  }));
}
/* Das Handy-Menue auf- und zuklappen. Es beginnt genau unter der Kopfzeile -
   egal wie hoch die gerade ist (Logo, Statusleiste, kompakte Einstellung). */
function navOffen(offen) {
  const nav = document.getElementById('siteNav');
  const b = document.getElementById('burger');
  if (!nav || !b) return;
  const auf = offen === undefined ? !document.body.classList.contains('navopen') : !!offen;
  if (auf) navUntenMessen();
  document.body.classList.toggle('navopen', auf);
  b.setAttribute('aria-expanded', String(auf));
}
function navUntenMessen() {
  const nav = document.getElementById('siteNav');
  if (!nav) return;
  document.documentElement.style.setProperty('--nav-unten', Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) + 'px');
}
function menueSetzen(roh) {
  let liste = null;
  try { liste = typeof roh === 'string' ? JSON.parse(roh || 'null') : roh; } catch { liste = null; }
  menueDaten = (Array.isArray(liste) && liste.length ? liste : MENUE_STANDARD).slice(0, 14).map((e) => ({
    text: String(e.text || '').slice(0, 40), link: String(e.link || '#').slice(0, 200), knopf: e.knopf ? 1 : 0
  })).filter((e) => e.text);
  menueBauen();
}

function baueRahmen() {
  if (rahmenSteht) return;
  rahmenSteht = true;
  const nav = document.getElementById('siteNav');
  if (nav) {
    if (typeof SITE.kopf === 'function') {
      if (SITE.kopfKlasse) nav.className = SITE.kopfKlasse;
      nav.innerHTML = SITE.kopf();
    }
    nav.setAttribute('data-ez-menue', 'global.menue');
    menueBauen();
    document.getElementById('burger')?.addEventListener('click', () => navOffen());
    /* Zu geht es auch mit Esc oder einem Tipp neben das Menue. */
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') navOffen(false); });
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('navopen') && !e.target.closest('#siteNav')) navOffen(false);
    });
    window.addEventListener('resize', () => { if (document.body.classList.contains('navopen')) navUntenMessen(); });
  }
  const foot = document.getElementById('siteFoot');
  if (foot) {
    if (typeof SITE.fuss === 'function') {
      if (SITE.fussKlasse) foot.className = SITE.fussKlasse;
      foot.setAttribute('data-ez-fuss', '1');
      foot.innerHTML = SITE.fuss();
    } else foot.setAttribute('data-ez-fuss', '1');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baueRahmen);
else baueRahmen();

/* ---------------- Startbilder (Hero) bewegen ----------------
   Website-Design -> Animationen -> Startbilder:
     parallax (Standard)  Bildebene laeuft beim Scrollen langsamer mit
     parallaxzoom         dazu ein leichtes Heranzoomen
     kenburns             langsames Zoomen und Wandern, endlos
     zoomin               beim Laden aus der Naehe zurueckzoomen
     einblenden           sanft aus dem Weiss auftauchen
     aus                  ruhig stehen
   Kein background-attachment:fixed - das ruckelt auf iOS. Im Editor bleibt
   alles ruhig; die Vorschau zeigt die Bewegung. */
const heroAnimation = (function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let layers = [];
  let ticking = false, aktiv = false;
  const staerke = (el) => Math.max(2, Math.min(22, Number(el.dataset.parallax) || 8));
  const art = () => document.documentElement.dataset.heroanim || (document.documentElement.dataset.parallax === 'aus' ? 'aus' : 'parallax');
  function apply() {
    ticking = false;
    const zoom = art() === 'parallaxzoom';
    for (const el of layers) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -80 || r.top > window.innerHeight + 80) continue;
      const t = Math.max(-1, Math.min(1, -r.top / (r.height || 1)));
      el.style.transform = `translate3d(0, ${(t * staerke(el)).toFixed(2)}%, 0)` + (zoom ? ` scale(${(1 + Math.max(0, t) * 0.08).toFixed(3)})` : '');
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }
  function starten() {
    layers = heroEbenen();
    const ruhig = document.body.classList.contains('ez-edit') || reduce.matches;
    const bewegt = !ruhig && (art() === 'parallax' || art() === 'parallaxzoom');
    layers.forEach((el) => {
      el.classList.add('ez-hero-ebene');
      el.style.setProperty('--px', staerke(el) + '%');
      el.classList.toggle('parallax', bewegt);
      if (!bewegt) el.style.transform = '';
    });
    if (bewegt && !aktiv) { window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll, { passive: true }); aktiv = true; }
    if (!bewegt && aktiv) { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); aktiv = false; }
    if (bewegt) apply();
  }
  reduce.addEventListener('change', starten);
  starten();
  return starten;
})();

/* ====== Inhalte aus dem Website-Editor ======================================
   Jede Seite traegt ihre Texte und Bilder im HTML. Was Emanuel im Editor
   geaendert hat, liegt in der Datenbank und wird hier darueber gelegt.
   Faellt der Abruf aus, steht schlicht der urspruengliche Text da.        */
(function inhalte() {
  /* Kopf und Fuss muessen stehen, bevor wir den Ausgangszustand festhalten. */
  baueRahmen();
  const SLUG = (location.pathname.replace(/\/$/, '') || '/index').replace(/^\//, '') || 'index';
  const suche = new URLSearchParams(location.search);
  const imRahmen = window.parent !== window;
  const editModus = suche.get('edit') === '1' && imRahmen;
  const vorschauModus = suche.get('vorschau') === '1' && imRahmen;
  /* Handy-Mockup: die Hoehe der Dynamic Island kommt als Wert herein und
     wirkt genauso wie die echte Statusleiste auf dem Geraet. */
  const island = Number(suche.get('island')) || 0;
  if (island > 0 && imRahmen) {
    document.documentElement.style.setProperty('--sicher-oben', island + 'px');
  }

  /* Verschieben und Groesse: als Feld "stil.<schluessel>" bzw. fuers Handy
     "stilm.<schluessel>" gespeichert, Format "dx,dy,skala". Angewendet als
     transform - so bleibt der Textfluss der Seite unberuehrt. */
  const istHandy = () => window.innerWidth <= 820;

  /* Auswählbare Schriften. Geladen wird nur, was eine Seite wirklich
     benutzt - sonst kostet jede Schrift Ladezeit beim Gast. */
  const SCHRIFTEN = {
    anton:      { name: 'Anton',            stapel: '"Anton", Impact, sans-serif', google: 'Anton' },
    raleway:    { name: 'Raleway',          stapel: '"Raleway", system-ui, sans-serif', google: 'Raleway:wght@200;300;400;500;600' },
    jost:       { name: 'Jost',             stapel: '"Jost", system-ui, sans-serif', google: 'Jost:wght@200;300;400;500;600' },
    montserrat: { name: 'Montserrat',       stapel: '"Montserrat", system-ui, sans-serif', google: 'Montserrat:wght@300;400;500;600' },
    mono:       { name: 'Schreibmaschine',  stapel: '"Nanum Gothic Coding", monospace', google: 'Nanum+Gothic+Coding:wght@400;700' },
    playfair:   { name: 'Playfair Display', stapel: '"Playfair Display", Georgia, serif', google: 'Playfair+Display:wght@400;500;600;700' },
    cormorant:  { name: 'Cormorant',        stapel: '"Cormorant Garamond", Georgia, serif', google: 'Cormorant+Garamond:wght@300;400;500;600' },
    lora:       { name: 'Lora',             stapel: '"Lora", Georgia, serif', google: 'Lora:wght@400;500;600' },
    dmserif:    { name: 'DM Serif',         stapel: '"DM Serif Display", Georgia, serif', google: 'DM+Serif+Display' },
    bebas:      { name: 'Bebas Neue',       stapel: '"Bebas Neue", Impact, sans-serif', google: 'Bebas+Neue' },
    oswald:     { name: 'Oswald',           stapel: '"Oswald", Impact, sans-serif', google: 'Oswald:wght@300;400;500;600' },
    inter:      { name: 'Inter',            stapel: '"Inter", system-ui, sans-serif', google: 'Inter:wght@300;400;500;600' },
    poppins:    { name: 'Poppins',          stapel: '"Poppins", system-ui, sans-serif', google: 'Poppins:wght@300;400;500;600' },
    lato:       { name: 'Lato',             stapel: '"Lato", system-ui, sans-serif', google: 'Lato:wght@300;400;700' },
    nunito:     { name: 'Nunito',           stapel: '"Nunito", system-ui, sans-serif', google: 'Nunito:wght@300;400;600;700' },
    worksans:   { name: 'Work Sans',        stapel: '"Work Sans", system-ui, sans-serif', google: 'Work+Sans:wght@300;400;500;600' },
    josefin:    { name: 'Josefin Sans',     stapel: '"Josefin Sans", system-ui, sans-serif', google: 'Josefin+Sans:wght@300;400;600' },
    quicksand:  { name: 'Quicksand',        stapel: '"Quicksand", system-ui, sans-serif', google: 'Quicksand:wght@400;500;600' },
    spacegrot:  { name: 'Space Grotesk',    stapel: '"Space Grotesk", system-ui, sans-serif', google: 'Space+Grotesk:wght@400;500;600' },
    merri:      { name: 'Merriweather',     stapel: '"Merriweather", Georgia, serif', google: 'Merriweather:wght@300;400;700' },
    libre:      { name: 'Libre Baskerville', stapel: '"Libre Baskerville", Georgia, serif', google: 'Libre+Baskerville:wght@400;700' },
    garamond:   { name: 'EB Garamond',      stapel: '"EB Garamond", Georgia, serif', google: 'EB+Garamond:wght@400;500;600' },
    robotoslab: { name: 'Roboto Slab',      stapel: '"Roboto Slab", Georgia, serif', google: 'Roboto+Slab:wght@300;400;500' },
    cinzel:     { name: 'Cinzel',           stapel: '"Cinzel", Georgia, serif', google: 'Cinzel:wght@400;500;600' },
    abril:      { name: 'Abril Fatface',    stapel: '"Abril Fatface", Georgia, serif', google: 'Abril+Fatface' },
    archivo:    { name: 'Archivo Black',    stapel: '"Archivo Black", Impact, sans-serif', google: 'Archivo+Black' },
    dancing:    { name: 'Dancing Script',   stapel: '"Dancing Script", cursive', google: 'Dancing+Script:wght@400;600' },
    pacifico:   { name: 'Pacifico',         stapel: '"Pacifico", cursive', google: 'Pacifico' },
    greatvibes: { name: 'Great Vibes',      stapel: '"Great Vibes", cursive', google: 'Great+Vibes' },
    caveat:     { name: 'Caveat',           stapel: '"Caveat", cursive', google: 'Caveat:wght@400;600' },
    satisfy:    { name: 'Satisfy',          stapel: '"Satisfy", cursive', google: 'Satisfy' }
  };
  const geladeneSchriften = new Set();

  function schriftLaden(id) {
    const f = SCHRIFTEN[id];
    if (!f || !f.google || geladeneSchriften.has(id)) return;
    geladeneSchriften.add(id);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
    document.head.appendChild(l);
  }
  const standard = {};      // Ausgangszustand aus der HTML-Datei
  const stilWerte = {};     // schluessel -> {dx,dy,skala}
  const schriftWerte = {};  // schluessel -> Schrift-Kennung
  const groesseWerte = {};  // schluessel -> Schriftgroesse in px
  const ausrichtWerte = {}; // schluessel -> left | center | right
  const verstecktWerte = new Set(); // Elemente, die auf der Website fehlen sollen
  const farbeWerte = {};    // schluessel -> Farbkennung
  /* Sprungmarken (Anker): je Abschnitt ein Name, ueber den man ihn per
     Link erreicht - /seite#name. Gespeichert als anker.<bezug>. */
  const ankerWerte = {};    // bezug eines Abschnitts -> { name, titel }
  const ankerName = (t) => String(t || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function ankerSetzen(feld, wert) {
    const bezug = feld.slice(6);
    let v = null;
    try { v = typeof wert === 'string' && wert.trim().startsWith('{') ? JSON.parse(wert) : (wert ? { name: wert } : null); } catch { v = null; }
    const name = v ? ankerName(v.name) : '';
    if (!name) delete ankerWerte[bezug];
    else ankerWerte[bezug] = { name, titel: String(v.titel || '').replace(/[<>]/g, '').slice(0, 60) || name };
  }
  /* Die Anker in die Seite setzen: ein leeres Element am Anfang des
     Abschnitts, das die Kopfzeile beim Anspringen mit einrechnet. */
  function ankerAnwenden() {
    document.querySelectorAll('.ez-anker').forEach((a) => a.remove());
    for (const ab of abschnitte()) {
      const a = ankerWerte[bezugVon(ab)];
      if (!a || ab.id === a.name) continue;
      const span = document.createElement('span');
      span.className = 'ez-anker'; span.id = a.name; span.dataset.titel = a.titel;
      ab.prepend(span);
    }
  }
  const navHoeheMessen = () => {
    const nav = document.getElementById('siteNav');
    if (nav) document.documentElement.style.setProperty('--nav-hoehe', Math.round(nav.getBoundingClientRect().height) + 'px');
  };
  window.addEventListener('resize', navHoeheMessen);
  /* Website-Design: gilt auf allen Seiten (liegt in der globalen Ablage).
     titelschrift / textschrift: Schriftkennung   titelfarbe / textfarbe / akzent: Hex
     knopfform: eckig | weich | rund */
  const designWerte = {};
  const DESIGN_VAR = DESIGN_VARIABLEN;
  /* Einstellungen ohne CSS-Variable: als Attribut am Dokument, das CSS
     (und das Skript fuer Animationen) reagieren darauf. */
  const DESIGN_ATTR = {
    kopf: ['fest', 'mitlaufend'],                       // Kopfzeile bleibt oben stehen?
    kopfeffekt: ['keiner', 'glas', 'schatten', 'transparent'],
    parallax: ['an', 'aus'],
    animation: ['keine', 'einblenden', 'hochschieben', 'zoom', 'links', 'rechts', 'weich'],
    heroanim: ['parallax', 'parallaxzoom', 'kenburns', 'zoomin', 'einblenden', 'aus'],
    bildanim: ['keine', 'einblenden', 'hochschieben', 'zoom', 'weich', 'enthuellen'],
    titelanim: ['keine', 'einblenden', 'hochschieben', 'woerter', 'weich'],
    knopfanim: ['keine', 'einblenden', 'hochschieben', 'zoom'],
    knopfhover: ['keiner', 'anheben', 'glanz', 'fuellen'],
    animtempo: ['schnell', 'normal', 'langsam'],
    menuausricht: ['rechts', 'mitte', 'links'],
    menugroesse: ['klein', 'normal', 'gross'],
    menugross: ['an', 'aus'],
    menuaktiv: ['unterstrich', 'keine', 'fett'],          // wie die aktuelle Seite im Menue markiert wird
    kopfhoehe: ['normal', 'kompakt', 'hoch'],
    logogroesse: ['normal', 'klein', 'gross'],
    kopflinie: ['an', 'aus'],
    burgerstil: ['hell', 'dunkel', 'akzent'],
    burgerausricht: ['links', 'mitte'],
    burgergroesse: ['normal', 'gross'],
    fusslayout: ['spalten', 'zwei', 'zentriert']
  };
  /* Alles auf einmal setzen - der Editor schickt seinen Stand nach einem
     Neuladen des Rahmens zurueck, damit nichts verloren geht. */
  function designAlleSetzen(werte, menue) {
    const w = werte || {};
    for (const k of [...Object.keys(DESIGN_VAR), ...Object.keys(DESIGN_ATTR)]) designSetzen('global.design.' + k, w[k] || '');
    if (Array.isArray(menue)) menueSetzen(menue);
  }
  function designSetzen(feld, wert) {
    const k = feld.slice('global.design.'.length);
    if (DESIGN_ATTR[k]) {
      if (!wert || !DESIGN_ATTR[k].includes(wert)) { delete designWerte[k]; delete document.documentElement.dataset[k]; }
      else { designWerte[k] = wert; document.documentElement.dataset[k] = wert; }
      if (/anim|tempo|parallax/.test(k)) { animationenStarten(); heroAnimation(); }
      return;
    }
    const v = DESIGN_VAR[k];
    if (!v) return;
    const root = document.documentElement.style;
    if (!wert) { delete designWerte[k]; root.removeProperty(v); if (k === 'fussschrift') root.removeProperty('--fussschrift-dezent'); return; }
    designWerte[k] = wert;
    if (k === 'titelschrift' || k === 'textschrift') {
      const f = SCHRIFTEN[wert]; if (!f) return;
      schriftLaden(wert); root.setProperty(v, f.stapel);
    } else if (k === 'knopfform') {
      root.setProperty(v, { eckig: '3px', weich: '10px', rund: '999px' }[wert] || '3px');
    } else if (/^#[0-9a-f]{6}$/i.test(wert)) {
      root.setProperty(v, wert);
      /* Dezente Schrift der Fusszeile: dieselbe Farbe, etwas durchscheinend. */
      if (k === 'fussschrift') root.setProperty('--fussschrift-dezent', wert + '99');
    }
  }
  const FARBEN = SITE.farben;
  function farbeSetzen(feld, wert) {
    const k = feld.slice(6);
    const hex = FARBEN[wert] || (/^#[0-9a-f]{6}$/i.test(wert || '') ? wert : '');
    if (!hex) { delete farbeWerte[k]; elementeZu(k).forEach((el) => { el.style.color = ''; }); return; }
    farbeWerte[k] = wert;
    elementeZu(k).forEach((el) => { el.style.color = hex; });
  }
  /* Bildausschnitt: welcher Teil eines Fotos sichtbar bleibt, wenn es
     beschnitten wird (oben / mitte / unten). */
  const ausschnittWerte = {};
  const AUSSCHNITTE = { 'oben-links': 'left top', oben: 'center top', 'oben-rechts': 'right top',
    links: 'left center', mitte: 'center center', rechts: 'right center',
    'unten-links': 'left bottom', unten: 'center bottom', 'unten-rechts': 'right bottom' };
  /* Einpassen: das Bild fuellt seinen Platz (und wird beschnitten) oder
     wird ganz gezeigt (mit Rand). */
  const einpassenWerte = {};
  function einpassenSetzen(feld, wert) {
    const k = feld.slice(10);
    const fit = { fuellen: 'cover', ganz: 'contain' }[wert] || '';
    if (fit) einpassenWerte[k] = wert; else delete einpassenWerte[k];
    elementeZu(k).forEach((el) => {
      if (el.hasAttribute('data-ez-bg')) {
        el.style.backgroundSize = fit; el.style.backgroundRepeat = fit ? 'no-repeat' : '';
        el.querySelectorAll(':scope > .ez-bgvideo').forEach((v) => { v.style.objectFit = fit; });
      } else el.style.objectFit = fit;
    });
  }
  function ausschnittSetzen(feld, wert) {
    const k = feld.slice(11);
    const pos = AUSSCHNITTE[wert];
    if (!pos) { delete ausschnittWerte[k]; elementeZu(k).forEach((el) => { el.style.objectPosition = ''; el.style.backgroundPosition = ''; }); return; }
    ausschnittWerte[k] = wert;
    elementeZu(k).forEach((el) => {
      if (el.hasAttribute('data-ez-bg')) el.style.backgroundPosition = pos; else el.style.objectPosition = pos;
    });
  }
  /* Format uebertragen: Schrift, Groesse, Farbe, Ausrichtung merken und
     auf ein anderes Textelement legen. */
  let formatAblage = null;
  function formatKopieren(k) {
    formatAblage = { schrift: schriftWerte[k], groesse: groesseWerte[k], ausricht: ausrichtWerte[k], farbe: farbeWerte[k] };
    melden({ typ: 'ez-hinweis', text: 'Format kopiert – jetzt ein anderes Element anklicken und „Format einfügen“ wählen.' });
  }
  function formatEinfuegen(k) {
    if (!formatAblage) return melden({ typ: 'ez-hinweis', text: 'Noch kein Format kopiert.' });
    const f = formatAblage;
    zuruecksetzen(k, 'schrift');
    if (f.schrift) schriftSetzen('schrift.' + k, f.schrift);
    if (f.groesse) groesseSetzen((istHandy() ? 'groessem.' : 'groesse.') + k, f.groesse);
    ausrichtSetzen('ausricht.' + k, f.ausricht || 'left');
    if (!f.ausricht) { delete ausrichtWerte[k]; elementeZu(k).forEach((el) => { el.style.textAlign = ''; }); }
    farbeSetzen('farbe.' + k, f.farbe || '');
    rahmenSetzen();
    melden({ typ: 'ez-geaendert' });
  }
  const elementeZu = (schluessel) => document.querySelectorAll(
    `[data-ez="${CSS.escape(schluessel)}"], [data-ez-img="${CSS.escape(schluessel)}"],` +
    `[data-ez-bg="${CSS.escape(schluessel)}"]`);

  /* Format "dx,dy,skala,breite,hoehe". Die hinteren beiden sind neu und
     duerfen fehlen - aeltere Eintraege bleiben so gueltig. */
  function stilSetzen(feld, wert) {
    const fuerHandy = feld.startsWith('stilm.');
    if (fuerHandy !== istHandy()) return;
    const schluessel = feld.slice(fuerHandy ? 6 : 5);
    const [dx = 0, dy = 0, skala = 1, breite = 0, hoehe = 0] =
      String(wert).split(',').map((n) => Number(n) || 0);
    stilWerte[schluessel] = { dx, dy, skala: skala || 1, breite, hoehe };
    elementeZu(schluessel).forEach((el) => {
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${skala || 1})`;
      el.style.transformOrigin = 'center center';
      if (breite) el.style.width = breite + 'px';
      if (hoehe) { el.style.height = hoehe + 'px'; if (el.tagName === 'IMG') el.style.objectFit = 'cover'; }
    });
  }

  /* Ausrichtung des Textes im Element. */
  function ausrichtSetzen(feld, wert) {
    const schluessel = feld.slice(9);
    if (!['left', 'center', 'right'].includes(wert)) return;
    ausrichtWerte[schluessel] = wert;
    elementeZu(schluessel).forEach((el) => { el.style.textAlign = wert; });
  }

  function schriftSetzen(feld, wert) {
    const schluessel = feld.slice(8);
    const f = SCHRIFTEN[wert];
    if (!f) return;
    schriftLaden(wert);
    schriftWerte[schluessel] = wert;
    elementeZu(schluessel).forEach((el) => { el.style.fontFamily = f.stapel; });
  }

  /* Schriftgroesse wird als fester Wert gespeichert - getrennt fuer gross
     und Handy, damit eine Anpassung am Telefon die Website nicht umwirft. */
  function groesseSetzen(feld, wert) {
    const fuerHandy = feld.startsWith('groessem.');
    if (fuerHandy !== istHandy()) return;
    const schluessel = feld.slice(fuerHandy ? 9 : 8);
    const px = Math.max(8, Math.min(200, Number(wert) || 0));
    if (!px) return;
    groesseWerte[schluessel] = px;
    elementeZu(schluessel).forEach((el) => { el.style.fontSize = px + 'px'; });
  }

  const setzen = (feld, wert) => {
    if (feld.startsWith('groesse.') || feld.startsWith('groessem.')) return groesseSetzen(feld, wert);
    /* Die "m"-Formen gelten nur am Telefon. */
    if (feld.startsWith('schriftm.')) {
      return istHandy() ? schriftSetzen('schrift.' + feld.slice(9), wert) : undefined;
    }
    if (feld.startsWith('ausrichtm.')) {
      return istHandy() ? ausrichtSetzen('ausricht.' + feld.slice(10), wert) : undefined;
    }
    if (feld.startsWith('schrift.')) return schriftSetzen(feld, wert);
    if (feld.startsWith('farbe.')) return farbeSetzen(feld, wert);
    if (feld.startsWith('ausschnitt.')) return ausschnittSetzen(feld, wert);
    if (feld.startsWith('einpassen.')) return einpassenSetzen(feld, wert);
    if (feld.startsWith('anim.')) return animSetzen(feld, wert);
    if (feld.startsWith('anker.')) return ankerSetzen(feld, wert);
    if (feld.startsWith('global.design.')) return designSetzen(feld, wert);
    if (feld === 'global.menue') return menueSetzen(wert);
    if (feld.startsWith('stil.') || feld.startsWith('stilm.')) return stilSetzen(feld, wert);
    if (feld.startsWith('ausricht.')) return ausrichtSetzen(feld, wert);
    if (feld === 'bloecke') return bloeckeSetzen(wert);
    const gal = /^block\.([a-z0-9]+)\.opt$/i.exec(feld);
    if (gal) {
      galerieOptSetzen(gal[1], wert);
      if (document.querySelector(`.ezblock[data-block="${CSS.escape(gal[1])}"]`)) galerieNeuBauen(gal[1]);
      return;
    }
    if (feld.startsWith('versteckt.')) {
      const k = feld.slice(10);
      if (wert === '1') verstecktWerte.add(k); else verstecktWerte.delete(k);
      elementeZu(k).forEach((el) => el.classList.toggle('ez-versteckt', wert === '1'));
      return;
    }
    if (feld.startsWith('link.')) {
      const treffer = document.querySelectorAll(`[data-ez-link="${CSS.escape(feld)}"]`);
      if (treffer.length) { treffer.forEach((el) => el.setAttribute('href', wert || '#')); return; }
      /* Fester Knopf der Seite: link.<schluessel> gehoert zum <a data-ez="schluessel"> */
      document.querySelectorAll(`a[data-ez="${CSS.escape(feld.slice(5))}"]`).forEach((el) => {
        el.setAttribute('href', wert || '#');
      });
      return;
    }
    document.querySelectorAll(`[data-ez="${CSS.escape(feld)}"]`).forEach((el) => {
      el.innerHTML = wert;
    });
    document.querySelectorAll(`[data-ez-img="${CSS.escape(feld)}"]`).forEach((el) => {
      bildOderVideo(el, wert);
    });
    document.querySelectorAll(`[data-ez-bg="${CSS.escape(feld)}"]`).forEach((el) => {
      hintergrundSetzen(el, wert);
    });
  };

  /* ---- Video statt Foto ----
     Ein Bildfeld nimmt auch ein Video an. Je nach Quelle steht dann ein
     <img> oder ein <video> im Dokument - mit denselben Klassen und Kennungen,
     damit Lage, Groesse und Bearbeitung unveraendert greifen. */
  const istVideo = (url) => /^\/video\/db\//.test(url || '') || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || '');

  function bildOderVideo(el, wert) {
    const willVideo = istVideo(wert);
    const istBereits = el.tagName === 'VIDEO';
    if (willVideo === istBereits) {
      if (el.getAttribute('src') !== wert) el.setAttribute('src', wert);
      if (!willVideo) {
        const a = el.closest('a');
        if (a && /\.(jpe?g|png|webp)$/i.test(a.getAttribute('href') || '')) a.href = wert;
      }
      return el;
    }
    const neu = document.createElement(willVideo ? 'video' : 'img');
    for (const at of el.attributes) {
      if (at.name === 'src' || at.name === 'alt' || at.name === 'loading') continue;
      neu.setAttribute(at.name, at.value);
    }
    if (willVideo) {
      neu.muted = true; neu.loop = true; neu.autoplay = true; neu.playsInline = true;
      neu.setAttribute('muted', ''); neu.setAttribute('loop', '');
      neu.setAttribute('autoplay', ''); neu.setAttribute('playsinline', '');
      neu.setAttribute('preload', 'metadata');
      neu.setAttribute('aria-label', el.getAttribute('alt') || '');
    } else {
      neu.setAttribute('alt', el.getAttribute('aria-label') || '');
    }
    neu.setAttribute('src', wert);
    el.replaceWith(neu);
    if (typeof elementEinrichten === 'function' && document.body.classList.contains('ez-edit')) {
      elementEinrichten(neu);
    }
    if (willVideo) neu.play?.().catch(() => {});
    return neu;
  }

  /* Hintergrund: Foto als background-image, Video als eigene Ebene darin. */
  function hintergrundSetzen(el, wert) {
    let vid = el.querySelector(':scope > video.ez-bgvideo');
    if (istVideo(wert)) {
      el.style.backgroundImage = '';
      if (!vid) {
        vid = document.createElement('video');
        vid.className = 'ez-bgvideo';
        vid.muted = true; vid.loop = true; vid.autoplay = true; vid.playsInline = true;
        vid.setAttribute('muted', ''); vid.setAttribute('loop', '');
        vid.setAttribute('autoplay', ''); vid.setAttribute('playsinline', '');
        vid.setAttribute('preload', 'metadata');
        el.prepend(vid);
      }
      if (vid.getAttribute('src') !== wert) vid.setAttribute('src', wert);
      vid.play?.().catch(() => {});
      el.dataset.ezVideo = wert;
    } else {
      if (vid) vid.remove();
      delete el.dataset.ezVideo;
      el.style.backgroundImage = `url('${String(wert).replace(/'/g, "%27")}')`;
    }
  }

  /* Der Wert eines Hintergrunds - Foto oder Video. */
  const hintergrundWert = (el) => el.dataset.ezVideo
    || (el.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/) || [, ''])[1];

  /* ---- Animationen beim Scrollen ----
     Global (Website-Design) oder je Abschnitt (data-anim). Ein Beobachter
     setzt "ist-sichtbar", sobald ein Teil ins Bild kommt; das CSS macht
     daraus Einblenden, Hochschieben oder Zoom. Im Editor bleibt alles
     ruhig, damit nichts beim Bearbeiten wegspringt. */
  /* Was sich wie bewegt - Website-Design gibt je Art eine Animation vor,
     jedes Element kann sie mit "anim.<schluessel>" ueberschreiben, ein Block
     mit seiner Einstellung "anim". */
  const animWerte = {};       // schluessel -> Animation
  const ANIM_WAHL = ['keine', 'einblenden', 'hochschieben', 'zoom', 'links', 'rechts', 'weich', 'enthuellen', 'woerter'];
  function animSetzen(feld, wert) {
    const k = feld.slice(5);
    if (ANIM_WAHL.includes(wert)) animWerte[k] = wert; else delete animWerte[k];
    if (!document.body.classList.contains('ez-edit')) animationenStarten();
  }
  const KNOPF_SEL = SITE.knopfSelektor || '.btn, .ez-knopf, .navcta, button[type="submit"]';
  const imRand = (el) => !!el.closest('#siteNav, #siteFoot');
  function woerterTeilen(el) {
    if (el.dataset.ezWoerter) return;
    el.dataset.ezWoerter = '1';
    const gehen = (knoten) => {
      for (const n of [...knoten.childNodes]) {
        if (n.nodeType === 3 && n.textContent.trim()) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(w));
            else { const sp = document.createElement('span'); sp.className = 'ez-wort'; sp.textContent = w; frag.appendChild(sp); }
          });
          knoten.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') gehen(n);
      }
    };
    gehen(el);
    el.querySelectorAll('.ez-wort').forEach((w, i) => w.style.setProperty('--ez-wort', i));
  }
  let animBeobachter = null;
  function animationenStarten() {
    if (document.body.classList.contains('ez-edit')) return;
    const d = document.documentElement.dataset;
    document.documentElement.style.setProperty('--ez-anim-dauer', { schnell: '.55s', langsam: '1.45s' }[d.animtempo] || '.95s');
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!animBeobachter) {
      animBeobachter = new IntersectionObserver((eintraege) => {
        /* Was gleichzeitig ins Bild kommt, erscheint kurz nacheinander. */
        eintraege.filter((e) => e.isIntersecting).forEach((e, i) => {
          e.target.style.setProperty('--ez-anim-verz', Math.min(i, 6) * 90 + 'ms');
          e.target.classList.add('ist-sichtbar');
          animBeobachter.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    }
    const setzeAnim = (el, a) => {
      if (!a || a === 'keine' || a === 'erben') { if (el.dataset.ezAnim && !el.classList.contains('ist-sichtbar')) delete el.dataset.ezAnim; return; }
      if (el.dataset.ezAnim === a) return;
      el.dataset.ezAnim = a;
      if (a === 'woerter') woerterTeilen(el);
      animBeobachter.observe(el);
    };
    const eigen = (el) => animWerte[el.getAttribute('data-ez') || el.getAttribute('data-ez-img') || el.getAttribute('data-ez-bg') || ''];
    /* Abschnitte (ohne Startbild, Kopf- und Fusszeile) */
    document.querySelectorAll(ABSCHNITT).forEach((el) => {
      if (imRand(el) || el.matches(SITE.hero)) return;
      const blockAnim = el.classList.contains('ezblock') ? el.dataset.anim : '';
      setzeAnim(el, blockAnim && blockAnim !== 'erben' ? blockAnim : d.animation);
    });
    /* Bilder */
    document.querySelectorAll('[data-ez-img], .ezblock-galerie img, .ezblock-galerie video').forEach((el) => {
      if (imRand(el) || el.closest(SITE.hero) || el.closest('.ez-slider')) return;
      setzeAnim(el, eigen(el) || d.bildanim);
    });
    /* Ueberschriften */
    document.querySelectorAll('h1[data-ez], h2[data-ez], h3[data-ez], h1, h2').forEach((el) => {
      if (imRand(el)) return;
      setzeAnim(el, eigen(el) || d.titelanim);
    });
    /* Buttons */
    document.querySelectorAll(KNOPF_SEL).forEach((el) => {
      if (imRand(el)) return;
      el.setAttribute('data-ez-knopf', '');
      setzeAnim(el, eigen(el) || d.knopfanim);
    });
    /* Einzelne Elemente mit eigener Animation */
    for (const [k, a] of Object.entries(animWerte)) document.querySelectorAll(`[data-ez="${CSS.escape(k)}"], [data-ez-img="${CSS.escape(k)}"], [data-ez-bg="${CSS.escape(k)}"]`).forEach((el) => setzeAnim(el, a));
  }
  /* Buttons sind auch ohne Einblenden fuer den Hover-Effekt markiert. */
  document.querySelectorAll(KNOPF_SEL).forEach((el) => { if (!imRand(el)) el.setAttribute('data-ez-knopf', ''); });

  /* ---- Hinzugefuegte Bloecke ----
     Bild, Video, Galerie, Text, Ueberschrift, Knopf. Die Liste steht als
     JSON im Feld "bloecke"; die Inhalte der Bloecke sind normale Felder
     (block.<id>.text, block.<id>.bild ...), damit Tippen, Bildtausch,
     Verschieben und Schriften genauso funktionieren wie ueberall. */
  let bloecke = [];
  const BLOCK_VORLAGEN = {
    bild: (id) => `<figure class="ezblock ezblock-bild">
      <img data-ez-img="block.${id}.bild" src="${BILD(4)}" alt="">
      <figcaption data-ez="block.${id}.text" class="ez-unterschrift">Bildunterschrift</figcaption></figure>`,
    video: (id) => `<figure class="ezblock ezblock-video">
      <img data-ez-img="block.${id}.bild" src="${BILD(4)}" alt="">
      <figcaption data-ez="block.${id}.text" class="ez-unterschrift">Bildunterschrift</figcaption></figure>`,
    trenner: (id) => `<div class="ezblock ezblock-trenner"><hr></div>`,
    zitat: (id) => `<div class="ezblock ezblock-zitat">
      <blockquote data-ez="block.${id}.text">${SITE.beispielZitat}</blockquote>
      <p class="ez-zitat-von" data-ez="block.${id}.von">— Ein Gast</p></div>`,
    spalten: (id) => `<div class="ezblock ezblock-spalten">
      <div class="ez-spalte-text">
        <h2 data-ez="block.${id}.titel">Überschrift</h2>
        <p data-ez="block.${id}.text">Hier steht ein Text neben dem Bild – klicken und schreiben.</p>
        <a data-ez="block.${id}.knopf" data-ez-link="link.block.${id}" class="${KNOPF}" href="${SITE.standardLink}">Mehr erfahren</a>
      </div>
      <img data-ez-img="block.${id}.bild" class="ez-spalte-bild" src="${BILD(6)}" alt=""></div>`,
    formular: (id) => formularHtml(id),
    einbettung: (id) => `<div class="ezblock ezblock-einbettung">
      <div class="ez-einbettung"><p class="ez-einbettung-leer">Video einbetten: rechts in der Leiste die YouTube- oder Vimeo-Adresse eintragen.</p></div></div>`,
    galerie: (id) => galerieHtml(id),
    text: (id) => `<div class="ezblock ezblock-text">
      <p data-ez="block.${id}.text">Neuer Text – hier klicken und schreiben.</p></div>`,
    ueberschrift: (id) => `<div class="ezblock ezblock-h">
      <h2 data-ez="block.${id}.text">Neue Überschrift</h2></div>`,
    button: (id) => `<div class="ezblock ezblock-btn">
      <a data-ez="block.${id}.text" data-ez-link="link.block.${id}" class="${KNOPF}" href="${SITE.standardLink}">${SITE.knopfText}</a></div>`
  };

  /* ---- Galerien ----
     Ein Galerie-Block hat Einstellungen im Feld block.<id>.opt (JSON):
     typ      raster2 | raster3 | raster4 | mosaik | slider | slidervoll
     n        Anzahl der Bilder (2-10)
     dauer    Sekunden je Bild beim Slider
     effekt   fade | slide
     Die Bilder selbst sind normale Felder block.<id>.g1 ... gN. */
  const BEISPIELE = SITE.beispielbilder.length ? SITE.beispielbilder : [BILD(0)];
  /* Einstellungen je Block (Feld block.<id>.opt als JSON). Allgemein:
       hg       keine | hell | dunkel | akzent      Hintergrund des Blocks
       abstand  klein | normal | gross              Luft oben und unten
       breite   schmal | normal | voll              Inhaltsbreite
     Galerie:   typ, n, dauer, effekt
     Bild:      rundung keine|weich|rund, hoehe auto|klein|mittel|gross, unterschrift 0|1
     Button:    stil dunkel|hell|umriss, groesse normal|gross, lage links|mitte|rechts
     Trenner:   art abstand|linie, hoehe klein|normal|gross
     Spalten:   bildseite rechts|links
     Einbettung: url (YouTube/Vimeo) */
  const OPT_STANDARD = {
    hg: 'keine', abstand: 'normal', breite: 'normal',
    typ: 'raster3', n: 3, dauer: 4, effekt: 'fade',
    rundung: 'weich', hoehe: 'auto', unterschrift: 0,
    stil: 'dunkel', groesse: 'normal', lage: 'mitte',
    art: 'abstand', bildseite: 'rechts', url: '', anim: 'erben'
  };
  const OPT_WAHL = {
    hg: ['keine', 'hell', 'dunkel', 'akzent'], abstand: ['klein', 'normal', 'gross'],
    breite: ['schmal', 'normal', 'voll'],
    typ: ['raster2', 'raster3', 'raster4', 'mosaik', 'slider', 'slidervoll'], effekt: ['fade', 'slide'],
    rundung: ['keine', 'weich', 'rund'], hoehe: ['auto', 'klein', 'mittel', 'gross'],
    stil: ['dunkel', 'hell', 'umriss'], groesse: ['normal', 'gross'], lage: ['links', 'mitte', 'rechts'],
    art: ['abstand', 'linie'], bildseite: ['rechts', 'links'],
    anim: ['erben', 'keine', 'einblenden', 'hochschieben', 'zoom', 'links', 'rechts', 'weich']
  };
  const GALERIE_TYPEN = OPT_WAHL.typ;
  const blockOpts = {};   // id -> Einstellungen (nur Abweichungen)

  function galerieOpt(id) { return { ...OPT_STANDARD, ...(blockOpts[id] || {}) }; }
  const blockOpt = galerieOpt;
  function galerieOptSetzen(id, roh) {
    let o = {};
    try { o = typeof roh === 'string' ? JSON.parse(roh || '{}') : (roh || {}); } catch { o = {}; }
    const opt = {};
    for (const [k, werte] of Object.entries(OPT_WAHL)) {
      if (o[k] !== undefined && werte.includes(String(o[k])) && String(o[k]) !== String(OPT_STANDARD[k])) opt[k] = String(o[k]);
    }
    const n = Math.max(2, Math.min(10, Math.round(Number(o.n) || OPT_STANDARD.n)));
    if (n !== OPT_STANDARD.n) opt.n = n;
    const dauer = Math.max(1, Math.min(30, Number(o.dauer) || OPT_STANDARD.dauer));
    if (dauer !== OPT_STANDARD.dauer) opt.dauer = dauer;
    if (o.unterschrift === 1 || o.unterschrift === '1' || o.unterschrift === true) opt.unterschrift = 1;
    const url = String(o.url || '').trim().slice(0, 300);
    if (url) opt.url = url;
    if (Array.isArray(o.felder)) {
      opt.felder = o.felder.slice(0, 20).map((f) => ({
        typ: FORM_TYPEN.includes(f?.typ) ? f.typ : 'text',
        label: String(f?.label || '').slice(0, 80),
        pflicht: f?.pflicht ? 1 : 0,
        optionen: String(f?.optionen || '').slice(0, 300)
      })).filter((f) => f.label);
    }
    blockOpts[id] = opt;
    return { ...OPT_STANDARD, ...opt };
  }
  const blockOptSetzen = galerieOptSetzen;
  const galerieOptJson = (id) => {
    const o = blockOpts[id] || {};
    return Object.keys(o).length ? JSON.stringify(o) : '';
  };

  /* Die allgemeinen Einstellungen als Attribute auf den Block legen -
     das CSS erledigt den Rest. */
  function blockAttribute(el, id) {
    const o = blockOpt(id);
    el.dataset.hg = o.hg; el.dataset.abstand = o.abstand; el.dataset.breite = o.breite;
    if (o.anim && o.anim !== 'erben') el.dataset.anim = o.anim; else delete el.dataset.anim;
    const art = el.dataset.blockArt;
    if (art === 'bild' || art === 'video') { el.dataset.rundung = o.rundung; el.dataset.hoehe = o.hoehe; el.dataset.unterschrift = o.unterschrift ? '1' : '0'; }
    if (art === 'button') { el.dataset.stil = o.stil; el.dataset.groesse = o.groesse; el.dataset.lage = o.lage; }
    if (art === 'trenner') { el.dataset.art = o.art; el.dataset.hoehe = o.hoehe; }
    if (art === 'spalten') el.dataset.bildseite = o.bildseite;
    if (art === 'galerie') { el.dataset.typ = o.typ; el.dataset.dauer = o.dauer; el.dataset.effekt = o.effekt; }
  }

  /* ---- Formular ----
     Felder stehen in den Einstellungen (opt.felder als Liste):
       { typ: text|email|tel|textarea|select|checkbox|date, label, pflicht: 0|1, optionen: 'a, b, c' }
     Titel und Knopftext sind normale Textfelder des Blocks. Abgeschickt
     wird an dieselbe Adresse wie das Kontaktformular. */
  const FORM_STANDARD = [
    { typ: 'text', label: 'Name', pflicht: 1 },
    { typ: 'email', label: 'E-Mail-Adresse', pflicht: 1 },
    { typ: 'textarea', label: 'Nachricht', pflicht: 1 }
  ];
  const FORM_TYPEN = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox', 'date'];
  function formFelder(id) {
    const o = blockOpts[id] || {};
    const liste = Array.isArray(o.felder) ? o.felder : FORM_STANDARD;
    return liste.map((f) => ({
      typ: FORM_TYPEN.includes(f.typ) ? f.typ : 'text',
      label: String(f.label || '').slice(0, 80) || 'Feld',
      pflicht: f.pflicht ? 1 : 0,
      optionen: String(f.optionen || '').slice(0, 300)
    })).slice(0, 20);
  }
  const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function formularHtml(id) {
    const felder = formFelder(id);
    const feldHtml = felder.map((f, i) => {
      const n = `f${i}`;
      const pf = f.pflicht ? ' required' : '';
      const stern = f.pflicht ? ' <i>*</i>' : '';
      if (f.typ === 'textarea') return `<label class="ez-f ez-f-breit"><span>${escHtml(f.label)}${stern}</span><textarea name="${n}" rows="4"${pf}></textarea></label>`;
      if (f.typ === 'select') {
        const opts = f.optionen.split(',').map((x) => x.trim()).filter(Boolean);
        return `<label class="ez-f"><span>${escHtml(f.label)}${stern}</span><select name="${n}"${pf}><option value="">Bitte wählen …</option>${opts.map((x) => `<option>${escHtml(x)}</option>`).join('')}</select></label>`;
      }
      if (f.typ === 'checkbox') return `<label class="ez-f ez-f-breit ez-f-haken"><input type="checkbox" name="${n}"${pf}> <span>${escHtml(f.label)}${stern}</span></label>`;
      return `<label class="ez-f"><span>${escHtml(f.label)}${stern}</span><input type="${f.typ}" name="${n}"${pf}></label>`;
    }).join('');
    return `<div class="ezblock ezblock-formular">
      <h2 data-ez="block.${id}.titel">Schreib uns</h2>
      <p data-ez="block.${id}.text">Wir melden uns so schnell wie möglich.</p>
      <form class="ez-form" novalidate>
        <div class="ez-form-felder">${feldHtml}</div>
        <input type="text" name="hp" class="ez-hp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="ez-form-fuss">
          <button type="submit" class="${KNOPF}" data-ez="block.${id}.knopf">Absenden</button>
          <span class="ez-form-stand" aria-live="polite"></span>
        </div>
      </form>
      <p class="ez-form-danke" data-ez="block.${id}.danke" hidden>Danke – deine Nachricht ist angekommen.</p>
    </div>`;
  }
  /* Absenden auf der Website. */
  function formularAnbinden(block) {
    const form = block.querySelector('form.ez-form');
    if (!form || form.dataset.aktiv) return;
    form.dataset.aktiv = '1';
    const id = block.dataset.block;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const stand = form.querySelector('.ez-form-stand');
      const felder = formFelder(id);
      const werte = [];
      let fehlt = null;
      felder.forEach((f, i) => {
        const el = form.elements[`f${i}`];
        if (!el) return;
        const wert = f.typ === 'checkbox' ? (el.checked ? 'Ja' : '') : String(el.value || '').trim();
        if (f.pflicht && !wert) fehlt = fehlt || f.label;
        if (f.typ === 'email' && wert && !/.+@.+\..+/.test(wert)) fehlt = fehlt || f.label;
        werte.push({ label: f.label, wert, typ: f.typ });
      });
      if (fehlt) { stand.textContent = `Bitte „${fehlt}“ ausfüllen.`; stand.className = 'ez-form-stand ist-fehler'; return; }
      stand.textContent = 'Wird gesendet …'; stand.className = 'ez-form-stand';
      const email = (werte.find((w) => w.typ === 'email') || {}).wert || '';
      const name = (werte.find((w) => /name/i.test(w.label)) || werte.find((w) => w.typ === 'text') || {}).wert || '';
      try {
        const r = await fetch(SITE.formularZiel, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, email, hp: form.elements.hp?.value || '',
            subject: (block.querySelector('[data-ez$=".titel"]')?.textContent || 'Formular').trim(),
            felder: werte.map(({ label, wert }) => ({ label, wert }))
          })
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Das hat nicht geklappt.');
        form.hidden = true;
        const danke = block.querySelector('.ez-form-danke');
        if (danke) danke.hidden = false;
      } catch (err) {
        stand.textContent = err.message; stand.className = 'ez-form-stand ist-fehler';
      }
    });
  }

  /* YouTube/Vimeo-Adresse in eine Einbettungsadresse verwandeln. */
  function einbettungUrl(url) {
    const u = String(url || '').trim();
    let m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/.exec(u);
    if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1`;
    m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
    if (m) return `https://player.vimeo.com/video/${m[1]}?dnt=1`;
    return '';
  }

  function galerieHtml(id) {
    const o = galerieOpt(id);
    const bilder = Array.from({ length: o.n }, (_, i) =>
      `<img data-ez-img="block.${id}.g${i + 1}" src="${BEISPIELE[i % BEISPIELE.length]}" alt="">`);
    const slider = o.typ === 'slider' || o.typ === 'slidervoll';
    return `<div class="ezblock ezblock-galerie" data-typ="${o.typ}" data-dauer="${o.dauer}" data-effekt="${o.effekt}">`
      + (slider ? `<div class="ez-slider"><div class="ez-slides">${bilder.join('')}</div></div>` : bilder.join(''))
      + '</div>';
  }

  /* Galerie neu aufbauen (nach geaenderten Einstellungen), Bilder behalten. */
  function galerieNeuBauen(id) {
    const alt = document.querySelector(`.ezblock[data-block="${CSS.escape(id)}"]`);
    if (!alt) return;
    const art = alt.dataset.blockArt;
    /* Galerien und Formulare werden neu gebaut (andere Bildanzahl, andere
       Felder). Bei allen anderen reichen die Attribute. */
    if (art !== 'galerie' && art !== 'formular') {
      blockAttribute(alt, id);
      if (art === 'einbettung') einbettungFuellen(alt, id);
      return;
    }
    const bisher = {};
    alt.querySelectorAll('[data-ez-img]').forEach((img) => { bisher[img.getAttribute('data-ez-img')] = img.getAttribute('src'); });
    alt.querySelectorAll('[data-ez]').forEach((t) => { bisher[t.getAttribute('data-ez')] = t.innerHTML; });
    const huelle = document.createElement('div');
    huelle.innerHTML = art === 'galerie' ? galerieHtml(id) : formularHtml(id);
    const neu = huelle.firstElementChild;
    neu.dataset.block = id; neu.dataset.blockArt = art;
    blockAttribute(neu, id);
    alt.replaceWith(neu);
    neu.querySelectorAll('[data-ez-img]').forEach((img) => {
      const k = img.getAttribute('data-ez-img');
      if (standard[k] === undefined) standard[k] = img.getAttribute('src');
      if (bisher[k]) bildOderVideo(img, bisher[k]);
      stilAnwenden(k);
    });
    neu.querySelectorAll('[data-ez]').forEach((t) => {
      const k = t.getAttribute('data-ez');
      if (standard[k] === undefined) standard[k] = t.innerHTML.trim();
      if (bisher[k] !== undefined) t.innerHTML = bisher[k];
      stilAnwenden(k);
    });
    if (document.body.classList.contains('ez-edit')) {
      neu.querySelectorAll('[data-ez-img], [data-ez]').forEach(elementEinrichten);
      plusLeisten();
    } else {
      sliderStarten(neu);
      formularAnbinden(neu);
    }
  }

  function einbettungFuellen(el, id) {
    const host = el.querySelector('.ez-einbettung');
    if (!host) return;
    const src = einbettungUrl(blockOpt(id).url);
    if (!src) {
      host.innerHTML = '<p class="ez-einbettung-leer">Video einbetten: links in der Leiste die YouTube- oder Vimeo-Adresse eintragen.</p>';
      return;
    }
    if (host.querySelector('iframe')?.getAttribute('src') === src) return;
    host.innerHTML = `<iframe src="${src}" title="Video" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }

  /* Der Slider auf der Website: blendet oder schiebt die Bilder im Takt. */
  function sliderStarten(block) {
    const bahn = block.querySelector('.ez-slides');
    if (!bahn || block.dataset.sliderLaeuft) return;
    const bilder = [...bahn.children];
    if (bilder.length < 2) return;
    block.dataset.sliderLaeuft = '1';
    const effekt = block.dataset.effekt === 'slide' ? 'slide' : 'fade';
    const dauer = Math.max(1, Number(block.dataset.dauer) || 4) * 1000;
    const slider = block.querySelector('.ez-slider');
    slider.classList.add('ez-' + effekt);
    let i = 0;
    const punkte = document.createElement('div');
    punkte.className = 'ez-punkte';
    punkte.innerHTML = bilder.map((_, n) => `<button type="button" aria-label="Bild ${n + 1}"></button>`).join('');
    slider.appendChild(punkte);
    const pfeil = (richtung) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ez-pfeil ez-pfeil-' + (richtung < 0 ? 'l' : 'r');
      b.setAttribute('aria-label', richtung < 0 ? 'Vorheriges Bild' : 'Nächstes Bild');
      b.innerHTML = richtung < 0 ? '&#8249;' : '&#8250;';
      b.addEventListener('click', () => { zeige(i + richtung); neuStarten(); });
      slider.appendChild(b);
    };
    pfeil(-1); pfeil(1);
    const zeige = (n) => {
      i = (n + bilder.length) % bilder.length;
      if (effekt === 'fade') bilder.forEach((b, k) => b.classList.toggle('ist-aktiv', k === i));
      else bahn.style.transform = `translateX(-${i * 100}%)`;
      punkte.querySelectorAll('button').forEach((b, k) => b.classList.toggle('ist-aktiv', k === i));
    };
    punkte.querySelectorAll('button').forEach((b, k) => b.addEventListener('click', () => { zeige(k); neuStarten(); }));
    let takt = null;
    const neuStarten = () => { clearInterval(takt); takt = setInterval(() => zeige(i + 1), dauer); };
    zeige(0); neuStarten();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) clearInterval(takt);
  }

  /* Ein Abschnitt ist ein oberster Baustein der Seite: Kopfbereich, section
     oder ein hinzugefuegter Block. */
  const ABSCHNITT = SITE.abschnitte;
  const abschnittVon = (el) => el.closest(ABSCHNITT);
  const abschnitte = () => [...document.querySelectorAll(ABSCHNITT)]
    .filter((el) => el.parentElement === document.body || el.parentElement.tagName === 'MAIN')
    .filter((el) => !el.closest('#siteNav, #siteFoot'));
  /* Der Bezugsschluessel eines Abschnitts - damit ein Block spaeter wieder
     an dieselbe Stelle kommt. */
  const bezugVon = (el) => {
    if (!el) return 'anfang';
    if (el.dataset && el.dataset.block) return el.dataset.block;
    const f = el.querySelector('[data-ez], [data-ez-img], [data-ez-bg]');
    return f ? (f.getAttribute('data-ez') || f.getAttribute('data-ez-img') || f.getAttribute('data-ez-bg')) : 'ende';
  };

  function blockEinfuegen(def) {
    const vorlage = BLOCK_VORLAGEN[def.art];
    if (!vorlage) return null;
    const huelle = document.createElement('div');
    huelle.innerHTML = vorlage(def.id);
    const el = huelle.firstElementChild;
    el.dataset.block = def.id;
    el.dataset.blockArt = def.art;
    blockAttribute(el, def.id);
    if (def.art === 'einbettung') einbettungFuellen(el, def.id);
    /* Wo hin? Nach dem Abschnitt, in dem das Bezugselement steht, sonst
       ans Ende vor der Fusszeile. */
    let anker = null;
    if (def.nach === 'anfang') {
      anker = document.getElementById('siteNav');
    } else if (def.nach && def.nach !== 'ende') {
      const bezug = document.querySelector(
        `[data-ez="${CSS.escape(def.nach)}"], [data-ez-img="${CSS.escape(def.nach)}"],` +
        `[data-ez-bg="${CSS.escape(def.nach)}"], [data-block="${CSS.escape(def.nach)}"]`);
      anker = bezug && (abschnittVon(bezug) || bezug);
    }
    if (anker && anker.parentElement) {
      /* Bloecke, die schon hinter dem Anker stehen, kamen frueher in der
         Liste - der neue reiht sich dahinter ein. */
      if (!def.vorne) {
        while (anker.nextElementSibling
          && anker.nextElementSibling.matches('.ezblock[data-block], .ez-plus')) anker = anker.nextElementSibling;
      }
      anker.after(el);
    } else {
      const fuss = document.getElementById('siteFoot');
      if (fuss) fuss.before(el); else document.body.appendChild(el);
    }
    /* Ausgangswerte merken, damit nur Abweichungen gespeichert werden. */
    el.querySelectorAll('[data-ez], [data-ez-img], [data-ez-link]').forEach((k) => {
      if (k.hasAttribute('data-ez')) standard[k.getAttribute('data-ez')] = k.innerHTML.trim();
      if (k.hasAttribute('data-ez-img')) standard[k.getAttribute('data-ez-img')] = k.getAttribute('src');
      if (k.hasAttribute('data-ez-link')) standard[k.getAttribute('data-ez-link')] = k.getAttribute('href');
    });
    return el;
  }

  function bloeckeSetzen(wert) {
    let liste = [];
    try { liste = JSON.parse(wert || '[]'); } catch { liste = []; }
    if (!Array.isArray(liste)) liste = [];
    document.querySelectorAll('.ezblock[data-block]').forEach((el) => el.remove());
    bloecke = liste.filter((b) => b && b.id && BLOCK_VORLAGEN[b.art]);
    for (const def of bloecke) blockEinfuegen(def);
    if (document.body.classList.contains('ez-edit') && typeof elementEinrichten === 'function') {
      document.querySelectorAll('.ezblock[data-block] [data-ez], .ezblock[data-block] [data-ez-img]')
        .forEach(elementEinrichten);
    }
  }

  /* Wie die Seite ohne Datenbank aussieht - festgehalten, bevor etwas
     darueber gelegt wird. */
  if (editModus) {
    document.querySelectorAll('[data-ez], [data-ez-img], [data-ez-bg]').forEach((el) => {
      const k = el.getAttribute('data-ez') || el.getAttribute('data-ez-img')
        || el.getAttribute('data-ez-bg');
      standard[k] = el.hasAttribute('data-ez-img') ? el.getAttribute('src')
        : el.hasAttribute('data-ez-bg')
          ? (el.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/) || [, ''])[1]
          : el.innerHTML.trim();
    });
    document.querySelectorAll('[data-ez-link]').forEach((el) => {
      standard[el.getAttribute('data-ez-link')] = el.getAttribute('href') || '';
    });
    document.querySelectorAll('a[data-ez]:not([data-ez-link])').forEach((el) => {
      standard['link.' + el.getAttribute('data-ez')] = el.getAttribute('href') || '';
    });
  }

  /* Alles, was in der Datenbank steht - fuer den Vergleich beim Speichern. */
  let geladeneWerte = {};

  /* Handy-eigene Inhalte tragen das Praefix "m.". Sie werden nach den
     Desktopwerten angewendet und ueberschreiben sie nur am Telefon. */
  /* Die Werte liegen fuer Gaeste schon in der Seite (vom Server eingebaut) -
     dann entfaellt die Abfrage, und nichts blitzt in der alten Fassung auf.
     Der Editor holt sie immer frisch. */
  const vorab = (() => {
    if (editModus || vorschauModus) return null;
    try { const el = document.getElementById('ez-daten'); return el ? { fields: JSON.parse(el.textContent || '{}') } : null; }
    catch { return null; }
  })();
  const geladen = (vorab ? Promise.resolve(vorab)
    : fetch(`/api/public/pages/${encodeURIComponent(SLUG)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { fields: {} })))
    .then((d) => {
      geladeneWerte = d.fields || {};
      const eintraege = Object.entries(geladeneWerte);
      /* Erst die Galerie-Einstellungen merken, dann die Bloecke aufbauen,
         dann die Werte - auch die der Bloecke. */
      for (const [k, v] of eintraege) {
        const g = /^block\.([a-z0-9]+)\.opt$/i.exec(k);
        if (g) galerieOptSetzen(g[1], v);
      }
      if (geladeneWerte.bloecke) setzen('bloecke', geladeneWerte.bloecke);
      for (const [k, v] of eintraege) {
        if (!k.startsWith('m.') && k !== 'bloecke' && !/^block\.[a-z0-9]+\.opt$/i.test(k)) setzen(k, v);
      }
      if (istHandy()) {
        for (const [k, v] of eintraege) if (k.startsWith('m.')) setzen(k.slice(2), v);
      }
      navHoeheMessen();
      ankerAnwenden();
      /* Ein Link auf einen Anker, der erst jetzt in der Seite steht:
         selbst hinrollen, der Browser hat ihn beim Laden noch nicht gefunden. */
      if (!editModus && location.hash.length > 1) {
        const ziel = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (ziel && ziel.classList.contains('ez-anker')) setTimeout(() => ziel.scrollIntoView({ block: 'start' }), 50);
      }
    })
    .catch(() => {});

  /* Auf der Website (und in der Vorschau) laufen die Slider. */
  if (!editModus) {
    geladen.then(() => {
      document.querySelectorAll('.ezblock-galerie').forEach(sliderStarten);
      document.querySelectorAll('.ezblock-formular').forEach(formularAnbinden);
      animationenStarten();
    });
  }

  /* Vorschau: alles normal, nur Bescheid geben, wenn die Seite steht. */
  if (vorschauModus) {
    geladen.then(() => window.parent.postMessage({ typ: 'ez-bereit', seite: SLUG }, location.origin));
    return;
  }
  if (!editModus) return;

  /* ---- Bearbeiten im Rahmen des Editors ---- */
  const wert = (el) =>
    el.hasAttribute('data-ez-img') ? el.getAttribute('src')
      : el.hasAttribute('data-ez-bg')
        ? hintergrundWert(el)
        : el.innerHTML.trim();

  const schluessel = (el) =>
    el.getAttribute('data-ez') || el.getAttribute('data-ez-img') || el.getAttribute('data-ez-bg')
      || (el.dataset && el.dataset.block ? 'block.' + el.dataset.block : null);

  const melden = (nachricht) => {
    window.parent.postMessage(nachricht, location.origin);
    if (nachricht.typ === 'ez-geaendert') standMerken();
  };

  /* ---- Direkte Bearbeitung: anklicken, tippen, ziehen ----
     Ein einziger Modus. Ein Klick setzt den Cursor in den Text und legt
     zugleich einen Rahmen um das Element. Am Rahmen sitzen die ueblichen
     acht Punkte zum Verformen und oben ein Balken zum Verschieben - so
     laesst sich ziehen, ohne vorher Text zu markieren. */
  const schluesselVon = (el) =>
    el.getAttribute('data-ez') || el.getAttribute('data-ez-img') || el.getAttribute('data-ez-bg')
      || el.getAttribute('data-ez-menue')
      || (el.dataset && el.dataset.block ? 'block.' + el.dataset.block : null);

  const LEER = { dx: 0, dy: 0, skala: 1, breite: 0, hoehe: 0 };
  const stilVon = (k) => ({ ...LEER, ...(stilWerte[k] || {}) });

  function stilAnwenden(k) {
    const st = stilVon(k);
    elementeZu(k).forEach((el) => {
      el.style.transform = (st.dx || st.dy || st.skala !== 1)
        ? `translate(${st.dx}px, ${st.dy}px) scale(${st.skala})` : '';
      el.style.transformOrigin = 'center center';
      el.style.width = st.breite ? st.breite + 'px' : '';
      el.style.height = st.hoehe ? st.hoehe + 'px' : '';
      if (st.hoehe && el.tagName === 'IMG') el.style.objectFit = 'cover';
    });
  }

  let aktiv = null;          // aktuell gewaehltes Element
  let rahmen = null;         // der Rahmen dazu

  const ECKEN = [
    ['nw', 'nwse-resize'], ['n', 'ns-resize'], ['ne', 'nesw-resize'],
    ['e', 'ew-resize'], ['se', 'nwse-resize'], ['s', 'ns-resize'],
    ['sw', 'nesw-resize'], ['w', 'ew-resize']
  ];

  function rahmenZeigen(el) {
    if (!el) return rahmenVerstecken();
    aktiv = el;
    /* Wird ein Bild oder ein Abschnitt gewaehlt, soll die Tastatur ihm
       gelten - nicht dem Text, in dem der Cursor gerade noch stand. */
    if (!el.isContentEditable && document.activeElement && document.activeElement.isContentEditable) {
      document.activeElement.blur();
    }
    if (!rahmen) {
      rahmen = document.createElement('div');
      rahmen.className = 'ez-rahmen';
      rahmen.innerHTML =
        '<span class="ez-leiste">'
        + '<span class="ez-greifer" title="Verschieben – hier anfassen und ziehen">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3"/></svg>'
        + '<b>Verschieben</b></span>'
        + '<span class="ez-marke"></span>'
        + '<button type="button" class="ez-tausch" title="Bild oder Video tauschen">Tauschen</button>'
        + '<button type="button" class="ez-tausch ez-schnitt" title="Zuschneiden">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg></button>'
        + '<button type="button" class="ez-bearbeiten" title="Einstellungen öffnen">Bearbeiten …</button>'
        + '<button type="button" class="ez-weg" title="Löschen">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>'
        + '</span>'
        + ECKEN.map(([p, c]) => `<span class="ez-punkt ez-${p}" data-pos="${p}" style="cursor:${c}"></span>`).join('');
      document.body.appendChild(rahmen);
      ziehenAn(rahmen.querySelector('.ez-greifer'), 'move');
      rahmen.querySelectorAll('.ez-punkt').forEach((p) => ziehenAn(p, p.dataset.pos));
      rahmen.querySelector('.ez-tausch').addEventListener('pointerdown', (e) => e.stopPropagation());
      rahmen.querySelector('.ez-tausch').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (aktiv) melden({ typ: 'ez-bild-waehlen', feld: schluessel(aktiv), video: istVideo(wert(aktiv)) });
      });
      rahmen.querySelector('.ez-schnitt').addEventListener('pointerdown', (e) => e.stopPropagation());
      rahmen.querySelector('.ez-schnitt').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); melden({ typ: 'ez-zuschneiden' }); });
      rahmen.querySelector('.ez-weg').addEventListener('pointerdown', (e) => e.stopPropagation());
      rahmen.querySelector('.ez-weg').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (aktiv) elementLoeschen(aktiv);
      });
      rahmen.querySelector('.ez-bearbeiten').addEventListener('pointerdown', (e) => e.stopPropagation());
      rahmen.querySelector('.ez-bearbeiten').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (aktiv) melden({ typ: 'ez-design-oeffnen', was: aktiv.hasAttribute('data-ez-fuss') ? 'fuss' : 'menue' });
      });
    }
    const istRand = el.matches(RAND);
    rahmen.querySelector('.ez-bearbeiten').hidden = !istRand;
    rahmen.querySelector('.ez-greifer').hidden = istRand;
    rahmen.querySelectorAll('.ez-punkt').forEach((p) => { p.hidden = istRand; });
    rahmen.querySelector('.ez-marke').textContent = beschriftung(el);
    rahmen.querySelector('.ez-tausch').hidden = !(el.hasAttribute('data-ez-img') || el.hasAttribute('data-ez-bg'));
    rahmen.querySelector('.ez-schnitt').hidden = rahmen.querySelector('.ez-tausch').hidden || istVideo(wert(el));
    rahmen.querySelector('.ez-weg').hidden = istRand;
    const block = el.closest('.ezblock[data-block]');
    rahmen.querySelector('.ez-weg').title = block ? 'Abschnitt löschen'
      : (verstecktWerte.has(schluesselVon(el)) ? 'Wieder einblenden' : 'Ausblenden – erscheint nicht auf der Website');
    rahmen.classList.toggle('ez-ausgeblendet', !block && verstecktWerte.has(schluesselVon(el)));
    rahmenSetzen();
    melden(auswahlInfo(el));
  }
  /* Ueberschriften in Grossbuchstaben lesbar machen: "ÖFFNUNGSZEITEN" -> "Öffnungszeiten". */
  const huebsch = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 40); return s && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s; };
  /* Sprungmarke des Abschnitts, in dem ein Element steht. */
  function ankerInfo(el) {
    const ab = el.closest(ABSCHNITT);
    if (!ab || ab.closest('#siteNav, #siteFoot')) return null;
    const bezug = bezugVon(ab);
    if (!bezug || bezug === 'ende' || bezug === 'anfang') return null;
    const kopf = ab.querySelector('h1, h2, h3, blockquote, p');
    const titelVorschlag = huebsch(kopf ? kopf.textContent : '') || BLOCK_NAMEN[ab.dataset.blockArt] || 'Abschnitt';
    const a = ankerWerte[bezug];
    return { bezug, name: a ? a.name : '', titel: a ? a.titel : '', fest: ab.id || '',
      vorschlag: ankerName(titelVorschlag) || 'abschnitt', titelVorschlag, seite: location.pathname };
  }
  /* Alle Anker dieser Seite - fuer die Zielauswahl im Editor. */
  const ankerListe = () => {
    const liste = [];
    for (const ab of abschnitte()) {
      const a = ankerWerte[bezugVon(ab)];
      if (a) liste.push({ name: a.name, titel: a.titel });
      else if (ab.id && !ab.closest('#siteNav, #siteFoot')) {
        const kopf = ab.querySelector('h1, h2, h3');
        liste.push({ name: ab.id, titel: huebsch(kopf ? kopf.textContent : '') || ab.id, fest: true });
      }
    }
    return liste;
  };
  /* Was der Editor ueber das gewaehlte Element wissen muss. */
  function auswahlInfo(el) {
    const block = el.closest('.ezblock[data-block]');
    const k = schluesselVon(el);
    return {
      typ: 'ez-auswahl', feld: k, art: artVon(el),
      block: block ? { id: block.dataset.block, art: block.dataset.blockArt,
        opt: blockOpt(block.dataset.block) } : null,
      versteckt: verstecktWerte.has(k),
      farbe: farbeWerte[k] || '',
      ausschnitt: ausschnittWerte[k] || '',
      einpassen: einpassenWerte[k] || '',
      anim: animWerte[k] || '',
      quelle: (el.hasAttribute('data-ez-img') || el.hasAttribute('data-ez-bg')) ? wert(el) : '',
      masse: (() => { const r = el.getBoundingClientRect(); return { b: Math.round(r.width), h: Math.round(r.height) }; })(),
      formatDa: !!formatAblage,
      menue: el.hasAttribute('data-ez-menue') ? menueDaten.map((x) => ({ ...x })) : null,
      burgerOffen: document.body.classList.contains('navopen'),
      inKopf: !!el.closest('#siteNav'), inFuss: !!el.closest('#siteFoot'),
      anker: ankerInfo(el),
      link: (el.getAttribute('data-ez-link') || el.matches('a[data-ez]')) ? (el.getAttribute('href') || '') : null,
      linkFeld: el.getAttribute('data-ez-link') || (el.matches('a[data-ez]') ? 'link.' + k : null),
      schrift: schriftWerte[k] || '',
      groesse: groesseWerte[k] || 0,
      ausricht: ausrichtWerte[k] || ''
    };
  }

  /* Loeschen: ein hinzugefuegter Block verschwindet ganz. Ein festes
     Element der Seite laesst sich nicht entfernen, aber ausblenden - es
     bleibt im Editor blass sichtbar und fehlt auf der Website. */
  function elementLoeschen(el) {
    const block = el.closest('.ezblock[data-block]');
    if (block) return blockEntfernen(block.dataset.block);
    const k = schluesselVon(el);
    if (verstecktWerte.has(k)) {
      verstecktWerte.delete(k);
      elementeZu(k).forEach((x) => x.classList.remove('ez-versteckt'));
      melden({ typ: 'ez-hinweis', text: 'Element wird wieder angezeigt.' });
    } else {
      verstecktWerte.add(k);
      elementeZu(k).forEach((x) => x.classList.add('ez-versteckt'));
      melden({ typ: 'ez-hinweis', text: 'Ausgeblendet – auf der Website erscheint dieses Element nicht mehr. Zum Zurückholen erneut auf das rote Symbol klicken.' });
    }
    rahmenZeigen(el);
    melden({ typ: 'ez-geaendert' });
  }
  function rahmenVerstecken() {
    rahmen?.remove(); rahmen = null; aktiv = null;
    melden({ typ: 'ez-auswahl', feld: '', art: '', block: null });
  }
  const artVon = (el) => el.hasAttribute('data-ez-img') ? 'bild'
    : el.hasAttribute('data-ez-bg') ? 'hintergrund'
      : el.hasAttribute('data-ez-menue') ? 'menue'
        : el.hasAttribute('data-ez-fuss') ? 'fuss'
          : el.classList.contains('ezblock') ? 'block'
            : el.matches('a, button, .btn') ? 'knopf' : 'text';
  const RAND = '[data-ez-menue], [data-ez-fuss]';
  const BLOCK_NAMEN = { bild: 'Bild', video: 'Video', galerie: 'Galerie', text: 'Text', ueberschrift: 'Überschrift',
    button: 'Button', trenner: 'Trenner', zitat: 'Zitat', spalten: 'Zwei Spalten', einbettung: 'Einbettung',
    formular: 'Formular' };
  const beschriftung = (el) => {
    if (el.tagName === 'VIDEO' || el.dataset.ezVideo) return 'Video';
    const block = el.closest('.ezblock[data-block]');
    if (el.hasAttribute('data-ez-menue')) return 'Kopfzeile & Menü';
    if (el.hasAttribute('data-ez-fuss')) return 'Fußzeile';
    if (el.classList.contains('ezblock')) return (BLOCK_NAMEN[el.dataset.blockArt] || 'Abschnitt') + ' · Abschnitt';
    if (block && block.dataset.blockArt === 'galerie') return 'Galerie · Bild';
    return { bild: 'Bild', hintergrund: 'Hintergrund', knopf: 'Knopf', text: 'Text' }[artVon(el)];
  };

  function rahmenSetzen() {
    if (!rahmen || !aktiv) return;
    const r = aktiv.getBoundingClientRect();
    rahmen.style.top = (window.scrollY + r.top) + 'px';
    rahmen.style.left = (window.scrollX + r.left) + 'px';
    rahmen.style.width = r.width + 'px';
    rahmen.style.height = r.height + 'px';
    rahmen.classList.toggle('ez-innen', window.scrollY + r.top < 34);
  }

  /* Ziehen: der Rahmen ist der Griff, der Text bleibt unangetastet. */
  /* Einen ganzen Abschnitt ziehen: er wandert zwischen den anderen
     Abschnitten, sobald der Zeiger deren Mitte ueberschreitet. */
  function abschnittZiehen(e, block) {
    document.body.classList.add('ez-zieht', 'ez-zieht-abschnitt');
    block.classList.add('ez-wird-gezogen');
    let letzter = null;
    const bewegen = (ev) => {
      /* Waehrend des Ziehens ist die Seite fuer den Zeiger blind - also
         selbst nachsehen, ueber welchem Abschnitt er steht. */
      const y = ev.clientY;
      let ziel = null;
      for (const ab of abschnitte()) {
        if (ab === block) continue;
        const r = ab.getBoundingClientRect();
        if (y >= r.top && y <= r.bottom) { ziel = ab; break; }
      }
      /* Ueber dem Rand: nach oben/unten weiterrollen. */
      if (y < 60) window.scrollBy(0, -12); else if (y > window.innerHeight - 60) window.scrollBy(0, 12);
      if (!ziel) return;
      const r = ziel.getBoundingClientRect();
      const oben = y < r.top + r.height / 2;
      const marke = (ziel.dataset.block || bezugVon(ziel)) + (oben ? ':oben' : ':unten');
      if (marke === letzter) return;
      letzter = marke;
      if (oben) ziel.before(block); else ziel.after(block);
      rahmenSetzen();
    };
    const ende = () => {
      document.removeEventListener('pointermove', bewegen, true);
      document.removeEventListener('pointerup', ende, true);
      document.removeEventListener('pointercancel', ende, true);
      document.body.classList.remove('ez-zieht', 'ez-zieht-abschnitt');
      block.classList.remove('ez-wird-gezogen');
      /* Anker und Reihenfolge festhalten. */
      const def = bloecke.find((b) => b.id === block.dataset.block);
      if (def) {
        let vorher = block.previousElementSibling;
        while (vorher && vorher.classList.contains('ez-plus')) vorher = vorher.previousElementSibling;
        def.nach = (vorher && vorher.id !== 'siteNav' && vorher.matches(ABSCHNITT)) ? bezugVon(vorher) : 'anfang';
        const reihenfolge = [...document.querySelectorAll('.ezblock[data-block]')].map((b) => b.dataset.block);
        bloecke.sort((x, y) => reihenfolge.indexOf(x.id) - reihenfolge.indexOf(y.id));
      }
      plusLeisten();
      rahmenSetzen();
      melden({ typ: 'ez-geaendert' });
    };
    document.addEventListener('pointermove', bewegen, true);
    document.addEventListener('pointerup', ende, true);
    document.addEventListener('pointercancel', ende, true);
  }

  function ziehenAn(knopf, art) {
    knopf.addEventListener('pointerdown', (e) => {
      if (!aktiv) return;
      e.preventDefault(); e.stopPropagation();
      knopf.setPointerCapture?.(e.pointerId);
      const el = aktiv;
      /* Ein ganzer Abschnitt wird nicht verschoben, sondern umsortiert. */
      if (art === 'move' && el.classList.contains('ezblock') && el.dataset.block) return abschnittZiehen(e, el);
      if (art === 'move' && el.hasAttribute('data-ez-menue')) return;
      const k = schluesselVon(el);
      const kasten = el.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, ...stilVon(k),
        breite: stilVon(k).breite || Math.round(kasten.width),
        hoehe: stilVon(k).hoehe || Math.round(kasten.height) };
      document.body.classList.add('ez-zieht');
      const bewegen = (ev) => {
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        const st = stilVon(k);
        if (art === 'move') {
          /* Einrasten an den Kanten und Mitten der Nachbarn. Wer frei
             schieben will, haelt die Umschalttaste gedrueckt. */
          let nx = Math.round(start.dx + dx), ny = Math.round(start.dy + dy);
          if (!ev.shiftKey) {
            const gerastet = einrasten(el, k, nx, ny);
            nx = gerastet.dx; ny = gerastet.dy;
            hilfslinienZeigen(gerastet.linien);
          } else {
            hilfslinienZeigen([]);
          }
          stilWerte[k] = { ...st, dx: nx, dy: ny };
        } else if (art === 'e' || art === 'w') {
          const n = art === 'e' ? start.breite + dx : start.breite - dx;
          stilWerte[k] = { ...st, breite: Math.max(24, Math.round(n)) };
        } else if (art === 'n' || art === 's') {
          const n = art === 's' ? start.hoehe + dy : start.hoehe - dy;
          stilWerte[k] = { ...st, hoehe: Math.max(16, Math.round(n)) };
        } else {
          /* Ecken: gleichmaessig groesser oder kleiner. */
          const zeichen = (art === 'se' ? (dx + dy) : art === 'nw' ? -(dx + dy)
            : art === 'ne' ? (dx - dy) : (dy - dx)) / 2;
          const f = Math.max(0.2, Math.min(4,
            start.skala * (1 + zeichen / Math.max(60, kasten.width))));
          stilWerte[k] = { ...st, skala: Math.round(f * 100) / 100 };
        }
        stilAnwenden(k); rahmenSetzen();
      };
      const ende = () => {
        document.removeEventListener('pointermove', bewegen, true);
        document.removeEventListener('pointerup', ende, true);
        document.removeEventListener('pointercancel', ende, true);
        document.body.classList.remove('ez-zieht');
        hilfslinienZeigen([]);
        melden({ typ: 'ez-geaendert' });
      };
      document.addEventListener('pointermove', bewegen, true);
      document.addEventListener('pointerup', ende, true);
      document.addEventListener('pointercancel', ende, true);
    });
  }

  /* ---- Einrasten und Hilfslinien ----
     Beim Schieben suchen wir Kanten und Mitten der anderen Elemente sowie
     die Mitte der Seite. Kommt das gezogene Element naeher als ein paar
     Pixel heran, springt es genau darauf und eine Linie zeigt, woran es
     sich ausrichtet. Mit gedrueckter Umschalttaste bleibt alles frei. */
  const FANG = 6;
  let linienEl = null;

  function hilfslinienZeigen(linien) {
    if (!linienEl) {
      linienEl = document.createElement('div');
      linienEl.className = 'ez-linien';
      document.body.appendChild(linienEl);
    }
    if (!linien || !linien.length) { linienEl.innerHTML = ''; return; }
    /* Die Fangpunkte liegen in Dokumentkoordinaten, die Linien schweben
       ueber dem Fenster - deshalb der Abzug der Scrollposition. */
    linienEl.innerHTML = linien.map((l) => l.achse === 'x'
      ? `<i class="ez-linie sk" style="left:${Math.round(l.wert - window.scrollX)}px"></i>`
      : `<i class="ez-linie wa" style="top:${Math.round(l.wert - window.scrollY)}px"></i>`).join('');
  }

  /* Alle Kanten, an denen sich etwas ausrichten laesst. */
  function fangpunkte(ausser) {
    const x = [], y = [];
    const doc = document.documentElement;
    x.push(window.scrollX + window.innerWidth / 2);          // Seitenmitte
    document.querySelectorAll('[data-ez], [data-ez-img], [data-ez-bg]').forEach((el) => {
      if (el === ausser || ausser.contains(el) || el.contains(ausser)) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;   // nur Sichtbares
      x.push(window.scrollX + r.left, window.scrollX + r.right, window.scrollX + r.left + r.width / 2);
      y.push(window.scrollY + r.top, window.scrollY + r.bottom, window.scrollY + r.top + r.height / 2);
    });
    void doc;
    return { x, y };
  }

  function einrasten(el, k, dx, dy) {
    const st = stilVon(k);
    /* Wo laege das Element bei dieser Verschiebung? */
    const r = el.getBoundingClientRect();
    const versatzX = dx - st.dx, versatzY = dy - st.dy;
    const links = window.scrollX + r.left + versatzX;
    const oben = window.scrollY + r.top + versatzY;
    const breite = r.width, hoehe = r.height;

    const punkte = fangpunkte(el);
    const linien = [];
    let besteX = null, abstandX = FANG + 1;
    for (const kante of [links, links + breite / 2, links + breite]) {
      for (const p of punkte.x) {
        const d = Math.abs(p - kante);
        if (d < abstandX) { abstandX = d; besteX = { ziel: p, kante }; }
      }
    }
    let besteY = null, abstandY = FANG + 1;
    for (const kante of [oben, oben + hoehe / 2, oben + hoehe]) {
      for (const p of punkte.y) {
        const d = Math.abs(p - kante);
        if (d < abstandY) { abstandY = d; besteY = { ziel: p, kante }; }
      }
    }
    let nx = dx, ny = dy;
    if (besteX && abstandX <= FANG) {
      nx = Math.round(dx + (besteX.ziel - besteX.kante));
      linien.push({ achse: 'x', wert: Math.round(besteX.ziel) });
    }
    if (besteY && abstandY <= FANG) {
      ny = Math.round(dy + (besteY.ziel - besteY.kante));
      linien.push({ achse: 'y', wert: Math.round(besteY.ziel) });
    }
    return { dx: nx, dy: ny, linien };
  }

  /* Alles auf Anfang - fuer ein Element oder nur einen Teil davon. */
  function zuruecksetzenFarbe(k) { delete farbeWerte[k]; elementeZu(k).forEach((el) => { el.style.color = ''; }); }
  function zuruecksetzen(k, was = 'alles') {
    if (was === 'alles') { zuruecksetzenFarbe(k); ausschnittSetzen('ausschnitt.' + k, ''); }
    if (was === 'alles' || was === 'lage') stilWerte[k] = { ...LEER };
    if (was === 'schrift') {
      /* Nur die Schriftart zuruecknehmen, Groesse und Ausrichtung bleiben. */
      delete schriftWerte[k];
      elementeZu(k).forEach((x) => { x.style.fontFamily = ''; });
    }
    if (was === 'alles') {
      delete groesseWerte[k]; delete schriftWerte[k]; delete ausrichtWerte[k];
      elementeZu(k).forEach((x) => { x.style.fontSize = ''; x.style.fontFamily = ''; x.style.textAlign = ''; });
    }
    stilAnwenden(k);
    rahmenSetzen();
    melden({ typ: 'ez-geaendert' });
  }

  /* ---- Rechtsklick: die haeufigsten Handgriffe direkt am Element ---- */
  let menue = null;
  function menueSchliessen() { menue?.remove(); menue = null; }

  function menueZeigen(el, x, y) {
    menueSchliessen();
    const k = schluesselVon(el);
    const art = artVon(el);
    const block = el.closest('.ezblock[data-block]');
    const istBild = art === 'bild' || art === 'hintergrund';
    /* Eintraege: ['Text', fn] | ['—'] | ['#Überschrift'] | ['@farben'] */
    const punkte = [];
    if (art === 'text' || art === 'knopf') {
      punkte.push(['#Text']);
      punkte.push(['Fett', () => fuehreAus('bold'), 'B']);
      punkte.push(['Kursiv', () => fuehreAus('italic'), 'I']);
      punkte.push(['Unterstrichen', () => fuehreAus('underline'), 'U']);
      punkte.push(['Link im Text setzen', () => melden({ typ: 'ez-link-waehlen', feld: '' })]);
      punkte.push(['Formatierung entfernen', () => fuehreAus('removeFormat')]);
      punkte.push(['#Ausrichtung']);
      punkte.push(['Linksbündig', () => ausrichten(k, 'left')]);
      punkte.push(['Zentriert', () => ausrichten(k, 'center')]);
      punkte.push(['Rechtsbündig', () => ausrichten(k, 'right')]);
      punkte.push(['#Schrift']);
      punkte.push(['Größer', () => schriftStufe(k, 1), 'A+']);
      punkte.push(['Kleiner', () => schriftStufe(k, -1), 'A−']);
      punkte.push(['Schriftart wählen …', () => melden({ typ: 'ez-schrift-oeffnen' })]);
      punkte.push(['@farben']);
      punkte.push(['#Format']);
      punkte.push(['Format kopieren', () => formatKopieren(k)]);
      if (formatAblage) punkte.push(['Format einfügen', () => formatEinfuegen(k)]);
      if (el.matches('a[data-ez]') || el.hasAttribute('data-ez-link')) {
        punkte.push(['Verlinkung ändern', () =>
          melden({ typ: 'ez-link-waehlen', feld: el.getAttribute('data-ez-link') || ('link.' + k), aktuell: el.getAttribute('href') || '' })]);
      }
    }
    if (istBild) {
      punkte.push(['#' + (el.tagName === 'VIDEO' || el.dataset.ezVideo ? 'Video' : 'Bild')]);
      punkte.push(['Bild tauschen', () => melden({ typ: 'ez-bild-waehlen', feld: k })]);
      punkte.push(['Video einsetzen', () => melden({ typ: 'ez-bild-waehlen', feld: k, video: true })]);
      if (!istVideo(wert(el))) punkte.push(['Zuschneiden …', () => melden({ typ: 'ez-zuschneiden' }), '✂']);
      punkte.push(['#Einpassen']);
      [['fuellen', 'Platz ausfüllen (zuschneiden)'], ['ganz', 'Ganzes Bild zeigen']].forEach(([w, t]) =>
        punkte.push([(einpassenWerte[k] === w ? '✓ ' : '') + t, () => { einpassenSetzen('einpassen.' + k, einpassenWerte[k] === w ? '' : w); melden({ typ: 'ez-geaendert' }); melden(auswahlInfo(el)); }]));
      punkte.push(['#Bildausschnitt']);
      [['oben', 'Oberer Teil zeigen'], ['mitte', 'Mitte zeigen'], ['unten', 'Unterer Teil zeigen']].forEach(([w, t]) =>
        punkte.push([(ausschnittWerte[k] === w ? '✓ ' : '') + t, () => { ausschnittSetzen('ausschnitt.' + k, w); melden({ typ: 'ez-geaendert' }); melden(auswahlInfo(el)); }]));
      punkte.push(['Bild in neuem Tab öffnen', () => window.open(wert(el), '_blank')]);
    }
    if (art === 'menue' || el.closest('#siteNav')) {
      punkte.push(['#Kopfzeile']);
      punkte.push(['Menü-Einträge bearbeiten …', () => melden({ typ: 'ez-design-oeffnen', was: 'menue' })]);
      punkte.push(['Kopfzeile gestalten …', () => melden({ typ: 'ez-design-oeffnen', was: 'kopf' })]);
      punkte.push(['Handy-Menü gestalten …', () => melden({ typ: 'ez-design-oeffnen', was: 'handy' })]);
    }
    if (art === 'fuss' || el.closest('#siteFoot')) {
      punkte.push(['#Fußzeile']);
      punkte.push(['Fußzeile gestalten …', () => melden({ typ: 'ez-design-oeffnen', was: 'fuss' })]);
    }
    if (ankerInfo(el)) {
      punkte.push(['#Sprungmarke']);
      punkte.push([(ankerInfo(el).name ? 'Sprungmarke (Anker) ändern …' : 'Sprungmarke (Anker) setzen …'), () => melden({ typ: 'ez-anker-oeffnen' })]);
    }
    if (art !== 'block' && art !== 'menue' && art !== 'fuss') {
      punkte.push(['#Element']);
      punkte.push(['Größe und Lage zurücksetzen', () => zuruecksetzen(k, 'lage')]);
      punkte.push(['Alles an diesem Element zurücksetzen', () => zuruecksetzen(k, 'alles')]);
      punkte.push([verstecktWerte.has(k) ? 'Wieder einblenden' : 'Ausblenden (nicht auf der Website)', () => elementLoeschen(el)]);
    }
    if (block) {
      punkte.push(['#Abschnitt']);
      if (!el.classList.contains('ezblock')) punkte.push(['Abschnitt auswählen (zum Ziehen)', () => rahmenZeigen(block)]);
      punkte.push(['Abschnitt-Einstellungen …', () =>
        melden({ typ: 'ez-galerie-oeffnen', id: block.dataset.block, opt: blockOpt(block.dataset.block) })]);
      punkte.push(['Hintergrund: keiner / hell / dunkel / Akzent', () => {
        const o = blockOpt(block.dataset.block);
        const reihe = ['keine', 'hell', 'dunkel', 'akzent'];
        const neu = reihe[(reihe.indexOf(o.hg) + 1) % reihe.length];
        blockOptSetzen(block.dataset.block, { ...o, hg: neu }); galerieNeuBauen(block.dataset.block);
        melden({ typ: 'ez-geaendert' }); rahmenSetzen();
      }]);
      punkte.push(['Abschnitt duplizieren', () => blockDuplizieren(block.dataset.block), '⌘D']);
      punkte.push(['Abschnitt nach oben', () => blockVerschieben(block.dataset.block, -1), '⌥↑']);
      punkte.push(['Abschnitt nach unten', () => blockVerschieben(block.dataset.block, 1), '⌥↓']);
      punkte.push(['Abschnitt löschen', () => blockEntfernen(block.dataset.block), '⌫']);
    }
    const abschnitt = abschnittVon(el);
    if (abschnitt) {
      punkte.push(['#Einfügen']);
      punkte.push(['Neuen Abschnitt darüber', () => { const bar = abschnitt.previousElementSibling; if (bar && bar.classList.contains('ez-plus')) blockWahlZeigen(bar); }]);
      punkte.push(['Neuen Abschnitt darunter', () => { const bar = abschnitt.nextElementSibling; if (bar && bar.classList.contains('ez-plus')) blockWahlZeigen(bar); }]);
    }

    menue = document.createElement('div');
    menue.className = 'ez-menue';
    const FARBREIHE = [['', 'Standard'], ...Object.entries(FARBEN)];
    menue.innerHTML = punkte.map(([t, fn, kuerzel]) => {
      if (t === '—') return '<hr>';
      if (t[0] === '#') return `<div class="ez-menue-kopf">${t.slice(1)}</div>`;
      if (t === '@farben') return `<div class="ez-menue-kopf">Farbe</div><div class="ez-menue-farben">${FARBREIHE.map(([id, hex]) =>
        `<button type="button" data-farbe="${id}" title="${id || 'Standard'}" style="background:${hex === 'Standard' ? 'linear-gradient(135deg,#fff 50%,#19163E 50%)' : hex}" class="${(farbeWerte[k] || '') === id ? 'ist-aktiv' : ''}"></button>`).join('')}</div>`;
      return `<button type="button">${t}${kuerzel ? `<kbd>${kuerzel}</kbd>` : ''}</button>`;
    }).join('');
    document.body.appendChild(menue);
    let i = 0;
    const aktionen = punkte.filter(([t]) => t !== '—' && t[0] !== '#' && t !== '@farben');
    menue.querySelectorAll(':scope > button').forEach((b) => {
      const eintrag = aktionen[i++];
      b.addEventListener('click', () => { menueSchliessen(); eintrag[1](); });
    });
    menue.querySelectorAll('.ez-menue-farben button').forEach((b) =>
      b.addEventListener('click', () => { farbeSetzen('farbe.' + k, b.dataset.farbe); menueSchliessen(); melden({ typ: 'ez-geaendert' }); }));
    const br = menue.getBoundingClientRect();
    const links = Math.min(x, window.innerWidth - br.width - 8);
    const oben = Math.min(y, window.innerHeight - br.height - 8);
    menue.style.left = (window.scrollX + Math.max(6, links)) + 'px';
    menue.style.top = (window.scrollY + Math.max(6, oben)) + 'px';
  }

  function ausrichten(k, wie) {
    elementeZu(k).forEach((el) => { el.style.textAlign = wie; });
    ausrichtWerte[k] = wie;
    melden({ typ: 'ez-geaendert' });
  }
  function schriftStufe(k, schritt) {
    const el = elementeZu(k)[0];
    if (!el) return;
    const jetzt = groesseWerte[k] || parseFloat(getComputedStyle(el).fontSize) || 16;
    const neu = Math.max(9, Math.min(160, Math.round(jetzt + schritt * 2)));
    groesseWerte[k] = neu;
    elementeZu(k).forEach((x) => { x.style.fontSize = neu + 'px'; });
    rahmenSetzen();
    melden({ typ: 'ez-geaendert' });
    melden({ typ: 'ez-groesse-ist', px: neu });
  }

  document.addEventListener('contextmenu', (e) => {
    let el = e.target.closest('[data-ez], [data-ez-img], [data-ez-bg], .ezblock[data-block]');
    if (!el && !e.target.closest('#burger')) el = e.target.closest(RAND);
    if (!el) return;
    e.preventDefault();
    rahmenZeigen(el);
    menueZeigen(el, e.clientX, e.clientY);
  });

  /* Klick: Element waehlen. Im Text bleibt der Cursor, wo er hingehoert. */
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ez-rahmen') || e.target.closest('.ez-menue') || e.target.closest('.ez-plus')) return;
    menueSchliessen();
    let el = e.target.closest('[data-ez], [data-ez-img], [data-ez-bg], .ezblock[data-block]');
    if (!el && !e.target.closest('#burger')) el = e.target.closest(RAND);
    if (el) rahmenZeigen(el);
    else rahmenVerstecken();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { menueSchliessen(); rahmenVerstecken(); melden({ typ: 'ez-esc' }); }
  });

  const nachziehen = () => { rahmenSetzen(); menueSchliessen(); };
  window.addEventListener('scroll', nachziehen, { passive: true });
  window.addEventListener('resize', nachziehen);
  /* Waechst ein Text beim Tippen, waechst der Rahmen mit. */
  if (window.ResizeObserver) {
    const beobachter = new ResizeObserver(() => rahmenSetzen());
    setTimeout(() => {
      document.querySelectorAll('[data-ez]').forEach((el) => beobachter.observe(el));
    }, 300);
  }

  /* Der alte Umschalter bleibt als leere Huelle, damit aeltere Editorstaende
     keinen Fehler ausloesen. */
  function setzeModus() { /* es gibt nur noch einen Modus */ }

  /* Ein Element bearbeitbar machen - beim Start fuer alles auf der Seite,
     spaeter fuer jeden neu hinzugefuegten Block. */
  function elementEinrichten(el) {
    if (el.dataset.ezFertig) return;
    el.dataset.ezFertig = '1';
    if (el.hasAttribute('data-ez')) {
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      el.addEventListener('input', () => melden({ typ: 'ez-geaendert' }));
      /* Zeilenumbruch statt neuem Absatz, sonst zerfaellt die Struktur. */
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          document.execCommand('insertLineBreak');
        }
      });
    }
    /* Einfacher Klick waehlt das Bild aus (Rahmen zum Verformen),
       Doppelklick oder Rechtsklick tauscht es. So laesst sich ein Bild
       verschieben, ohne dass sofort die Bildauswahl aufspringt. */
    if (el.hasAttribute('data-ez-img') || el.hasAttribute('data-ez-bg')) {
      el.classList.add('ez-bild');
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
      el.addEventListener('dblclick', (e) => {
        e.preventDefault(); e.stopPropagation();
        melden({ typ: 'ez-bild-waehlen', feld: schluessel(el), video: istVideo(wert(el)) });
      });
    }
  }

  /* Beim Darueberfahren zeigen, was anklickbar ist - mit Namen. */
  let hoverMarke = null;
  function hoverEinrichten() {
    hoverMarke = document.createElement('span');
    hoverMarke.className = 'ez-hover-marke';
    document.body.appendChild(hoverMarke);
    let letzter = null;
    document.addEventListener('mousemove', (e) => {
      if (document.body.classList.contains('ez-zieht')) return;
      if (e.target.closest('.ez-rahmen, .ez-menue, .ez-plus, .ez-blockwahl')) return;
      let el = e.target.closest('[data-ez], [data-ez-img], [data-ez-bg], .ezblock[data-block]');
      if (!el && !e.target.closest('#burger')) el = e.target.closest(RAND);
      if (el === letzter) return;
      if (letzter) letzter.classList.remove('ez-hover');
      letzter = el;
      if (!el || el === aktiv) { hoverMarke.hidden = true; return; }
      el.classList.add('ez-hover');
      const r = el.getBoundingClientRect();
      hoverMarke.textContent = beschriftung(el) + ' · klicken';
      hoverMarke.hidden = false;
      hoverMarke.style.left = (window.scrollX + r.left) + 'px';
      hoverMarke.style.top = (window.scrollY + Math.max(r.top, 0) + 4) + 'px';
    }, { passive: true });
    document.addEventListener('mouseleave', () => { if (letzter) letzter.classList.remove('ez-hover'); letzter = null; hoverMarke.hidden = true; });
  }

  /* Tastenkuerzel: Entf/Backspace loescht einen gewaehlten Abschnitt oder
     blendet ein Element aus (nicht beim Tippen), Cmd/Strg+D dupliziert,
     Alt+Pfeil schiebt einen Abschnitt, Cmd/Strg+S speichert, Esc hebt auf. */
  function tastenEinrichten() {
    document.addEventListener('keydown', (e) => {
      const tippt = document.activeElement && document.activeElement.isContentEditable;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); melden({ typ: 'ez-speichern' }); return; }
      /* Beim Tippen macht der Browser selbst rueckgaengig (Wort fuer Wort);
         sonst gilt unser Verlauf fuer die ganze Seite. */
      if (meta && e.key.toLowerCase() === 'z' && !tippt) {
        e.preventDefault();
        if (e.shiftKey) wiederholen(); else rueckgaengig();
        return;
      }
      if (meta && e.key.toLowerCase() === 'y' && !tippt) { e.preventDefault(); wiederholen(); return; }
      if (!aktiv) return;
      if (meta && e.key.toLowerCase() === 'd') {
        const b = aktiv.closest('.ezblock[data-block]');
        if (b) { e.preventDefault(); blockDuplizieren(b.dataset.block); }
        return;
      }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const b = aktiv.closest('.ezblock[data-block]');
        if (b) { e.preventDefault(); blockVerschieben(b.dataset.block, e.key === 'ArrowUp' ? -1 : 1); }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !tippt) {
        if (aktiv.matches(RAND)) return;
        e.preventDefault();
        elementLoeschen(aktiv);
      }
    });
  }

  function starten() {
    document.body.classList.add('ez-edit');
    hoverEinrichten();
    tastenEinrichten();
    Object.keys(SCHRIFTEN).forEach(schriftLaden);
    document.querySelectorAll('[data-ez], [data-ez-img], [data-ez-bg]').forEach(elementEinrichten);
    /* Im Editor wird kein Formular abgeschickt. */
    document.addEventListener('submit', (e) => e.preventDefault(), true);
    /* Im Editor soll kein Klick die Seite wechseln. */
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a && !a.hasAttribute('data-ez')) e.preventDefault();
    }, true);
    heroAnimation();
    plusLeisten();
    verlaufNeu();
    melden({ typ: 'ez-bereit', seite: SLUG });
    melden({ typ: 'ez-design-werte', werte: { ...designWerte }, menue: menueDaten.map((x) => ({ ...x })) });
    melden({ typ: 'ez-anker-liste', seite: location.pathname, liste: ankerListe() });
  }

  /* Die zuletzt bearbeitete Stelle merken: Ein Klick auf die Werkzeugleiste
     liegt ausserhalb dieses Fensters, die Markierung soll trotzdem gelten. */
  let letzteAuswahl = null;
  document.addEventListener('selectionchange', () => {
    const s = document.getSelection();
    if (s && s.rangeCount && s.anchorNode
      && s.anchorNode.parentElement?.closest('[data-ez]')) {
      letzteAuswahl = s.getRangeAt(0).cloneRange();
    }
  });

  /* Das Element, auf das sich Schrift und Groesse beziehen: im Layout-Modus
     das mit dem Griff, sonst das, in dem der Cursor steht. */
  function zielElement() {
    if (aktiv) return aktiv;
    return hostVon(document.getSelection()?.anchorNode) || hostVon(letzteAuswahl?.startContainer);
  }

  const hostVon = (knoten) => {
    const el = knoten && (knoten.nodeType === 1 ? knoten : knoten.parentElement);
    return el ? el.closest('[data-ez]') : null;
  };

  function fuehreAus(name, wert) {
    const s = document.getSelection();
    /* Ohne Markierung gilt der Befehl fuer das ganze gewaehlte Element -
       sonst laeuft ein Klick im Rechtsklickmenue ins Leere. */
    if (aktiv && (!s || s.isCollapsed || !hostVon(s.anchorNode))) {
      const bereich = document.createRange();
      bereich.selectNodeContents(aktiv);
      letzteAuswahl = bereich.cloneRange();
    }
    const setze = () => {
      if (!letzteAuswahl) return;
      s.removeAllRanges();
      s.addRange(letzteAuswahl);
    };
    setze();
    /* Erst das Feld in den Fokus holen, dann die Markierung erneut setzen:
       das Fokussieren allein verschiebt sie sonst an den Anfang. */
    const host = hostVon(s.anchorNode) || hostVon(letzteAuswahl?.startContainer);
    if (host) { window.focus(); host.focus({ preventScroll: true }); setze(); }
    try { document.execCommand('styleWithCSS', false, false); } catch { /* egal */ }
    try { document.execCommand(name, false, wert); } catch { /* egal */ }
    letzteAuswahl = s.rangeCount ? s.getRangeAt(0).cloneRange() : letzteAuswahl;
    melden({ typ: 'ez-geaendert' });
  }

  /* ---- Bloecke hinzufuegen, verschieben, entfernen ---- */
  function blockHinzufuegen(art) {
    if (!BLOCK_VORLAGEN[art]) return;
    const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    /* Hinter dem gewaehlten Element, sonst ans Ende. */
    const nach = aktiv ? (aktiv.closest('.ezblock[data-block]')?.dataset.block || schluesselVon(aktiv)) : 'ende';
    const def = { id, art, nach };
    bloecke.push(def);
    const el = blockEinfuegen(def);
    if (!el) return;
    el.querySelectorAll('[data-ez], [data-ez-img]').forEach(elementEinrichten);
    plusLeisten();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const erstes = el.querySelector('[data-ez], [data-ez-img]') || el;
    setTimeout(() => rahmenZeigen(erstes), 350);
    melden({ typ: 'ez-geaendert' });
    if (art === 'video' && erstes !== el) {
      setTimeout(() => melden({ typ: 'ez-bild-waehlen', feld: schluessel(erstes), video: true }), 400);
    }
  }

  let zuletztGeloescht = null;
  function blockEntfernen(id) {
    const el = document.querySelector(`.ezblock[data-block="${CSS.escape(id)}"]`);
    const def = bloecke.find((b) => b.id === id);
    if (el && def) {
      /* Alles merken, was zum Wiederherstellen noetig ist. */
      const felder = {};
      el.querySelectorAll('[data-ez], [data-ez-img], [data-ez-link]').forEach((q) => {
        const kk = q.getAttribute('data-ez') || q.getAttribute('data-ez-img') || q.getAttribute('data-ez-link');
        felder[kk] = q.hasAttribute('data-ez-img') ? q.getAttribute('src')
          : q.hasAttribute('data-ez-link') ? (q.getAttribute('href') || '#') : q.innerHTML;
      });
      let vorher = el.previousElementSibling;
      while (vorher && vorher.classList.contains('ez-plus')) vorher = vorher.previousElementSibling;
      zuletztGeloescht = { def: { ...def, nach: (vorher && vorher.id !== 'siteNav' && vorher.matches(ABSCHNITT)) ? bezugVon(vorher) : 'anfang' },
        index: bloecke.indexOf(def), opt: blockOpts[id] ? { ...blockOpts[id] } : null, felder,
        stile: Object.fromEntries(Object.keys(felder).map((kk) => [kk, {
          stil: stilWerte[kk], schrift: schriftWerte[kk], groesse: groesseWerte[kk], ausricht: ausrichtWerte[kk], farbe: farbeWerte[kk] }])) };
      melden({ typ: 'ez-geloescht', name: BLOCK_NAMEN[def.art] || 'Abschnitt' });
    }
    if (el) {
      /* Die Felder des Blocks verschwinden mit ihm. */
      el.querySelectorAll('[data-ez], [data-ez-img], [data-ez-link]').forEach((k) => {
        const s = schluessel(k) || k.getAttribute('data-ez-link');
        delete stilWerte[s]; delete schriftWerte[s]; delete groesseWerte[s]; delete ausrichtWerte[s];
        delete farbeWerte[s]; delete ausschnittWerte[s]; delete einpassenWerte[s]; verstecktWerte.delete(s);
      });
      if (aktiv && el.contains(aktiv)) rahmenVerstecken();
      el.remove();
    }
    bloecke = bloecke.filter((b) => b.id !== id);
    delete blockOpts[id];
    delete ankerWerte[id];
    plusLeisten();
    melden({ typ: 'ez-geaendert' });
  }

  /* Einen Block samt Inhalten und Einstellungen kopieren - direkt dahinter. */
  function blockDuplizieren(id) {
    const alt = bloecke.find((b) => b.id === id);
    const altEl = document.querySelector(`.ezblock[data-block="${CSS.escape(id)}"]`);
    if (!alt || !altEl) return;
    const neuId = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    if (blockOpts[id]) blockOpts[neuId] = { ...blockOpts[id] };
    const def = { id: neuId, art: alt.art, nach: id };
    bloecke.splice(bloecke.indexOf(alt) + 1, 0, def);
    const neuEl = blockEinfuegen({ ...def, vorne: true });
    if (!neuEl) return;
    /* Inhalte uebernehmen: Text, Bilder, Links */
    altEl.querySelectorAll('[data-ez], [data-ez-img], [data-ez-link]').forEach((q) => {
      const kAlt = q.getAttribute('data-ez') || q.getAttribute('data-ez-img') || q.getAttribute('data-ez-link');
      const kNeu = kAlt.replace(id, neuId);
      if (q.hasAttribute('data-ez-img')) setzen(kNeu, q.getAttribute('src'));
      else if (q.hasAttribute('data-ez-link')) setzen(kNeu, q.getAttribute('href') || '#');
      else setzen(kNeu, q.innerHTML);
      if (stilWerte[kAlt]) { stilWerte[kNeu] = { ...stilWerte[kAlt] }; stilAnwenden(kNeu); }
      if (schriftWerte[kAlt]) schriftSetzen('schrift.' + kNeu, schriftWerte[kAlt]);
      if (groesseWerte[kAlt]) groesseSetzen((istHandy() ? 'groessem.' : 'groesse.') + kNeu, groesseWerte[kAlt]);
      if (ausrichtWerte[kAlt]) ausrichtSetzen('ausricht.' + kNeu, ausrichtWerte[kAlt]);
      if (farbeWerte[kAlt]) farbeSetzen('farbe.' + kNeu, farbeWerte[kAlt]);
    });
    neuEl.querySelectorAll('[data-ez], [data-ez-img]').forEach(elementEinrichten);
    plusLeisten();
    neuEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const erstes = neuEl.querySelector('[data-ez], [data-ez-img]');
    if (erstes) setTimeout(() => rahmenZeigen(erstes), 350);
    melden({ typ: 'ez-geaendert' });
  }

  function blockWiederherstellen() {
    const z = zuletztGeloescht;
    if (!z) return;
    zuletztGeloescht = null;
    if (z.opt) blockOpts[z.def.id] = z.opt;
    bloecke.splice(Math.min(z.index, bloecke.length), 0, z.def);
    const el = blockEinfuegen({ ...z.def, vorne: true });
    if (!el) return;
    for (const [kk, v] of Object.entries(z.felder)) setzen(kk, v);
    for (const [kk, st] of Object.entries(z.stile)) {
      if (st.stil) { stilWerte[kk] = st.stil; stilAnwenden(kk); }
      if (st.schrift) schriftSetzen('schrift.' + kk, st.schrift);
      if (st.groesse) groesseSetzen((istHandy() ? 'groessem.' : 'groesse.') + kk, st.groesse);
      if (st.ausricht) ausrichtSetzen('ausricht.' + kk, st.ausricht);
      if (st.farbe) farbeSetzen('farbe.' + kk, st.farbe);
    }
    el.querySelectorAll('[data-ez], [data-ez-img]').forEach(elementEinrichten);
    plusLeisten();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => rahmenZeigen(el.querySelector('[data-ez], [data-ez-img]') || el), 350);
    melden({ typ: 'ez-geaendert' });
  }

  function blockVerschieben(id, richtung) {
    const el = document.querySelector(`.ezblock[data-block="${CSS.escape(id)}"]`);
    if (!el) return;
    const geschwister = (x, r) => { let n = r < 0 ? x.previousElementSibling : x.nextElementSibling;
      while (n && n.classList.contains('ez-plus')) n = r < 0 ? n.previousElementSibling : n.nextElementSibling;
      return n; };
    const nachbar = geschwister(el, richtung);
    if (!nachbar || nachbar.id === 'siteNav' || nachbar.id === 'siteFoot') return;
    if (richtung < 0) nachbar.before(el); else nachbar.after(el);
    /* Neuer Anker: das, wonach der Block jetzt steht. */
    const def = bloecke.find((b) => b.id === id);
    if (def) {
      const vorher = geschwister(el, -1);
      def.nach = (vorher && vorher.id !== 'siteNav') ? bezugVon(vorher) : 'anfang';
      /* Reihenfolge in der Liste an die Seite angleichen. */
      const reihenfolge = [...document.querySelectorAll('.ezblock[data-block]')].map((b) => b.dataset.block);
      bloecke.sort((x, y) => reihenfolge.indexOf(x.id) - reihenfolge.indexOf(y.id));
    }
    plusLeisten();
    rahmenSetzen();
    melden({ typ: 'ez-geaendert' });
  }

  /* ---- Plus-Leisten zwischen den Abschnitten ----
     Zwischen je zwei Abschnitten (und vor dem ersten) liegt eine duenne
     Leiste mit einem Plus. Ein Klick darauf oeffnet die Blockauswahl und
     setzt den neuen Block genau an diese Stelle. */
  function plusLeisten() {
    ankerAnwenden();
    if (!document.body.classList.contains('ez-edit')) return;
    document.querySelectorAll('.ez-plus').forEach((el) => el.remove());
    const liste = abschnitte();
    if (!liste.length) return;
    const mache = (vorEl) => {
      const bar = document.createElement('div');
      bar.className = 'ez-plus';
      bar.innerHTML = '<button type="button" class="ez-plus-knopf" title="Hier einen Abschnitt einfügen">+</button>'
        + '<span class="ez-plus-text">Abschnitt einfügen</span>';
      bar.querySelector('button').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        blockWahlZeigen(bar);
      });
      return bar;
    };
    liste[0].before(mache());
    for (const ab of liste) ab.after(mache());
  }

  let blockWahl = null;
  function blockWahlSchliessen() { blockWahl?.remove(); blockWahl = null; }
  function blockWahlZeigen(bar) {
    blockWahlSchliessen();
    const namen = [['ueberschrift', 'Überschrift'], ['text', 'Text'], ['button', 'Button'], ['bild', 'Bild'],
      ['video', 'Video'], ['galerie', 'Galerie'], ['spalten', 'Zwei Spalten'], ['zitat', 'Zitat'],
      ['trenner', 'Trenner'], ['einbettung', 'YouTube']];
    blockWahl = document.createElement('div');
    blockWahl.className = 'ez-blockwahl';
    blockWahl.innerHTML = '<div class="ez-blockwahl-kopf">Was soll hier hin?</div>'
      + '<div class="ez-blockwahl-raster">' + namen.map(([a, n]) =>
        `<button type="button" data-art="${a}">${n}</button>`).join('') + '</div>';
    bar.appendChild(blockWahl);
    blockWahl.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const art = b.dataset.art;
      blockWahlSchliessen();
      blockHinzufuegenBei(art, bar);
    }));
    blockWahl.addEventListener('pointerdown', (e) => e.stopPropagation());
    setTimeout(() => document.addEventListener('pointerdown', blockWahlSchliessen, { once: true }), 0);
  }

  /* Block genau an einer Plus-Leiste einfuegen. */
  function blockHinzufuegenBei(art, bar) {
    if (!BLOCK_VORLAGEN[art]) return;
    const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    let vorher = bar.previousElementSibling;
    while (vorher && vorher.classList.contains('ez-plus')) vorher = vorher.previousElementSibling;
    let nachher = bar.nextElementSibling;
    while (nachher && nachher.classList.contains('ez-plus')) nachher = nachher.nextElementSibling;
    const nach = (vorher && vorher.id !== 'siteNav' && vorher.matches(ABSCHNITT)) ? bezugVon(vorher) : 'anfang';
    const def = { id, art, nach };
    /* In der Liste vor den Block setzen, der bisher an dieser Stelle folgt -
       so bleibt die Reihenfolge auch nach dem Neuladen erhalten. */
    const folgt = nachher && nachher.dataset && nachher.dataset.block
      ? bloecke.findIndex((b) => b.id === nachher.dataset.block) : -1;
    if (folgt >= 0) bloecke.splice(folgt, 0, def); else bloecke.push(def);
    const el = blockEinfuegen({ ...def, vorne: true });
    if (!el) return;
    /* Genau hinter die Leiste, nicht hinter schon vorhandene Bloecke. */
    bar.after(el);
    el.querySelectorAll('[data-ez], [data-ez-img]').forEach(elementEinrichten);
    plusLeisten();
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const erstes = el.querySelector('[data-ez], [data-ez-img]') || el;
    setTimeout(() => rahmenZeigen(erstes), 350);
    melden({ typ: 'ez-geaendert' });
    if (art === 'video' && erstes !== el) {
      setTimeout(() => melden({ typ: 'ez-bild-waehlen', feld: schluessel(erstes), video: true }), 400);
    }
  }

  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
    if (e.data.typ === 'ez-block') blockHinzufuegen(e.data.art);
    if (e.data.typ === 'ez-design') {
      designSetzen('global.design.' + e.data.was, e.data.wert || '');
      if (aktiv && aktiv.matches(RAND)) rahmenSetzen();
      if (document.body.classList.contains('navopen')) navUntenMessen();
      standMerken();
    }
    if (e.data.typ === 'ez-design-alle') { designAlleSetzen(e.data.werte, e.data.menue); verlaufNeu(); }
    if (e.data.typ === 'ez-anker') {
      const bezug = String(e.data.bezug || '');
      if (bezug) {
        const name = ankerName(e.data.name);
        /* Kein Name zweimal auf einer Seite. */
        const doppelt = name && Object.entries(ankerWerte).some(([b, a]) => b !== bezug && a.name === name);
        if (doppelt) melden({ typ: 'ez-hinweis', text: `„${name}“ gibt es auf dieser Seite schon – bitte einen anderen Namen wählen.` });
        else {
          ankerSetzen('anker.' + bezug, name ? JSON.stringify({ name, titel: e.data.titel || name }) : '');
          ankerAnwenden();
          if (aktiv) melden(auswahlInfo(aktiv));
          melden({ typ: 'ez-anker-liste', seite: location.pathname, liste: ankerListe() });
          melden({ typ: 'ez-geaendert' });
        }
      }
    }
    if (e.data.typ === 'ez-zeigen') {
      const ziel = document.querySelector(e.data.ziel || '');
      if (ziel) { ziel.scrollIntoView({ block: e.data.ziel === '#siteNav' ? 'start' : 'center', behavior: 'smooth' }); setTimeout(() => rahmenZeigen(ziel), 400); }
    }
    if (e.data.typ === 'ez-burger') {
      navOffen(!!e.data.offen);
      if (e.data.offen) window.scrollTo({ top: 0 });
    }
    if (e.data.typ === 'ez-design-lesen') melden({ typ: 'ez-design-werte', werte: { ...designWerte }, menue: menueDaten.map((x) => ({ ...x })) });
    if (e.data.typ === 'ez-menue') {
      menueSetzen(e.data.eintraege);
      if (aktiv && aktiv.hasAttribute('data-ez-menue')) rahmenSetzen();
      if (document.body.classList.contains('navopen')) navUntenMessen();
      standMerken();
    }
    if (e.data.typ === 'ez-galerie') {
      const id = e.data.id;
      galerieOptSetzen(id, { ...galerieOpt(id), ...(e.data.opt || {}) });
      galerieNeuBauen(id);
      const blockEl = document.querySelector(`.ezblock[data-block="${CSS.escape(id)}"]`);
      /* Auswahl behalten: das bisherige Element, sonst das erste Feld, sonst der Block. */
      const wieder = (aktiv && blockEl && blockEl.contains(aktiv) && document.contains(aktiv)) ? aktiv
        : (blockEl && (blockEl.querySelector('[data-ez-img], [data-ez]') || blockEl));
      if (wieder) rahmenZeigen(wieder); else rahmenVerstecken();
      melden({ typ: 'ez-geaendert' });
    }
    if (e.data.typ === 'ez-loeschen' && aktiv) elementLoeschen(aktiv);
    if (e.data.typ === 'ez-taste' && aktiv) {
      const b = aktiv.closest('.ezblock[data-block]');
      if (e.data.taste === 'loeschen' && !aktiv.hasAttribute('data-ez-menue')) elementLoeschen(aktiv);
      if (e.data.taste === 'duplizieren' && b) blockDuplizieren(b.dataset.block);
      if (e.data.taste === 'hoch' && b) blockVerschieben(b.dataset.block, -1);
      if (e.data.taste === 'runter' && b) blockVerschieben(b.dataset.block, 1);
      if (e.data.taste === 'esc') rahmenVerstecken();
    }
    if (e.data.typ === 'ez-taste' && e.data.taste === 'zurueck') rueckgaengig();
    if (e.data.typ === 'ez-taste' && e.data.taste === 'vor') wiederholen();
    if (e.data.typ === 'ez-wiederherstellen') blockWiederherstellen();
    if (e.data.typ === 'ez-anim' && aktiv) {
      animSetzen('anim.' + schluesselVon(aktiv), e.data.wie);
      melden({ typ: 'ez-geaendert' });
    }
    if (e.data.typ === 'ez-einpassen' && aktiv) {
      einpassenSetzen('einpassen.' + schluesselVon(aktiv), e.data.wie);
      melden({ typ: 'ez-geaendert' });
      melden(auswahlInfo(aktiv));
    }
    if (e.data.typ === 'ez-ausschnitt' && aktiv) {
      ausschnittSetzen('ausschnitt.' + schluesselVon(aktiv), e.data.wie);
      melden({ typ: 'ez-geaendert' });
    }
    if (e.data.typ === 'ez-format-kopieren' && aktiv) formatKopieren(schluesselVon(aktiv));
    if (e.data.typ === 'ez-format-einfuegen' && aktiv) formatEinfuegen(schluesselVon(aktiv));
    if (e.data.typ === 'ez-abschnitt-waehlen' && aktiv) {
      const b = aktiv.closest('.ezblock[data-block]') || abschnittVon(aktiv);
      if (b && b.classList.contains('ezblock')) rahmenZeigen(b);
      else melden({ typ: 'ez-hinweis', text: 'Feste Abschnitte der Seite lassen sich nicht als Ganzes verschieben – nur hinzugefügte.' });
    }
    if (e.data.typ === 'ez-farbe' && aktiv) {
      const k = schluesselVon(aktiv);
      farbeSetzen('farbe.' + k, e.data.farbe);
      melden({ typ: 'ez-geaendert' });
    }
    if (e.data.typ === 'ez-block-duplizieren' && aktiv) {
      const b = aktiv.closest('.ezblock[data-block]');
      if (b) blockDuplizieren(b.dataset.block);
    }
    if (e.data.typ === 'ez-bild-oeffnen-aktiv') {
      if (!aktiv || !(aktiv.hasAttribute('data-ez-img') || aktiv.hasAttribute('data-ez-bg'))) {
        return melden({ typ: 'ez-hinweis', text: 'Bitte zuerst ein Bild anklicken.' });
      }
      melden({ typ: 'ez-bild-waehlen', feld: schluessel(aktiv), video: !!e.data.video });
    }
    if (e.data.typ === 'ez-block-verschieben' && aktiv) {
      const b = aktiv.closest('.ezblock[data-block]');
      if (b) blockVerschieben(b.dataset.block, e.data.richtung);
    }
    if (e.data.typ === 'ez-befehl') fuehreAus(e.data.befehl, e.data.wert);
    if (e.data.typ === 'ez-ausricht') {
      const el = zielElement();
      if (!el) return melden({ typ: 'ez-hinweis', text: 'Bitte zuerst ein Element anklicken.' });
      ausrichten(schluesselVon(el), e.data.wie);
    }
    if (e.data.typ === 'ez-zuruecksetzen') {
      const el = zielElement();
      if (!el) return melden({ typ: 'ez-hinweis', text: 'Bitte zuerst ein Element anklicken.' });
      zuruecksetzen(schluesselVon(el), e.data.was || 'alles');
    }
    if (e.data.typ === 'ez-modus') setzeModus(e.data.modus);
    if (e.data.typ === 'ez-schrift') {
      const el = zielElement();
      if (!el) return melden({ typ: 'ez-hinweis', text: 'Bitte zuerst einen Text anklicken.' });
      schriftSetzen('schrift.' + schluesselVon(el), e.data.schrift);
      melden({ typ: 'ez-geaendert' });
    }
    if (e.data.typ === 'ez-groesse') {
      const el = zielElement();
      if (!el) return melden({ typ: 'ez-hinweis', text: 'Bitte zuerst einen Text anklicken.' });
      const k = schluesselVon(el);
      const jetzt = groesseWerte[k] || parseFloat(getComputedStyle(el).fontSize) || 16;
      const neu = Math.max(9, Math.min(160, Math.round(jetzt + e.data.schritt * 2)));
      groesseWerte[k] = neu;
      elementeZu(k).forEach((x) => { x.style.fontSize = neu + 'px'; });
      melden({ typ: 'ez-geaendert' });
      melden({ typ: 'ez-groesse-ist', px: neu });
    }
    if (e.data.typ === 'ez-schriften') {
      /* Welche Schrift die Seite ohne Einstellung benutzt - damit der Editor
         statt "Standardschrift" den echten Namen zeigen kann. */
      const erste = (el) => el ? (getComputedStyle(el).fontFamily.split(',')[0] || '').replace(/["']/g, '').trim() : '';
      /* Die Farben, wie die Seite sie gerade zeigt - fuer die Farbwaehler. */
      const hex = (c) => {
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(c || '');
        if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return '';
        return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
      };
      const stil = (sel, eig) => { const el = document.querySelector(sel); return el ? hex(getComputedStyle(el)[eig]) : ''; };
      const varFarbe = (name) => { const t = document.createElement('i'); t.style.color = `var(${DESIGN_VAR[name]})`; document.body.appendChild(t); const c = hex(getComputedStyle(t).color); t.remove(); return c; };
      melden({ typ: 'ez-schriftliste', liste:
        Object.entries(SCHRIFTEN).map(([id, f]) => ({ id, name: f.name, stapel: f.stapel, google: f.google })),
        standard: { titel: erste(document.querySelector('main h1, main h2, section h2, h1, h2')), text: erste(document.querySelector('main p, section p, p')) },
        farben: { ...FARBEN },
        farbwerte: {
          akzent: varFarbe('akzent'), textfarbe: varFarbe('textfarbe'),
          titelfarbe: stil('section h2, main h2, h2', 'color'),
          kopffarbe: stil('#siteNav', 'backgroundColor') || '#ffffff',
          menufarbe: stil('#navlinks a:not(.navcta)', 'color'),
          fussfarbe: stil('#siteFoot', 'backgroundColor'),
          fussschrift: stil('#siteFoot p', 'color')
        } });
    }
    if (e.data.typ === 'ez-setzen') { setzen(e.data.feld, e.data.wert); standMerken(); }
    /* Nach dem Speichern ist der gespeicherte Stand die neue Grundlage -
       sonst wuerde der naechste Speichervorgang von der Fassung beim Laden
       ausgehen und laengst Getauschtes (etwa Bilder) zurueckholen. */
    if (e.data.typ === 'ez-gespeichert' && e.data.werte) geladeneWerte = { ...e.data.werte };
    if (e.data.typ === 'ez-rueckgaengig') rueckgaengig();
    if (e.data.typ === 'ez-wiederholen') wiederholen();
    if (e.data.typ === 'ez-sammeln') {
      /* ---- Was wird gespeichert? ----
         Am grossen Bildschirm die normalen Felder. Am Telefon dieselben
         Felder mit dem Praefix "m." - dadurch bleibt der Desktop unberuehrt.
         Gesendet wird immer der vollstaendige Satz: alles, was in der
         Datenbank stand, plus die Aenderungen dieser Sitzung. */
      const jetzt = jetztSammeln();
      const blockJson = jetzt.bloecke || '';
      delete jetzt.bloecke;
      sammelnAbschliessen(jetzt, blockJson, e.data.mobilMit);
    }
  });

  /* Der komplette Stand dieser Ansicht als Feldliste - Grundlage fuers
     Speichern und fuer Rueckgaengig. */
  function jetztSammeln() {
      const jetzt = {};
      document.querySelectorAll('[data-ez], [data-ez-img], [data-ez-bg]').forEach((el) => {
        const k = schluessel(el);
        const v = wert(el);
        if (v !== standard[k]) jetzt[k] = v;
      });
      document.querySelectorAll('[data-ez-link]').forEach((el) => {
        const k = el.getAttribute('data-ez-link');
        const v = el.getAttribute('href') || '';
        if (v !== standard[k]) jetzt[k] = v;
      });
      document.querySelectorAll('a[data-ez]:not([data-ez-link])').forEach((el) => {
        const k = 'link.' + el.getAttribute('data-ez');
        const v = el.getAttribute('href') || '';
        if (standard[k] !== undefined && v !== standard[k]) jetzt[k] = v;
      });
      /* Die Blockliste gilt fuer beide Ansichten gemeinsam. */
      if (bloecke.length) jetzt.bloecke = JSON.stringify(bloecke);
      /* Ausgeblendete Elemente ebenso. */
      for (const k of verstecktWerte) jetzt['versteckt.' + k] = '1';
      for (const [b, a] of Object.entries(ankerWerte)) jetzt['anker.' + b] = JSON.stringify(a);
      /* Galerie-Einstellungen (nur, wenn sie vom Standard abweichen). */
      for (const b of bloecke) {
        const j = galerieOptJson(b.id);
        if (j) jetzt[`block.${b.id}.opt`] = j;
      }
      const praefix = istHandy() ? 'stilm.' : 'stil.';
      for (const [k, st0] of Object.entries(stilWerte)) {
        const st = { ...LEER, ...st0 };
        if (st.dx || st.dy || st.skala !== 1 || st.breite || st.hoehe) {
          jetzt[praefix + k] = `${st.dx},${st.dy},${st.skala},${st.breite},${st.hoehe}`;
        }
      }
      const sp = istHandy() ? 'schriftm.' : 'schrift.';
      for (const [k, id] of Object.entries(schriftWerte)) jetzt[sp + k] = id;
      const gp = istHandy() ? 'groessem.' : 'groesse.';
      for (const [k, px] of Object.entries(groesseWerte)) jetzt[gp + k] = String(px);
      const ap = istHandy() ? 'ausrichtm.' : 'ausricht.';
      for (const [k, wie] of Object.entries(ausrichtWerte)) jetzt[ap + k] = wie;
      for (const [k, f] of Object.entries(farbeWerte)) jetzt['farbe.' + k] = f;
      for (const [k, w] of Object.entries(ausschnittWerte)) jetzt['ausschnitt.' + k] = w;
      for (const [k, w] of Object.entries(einpassenWerte)) jetzt['einpassen.' + k] = w;
      for (const [k, w] of Object.entries(animWerte)) jetzt['anim.' + k] = w;
      for (const [k, v] of Object.entries(designWerte)) jetzt['global.design.' + k] = v;
      if (JSON.stringify(menueDaten) !== JSON.stringify(MENUE_STANDARD)) jetzt['global.menue'] = JSON.stringify(menueDaten);
      return jetzt;
  }

  /* Ein Bildfeld? Bilder folgen dem Desktop, solange das Telefon kein
     eigenes hat - ein getauschtes Foto soll nirgends alt bleiben. */
  const istBildFeld = (k) => !!document.querySelector(`[data-ez-img="${CSS.escape(k)}"], [data-ez-bg="${CSS.escape(k)}"]`);

  function sammelnAbschliessen(jetzt, blockJson, mobilMit) {
      /* Der bisherige Stand ohne die Felder, die zu dieser Ansicht gehoeren. */
      const gehoertHierher = (k) => istHandy()
        ? (k.startsWith('m.') || k.startsWith('stilm.') || k.startsWith('groessem.')
           || k.startsWith('schriftm.') || k.startsWith('ausrichtm.'))
        : !(k.startsWith('m.') || k.startsWith('stilm.') || k.startsWith('groessem.')
           || k.startsWith('schriftm.') || k.startsWith('ausrichtm.'));

      const werte = {};
      for (const [k, v] of Object.entries(geladeneWerte)) {
        if (!gehoertHierher(k) || k === 'bloecke') werte[k] = v;
      }
      /* Ausgeblendetes wird neu aus dem aktuellen Stand geschrieben. */
      for (const k of Object.keys(werte)) if (k.startsWith('versteckt.') || k.startsWith('farbe.') || k.startsWith('ausschnitt.') || k.startsWith('einpassen.') || k.startsWith('anim.') || k.startsWith('anker.') || k.startsWith('global.design.') || k === 'global.menue') delete werte[k];

      const geaendert = [];
      if (blockJson) werte.bloecke = blockJson; else delete werte.bloecke;
      if (blockJson !== (geladeneWerte.bloecke || '')) geaendert.push('bloecke');

      if (istHandy()) {
        /* Am Telefon zaehlt nur, was vom Desktopwert abweicht. */
        for (const [k, v] of Object.entries(jetzt)) {
          const basis = k.includes('.') && /^(stilm|groessem|schriftm|ausrichtm)\./.test(k)
            ? null : k;
          if (k.startsWith('versteckt.') || k.startsWith('farbe.') || k.startsWith('ausschnitt.') || k.startsWith('einpassen.') || k.startsWith('anim.') || k.startsWith('anker.') || k.startsWith('global.design.') || k === 'global.menue') { werte[k] = v; geaendert.push(k); continue; }
          if (basis !== null) {
            const desktop = geladeneWerte[k] ?? standard[k];
            if (v === desktop) continue;
            werte['m.' + k] = v;
          } else {
            werte[k] = v;
          }
          geaendert.push(k);
        }
      } else {
        for (const [k, v] of Object.entries(jetzt)) {
          werte[k] = v;
          if (v !== geladeneWerte[k]) geaendert.push(k);
        }
        /* Felder, die es vorher gab und jetzt nicht mehr (auf Standard
           zurueckgesetzt), gelten ebenfalls als geaendert. */
        for (const k of Object.keys(geladeneWerte)) {
          if (k !== 'bloecke' && gehoertHierher(k) && !(k in jetzt)) geaendert.push(k);
        }
      }

      /* mobilMit === false: der bisherige Handy-Stand wird festgehalten,
         damit die Desktopaenderung dort nicht durchschlaegt.
         mobilMit === true: die Handy-Sonderwerte fallen weg, das Telefon
         folgt wieder dem Desktop. */
      if (!istHandy() && mobilMit === false) {
        for (const k of geaendert) {
          if (k === 'bloecke' || k === 'global.menue' || k.startsWith('versteckt.') || k.startsWith('farbe.') || k.startsWith('ausschnitt.') || k.startsWith('einpassen.') || k.startsWith('anim.') || k.startsWith('anker.') || k.startsWith('global.design.') || k.startsWith('stil.') || k.startsWith('groesse.')
              || k.startsWith('schrift.') || k.startsWith('ausricht.')) continue;
          /* Ein getauschtes Bild gilt immer auch am Telefon - Fotos werden
             nie zwischen den Ansichten getrennt, sonst bleibt irgendwo das
             alte stehen. */
          if (istBildFeld(k)) { delete werte['m.' + k]; continue; }
          const vorher = geladeneWerte['m.' + k] ?? geladeneWerte[k] ?? standard[k];
          if (vorher !== undefined && vorher !== null) werte['m.' + k] = vorher;
        }
      }
      if (!istHandy() && mobilMit === true) {
        for (const k of geaendert) delete werte['m.' + k];
      }

      /* Reste geloeschter Bloecke fallen weg - egal aus welcher Ansicht. */
      const blockIds = new Set(bloecke.map((b) => b.id));
      for (const k of Object.keys(werte)) {
        const m = /(?:^|\.)block\.([a-z0-9]+)\./.exec(k);
        if (m && !blockIds.has(m[1])) delete werte[k];
        const an = /^anker\.(b[a-z0-9]+)$/.exec(k);
        if (an && !blockIds.has(an[1]) && !document.querySelector(`[data-ez="${CSS.escape(an[1])}"]`)) delete werte[k];
      }
      melden({ typ: 'ez-werte', werte, geaendert, handy: istHandy() });
  }

  /* ---- Rueckgaengig / Wiederholen ----
     Nach jeder Aenderung wird der komplette Stand der Seite festgehalten -
     dieselbe Feldliste wie beim Speichern. Rueckgaengig stellt den vorigen
     Stand wieder her: Texte, Bilder, Bloecke, Lage, Schrift, Farben, Menue.
     Tippen in einem Text wird zu einem Schritt zusammengefasst. */
  let verlauf = [];          // fruehere Staende, der letzte ist der jetzige
  let wieder = [];           // durch Rueckgaengig verlassene Staende
  let verlaufTimer = null;
  let stelltHer = false;
  const verlaufMelden = () => melden({ typ: 'ez-verlauf', zurueck: verlauf.length > 1, vor: wieder.length > 0 });
  function standMerken(sofort) {
    if (stelltHer) return;
    clearTimeout(verlaufTimer);
    const festhalten = () => {
      const st = JSON.stringify(jetztSammeln());
      if (verlauf.length && verlauf[verlauf.length - 1] === st) return;
      verlauf.push(st);
      if (verlauf.length > 80) verlauf.shift();
      wieder = [];
      verlaufMelden();
    };
    if (sofort) festhalten(); else verlaufTimer = setTimeout(festhalten, 500);
  }
  function verlaufNeu() {
    clearTimeout(verlaufTimer);
    verlauf = [JSON.stringify(jetztSammeln())]; wieder = [];
    verlaufMelden();
  }
  function rueckgaengig() {
    clearTimeout(verlaufTimer);
    /* Eine noch nicht festgehaltene Aenderung zuerst sichern, damit sie
       nicht mit dem vorigen Schritt verschmilzt. */
    const jetzt = JSON.stringify(jetztSammeln());
    if (verlauf.length && verlauf[verlauf.length - 1] !== jetzt) { verlauf.push(jetzt); wieder = []; }
    if (verlauf.length < 2) { verlaufMelden(); return; }
    wieder.push(verlauf.pop());
    standAnwenden(verlauf[verlauf.length - 1]);
  }
  function wiederholen() {
    if (!wieder.length) return;
    const st = wieder.pop();
    verlauf.push(st);
    standAnwenden(st);
  }
  /* Einen festgehaltenen Stand wieder auf die Seite legen. */
  function standAnwenden(json) {
    let stand = {};
    try { stand = JSON.parse(json) || {}; } catch { return; }
    stelltHer = true;
    clearTimeout(verlaufTimer);
    menueSchliessen(); rahmenVerstecken();
    /* 1. Alles Formatierte loeschen. */
    const alleK = new Set([...Object.keys(stilWerte), ...Object.keys(schriftWerte), ...Object.keys(groesseWerte),
      ...Object.keys(ausrichtWerte), ...Object.keys(farbeWerte), ...Object.keys(ausschnittWerte), ...Object.keys(einpassenWerte), ...Object.keys(animWerte), ...verstecktWerte]);
    for (const k of alleK) {
      delete stilWerte[k]; delete schriftWerte[k]; delete groesseWerte[k]; delete ausrichtWerte[k];
      delete farbeWerte[k]; delete ausschnittWerte[k]; delete einpassenWerte[k]; delete animWerte[k]; verstecktWerte.delete(k);
      elementeZu(k).forEach((x) => {
        x.style.transform = ''; x.style.width = ''; x.style.height = ''; x.style.fontFamily = ''; x.style.fontSize = '';
        x.style.textAlign = ''; x.style.color = ''; x.style.objectFit = ''; x.style.backgroundSize = ''; x.style.backgroundRepeat = ''; x.style.objectPosition = ''; x.style.backgroundPosition = '';
        x.classList.remove('ez-versteckt');
      });
    }
    for (const k of Object.keys(ankerWerte)) delete ankerWerte[k];
    for (const k of Object.keys(blockOpts)) delete blockOpts[k];
    /* 2. Bloecke samt Einstellungen neu aufbauen. */
    for (const [k, v] of Object.entries(stand)) {
      const g = /^block\.([a-z0-9]+)\.opt$/i.exec(k);
      if (g) galerieOptSetzen(g[1], v);
    }
    bloeckeSetzen(stand.bloecke || '');
    /* 3. Feste Felder der Seite: Wert aus dem Stand, sonst der Standard. */
    document.querySelectorAll('[data-ez], [data-ez-img], [data-ez-bg]').forEach((el) => {
      const k = schluessel(el);
      if (k.startsWith('block.')) return;
      const v = stand[k] !== undefined ? stand[k] : standard[k];
      if (v !== undefined && wert(el) !== v) setzen(k, v);
    });
    document.querySelectorAll('[data-ez-link]').forEach((el) => {
      const k = el.getAttribute('data-ez-link');
      if (k.startsWith('link.block.')) return;
      const v = stand[k] !== undefined ? stand[k] : standard[k];
      if (v !== undefined) setzen(k, v);
    });
    document.querySelectorAll('a[data-ez]:not([data-ez-link])').forEach((el) => {
      const k = 'link.' + el.getAttribute('data-ez');
      if (standard[k] !== undefined) setzen(k, stand[k] !== undefined ? stand[k] : standard[k]);
    });
    /* 4. Alles Uebrige: Blockfelder, Lage, Schrift, Farben, Anker, Design, Menue. */
    const design = {};
    for (const [k, v] of Object.entries(stand)) {
      if (k === 'bloecke' || /^block\.[a-z0-9]+\.opt$/i.test(k)) continue;
      if (k.startsWith('global.design.')) { design[k.slice(14)] = v; continue; }
      if (k === 'global.menue') continue;
      setzen(k, v);
    }
    designAlleSetzen(design, null);
    menueSetzen(stand['global.menue'] || '');
    document.querySelectorAll('[data-ez], [data-ez-img], [data-ez-bg]').forEach(elementEinrichten);
    plusLeisten();
    melden({ typ: 'ez-geaendert' });
    melden({ typ: 'ez-design-werte', werte: { ...designWerte }, menue: menueDaten.map((x) => ({ ...x })) });
    melden({ typ: 'ez-anker-liste', seite: location.pathname, liste: ankerListe() });
    stelltHer = false;
    verlaufMelden();
  }

  geladen.then(() => setTimeout(starten, 60));
})();
})();
