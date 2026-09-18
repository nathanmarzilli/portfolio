// ============================================================
// APP_CONFIG — SOURCE UNIQUE DE VÉRITÉ DU SITE
// ------------------------------------------------------------
// Coordonnées, devises, catalogue d'offres et d'options, chemins
// de pages, clés Supabase et libellés traduits.
//
// ⚠️ RÈGLE D'OR : aucun prix ne doit être écrit en dur dans une
// page HTML. Chaque montant affiché provient soit d'un
// `data-offer-key` (offre du catalogue), soit d'un
// `data-price-eur` (montant libre converti automatiquement).
// C'est ce qui garantit que TOUTES les pages du site affichent
// exactement les mêmes tarifs.
//
// 💳 PAIEMENT : le site ne propose AUCUN paiement en ligne.
// Le parcours est : RDV découverte → brief projet → devis →
// facture Stripe envoyée par e-mail (avec son lien de paiement)
// depuis l'espace d'administration, une fois le site livré.
// ============================================================

(function (root) {
	'use strict';

	var APP_CONFIG = {

		// --------------------------------------------------------
		// Coordonnées
		// --------------------------------------------------------
		// Marque de l'activité : « Clic à l'aide » est mise en avant en
		// premier sur tout le site (SEO, réseaux, supports imprimés).
		// Nathan reste visible en second plan, comme garantie du contact
		// humain direct derrière la marque.
		brand: {
			name: 'Clic à l’aide',
			tagline: 'Le numérique, sans prise de tête',
			logo: 'images/logo/Logo-1.png',
			// Adresse du site imprimée sur les flyers, les cartes de visite et
			// les balises SEO (canonical, Open Graph, données structurées).
			// Site en ligne depuis septembre 2026 sur ces deux domaines.
			site: 'clicalaide.fr',
			siteAlt: 'clicalaide.com',
			url: 'https://www.clicalaide.fr/'
		},

		contact: {
			name: 'Nathan Marzilli',
			role: 'Ingénieur & Artisan du web',
			// E-mail AFFICHÉ publiquement (footer, mentions légales, CGV,
			// balises SEO/structured data, supports imprimés). Boîte pro
			// dédiée à l'activité « Clic à l'aide ».
			email: 'contact@clicalaide.fr',
			// ⚠️ Identifiant de connexion Supabase Auth pour l'espace
			// d'administration (/admin/). NE JAMAIS afficher publiquement,
			// et ne jamais remplacer par `email` ci-dessus : ce champ est
			// utilisé UNIQUEMENT par admin.js pour vérifier qui est admin,
			// jamais rendu dans une page publique.
			authEmail: 'nathan.marzilli@gmail.com',
			phoneDisplay: '06 25 96 51 12',
			phoneHref: 'tel:+33625965112',
			city: '74500 Évian-les-Bains',
			area: 'Évian-les-Bains · Lausanne · bassin lémanique'
		},

		// --------------------------------------------------------
		// Devises disponibles
		// --------------------------------------------------------
		defaultCurrency: 'EUR',
		currencies: {
			EUR: { symbol: '€', position: 'suffix', spaced: true, flag: '🇫🇷', label: 'Euro', locale: 'fr-FR' },
			CHF: { symbol: 'CHF', position: 'suffix', spaced: true, flag: '🇨🇭', label: 'Franc suisse', locale: 'fr-CH' },
			GBP: { symbol: '£', position: 'prefix', spaced: false, flag: '🇬🇧', label: 'Pound sterling', locale: 'en-GB' },
			USD: { symbol: '$', position: 'prefix', spaced: false, flag: '🇺🇸', label: 'US dollar', locale: 'en-US' }
		},

		// --------------------------------------------------------
		// Conversion des montants « libres » (options, interventions,
		// tarifs horaires) exprimés en EUR dans le HTML.
		// `exact` fige les valeurs courantes sur des prix ronds ;
		// `rate` sert de repli pour tout autre montant.
		// --------------------------------------------------------
		conversion: {
			// Les paliers couvrent les montants « libres » réellement
			// affichés : options mensuelles (5 / 10 / 15 / 33 €), lot de
			// 3 options (10 €), relifting (66 € / mois, 1 580 € pour 2 ans),
			// interventions et tarifs du facilitateur. Les anciens paliers
			// des packs (690 / 990 / 1790 / 2990) et de l'hébergement OVH
			// (22,05 / 54,79) ont été retirés : les packs ont désormais leur
			// propre table par devise, et l'hébergement n'est plus facturé.
			CHF: {
				rate: 0.94,
				exact: {
					'0.15': 0.15, '5': 5, '10': 9.5, '15': 14, '33': 31,
					'50': 47, '66': 62, '70': 65, '90': 85, '100': 95,
					'120': 115, '200': 190, '250': 235, '300': 285, '320': 300,
					'1580': 1490, '35': 33, '630': 590, '85': 80
				}
			},
			GBP: {
				rate: 0.855,
				exact: {
					'0.15': 0.13, '5': 4.5, '10': 9, '15': 13, '33': 28,
					'50': 43, '66': 56, '70': 60, '90': 77, '100': 85,
					'120': 105, '200': 170, '250': 215, '300': 255, '320': 275,
					'1580': 1350, '35': 30, '630': 540, '85': 73
				}
			},
			USD: {
				rate: 1.15,
				exact: {
					'0.15': 0.17, '5': 6, '10': 12, '15': 17, '33': 38,
					'50': 58, '66': 76, '70': 80, '90': 105, '100': 115,
					'120': 140, '200': 230, '250': 290, '300': 345, '320': 370,
					'1580': 1820, '35': 40, '630': 725, '85': 98
				}
			}
		},

		// --------------------------------------------------------
		// Offre de lancement (remise appliquée à l'affichage)
		// --------------------------------------------------------
		launchPromo: {
			active: false,
			discountPercent: 20,
			totalPacks: 9,
			appliesTo: ['essentiel', 'vitrine']
		},

		// --------------------------------------------------------
		// CATALOGUE — packs de création & formules de suivi
		// --------------------------------------------------------
		// --------------------------------------------------------
		// LES PACKS DE CRÉATION SONT DES ABONNEMENTS ANNUELS
		//
		// `price` = le tarif de l'ANNÉE, payé en une seule fois, et
		// reconductible chaque année au même tarif (hébergement, nom de
		// domaine, sécurité et mise en ligne compris — plus rien à payer
		// à un hébergeur tiers : tout est géré en interne).
		//
		// DEUX MONTANTS MENSUELS, À NE PAS CONFONDRE :
		//
		//  • l'ÉQUIVALENT MENSUEL du tarif annuel = prix annuel / 12,
		//    arrondi. C'est le gros chiffre affiché quand le cycle
		//    « annuel » est choisi (cycle par défaut partout) :
		//      690 € / an -> 58 € / mois      890 € / an -> 74 € / mois
		//      790 € / an -> 66 € / mois    1 188 € / an -> 99 € / mois
		//    -> APP_CONFIG.packMonthlyEquivalent()
		//
		//  • le TARIF DU CYCLE MENSUEL, si le client préfère payer au
		//    mois : c'est une facilité de paiement volontairement plus
		//    chère, égale à l'équivalent mensuel × 14/12 (soit ~2 mois
		//    de plus sur l'année) :
		//      58 -> 68 € / mois       74 -> 86 € / mois
		//      66 -> 77 € / mois       99 -> 116 € / mois
		//    -> APP_CONFIG.packMonthlyPrice()
		// --------------------------------------------------------
		packBilling: {
			// Surcoût du paiement au mois, en fraction de l'équivalent
			// mensuel : 14/12 = l'année revient à 14 mensualités.
			monthlySurcharge: { numerator: 14, denominator: 12 }
		},

		offers: {
			eclair: {
				key: 'eclair',
				name: 'Vitrine Éclair',
				type: 'one_time',
				tagline: 'Le tremplin pour démarrer, livré en une semaine.',
				price: { EUR: 690, CHF: 650, GBP: 590, USD: 795 },
				deliveryDays: 7
			},
			essentiel: {
				key: 'essentiel',
				name: 'Vitrine Essentiel',
				type: 'one_time',
				tagline: 'Un site one-page entretenu toute l’année, sans y penser.',
				price: { EUR: 790, CHF: 745, GBP: 675, USD: 910 },
				deliveryDays: 7,
				// Pack Sérénité (simple) vivement conseillé avec ce pack, mais
				// PLUS obligatoire ni engagé : le client choisit librement, et
				// bénéficie d'un mois offert supplémentaire la 1ère année s'il
				// le prend en même temps que la création, en formule annuelle
				// (voir offers.serenite.comboDiscount).
				recommendedSerenity: { tier: 'simple' },
				// Cette offre est aussi celle proposée aux clubs et
				// associations, avec des options spécifiques (voir `club`).
				clubVariant: true
			},
			vitrine: {
				key: 'vitrine',
				name: 'Vitrine Artisan',
				type: 'one_time',
				tagline: 'Jusqu’à 5 pages, modulable avec les options de votre choix.',
				price: { EUR: 890, CHF: 835, GBP: 760, USD: 1020 },
				deliveryDays: 14,
				popular: true,
				// Pack mis en avant pour la modularité : chaque option
				// documentaire s'ajoute à l'abonnement (voir documentOptions).
				modular: true
			},
			premium: {
				key: 'premium',
				name: 'Vitrine Premium',
				type: 'one_time',
				tagline: 'Design sur-mesure, blog en autonomie et statistiques.',
				price: { EUR: 1188, CHF: 1120, GBP: 1020, USD: 1370 },
				deliveryDays: 21
			},
			// --------------------------------------------------------
			// Pack Sérénité / Sérénité+ — SANS engagement, résiliables à
			// tout moment, sur les deux cycles proposés : mensuel (tarif
			// de référence) et annuel (2 mois offerts, payé en une fois).
			// --------------------------------------------------------
			serenite: {
				key: 'serenite',
				name: 'Pack Sérénité',
				type: 'recurring',
				interval: 'mois',
				intervalAnnual: 'an',
				// Mensuel = tarif de référence.
				price: { EUR: 49.90, CHF: 46.90, GBP: 42.90, USD: 58.90 },
				// Annuel : 10 mois payés, 2 mois offerts (-17 % environ).
				annualPrice: { EUR: 499.00, CHF: 469.00, GBP: 429.00, USD: 589.00 },
				includedInterventions: 1,
				// Remise de bienvenue si souscrit EN MÊME TEMPS que la
				// création du site (quel que soit le pack de création),
				// UNIQUEMENT en formule annuelle : la formule annuelle
				// comprend déjà 2 mois offerts par rapport au tarif mensuel
				// (499 € au lieu de 10 × 49,90 € = 599 €) ; la remise combo
				// ajoute UN MOIS OFFERT SUPPLÉMENTAIRE la première année
				// (soit 3 mois offerts en tout la 1ère année), puis retour
				// au tarif annuel normal au renouvellement.
				// ⚠️ `cycles` : la remise ne s'applique QUE sur la formule
				// annuelle. En mensuel, le tarif est toujours plein (49,90 €).
				// (Avant septembre 2026 : -50 % la 1ère année — jugé bien
				// trop généreux par Nathan, remplacé par ce mois offert.)
				// `firstYearMonthlyEur` (depuis le 17/09/2026) : Nathan a demandé des
				// montants « nets » plutôt que le calcul exact au centime
				// (37,43 € -> 37,90 € / mois, soit 454,80 € la 1ère année).
				// Quand ce champ est présent, applyComboToAnnual() l'utilise
				// en priorité (× 12) ; `extraMonthsFree` reste la description
				// commerciale de l'avantage (« +1 mois offert »).
				comboDiscount: { extraMonthsFree: 1, firstYearMonthlyEur: 37.90, scope: 'firstYear', cycles: ['annual'], label: '+1 mois offert la 1ère année (site créé avec moi)' }
			},
			serenitePlus: {
				key: 'serenitePlus',
				name: 'Pack Sérénité+',
				type: 'recurring',
				interval: 'mois',
				intervalAnnual: 'an',
				price: { EUR: 94.90, CHF: 89.90, GBP: 81.90, USD: 109.90 },
				annualPrice: { EUR: 949.00, CHF: 899.00, GBP: 819.00, USD: 1099.00 },
				includedInterventions: 2,
				// Même règle que Sérénité (voir ci-dessus) : un mois offert
				// SUPPLÉMENTAIRE la première année, uniquement en formule
				// annuelle, si le site est créé en même temps.
				// (Avant septembre 2026 : -10 € / mois « à vie » — jugé bien
				// trop généreux par Nathan, remplacé par ce mois offert, pour
				// un traitement identique à Sérénité.)
				// 71,18 € -> 71,90 € / mois (862,80 € la 1ère année), voir Sérénité.
				comboDiscount: { extraMonthsFree: 1, firstYearMonthlyEur: 71.90, scope: 'firstYear', cycles: ['annual'], label: '+1 mois offert la 1ère année (site créé avec moi)' }
			}
		},

		// Ordre d'affichage des packs de création (une seule liste,
		// réutilisée par la page d'accueil, le kickoff et le devis).
		packOrder: ['eclair', 'essentiel', 'vitrine', 'premium'],

		// --------------------------------------------------------
		// OPTIONS « Documents & Automatisation »
		// Tarif unique 100 € par document automatisé.
		// Deux exceptions assumées :
		//   • le bail de location (document complexe) : 300 €
		//   • un document entièrement sur-mesure : à partir de 300 €
		// --------------------------------------------------------
		documentOptions: [
			{ key: 'devis', label: 'Devis', monthlyEur: 5, preview: 'images/documents/devis.png' },
			{ key: 'facture', label: 'Factures', monthlyEur: 5, preview: 'images/documents/facture.png' },
			{ key: 'quittance', label: 'Quittance de loyer', monthlyEur: 5, preview: 'images/documents/quittance.png' },
			{ key: 'frais', label: 'Note de frais', monthlyEur: 5, preview: 'images/documents/frais.png' },
			{ key: 'bail', label: 'Bail de location', monthlyEur: 10, preview: 'images/documents/bail.png', complex: true, note: 'Document complexe (clauses légales, annexes)' },
			{ key: 'sur-mesure', label: 'Document sur-mesure', monthlyEur: 15, from: true, note: 'Tarif de départ, ajusté après étude de votre besoin' }
		],

		// --------------------------------------------------------
		// OPTIONS « Offre Club & Associations »
		// Tarif unique de 5 € / mois par module, qui s'ajoutent à
		// l'abonnement du site (66 € / mois en annuel). Une exception :
		// « Actualités simplifiées » à 33 € / mois — un back-office
		// complet de publication qui rend le club autonome (plus besoin
		// d'une intervention de maintenance pour mettre le site à jour).
		// Ce module porte l'abonnement au niveau du pack Premium, ce qui
		// est exactement l'intention : 66 + 33 = 99 € / mois.
		// Le lot de 3 (voir `optionBundle`) s'applique aux modules à 5 €.
		// --------------------------------------------------------
		clubOptions: [
			{
				key: 'actus', label: 'Actualités simplifiées', monthlyEur: 33,
				icon: 'ph-megaphone', highlight: true,
				desc: 'Un espace de publication rien qu’à vous : news, annonces et photos en autonomie totale, sans passer par moi et sans compétence technique.',
				note: 'Rend le club autonome sur ses mises à jour de contenu'
			},
			{ key: 'resultats', label: 'Résultats & scores en direct', monthlyEur: 5, icon: 'ph-chart-line-up', desc: 'Classements et résultats de matchs mis à jour en temps réel.' },
			{ key: 'deplacements', label: 'Gestion des déplacements interclubs', monthlyEur: 5, icon: 'ph-van', desc: 'Qui vient, quel transport, quels horaires : tout est centralisé.' },
			{ key: 'presence', label: 'Suivi de présence dans les cours', monthlyEur: 5, icon: 'ph-user-check', desc: 'Qui est venu à quel cours : pointage simple, historique par adhérent et par créneau.' },
			{ key: 'frais', label: 'Gestionnaire de notes de frais', monthlyEur: 5, icon: 'ph-receipt', desc: 'Frais de déplacement et remboursements : moins de paperasse pour le trésorier.' },
			{
				key: 'tournoi', label: 'Création de tournois internes', monthlyEur: 5,
				icon: 'ph-trophy',
				desc: 'Poules, ronde suisse, mêlée, simple ou double, classements automatiques.',
				previews: [
					{ src: 'images-tournoi/01-configuration-tournoi.png', alt: 'Configuration des formats de tournoi : poules, ronde suisse, mêlée', caption: 'Configuration des formats et des règles' },
					{ src: 'images-tournoi/02-admin-tournois.png', alt: 'Panneau d’administration listant les tournois du club', caption: 'Gestion centralisée de tous vos tournois' },
					{ src: 'images-tournoi/03-nouveau-evenement.png', alt: 'Création d’un nouvel événement en quelques clics', caption: 'Création d’événement en quelques clics' },
					{ src: 'images-tournoi/04-participants.png', alt: 'Participants et classements en temps réel', caption: 'Participants et classements en temps réel' }
				]
			},
			{ key: 'adhesions', label: 'Inscriptions & adhésions en ligne', monthlyEur: 5, icon: 'ph-user-plus', desc: 'Formulaire d’adhésion, liste des membres et relances de renouvellement.' },
			// Ajouté le 17/09/2026 à la demande de Nathan.
			{ key: 'essais', label: 'Gestion & suivi des essais', monthlyEur: 5, icon: 'ph-hand-waving', desc: 'Demandes de séance d’essai centralisées, créneau proposé, relance et suivi jusqu’à l’adhésion.' }
		],

		// --------------------------------------------------------
		// LOT DE 3 OPTIONS
		// Trois options à 5 € / mois reviennent à 10 € / mois au lieu
		// de 15 €. La remise s'applique par groupe COMPLET de 3, aussi
		// bien aux options documentaires (accueil) qu'aux modules club :
		//   3 options -> 10 €     6 options -> 20 €     7 options -> 25 €
		// Les options hors tarif unitaire (document sur-mesure à 15 €,
		// Actualités simplifiées à 33 €) n'entrent jamais dans le lot.
		// Voir APP_CONFIG.optionsMonthlyTotal().
		// --------------------------------------------------------
		optionBundle: { unitEur: 5, groupSize: 3, groupPriceEur: 10 },

		// --------------------------------------------------------
		// Interventions ponctuelles (hors pack de suivi)
		// --------------------------------------------------------
		interventions: [
			{ key: 'simple', label: 'Simple', desc: 'Texte / photo', priceEur: 100 },
			{ key: 'moyenne', label: 'Moyenne', desc: 'Mise en page', priceEur: 200 },
			{ key: 'complexe', label: 'Complexe', desc: 'Nouvelle fonctionnalité', priceEur: 300 },
			// Le relifting n'est plus une prestation ponctuelle : c'est un
			// abonnement au tarif de Vitrine Essentiel (66 € / mois affichés),
			// avec DEUX ANS réglés en une fois à la commande — le temps de
			// rentabiliser la refonte complète d'un site existant.
			{
				key: 'relifting',
				label: 'Relifting complet',
				desc: 'Ancien site → design moderne',
				subscription: true,
				offerKey: 'essentiel',
				prepaidYears: 2,
				priceEur: 1580        // 790 € × 2 ans, réglés en une seule fois
			}
		],

		// --------------------------------------------------------
		// Facilitateur numérique (interventions à domicile)
		// --------------------------------------------------------
		facilitateur: {
			// ⚙️ SOURCE UNIQUE des tarifs « aide à domicile » (17/09/2026).
			// Changer un chiffre ici met à jour la page /aide-domicile/,
			// l'encart de l'accueil, les flyers (/supports/) et la facture
			// rapide Stripe. Rien n'est écrit en dur ailleurs.
			prestationEur: 70,          // prix d'UNE prestation (plus de tarif horaire : ça rassure)
			complexSurchargeEur: 15,    // supplément éventuel si le problème s'avère complexe
			noFixNoFee: true,           // déplacement sans solution trouvée = gratuit
			diagnosticEur: 90,          // diagnostic complet (1 h 30)
			cassetteEur: 70,            // numérisation d'une cassette (VHS, Hi8, MiniDV)
			cassetteBundle: { count: 10, freeItems: 1 },   // lot de 10 = 1 cassette offerte
			photoEur: 0.15,             // photo papier numérisée
			// Carte de fidélité : la N-ième intervention bénéficie de X % de remise.
			loyalty: { visits: 5, discountPercent: 50 },
			// Prestations facturables (page /aide-domicile/ + facture rapide).
			// `amount` = clé lue par APP_CONFIG.facilitateurAmount().
			services: [
				{ key: 'contact', label: 'Rester en contact avec vos proches', amount: 'prestationEur', unit: 'prestation' },
				{ key: 'installation', label: 'Installation & divertissement', amount: 'prestationEur', unit: 'prestation' },
				{ key: 'securite', label: 'Sécurité & sérénité numérique', amount: 'prestationEur', unit: 'prestation' },
				{ key: 'formation', label: 'Formation & accompagnement', amount: 'prestationEur', unit: 'prestation' },
				{ key: 'sante', label: 'Santé & télémédecine', amount: 'prestationEur', unit: 'prestation' },
				{ key: 'administratif', label: 'Aide administrative numérique', amount: 'prestationEur', unit: 'prestation' },
				{ key: 'depannage', label: 'Dépannage (box, imprimante, TV, téléphone)', amount: 'prestationEur', unit: 'prestation' },
				{ key: 'diagnostic', label: 'Diagnostic complet (1 h 30)', amount: 'diagnosticEur', unit: 'diagnostic' },
				{ key: 'cassette', label: 'Numérisation de cassettes (VHS, Hi8, MiniDV)', amount: 'cassetteEur', unit: 'cassette', quantity: true },
				{ key: 'cassetteBundle', label: 'Lot de cassettes numérisées (une offerte)', amount: 'cassetteBundle', unit: 'lot' },
				{ key: 'photo', label: 'Photos papier numérisées', amount: 'photoEur', unit: 'photo', quantity: true }
			],
			// Alias conservé pour compatibilité (anciens appels « hourlyEur »).
			get hourlyEur() { return this.prestationEur; }
		},

		// --------------------------------------------------------
		// Hébergement : PLUS DE LIGNE À PART depuis septembre 2026.
		// L'hébergement professionnel, le nom de domaine, les certificats
		// et les sauvegardes sont pris en charge en interne et compris
		// dans l'abonnement annuel du pack. Il n'y a donc plus de tarif
		// d'hébergeur tiers (OVH Starter / Perso) à afficher : l'ancien
		// objet `hosting` a été retiré volontairement. Ne pas le
		// réintroduire sans en reparler à Nathan.
		// --------------------------------------------------------

		// --------------------------------------------------------
		// Offre Club & Associations (page /offre-club/)
		// Ce n'est PAS un pack séparé : c'est le pack
		// « Vitrine Essentiel » décliné pour les clubs, avec ses
		// propres options. Un seul prix de base, partout.
		// --------------------------------------------------------
		club: {
			name: 'Offre Club & Associations',
			baseOfferKey: 'essentiel',
			serenityOfferKey: 'serenite',
			badgeLabel: 'Offre club / associations',
			description: 'Le pack Vitrine Essentiel, décliné pour les clubs et les associations : site complet, suivi inclus et modules dédiés à la vie du club.'
		},

		// --------------------------------------------------------
		// Étude de cas / preuve sociale — Badminton Club Évian
		// Données Google Search Console, 7 mars → 5 septembre 2026
		// --------------------------------------------------------
		caseStudy: {
			clubName: 'Badminton Club Évian',
			site: 'badminton-evian.fr',
			periodLabel: '7 mars – 5 septembre 2026',
			periodDays: 182,
			metrics: {
				clicks: 558,
				impressions: 5770,
				ctrPercent: 9.7,
				avgPosition: 5.6,
				peakDateLabel: '4 septembre 2026',
				peakClicks: 23,
				peakImpressions: 87,
				seasonalityFactor: 4,
				seasonalityLowImpressions: 30,
				seasonalityHighImpressions: 120,
				seasonalityLabel: "Quadruplement de la visibilité sur la période clé d'août/septembre"
			}
		},

		// --------------------------------------------------------
		// Parcours commercial (aucun paiement en ligne)
		// --------------------------------------------------------
		funnel: {
			steps: [
				{ key: 'rdv', label: 'Je réserve mon rendez-vous', desc: 'Un créneau de 20 à 30 minutes, gratuit et sans engagement.' },
				{ key: 'brief', label: 'Je prépare le rendez-vous', desc: 'Un formulaire court pour cadrer le projet et gagner du temps.' },
				{ key: 'devis', label: 'Je reçois mon devis', desc: 'Établi à partir de votre brief, détaillé et sans surprise.' },
				{ key: 'creation', label: 'On construit le site', desc: 'Points réguliers, ajustements, mise en ligne.' },
				{ key: 'facture', label: 'Je règle à la livraison', desc: 'Facture envoyée par e-mail avec son lien de paiement sécurisé.' }
			],
			depositPercent: 30,
			quoteValidityDays: 30
		},

		// --------------------------------------------------------
		// Chemins des pages.
		// Les valeurs sont relatives à la racine du site ; la
		// fonction `url()` plus bas leur ajoute automatiquement le
		// bon préfixe (« /portfolio/ » sur GitHub Pages, « / » sur un
		// nom de domaine propre, ou le bon nombre de « ../ » depuis
		// une sous-page). Aucun chemin n'est donc figé.
		// --------------------------------------------------------
		pages: {
			home: '',
			services: '#services',
			contact: '#contact',
			club: 'offre-club/',
			aideDomicile: 'aide-domicile/',
			kickoff: 'kickoff/',
			merci: 'merci/',
			admin: 'admin/',
			devis: 'contrat/devis&contrat/',
			quittance: 'contrat/quittance/',
			bail: 'contrat/bail/',
			running: 'running/'
		},

		// --------------------------------------------------------
		// Supabase — authentification de l'espace sécurisé et
		// stockage des demandes, clients, devis et factures.
		// La clé ci-dessous est PUBLIQUE (publishable) : les accès
		// réels sont verrouillés par les politiques RLS côté base.
		// --------------------------------------------------------
		supabase: {
			url: 'https://jbhaawganoejgbzozmyb.supabase.co',
			anonKey: 'sb_publishable_G58ZQ6vRLQDLL1SbPw7gYQ_OwO-k-KI',
			tables: {
				leads: 'nm_leads',
				clients: 'nm_clients',
				briefs: 'nm_briefs',
				documents: 'nm_documents',
				prospects: 'nm_prospects'
			},
			functions: {
				stripeInvoice: 'stripe-invoice',
				// Analyses rédigées par Gemini (niveau gratuit, clé côté serveur)
				aiAssist: 'ai-assist',
				// Recherche d'associations (annuaire public de l'État) et
				// inspection du site d'un prospect
				prospectTools: 'prospect-tools'
			}
		},

		// --------------------------------------------------------
		// Intégrations tierces (facultatives, best-effort)
		// --------------------------------------------------------
		integrations: {
			// OBSOLÈTE — conservé pour compatibilité uniquement.
			// Les notifications Zapier ne partent plus du navigateur :
			// elles sont déclenchées par Supabase lui-même (déclencheurs
			// SQL sur nm_leads / nm_briefs). Les URL « Catch Hook » se
			// règlent dans /admin/ → onglet Réglages, pas ici.
			zapierWebhookUrl: '',
			// Formulaire de brief projet (page /kickoff/)
			formspreeEndpoint: 'https://formspree.io/f/mwvbqozd'
		},

		// --------------------------------------------------------
		// Sélecteur Langue / Devise — une seule liste déroulante
		// --------------------------------------------------------
		languageSelector: {
			FR: { locale: 'fr', currency: 'EUR', flag: '🇫🇷', label: 'FR' },
			CHF: { locale: 'fr', currency: 'CHF', flag: '🇨🇭', label: 'CH' },
			EN: { locale: 'en', currency: 'GBP', flag: '🇬🇧', label: 'EN' },
			US: { locale: 'en', currency: 'USD', flag: '🇺🇸', label: 'US' }
		},

		// --------------------------------------------------------
		// Libellés traduits (CTA et mentions courtes uniquement :
		// le contenu éditorial reste en français).
		// --------------------------------------------------------
		i18n: {
			fr: {
				navReserve: 'Réserver',
				navBackHome: 'Retour à l’accueil',
				heroCta: 'Discuter de votre projet',
				bookCta: 'Réserver mon RDV de lancement (20-30 min)',
				bookHint: 'Gratuit, sans engagement — le temps qu’il faut pour cadrer votre projet.',
				prepareCta: 'Préparer la réunion',
				quoteButtonLabel: 'Réserver mon RDV de lancement gratuit (20-30 min)',
				noOnlinePayment: 'Aucun paiement en ligne : vous recevez un devis, puis une facture à la livraison.',
				perMonth: '/ mois',
				perYear: 'an',
				perHour: '/ heure',
				perYearShort: '/an',
				from: 'À partir de',
				deposit: 'Acompte',
				balance: 'Solde',
				themeLight: 'Mode clair',
				themeDark: 'Mode sombre'
			},
			en: {
				navReserve: 'Book a call',
				navBackHome: 'Back to home',
				heroCta: 'Discuss your project',
				bookCta: 'Book my kick-off call (20-30 min)',
				bookHint: 'Free, no strings attached — enough time to properly scope your project.',
				prepareCta: 'Prepare the meeting',
				quoteButtonLabel: 'Book my free kick-off call (20-30 min)',
				noOnlinePayment: 'No online payment: you receive a quote, then an invoice on delivery.',
				perMonth: '/ month',
				perYear: 'year',
				perHour: '/ hour',
				perYearShort: '/yr',
				from: 'From',
				deposit: 'Deposit',
				balance: 'Balance',
				themeLight: 'Light mode',
				themeDark: 'Dark mode'
			}
		},
		currentLocale: 'fr'
	};

	// ------------------------------------------------------------
	// Petites aides partagées par toutes les pages.
	// ------------------------------------------------------------
	APP_CONFIG.findDocumentOption = function (key) {
		return APP_CONFIG.documentOptions.filter(function (o) { return o.key === key; })[0] || null;
	};
	APP_CONFIG.findClubOption = function (key) {
		return APP_CONFIG.clubOptions.filter(function (o) { return o.key === key; })[0] || null;
	};
	APP_CONFIG.findIntervention = function (key) {
		return APP_CONFIG.interventions.filter(function (o) { return o.key === key; })[0] || null;
	};

	// ------------------------------------------------------------
	// Remise « combo » Sérénité — utilisée par script.js, offre-club.js
	// ET quote-builder.js (une seule règle, partout). Un pack de
	// création (eclair/essentiel/vitrine/premium/club) souscrit EN
	// MÊME TEMPS qu'un abonnement Sérénité ou Sérénité+ déclenche la
	// remise décrite sur l'offre correspondante (`comboDiscount`).
	//   APP_CONFIG.comboDiscountFor('vitrine', 'plus') -> {percent:10,...}
	//   APP_CONFIG.comboDiscountFor(null, 'simple')     -> null (pas de création = pas de combo)
	// ------------------------------------------------------------
	// `cycle` (optionnel) : 'monthly' | 'annual'. Les remises ne
	// s'appliquent QUE sur la formule annuelle (`comboDiscount.cycles`) —
	// en mensuel, le tarif affiché est toujours le plein tarif.
	APP_CONFIG.comboDiscountFor = function (packKey, tier, cycle) {
		if (!packKey || !tier) return null;
		var creationOffers = ['eclair', 'essentiel', 'vitrine', 'premium'];
		var normalizedPack = String(packKey).toLowerCase();
		var isCreation = creationOffers.indexOf(normalizedPack) !== -1 || normalizedPack === 'club';
		if (!isCreation) return null;
		var offerKey = tier === 'plus' ? 'serenitePlus' : 'serenite';
		var offer = APP_CONFIG.offers[offerKey];
		var combo = (offer && offer.comboDiscount) || null;
		if (!combo) return null;
		if (cycle && combo.cycles && combo.cycles.indexOf(cycle) === -1) return null;
		return combo;
	};

	// Applique une remise combo à un montant ANNUEL. Formes possibles :
	//   { extraMonthsFree: 1 } -> retire N mois offerts SUPPLÉMENTAIRES, au
	//                             tarif mensuel PLEIN de référence (Sérénité
	//                             ET Sérénité+ depuis septembre 2026 : 1 mois
	//                             offert en plus des 2 déjà inclus dans le
	//                             tarif annuel). `monthlyRefEur` est le tarif
	//                             mensuel plein de l'offre concernée — les
	//                             appelants doivent le transmettre (c'est le
	//                             prix `price.EUR` du catalogue, jamais
	//                             recalculé depuis l'annuel).
	//   { percent: N }         -> pourcentage (ancienne forme, conservée
	//                             pour compatibilité si réutilisée ailleurs)
	//   { monthlyEur: N }      -> montant rond retiré par mois, × 12 sur
	//                             l'année (ancienne forme Sérénité+)
	APP_CONFIG.applyComboToAnnual = function (annualEur, combo, monthlyRefEur) {
		if (!annualEur || !combo) return annualEur;
		// Montant mensuel « net » fixé à la main pour la 1ère année (prioritaire).
		if (combo.firstYearMonthlyEur) return Math.round(combo.firstYearMonthlyEur * 12 * 100) / 100;
		if (combo.extraMonthsFree) {
			var ref = (monthlyRefEur != null) ? monthlyRefEur : (annualEur / 10);
			return Math.max(0, Math.round((annualEur - ref * combo.extraMonthsFree) * 100) / 100);
		}
		if (combo.percent) return APP_CONFIG.applyDiscount(annualEur, combo.percent);
		if (combo.monthlyEur) return Math.max(0, Math.round((annualEur - combo.monthlyEur * 12) * 100) / 100);
		return annualEur;
	};

	// Applique un pourcentage de remise à un montant (arrondi au centime).
	APP_CONFIG.applyDiscount = function (amount, percent) {
		if (!amount || !percent) return amount;
		return Math.round(amount * (1 - percent / 100) * 100) / 100;
	};

	// ------------------------------------------------------------
	// Packs de création — les deux montants mensuels (voir le gros
	// commentaire au-dessus de `packBilling`).
	//
	//   packMonthlyEquivalent('vitrine','EUR') -> 74   (890 / 12)
	//     = le gros chiffre affiché quand le cycle ANNUEL est choisi.
	//   packMonthlyPrice('vitrine','EUR')      -> 86   (74 × 14/12)
	//     = ce que paie réellement un client qui règle au mois.
	//
	// Le tarif mensuel se calcule à partir de l'équivalent DÉJÀ arrondi,
	// et non du prix annuel brut : c'est ce qui garantit que le chiffre
	// affiché (58 €) et le chiffre facturé (68 €) restent cohérents.
	// ------------------------------------------------------------
	APP_CONFIG.packMonthlyEquivalent = function (offerKey, currencyCode) {
		var offer = APP_CONFIG.offers[offerKey];
		if (!offer || !offer.price) return null;
		var annual = offer.price[currencyCode || 'EUR'];
		if (annual === undefined || annual === null) return null;
		return Math.round(annual / 12);
	};

	APP_CONFIG.packMonthlyPrice = function (offerKey, currencyCode) {
		var equivalent = APP_CONFIG.packMonthlyEquivalent(offerKey, currencyCode);
		if (equivalent === null) return null;
		var s = (APP_CONFIG.packBilling && APP_CONFIG.packBilling.monthlySurcharge) || { numerator: 14, denominator: 12 };
		return Math.round(equivalent * s.numerator / s.denominator);
	};

	// ------------------------------------------------------------
	// Total MENSUEL des options retenues, lot de 3 appliqué.
	// Accepte une liste de montants mensuels en euros (ex : [5,5,5,33]).
	// Seules les options au tarif unitaire (5 €) entrent dans le lot ;
	// chaque groupe complet de 3 revient à 10 € au lieu de 15 €.
	//   [5,5,5]       -> 10        [5,5,5,5,5,5] -> 20
	//   [5,5]         -> 10        [5,5,5,33]    -> 43
	// ------------------------------------------------------------
	APP_CONFIG.optionsMonthlyTotal = function (monthlyAmounts) {
		var bundle = APP_CONFIG.optionBundle || { unitEur: 5, groupSize: 3, groupPriceEur: 10 };
		var unitCount = 0;
		var others = 0;
		(monthlyAmounts || []).forEach(function (amount) {
			var value = Number(amount) || 0;
			if (value === bundle.unitEur) unitCount++;
			else others += value;
		});
		var groups = Math.floor(unitCount / bundle.groupSize);
		var remainder = unitCount % bundle.groupSize;
		return others + (groups * bundle.groupPriceEur) + (remainder * bundle.unitEur);
	};

	// Économie réalisée grâce au lot de 3 (0 si aucun groupe complet).
	APP_CONFIG.optionsBundleSaving = function (monthlyAmounts) {
		var raw = (monthlyAmounts || []).reduce(function (s, a) { return s + (Number(a) || 0); }, 0);
		return Math.max(0, raw - APP_CONFIG.optionsMonthlyTotal(monthlyAmounts));
	};

	// ------------------------------------------------------------
	// Aide à domicile — montants DÉRIVÉS de `facilitateur` (jamais en dur).
	//   facilitateurAmount('cassetteBundle') -> 630  (70 × (10 − 1))
	//   facilitateurAmount('loyaltyVisit')   -> 35   (70 × (1 − 50 %))
	// Et un « hydrateur » : tout élément portant data-fac-price="clé"
	// reçoit data-price-eur (rendu ensuite par i18n.js), et tout élément
	// data-fac-text="clé" reçoit le texte correspondant (5, 50 %, 10…).
	// ------------------------------------------------------------
	APP_CONFIG.facilitateurAmount = function (key) {
		var F = APP_CONFIG.facilitateur || {};
		var b = F.cassetteBundle || { count: 10, freeItems: 1 };
		var l = F.loyalty || { visits: 5, discountPercent: 50 };
		switch (key) {
			case 'cassetteBundle': return Math.round(F.cassetteEur * (b.count - b.freeItems) * 100) / 100;
			case 'cassetteBundleSaving': return Math.round(F.cassetteEur * b.freeItems * 100) / 100;
			case 'loyaltyVisit': return Math.round(F.prestationEur * (1 - l.discountPercent / 100) * 100) / 100;
			case 'prestationComplex': return F.prestationEur + F.complexSurchargeEur;
			default: return F[key];
		}
	};
	APP_CONFIG.facilitateurText = function (key) {
		var F = APP_CONFIG.facilitateur || {};
		var b = F.cassetteBundle || {};
		var l = F.loyalty || {};
		switch (key) {
			case 'loyaltyVisits': return String(l.visits);
			case 'loyaltyVisitOrdinal': return l.visits + (l.visits === 1 ? 'ʳᵉ' : 'ᵉ');
			case 'loyaltyPercent': return l.discountPercent + ' %';
			case 'bundleCount': return String(b.count);
			case 'bundleFree': return b.freeItems > 1 ? b.freeItems + ' cassettes offertes' : 'une cassette offerte';
			default: return '';
		}
	};
	APP_CONFIG.hydrateFacilitateur = function (root) {
		if (typeof document === 'undefined') return;
		var scope = root || document;
		scope.querySelectorAll('[data-fac-price]').forEach(function (el) {
			var v = APP_CONFIG.facilitateurAmount(el.getAttribute('data-fac-price'));
			if (v !== undefined && v !== null) {
				el.setAttribute('data-price-eur', v);
				if (!el.textContent.trim() || /€/.test(el.textContent)) {
					el.textContent = String(v).replace('.', ',') + ' €';
				}
			}
		});
		scope.querySelectorAll('[data-fac-text]').forEach(function (el) {
			var t = APP_CONFIG.facilitateurText(el.getAttribute('data-fac-text'));
			if (t) el.textContent = t;
		});
	};

	// ------------------------------------------------------------
	// Résolution des chemins : renvoie une URL correcte depuis
	// n'importe quelle page du site, quel que soit son niveau
	// d'imbrication et quel que soit le préfixe de déploiement.
	//   APP_CONFIG.url('kickoff')  ->  '../kickoff/' depuis /merci/
	// ------------------------------------------------------------
	APP_CONFIG.url = function (pageKey) {
		var target = APP_CONFIG.pages[pageKey];
		if (target === undefined) target = pageKey || '';
		if (typeof document === 'undefined') return target;
		if (target.charAt(0) === '#') return target;

		// Profondeur = nombre de segments de dossier après la racine
		// du site. La racine est repérée grâce au <script src> de
		// config.js, qui pointe toujours vers elle.
		var script = document.querySelector('script[src$="config.js"]');
		var prefix = './';
		if (script) {
			var src = script.getAttribute('src') || '';
			prefix = src.replace(/config\.js$/, '') || './';
		}
		return prefix + target;
	};

	root.APP_CONFIG = APP_CONFIG;

	// Hydratation automatique des tarifs « aide à domicile » AVANT le rendu
	// des prix par i18n.js (config.js est toujours chargé avant lui).
	if (typeof document !== 'undefined') {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', function () { APP_CONFIG.hydrateFacilitateur(); });
		} else {
			APP_CONFIG.hydrateFacilitateur();
		}
	}

})(typeof window !== 'undefined' ? window : this);
