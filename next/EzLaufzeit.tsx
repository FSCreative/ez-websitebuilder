"use client";
/* ====== EZ Websitebuilder – Laufzeit fuer Next.js ==============================
   In die Website kopieren nach src/components/EzLaufzeit.tsx und im Layout
   ans Ende von <body> setzen: <EzLaufzeit />
   Laedt die Angaben der Website (/js/ez-site.js) und die Builder-Laufzeit erst,
   wenn React die Seite uebernommen hat - so kommen sich beide nicht in die
   Quere (keine Hydration-Fehler durch eingefuegte Bloecke).               */
import { useEffect } from "react";

export default function EzLaufzeit({ site = "/js/ez-site.js" }: { site?: string }) {
  useEffect(() => {
    if (document.querySelector("script[data-ez-laufzeit]")) return;
    const laden = (src: string) =>
      new Promise<void>((fertig) => {
        const s = document.createElement("script");
        s.src = src;
        s.dataset.ezLaufzeit = "1";
        s.onload = s.onerror = () => fertig();
        document.body.appendChild(s);
      });
    laden(site).then(() => laden("/builder/runtime.js"));
  }, [site]);
  return null;
}
