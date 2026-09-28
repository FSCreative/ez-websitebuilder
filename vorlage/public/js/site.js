/* Eigenheiten dieser Website fuer den Websitebuilder (alles optional). */
window.EZ_SITE = {
  menue: [
    { text: 'Start', link: '/' },
    { text: 'Über uns', link: '/#ueber' },
    { text: 'Kontakt', link: '/#kontakt', knopf: 1 }
  ],
  kopfKlasse: 'gnav',
  kopf: () => `<div class="gnav-inner">
      <a class="logo" href="/" data-ez="global.name">Neue Website</a>
      <button class="burger" id="burger" aria-label="Menü" aria-expanded="false"><span></span><span></span><span></span></button>
      <div class="navlinks" id="navlinks"></div></div>`,
  fussKlasse: 'sitefoot',
  fuss: () => `<div class="sf-inner"><div class="sf-col"><p data-ez="global.fuss">© ${new Date().getFullYear()} Neue Website</p></div></div>`,
  abschnitte: 'section, header.hero, .ezblock[data-block]',
  hero: '[data-ez-hero]',
  heroEbene: '[data-ez-hero-bild]',
  farben: { weiss: '#ffffff', schwarz: '#111111', akzent: '#0071e3', grau: '#6e6e73' }
};
