// ============================================================
// stripe-invoice — Édition et envoi d'une facture Stripe
// ------------------------------------------------------------
// Appelée depuis l'espace d'administration du portfolio (et, depuis
// le 17/09/2026, depuis la « facture rapide » de /aide-domicile/).
//
// Sécurité :
//   1. verify_jwt = true  -> un JWT Supabase valide est exigé.
//   2. L'e-mail du porteur du JWT doit figurer dans public.nm_admins.
//   3. La clé secrète Stripe ne vit QUE ici (STRIPE_SECRET_KEY).
//
// Corps attendu (POST JSON) — création :
// {
//   "customer":  { "name": "Club X", "email": "contact@club.fr" },
//   "items":     [{ "description": "Pack Vitrine", "quantity": 1, "amount": 1790 }],
//   "currency":  "eur",
//   "dueDays":   14,
//   "memo":      "Merci de votre confiance",
//   "documentId":"uuid du document côté Supabase (optionnel)",
//   "onsite":    true   // v5 : paiement sur place (e-mail facultatif,
//                       //      QR code / page de paiement ouverte sur le
//                       //      téléphone de Nathan). Si un e-mail est
//                       //      fourni, Stripe l'envoie aussi.
// }
// Réponse : { ok, invoiceId, hostedUrl, pdfUrl, status, livemode, emailed }
//
// Suivi du paiement (v5) : { "action": "status", "invoiceId": "in_..." }
// Réponse : { ok, status, paid, hostedUrl, pdfUrl, amountPaid }
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

// Petit client Stripe minimal (form-urlencoded), sans dépendance externe.
async function stripe(path: string, method: "GET" | "POST", key: string, params?: Record<string, string>) {
  const url = `https://api.stripe.com/v1/${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (params && method === "POST") init.body = new URLSearchParams(params).toString();
  const res = await fetch(method === "GET" && params ? `${url}?${new URLSearchParams(params)}` : url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe ${path} a répondu ${res.status}`);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Méthode non autorisée" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return json({
      ok: false,
      code: "stripe_not_configured",
      error:
        "Clé Stripe absente. Ajoutez STRIPE_SECRET_KEY dans Supabase > Edge Functions > Secrets, puis réessayez.",
    }, 503);
  }

  // --- Contrôle d'identité : JWT Supabase + appartenance à nm_admins ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.email) {
    return json({ ok: false, error: "Session invalide." }, 401);
  }

  const { data: adminRow } = await supabase
    .from("nm_admins")
    .select("email")
    .ilike("email", userData.user.email)
    .maybeSingle();

  if (!adminRow) return json({ ok: false, error: "Accès réservé à l'administrateur." }, 403);

  // --- Lecture et validation du corps ---
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Corps de requête illisible." }, 400);
  }

  // --- v5 : suivi du paiement d'une facture existante ---
  if (body?.action === "status") {
    const invoiceId = String(body?.invoiceId ?? "");
    if (!/^in_[A-Za-z0-9]+$/.test(invoiceId)) return json({ ok: false, error: "Identifiant de facture invalide." }, 400);
    try {
      const inv = await stripe(`invoices/${invoiceId}`, "GET", stripeKey);
      return json({
        ok: true,
        status: inv.status,
        paid: inv.status === "paid",
        hostedUrl: inv.hosted_invoice_url,
        pdfUrl: inv.invoice_pdf,
        amountPaid: (inv.amount_paid ?? 0) / 100,
      });
    } catch (err) {
      return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 502);
    }
  }

  const onsite = body?.onsite === true;
  const email = String(body?.customer?.email ?? "").trim();
  const name = String(body?.customer?.name ?? "").trim();
  const items = Array.isArray(body?.items) ? body.items : [];
  const currency = String(body?.currency ?? "eur").toLowerCase();
  const dueDays = Number.isFinite(body?.dueDays) ? Math.max(0, Math.min(90, Number(body.dueDays))) : 14;
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  if (!onsite && !emailValid) {
    return json({ ok: false, error: "E-mail client manquant ou invalide." }, 400);
  }
  if (onsite && email && !emailValid) {
    return json({ ok: false, error: "E-mail client invalide." }, 400);
  }
  if (onsite && !name && !email) {
    return json({ ok: false, error: "Indiquez au moins le nom du client." }, 400);
  }
  if (!items.length) return json({ ok: false, error: "Aucune ligne à facturer." }, 400);

  try {
    // 1. Client Stripe (réutilisé s'il existe déjà, si on a son e-mail)
    let customerId = "";
    if (emailValid) {
      const found = await stripe("customers", "GET", stripeKey, { email, limit: "1" });
      customerId = found?.data?.[0]?.id ?? "";
      if (!customerId) {
        const created = await stripe("customers", "POST", stripeKey, { email, name: name || email });
        customerId = created.id;
      } else if (name) {
        await stripe(`customers/${customerId}`, "POST", stripeKey, { name });
      }
    } else {
      const params: Record<string, string> = { name };
      if (body?.customer?.phone) params.phone = String(body.customer.phone).slice(0, 30);
      const created = await stripe("customers", "POST", stripeKey, params);
      customerId = created.id;
    }

    // 2. Facture au brouillon (pas de prélèvement automatique)
    const invoiceParams: Record<string, string> = {
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: String(onsite ? Math.max(1, dueDays || 1) : dueDays),
      currency,
      auto_advance: "false",
    };
    if (body?.memo) invoiceParams.description = String(body.memo).slice(0, 1500);
    if (body?.documentId) invoiceParams["metadata[document_id]"] = String(body.documentId);
    if (body?.number) invoiceParams["metadata[numero_interne]"] = String(body.number);
    if (onsite) invoiceParams["metadata[paiement]"] = "sur_place";

    const invoice = await stripe("invoices", "POST", stripeKey, invoiceParams);

    // 3. Lignes de facture — `unit_amount_decimal` obligatoire sur ce compte
    //    (`unit_amount` est refusé : voir règle 10 du projet).
    for (const item of items) {
      const unitAmount = Math.round(Number(item.amount) * 100);
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) continue;
      await stripe("invoiceitems", "POST", stripeKey, {
        customer: customerId,
        invoice: invoice.id,
        currency,
        unit_amount_decimal: String(unitAmount),
        quantity: String(Math.max(1, Math.round(Number(item.quantity) || 1))),
        description: String(item.description ?? "Prestation").slice(0, 300),
      });
    }

    // 4. Finalisation (génère la page de paiement), puis envoi par e-mail
    //    si on a une adresse.
    const finalized = await stripe(`invoices/${invoice.id}/finalize`, "POST", stripeKey, {});
    let sent: any = null;
    if (emailValid) {
      sent = await stripe(`invoices/${invoice.id}/send`, "POST", stripeKey, {});
    }
    const last = sent ?? finalized;

    return json({
      ok: true,
      invoiceId: last.id ?? finalized.id,
      hostedUrl: last.hosted_invoice_url ?? finalized.hosted_invoice_url,
      pdfUrl: last.invoice_pdf ?? finalized.invoice_pdf,
      status: last.status ?? finalized.status,
      livemode: last.livemode ?? finalized.livemode ?? false,
      emailed: !!sent,
    });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 502);
  }
});
