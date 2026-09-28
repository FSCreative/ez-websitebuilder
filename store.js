/* ====== EZ Websitebuilder – Ablage fuer neue Websites =========================
   Seiteninhalte und Bilder/Videos. Mit DATABASE_URL in Postgres, sonst in
   einer JSON-Datei (data/builder.json) - fuer lokale Tests.
   Das Esszimmer benutzt seine eigene store.js (gleiche Tabellen). Eine neue
   Website ohne eigene Datenbank nimmt einfach diese hier:
     import * as store from './builder/store.js';
     await store.init();                                                  */
import fs from 'node:fs';
import path from 'node:path';

const DATEI = path.join(process.env.DATA_DIR || path.resolve('data'), 'builder.json');
const usePg = !!process.env.DATABASE_URL;
let pool = null;

const lesen = () => { try { return JSON.parse(fs.readFileSync(DATEI, 'utf8')); } catch { return { pages: {}, images: {} }; } };
const schreiben = (db) => { fs.mkdirSync(path.dirname(DATEI), { recursive: true }); fs.writeFileSync(DATEI, JSON.stringify(db)); };

export async function init() {
  if (!usePg) { if (!fs.existsSync(DATEI)) schreiben({ pages: {}, images: {} }); console.log('[builder] JSON-Datei:', DATEI); return; }
  const { default: pg } = await import('pg');
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'off' ? false : { rejectUnauthorized: false } });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pages (slug TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS images (id TEXT PRIMARY KEY, mime TEXT NOT NULL, name TEXT DEFAULT '', bytes BYTEA NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  console.log('[builder] Postgres verbunden');
}

export async function getPage(slug) {
  if (usePg) return (await pool.query('SELECT data FROM pages WHERE slug = $1', [slug])).rows[0]?.data || {};
  return lesen().pages[slug] || {};
}
export async function savePage(slug, data) {
  if (usePg) {
    await pool.query(`INSERT INTO pages (slug, data, updated_at) VALUES ($1, $2, now())
      ON CONFLICT (slug) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [slug, JSON.stringify(data)]);
    return data;
  }
  const db = lesen(); db.pages[slug] = data; schreiben(db); return data;
}
export async function listPages() {
  if (usePg) return (await pool.query('SELECT slug, updated_at FROM pages ORDER BY slug')).rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
  return Object.keys(lesen().pages).map((slug) => ({ slug, updatedAt: null }));
}
export async function saveImage(id, mime, buffer, name = '') {
  if (usePg) { await pool.query('INSERT INTO images (id, mime, name, bytes) VALUES ($1, $2, $3, $4)', [id, mime, String(name).slice(0, 120), buffer]); return id; }
  const db = lesen(); db.images[id] = { mime, name, b64: buffer.toString('base64'), createdAt: new Date().toISOString() }; schreiben(db); return id;
}
export async function getImage(id) {
  if (usePg) { const r = (await pool.query('SELECT mime, bytes FROM images WHERE id = $1', [id])).rows[0]; return r ? { mime: r.mime, bytes: r.bytes } : null; }
  const r = lesen().images[id]; return r ? { mime: r.mime, bytes: Buffer.from(r.b64, 'base64') } : null;
}
export async function listImages(limit = 300) {
  if (usePg) {
    return (await pool.query('SELECT id, mime, name, octet_length(bytes) AS size, created_at FROM images ORDER BY created_at DESC LIMIT $1', [limit]))
      .rows.map((r) => ({ id: r.id, mime: r.mime, name: r.name, size: Number(r.size), createdAt: r.created_at }));
  }
  return Object.entries(lesen().images).reverse().slice(0, limit)
    .map(([id, r]) => ({ id, mime: r.mime, name: r.name, size: Math.round(r.b64.length * 3 / 4), createdAt: r.createdAt }));
}
export async function deleteImage(id) {
  if (usePg) { await pool.query('DELETE FROM images WHERE id = $1', [id]); return true; }
  const db = lesen(); delete db.images[id]; schreiben(db); return true;
}
