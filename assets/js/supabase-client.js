/* ============================================================
   CLIENT SUPABASE PARTAGÉ
   ------------------------------------------------------------
   Un seul point d'entrée pour :
     • l'authentification de l'espace sécurisé (admin, devis,
       factures, quittances, bail, running) ;
     • l'enregistrement des demandes publiques (RDV, brief) ;
     • la lecture/écriture des clients, devis et factures ;
     • l'envoi d'une facture Stripe par e-mail.

   Chargement :
     <script src="config.js"></script>
     <script type="module" src="assets/js/supabase-client.js"></script>

   Utilisation depuis un script classique :
     window.NM.dbReady.then(function (db) { ... });

   Sécurité : la clé utilisée ici est la clé PUBLIQUE. Toutes les
   règles d'accès réelles sont appliquées par les politiques RLS
   de la base (voir migrations nm_portfolio_*).
   ============================================================ */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const CFG = window.APP_CONFIG || {};
const SB = CFG.supabase || {};
const T = SB.tables || {};

const client = createClient(SB.url, SB.anonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
		storageKey: 'nm-portfolio-auth'
	}
});

/* ------------------------------------------------------------
   AUTHENTIFICATION
   ------------------------------------------------------------ */

/** Accepte « nathan » ou « nathan@gmail.com » comme identifiant. */
function normalizeIdentifier(id) {
	const value = String(id || '').trim();
	if (!value) return '';
	return value.includes('@') ? value : value + '@gmail.com';
}

async function signIn(identifier, password) {
	const email = normalizeIdentifier(identifier);
	const { data, error } = await client.auth.signInWithPassword({ email, password });
	if (error) throw error;
	return data.user;
}

async function signOut() {
	await client.auth.signOut();
}

async function currentUser() {
	const { data } = await client.auth.getUser();
	return data && data.user ? data.user : null;
}

/** Vrai si l'utilisateur connecté figure dans la table nm_admins. */
async function isAdmin() {
	const user = await currentUser();
	if (!user) return false;
	const { data, error } = await client.rpc('nm_is_admin');
	if (error) {
		console.warn('nm_is_admin indisponible, repli sur la session :', error.message);
		return true;
	}
	return data === true;
}

function onAuthChange(callback) {
	client.auth.onAuthStateChange((_event, session) => {
		callback(session && session.user ? session.user : null, _event);
	});
}

/**
 * Protège une page réservée à l'administrateur.
 * Renvoie l'utilisateur si la session est valide, sinon redirige.
 */
async function requireAdmin(redirectTo) {
	const user = await currentUser();
	if (!user) {
		const target = redirectTo || ((CFG.pages && CFG.pages.admin) || '/portfolio/admin/');
		const back = encodeURIComponent(window.location.pathname + window.location.search);
		window.location.replace(target + (target.includes('?') ? '&' : '?') + 'suivant=' + back);
		return null;
	}
	return user;
}

async function sendPasswordReset(identifier, redirectTo) {
	const email = normalizeIdentifier(identifier);
	const { error } = await client.auth.resetPasswordForEmail(email, {
		redirectTo: redirectTo || (window.location.origin + ((CFG.pages && CFG.pages.admin) || '/portfolio/admin/'))
	});
	if (error) throw error;
	return true;
}

async function updatePassword(newPassword) {
	const { error } = await client.auth.updateUser({ password: newPassword });
	if (error) throw error;
	return true;
}

/* ------------------------------------------------------------
   DEMANDES PUBLIQUES (RDV découverte, brief projet)
   ------------------------------------------------------------ */

/** Enregistre une demande de rendez-vous. Ne lève jamais : best-effort. */
async function saveLead(payload) {
	try {
		const { data, error } = await client
			.from(T.leads || 'nm_leads')
			.insert(payload)
			.select('id')
			.single();
		if (error) throw error;
		return data.id;
	} catch (e) {
		console.error('saveLead : enregistrement impossible (non bloquant)', e);
		return null;
	}
}

/** Enregistre un brief projet (formulaire kickoff). Best-effort. */
async function saveBrief(payload) {
	try {
		const { data, error } = await client
			.from(T.briefs || 'nm_briefs')
			.insert(payload)
			.select('id')
			.single();
		if (error) throw error;
		return data.id;
	} catch (e) {
		console.error('saveBrief : enregistrement impossible (non bloquant)', e);
		return null;
	}
}

/* ------------------------------------------------------------
   ESPACE ADMINISTRATION (lecture/écriture protégées par RLS)
   ------------------------------------------------------------ */

async function listLeads(options) {
	const opts = options || {};
	let q = client.from(T.leads || 'nm_leads').select('*').order('created_at', { ascending: false });
	if (opts.status) q = q.eq('status', opts.status);
	if (opts.limit) q = q.limit(opts.limit);
	const { data, error } = await q;
	if (error) throw error;
	return data || [];
}

async function updateLead(id, patch) {
	const { error } = await client.from(T.leads || 'nm_leads').update(patch).eq('id', id);
	if (error) throw error;
	return true;
}

async function listClients() {
	const { data, error } = await client
		.from(T.clients || 'nm_clients')
		.select('*')
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data || [];
}

async function getClient(id) {
	const { data, error } = await client.from(T.clients || 'nm_clients').select('*').eq('id', id).single();
	if (error) throw error;
	return data;
}

async function saveClient(record) {
	const table = client.from(T.clients || 'nm_clients');
	const query = record.id
		? table.update(record).eq('id', record.id).select('*').single()
		: table.insert(record).select('*').single();
	const { data, error } = await query;
	if (error) throw error;
	return data;
}

async function deleteClient(id) {
	const { error } = await client.from(T.clients || 'nm_clients').delete().eq('id', id);
	if (error) throw error;
	return true;
}

async function listBriefs(clientId) {
	let q = client.from(T.briefs || 'nm_briefs').select('*').order('created_at', { ascending: false });
	if (clientId) q = q.eq('client_id', clientId);
	const { data, error } = await q;
	if (error) throw error;
	return data || [];
}

/* ------------------------------------------------------------
   DEVIS & FACTURES
   ------------------------------------------------------------ */

async function nextDocumentNumber(kind) {
	const { data, error } = await client.rpc('nm_next_doc_number', { p_kind: kind });
	if (error) throw error;
	return data;
}

async function listDocuments(options) {
	const opts = options || {};
	let q = client.from(T.documents || 'nm_documents').select('*').order('created_at', { ascending: false });
	if (opts.kind) q = q.eq('kind', opts.kind);
	if (opts.clientId) q = q.eq('client_id', opts.clientId);
	if (opts.limit) q = q.limit(opts.limit);
	const { data, error } = await q;
	if (error) throw error;
	return data || [];
}

async function getDocument(id) {
	const { data, error } = await client.from(T.documents || 'nm_documents').select('*').eq('id', id).single();
	if (error) throw error;
	return data;
}

async function saveDocument(record) {
	const table = client.from(T.documents || 'nm_documents');
	const query = record.id
		? table.update(record).eq('id', record.id).select('*').single()
		: table.insert(record).select('*').single();
	const { data, error } = await query;
	if (error) throw error;
	return data;
}

async function deleteDocument(id) {
	const { error } = await client.from(T.documents || 'nm_documents').delete().eq('id', id);
	if (error) throw error;
	return true;
}

/* ------------------------------------------------------------
   FACTURATION STRIPE (via Edge Function sécurisée)
   ------------------------------------------------------------ */

/**
 * Crée la facture chez Stripe et demande à Stripe de l'envoyer par
 * e-mail au client, avec son lien de paiement sécurisé.
 * @returns {Promise<{ok:boolean, hostedUrl?:string, invoiceId?:string, error?:string, code?:string}>}
 */
async function sendStripeInvoice(payload) {
	const fnName = (SB.functions && SB.functions.stripeInvoice) || 'stripe-invoice';
	const { data, error } = await client.functions.invoke(fnName, { body: payload });
	if (error) {
		// L'erreur détaillée est dans le corps de la réponse.
		let detail = error.message;
		try {
			const ctx = await error.context.json();
			detail = ctx.error || detail;
			return { ok: false, error: detail, code: ctx.code };
		} catch (e) { /* corps illisible */ }
		return { ok: false, error: detail };
	}
	return data;
}

/* ------------------------------------------------------------
   Export
   ------------------------------------------------------------ */

const NMDB = {
	client,
	// auth
	signIn, signOut, currentUser, isAdmin, onAuthChange, requireAdmin,
	sendPasswordReset, updatePassword, normalizeIdentifier,
	// public
	saveLead, saveBrief,
	// admin
	listLeads, updateLead,
	listClients, getClient, saveClient, deleteClient, listBriefs,
	// documents
	nextDocumentNumber, listDocuments, getDocument, saveDocument, deleteDocument,
	sendStripeInvoice
};

window.NM = window.NM || {};
window.NM.db = NMDB;
// nm-boot.js a créé la promesse en amont : on la résout ici. Si la page
// n'a pas chargé nm-boot.js, on fournit une promesse déjà résolue.
if (typeof window.NM._resolveDb === 'function') {
	window.NM._resolveDb(NMDB);
} else {
	window.NM.dbReady = Promise.resolve(NMDB);
}
document.dispatchEvent(new CustomEvent('nm:dbready', { detail: NMDB }));

export default NMDB;
