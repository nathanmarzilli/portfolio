/* ============================================================
   PROSPECTION — clubs sportifs, associations et commerces
   ------------------------------------------------------------
   Trois sections :
     1. Rechercher   : l'annuaire public de l'État (gratuit, sans
                       clé d'API) pour trouver des clubs et des
                       associations par activité et par territoire.
     2. Mes prospects: le suivi commercial, classé du plus
                       intéressant au moins intéressant (score
                       décroissant), avec analyse du site et
                       relances.
     3. E-mail       : le message proposé, modifiable, copiable et
                       ouvrable dans la messagerie de Nathan.
                       RIEN n'est jamais envoyé par la page.

   Tout passe par window.NM.dbReady (assets/js/supabase-client.js) :
     • db.searchProspects()     → annuaire public (fonction Edge)
     • db.inspectProspectSite() → lecture du site d'un prospect
     • db.askAI('prospect-analysis') → analyse + e-mail (Gemini)
     • db.listProspects() / saveProspect() / deleteProspect()

   ⚠️ Deux règles de survie de ce projet :
     • aucun prix écrit en dur : tout vient de config.js ;
     • aucune clé envoyée à saveProspect() qui ne soit pas une
       colonne de nm_prospects — Supabase rejette sinon la requête
       entière. D'où la liste blanche WRITABLE ci-dessous.
   ============================================================ */
(function () {
	'use strict';

	var CFG = window.APP_CONFIG || {};
	var db = null;

	var state = {
		results: [],      // résultats de la dernière recherche
		prospects: [],    // le CRM
		expanded: null,   // id du prospect dont l'analyse est dépliée
		emailId: null,    // id du prospect ouvert dans l'onglet E-mail
		busy: {}          // analyses en cours, par id
	};

	// Colonnes réellement présentes dans nm_prospects. Tout ce qui
	// n'est pas dans cette liste est écarté avant l'enregistrement.
	var WRITABLE = [
		'id', 'external_id', 'name', 'city', 'address', 'website', 'email', 'phone',
		'kind', 'status', 'score', 'verdict', 'problems', 'offer', 'offer_reason',
		'email_subject', 'email_body', 'tech', 'analyzed_at', 'last_contact_at',
		'next_followup_at', 'notes'
	];

	var STATUS = {
		a_contacter: { label: 'À contacter', cls: 'nm-badge--accent' },
		contacte: { label: 'Contacté', cls: 'nm-badge--info' },
		relance: { label: 'Relancé', cls: 'nm-badge--warn' },
		rdv: { label: 'Rendez-vous', cls: 'nm-badge--accent' },
		gagne: { label: 'Gagné', cls: 'nm-badge--ok' },
		perdu: { label: 'Perdu', cls: 'nm-badge--neutral' }
	};
	var STATUS_ORDER = ['a_contacter', 'contacte', 'relance', 'rdv', 'gagne', 'perdu'];
	var CLOSED = { gagne: 1, perdu: 1 };

	var DAY = 86400000;

	// ------------------------------------------------------------
	// Utilitaires (mêmes conventions que assets/js/admin.js)
	// ------------------------------------------------------------
	var $ = function (sel, root) { return (root || document).querySelector(sel); };
	var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

	/** Échappement HTML — indispensable : le texte des sites tiers
	 *  et les réponses de l'assistant sont des données NON fiables. */
	function esc(value) {
		return String(value === null || value === undefined ? '' : value)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	function shortDate(value) {
		if (!value) return '—';
		var d = new Date(value);
		if (isNaN(d)) return '—';
		return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
	}

	function money(amountEur) {
		if (amountEur === null || amountEur === undefined || isNaN(amountEur)) return '';
		return (window.NM && NM.i18n) ? NM.i18n.format(Number(amountEur), 'EUR') : Number(amountEur) + ' €';
	}

	function toast(message, kind) {
		var el = $('#toast');
		if (!el) return;
		$('#toast-message').textContent = message;
		$('#toast-icon').className = 'text-xl ' + (kind === 'error'
			? 'ph-fill ph-warning-circle text-red-400'
			: 'ph-fill ph-check-circle text-accent-400');
		el.classList.remove('opacity-0', 'pointer-events-none');
		clearTimeout(toast._t);
		toast._t = setTimeout(function () {
			el.classList.add('opacity-0', 'pointer-events-none');
		}, kind === 'error' ? 6000 : 3500);
	}

	/** Ne conserve que les colonnes qui existent vraiment en base. */
	function sanitize(record) {
		var out = {};
		WRITABLE.forEach(function (key) {
			if (record[key] !== undefined) out[key] = record[key];
		});
		return out;
	}

	function findProspect(id) {
		return state.prospects.filter(function (p) { return p.id === id; })[0] || null;
	}

	function needsFollowup(p) {
		if (!p.next_followup_at || CLOSED[p.status]) return false;
		var d = new Date(p.next_followup_at);
		return !isNaN(d) && d.getTime() <= Date.now();
	}

	function isToday(value) {
		if (!value) return false;
		var d = new Date(value);
		if (isNaN(d)) return false;
		var now = new Date();
		return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
	}

	// ------------------------------------------------------------
	// 1. Authentification (identique à /admin/)
	// ------------------------------------------------------------
	async function guard() {
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
			authMessage("Ce compte n'a pas accès à l'outil de prospection.");
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
	// 2. Le catalogue d'offres, construit depuis config.js
	// ------------------------------------------------------------
	/**
	 * Liste des offres, telle qu'elle est à la fois affichée à
	 * l'écran et transmise à l'assistant. Aucun prix n'est écrit
	 * ici : tout vient de APP_CONFIG.
	 */
	function offerCatalogue() {
		var offers = CFG.offers || {};
		var club = CFG.club || {};
		var list = [];

		(CFG.packOrder || []).forEach(function (key) {
			var o = offers[key];
			if (!o) return;
			var audience = o.tagline || '';
			if (o.clubVariant && club.name) {
				audience = (club.description || audience) +
					' Proposée aux clubs et associations sous le nom « ' + club.name + ' ».';
			}
			list.push({
				key: key,
				name: o.name,
				priceEur: (o.price || {}).EUR,
				priceLabel: 'création, une fois',
				audience: audience,
				club: !!o.clubVariant
			});
		});

		['serenite', 'serenitePlus'].forEach(function (key) {
			var o = offers[key];
			if (!o) return;
			list.push({
				key: key,
				name: o.name,
				priceEur: (o.price || {}).EUR,
				annualEur: (o.annualPrice || {}).EUR,
				priceLabel: 'suivi mensuel',
				audience: 'Entretien du site après livraison : ' + (o.includedInterventions || 0) +
					' intervention(s) incluse(s) par an. Facturation annuelle possible (deux mois offerts).'
			});
		});

		return list;
	}

	/** Les modules club, eux aussi issus de config.js. */
	function clubModules() {
		return (CFG.clubOptions || []).map(function (o) {
			return { key: o.key, label: o.label, priceEur: o.priceEur, desc: o.desc || '' };
		});
	}

	/**
	 * Le paramètre `offers` de l'analyse : « Nom — prix — à qui ça
	 * s'adresse », une ligne par offre.
	 */
	function offersText() {
		var lines = ['Offres de Nathan Marzilli (marque « ' + ((CFG.brand || {}).name || 'Clic à l’aide') + ' ») :'];

		offerCatalogue().forEach(function (o) {
			var price = money(o.priceEur);
			if (o.annualEur) price += ' / mois ou ' + money(o.annualEur) + ' / an';
			else price += ' (' + o.priceLabel + ')';
			lines.push('- ' + o.name + ' — ' + price + ' — ' + o.audience);
		});

		var modules = clubModules();
		if (modules.length) {
			lines.push('Modules additionnels pour les clubs et associations (à ajouter à l’offre « ' +
				((CFG.offers || {}).essentiel || {}).name + ' ») :');
			modules.forEach(function (m) {
				lines.push('- ' + m.label + ' — ' + money(m.priceEur) + ' — ' + m.desc);
			});
		}

		(CFG.interventions || []).forEach(function (i) {
			lines.push('- Intervention ponctuelle « ' + i.label + ' » — ' +
				(i.from ? 'à partir de ' : '') + money(i.priceEur) + ' — ' + (i.desc || ''));
		});

		lines.push('Pour un club ou une association, l’offre à privilégier est « ' +
			(((CFG.offers || {})[(CFG.club || {}).baseOfferKey] || {}).name || 'L’Essentiel & Suivi') +
			' », éventuellement complétée d’un ou deux modules.');

		return lines.join('\n');
	}

	/** Affichage à l'écran — les prix passent par data-offer-key / data-price-eur. */
	function renderOffers() {
		var grid = $('#offers-list');
		if (!grid) return;

		var cards = offerCatalogue().map(function (o) {
			var priceHtml = o.annualEur
				? '<span data-offer-key="' + esc(o.key) + '"></span> <span class="text-slate-500">ou</span> <span data-offer-key="' + esc(o.key) + '-annual"></span>'
				: '<span data-offer-key="' + esc(o.key) + '"></span>';
			return '<article class="rounded-xl border ' + (o.club ? 'border-accent-400/30' : 'border-slate-500/15') + ' p-3">' +
				'<div class="flex items-start justify-between gap-2">' +
					'<h4 class="font-display font-bold text-sm text-white">' + esc(o.name) + '</h4>' +
					(o.club ? '<span class="nm-badge nm-badge--accent">Clubs</span>' : '') +
				'</div>' +
				'<p class="text-accent-400 font-bold text-sm mt-1">' + priceHtml + '</p>' +
				'<p class="text-[11px] text-slate-500 mt-1 leading-relaxed">' + esc(o.audience) + '</p>' +
			'</article>';
		});

		var modules = clubModules();
		if (modules.length) {
			cards.push('<article class="rounded-xl border border-slate-500/15 p-3 sm:col-span-2">' +
				'<h4 class="font-display font-bold text-sm text-white mb-2">Modules club &amp; associations</h4>' +
				'<ul class="text-[11px] text-slate-400 space-y-1">' +
					modules.map(function (m) {
						return '<li class="flex justify-between gap-3"><span>' + esc(m.label) + '</span>' +
							'<strong class="text-accent-400 whitespace-nowrap" data-price-eur="' + Number(m.priceEur) + '"></strong></li>';
					}).join('') +
				'</ul></article>');
		}

		grid.innerHTML = cards.join('');
		if (window.NM && NM.i18n && NM.i18n.render) NM.i18n.render();
	}

	// ------------------------------------------------------------
	// 3. Onglet « Rechercher »
	// ------------------------------------------------------------
	function searchLink(result) {
		var bits = [result.name, result.city || result.postal_code || '', 'site officiel'];
		return 'https://www.google.com/search?q=' + encodeURIComponent(bits.filter(Boolean).join(' '));
	}

	function ageLabel(createdOn) {
		if (!createdOn) return '—';
		var year = parseInt(String(createdOn).slice(0, 4), 10);
		if (!year) return '—';
		var age = new Date().getFullYear() - year;
		return year + (age > 0 ? ' · ' + age + ' an' + (age > 1 ? 's' : '') : '');
	}

	function alreadyTracked(externalId) {
		if (!externalId) return null;
		return state.prospects.filter(function (p) { return p.external_id === externalId; })[0] || null;
	}

	async function runSearch(event) {
		if (event) event.preventDefault();
		var query = ($('#search-query').value || '').trim();
		var place = ($('#search-commune').value || '').trim();
		var naf = $('#search-naf').value;
		var hint = $('#search-hint');

		if (!query && !naf) {
			hint.textContent = 'Indiquez au moins un mot-clé ou un type d’activité.';
			hint.className = 'text-xs text-red-400';
			return;
		}

		var payload = {
			query: query,
			onlyAssociations: $('#search-assos').checked,
			perPage: 20,
			page: 1
		};
		if (/^\d{5}$/.test(place)) payload.commune = place;
		else if (/^\d{2,3}$/.test(place)) payload.departement = place;
		if (naf) payload.nafCodes = naf;

		var btn = $('#search-submit');
		btn.disabled = true;
		hint.className = 'text-xs text-slate-500';
		hint.textContent = 'Recherche en cours…';
		$('#search-results').innerHTML = '<p class="text-slate-500 italic text-sm">Recherche en cours…</p>';

		try {
			var res = await db.searchProspects(payload);
			if (!res || !res.ok) throw new Error((res && res.error) || 'réponse inattendue');
			state.results = res.results || [];
			hint.textContent = state.results.length
				? state.results.length + ' résultat(s) affiché(s)' + (res.total ? ' sur ' + res.total : '')
				: 'Aucun résultat : essayez un autre mot-clé ou un territoire plus large.';
		} catch (err) {
			state.results = [];
			hint.className = 'text-xs text-red-400';
			hint.textContent = 'Recherche impossible : ' + (err.message || 'erreur réseau');
			toast('Recherche impossible : ' + (err.message || 'erreur réseau'), 'error');
		} finally {
			btn.disabled = false;
		}

		renderResults();
	}

	function renderResults() {
		var box = $('#search-results');
		$('#count-results').textContent = state.results.length;

		if (!state.results.length) {
			box.innerHTML = '<p class="text-slate-500 italic text-sm">Aucun résultat à afficher.</p>';
			return;
		}

		box.innerHTML = state.results.map(function (r, index) {
			var tracked = alreadyTracked(r.external_id);
			var city = [r.postal_code, r.city].filter(Boolean).join(' ');
			return '<article class="glass-card p-4 border border-slate-500/15 flex flex-col gap-3" data-result-card="' + index + '">' +
				'<header class="flex items-start justify-between gap-3">' +
					'<div class="min-w-0">' +
						'<h3 class="font-display font-bold text-white leading-tight">' + esc(r.name || 'Sans nom') + '</h3>' +
						'<p class="text-[11px] text-slate-500">' + esc(city || '—') + '</p>' +
					'</div>' +
					'<span class="nm-badge ' + (r.is_association ? 'nm-badge--accent' : 'nm-badge--neutral') + '">' +
						(r.is_association ? 'Association' : 'Entreprise') + '</span>' +
				'</header>' +

				'<dl class="text-[11px] space-y-1">' +
					'<div class="flex gap-2"><dt class="text-slate-500 w-20 shrink-0">Activité</dt>' +
						'<dd class="text-slate-300">' + esc(r.activity || '—') + (r.naf ? ' <span class="text-slate-500">(' + esc(r.naf) + ')</span>' : '') + '</dd></div>' +
					'<div class="flex gap-2"><dt class="text-slate-500 w-20 shrink-0">Créée en</dt>' +
						'<dd class="text-slate-300">' + esc(ageLabel(r.created_on)) + '</dd></div>' +
					(r.address ? '<div class="flex gap-2"><dt class="text-slate-500 w-20 shrink-0">Adresse</dt>' +
						'<dd class="text-slate-300">' + esc(r.address) + '</dd></div>' : '') +
				'</dl>' +

				'<div>' +
					'<label class="label-premium" for="res-site-' + index + '">Adresse du site (si vous la connaissez)</label>' +
					'<input class="input-premium !py-2 !text-sm" id="res-site-' + index + '" placeholder="https://…" value="' + esc(tracked ? (tracked.website || '') : '') + '">' +
					'<a class="text-[11px] text-accent-400 hover:underline inline-flex items-center gap-1 mt-1" target="_blank" rel="noopener" href="' + esc(searchLink(r)) + '">' +
						'<i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i> Trouver le site sur le web</a>' +
				'</div>' +

				'<div class="mt-auto pt-1">' +
					(tracked
						? '<span class="nm-badge nm-badge--ok"><i class="ph-bold ph-check" aria-hidden="true"></i> Déjà dans mes prospects</span> ' +
						  '<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="result-update" data-index="' + index + '"><i class="ph-bold ph-link" aria-hidden="true"></i> Mettre à jour le site</button>'
						: '<button class="btn-primary !py-2 !px-3 !text-sm" data-action="result-add" data-index="' + index + '"><i class="ph-bold ph-plus" aria-hidden="true"></i> Ajouter à mes prospects</button>') +
				'</div>' +
			'</article>';
		}).join('');
	}

	async function addResult(index, existing) {
		var r = state.results[index];
		if (!r) return;
		var input = $('#res-site-' + index);
		var website = input ? (input.value || '').trim() : '';
		if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;

		var notes = [r.activity, r.naf ? 'NAF ' + r.naf : '', r.created_on ? 'Créée le ' + r.created_on : '',
			r.employees ? 'Effectif : ' + r.employees : ''].filter(Boolean).join(' · ');

		var record = {
			external_id: r.external_id || null,
			name: r.name || 'Sans nom',
			city: [r.postal_code, r.city].filter(Boolean).join(' ') || null,
			address: r.address || null,
			website: website || null,
			kind: r.is_association ? 'association' : 'entreprise',
			status: 'a_contacter',
			notes: notes || null
		};
		if (existing) record.id = existing.id;

		try {
			await db.saveProspect(sanitize(record));
			toast(existing ? 'Prospect mis à jour.' : 'Ajouté à vos prospects.');
			await loadProspects();
			renderResults();
		} catch (err) {
			toast('Enregistrement impossible : ' + (err.message || 'erreur inconnue'), 'error');
		}
	}

	// ------------------------------------------------------------
	// 4. Onglet « Mes prospects »
	// ------------------------------------------------------------
	function sortedProspects() {
		return state.prospects.slice().sort(function (a, b) {
			var sa = (a.score === null || a.score === undefined) ? -1 : Number(a.score);
			var sb = (b.score === null || b.score === undefined) ? -1 : Number(b.score);
			if (sb !== sa) return sb - sa;
			return String(a.name || '').localeCompare(String(b.name || ''), 'fr');
		});
	}

	function scoreClass(score) {
		if (score === null || score === undefined) return 'score-pill--low';
		if (score >= 70) return 'score-pill--high';
		if (score >= 40) return 'score-pill--mid';
		return 'score-pill--low';
	}

	function statusSelectHtml(p) {
		return '<select class="nm-status-select nm-status-select--' + esc(p.status || 'a_contacter') + '" data-prospect-status="' + esc(p.id) + '" aria-label="Statut du prospect">' +
			STATUS_ORDER.map(function (k) {
				return '<option value="' + k + '"' + (k === p.status ? ' selected' : '') + '>' + STATUS[k].label + '</option>';
			}).join('') +
		'</select>';
	}

	function analysisHtml(p) {
		var problems = Array.isArray(p.problems) ? p.problems : [];
		var hasAnalysis = !!(p.verdict || problems.length || p.offer || p.email_body);

		if (!hasAnalysis) {
			return '<div class="analysis-block text-[11px] text-slate-400">' +
				'Ce prospect n’a pas encore été analysé. Renseignez l’adresse de son site, puis cliquez sur ' +
				'« Analyser le site » : la page lit le site, en liste les faiblesses, choisit l’offre la plus ' +
				'adaptée et rédige l’e-mail.</div>';
		}

		return '<div class="grid gap-3 lg:grid-cols-3">' +

			'<div class="analysis-block">' +
				'<h4 class="text-red-400"><i class="ph-bold ph-warning-circle" aria-hidden="true"></i> Ce qui ne va pas sur le site</h4>' +
				(problems.length
					? '<ul class="text-[11px] text-slate-300 space-y-1 list-disc pl-4">' +
						problems.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'
					: '<p class="text-[11px] text-slate-500">Aucun problème majeur relevé.</p>') +
				(p.verdict ? '<p class="text-[11px] text-slate-400 mt-2 italic">' + esc(p.verdict) + '</p>' : '') +
			'</div>' +

			'<div class="analysis-block">' +
				'<h4 class="text-accent-400"><i class="ph-bold ph-target" aria-hidden="true"></i> Quelle offre, et pourquoi</h4>' +
				'<p class="text-sm font-bold text-white">' + esc(p.offer || '—') + '</p>' +
				'<p class="text-[11px] text-slate-400 mt-1 leading-relaxed">' + esc(p.offer_reason || 'Pas encore de recommandation.') + '</p>' +
			'</div>' +

			'<div class="analysis-block">' +
				'<h4 class="text-blue-400"><i class="ph-bold ph-envelope-simple" aria-hidden="true"></i> L’e-mail prêt à envoyer</h4>' +
				'<p class="text-[11px] text-slate-500">Objet</p>' +
				'<p class="text-[12px] text-white font-bold mb-2">' + esc(p.email_subject || '—') + '</p>' +
				'<p class="text-[11px] text-slate-400 whitespace-pre-line line-clamp-6">' + esc((p.email_body || '').slice(0, 420)) + '</p>' +
				'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px] mt-2" data-action="open-email" data-id="' + esc(p.id) + '">' +
					'<i class="ph-bold ph-pencil-simple" aria-hidden="true"></i> Modifier et envoyer</button>' +
			'</div>' +

		'</div>';
	}

	function renderProspects() {
		var body = $('#prospects-body');
		if (!body) return;

		var needle = ($('#prospect-search').value || '').toLowerCase().trim();
		var status = $('#prospect-filter-status').value;
		var onlyFollowup = $('#prospect-filter-followup').checked;

		var list = sortedProspects().filter(function (p) {
			if (status && p.status !== status) return false;
			if (onlyFollowup && !needsFollowup(p)) return false;
			if (needle && [p.name, p.city, p.website, p.offer].join(' ').toLowerCase().indexOf(needle) === -1) return false;
			return true;
		});

		$('#count-prospects').textContent = state.prospects.length;

		if (!list.length) {
			body.innerHTML = '<tr><td colspan="7" class="text-slate-500 italic">' +
				(state.prospects.length
					? 'Aucun prospect ne correspond à ces filtres.'
					: 'Aucun prospect pour le moment : lancez une recherche dans l’onglet « Rechercher ».') +
				'</td></tr>';
			return;
		}

		body.innerHTML = list.map(function (p) {
			var open = state.expanded === p.id;
			var busy = !!state.busy[p.id];
			var due = needsFollowup(p);

			var row = '<tr data-prospect-row="' + esc(p.id) + '">' +
				'<td><span class="score-pill ' + scoreClass(p.score) + '">' +
					(p.score === null || p.score === undefined ? '—' : esc(p.score)) + '</span></td>' +
				'<td>' +
					'<strong class="text-white">' + esc(p.name) + '</strong>' +
					'<span class="block text-[11px] text-slate-500">' + esc(p.city || '—') + '</span>' +
					(p.email ? '<a class="block text-[11px] hover:text-accent-400" href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '') +
				'</td>' +
				'<td class="hidden md:table-cell max-w-[190px]">' +
					(p.website
						? '<a class="text-[11px] text-accent-400 hover:underline break-all" target="_blank" rel="noopener" href="' + esc(p.website) + '">' + esc(p.website.replace(/^https?:\/\//, '')) + '</a>'
						: '<span class="text-[11px] text-slate-500 italic">site inconnu</span>') +
					(p.tech ? '<span class="block text-[10px] text-slate-500">' + esc(p.tech) + '</span>' : '') +
				'</td>' +
				'<td>' + statusSelectHtml(p) + '</td>' +
				'<td class="hidden sm:table-cell whitespace-nowrap text-[11px]">' + shortDate(p.last_contact_at) + '</td>' +
				'<td class="hidden sm:table-cell whitespace-nowrap text-[11px]">' +
					(p.next_followup_at
						? '<span class="' + (due ? 'text-amber-400 font-bold' : 'text-slate-400') + '">' + shortDate(p.next_followup_at) + '</span>'
						: '<span class="text-slate-500">—</span>') +
				'</td>' +
				'<td class="whitespace-nowrap text-right nm-table-actions-col">' +
					'<div class="flex flex-wrap items-center justify-end gap-1.5">' +
						'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="analyze" data-id="' + esc(p.id) + '"' + (busy ? ' disabled' : '') + '>' +
							'<i class="ph-bold ' + (busy ? 'ph-spinner animate-spin' : 'ph-magic-wand') + '" aria-hidden="true"></i> ' +
							(busy ? 'Analyse…' : 'Analyser le site') + '</button>' +
						'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="open-email" data-id="' + esc(p.id) + '">' +
							'<i class="ph-bold ph-envelope-simple" aria-hidden="true"></i> E-mail</button>' +
						'<button class="btn-ghost !py-1.5 !px-2.5 !text-[11px]" data-action="toggle" data-id="' + esc(p.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
							'<i class="ph-bold ' + (open ? 'ph-caret-up' : 'ph-caret-down') + '" aria-hidden="true"></i> Détail</button>' +
						'<button class="btn-ghost btn-danger !py-1.5 !px-2.5 !text-[11px]" data-action="delete" data-id="' + esc(p.id) + '" title="Retirer ce prospect">' +
							'<i class="ph-bold ph-trash" aria-hidden="true"></i></button>' +
					'</div>' +
				'</td>' +
			'</tr>';

			if (open) {
				row += '<tr data-prospect-detail="' + esc(p.id) + '"><td colspan="7" class="analysis-cell">' +
					'<div class="space-y-3">' +
						'<div class="flex flex-wrap items-end gap-2">' +
							'<div class="flex-1 min-w-[220px]">' +
								'<label class="label-premium" for="site-' + esc(p.id) + '">Adresse du site</label>' +
								'<input class="input-premium !py-2 !text-sm" id="site-' + esc(p.id) + '" data-site-input="' + esc(p.id) + '" placeholder="https://…" value="' + esc(p.website || '') + '">' +
							'</div>' +
							'<button class="btn-ghost !py-2 !px-3 !text-sm" data-action="save-site" data-id="' + esc(p.id) + '"><i class="ph-bold ph-floppy-disk" aria-hidden="true"></i> Enregistrer</button>' +
							'<a class="btn-ghost !py-2 !px-3 !text-sm" target="_blank" rel="noopener" href="' + esc('https://www.google.com/search?q=' + encodeURIComponent((p.name || '') + ' ' + (p.city || '') + ' site officiel')) + '"><i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i> Trouver le site</a>' +
						'</div>' +
						analysisHtml(p) +
						(p.analyzed_at ? '<p class="text-[10px] text-slate-500">Analysé le ' + esc(shortDate(p.analyzed_at)) + '.</p>' : '') +
					'</div>' +
				'</td></tr>';
			}

			return row;
		}).join('');
	}

	function renderStats() {
		var todo = state.prospects.filter(function (p) { return p.status === 'a_contacter'; }).length;
		var followup = state.prospects.filter(needsFollowup).length;
		var today = state.prospects.filter(function (p) { return isToday(p.last_contact_at); }).length;
		$('#stat-todo').textContent = todo;
		$('#stat-followup').textContent = followup;
		$('#stat-today').textContent = today;
		$('#stat-total').textContent = state.prospects.length;
	}

	async function loadProspects() {
		try {
			state.prospects = await db.listProspects();
		} catch (err) {
			console.error(err);
			toast('Chargement des prospects impossible : ' + (err.message || 'erreur réseau'), 'error');
			state.prospects = [];
		}
		renderStats();
		renderProspects();
	}

	async function patchProspect(p, patch, successMessage) {
		var record = sanitize(Object.assign({ id: p.id }, patch));
		try {
			var saved = await db.saveProspect(record);
			Object.assign(p, saved || record);
			if (successMessage) toast(successMessage);
		} catch (err) {
			toast('Enregistrement impossible : ' + (err.message || 'erreur inconnue'), 'error');
			return false;
		}
		renderStats();
		renderProspects();
		return true;
	}

	// ------------------------------------------------------------
	// 5. Analyse : inspection du site, puis rédaction par l'assistant
	// ------------------------------------------------------------
	/** Les faiblesses mesurables, relevées sans intelligence artificielle. */
	function technicalProblems(site) {
		var out = [];
		if (site.https === false) out.push('Le site n’est pas en HTTPS : les navigateurs l’affichent comme « non sécurisé ».');
		if (site.mobileReady === false) out.push('La page n’est pas prévue pour les téléphones (pas de balise d’affichage mobile).');
		if (typeof site.loadSeconds === 'number' && site.loadSeconds > 2.5) {
			out.push('Le site met ' + site.loadSeconds.toFixed(1) + ' s à répondre : c’est long, une partie des visiteurs abandonne.');
		}
		if (site.copyrightYear && Number(site.copyrightYear) < new Date().getFullYear() - 2) {
			out.push('Le pied de page affiche encore « ' + site.copyrightYear + ' » : le site paraît abandonné.');
		}
		if (!site.description) out.push('Aucune description dans le code de la page : Google affiche un extrait au hasard.');
		if (typeof site.weightKb === 'number' && site.weightKb > 2000) {
			out.push('La page pèse ' + Math.round(site.weightKb) + ' Ko : très lourd pour une connexion mobile.');
		}
		return out;
	}

	function showGeminiNotice() {
		var el = $('#gemini-notice');
		if (el) el.classList.remove('hidden');
	}

	async function analyzeProspect(id) {
		var p = findProspect(id);
		if (!p) return;

		if (!p.website) {
			state.expanded = id;
			renderProspects();
			toast('Renseignez d’abord l’adresse du site, juste en dessous.', 'error');
			return;
		}

		state.busy[id] = true;
		state.expanded = id;
		renderProspects();

		try {
			var inspection = await db.inspectProspectSite(p.website);
			if (!inspection || !inspection.ok) throw new Error((inspection && inspection.error) || 'inspection impossible');
			var site = inspection.site || {};

			if (site.reachable === false) {
				await patchProspect(p, {
					score: 85,
					verdict: 'Le site ne répond pas. C’est le meilleur argument d’approche qui soit.',
					problems: ['Le site est injoignable' + (site.error ? ' (' + site.error + ')' : '') + ' : un visiteur qui clique tombe sur une erreur.'],
					offer: null,
					offer_reason: null,
					analyzed_at: new Date().toISOString()
				});
				toast('Site injoignable — noté sur la fiche.');
				return;
			}

			var techIssues = technicalProblems(site);
			var patch = {
				tech: site.tech || p.tech || null,
				analyzed_at: new Date().toISOString()
			};
			if (!p.email && site.emails && site.emails.length) patch.email = site.emails[0];
			if (!p.phone && site.phones && site.phones.length) patch.phone = site.phones[0];

			var ai = await db.askAI('prospect-analysis', {
				name: p.name,
				city: p.city,
				website: p.website,
				tech: site.tech,
				pageText: site.pageText,
				offers: offersText()
			});

			if (!ai || !ai.ok) {
				if (ai && ai.code === 'gemini_not_configured') {
					showGeminiNotice();
					toast('Analyse rédigée indisponible : la clé Gemini n’est pas encore posée. Le relevé technique, lui, est enregistré.', 'error');
				} else {
					toast('Analyse impossible : ' + ((ai && ai.error) || 'erreur inconnue'), 'error');
				}
				patch.problems = techIssues;
				patch.score = Math.min(95, 40 + techIssues.length * 12);
				patch.verdict = 'Relevé technique seul (assistant indisponible).';
				await patchProspect(p, patch);
				return;
			}

			var d = ai.data || {};
			var aiProblems = Array.isArray(d.problemes) ? d.problemes.map(String) : [];
			// Les constats mesurés d'abord, la lecture de l'assistant ensuite,
			// sans doublon évident.
			var merged = techIssues.slice();
			aiProblems.forEach(function (x) { if (merged.indexOf(x) === -1) merged.push(x); });

			patch.problems = merged;
			patch.score = (typeof d.score === 'number') ? Math.max(0, Math.min(100, Math.round(d.score))) : Math.min(95, 40 + merged.length * 10);
			patch.verdict = d.verdict || null;
			patch.offer = d.offre || null;
			patch.offer_reason = d.pourquoi_cette_offre || null;
			patch.email_subject = d.email_objet || null;
			patch.email_body = d.email_corps || null;

			await patchProspect(p, patch, 'Analyse terminée.');
		} catch (err) {
			toast('Analyse impossible : ' + (err.message || 'erreur réseau'), 'error');
		} finally {
			delete state.busy[id];
			renderProspects();
		}
	}

	// ------------------------------------------------------------
	// 6. Onglet « E-mail »
	// ------------------------------------------------------------
	function refreshMailto() {
		var link = $('#email-mailto');
		if (!link) return;
		var to = ($('#email-to').value || '').trim();
		var subject = $('#email-subject').value || '';
		var body = $('#email-body').value || '';
		link.href = 'mailto:' + encodeURIComponent(to) +
			'?subject=' + encodeURIComponent(subject) +
			'&body=' + encodeURIComponent(body);
	}

	function openEmail(id) {
		var p = findProspect(id);
		if (!p) return;
		state.emailId = id;

		$('#email-empty').classList.add('hidden');
		$('#email-editor').classList.remove('hidden');
		$('#email-target').textContent = p.name + (p.city ? ' · ' + p.city : '');
		$('#email-to').value = p.email || '';
		$('#email-subject').value = p.email_subject || ('Votre site — ' + p.name);
		$('#email-body').value = p.email_body || '';
		refreshMailto();
		switchTab('email');
	}

	async function saveEmailDraft(silent) {
		var p = findProspect(state.emailId);
		if (!p) return false;
		return patchProspect(p, {
			email: ($('#email-to').value || '').trim() || null,
			email_subject: $('#email-subject').value || null,
			email_body: $('#email-body').value || null
		}, silent ? null : 'Brouillon enregistré.');
	}

	async function markAsSent() {
		var p = findProspect(state.emailId);
		if (!p) return;
		var now = new Date();
		var ok = await patchProspect(p, {
			email: ($('#email-to').value || '').trim() || null,
			email_subject: $('#email-subject').value || null,
			email_body: $('#email-body').value || null,
			status: 'contacte',
			last_contact_at: now.toISOString(),
			next_followup_at: new Date(now.getTime() + 7 * DAY).toISOString()
		}, 'Contact noté. Relance programmée dans 7 jours.');
		if (ok) switchTab('prospects');
	}

	function copyEmail() {
		var text = $('#email-body').value || '';
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(function () {
				toast('Message copié.');
			}).catch(function () { fallbackCopy(text); });
		} else {
			fallbackCopy(text);
		}
	}

	function fallbackCopy(text) {
		var area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		try { document.execCommand('copy'); toast('Message copié.'); }
		catch (e) { toast('Copie impossible : sélectionnez le texte à la main.', 'error'); }
		document.body.removeChild(area);
	}

	// ------------------------------------------------------------
	// 7. Interface
	// ------------------------------------------------------------
	var TABS = ['recherche', 'prospects', 'email'];

	function switchTab(name) {
		$$('.tab-btn').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === name)); });
		TABS.forEach(function (key) {
			var section = $('#tab-' + key);
			if (section) section.classList.toggle('hidden', key !== name);
		});
	}

	function fillStatusFilter() {
		var sel = $('#prospect-filter-status');
		sel.innerHTML = '<option value="">Tous les statuts</option>' +
			STATUS_ORDER.map(function (k) {
				return '<option value="' + k + '">' + STATUS[k].label + '</option>';
			}).join('');
	}

	function setupUI() {
		$$('.tab-btn').forEach(function (btn) {
			btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
		});

		$('#search-form').addEventListener('submit', runSearch);

		$$('#search-presets .preset-chip').forEach(function (chip) {
			chip.addEventListener('click', function () {
				var preset = {};
				try { preset = JSON.parse(chip.dataset.preset || '{}'); } catch (e) { preset = {}; }
				$('#search-query').value = preset.query || '';
				$('#search-naf').value = preset.naf || '';
				$$('#search-presets .preset-chip').forEach(function (c) { c.classList.toggle('is-active', c === chip); });
				runSearch();
			});
		});

		$('#prospect-search').addEventListener('input', renderProspects);
		$('#prospect-filter-status').addEventListener('change', renderProspects);
		$('#prospect-filter-followup').addEventListener('change', renderProspects);
		$$('[data-refresh]').forEach(function (b) { b.addEventListener('click', loadProspects); });

		$('#email-copy').addEventListener('click', copyEmail);
		$('#email-save').addEventListener('click', function () { saveEmailDraft(false); });
		$('#email-sent').addEventListener('click', markAsSent);
		['#email-to', '#email-subject', '#email-body'].forEach(function (sel) {
			$(sel).addEventListener('input', refreshMailto);
		});

		// Changement de statut sur une ligne de prospect.
		document.addEventListener('change', async function (e) {
			var sel = e.target.closest('[data-prospect-status]');
			if (!sel) return;
			var p = findProspect(sel.dataset.prospectStatus);
			if (!p) return;
			var value = sel.value;
			var patch = { status: value };
			var now = new Date();
			if (value === 'relance') {
				patch.last_contact_at = now.toISOString();
				patch.next_followup_at = new Date(now.getTime() + 3 * DAY).toISOString();
			} else if (CLOSED[value]) {
				patch.next_followup_at = null;
			}
			await patchProspect(p, patch, 'Statut mis à jour : ' + STATUS[value].label + '.');
		});

		document.addEventListener('click', async function (e) {
			var btn = e.target.closest('[data-action]');
			if (!btn) return;
			var action = btn.dataset.action;
			var id = btn.dataset.id;

			if (action === 'result-add' || action === 'result-update') {
				var index = Number(btn.dataset.index);
				var r = state.results[index];
				await addResult(index, action === 'result-update' ? alreadyTracked(r && r.external_id) : null);

			} else if (action === 'toggle') {
				state.expanded = (state.expanded === id) ? null : id;
				renderProspects();

			} else if (action === 'analyze') {
				await analyzeProspect(id);

			} else if (action === 'open-email') {
				openEmail(id);

			} else if (action === 'save-site') {
				var target = findProspect(id);
				var input = $('[data-site-input="' + id + '"]');
				if (!target || !input) return;
				var url = (input.value || '').trim();
				if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
				await patchProspect(target, { website: url || null }, 'Adresse du site enregistrée.');

			} else if (action === 'delete') {
				var doomed = findProspect(id);
				var ok = await window.nmConfirm(
					'Retirer « ' + ((doomed && doomed.name) || 'ce prospect') + ' » de votre liste ?\n\nL’analyse et l’e-mail rédigé seront perdus.',
					{ title: 'Retirer le prospect', okLabel: 'Retirer', danger: true }
				);
				if (!ok) return;
				try {
					await db.deleteProspect(id);
					if (state.emailId === id) {
						state.emailId = null;
						$('#email-editor').classList.add('hidden');
						$('#email-empty').classList.remove('hidden');
						$('#email-target').textContent = 'Aucun prospect sélectionné.';
					}
					toast('Prospect retiré.');
					await loadProspects();
					renderResults();
				} catch (err) {
					toast('Suppression impossible : ' + (err.message || 'erreur inconnue'), 'error');
				}
			}
		});
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
		fillStatusFilter();
		renderOffers();
		setupUI();
		await loadProspects();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
