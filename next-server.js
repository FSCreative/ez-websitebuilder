/* ====== EZ Websitebuilder – Server fuer Next.js-Websites =====================
   Startet Next.js und legt den Builder davor: Editor, Speichern, Bilder,
   Videos, Anmeldung und (optional) die Admin-Auswahl. Die Seiten rendert
   weiterhin Next.js; die Bausteine <Ez> und <EzBild> (siehe next/Ez.tsx)
   setzen gespeicherte Inhalte schon beim Rendern ein.

   server.mjs der Website:
     import { starteNextMitBuilder } from 'ez-websitebuilder/next-server.js';
     starteNextMitBuilder();

   Umgebung: PORT, DATABASE_URL (Postgres), EDITOR_PASSWORT, optional
   SESSION_SECRET und SMTP_* fuer Formular-Bloecke.                         */
import express from 'express';
import path from 'node:path';
import * as ablage from './store.js';
import { mountBuilder, ladeKonfiguration } from './index.js';
import { einfacheAnmeldung } from './anmeldung.js';

export async function starteNextMitBuilder(opts = {}) {
  const dir = path.resolve(opts.dir || process.cwd());
  const config = opts.config || ladeKonfiguration(path.join(dir, 'site.config.json'));
  const port = Number(opts.port || process.env.PORT || 3000);
  const dev = opts.dev ?? process.env.NODE_ENV !== 'production';

  const store = opts.store || ablage;
  if (typeof store.init === 'function') await store.init();

  const { default: next } = await import('next');
  const nextApp = next({ dev, dir, hostname: '0.0.0.0', port });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  const anmeldung = opts.anmeldung || einfacheAnmeldung({ config, name: config.name });
  anmeldung.einbinden(app);
  const builder = mountBuilder(app, {
    config, store, requireStaff: anmeldung.requireStaff,
    publicDir: path.join(dir, 'public'), seitenAusliefern: false,
    sendMail: opts.sendMail, wrapMail: opts.wrapMail, formularAn: opts.formularAn,
    /* Sprungmarken: die feste Seite einmal selbst abrufen und ihre <section id> lesen */
    seiteHtml: async (seite) => (await fetch(`http://127.0.0.1:${port}${seite.pfad}`)).text()
  });

  /* Fuer <Ez>: gespeicherte Felder einer Seite, im selben Prozess abrufbar. */
  globalThis.__ezFelder = async (pfad) => {
    const slug = builder.slugFuer(String(pfad || '/').replace(/\/$/, '') || '/');
    return slug ? builder.felderFuer(slug) : builder.felderFuer('_global');
  };

  /* Alles andere macht Next.js. Den Pfad bekommt die Seite als Kopfzeile mit. */
  app.use((req, res) => {
    req.headers['x-ez-pfad'] = req.path;
    return handle(req, res);
  });

  await new Promise((fertig) => app.listen(port, '0.0.0.0', fertig));
  console.log(`[builder] ${config.name || 'Website'} läuft auf Port ${port}${dev ? ' (Entwicklung)' : ''}`);
  return app;
}
