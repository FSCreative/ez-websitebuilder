/* ====== EZ Websitebuilder – Bausteine fuer Next.js ============================
   In die Website kopieren nach src/components/Ez.tsx.

   <Ez as="h2" k="start.titel" className="…">Standardtext</Ez>
     macht einen Text bearbeitbar. Ist im Editor etwas gespeichert, rendert der
     Server gleich diesen Text - kein Aufblitzen des alten.
   <EzBild src="/images/…" alt="…" fill sizes="…" />
     wie next/image, zusaetzlich tauschbar. Der Schluessel ergibt sich aus dem
     Dateinamen (oder k="…" angeben).

   Die Felder kommen vom Builder-Server (ez-websitebuilder/next-server.js) im
   selben Prozess; beim Bauen (next build) gibt es sie nicht - dann bleibt es
   bei den Standardinhalten.                                                 */
import { headers } from "next/headers";
import Image, { type ImageProps } from "next/image";
import type { ElementType, ReactNode } from "react";

type Felder = Record<string, string>;
type EzGlobal = typeof globalThis & { __ezFelder?: (pfad: string) => Promise<Felder> };

export async function ezFelder(): Promise<Felder> {
  const hole = (globalThis as EzGlobal).__ezFelder;
  if (!hole) return {};
  try {
    const h = await headers();
    return (await hole(h.get("x-ez-pfad") || "/")) || {};
  } catch {
    return {};
  }
}

const istVideo = (v: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(v) || v.startsWith("/video/");

type EzProps = { k: string; as?: ElementType; children?: ReactNode; [attr: string]: unknown };

export async function Ez({ k, as: Tag = "span", children, ...rest }: EzProps) {
  const f = await ezFelder();
  const text = f[k];
  const attrs: Record<string, unknown> = { ...rest, "data-ez": k };
  /* Links: eine im Editor geaenderte Verlinkung gilt sofort */
  if ("href" in rest && f["link." + k]) attrs.href = f["link." + k];
  if (text) return <Tag {...attrs} dangerouslySetInnerHTML={{ __html: text }} />;
  return <Tag {...attrs}>{children}</Tag>;
}

export const bildSchluessel = (src: string) =>
  "bild." + String(src).replace(/^\/images\//, "").replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9]+/gi, ".").replace(/^\.|\.$/g, "").toLowerCase();

export async function EzBild({ k, src, ...props }: ImageProps & { k?: string }) {
  const schluessel = k || bildSchluessel(String(src));
  const neu = (await ezFelder())[schluessel];
  if (neu && istVideo(neu)) {
    const { alt, className, style, fill } = props as ImageProps;
    return (
      <video data-ez-img={schluessel} src={neu} className={className} aria-label={String(alt || "")}
        autoPlay muted loop playsInline preload="metadata"
        style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style } : style} />
    );
  }
  return <Image {...props} src={neu || src} data-ez-img={schluessel} />;
}
