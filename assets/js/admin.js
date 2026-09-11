/* ============================================================
   ESPACE D'ADMINISTRATION — clients, devis et factures
   ------------------------------------------------------------
   Trois sections :
     1. Demandes  : ce qui arrive des formulaires du site.
     2. Clients   : la fiche de chaque client (date de début de
                    projet, pack, options, formule de suivi,
                    état du devis et de la facture).
     3. Documents : les devis et factures enregistrés, à
                    recharger ou à envoyer par Stripe.

   Toutes les données viennent de Supabase et sont protégées par
   les politiques RLS : seul un e-mail présent dans nm_admins peut
   les lire ou les modifier.
   ============================================================ */
(function () {
	'use strict';

	var CFG = window.APP_CONFIG || {};
	var db = null;
	var state = { leads: [], clients: [], documents: [] };

	// ------------------------------------------------------------
	// Utilitaires
	// ------------------------------------------------------------
	var $ = function (sel, root) { return (root || document).querySelector(sel); };
	var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

	function esc(value) {
		return String(value === null || value === undefined ? '' : value)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	function money(amount) {
		if (amount === null || amount === undefined || isNaN(amount)) return '—';
		return (window.NM && NM.i18n) ? NM.i18n.format(Number(amount), 'EUR') : Number(amount).toFixed(2) + ' €';
	}

	function shortDate(value) {
		if (!value) return '—';
		var d = new Date(value);
		if (isNaN(d)) return '—';
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
	}

	function toast(message, kind) {
		var el = $('#toast');
		var icon = $('#toast-icon');
		if (!el) return;
		$('#toast-message').textContent = message;
		icon.className = 'text-xl ' + (kind === 'error'
			? 'ph-fill ph-warning-circle text-red-400'
			: 'ph-fill ph-check-circle text-accent-400');
		el.classList.remove('opacity-0', 'pointer-events-none');
		clearTimeout(toast._t);
		toast._t = setTimeout(function () {
			el.classList.add('opacity-0', 'pointer-events-none');
		}, kind === 'error' ? 6000 : 3500);
	}

	function packLabel(key) {
		var offer = (CFG.offers || {})[key];
		if (offer) return offer.name;
		if (key === 'club') return (CFG.club && CFG.club.name) || 'Offre Club';
		if (key === 'existing') return 'Site existant (suivi seul)';
		return key || '—';
	}

	function serenityLabel(tier, cycle) {
		if (!tier) return null;
		var offer = (CFG.offers || {})[tier === 'plus' ? 'serenitePlus' : 'serenite'];
		if (!offer) return null;
		var annual = cycle === 'annual';
		var amount = annual ? offer.annualPrice.EUR : offer.price.EUR;
		return offer.name + ' — ' + money(amount) + (annual ? ' / an' : ' / mois');
	}

	// Toutes les options proposées sur le site, dans un seul tableau.
	function allOptions() {
		return (CFG.documentOptions || []).map(function (o) {
			return { key: 'doc:' + o.key, label: o.label, priceEur: o.priceEur, family: 'documents' };
		}).concat((CFG.clubOptions || []).map(function (o) {
			return { key: 'club:' + o.key, label: o.label, priceEur: o.priceEur, family: 'club' };
		}));
	}

	// ------------------------------------------------------------
	// 1. Authentification
	// ------------------------------------------------------------
	async function guard() {
		db = await window.NM.dbReady;

		// Retour depuis un e-mail de réinitialisation de mot de passe.
		if (/type=recovery/.test(window.location.hash)) {
			$('#auth-spinner').classList.add('hidden');
			$('#recovery-form').classList.remove('hidden');
			return false;
		}

		var user = await db.currentUser();
		if (!user) {
			$('#auth-spinner').classList.add('hidden');
			$('#auth-form').classList.remove('hidden');
			$('#auth-id').focus();
			return false;
		}

		var admin = await db.isAdmin();
		if (!admin) {
			$('#auth-spinner').classList.add('hidden');
			$('#auth-form').classList.remove('hidden');
			authMessage("Ce compte n'a pas accès à l'espace d'administration.");
			await db.signOut();
			return false;
		}

		$('#auth-loader').style.display = 'none';
		$('#secure-content').style.display = 'block';
		return true;
	}

	function authMessage(text) {
		var el = $('#auth-msg');
		el.querySelector('span').textContent = text;
		el.classList.remove('hidden');
	}

	function setupAuthForms() {
		$('#auth-form').addEventListener('submit', async function (e) {
			e.preventDefault();
			$('#auth-msg').classList.add('hidden');
			var btn = e.target.querySelector('button[type="submit"]');
			btn.disabled = true;
			try {
				await db.signIn($('#auth-id').value, $('#auth-pass').value);
				window.location.reload();
			} catch (err) {
				authMessage(/Invalid login/i.test(err.message || '')
					? 'Identifiant ou mot de passe incorrect.'
					: 'Connexion impossible : ' + (err.message || 'erreur inconnue'));
				btn.disabled = false;
			}
		});

		$('#auth-reset').addEventListener('click', async function () {
			var id = $('#auth-id').value.trim();
			if (!id) { authMessage('Saisissez d’abord votre identifiant.'); return; }
			try {
				await db.sendPasswordReset(id, window.location.origin + window.location.pathname);
				authMessage('Lien de réinitialisation envoyé. Consultez votre boîte mail.');
			} catch (err) {
				authMessage('Envoi impossible : ' + (err.message || 'erreur inconnue'));
			}
		});

		$('#recovery-form').addEventListener('submit', async function (e) {
			e.preventDefault();
			try {
				await db.updatePassword($('#recovery-pass').value);
				window.location.hash = '';
				window.location.reload();
			} catch (err) {
				var msg = $('#recovery-msg');
				msg.textContent = 'Impossible d’enregistrer : ' + (err.message || 'erreur inconnue');
				msg.classList.remove('hidden');
			}
		});

		$('#logout-btn').addEventListener('click', async function () {
			await db.signOut();
			window.location.reload();
		});
	}

	// ------------------------------------------------------------
	// 2. Chargement des données
	// ------------------------------------------------------------
	async function loadAll() {
		try {
			var results = await Promise.all([db.listLeads({}), db.listClients(), db.listDocuments({})]);
			state.leads = results[0];
			state.clients = results[1];
			state.documents = results[2];
		} catch (err) {
			console.error(err);
			toast('Chargement impossible : ' + (err.message || 'erreur réseau'), 'error');
			return;
		}
		renderStats();
		renderLeads();
		renderClients();
		renderDocuments();
	}

	function renderStats() {
		var pending = state.leads.filter(function (l) { return l.status === 'nouveau'; }).length;
		var actifs = state.clients.filter(function (c) { return c.status !== 'archive'; }).length;
		var quotes = state.documents.filter(function (d) { return d.kind === 'devis' && d.status !== 'accepte' && d.status !== 'refuse'; }).length;
		var year = new Date().getFullYear();
		var revenue = state.documents
			.filter(function (d) { return d.kind === 'facture' && new Date(d.issue_date).getFullYear() === year; })
			.reduce(function (sum, d) { return sum + Number(d.total_ttc || 0); }, 0);

		$('#stat-leads').textContent = pending;
		$('#stat-clients').textContent = actifs;
		$('#stat-quotes').textContent = quotes;
		$('#stat-revenue').textContent = money(revenue);
		$('#count-leads').textContent = state.leads.length;
		$('#count-clients').textContent = state.clients.length;
		$('#count-documents').textContent = state.documents.length;
	}

	// ------------------------------------------------------------
	// 3. Demandes
	// ------------------------------------------------------------
	var LEAD_STATUS = {
		nouveau: { label: 'Nouveau', cls: 'nm-badge--accent' },
		traite: { label: 'Traité', cls: 'nm-badge--info' },
		converti: { label: 'Client', cls: 'nm-badge--ok' },
		perdu: { label: 'Sans suite', cls: 'nm-badge--neutral' }
	};

	function leadSummary(lead) {
		var bits = [packLabel(lead.pack)];
		if (lead.serenity_tier) bits.push(serenityLabel(lead.serenity_tier, lead.serenity_cycle));
		(lead.documents || []).forEach(function (d) { bits.push('Doc : ' + d); });
		(lead.club_options || []).forEach(function (o) { bits.push('Module : ' + o); });
		if (lead.intervention_type) bits.push('Intervention : ' + lead.intervention_type);
		return bits.filter(Boolean).join(' · ');
	}

	function renderLeads() {
		var body = $('#leads-body');
		if (!state.leads.length) {
			body.innerHTML = '<tr><td colspan="7" class="text-slate-500 italic">Aucune demande pour le moment.</td></tr>';
			return;
		}
		body.innerHTML = state.leads.map(function (lead) {
			var st = LEAD_STATUS[lead.status] || LEAD_STATUS.nouveau;
			return '<tr data-lead="' + lead.id + '">' +
				'<td class="whitespace-nowrap">' + shortDate(lead.created_at) +
					'<span class="block text-[10px] text-slate-500">' + esc(lead.source || '') + '</span></td>' +
				'<td><strong class="text-white">' + esc((lead.first_name || '') + ' ' + (lead.last_name || '')) + '</strong>' +
					(lead.organisation ? '<span class="block text-[11px] text-slate-500">' + esc(lead.organisation) + '</span>' : '') +
					'<span class="block text-[11px]"><a class="hover:text-accent-400" href="mailto:' + esc(lead.email) + '">' + esc(lead.email) + '</a></span>' +
					(lead.phone ? '<span class="block text-[11px] text-slate-500">' + esc(lead.phone) + '</span>' : '') +
				'</td>' +
				'<td class="whitespace-nowrap">' + esc(lead.rdv_label || '—') + '</td>' +
				'<td class="max-w-[280px]"><span class="text-[11px] leading-snug block">' + esc(leadSummary(lead)) + '</span>' +
					(lead.message ? '<span class="block text-[10px] text-slate-500 mt-1 line-clamp-2">' + esc(lead.message) + '</span>' : '') + '</td>' +
				'<td class="whitespace-nowrap">' + money(lead.estimated_total) + '</td>' +
				'<td>' +
					'<select class="nm-status-select nm-status-select--' + lead.status + '" data-lead-status="' + lead.id + '" aria-label="Statut de la demande">' +
						Object.keys(LEAD_STATUS).map(function (k) {
							return '<option value="' + k + '"' + (k === lead.status ? ' selected' : '') + '>' +
								LEAD_STATUS[k].label + '</option>';
						}).join('') +
					'</select>' +
				'</td>' +
				'<td class="whitespace-nowrap text-right">' +
					'<div class="flex flex-wrap items-center justify-end gap-1.5">' +
						'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="lead-quote" data-id="' + lead.id + '" title="Créer un devis pré-rempli à partir de cette demande">' +
							'<i class="ph-bold ph-file-text" aria-hidden="true"></i> Devis</button>' +
						'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="lead-invoice" data-id="' + lead.id + '" title="Créer une facture pré-remplie à partir de cette demande">' +
							'<i class="ph-bold ph-receipt" aria-hidden="true"></i> Facture</button>' +
						'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="lead-convert" data-id="' + lead.id + '" title="Créer la fiche client à partir de cette demande">' +
							'<i class="ph-bold ph-user-plus" aria-hidden="true"></i> Fiche client</button>' +
					'</div>' +
				'</td>' +
			'</tr>';
		}).join('');

		bindLeadStatusSelects();
	}

	function bindLeadStatusSelects() {
		$$('[data-lead-status]').forEach(function (sel) {
			sel.addEventListener('change', async function () {
				var id = sel.dataset.leadStatus;
				var value = sel.value;
				var lead = state.leads.filter(function (l) { return l.id === id; })[0];

				// Passer une demande sur « Client » ne doit pas se contenter
				// de changer une étiquette : ça n'aurait créé aucune fiche
				// client. On ouvre directement la fiche pré-remplie ; le
				// statut ne change vraiment qu'une fois qu'elle est
				// enregistrée (sinon on revient à l'ancien statut affiché).
				if (value === 'converti') {
					sel.value = (lead && lead.status) || 'nouveau';
					if (lead) openClientModal(leadToClient(lead), lead);
					return;
				}

				try {
					await db.updateLead(id, { status: value });
					if (lead) lead.status = value;
					toast('Statut mis à jour : ' + (LEAD_STATUS[value] || {}).label + '.');
					renderStats();
					renderLeads();
				} catch (err) {
					toast('Changement impossible : ' + (err.message || 'erreur inconnue'), 'error');
					renderLeads();
				}
			});
		});
	}

	// ------------------------------------------------------------
	// 4. Clients
	// ------------------------------------------------------------
	var CLIENT_STATUS = {
		prospect: { label: 'Prospect', cls: 'nm-badge--neutral' },
		devis_envoye: { label: 'Devis envoyé', cls: 'nm-badge--info' },
		signe: { label: 'Devis signé', cls: 'nm-badge--accent' },
		en_cours: { label: 'En cours', cls: 'nm-badge--warn' },
		livre: { label: 'Livré', cls: 'nm-badge--ok' },
		archive: { label: 'Archivé', cls: 'nm-badge--neutral' }
	};

	function clientDocs(clientId) {
		return state.documents.filter(function (d) { return d.client_id === clientId; });
	}

	function renderClients() {
		var grid = $('#clients-grid');
		var needle = ($('#client-search').value || '').toLowerCase().trim();
		var list = state.clients.filter(function (c) {
			if (!needle) return true;
			return [c.first_name, c.last_name, c.organisation, c.email].join(' ').toLowerCase().indexOf(needle) !== -1;
		});

		if (!list.length) {
			grid.innerHTML = '<p class="text-slate-500 italic text-sm">' +
				(state.clients.length ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client pour le moment : convertissez une demande depuis l’onglet « Demandes ».') +
				'</p>';
			return;
		}

		grid.innerHTML = list.map(function (c) {
			var st = CLIENT_STATUS[c.status] || CLIENT_STATUS.prospect;
			var docs = clientDocs(c.id);
			var devis = docs.filter(function (d) { return d.kind === 'devis'; })[0];
			var facture = docs.filter(function (d) { return d.kind === 'facture'; })[0];
			var options = (c.options || []);
			var serenity = serenityLabel(c.serenity_tier, c.serenity_cycle);

			return '<article class="glass-card p-5 border border-slate-500/15 flex flex-col gap-3">' +
				'<header class="flex items-start justify-between gap-3">' +
					'<div class="min-w-0">' +
						'<h3 class="font-display font-bold text-white leading-tight truncate">' +
							esc(c.organisation || ((c.first_name || '') + ' ' + (c.last_name || '')).trim() || 'Client') + '</h3>' +
						(c.organisation ? '<p class="text-[11px] text-slate-500 truncate">' + esc(((c.first_name || '') + ' ' + (c.last_name || '')).trim()) + '</p>' : '') +
					'</div>' +
					'<span class="nm-badge ' + st.cls + '">' + st.label + '</span>' +
				'</header>' +

				'<dl class="text-[11px] space-y-1.5">' +
					'<div class="flex gap-2"><dt class="text-slate-500 w-24 shrink-0">Début projet</dt>' +
						'<dd class="text-white font-bold">' + (c.project_start ? shortDate(c.project_start) : 'à planifier') + '</dd></div>' +
					'<div class="flex gap-2"><dt class="text-slate-500 w-24 shrink-0">Pack</dt>' +
						'<dd class="text-white">' + esc(packLabel(c.pack)) + ' <span class="text-slate-500">' + (c.pack_price ? '· ' + money(c.pack_price) : '') + '</span></dd></div>' +
					'<div class="flex gap-2"><dt class="text-slate-500 w-24 shrink-0">Suivi</dt>' +
						'<dd class="' + (serenity ? 'text-blue-300' : 'text-slate-500') + '">' + esc(serenity || 'aucun') + '</dd></div>' +
					'<div class="flex gap-2"><dt class="text-slate-500 w-24 shrink-0">Options</dt>' +
						'<dd class="text-slate-300">' + (options.length
							? options.map(function (o) { return esc(o.label); }).join(', ')
							: '<span class="text-slate-500">aucune</span>') + '</dd></div>' +
					'<div class="flex gap-2"><dt class="text-slate-500 w-24 shrink-0">Total création</dt>' +
						'<dd class="text-accent-400 font-bold">' + money(c.total_one_time) + '</dd></div>' +
					(c.email ? '<div class="flex gap-2"><dt class="text-slate-500 w-24 shrink-0">Contact</dt>' +
						'<dd class="truncate"><a class="hover:text-accent-400" href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></dd></div>' : '') +
				'</dl>' +

				'<div class="flex flex-wrap gap-1.5 text-[10px]">' +
					'<span class="nm-badge ' + (devis ? 'nm-badge--info' : 'nm-badge--neutral') + '">' +
						'Devis : ' + (devis ? esc(devis.number) + ' · ' + docStatusLabel(devis.status) : 'aucun') + '</span>' +
					'<span class="nm-badge ' + (facture ? (facture.status === 'payee' ? 'nm-badge--ok' : 'nm-badge--warn') : 'nm-badge--neutral') + '">' +
						'Facture : ' + (facture ? esc(facture.number) + ' · ' + docStatusLabel(facture.status) : 'aucune') + '</span>' +
				'</div>' +

				'<div class="flex flex-wrap gap-2 mt-auto pt-2">' +
					'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="client-edit" data-id="' + c.id + '"><i class="ph-bold ph-pencil-simple" aria-hidden="true"></i> Modifier</button>' +
					'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="client-quote" data-id="' + c.id + '"><i class="ph-bold ph-file-text" aria-hidden="true"></i> ' + (devis ? 'Rouvrir le devis' : 'Générer le devis') + '</button>' +
					'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="client-invoice" data-id="' + c.id + '"><i class="ph-bold ph-receipt" aria-hidden="true"></i> ' + (facture ? 'Rouvrir la facture' : 'Créer la facture') + '</button>' +
				'</div>' +
			'</article>';
		}).join('');
	}

	// ------------------------------------------------------------
	// 5. Devis & factures
	// ------------------------------------------------------------
	var DOC_STATUS = {
		brouillon: { label: 'Brouillon', cls: 'nm-badge--neutral' },
		envoye: { label: 'Envoyé', cls: 'nm-badge--info' },
		accepte: { label: 'Accepté', cls: 'nm-badge--ok' },
		refuse: { label: 'Refusé', cls: 'nm-badge--danger' },
		payee: { label: 'Payée', cls: 'nm-badge--ok' }
	};
	function docStatusLabel(status) { return (DOC_STATUS[status] || DOC_STATUS.brouillon).label; }

	function renderDocuments() {
		var body = $('#documents-body');
		var filter = $('#doc-filter').value;
		var list = state.documents.filter(function (d) { return !filter || d.kind === filter; });

		if (!list.length) {
			body.innerHTML = '<tr><td colspan="7" class="text-slate-500 italic">Aucun document enregistré.</td></tr>';
			return;
		}

		body.innerHTML = list.map(function (d) {
			var st = DOC_STATUS[d.status] || DOC_STATUS.brouillon;
			var isInvoice = d.kind === 'facture';
			return '<tr>' +
				'<td class="whitespace-nowrap font-bold text-white">' + esc(d.number) + '</td>' +
				'<td><span class="nm-badge ' + (isInvoice ? 'nm-badge--warn' : 'nm-badge--info') + '">' + (isInvoice ? 'Facture' : 'Devis') + '</span></td>' +
				'<td>' + esc(d.client_name || '—') + (d.client_email ? '<span class="block text-[10px] text-slate-500">' + esc(d.client_email) + '</span>' : '') + '</td>' +
				'<td class="whitespace-nowrap">' + shortDate(d.issue_date) + '</td>' +
				'<td class="whitespace-nowrap font-bold">' + money(d.total_ttc) + '</td>' +
				'<td><span class="nm-badge ' + st.cls + '">' + st.label + '</span>' +
					(d.stripe_hosted_url ? '<a class="block text-[10px] text-accent-400 hover:underline mt-1" target="_blank" rel="noopener" href="' + esc(d.stripe_hosted_url) + '">lien de paiement</a>' : '') + '</td>' +
				'<td class="whitespace-nowrap text-right">' +
					'<a class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" href="../contrat/devis&amp;contrat/?doc=' + encodeURIComponent(d.id) + '"><i class="ph-bold ph-arrow-square-out" aria-hidden="true"></i> Ouvrir</a> ' +
					(isInvoice
						? '<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="doc-send" data-id="' + d.id + '"><i class="ph-bold ph-paper-plane-right" aria-hidden="true"></i> Envoyer</button> '
						: '') +
					'<button class="btn-ghost btn-danger !py-1.5 !px-2.5 !text-[11px]" data-action="doc-delete" data-id="' + d.id + '" title="Supprimer"><i class="ph-bold ph-trash" aria-hidden="true"></i></button>' +
				'</td>' +
			'</tr>';
		}).join('');
	}

	// ------------------------------------------------------------
	// 6. Fiche client (modale)
	// ------------------------------------------------------------
	function fillPackSelect() {
		var sel = $('#cf-pack');
		var options = ['<option value="">—</option>'];
		(CFG.packOrder || []).forEach(function (key) {
			options.push('<option value="' + key + '">' + esc(CFG.offers[key].name) + '</option>');
		});
		options.push('<option value="club">' + esc((CFG.club && CFG.club.name) || 'Offre Club') + '</option>');
		options.push('<option value="existing">Site existant (suivi seul)</option>');
		sel.innerHTML = options.join('');
	}

	function fillOptionsGrid(selectedKeys) {
		var grid = $('#cf-options');
		grid.innerHTML = allOptions().map(function (o) {
			var checked = selectedKeys.indexOf(o.key) !== -1 ? ' checked' : '';
			return '<label class="chk-label !p-2 text-[11px]">' +
				'<input type="checkbox" class="chk-input" value="' + o.key + '" data-price="' + o.priceEur + '" data-label="' + esc(o.label) + '"' + checked + '>' +
				'<span class="text-slate-300">' + esc(o.label) +
					'<span class="block text-[10px] text-slate-500">' + money(o.priceEur) + '</span></span>' +
			'</label>';
		}).join('');
		grid.addEventListener('change', refreshModalTotal);
	}

	function collectOptions() {
		return $$('#cf-options input:checked').map(function (input) {
			return { key: input.value, label: input.dataset.label, price: Number(input.dataset.price) };
		});
	}

	function refreshModalTotal() {
		var packKey = $('#cf-pack').value;
		var offer = (CFG.offers || {})[packKey === 'club' ? (CFG.club.baseOfferKey) : packKey];
		var packPrice = offer && offer.type === 'one_time' ? offer.price.EUR : 0;
		var optionsTotal = collectOptions().reduce(function (s, o) { return s + o.price; }, 0);
		$('#cf-total').textContent = money(packPrice + optionsTotal);

		var serenity = serenityLabel($('#cf-serenity').value, $('#cf-cycle').value);
		$('#cf-recurring').innerHTML = serenity ? '· suivi : <strong class="text-blue-300">' + esc(serenity) + '</strong>' : '';
	}

	function openLeadModal() {
		var modal = $('#lead-modal');
		if (!modal) return;
		$('#lf-error').classList.add('hidden');
		$('#lf-firstname').value = '';
		$('#lf-lastname').value = '';
		$('#lf-org').value = '';
		$('#lf-email').value = '';
		$('#lf-phone').value = '';
		$('#lf-date').value = '';
		$('#lf-time').value = '09:00';
		$('#lf-message').value = '';
		modal.showModal();
	}

	async function saveLeadFromModal(e) {
		e.preventDefault();
		var firstname = ($('#lf-firstname').value || '').trim();
		var lastname = ($('#lf-lastname').value || '').trim();
		var date = $('#lf-date').value;
		var time = $('#lf-time').value;
		var errEl = $('#lf-error');

		if (!firstname && !lastname) {
			errEl.textContent = 'Merci de renseigner au moins un nom.';
			errEl.classList.remove('hidden');
			return;
		}
		if (!date || !time) {
			errEl.textContent = 'Merci de choisir une date et un créneau.';
			errEl.classList.remove('hidden');
			return;
		}

		var dateObj = new Date(date + 'T00:00:00');
		var dateLabel = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

		try {
			await db.client.from('nm_leads').insert({
				source: 'manuel',
				request_type: 'newsite',
				first_name: firstname,
				last_name: lastname,
				organisation: ($('#lf-org').value || '').trim() || null,
				email: ($('#lf-email').value || '').trim() || null,
				phone: ($('#lf-phone').value || '').trim() || null,
				rdv_date: date,
				rdv_time: time,
				rdv_label: dateLabel + ' à ' + time,
				message: ($('#lf-message').value || '').trim() || null,
				status: 'nouveau'
			});
			$('#lead-modal').close();
			toast('Rendez-vous ajouté — le créneau est désormais bloqué sur le site.');
			await loadAll();
		} catch (err) {
			errEl.textContent = 'Enregistrement impossible : ' + (err.message || 'erreur inconnue');
			errEl.classList.remove('hidden');
		}
	}

	function openClientModal(client, fromLead) {
		var modal = $('#client-modal');
		$('#client-modal-title').textContent = client && client.id ? 'Modifier la fiche client' : 'Nouvelle fiche client';
		$('#cf-error').classList.add('hidden');

		var c = client || {};
		$('#cf-id').value = c.id || '';
		$('#cf-lead').value = (fromLead && fromLead.id) || c.lead_id || '';
		$('#cf-firstname').value = c.first_name || '';
		$('#cf-lastname').value = c.last_name || '';
		$('#cf-org').value = c.organisation || '';
		$('#cf-email').value = c.email || '';
		$('#cf-phone').value = c.phone || '';
		$('#cf-address').value = c.address || '';
		$('#cf-start').value = c.project_start || '';
		$('#cf-delivery').value = c.delivery_date || '';
		$('#cf-status').value = c.status || 'prospect';
		$('#cf-notes').value = c.notes || '';
		$('#cf-serenity').value = c.serenity_tier || '';
		$('#cf-cycle').value = c.serenity_cycle || 'annual';

		fillPackSelect();
		$('#cf-pack').value = c.pack || '';

		fillOptionsGrid((c.options || []).map(function (o) { return o.key; }));
		refreshModalTotal();
		modal.showModal();
	}

	function leadToClient(lead) {
		var options = [];
		(lead.documents || []).forEach(function (label) {
			var opt = (CFG.documentOptions || []).filter(function (o) {
				return label.toLowerCase().indexOf(o.key) !== -1 || o.label.toLowerCase() === label.toLowerCase();
			})[0];
			options.push({ key: 'doc:' + (opt ? opt.key : 'sur-mesure'), label: opt ? opt.label : label, price: opt ? opt.priceEur : 100 });
		});
		(lead.club_options || []).forEach(function (label) {
			var opt = (CFG.clubOptions || []).filter(function (o) { return o.label === label || o.key === label; })[0];
			options.push({ key: 'club:' + (opt ? opt.key : label), label: opt ? opt.label : label, price: opt ? opt.priceEur : 100 });
		});

		return {
			first_name: lead.first_name,
			last_name: lead.last_name,
			organisation: lead.organisation,
			email: lead.email,
			phone: lead.phone,
			pack: lead.pack,
			pack_price: lead.pack_price,
			serenity_tier: lead.serenity_tier,
			serenity_cycle: lead.serenity_cycle,
			options: options,
			status: 'prospect',
			source: lead.source,
			notes: lead.message || '',
			lead_id: lead.id
		};
	}

	/**
	 * Retrouve la fiche client déjà liée à cette demande, ou en crée une
	 * automatiquement (sans passer par la modale) pour permettre le
	 * « un clic → devis pré-rempli » depuis la liste des demandes.
	 */
	async function getOrCreateClientForLead(lead) {
		if (lead.client_id) {
			var existing = state.clients.filter(function (c) { return c.id === lead.client_id; })[0];
			if (existing) return existing;
			try {
				var fetched = await db.getClient(lead.client_id);
				if (fetched) { state.clients.push(fetched); return fetched; }
			} catch (e) { /* fiche introuvable (supprimée ?) : on en recrée une */ }
		}

		var payload = leadToClient(lead);
		delete payload.lead_id; // nm_clients n'a pas cette colonne — voir saveClientFromModal.

		var offer = (CFG.offers || {})[payload.pack === 'club' ? CFG.club.baseOfferKey : payload.pack];
		var packPrice = offer && offer.type === 'one_time' ? offer.price.EUR : null;
		var optionsTotal = (payload.options || []).reduce(function (s, o) { return s + o.price; }, 0);
		payload.pack_label = payload.pack ? packLabel(payload.pack) : null;
		payload.pack_price = packPrice;
		payload.currency = 'EUR';
		payload.options_total = optionsTotal;
		payload.total_one_time = (packPrice || 0) + optionsTotal;

		var saved = await db.saveClient(payload);
		await db.updateLead(lead.id, { status: 'converti', client_id: saved.id });
		lead.status = 'converti';
		lead.client_id = saved.id;
		state.clients.unshift(saved);
		renderStats();
		renderClients();
		renderLeads();
		toast('Fiche client créée automatiquement à partir de la demande.');
		return saved;
	}

	async function saveClientFromModal(e) {
		e.preventDefault();
		var options = collectOptions();
		var packKey = $('#cf-pack').value;
		var offer = (CFG.offers || {})[packKey === 'club' ? CFG.club.baseOfferKey : packKey];
		var packPrice = offer && offer.type === 'one_time' ? offer.price.EUR : null;
		var optionsTotal = options.reduce(function (s, o) { return s + o.price; }, 0);
		var serenityOffer = (CFG.offers || {})[$('#cf-serenity').value === 'plus' ? 'serenitePlus' : 'serenite'];
		var serenityPrice = $('#cf-serenity').value
			? ($('#cf-cycle').value === 'annual' ? serenityOffer.annualPrice.EUR : serenityOffer.price.EUR)
			: null;

		var record = {
			first_name: $('#cf-firstname').value.trim() || null,
			last_name: $('#cf-lastname').value.trim() || null,
			organisation: $('#cf-org').value.trim() || null,
			email: $('#cf-email').value.trim() || null,
			phone: $('#cf-phone').value.trim() || null,
			address: $('#cf-address').value.trim() || null,
			pack: packKey || null,
			pack_label: packKey ? packLabel(packKey) : null,
			pack_price: packPrice,
			currency: 'EUR',
			serenity_tier: $('#cf-serenity').value || null,
			serenity_cycle: $('#cf-serenity').value ? $('#cf-cycle').value : null,
			serenity_price: serenityPrice,
			options: options,
			options_total: optionsTotal,
			total_one_time: (packPrice || 0) + optionsTotal,
			project_start: $('#cf-start').value || null,
			delivery_date: $('#cf-delivery').value || null,
			status: $('#cf-status').value,
			notes: $('#cf-notes').value.trim() || null
		};
		if ($('#cf-id').value) record.id = $('#cf-id').value;
		// Remarque : nm_clients n'a pas de colonne lead_id — le lien se
		// fait dans l'autre sens (nm_leads.client_id). L'envoyer ici
		// faisait échouer silencieusement TOUT enregistrement de fiche
		// client venant d'une demande (colonne inexistante refusée par
		// Supabase) : c'était la cause du « aucun client enregistré ».
		var originLeadId = $('#cf-lead').value || '';

		try {
			var savedClient = await db.saveClient(record);
			if (originLeadId) {
				await db.updateLead(originLeadId, { status: 'converti', client_id: savedClient.id });
			}
			$('#client-modal').close();
			toast('Fiche client enregistrée.');
			await loadAll();
		} catch (err) {
			console.error(err);
			var el = $('#cf-error');
			el.textContent = 'Enregistrement impossible : ' + (err.message || 'erreur inconnue');
			el.classList.remove('hidden');
		}
	}

	// ------------------------------------------------------------
	// 7. Devis & factures : génération et envoi
	// ------------------------------------------------------------
	async function createDocumentForClient(client, kind) {
		var existing = clientDocs(client.id).filter(function (d) { return d.kind === kind; })[0];
		if (existing) {
			window.location.href = '../contrat/devis&contrat/?doc=' + encodeURIComponent(existing.id);
			return;
		}

		var draft = NM.quote.build({
			pack: client.pack === 'club' ? CFG.club.baseOfferKey : client.pack,
			documents: (client.options || []).filter(function (o) { return o.key.indexOf('doc:') === 0; })
				.map(function (o) { return o.label; }),
			club_options: (client.options || []).filter(function (o) { return o.key.indexOf('club:') === 0; })
				.map(function (o) { return o.label; }),
			serenity_tier: client.serenity_tier,
			serenity_cycle: client.serenity_cycle
		});

		if (!draft.items.length) {
			toast('Renseignez d’abord un pack ou des options sur la fiche client.', 'error');
			return;
		}

		try {
			var number = await db.nextDocumentNumber(kind);
			var totalHt = draft.items.reduce(function (s, it) { return s + it.qty * it.price; }, 0);
			var doc = await db.saveDocument({
				kind: kind,
				number: number,
				client_id: client.id,
				lead_id: client.lead_id || null,
				client_name: client.organisation || ((client.first_name || '') + ' ' + (client.last_name || '')).trim(),
				client_address: client.address || '',
				client_email: client.email || '',
				issue_date: new Date().toISOString().slice(0, 10),
				items: draft.items.map(function (it) { return { desc: it.desc, qty: it.qty, price: it.price }; }),
				vat_applied: false,
				total_ht: totalHt,
				total_ttc: totalHt,
				currency: 'EUR',
				status: 'brouillon'
			});
			toast((kind === 'devis' ? 'Devis' : 'Facture') + ' ' + number + ' créé — ouverture de l’éditeur…');
			window.location.href = '../contrat/devis&contrat/?doc=' + encodeURIComponent(doc.id);
		} catch (err) {
			console.error(err);
			toast('Création impossible : ' + (err.message || 'erreur inconnue'), 'error');
		}
	}

	async function sendInvoice(doc) {
		if (!doc.client_email) {
			toast('Ajoutez d’abord l’e-mail du client sur la facture.', 'error');
			return;
		}
		if (!window.confirm('Envoyer la facture ' + doc.number + ' à ' + doc.client_email + ' ?\n\nStripe enverra l’e-mail avec le lien de paiement.')) return;

		toast('Envoi en cours…');
		var res = await db.sendStripeInvoice({
			customer: { name: doc.client_name, email: doc.client_email },
			items: (doc.items || []).map(function (it) {
				return { description: it.desc, quantity: it.qty, amount: it.price };
			}),
			currency: (doc.currency || 'EUR').toLowerCase(),
			dueDays: 14,
			number: doc.number,
			documentId: doc.id,
			memo: 'Facture ' + doc.number + ' — Nathan Marzilli'
		});

		if (!res || !res.ok) {
			var message = (res && res.error) || 'Erreur inconnue';
			if (res && res.code === 'stripe_not_configured') {
				message = 'Clé Stripe absente : ajoutez STRIPE_SECRET_KEY dans Supabase → Edge Functions → Secrets.';
			}
			toast('Envoi impossible : ' + message, 'error');
			return;
		}

		try {
			await db.saveDocument({
				id: doc.id,
				status: 'envoye',
				stripe_invoice_id: res.invoiceId,
				stripe_hosted_url: res.hostedUrl,
				stripe_status: res.status,
				sent_at: new Date().toISOString()
			});
			if (doc.client_id) {
				await db.saveClient({ id: doc.client_id, invoice_status: 'envoyee' });
			}
		} catch (err) { console.error(err); }

		toast('Facture envoyée à ' + doc.client_email + (res.livemode ? '' : ' (mode test Stripe).'));
		await loadAll();
	}

	// ------------------------------------------------------------
	// 8. Événements
	// ------------------------------------------------------------
	function setupUI() {
		// Onglets
		$$('.tab-btn').forEach(function (btn) {
			btn.addEventListener('click', function () {
				$$('.tab-btn').forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
				['leads', 'clients', 'documents', 'reglages'].forEach(function (name) {
					$('#tab-' + name).classList.toggle('hidden', name !== btn.dataset.tab);
				});
			});
		});

		$('#client-search').addEventListener('input', renderClients);
		$('#doc-filter').addEventListener('change', renderDocuments);
		$('#new-client-btn').addEventListener('click', function () { openClientModal(null, null); });
		$('#client-form').addEventListener('submit', saveClientFromModal);
		$('#cf-pack').addEventListener('change', refreshModalTotal);
		$('#cf-serenity').addEventListener('change', refreshModalTotal);
		$('#cf-cycle').addEventListener('change', refreshModalTotal);
		var addLeadBtn = $('#add-manual-lead');
		if (addLeadBtn) addLeadBtn.addEventListener('click', openLeadModal);
		var leadForm = $('#lead-form');
		if (leadForm) leadForm.addEventListener('submit', saveLeadFromModal);
		$$('[data-close]').forEach(function (b) {
			b.addEventListener('click', function () {
				var dlg = b.closest('dialog');
				if (dlg) dlg.close();
			});
		});
		$$('[data-refresh]').forEach(function (b) { b.addEventListener('click', loadAll); });

		var saveHooks = $('#save-hooks');
		if (saveHooks) saveHooks.addEventListener('click', saveSettings);
		var testBtn = $('#test-hook');
		if (testBtn) testBtn.addEventListener('click', testHook);
		var savePwd = $('#save-password');
		if (savePwd) savePwd.addEventListener('click', changePassword);

		document.addEventListener('click', async function (e) {
			var btn = e.target.closest('[data-action]');
			if (!btn) return;
			var id = btn.dataset.id;
			var action = btn.dataset.action;

			if (action === 'lead-convert') {
				var lead = state.leads.filter(function (l) { return l.id === id; })[0];
				if (lead) openClientModal(leadToClient(lead), lead);
			} else if (action === 'lead-quote' || action === 'lead-invoice') {
				var leadForDoc = state.leads.filter(function (l) { return l.id === id; })[0];
				if (!leadForDoc) return;
				try {
					var clientForDoc = await getOrCreateClientForLead(leadForDoc);
					await createDocumentForClient(clientForDoc, action === 'lead-quote' ? 'devis' : 'facture');
				} catch (err) {
					console.error(err);
					toast('Création impossible : ' + (err.message || 'erreur inconnue'), 'error');
				}
			} else if (action === 'client-edit') {
				openClientModal(state.clients.filter(function (c) { return c.id === id; })[0], null);
			} else if (action === 'client-quote' || action === 'client-invoice') {
				var client = state.clients.filter(function (c) { return c.id === id; })[0];
				if (client) await createDocumentForClient(client, action === 'client-quote' ? 'devis' : 'facture');
			} else if (action === 'doc-send') {
				var doc = state.documents.filter(function (d) { return d.id === id; })[0];
				if (doc) await sendInvoice(doc);
			} else if (action === 'doc-delete') {
				if (!window.confirm('Supprimer définitivement ce document ?')) return;
				try {
					await db.deleteDocument(id);
					toast('Document supprimé.');
					await loadAll();
				} catch (err) { toast('Suppression impossible : ' + err.message, 'error'); }
			}
		});
	}

	// ------------------------------------------------------------
	// 9. Réglages : branchement des Zaps et mot de passe
	// ------------------------------------------------------------
	async function loadSettings() {
		try {
			var res = await db.client.from('nm_settings').select('key, value');
			if (res.error) throw res.error;
			(res.data || []).forEach(function (row) {
				if (row.key === 'zapier_lead_hook' && $('#hook-lead')) $('#hook-lead').value = row.value || '';
				if (row.key === 'zapier_brief_hook' && $('#hook-brief')) $('#hook-brief').value = row.value || '';
			});
		} catch (err) {
			console.error('Réglages illisibles :', err);
		}
	}

	function settingsHint(message, isError) {
		var el = $('#hooks-hint');
		if (!el) return;
		el.textContent = message || '';
		el.className = 'text-xs ' + (isError ? 'text-red-400' : 'text-emerald-400');
	}

	async function saveSettings() {
		var rows = [
			{ key: 'zapier_lead_hook', value: ($('#hook-lead').value || '').trim(), label: 'URL de notification — nouvelle demande de RDV' },
			{ key: 'zapier_brief_hook', value: ($('#hook-brief').value || '').trim(), label: 'URL de notification — nouveau brief projet' }
		];
		// Accepte toute adresse https (script Google Apps Script, Zapier, ou
		// tout autre service) : on ne connaît pas à l'avance ce que la personne
		// va y brancher, seule l'adresse http en clair est refusée.
		var invalid = rows.filter(function (r) { return r.value && !/^https:\/\//.test(r.value); });
		if (invalid.length) {
			settingsHint('L’adresse doit commencer par https://', true);
			return;
		}
		try {
			var res = await db.client.from('nm_settings').upsert(rows, { onConflict: 'key' });
			if (res.error) throw res.error;
			settingsHint('Enregistré. Les prochaines demandes déclencheront ces notifications.');
		} catch (err) {
			settingsHint('Enregistrement impossible : ' + (err.message || 'erreur inconnue'), true);
		}
	}

	/** Dépose une fausse demande pour vérifier le branchement, puis l'efface. */
	async function testHook() {
		settingsHint('Envoi d’un test…');
		try {
			var res = await db.client.from('nm_leads').insert({
				source: 'test-notification',
				request_type: 'newsite',
				first_name: 'Test',
				last_name: 'Notification',
				email: 'test@example.com',
				phone: '00 00 00 00 00',
				rdv_label: 'Test de branchement — à ignorer',
				pack: 'vitrine',
				pack_label: 'Test',
				estimated_total: 0,
				message: 'Demande de test envoyée depuis l’espace d’administration.',
				status: 'perdu'
			}).select('id').single();
			if (res.error) throw res.error;

			settingsHint('Test envoyé. Vérifiez votre agenda et votre boîte mail (ou l’historique du Zap si vous utilisez Zapier).');
			await db.client.from('nm_leads').delete().eq('id', res.data.id);
			await loadAll();
		} catch (err) {
			settingsHint('Test impossible : ' + (err.message || 'erreur inconnue'), true);
		}
	}

	async function changePassword() {
		var hint = $('#password-hint');
		var value = ($('#new-password').value || '').trim();
		if (value.length < 8) {
			hint.textContent = 'Choisissez un mot de passe d’au moins 8 caractères.';
			hint.className = 'text-xs text-red-400 mt-2';
			return;
		}
		try {
			await db.updatePassword(value);
			$('#new-password').value = '';
			hint.textContent = 'Mot de passe modifié. Il s’applique à toutes les pages sécurisées.';
			hint.className = 'text-xs text-emerald-400 mt-2';
		} catch (err) {
			hint.textContent = 'Changement impossible : ' + (err.message || 'erreur inconnue');
			hint.className = 'text-xs text-red-400 mt-2';
		}
	}

	// ------------------------------------------------------------
	// Initialisation
	// ------------------------------------------------------------
	async function init() {
		try {
			db = await window.NM.dbReady;
		} catch (err) {
			$('#auth-spinner').innerHTML = '<p class="text-red-400 text-sm">Base de données injoignable. Vérifiez votre connexion internet.</p>';
			return;
		}
		setupAuthForms();
		var ok = await guard();
		if (!ok) return;
		setupUI();
		await loadAll();
		await loadSettings();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
