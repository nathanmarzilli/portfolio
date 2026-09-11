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
		// Marque de l'activité d'accompagnement à domicile.
		brand: {
			name: 'Clic à l’aide',
			tagline: 'Le numérique, sans prise de tête',
			logo: 'images/logo/Logo-1.png'
		},

		contact: {
			name: 'Nathan Marzilli',
			role: 'Ingénieur & Artisan du web',
			email: 'nathan.marzilli@gmail.com',
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
			CHF: {
				rate: 0.94,
				exact: {
					'0.15': 0.15, '50': 47, '70': 65, '90': 85, '100': 95, '200': 190,
					'250': 235, '300': 285, '320': 300, '690': 650, '990': 930,
					'1000': 940, '1790': 1690, '2990': 2820, '22.05': 20.90, '54.79': 51.90
				}
			},
			GBP: {
				rate: 0.855,
				exact: {
					'0.15': 0.13, '50': 43, '70': 60, '90': 77, '100': 85, '200': 170,
					'250': 215, '300': 255, '320': 275, '690': 590, '990': 850,
					'1000': 850, '1790': 1530, '2990': 2560, '22.05': 18.90, '54.79': 46.90
				}
			},
			USD: {
				rate: 1.15,
				exact: {
					'0.15': 0.17, '50': 58, '70': 80, '90': 105, '100': 115, '200': 230,
					'250': 290, '300': 345, '320': 370, '690': 790, '990': 1150,
					'1000': 1150, '1790': 2090, '2990': 3490, '22.05': 25.90, '54.79': 62.90
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
		offers: {
			eclair: {
				key: 'eclair',
				name: 'Vitrine Éclair',
				type: 'one_time',
				tagline: 'Le tremplin pour démarrer, livré en 48 h.',
				price: { EUR: 690, CHF: 650, GBP: 590, USD: 790 },
				deliveryDays: 2,
				hostingKey: 'starter'
			},
			essentiel: {
				key: 'essentiel',
				name: "L'Essentiel & Suivi",
				type: 'one_time',
				tagline: 'Un site one-page entretenu toute l’année, sans y penser.',
				price: { EUR: 990, CHF: 930, GBP: 850, USD: 1150 },
				deliveryDays: 7,
				hostingKey: 'starter',
				// Pack Sérénité (simple) inclus et obligatoire, facturé
				// annuellement (10 mois payés, 2 mois offerts).
				forcedSerenity: { tier: 'simple', cycle: 'annual' },
				// Cette offre est aussi celle proposée aux clubs et
				// associations, avec des options spécifiques (voir `club`).
				clubVariant: true
			},
			vitrine: {
				key: 'vitrine',
				name: 'Vitrine Artisan',
				type: 'one_time',
				tagline: 'Jusqu’à 5 pages pour présenter tout votre savoir-faire.',
				price: { EUR: 1790, CHF: 1690, GBP: 1530, USD: 2090 },
				deliveryDays: 14,
				hostingKey: 'starter',
				popular: true
			},
			premium: {
				key: 'premium',
				name: 'Premium',
				type: 'one_time',
				tagline: 'Design sur-mesure, blog en autonomie et statistiques.',
				price: { EUR: 2990, CHF: 2820, GBP: 2560, USD: 3490 },
				deliveryDays: 21,
				hostingKey: 'perso'
			},
			serenite: {
				key: 'serenite',
				name: 'Pack Sérénité',
				type: 'recurring',
				interval: 'mois',
				intervalAnnual: 'an',
				price: { EUR: 49.90, CHF: 46.90, GBP: 42.90, USD: 58.90 },
				// Facturation annuelle = 10 mois payés, 2 mois offerts.
				annualPrice: { EUR: 499.00, CHF: 469.00, GBP: 429.00, USD: 589.00 },
				includedInterventions: 1,
				commitmentMonths: 12
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
				commitmentMonths: 12
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
			{ key: 'devis', label: 'Devis', priceEur: 100, preview: 'images/documents/devis.png' },
			{ key: 'facture', label: 'Factures', priceEur: 100, preview: 'images/documents/facture.png' },
			{ key: 'quittance', label: 'Quittance de loyer', priceEur: 100, preview: 'images/documents/quittance.png' },
			{ key: 'frais', label: 'Note de frais', priceEur: 100, preview: 'images/documents/frais.png' },
			{ key: 'bail', label: 'Bail de location', priceEur: 300, preview: 'images/documents/bail.png', complex: true, note: 'Document complexe (clauses légales, annexes)' },
			{ key: 'sur-mesure', label: 'Document sur-mesure', priceEur: 300, from: true, note: 'Tarif de départ, ajusté après étude de votre besoin' }
		],

		// --------------------------------------------------------
		// OPTIONS « Offre Club & Associations »
		// Tarif unique de 100 € par module, avec une exception :
		// « Actualités simplifiées » (1 000 €) est un back-office
		// complet de publication. Il rend le club autonome : plus
		// besoin de passer par une intervention de maintenance pour
		// mettre le site à jour. Le tarif reflète ce travail-là.
		// --------------------------------------------------------
		clubOptions: [
			{
				key: 'actus', label: 'Actualités simplifiées', priceEur: 1000,
				icon: 'ph-megaphone', highlight: true,
				desc: 'Un espace de publication rien qu’à vous : news, annonces et photos en autonomie totale, sans passer par moi et sans compétence technique.',
				note: 'Rend le club autonome sur ses mises à jour de contenu'
			},
			{ key: 'resultats', label: 'Résultats & scores en direct', priceEur: 100, icon: 'ph-chart-line-up', desc: 'Classements et résultats de matchs mis à jour en temps réel.' },
			{ key: 'deplacements', label: 'Gestion des déplacements interclubs', priceEur: 100, icon: 'ph-van', desc: 'Qui vient, quel transport, quels horaires : tout est centralisé.' },
			{ key: 'frais', label: 'Gestionnaire de notes de frais', priceEur: 100, icon: 'ph-receipt', desc: 'Frais de déplacement et remboursements : moins de paperasse pour le trésorier.' },
			{
				key: 'tournoi', label: 'Création de tournois internes', priceEur: 100,
				icon: 'ph-trophy',
				desc: 'Poules, ronde suisse, mêlée, simple ou double, classements automatiques.',
				previews: [
					{ src: 'images-tournoi/01-configuration-tournoi.png', alt: 'Configuration des formats de tournoi : poules, ronde suisse, mêlée', caption: 'Configuration des formats et des règles' },
					{ src: 'images-tournoi/02-admin-tournois.png', alt: 'Panneau d’administration listant les tournois du club', caption: 'Gestion centralisée de tous vos tournois' },
					{ src: 'images-tournoi/03-nouveau-evenement.png', alt: 'Création d’un nouvel événement en quelques clics', caption: 'Création d’événement en quelques clics' },
					{ src: 'images-tournoi/04-participants.png', alt: 'Participants et classements en temps réel', caption: 'Participants et classements en temps réel' }
				]
			},
			{ key: 'adhesions', label: 'Inscriptions & adhésions en ligne', priceEur: 100, icon: 'ph-user-plus', desc: 'Formulaire d’adhésion, liste des membres et relances de renouvellement.' }
		],

		// --------------------------------------------------------
		// Interventions ponctuelles (hors pack de suivi)
		// --------------------------------------------------------
		interventions: [
			{ key: 'simple', label: 'Simple', desc: 'Texte / photo', priceEur: 100 },
			{ key: 'moyenne', label: 'Moyenne', desc: 'Mise en page', priceEur: 200 },
			{ key: 'complexe', label: 'Complexe', desc: 'Nouvelle fonctionnalité', priceEur: 300 },
			{ key: 'relifting', label: 'Relifting complet', desc: 'Ancien site → design moderne', priceEur: 690, from: true }
		],

		// --------------------------------------------------------
		// Facilitateur numérique (interventions à domicile)
		// --------------------------------------------------------
		facilitateur: {
			hourlyEur: 70,
			diagnosticEur: 90,
			pack5hEur: 320,
			cassetteEur: 70,
			photoEur: 0.15
		},

		// --------------------------------------------------------
		// Hébergement OVH (payé directement à l'hébergeur)
		// --------------------------------------------------------
		hosting: {
			starter: { label: 'OVH Starter', yearlyEur: 22.05, hostingEur: 14.26, domainEur: 7.79, storage: '1 Go' },
			perso: { label: 'OVH Perso', yearlyEur: 54.79, hostingEur: 47.00, domainEur: 7.79, storage: '100 Go' },
			firstYearFree: true
		},

		// --------------------------------------------------------
		// Offre Club & Associations (page /offre-club/)
		// Ce n'est PAS un pack séparé : c'est le pack
		// « L'Essentiel & Suivi » décliné pour les clubs, avec ses
		// propres options. Un seul prix de base, partout.
		// --------------------------------------------------------
		club: {
			name: 'Offre Club & Associations',
			baseOfferKey: 'essentiel',
			serenityOfferKey: 'serenite',
			badgeLabel: 'Offre club / associations',
			description: 'Le pack L’Essentiel & Suivi, décliné pour les clubs et les associations : site complet, suivi inclus et modules dédiés à la vie du club.'
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
				documents: 'nm_documents'
			},
			functions: {
				stripeInvoice: 'stripe-invoice'
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

})(typeof window !== 'undefined' ? window : this);
