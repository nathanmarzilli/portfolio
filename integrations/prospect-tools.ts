// ============================================================
// prospect-tools — Recherche de prospects et inspection de site
// ------------------------------------------------------------
// Remplace l'ancien `prospect/proxy.php`, qui posait trois
// problèmes : il ne pouvait pas s'exécuter sur GitHub Pages
// (hébergement statique, sans PHP), il contenait une clé d'API
// Google en clair dans un dépôt public, et il s'appuyait sur
// l'API Google Places — un service FACTURÉ.
//
// Ici, la recherche passe par l'API publique « Recherche
// d'entreprises » de l'État français :
//   https://recherche-entreprises.api.gouv.fr
// Elle est gratuite, sans clé d'API, et couvre les associations
// et clubs sportifs (indicateur `est_association`, code NAF
// 93.12Z pour les clubs de sport). Aucun risque de facturation.
//
// Sécurité :
//   1. verify_jwt = true -> JWT Supabase valide exigé.
//   2. L'e-mail du porteur doit figurer dans nm_admins.
//   3. `inspect` ne va chercher que des URL http(s) publiques :
//      les adresses locales et les plages IP privées sont
//      refusées (protection contre les requêtes vers l'intérieur
//      de l'infrastructure).
//   4. Le contenu récupéré est renvoyé comme DONNÉE brute. Il
//      n'est jamais exécuté ni interprété comme une consigne.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ------------------------------------------------------------
   1. Recherche d'associations / clubs / entreprises
   ------------------------------------------------------------ */
async function searchStructures(p: any) {
  const query = String(p?.query ?? "").trim();
  const commune = String(p?.commune ?? "").trim();
  const departement = String(p?.departement ?? "").trim();
  const onlyAssociations = p?.onlyAssociations !== false;
  const perPage = Math.min(25, Math.max(1, Number(p?.perPage) || 20));

  const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
  url.searchParams.set("q", query || "association");
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(Math.max(1, Number(p?.page) || 1)));
  if (commune) url.searchParams.set("code_postal", commune);
  if (departement) url.searchParams.set("departement", departement);
  if (onlyAssociations) url.searchParams.set("est_association", "true");
  // Codes NAF utiles : 93.12Z clubs de sport, 93.19Z autres activités
  // sportives, 94.99Z autres organisations associatives.
  if (p?.nafCodes) url.searchParams.set("activite_principale", String(p.nafCodes));

  const res = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Trop de recherches d'affilée : patientez quelques secondes.");
    throw new Error(`L'annuaire public a répondu ${res.status}.`);
  }
  const data = await res.json();

  const results = (data?.results ?? []).map((r: any) => {
    const siege = r?.siege ?? {};
    return {
      external_id: r?.siren ?? siege?.siret ?? null,
      name: r?.nom_complet ?? r?.nom_raison_sociale ?? "Sans nom",
      city: siege?.libelle_commune ?? null,
      postal_code: siege?.code_postal ?? null,
      address: siege?.adresse ?? null,
      activity: r?.libelle_activite_principale ?? r?.activite_principale ?? null,
      naf: r?.activite_principale ?? null,
      is_association: r?.est_association === true,
      created_on: r?.date_creation ?? null,
      employees: r?.tranche_effectif_salarie ?? null,
      lat: siege?.latitude ? Number(siege.latitude) : null,
      lon: siege?.longitude ? Number(siege.longitude) : null,
    };
  });

  return { results, total: data?.total_results ?? results.length, page: data?.page ?? 1 };
}

/* ------------------------------------------------------------
   2. Inspection d'un site existant
   ------------------------------------------------------------ */
function isPubliclyRoutable(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  // Adresses IPv4 privées / de bouclage / lien-local
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false;
  }
  if (h.startsWith("[") || h.includes(":")) return false; // IPv6 littérale : on refuse par prudence
  return true;
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/\s+/g, " ")
    .trim();
}

async function inspectSite(p: any) {
  const raw = String(p?.url ?? "").trim();
  if (!raw) throw new Error("Aucune adresse de site fournie.");

  let target: URL;
  try {
    target = new URL(raw.startsWith("http") ? raw : "https://" + raw);
  } catch {
    throw new Error("Adresse de site invalide.");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("Seules les adresses http(s) sont acceptées.");
  }
  if (!isPubliclyRoutable(target.hostname)) {
    throw new Error("Cette adresse n'est pas un site public.");
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  let res: Response;
  try {
    res = await fetch(target.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClicALaideBot/1.0; +https://www.clicalaide.fr/)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error && e.name === "AbortError"
      ? "Le site n'a pas répondu en 12 secondes (site très lent ou hors ligne)."
      : "Site injoignable.";
    return { reachable: false, error: msg, url: target.toString() };
  }
  clearTimeout(timer);

  const elapsed = (Date.now() - started) / 1000;
  const ctype = res.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml/i.test(ctype)) {
    return { reachable: res.ok, status: res.status, error: "La page n'est pas du HTML.", url: res.url };
  }

  // On ne lit que les 400 premiers Ko : inutile d'avaler un site entier.
  const buf = new Uint8Array(await res.arrayBuffer());
  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 400_000));

  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.trim() || null;
  const description = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) || [])[1] || null;
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

  const yearMatch = html.match(/(?:©|&copy;|copyright)[^0-9]{0,30}(20[0-2][0-9])/i);
  const copyrightYear = yearMatch ? Number(yearMatch[1]) : null;

  let tech = "Inconnu";
  if (/wp-content|wp-includes/i.test(html)) tech = "WordPress";
  else if (/wixstatic|_wixCssImports/i.test(html)) tech = "Wix";
  else if (/squarespace/i.test(html)) tech = "Squarespace";
  else if (/webself/i.test(html)) tech = "WebSelf";
  else if (/e-monsite/i.test(html)) tech = "e-monsite";
  else if (/shopify/i.test(html)) tech = "Shopify";
  else if (/joomla/i.test(html)) tech = "Joomla";
  else if (/jimdo/i.test(html)) tech = "Jimdo";

  const emails = Array.from(
    new Set(
      (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
        .filter((e) => !/\.(png|jpe?g|gif|css|js|webp|svg)$/i.test(e))
        .filter((e) => !/(sentry|wixpress|example|schema\.org)/i.test(e)),
    ),
  ).slice(0, 5);

  const phones = Array.from(
    new Set(html.match(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.\-]*\d{2}){4}/g) || []),
  ).slice(0, 3);

  const socials = {
    facebook: /facebook\.com\//i.test(html),
    instagram: /instagram\.com\//i.test(html),
  };

  return {
    reachable: true,
    url: res.url,
    status: res.status,
    https: res.url.startsWith("https://"),
    mobileReady: hasViewport,
    loadSeconds: Math.round(elapsed * 100) / 100,
    title,
    description,
    copyrightYear,
    tech,
    emails,
    phones,
    socials,
    weightKb: Math.round(buf.length / 1024),
    // Texte destiné à l'analyse : DONNÉE, jamais une consigne.
    pageText: stripTags(html).slice(0, 6000),
  };
}

/* ------------------------------------------------------------ */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Méthode non autorisée" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.email) return json({ ok: false, error: "Session invalide." }, 401);

  const { data: adminRow } = await supabase
    .from("nm_admins")
    .select("email")
    .ilike("email", userData.user.email)
    .maybeSingle();
  if (!adminRow) return json({ ok: false, error: "Accès réservé à l'administrateur." }, 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Corps de requête illisible." }, 400);
  }

  try {
    const action = String(body?.action ?? "");
    if (action === "search") return json({ ok: true, ...(await searchStructures(body?.payload ?? {})) });
    if (action === "inspect") return json({ ok: true, site: await inspectSite(body?.payload ?? {}) });
    return json({ ok: false, error: "Action inconnue." }, 400);
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 502);
  }
});
