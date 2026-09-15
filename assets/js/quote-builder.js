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
			// Le pack est un abonnement annuel : `price` porte le tarif de
			// l'année, réglé en une fois et reconductible. S'il a choisi le
			// paiement au mois, on facture l'équivalent mensuel (÷ 10).
			var packCycle = data.pack_cycle === 'monthly' ? 'monthly' : 'annual';
			var packAmount = packCycle === 'monthly'
				? (C.packMonthlyPrice ? C.packMonthlyPrice(packKey, 'EUR') : Math.round(Math.round(offer.price.EUR / 12) * 14 / 12))
				: offer.price.EUR;
			var equivalent = C.packMonthlyEquivalent ? C.packMonthlyEquivalent(packKey, 'EUR') : Math.round(offer.price.EUR / 12);
			items.push({
				desc: 'Site internet — Pack ' + offer.name +
					(packCycle === 'monthly'
						? ' (abonnement mensuel, reconductible, hébergement et nom de domaine compris)'
						: ' (abonnement annuel réglé en une fois, soit ' + equivalent +
						  ' € / mois, reconductible chaque année, hébergement et nom de domaine compris)'),
				qty: 1,
				price: packAmount,
				recurring: packCycle === 'monthly'
			});
		} else if (data.intervention_type) {
			var inter = (C.findIntervention && C.findIntervention(data.intervention_type)) || null;
			if (inter) {
				// Le relifting n'est pas une intervention ponctuelle : c'est
				// un abonnement dont les 2 premières années sont réglées en
				// une fois (voir config.js -> interventions.relifting).
				var interDesc;
				if (inter.subscription) {
					var monthly = C.packMonthlyEquivalent
						? C.packMonthlyEquivalent(inter.offerKey || 'essentiel', 'EUR') : null;
					interDesc = inter.label + ' — abonnement' +
						(monthly ? ' à ' + monthly + ' € / mois' : '') +
						', ' + (inter.prepaidYears || 2) + ' ans réglés en une fois à la commande (' + inter.desc + ')';
				} else {
					interDesc = 'Intervention ponctuelle — ' + inter.label + ' (' + inter.desc + ')';
				}
				items.push({ desc: interDesc, qty: 1, price: inter.priceEur });
			}
		}

		// ---- 2 & 3. Options : suppléments MENSUELS ------------------
		// Depuis septembre 2026, les automatisations de documents et les
		// modules club ne sont plus des achats uniques : ce sont des
		// suppléments à l'abonnement (5 € / mois l'unité, 15 € pour un
		// document sur-mesure, 33 € pour les Actualités simplifiées),
		// avec un lot de 3 à 10 € (config.js -> optionBundle).
		// Le lot est une remise globale : on facture donc chaque option à
		// son tarif, puis une ligne de remise unique — c'est ce qui reste
		// lisible sur un devis papier.
		var optionAmounts = [];
		var optionLines = [];

		(data.documents || []).forEach(function (label) {
			var raw = String(label);
			var isCustom = raw.indexOf('Autre') === 0 || raw.indexOf('sur-mesure') !== -1;
			var opt = matchDocumentOption(raw);
			var price = opt ? opt.monthlyEur : 5;
			var text = isCustom
				? 'Document sur-mesure — ' + raw.replace(/^Autre\s*:\s*/, '').trim()
				: 'Automatisation de document — ' + (opt ? opt.label : raw);
			optionAmounts.push(price);
			optionLines.push({ desc: text + ' (supplément mensuel)', qty: 1, price: price, recurring: true });
		});

		(data.club_options || []).forEach(function (label) {
			var opt = (C.clubOptions || []).filter(function (o) {
				return o.label === label || o.key === label;
			})[0];
			var price = opt ? opt.monthlyEur : 5;
			optionAmounts.push(price);
			optionLines.push({
				desc: 'Module club — ' + (opt ? opt.label : label) + ' (supplément mensuel)',
				qty: 1,
				price: price,
				recurring: true
			});
		});

		optionLines.forEach(function (line) { items.push(line); });

		var bundleSaving = C.optionsBundleSaving ? C.optionsBundleSaving(optionAmounts) : 0;
		if (bundleSaving > 0) {
			var bundle = C.optionBundle || { groupSize: 3, groupPriceEur: 10 };
			items.push({
				desc: 'Remise « lot de ' + bundle.groupSize + ' options » (' + bundle.groupSize +
					' options pour ' + bundle.groupPriceEur + ' € / mois)',
				qty: 1,
				price: -bundleSaving,
				recurring: true
			});
		}

		// ---- 4. Formule de suivi (ligne récurrente) ------------------
		// Sans engagement sur les deux cycles. La remise combo (un mois
		// offert supplémentaire, Sérénité comme Sérénité+) ne s'applique QUE
		// sur la formule ANNUELLE et seulement si un pack de CRÉATION est
		// commandé en même temps — c'est `APP_CONFIG.comboDiscountFor(pack,
		// tier, cycle)` qui tranche, une seule source de vérité pour tout
		// le site.
		var recurring = null;
		if (data.serenity_tier) {
			var key = data.serenity_tier === 'plus' ? 'serenitePlus' : 'serenite';
			var s = (C.offers || {})[key];
			if (s) {
				var cycle = data.serenity_cycle || 'monthly';
				var refAmount = cycle === 'annual' ? s.annualPrice.EUR : s.price.EUR;
				var cycleLabel = cycle === 'annual' ? 'annuel (réglé en une fois, 2 mois offerts)' : 'mensuel';

				var combo = C.comboDiscountFor ? C.comboDiscountFor(data.pack, data.serenity_tier, cycle) : null;
				var amount = combo ? C.applyComboToAnnual(refAmount, combo, s.price.EUR) : refAmount;

				var desc = s.name + ' — abonnement ' + cycleLabel + ', sans engagement';
				if (combo) desc += ' (' + combo.label + ' : ' + amount.toFixed(2).replace('.', ',') + ' € au lieu de ' + refAmount.toFixed(2).replace('.', ',') + ' €)';

				recurring = {
					key: key,
					label: s.name,
					cycle: cycle,
					amount: amount
				};
				items.push({
					desc: desc,
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
