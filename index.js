/* ====== EZ Websitebuilder – Server-Modul ======================================
   Alles, was der Website-Editor auf dem Server braucht, in einem Modul:
   Seiteninhalte, Bilder, Videos, Sprungmarken, Formulare, die Editor-Seite
   und das Einbauen gespeicherter Inhalte in die Gaesteseiten.

   Einbinden (siehe README.md):
     import { mountBuilder, ladeKonfiguration } from 'ez-websitebuilder';
     const builder = mountBuilder(app, {
       config: ladeKonfiguration('./site.config.json'),
       store, publicDir: './public', requireStaff, sendMail
     });
   Aufrufen, bevor express.static fuer den public-Ordner registriert wird -
   sonst liefert der Dateiserver die Seiten ohne eingebaute Inhalte aus.

   Die HTML-Dateien bleiben die Quelle der Wahrheit: Was dort steht, ist der
   Standard. Der Editor speichert nur Abweichungen je Seite; Felder mit dem
   Praefix "global." (Kopf- und Fusszeile, Design, Menue) gelten fuer alle
   Seiten und liegen in einem eigenen Satz "_global".                    */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HIER, 'client');

export function ladeKonfiguration(datei) {
  const roh = JSON.parse(fs.readFileSync(datei, 'utf8'));
  if (!Array.isArray(roh.seiten) || !roh.seiten.length) throw new Error('site.config.json: "seiten" fehlt');
  return roh;
}

const clean = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/* Erlaubt Formatierungen aus dem Editor, entfernt alles Ausfuehrbare. */
export function sanitizeRichHtml(html) {
  let s = String(html || '').slice(0, 20000);
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/javascript:/gi, '');
  return s;
}

/* Felder, die reiner Text sind (Bildquelle, Lage, Schrift, Link, JSON ...).
   Alles andere ist Rich-Text und wird bereinigt. */
const TEXTFELD = /^(bild\.|hg\.|stil|schrift|groesse|ausricht|link\.|farbe\.|versteckt\.|ausschnitt\.|einpassen\.|anim\.|anker\.|global\.design\.|global\.menue$)/;
/* Ein Feld der Kopf- oder Fusszeile gilt fuer alle Seiten - auch Lage,
   Schrift, Farbe usw. dieser Elemente. */
const GLOBAL = /^(m\.)?(global\.|(stil|stilm|schrift|schriftm|groesse|groessem|ausricht|ausrichtm|farbe|ausschnitt|einpassen|anim|versteckt)\.global\.)/;
export const istGlobal = (k) => GLOBAL.test(k);

export function mountBuilder(app, opts) {
  const { config, store, requireStaff } = opts;
  const publicDir = path.resolve(opts.publicDir || 'public');
  const ed = config.editor || {};
  const PAGES = config.seiten.map((s) => ({ slug: s.slug, pfad: s.pfad, titel: s.titel, datei: s.datei || s.slug + '.html' }));
  const PAGE_SLUGS = new Set(PAGES.map((p) => p.slug));
  const MAX_FIELDS = 240;
  const beimSpeichern = typeof opts.beimSpeichern === 'function' ? opts.beimSpeichern : null;

  function cleanFields(body) {
    const out = {};
    let n = 0;
    for (const [k, v] of Object.entries(body || {})) {
      if (++n > MAX_FIELDS) break;
      if (!/^[a-z0-9][a-z0-9._-]{0,60}$/i.test(k)) continue;
      if (typeof v !== 'string') continue;
      /* Die Handy-Fassung eines Feldes traegt das Praefix "m.". */
      const art = k.startsWith('m.') ? k.slice(2) : k;
      if (art === 'bloecke') {
        try {
          const liste = JSON.parse(v);
          if (!Array.isArray(liste)) continue;
          out[k] = JSON.stringify(liste.slice(0, 60).map((b) => ({
            id: clean(b?.id, 24).replace(/[^a-z0-9]/gi, ''),
            art: clean(b?.art, 20),
            nach: clean(b?.nach, 80)
          })).filter((b) => b.id && b.art));
        } catch { /* kaputt - weglassen */ }
        continue;
      }
      if (art === 'global.menue') { out[k] = clean(v, 4000); continue; }
      if (/^block\.[a-z0-9]+\.opt$/i.test(art)) { out[k] = clean(v, 4000); continue; }
      out[k] = TEXTFELD.test(art) || /^block\.[a-z0-9]+\.(bild|g[0-9]+)$/i.test(art)
        ? clean(v, 400)
        : sanitizeRichHtml(v);
    }
    return out;
  }

  const hatGlobales = async () => {
    const g = await store.getPage('_global').catch(() => ({}));
    return g && Object.keys(g).length > 0;
  };
  const felderFuer = async (slug) => {
    const [eigen, global] = await Promise.all([
      store.getPage(slug), store.getPage('_global').catch(() => ({}))]);
    return { ...(global || {}), ...(eigen || {}) };
  };

  /* ---------------- Seiten ---------------- */
  app.get('/api/builder/config', requireStaff, (req, res) => {
    res.json({ name: config.name || '', seiten: PAGES, editor: {
      titel: ed.titel || 'Website bearbeiten', zurueck: ed.zurueck || null, plugins: ed.plugins || [] } });
  });

  app.get('/api/pages', requireStaff, async (req, res) => {
    const gespeichert = new Map((await store.listPages()).map((p) => [p.slug, p.updatedAt]));
    res.json({ pages: PAGES.map((p) => ({ slug: p.slug, pfad: p.pfad, titel: p.titel, updatedAt: gespeichert.get(p.slug) || null })) });
  });

  app.get('/api/pages/:slug', requireStaff, async (req, res) => {
    if (!PAGE_SLUGS.has(req.params.slug)) return res.status(404).json({ error: 'Unbekannte Seite' });
    res.json({ slug: req.params.slug, fields: await store.getPage(req.params.slug) });
  });

  app.put('/api/pages/:slug', requireStaff, async (req, res) => {
    if (!PAGE_SLUGS.has(req.params.slug)) return res.status(404).json({ error: 'Unbekannte Seite' });
    const fields = cleanFields(req.body?.fields);
    /* Die Website darf einzelne Felder selbst ablegen (etwa eine Speisekarte,
       die auch anderswo gebraucht wird) - sie entfernt sie dann aus der Liste. */
    if (beimSpeichern) await beimSpeichern(req.params.slug, fields);
    const global = {}, eigen = {};
    for (const [k, v] of Object.entries(fields)) (istGlobal(k) ? global : eigen)[k] = v;
    if (Object.keys(global).length || await hatGlobales()) await store.savePage('_global', global);
    await store.savePage(req.params.slug, eigen);
    res.json({ ok: true, fields });
  });

  app.get('/api/public/pages/:slug', async (req, res) => {
    if (!PAGE_SLUGS.has(req.params.slug)) return res.json({ fields: {} });
    res.set('Cache-Control', 'no-cache');
    res.json({ fields: await felderFuer(req.params.slug) });
  });

  /* ---------------- Sprungmarken (Anker) ----------------
     Die festen Abschnitte aus den Seitendateien (section mit id) plus die im
     Editor gesetzten - fuer die Zielauswahl bei Menue, Buttons und Links. */
  const ohneTags = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  function festeAnker(html) {
    const liste = [];
    const re = /<section\b[^>]*\bid="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/section>/g;
    let m;
    while ((m = re.exec(html))) {
      const kopf = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(m[2]);
      let titel = (kopf ? ohneTags(kopf[1]) : '').slice(0, 40) || m[1];
      if (titel === titel.toUpperCase()) titel = titel.charAt(0) + titel.slice(1).toLowerCase();
      liste.push({ name: m[1], titel, fest: true });
    }
    return liste;
  }
  app.get('/api/anker', requireStaff, async (req, res) => {
    const anker = [];
    for (const seite of PAGES) {
      let html = '';
      try { html = await fs.promises.readFile(path.join(publicDir, seite.datei), 'utf8'); } catch { /* keine Datei */ }
      const eigene = [];
      try {
        for (const [k, v] of Object.entries(await store.getPage(seite.slug) || {})) {
          if (!k.startsWith('anker.')) continue;
          try { const a = JSON.parse(v); if (a && a.name) eigene.push({ name: clean(a.name, 40), titel: clean(a.titel, 60) || clean(a.name, 40) }); } catch { /* kaputt */ }
        }
      } catch { /* nichts gespeichert */ }
      const gesehen = new Set();
      for (const a of [...eigene, ...festeAnker(html)]) {
        if (gesehen.has(a.name)) continue;
        gesehen.add(a.name);
        anker.push({ seite: seite.pfad, seitentitel: seite.titel, ...a });
      }
    }
    res.json({ anker });
  });

  /* ---------------- Bilder ----------------
     Der Editor verkleinert im Browser und schickt eine Data-URL. */
  const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const MAX_IMG_BYTES = 8 * 1024 * 1024;
  app.post('/api/images', requireStaff, express.json({ limit: '14mb' }), async (req, res) => {
    const m = /^data:([a-z/+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ''));
    if (!m) return res.status(400).json({ error: 'Kein gültiges Bild.' });
    if (!IMG_TYPES[m[1]]) return res.status(415).json({ error: 'Erlaubt sind JPG, PNG und WebP.' });
    const bytes = Buffer.from(m[2], 'base64');
    if (!bytes.length) return res.status(400).json({ error: 'Kein gültiges Bild.' });
    if (bytes.length > MAX_IMG_BYTES) return res.status(413).json({ error: 'Das Bild ist zu groß (max. 8 MB).' });
    const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + IMG_TYPES[m[1]];
    await store.saveImage(id, m[1], bytes, clean(req.body?.name, 120));
    res.status(201).json({ ok: true, id, url: '/img/db/' + id });
  });
  app.get('/api/images', requireStaff, async (req, res) => {
    res.json({ images: (await store.listImages())
      .filter((i) => String(i.mime || '').startsWith('image/'))
      .map((i) => ({ ...i, url: '/img/db/' + i.id })) });
  });
  app.delete('/api/images/:id', requireStaff, async (req, res) => {
    await store.deleteImage(req.params.id);
    res.json({ ok: true });
  });
  app.get('/img/db/:id', async (req, res) => {
    const img = await store.getImage(req.params.id);
    if (!img) return res.status(404).end();
    /* Der Dateiname aendert sich bei jedem Upload, der Inhalt nie. */
    res.set('Content-Type', img.mime);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(img.bytes);
  });

  /* ---------------- Videos ----------------
     Roh hochgeladen (spart ein Drittel), ausgeliefert mit Bereichsanfragen -
     ohne die spielt Safari kein Video ab. */
  const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
  const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
  const videoCache = new Map();
  const VIDEO_CACHE_MAX = 4;
  app.post('/api/videos', requireStaff, express.raw({ type: Object.keys(VIDEO_TYPES), limit: '42mb' }), async (req, res) => {
    const mime = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!VIDEO_TYPES[mime]) return res.status(415).json({ error: 'Erlaubt sind MP4, WebM und MOV.' });
    const bytes = Buffer.isBuffer(req.body) ? req.body : null;
    if (!bytes || !bytes.length) return res.status(400).json({ error: 'Die Datei ist leer.' });
    if (bytes.length > MAX_VIDEO_BYTES) return res.status(413).json({ error: 'Das Video ist zu groß (höchstens 40 MB).' });
    let name = '';
    try { name = decodeURIComponent(req.get('x-datei-name') || ''); } catch { name = ''; }
    const id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.' + VIDEO_TYPES[mime];
    await store.saveImage(id, mime, bytes, clean(name, 120));
    res.status(201).json({ ok: true, id, url: '/video/db/' + id, size: bytes.length });
  });
  app.get('/api/videos', requireStaff, async (req, res) => {
    res.json({ videos: (await store.listImages())
      .filter((i) => String(i.mime || '').startsWith('video/'))
      .map((i) => ({ ...i, url: '/video/db/' + i.id })) });
  });
  app.get('/video/db/:id', async (req, res) => {
    const id = req.params.id;
    let v = videoCache.get(id);
    if (!v) {
      v = await store.getImage(id);
      if (!v || !String(v.mime || '').startsWith('video/')) return res.status(404).end();
      if (videoCache.size >= VIDEO_CACHE_MAX) videoCache.delete(videoCache.keys().next().value);
      videoCache.set(id, v);
    }
    const gesamt = v.bytes.length;
    res.set('Content-Type', v.mime);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    const bereich = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') || '');
    if (!bereich) { res.set('Content-Length', String(gesamt)); return res.end(v.bytes); }
    const von = bereich[1] === '' ? Math.max(0, gesamt - Number(bereich[2])) : Number(bereich[1]);
    const bis = bereich[2] === '' || bereich[1] === '' ? gesamt - 1 : Math.min(Number(bereich[2]), gesamt - 1);
    if (!Number.isFinite(von) || !Number.isFinite(bis) || von > bis || von >= gesamt) {
      res.set('Content-Range', `bytes */${gesamt}`);
      return res.status(416).end();
    }
    res.status(206);
    res.set('Content-Range', `bytes ${von}-${bis}/${gesamt}`);
    res.set('Content-Length', String(bis - von + 1));
    res.end(v.bytes.subarray(von, bis + 1));
  });
  app.delete('/api/videos/:id', requireStaff, async (req, res) => {
    videoCache.delete(req.params.id);
    await store.deleteImage(req.params.id);
    res.json({ ok: true });
  });

  /* ---------------- Formulare aus dem Editor ----------------
     Ein Formular-Block schickt seine Felder als Liste. Die Nachricht geht an
     config.formulare.an (oder opts.formularAn). Ohne Mailversand landet sie
     im Protokoll. */
  const formularTreffer = new Map();
  const formularAn = opts.formularAn || config.formulare?.an || '';
  app.post('/api/builder/formular', express.json({ limit: '64kb' }), async (req, res) => {
    const b = req.body || {};
    if (clean(b.hp, 40)) return res.json({ ok: true });              // Honigtopf
    const ip = req.get('x-forwarded-for') || req.ip || 'x';
    const jetzt = Date.now();
    const treffer = (formularTreffer.get(ip) || []).filter((t) => jetzt - t < 3600000);
    if (treffer.length >= 6) return res.status(429).json({ error: 'Zu viele Anfragen – bitte später erneut versuchen.' });
    treffer.push(jetzt); formularTreffer.set(ip, treffer);
    const felder = (Array.isArray(b.felder) ? b.felder : []).slice(0, 20)
      .map((f) => [clean(f?.label, 80), clean(f?.wert, 2000)]).filter(([k]) => k);
    if (!felder.some(([, v]) => v)) return res.status(400).json({ error: 'Bitte fülle das Formular aus.' });
    const email = clean(b.email, 120);
    if (email && !/.+@.+\..+/.test(email)) return res.status(400).json({ error: 'Bitte gib eine gültige E-Mail-Adresse an.' });
    const betreff = clean(b.subject, 140) || 'Nachricht über die Website';
    const html = `<p><b>Neue Nachricht über das Formular „${escHtml(betreff)}“</b></p>`
      + felder.map(([k, v]) => `<p style="margin:0"><b>${escHtml(k)}:</b> ${escHtml(v)}</p>`).join('');
    if (!opts.sendMail || !formularAn) {
      console.log('[formular]', betreff, JSON.stringify(felder));
      return res.json({ ok: true });
    }
    const out = await opts.sendMail({
      to: formularAn, subject: `Website: ${betreff}`,
      html: opts.wrapMail ? opts.wrapMail(html, config.name || '') : html, replyTo: email || undefined
    });
    if (!out?.ok && !out?.skipped) return res.status(500).json({ error: 'Die Nachricht konnte nicht gesendet werden. Bitte schreib uns direkt an ' + formularAn + '.' });
    if (out?.skipped) console.log('[formular]', betreff, JSON.stringify(felder));
    res.json({ ok: true });
  });

  /* ---------------- Editor und Bausteine ausliefern ----------------
     Die Dateien des Builders liegen in client/ und sind unter
     /builder/... erreichbar. Die Editor-Seite bekommt Titel und Ruecksprung
     aus der Konfiguration; alle Skripte und Stile eine Kennung der Fassung,
     damit nach dem Aufspielen jeder Browser die neue Datei laedt. */
  const FASSUNG = opts.fassung || Date.now().toString(36);
  const mitFassung = (html) => html.replace(/(href|src)="(\/(?:css|js|builder)\/[^"?]+)"/g, `$1="$2?v=${FASSUNG}"`);
  app.use('/builder', express.static(CLIENT, { setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
  app.get(ed.pfad || '/website', (req, res) => {
    fs.readFile(path.join(CLIENT, 'editor.html'), 'utf8', (err, html) => {
      if (err) return res.status(404).send('Nicht gefunden');
      const z = ed.zurueck || {};
      const ersetzt = html
        .replace(/\{\{titel\}\}/g, escHtml(ed.titel || 'Website bearbeiten'))
        .replace(/\{\{name\}\}/g, escHtml(config.name || ''))
        .replace(/\{\{zurueckLink\}\}/g, escHtml(z.link || '/'))
        .replace(/\{\{zurueckText\}\}/g, escHtml(z.text || 'Zurück'))
        .replace(/\{\{icon\}\}/g, escHtml(ed.icon || '/builder/icon.svg'))
        .replace(/\{\{login\}\}/g, escHtml(ed.login || z.link || '/'))
        .replace('<!--plugins-->', (ed.plugins || []).map((p) => `<script type="module" src="${escHtml(p)}"></script>`).join('\n'));
      res.set('Cache-Control', 'no-store');
      res.type('html').send(mitFassung(ersetzt));
    });
  });

  /* ---------------- Gaesteseiten mit eingebauten Inhalten ----------------
     Was im Editor gespeichert wurde, kommt schon im HTML mit: Bilder und
     Hintergruende werden direkt ersetzt, alle Felder liegen als JSON in der
     Seite. So zeigt der erste Bildaufbau sofort das richtige Foto - kein
     Aufblitzen des alten, kein Zwischenspeicher, der noch das alte kennt. */
  const attrEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const istVideo = (v) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(v) || v.startsWith('/video/');
  function inhalteEinbauen(html, fields) {
    let out = html;
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v !== 'string' || !v) continue;
      if (k.startsWith('m.') || k.startsWith('versteckt.')) continue;
      if ((/^\/(img|video)\//.test(v) || /^https?:\/\//.test(v)) && !istVideo(v)) {
        out = out.replace(new RegExp(`(<img[^>]*\\bdata-ez-img="${reEsc(k)}"[^>]*\\bsrc=")[^"]*(")`, 'g'), (m, a1, a2) => a1 + attrEsc(v) + a2);
        out = out.replace(new RegExp(`(<[^>]*\\bdata-ez-bg="${reEsc(k)}"[^>]*background-image:\\s*url\\()['"]?[^)'"]*['"]?(\\))`, 'g'),
          (m, a1, a2) => a1 + "'" + attrEsc(v).replace(/'/g, '%27') + "'" + a2);
      }
    }
    const json = JSON.stringify(fields).replace(/</g, '\\u003c');
    return mitFassung(out).replace('</head>', `<script id="ez-daten" type="application/json">${json}</script>\n</head>`);
  }
  for (const seite of PAGES) {
    app.get(seite.pfad, (req, res, next) => {
      fs.readFile(path.join(publicDir, seite.datei), 'utf8', async (err, html) => {
        if (err) return next();
        res.set('Cache-Control', 'no-cache');
        try {
          res.type('html').send(inhalteEinbauen(html, await felderFuer(seite.slug)));
        } catch {
          res.type('html').send(mitFassung(html));
        }
      });
    });
  }

  return {
    seiten: PAGES,
    fassung: FASSUNG,
    /* Routen mit eigenem, grossem Body-Parser - der allgemeine kleine
       Parser der Website muss sie durchlassen. */
    grosseRumpfe: ['/api/images', '/api/videos'],
    felderFuer
  };
}
