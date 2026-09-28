/* Vorlage: kleinste Website mit dem EZ Websitebuilder.
   Start: npm install && EDITOR_PASSWORT=geheim node server.js
   Editor: http://localhost:3000/website  (vorher /login) */
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from 'ez-websitebuilder/store.js';
import { mountBuilder, ladeKonfiguration } from 'ez-websitebuilder';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const PASSWORT = process.env.EDITOR_PASSWORT || 'bitte-aendern';
const GEHEIM = process.env.SESSION_SECRET || crypto.randomBytes(24).toString('hex');
const app = express();
app.use(express.json({ limit: '256kb' }));

/* Anmeldung: ein Passwort, ein signiertes Cookie. */
const signieren = (w) => w + '.' + crypto.createHmac('sha256', GEHEIM).update(w).digest('hex').slice(0, 32);
const pruefen = (t) => { const w = String(t || '').split('.')[0]; return t && signieren(w) === t && Number(w) > Date.now(); };
const cookie = (req) => (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === 'ezb')?.[1];
function requireStaff(req, res, next) {
  if (pruefen(cookie(req))) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Bitte anmelden' });
  res.redirect('/login');
}
app.get('/login', (req, res) => res.send(`<!doctype html><meta name="viewport" content="width=device-width">
  <form method="post" action="/login" style="font:15px -apple-system,sans-serif;max-width:300px;margin:20vh auto;display:grid;gap:10px">
  <b>Website bearbeiten</b><input name="pw" type="password" placeholder="Passwort" autofocus style="padding:10px;border-radius:10px;border:1px solid #ccc">
  <button style="padding:10px;border-radius:10px;border:0;background:#0071e3;color:#fff">Anmelden</button></form>`));
app.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  if (req.body.pw !== PASSWORT) return res.redirect('/login');
  res.set('Set-Cookie', `ezb=${signieren(String(Date.now() + 30 * 864e5))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`);
  res.redirect('/website');
});

await store.init();
mountBuilder(app, { config: ladeKonfiguration(path.join(HIER, 'site.config.json')), store, requireStaff, publicDir: path.join(HIER, 'public') });
app.use(express.static(path.join(HIER, 'public'), { extensions: ['html'] }));
app.listen(process.env.PORT || 3000, () => console.log('Website läuft auf Port', process.env.PORT || 3000));
