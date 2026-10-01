# EZ Websitebuilder

Ein Editor, mit dem Inhaber ihre Website selbst bearbeiten – direkt auf der Seite: anklicken und tippen, Bilder tauschen und zuschneiden, Abschnitte einfügen und verschieben, Menü, Kopf- und Fußzeile, Farben, Schriften und Animationen einstellen.

**Dieses Repository ist die einzige Stelle, an der das System geändert wird.** Jede Website lädt es als Paket; eine GitHub-Automatik in der Website holt sich neue Fassungen von selbst (siehe unten). Was einer Website eigen ist – Inhalte, Bilder, Kopf- und Fußzeile, Farben, Seitenliste –, bleibt in deren eigenem Repository.

```
index.js        Server-Modul (Express): Seiten, Bilder, Videos, Anker, Formulare, Editor
store.js        Ablage für Websites ohne eigene Datenbank (Postgres oder JSON-Datei)
client/         alles für den Browser, erreichbar unter /builder/…
  runtime.js    läuft auf jeder Seite: Inhalte, Blöcke, Menü, Design, Animationen, Bearbeiten
  builder.css   Blöcke, Design-Einstellungen, Animationen, Bearbeiten-Rahmen
  editor.html   der Editor (Standard: /website)
  editor.js     Logik des Editors
  editor.css    Gestaltung des Editors (eigenständig, Apple-Stil)
vorlage/        Startpaket für eine neue Website
```

## Eine Website anschließen

**1. Abhängigkeit** in der `package.json` der Website:

```json
"dependencies": {
  "express": "^4.19.2",
  "ez-websitebuilder": "github:FSCreative/ez-websitebuilder#main"
}
```

**2. Server** – vor `express.static`:

```js
import { mountBuilder, ladeKonfiguration } from 'ez-websitebuilder';
mountBuilder(app, {
  config: ladeKonfiguration('./site.config.json'),
  store,                 // eigene Ablage oder: import * as store from 'ez-websitebuilder/store.js'
  requireStaff,          // Middleware: nur angemeldete Bearbeiter
  publicDir: './public',
  sendMail, formularAn: 'info@…'   // optional: Formular-Blöcke per E-Mail
});
```

Die Ablage braucht `getPage, savePage, listPages, saveImage, getImage, listImages, deleteImage`.

**3. Automatisch aktuell bleiben** – die Datei `.github/workflows/builder-aktualisieren.yml` aus dem Esszimmer-Repository in die Website kopieren. Sie prüft regelmäßig, ob es eine neue Builder-Fassung gibt, und schreibt sie in die `package-lock.json`; Railway spielt die Website daraufhin neu auf. Sofort geht es unter *Actions → Builder aktualisieren → Run workflow*. Es braucht dafür keinen Schlüssel.

Ganz neue Website: `vorlage/` als neues Repository nehmen – dort ist alles schon vorbereitet.

## site.config.json

```json
{
  "name": "Meine Website",
  "seiten": [ { "slug": "index", "pfad": "/", "titel": "Startseite" } ],
  "editor": { "pfad": "/website", "titel": "Website bearbeiten",
              "zurueck": { "text": "Website", "link": "/" }, "login": "/login", "plugins": [] },
  "formulare": { "an": "info@meine-website.at" }
}
```

Die Datei einer Seite heißt `public/<slug>.html` (oder `"datei"` angeben).

## Jede Seite bindet ein

```html
<link rel="stylesheet" href="/builder/builder.css">   <!-- vor dem eigenen Stylesheet -->
<link rel="stylesheet" href="/css/style.css">
<div id="siteNav"></div>           <!-- Kopfzeile, aus EZ_SITE.kopf -->
…
<footer id="siteFoot"></footer>    <!-- Fußzeile, aus EZ_SITE.fuss -->
<script src="/js/site.js"></script>          <!-- window.EZ_SITE -->
<script src="/builder/runtime.js"></script>
```

## Inhalte bearbeitbar machen

| Attribut | Bedeutung |
|---|---|
| `data-ez="hero.titel"` | Text (Überschrift, Absatz, Knopf) |
| `data-ez-img="bild.team"` | Bild (`<img>`), auch durch Video ersetzbar |
| `data-ez-bg="hero.bild"` | Hintergrundbild eines Elements |
| `data-ez-hero` / `data-ez-hero-bild` | großes Startbild und seine Bildebene (Parallax & Co.) |
| `<section id="…">` | Abschnitt – mit `id` automatisch als Sprungmarke wählbar |

Schlüssel mit `global.` vorne gelten auf allen Seiten.

## window.EZ_SITE (in `/js/site.js`)

Alles optional:

```js
window.EZ_SITE = {
  menue: [{ text: 'Start', link: '/' }, { text: 'Kontakt', link: '/#kontakt', knopf: 1 }],
  kopfKlasse: 'gnav', kopf: () => `… <button id="burger">…</button> <div id="navlinks"></div> …`,
  fussKlasse: 'sitefoot', fuss: () => `…`,
  abschnitte: 'section, header.hero, .ezblock[data-block]',
  hero: '[data-ez-hero]', heroEbene: '[data-ez-hero-bild]',
  designVariablen: { akzent: '--marke', titelschrift: '--font-titel' },
  farben: { weiss: '#fff', schwarz: '#111', marke: '#0a7' },
  knopfKlasse: 'btn', knopfText: 'Mehr erfahren', standardLink: '/kontakt',
  beispielbilder: ['/img/a.jpg', '/img/b.jpg']
};
```

## Marke

`builder.css` bringt neutrale Werte mit; die Website setzt ihre Marke in ihrem `:root`:

```css
:root{ --ez-akzent:#0a7; --ez-titelschrift:"Playfair Display",serif; --ez-textschrift:Inter,sans-serif;
       --ez-text:#333; --ez-radius:8px; }
```

Weitere: `--ez-tinte, --ez-leise, --ez-linie, --ez-flaeche, --ez-weiss, --ez-rot`. Kopf- und Fußzeile: `--kopffarbe, --menufarbe, --burgerfarbe, --fussfarbe, --fussschrift, --titelfarbe`, im eigenen CSS mit Standardwert benutzen, etwa `background:var(--fussfarbe,#f5f5f7)`. Die Farbe des Burger-Symbols (`--burgerfarbe`) setzt `builder.css` selbst – auf `.burger`/`#burger`: Striche als `<span>` ohne Klasse bekommen sie als Hintergrund, sonst gilt sie als `color` (für Striche mit `currentColor`).

## Plugins für den Editor

```js
window.EZ_EDITOR.knopf({ text: 'Karte aus PDF', seiten: ['speisekarte'], klick: async (ed) => {
  const datei = await ed.datei('application/pdf');
  const d = await ed.api('/api/…', { method: 'POST', body: { … } });
  ed.setzen('menu.html', d.html);
  ed.toast('Übernommen – bitte speichern.');
}});
```

Verfügbar: `seite, api, toast, hinweis, stand, beschaeftigt, setzen, knopf, datei`.

## Next.js-Websites

Für Websites mit Next.js (App Router) gibt es einen eigenen Server, der Next.js und den Builder zusammen startet – inklusive Anmeldung (`/login`) und optionaler Auswahlseite für mehrere Websites (`/admin`).

1. `package.json`: `ez-websitebuilder`, `express` und `pg` als Abhängigkeiten, `"start": "node server.mjs"`.
2. `server.mjs`:
   ```js
   import { starteNextMitBuilder } from 'ez-websitebuilder/next-server.js';
   starteNextMitBuilder();   // optional: { sendMail, formularAn }
   ```
   Dockerfile: `CMD ["node", "server.mjs"]`, ohne `output: "standalone"`.
3. `next/Ez.tsx` und `next/EzLaufzeit.tsx` nach `src/components/` kopieren.
4. Layout: `export const dynamic = "force-dynamic"`, im `<head>` `<link rel="stylesheet" href="/builder/builder.css" precedence="low" />`, am Ende von `<body>` `<EzLaufzeit />`.
5. Texte: `<Ez as="h2" k="start.titel">Standardtext</Ez>`, Bilder: `<EzBild src="/images/…" … />` statt `<Image>`. Nur in Server-Komponenten.
6. `public/js/ez-site.js` mit `window.EZ_SITE` (siehe oben), zusätzlich:
   `vollNeuladen: true, abschnittWurzel: 'main, main > .page-enter', inhalt: 'main > .page-enter, main'`.
7. `site.config.json`: Seiten mit Slug = Pfad mit `-` statt `/` (`/zimmer/blau` → `zimmer-blau`).

Umgebung: `DATABASE_URL` (Postgres), `EDITOR_PASSWORT`. Mehrere Websites mit demselben `EDITOR_PASSWORT` wechseln über die Auswahlseite ohne neue Anmeldung:

```json
"admin": { "pfad": "/admin", "seiten": [
  { "titel": "Website A", "link": "/website" },
  { "titel": "Website B", "link": "https://website-b.at/website" } ] }
```

## Änderungen am System

Änderungen am Builder immer **hier** machen, nie im `node_modules`-Ordner einer Website. Nach einer Änderung übernehmen alle angeschlossenen Websites die neue Fassung innerhalb von etwa 30 Minuten – oder sofort über *Actions → Builder aktualisieren → Run workflow* im jeweiligen Website-Repository.

## Hinweis zur Erstellung

Bei der Entwicklung dieses Projekts wurden teilweise KI-gestützte Werkzeuge eingesetzt. Der Code wurde geprüft.
