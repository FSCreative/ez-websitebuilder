#!/usr/bin/env node
/* FS Creative Websitebuilder – Anschliessen einer bestehenden statischen Website.
     npx github:FSCreative/ez-websitebuilder init [ordner] [--dry]
   Der Ordner enthaelt die HTML-Dateien (oder einen Unterordner public/).
   Es wird nichts ueberschrieben, was schon da ist; mehrfaches Ausfuehren ist
   unschaedlich. Sichtbare Texte und Bilder bekommen data-ez-Schluessel,
   danach laesst sich die Website unter /website bearbeiten.                */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const [befehl, ordnerArg] = args.filter((a) => !a.startsWith('--'));
if (befehl !== 'init') { console.log('Aufruf: fs-websitebuilder init [ordner] [--dry]'); process.exit(befehl ? 1 : 0); }

const wurzel = path.resolve(ordnerArg || '.');
const pub = fs.existsSync(path.join(wurzel, 'public')) ? path.join(wurzel, 'public') : wurzel;
const schreibe = (datei, text) => {
  if (fs.existsSync(datei)) return console.log('  vorhanden, uebersprungen:', path.relative(wurzel, datei));
  console.log('  neu:', path.relative(wurzel, datei));
  if (!dry) { fs.mkdirSync(path.dirname(datei), { recursive: true }); fs.writeFileSync(datei, text); }
};

const dateien = fs.readdirSync(pub).filter((f) => f.endsWith('.html'));
if (!dateien.length) { console.error('Keine .html-Dateien in', pub); process.exit(1); }

/* HTML vorbereiten: Builder-Stile/-Skripte einhaengen, Texte und Bilder markieren. */
function vorbereiten(html, slug) {
  let n = 0;
  const hat = (s) => /data-ez(-|=|\s|>)/.test(s);
  if (!html.includes('/builder/builder.css')) {
    const m = html.match(/<link[^>]+rel=["']stylesheet["'][^>]*>/i);
    html = m ? html.replace(m[0], '<link rel="stylesheet" href="/builder/builder.css">\n' + m[0])
             : html.replace('</head>', '<link rel="stylesheet" href="/builder/builder.css">\n</head>');
  }
  /* Texte ohne Unterelemente (nur h1-h4, p, Knoepfe/Links mit reinem Text) */
  html = html.replace(/<(h[1-4]|p)(\s[^>]*)?>([^<]*\S[^<]*)<\/\1>/gi, (m, tag, attr = '') =>
    hat(attr) ? m : m.replace('<' + tag, `<${tag} data-ez="${slug}.${tag.toLowerCase()}-${++n}"`));
  html = html.replace(/<img(\s[^>]*?)(\/?)>/gi, (m, attr, slash) =>
    hat(attr) || !/\ssrc=/.test(attr) ? m : `<img data-ez-img="${slug}.bild-${++n}"${attr}${slash}>`);
  if (!html.includes('/builder/runtime.js')) {
    const skripte = (fs.existsSync(path.join(pub, 'js', 'site.js')) ? '<script src="/js/site.js"></script>\n' : '') + '<script src="/builder/runtime.js"></script>\n';
    html = html.replace('</body>', skripte + '</body>');
  }
  return { html, n };
}

schreibe(path.join(pub, 'js', 'site.js'), '/* Eigenheiten dieser Website fuer den Websitebuilder (alles optional). */\nwindow.EZ_SITE = { abschnitte: \'section, header, .ezblock[data-block]\' };\n');
const seiten = [];
const sicherung = path.join(wurzel, '.fs-websitebuilder-backup');
for (const f of dateien) {
  const slug = f === 'index.html' ? 'index' : f.replace(/\.html$/, '');
  const roh = fs.readFileSync(path.join(pub, f), 'utf8');
  const titel = (roh.match(/<title[^>]*>([^<]*)/i)?.[1] || slug).trim();
  const { html, n } = vorbereiten(roh, slug);
  console.log(`  ${f}: ${n} Elemente editierbar`);
  if (!dry && html !== roh) { fs.mkdirSync(sicherung, { recursive: true }); if (!fs.existsSync(path.join(sicherung, f))) fs.copyFileSync(path.join(pub, f), path.join(sicherung, f)); fs.writeFileSync(path.join(pub, f), html); }
  seiten.push({ slug, pfad: slug === 'index' ? '/' : '/' + slug, titel });
}

const name = path.basename(wurzel);
schreibe(path.join(wurzel, 'site.config.json'), JSON.stringify({ name, seiten,
  editor: { pfad: '/website', titel: 'Website bearbeiten', zurueck: { text: 'Website', link: '/' }, login: '/login' }, formulare: { an: '' } }, null, 2));
schreibe(path.join(wurzel, 'server.js'), `import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as store from 'ez-websitebuilder/store.js';
import { mountBuilder, ladeKonfiguration } from 'ez-websitebuilder';
import { einfacheAnmeldung } from 'ez-websitebuilder/anmeldung.js';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const config = ladeKonfiguration(path.join(HIER, 'site.config.json'));
const app = express();
const anmeldung = einfacheAnmeldung({ name: config.name, config });   // EDITOR_PASSWORT in der Umgebung setzen
anmeldung.einbinden(app);
await store.init();                                                  // DATABASE_URL = Postgres, sonst JSON-Datei
mountBuilder(app, { config, store, requireStaff: anmeldung.requireStaff, publicDir: path.join(HIER, '${path.relative(wurzel, pub) || '.'}') });
app.use(express.static(path.join(HIER, '${path.relative(wurzel, pub) || '.'}'), { extensions: ['html'] }));
app.listen(process.env.PORT || 3000, () => console.log('Website laeuft'));
`);

const pk = path.join(wurzel, 'package.json');
const p = fs.existsSync(pk) ? JSON.parse(fs.readFileSync(pk, 'utf8')) : { name: name.toLowerCase().replace(/[^a-z0-9-]+/g, '-'), private: true };
p.type = p.type || 'module';
p.scripts = { start: 'node server.js', ...p.scripts };
p.dependencies = { express: '^4.19.2', pg: '^8.12.0', 'ez-websitebuilder': 'github:FSCreative/ez-websitebuilder#main', ...p.dependencies };
console.log('  package.json aktualisiert');
if (!dry) fs.writeFileSync(pk, JSON.stringify(p, null, 2) + '\n');
console.log(`\nFertig${dry ? ' (Probelauf, nichts geschrieben)' : ''}. Weiter: npm install && EDITOR_PASSWORT=geheim npm start  →  /login, dann /website`);
