/* ============================================================
   CONSTRUCTION AUTOMATIQUE D'UN DEVIS
   ------------------------------------------------------------
   Transforme une demande (table nm_leads) et/ou un brief projet
   (table nm_briefs) en lignes de devis prêtes à l'emploi, à
   partir du catalogue unique de config.js.

   Utilisé par :
     • /kickoff/    -> prépare le brouillon de devis à l'envoi du brief
     • /admin/      -> bouton « Générer le devis »
     • /contrat/devis&contrat/ -> pré-remplissage du générateur

   Une seule règle de calcul pour tout le site : impossible qu'un
   devis diverge des prix affichés sur les pages publiques.
   ============================================================ */
(function (root) {
	'use strict';

	function cfg() { return root.APP_CONFIG || {}; }

	function offerOf(key) {
		var offers = cfg().offers || {};
		if (!key) return null;
		var normalized = String(key).toLowerCase();
		// Accepte « Vitrine », « vitrine », « serenitePlus »…
		var found = Object.keys(offers).filter(function (k) { return k.toLowerCase() === normalized; })[0];
		return found ? offers[found] : null;
	}

	/**
	 * @param {object} src  Demande et/ou brief fusionnés. Champs reconnus :
	 *   pack, pack_label, serenity_tier, serenity_cycle,
	 *   documents[], club_options[], intervention_type,
	 *   custom_document (texte libre)
	 * @returns {{items: Array<{desc,qty,price}>, totalOneTime:number, recurring:object|null}}
	 */
	function build(src) {
		var C = cfg();
		var items = [];
		var data = src || {};

		// ---- 1. Pack de création -------------------------------------
		var packKey = data.pack;
		var offer = offerOf(packKey);
		if (offer && offer.type === 'one_time') {
			items.push({
				desc: 'Création de site — Pack ' + offer.name,
				qty: 1,
				price: offer.price.EUR
			});
		} else if (data.intervention_type) {
			var inter = (C.findIntervention && C.findIntervention(data.intervention_type)) || null;
			if (inter) {
				items.push({
					desc: 'Intervention ponctuelle — ' + inter.label + ' (' + inter.desc + ')',
					qty: 1,
					price: inter.priceEur
				});
			}
		}

		// ---- 2. Modules d'automatisation de documents ----------------
		(data.documents || []).forEach(function (label) {
			var raw = String(label);
			var isCustom = raw.indexOf('Autre') === 0 || raw.indexOf('sur-mesure') !== -1;
			var opt = matchDocumentOption(raw);
			var price = opt ? opt.priceEur : 100;
			var text = isCustom
				? 'Document sur-mesure — ' + raw.replace(/^Autre\s*:\s*/, '').trim()
				: 'Automatisation de document — ' + (opt ? opt.label : raw);
			items.push({ desc: text, qty: 1, price: price });
		});

		// ---- 3. Modules club ----------------------------------------
		(data.club_options || []).forEach(function (label) {
			var opt = (C.clubOptions || []).filter(function (o) {
				return o.label === label || o.key === label;
			})[0];
			items.push({
				desc: 'Module club — ' + (opt ? opt.label : label),
				qty: 1,
				price: opt ? opt.priceEur : 100
			});
		});

		// ---- 4. Formule de suivi (ligne récurrente) ------------------
		var recurring = null;
		if (data.serenity_tier) {
			var key = data.serenity_tier === 'plus' ? 'serenitePlus' : 'serenite';
			var s = (C.offers || {})[key];
			if (s) {
				var annual = data.serenity_cycle === 'annual';
				var amount = annual ? s.annualPrice.EUR : s.price.EUR;
				recurring = {
					key: key,
					label: s.name,
					cycle: annual ? 'annual' : 'monthly',
					amount: amount
				};
				items.push({
					desc: s.name + (annual
						? ' — abonnement annuel (2 mois offerts, engagement 12 mois)'
						: ' — abonnement mensuel (engagement 12 mois)'),
					qty: 1,
					price: amount,
					recurring: true
				});
			}
		}

		var totalOneTime = items
			.filter(function (it) { return !it.recurring; })
			.reduce(function (sum, it) { return sum + it.qty * it.price; }, 0);

		return { items: items, totalOneTime: totalOneTime, recurring: recurring };
	}

	function matchDocumentOption(label) {
		var C = cfg();
		var l = String(label).toLowerCase();
		var map = {
			'devis': 'devis',
			'facture': 'facture',
			'quittance': 'quittance',
			'frais': 'frais',
			'bail': 'bail',
			'autre': 'sur-mesure',
			'sur-mesure': 'sur-mesure'
		};
		var hit = Object.keys(map).filter(function (k) { return l.indexOf(k) !== -1; })[0];
		return hit && C.findDocumentOption ? C.findDocumentOption(map[hit]) : null;
	}

	/** Résumé lisible (une ligne) pour l'espace d'administration. */
	function summarize(src) {
		var res = build(src);
		var parts = res.items.map(function (it) { return it.desc.split('—').pop().trim(); });
		return parts.join(' · ') || 'Aucune prestation renseignée';
	}

	root.NM = root.NM || {};
	root.NM.quote = { build: build, summarize: summarize };

})(window);
