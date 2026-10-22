/* ====== FS Creative Websitebuilder – Anmeldung & Admin-Auswahl =========================
   Fuer Websites ohne eigene Anmeldung: ein Passwort (EDITOR_PASSWORT), ein
   signiertes Cookie, eine Anmeldeseite und optional eine Auswahlseite, von der
   aus man mehrere Websites bearbeiten kann (config.admin.seiten).

   Wechsel zwischen Websites ohne zweites Anmelden: Links auf der Auswahlseite
   zu einer anderen Website tragen ein kurzlebiges Zeichen (?ezt=…), das mit
   dem gemeinsamen Passwort signiert ist. Die andere Website prueft es und
   meldet direkt an - vorausgesetzt, beide haben dasselbe EDITOR_PASSWORT.

   Zentrale Freischaltung (VALUERO Partner): Sind EZ_ZENTRALE_URL, EZ_SITE_ID und
   EZ_SITE_KEY gesetzt, entscheidet die Zentrale, ob die Website bearbeitet werden
   darf (Abfrage alle 60 s, bei Netzwerkfehlern gilt der letzte bekannte Stand).
   Gastgeber springen per Single-Sign-On aus ihrem Dashboard in den Editor
   (?ezz=<site>.<bis>.<signatur>, 2 Minuten gueltig, mit dem Site-Key signiert) –
   ein EDITOR_PASSWORT ist dann nicht mehr noetig. Ohne diese Variablen bleibt
   alles wie bisher.   */
import crypto from 'node:crypto';
import express from 'express';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex');
const gleich = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export function einfacheAnmeldung(opts = {}) {
  const passwort = opts.passwort ?? process.env.EDITOR_PASSWORT ?? '';
  const name = opts.name || 'Website';
  const cfg = opts.config || {};
  const admin = cfg.admin || {};
  const adminPfad = admin.pfad || '/admin';
  const editorPfad = cfg.editor?.pfad || '/website';
  /* Signaturschluessel: eigener SESSION_SECRET oder aus Passwort + Datenbank abgeleitet. */
  const siteKeyFuerGeheim = String(opts.siteKey ?? process.env.EZ_SITE_KEY ?? '');
  const geheim = opts.geheim || process.env.SESSION_SECRET
    || crypto.createHash('sha256').update('ezb:' + passwort + (siteKeyFuerGeheim ? ':' + siteKeyFuerGeheim : '') + ':' + (process.env.DATABASE_URL || name)).digest('hex');
  const COOKIE = 'ezb';

  /* ---- Zentrale (optional) ---- */
  const zentrale = {
    url: String(opts.zentraleUrl ?? process.env.EZ_ZENTRALE_URL ?? '').replace(/\/+$/, ''),
    id: String(opts.siteId ?? process.env.EZ_SITE_ID ?? ''),
    key: String(opts.siteKey ?? process.env.EZ_SITE_KEY ?? ''),
  };
  const mitZentrale = !!(zentrale.url && zentrale.id && zentrale.key);
  let status = { aktiv: true, geprueft: 0 };
  async function zentraleAktiv() {
    if (!mitZentrale) return true;
    if (Date.now() - status.geprueft < 60000) return status.aktiv;
    try {
      const r = await fetch(`${zentrale.url}/api/builder/status/${encodeURIComponent(zentrale.id)}`, {
        headers: { 'x-site-key': zentrale.key, accept: 'application/json' }, signal: AbortSignal.timeout(5000),
      });
      const d = await r.json().catch(() => ({}));
      status = { aktiv: r.ok && d.aktiv === true, geprueft: Date.now() };
    } catch {
      status.geprueft = Date.now() - 45000; /* Zentrale nicht erreichbar: letzter Stand gilt, in 15 s neu versuchen */
    }
    return status.aktiv;
  }
  const zentraleZeichenGueltig = (t) => {
    const teile = String(t || '').split('.');
    if (teile.length < 3) return false;
    const sig = teile.pop(), bis = Number(teile.pop()), id = teile.join('.');
    return mitZentrale && id === zentrale.id && bis > Date.now() && bis < Date.now() + 5 * 60000
      && gleich(sig, hmac(zentrale.key, `zentrale:${id}:${bis}`).slice(0, 40));
  };
  const anmeldungMoeglich = !!passwort || mitZentrale;

  const signieren = (bis) => bis + '.' + hmac(geheim, 'sitzung:' + bis).slice(0, 40);
  const gueltig = (t) => { const [bis, sig] = String(t || '').split('.'); return !!sig && Number(bis) > Date.now() && gleich(sig, hmac(geheim, 'sitzung:' + bis).slice(0, 40)); };
  const cookieLesen = (req) => (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === COOKIE)?.[1];
  const cookieSetzen = (req, res) => res.append('Set-Cookie',
    `${COOKIE}=${signieren(Date.now() + 30 * 864e5)}; Path=/; HttpOnly; SameSite=Lax;${(req.secure || req.get('x-forwarded-proto') === 'https') ? ' Secure;' : ''} Max-Age=${30 * 86400}`);
  /* Uebergabe-Zeichen: nur mit dem Passwort signiert, zwei Minuten gueltig. */
  const uebergabe = () => { const bis = Date.now() + 120000; return bis + '.' + hmac(passwort, 'uebergabe:' + bis).slice(0, 40); };
  const uebergabeGueltig = (t) => { const [bis, sig] = String(t || '').split('.'); return !!passwort && !!sig && Number(bis) > Date.now() && gleich(sig, hmac(passwort, 'uebergabe:' + bis).slice(0, 40)); };

  function requireStaff(req, res, next) {
    const weiter = () => {
      if (anmeldungMoeglich && gueltig(cookieLesen(req))) return next();
      if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Bitte anmelden' });
      res.redirect('/login?weiter=' + encodeURIComponent(req.originalUrl));
    };
    if (!mitZentrale) return weiter();
    zentraleAktiv().then((aktiv) => {
      if (aktiv) return weiter();
      if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Die Website-Bearbeitung ist derzeit nicht freigeschaltet.' });
      res.status(403).set('Cache-Control', 'no-store').type('html').send(seite('Nicht freigeschaltet', `<h1>${esc(name)}</h1>
        <p>Die Bearbeitung dieser Website ist derzeit nicht freigeschaltet. Bitte wende dich an FS Creative.</p>
        <div class="fuss"><a href="/">Zur Website</a></div>`));
    }, () => weiter());
  }

  const seite = (titel, inhalt) => `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><link rel="icon" href="/builder/icon.svg">
<title>${esc(titel)}</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;
font:15px/1.5 -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;color:#1d1d1f;
background:radial-gradient(1200px 600px at 20% -10%,#e8f1fd,transparent),radial-gradient(900px 500px at 110% 110%,#f1e8fd,transparent),#f5f5f7;-webkit-font-smoothing:antialiased}
.karte{width:min(420px,100%);background:rgba(255,255,255,.82);-webkit-backdrop-filter:saturate(180%) blur(24px);backdrop-filter:saturate(180%) blur(24px);
border-radius:22px;padding:2rem 1.8rem;box-shadow:0 20px 60px -20px rgba(0,0,0,.25),0 0 0 .5px rgba(0,0,0,.06)}
h1{font-size:22px;letter-spacing:-.02em;margin:0 0 .3rem}p{margin:0 0 1.4rem;color:#6e6e73}
input{width:100%;font:inherit;padding:.75rem .9rem;border-radius:12px;border:.5px solid rgba(0,0,0,.18);background:#fff;margin-bottom:.8rem}
input:focus{outline:none;border-color:#0071e3;box-shadow:0 0 0 4px rgba(0,113,227,.2)}
button{width:100%;font:inherit;font-weight:600;padding:.75rem;border:0;border-radius:12px;background:#0071e3;color:#fff;cursor:pointer}
button:hover{background:#0062c4}.fehler{color:#d70015;margin:-.3rem 0 .8rem;font-size:13px}
.wahl{display:grid;gap:.7rem}.wahl a{display:flex;align-items:center;gap:.9rem;padding:1rem 1.1rem;border-radius:16px;background:#fff;
text-decoration:none;color:inherit;box-shadow:0 1px 3px rgba(0,0,0,.06),0 0 0 .5px rgba(0,0,0,.08);transition:transform .15s,box-shadow .15s}
.wahl a:hover{transform:translateY(-2px);box-shadow:0 10px 26px -12px rgba(0,113,227,.45),0 0 0 .5px rgba(0,113,227,.35)}
.wahl b{display:block;font-size:16px}.wahl span{display:block;color:#6e6e73;font-size:13px}
.wahl i{margin-left:auto;color:#aeaeb2;font-style:normal;font-size:20px}
.symbol{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#5e5ce6,#0071e3);color:#fff;font-weight:700;flex:none}
.fuss{margin-top:1.2rem;text-align:center;font-size:13px}.fuss a{color:#0071e3;text-decoration:none}
</style></head><body><div class="karte">${inhalt}</div></body></html>`;

  function einbinden(app) {
    app.use((req, res, next) => {
      /* Uebergabe von einer anderen Website: anmelden und ohne Zeichen weiter. */
      /* Single-Sign-On aus der Zentrale (VALUERO Partner) */
      if (req.method === 'GET' && req.query && req.query.ezz && mitZentrale) {
        const url = new URL(req.originalUrl, 'http://x'); url.searchParams.delete('ezz');
        if (!zentraleZeichenGueltig(req.query.ezz)) return res.redirect('/login?abgelaufen=1&weiter=' + encodeURIComponent(url.pathname + url.search));
        return zentraleAktiv().then((aktiv) => {
          if (aktiv) cookieSetzen(req, res);
          res.redirect(url.pathname + url.search);
        }, () => res.redirect(url.pathname + url.search));
      }
      if (req.method === 'GET' && req.query && req.query.ezt) {
        if (uebergabeGueltig(req.query.ezt)) {
          cookieSetzen(req, res);
          const url = new URL(req.originalUrl, 'http://x'); url.searchParams.delete('ezt');
          return res.redirect(url.pathname + url.search);
        }
      }
      next();
    });
    app.get('/login', (req, res) => {
      const weiter = String(req.query.weiter || (admin.seiten?.length ? adminPfad : editorPfad));
      const zentraleHinweis = mitZentrale ? `<div class="fuss">${req.query.abgelaufen ? 'Der Anmeldelink ist abgelaufen. ' : ''}<a href="${esc(zentrale.url)}/login">Über VALUERO Partner anmelden</a></div>` : '';
      if (!passwort && mitZentrale) {
        return res.set('Cache-Control', 'no-store').type('html').send(seite(`Anmelden · ${name}`, `
          <h1>${esc(name)}</h1><p>Die Website bearbeitest du direkt aus deinem VALUERO-Partner-Dashboard (Menüpunkt „Website“).</p>
          <a href="${esc(zentrale.url)}/login"><button type="button">Zu VALUERO Partner</button></a>`));
      }
      res.set('Cache-Control', 'no-store').type('html').send(seite(`Anmelden · ${name}`, passwort ? `
        <h1>${esc(name)}</h1><p>Zum Bearbeiten der Website anmelden.</p>
        <form method="post" action="/login">
          <input type="hidden" name="weiter" value="${esc(weiter)}">
          <input name="passwort" type="password" placeholder="Passwort" autocomplete="current-password" autofocus required>
          ${req.query.falsch ? '<div class="fehler">Das Passwort stimmt nicht.</div>' : ''}
          <button>Anmelden</button>
        </form>${zentraleHinweis}` : `<h1>${esc(name)}</h1><p>Die Anmeldung ist noch nicht eingerichtet: In Railway fehlt die Variable <b>EDITOR_PASSWORT</b>.</p>`));
    });
    app.post('/login', express.urlencoded({ extended: false, limit: '4kb' }), (req, res) => {
      const weiter = /^\/[^/]/.test(String(req.body?.weiter || '')) ? String(req.body.weiter) : editorPfad;
      if (!passwort || !gleich(String(req.body?.passwort || ''), passwort)) {
        return setTimeout(() => res.redirect('/login?falsch=1&weiter=' + encodeURIComponent(weiter)), 600);
      }
      cookieSetzen(req, res);
      res.redirect(weiter);
    });
    app.get('/logout', (req, res) => {
      res.append('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0`);
      res.redirect('/');
    });
    /* Auswahl: welche Website bearbeiten? */
    if (admin.seiten?.length) {
      app.get(adminPfad, requireStaff, (req, res) => {
        const z = uebergabe();
        const karten = admin.seiten.map((s) => {
          const extern = /^https?:\/\//.test(s.link);
          const href = extern ? s.link + (s.link.includes('?') ? '&' : '?') + 'ezt=' + encodeURIComponent(z) : s.link;
          return `<a href="${esc(href)}"><span class="symbol">${esc((s.kurz || s.titel || '?').slice(0, 2))}</span>
            <span><b>${esc(s.titel)}</b><span>${esc(s.text || 'Website bearbeiten')}</span></span><i>›</i></a>`;
        }).join('');
        res.set('Cache-Control', 'no-store').type('html').send(seite(admin.titel || 'Welche Website?', `
          <h1>${esc(admin.titel || 'Welche Website bearbeiten?')}</h1><p>${esc(admin.text || 'Wähle aus, was du bearbeiten möchtest.')}</p>
          <div class="wahl">${karten}</div>
          <div class="fuss"><a href="/">Zur Website</a> · <a href="/logout">Abmelden</a></div>`));
      });
    }
  }

  return { requireStaff, einbinden, uebergabe, zentraleAktiv };
}
