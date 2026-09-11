/* ============================================================
   LANGUE / DEVISE — état partagé + sélecteur déroulant
   ------------------------------------------------------------
   Un seul choix visible dans l'en-tête (ex. « 🇫🇷 FR · € »), qui
   ouvre une liste déroulante compacte. Chaque option fixe à la
   fois la LANGUE des libellés d'action et la DEVISE d'affichage
   des prix.

   Dépend de config.js (window.APP_CONFIG) et de
   assets/css/theme.css pour les styles `.lang-select`.

   API publique :
     NM.i18n.currency()            -> 'EUR' | 'CHF' | 'GBP' | 'USD'
     NM.i18n.locale()              -> 'fr' | 'en'
     NM.i18n.t(key)                -> libellé traduit
     NM.i18n.format(1790)          -> "1 790 €"
     NM.i18n.price(offerKey)       -> montant dans la devise active
     NM.i18n.convert(amountEur)    -> montant converti + arrondi
     NM.i18n.render()              -> re-rend tous les prix de la page
     NM.i18n.onChange(fn)          -> abonnement aux changements

   Balises HTML reconnues :
     [data-lang-select]            -> reçoit le sélecteur déroulant
     [data-i18n="cle"]             -> texte traduit
     [data-offer-key="essentiel"]  -> prix du pack, devise active
     [data-offer-key="serenite-annual"] -> tarif annuel Sérénité
     [data-price-eur="100"]        -> montant libre exprimé en EUR
   ============================================================ */
(function (root) {
	'use strict';

	var CURRENCY_KEY = 'preferredCurrency';
	var LOCALE_KEY = 'preferredLocale';
	var listeners = [];

	function cfg() {
		return root.APP_CONFIG || { currencies: {}, offers: {}, i18n: {}, languageSelector: {} };
	}

	// ---------------------------------------------------------
	// Détection automatique du pays
	// ---------------------------------------------------------
	// Au tout premier passage, on devine la devise et la langue à
	// partir du fuseau horaire et de la langue du navigateur : un
	// visiteur suisse voit des francs, un visiteur britannique des
	// livres, etc. Dès qu'il choisit explicitement dans le menu,
	// son choix est mémorisé et prime pour toujours.
	var ZONE_MAP = {
		'Europe/Zurich': 'CHF', 'Europe/Vaduz': 'CHF', 'Europe/Busingen': 'CHF',
		'Europe/Paris': 'EUR', 'Europe/Brussels': 'EUR', 'Europe/Luxembourg': 'EUR',
		'Europe/Monaco': 'EUR', 'Europe/Madrid': 'EUR', 'Europe/Berlin': 'EUR',
		'Europe/Rome': 'EUR', 'Europe/Lisbon': 'EUR', 'Europe/Amsterdam': 'EUR',
		'Europe/Dublin': 'EUR', 'Europe/Vienna': 'EUR',
		'Europe/London': 'GBP', 'Europe/Belfast': 'GBP', 'Europe/Guernsey': 'GBP',
		'Europe/Isle_of_Man': 'GBP', 'Europe/Jersey': 'GBP'
	};

	function detectPair() {
		var C = cfg();
		var fallback = { currency: C.defaultCurrency || 'EUR', locale: C.currentLocale || 'fr' };
		var code = null;

		// 1. Fuseau horaire — l'indice le plus fiable sur le pays réel.
		try {
			var zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
			if (ZONE_MAP[zone]) {
				code = ZONE_MAP[zone];
			} else if (zone.indexOf('America/') === 0 || zone.indexOf('Pacific/Honolulu') === 0) {
				code = 'USD';
			}
		} catch (e) { /* Intl indisponible */ }

		// 2. Langue du navigateur — pour affiner (fr-CH, en-GB, en-US…).
		var lang = '';
		try { lang = (navigator.languages && navigator.languages[0]) || navigator.language || ''; } catch (e) { /* ignore */ }
		var region = (lang.split('-')[1] || '').toUpperCase();
		if (!code) {
			if (region === 'CH' || region === 'LI') code = 'CHF';
			else if (region === 'GB' || region === 'IE') code = region === 'IE' ? 'EUR' : 'GBP';
			else if (region === 'US' || region === 'CA') code = 'USD';
		}
		if (!code) return fallback;

		// 3. La langue suit la devise, sauf en Suisse romande où le
		//    français reste la langue naturelle.
		var loc = (code === 'GBP' || code === 'USD') ? 'en' : 'fr';
		if (code === 'CHF' && lang.slice(0, 2) === 'de') loc = 'fr'; // pas de version allemande du site
		if (!(C.currencies || {})[code]) return fallback;
		return { currency: code, locale: loc };
	}

	// ---------------------------------------------------------
	// État
	// ---------------------------------------------------------
	function currency() {
		var C = cfg();
		try {
			var stored = localStorage.getItem(CURRENCY_KEY);
			if (stored && C.currencies[stored]) return stored;
		} catch (e) { /* localStorage indisponible */ }
		return detectPair().currency;
	}

	function locale() {
		var C = cfg();
		try {
			var stored = localStorage.getItem(LOCALE_KEY);
			if (stored && C.i18n && C.i18n[stored]) return stored;
		} catch (e) { /* localStorage indisponible */ }
		return detectPair().locale;
	}

	function setPair(currencyCode, localeCode) {
		var C = cfg();
		if (C.currencies[currencyCode]) {
			try { localStorage.setItem(CURRENCY_KEY, currencyCode); } catch (e) { /* ignore */ }
		}
		if (C.i18n && C.i18n[localeCode]) {
			try { localStorage.setItem(LOCALE_KEY, localeCode); } catch (e) { /* ignore */ }
		}
		render();
		listeners.forEach(function (fn) {
			try { fn({ currency: currency(), locale: locale() }); } catch (e) { console.error(e); }
		});
		try {
			document.dispatchEvent(new CustomEvent('nm:localechange', {
				detail: { currency: currency(), locale: locale() }
			}));
		} catch (e) { /* ignore */ }
	}

	// ---------------------------------------------------------
	// Formatage monétaire
	// ---------------------------------------------------------
	function format(amount, currencyCode) {
		var C = cfg();
		var code = currencyCode || currency();
		var cur = C.currencies[code] || { symbol: '€', position: 'suffix', spaced: true };
		if (amount === null || amount === undefined || isNaN(amount)) return '—';
		var rounded = (Math.abs(amount % 1) > 0.001)
			? Number(amount).toFixed(2).replace('.', ',')
			: Math.round(amount).toLocaleString('fr-FR').replace(/ /g, ' ');
		var sep = cur.spaced ? ' ' : '';
		return cur.position === 'prefix' ? (cur.symbol + sep + rounded) : (rounded + sep + cur.symbol);
	}

	// Convertit un montant exprimé en EUR vers la devise active en
	// s'appuyant sur les paliers d'arrondi définis dans config.js
	// (APP_CONFIG.conversion) — jamais une conversion au taux brut,
	// pour que les prix restent « ronds » dans chaque devise.
	function convert(amountEur, currencyCode) {
		var C = cfg();
		var code = currencyCode || currency();
		if (code === 'EUR') return amountEur;
		var table = (C.conversion && C.conversion[code]) || null;
		if (!table) return amountEur;
		if (Object.prototype.hasOwnProperty.call(table.exact || {}, String(amountEur))) {
			return table.exact[String(amountEur)];
		}
		var rate = table.rate || 1;
		var raw = amountEur * rate;
		// Arrondi « commercial » : au 5 le plus proche sous 1000, au 10 au-delà.
		if (Math.abs(raw % 1) > 0.001 && raw < 200) return Math.round(raw * 10) / 10;
		var step = raw >= 1000 ? 10 : 5;
		return Math.round(raw / step) * step;
	}

	function price(offerKey, currencyCode) {
		var C = cfg();
		var offer = C.offers && C.offers[offerKey];
		if (!offer) return null;
		var code = currencyCode || currency();
		return offer.price ? offer.price[code] : null;
	}

	function t(key) {
		var C = cfg();
		var dict = (C.i18n && C.i18n[locale()]) || {};
		var fallback = (C.i18n && C.i18n.fr) || {};
		return (key in dict) ? dict[key] : (fallback[key] !== undefined ? fallback[key] : key);
	}

	// ---------------------------------------------------------
	// Rendu de la page
	// ---------------------------------------------------------
	function render() {
		var C = cfg();
		var code = currency();
		var loc = locale();

		document.documentElement.setAttribute('lang', loc === 'en' ? 'en' : 'fr');

		// 1. Libellés traduits
		document.querySelectorAll('[data-i18n]').forEach(function (el) {
			var value = t(el.getAttribute('data-i18n'));
			if (typeof value === 'string') el.textContent = value;
		});

		// 2. Prix des offres du catalogue
		var promo = C.launchPromo || { active: false };
		var promoOn = !!(promo.active && promo.discountPercent > 0 && promo.totalPacks > 0);

		document.querySelectorAll('[data-offer-key]').forEach(function (el) {
			// Certaines cartes gèrent elles-mêmes leur affichage (cycle
			// mensuel/annuel piloté par l'utilisateur) : on les laisse tranquilles.
			if (el.hasAttribute('data-offer-skip')) return;

			var key = el.getAttribute('data-offer-key');
			var annual = false;
			if (key.length > 7 && key.slice(-7) === '-annual') {
				annual = true;
				key = key.slice(0, -7);
			}
			var offer = C.offers && C.offers[key];
			if (!offer) return;
			var amount = annual
				? (offer.annualPrice && offer.annualPrice[code])
				: (offer.price && offer.price[code]);
			if (amount === undefined || amount === null) return;

			var suffix = '';
			if (el.hasAttribute('data-price-suffix')) {
				suffix = ' ' + el.getAttribute('data-price-suffix');
			} else if (offer.type === 'recurring') {
				suffix = annual ? ' / ' + t('perYear') : ' ' + t('perMonth');
			}

			// Offre de lancement : prix barré + prix remisé.
			var discounted = amount;
			if (promoOn && !annual && (promo.appliesTo || []).indexOf(key) !== -1) {
				discounted = Math.round(amount * (1 - promo.discountPercent / 100) * 100) / 100;
			}

			var target = el.querySelector('.price-amount') || el;
			if (discounted !== amount) {
				target.innerHTML = '<span class="line-through opacity-50 text-[0.6em] mr-2">' +
					format(amount, code) + '</span>' + format(discounted, code) +
					(target === el ? suffix : '');
			} else {
				target.textContent = format(amount, code) + (target === el ? suffix : '');
			}

			var suffixEl = el.querySelector('.price-suffix');
			if (suffixEl && suffix) suffixEl.textContent = suffix.trim();
		});

		// 3. Montants libres exprimés en EUR dans le HTML
		document.querySelectorAll('[data-price-eur]').forEach(function (el) {
			var eur = parseFloat(el.getAttribute('data-price-eur'));
			if (isNaN(eur)) return;
			var prefix = el.getAttribute('data-price-prefix') || '';
			var suffix = el.getAttribute('data-price-suffix') || '';
			el.textContent = prefix + format(convert(eur, code), code) + suffix;
		});

		syncSelectors();
	}

	// ---------------------------------------------------------
	// Sélecteur déroulant
	// ---------------------------------------------------------
	function optionLabel(opt) {
		var C = cfg();
		var cur = C.currencies[opt.currency] || {};
		return {
			flag: opt.flag || '',
			code: opt.label,
			detail: (cur.symbol || opt.currency) + ' · ' + (cur.label || opt.currency)
		};
	}

	function activeKey() {
		var C = cfg();
		var sel = C.languageSelector || {};
		var code = currency();
		var loc = locale();
		var found = null;
		Object.keys(sel).forEach(function (k) {
			if (!found && sel[k].currency === code && sel[k].locale === loc) found = k;
		});
		return found || Object.keys(sel)[0];
	}

	function buildSelector(host) {
		var C = cfg();
		var sel = C.languageSelector || {};
		var keys = Object.keys(sel);
		if (!keys.length) return;

		host.dataset.langMounted = '1';

		var wrap = document.createElement('div');
		wrap.className = 'lang-select';

		var trigger = document.createElement('button');
		trigger.type = 'button';
		trigger.className = 'lang-select__trigger';
		trigger.setAttribute('aria-haspopup', 'listbox');
		trigger.setAttribute('aria-expanded', 'false');
		trigger.innerHTML = '<span class="flag" aria-hidden="true"></span><span class="code"></span>' +
			'<i class="ph-bold ph-caret-down caret" aria-hidden="true"></i>';

		var menu = document.createElement('div');
		menu.className = 'lang-select__menu';
		menu.setAttribute('role', 'listbox');

		keys.forEach(function (k) {
			var info = optionLabel(sel[k]);
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'lang-select__option';
			btn.setAttribute('role', 'option');
			btn.dataset.langKey = k;
			btn.innerHTML = '<span class="flag" aria-hidden="true">' + info.flag + '</span>' +
				'<span>' + info.code + '</span><span class="sub">' + info.detail + '</span>';
			btn.addEventListener('click', function () {
				setPair(sel[k].currency, sel[k].locale);
				close();
			});
			menu.appendChild(btn);
		});

		function open() {
			wrap.classList.add('is-open');
			trigger.setAttribute('aria-expanded', 'true');
			document.addEventListener('click', onOutside, true);
			document.addEventListener('keydown', onEsc);
		}
		function close() {
			wrap.classList.remove('is-open');
			trigger.setAttribute('aria-expanded', 'false');
			document.removeEventListener('click', onOutside, true);
			document.removeEventListener('keydown', onEsc);
		}
		function onOutside(e) { if (!wrap.contains(e.target)) close(); }
		function onEsc(e) { if (e.key === 'Escape') { close(); trigger.focus(); } }

		trigger.addEventListener('click', function (e) {
			e.stopPropagation();
			wrap.classList.contains('is-open') ? close() : open();
		});

		wrap.appendChild(trigger);
		wrap.appendChild(menu);
		host.appendChild(wrap);
	}

	function syncSelectors() {
		var C = cfg();
		var sel = C.languageSelector || {};
		var key = activeKey();
		var info = sel[key] ? optionLabel(sel[key]) : null;
		document.querySelectorAll('[data-lang-select]').forEach(function (host) {
			var trigger = host.querySelector('.lang-select__trigger');
			if (trigger && info) {
				trigger.querySelector('.flag').textContent = info.flag;
				trigger.querySelector('.code').textContent = info.code;
				trigger.setAttribute('aria-label', 'Langue et devise : ' + info.code + ' — ' + info.detail);
			}
			host.querySelectorAll('[data-lang-key]').forEach(function (opt) {
				opt.setAttribute('aria-selected', String(opt.dataset.langKey === key));
			});
		});
	}

	function mountAll() {
		document.querySelectorAll('[data-lang-select]').forEach(function (host) {
			if (host.dataset.langMounted !== '1') buildSelector(host);
		});
		render();
	}

	function onChange(fn) { if (typeof fn === 'function') listeners.push(fn); }

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', mountAll);
	} else {
		mountAll();
	}

	root.NM = root.NM || {};
	root.NM.i18n = {
		detect: detectPair,
		currency: currency,
		locale: locale,
		setPair: setPair,
		format: format,
		convert: convert,
		price: price,
		t: t,
		render: render,
		mountAll: mountAll,
		onChange: onChange
	};

})(window);
