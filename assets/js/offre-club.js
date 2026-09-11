/* ============================================================
   PAGE OFFRE CLUB & ASSOCIATIONS
   ------------------------------------------------------------
   Même logique que le formulaire de la page d'accueil, adaptée
   au vocabulaire des clubs et des associations :

     • situation (créer un site / le club en a déjà un) ;
     • modules club, cliquables depuis le catalogue ET depuis le
       formulaire — les deux restent toujours synchronisés ;
     • formule de suivi Sérénité / Sérénité+ en mensuel ou annuel,
       facultative mais conseillée ;
     • interventions ponctuelles pour un site existant.

   Tous les tarifs proviennent de config.js. Aucun paiement n'est
   proposé : la page s'arrête à la prise de rendez-vous.
   ============================================================ */
(function () {
	'use strict';

	var CFG = window.APP_CONFIG || {};

	// --- État du formulaire ------------------------------------
	var state = {
		requestType: 'newsite',      // 'newsite' | 'existing'
		options: [],                 // clés des modules club retenus
		serenityTier: null,          // null | 'simple' | 'plus'
		serenityCycle: 'monthly',    // 'monthly' | 'annual'
		intervention: null           // null | { key, label, priceEur }
	};

	// ------------------------------------------------------------
	// Aides
	// ------------------------------------------------------------
	function fmt(amountEur) {
		return (window.NM && NM.i18n)
			? NM.i18n.format(NM.i18n.convert(amountEur), NM.i18n.currency())
			: amountEur + ' €';
	}

	function esc(v) {
		return String(v == null ? '' : v)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	function optionByKey(key) {
		return (CFG.clubOptions || []).filter(function (o) { return o.key === key; })[0] || null;
	}

	function baseAmountEur() {
		if (state.requestType === 'existing') return 0;
		var base = (CFG.offers || {})[(CFG.club && CFG.club.baseOfferKey) || 'essentiel'];
		return base && base.price ? base.price.EUR : 990;
	}

	function optionsAmountEur() {
		return state.options.reduce(function (sum, key) {
			var o = optionByKey(key);
			return sum + (o ? o.priceEur : 0);
		}, 0);
	}

	// ------------------------------------------------------------
	// 1. Interventions ponctuelles (grille de la section tarifs)
	// ------------------------------------------------------------
	function renderInterventionsList() {
		var host = document.getElementById('club-interventions-list');
		if (!host) return;
		host.innerHTML = (CFG.interventions || []).map(function (it, i, arr) {
			var last = i === arr.length - 1;
			return '<div class="flex justify-between items-center gap-3 ' +
					(last ? 'pt-1' : 'border-b border-slate-500/10 pb-2') + '">' +
					'<span class="min-w-0">' +
						'<span class="text-sm text-slate-300 ' + (last ? 'font-bold' : '') + ' block">' + esc(it.label) + '</span>' +
						(last ? '<span class="text-[10px] text-slate-500">' + esc(it.desc) + '</span>' : '') +
					'</span>' +
					'<span class="font-bold whitespace-nowrap ' + (last ? 'text-accent-400' : 'text-white') + '" ' +
						'data-price-eur="' + it.priceEur + '"' + (it.from ? ' data-price-prefix="dès "' : '') + '>' +
						(it.from ? 'dès ' : '') + it.priceEur + ' €</span>' +
				'</div>';
		}).join('');
	}

	// ------------------------------------------------------------
	// 2. Catalogue des modules (cliquable, synchronisé)
	// ------------------------------------------------------------
	function renderCatalogue() {
		var grid = document.getElementById('club-options-grid');
		if (!grid) return;

		grid.innerHTML = (CFG.clubOptions || []).map(function (opt) {
			var thumbs = '';
			if (opt.previews && opt.previews.length) {
				thumbs = '<div class="flex gap-2 mt-3 flex-wrap">' + opt.previews.map(function (p, i) {
					return '<button type="button" class="club-thumb" data-preview="' + esc(opt.key) + '" data-index="' + i + '" ' +
						'title="Agrandir : ' + esc(p.caption) + '" aria-label="Agrandir l’aperçu : ' + esc(p.caption) + '">' +
						'<img src="' + esc(p.src) + '" alt="' + esc(p.alt) + '" loading="lazy" decoding="async">' +
						'</button>';
				}).join('') +
				'<span class="text-[10px] text-slate-500 self-center ml-1">Cliquez pour agrandir</span></div>';
			}

			return '<article class="club-card interactive-hover p-4 rounded-xl bg-dark-950/50 border ' +
					(opt.highlight ? 'border-accent-400/30' : 'border-slate-500/15') + '" data-card="' + esc(opt.key) + '">' +
					'<div class="flex items-baseline justify-between gap-3 mb-2">' +
						'<h4 class="font-bold text-white text-sm flex items-center gap-2">' +
							'<i class="ph-duotone ' + esc(opt.icon) + ' text-accent-400 text-lg" aria-hidden="true"></i>' + esc(opt.label) +
						'</h4>' +
						'<span class="text-sm font-bold text-accent-400 whitespace-nowrap" data-price-eur="' + opt.priceEur + '" data-price-prefix="+ ">+ ' + opt.priceEur + ' €</span>' +
					'</div>' +
					'<p class="text-xs text-slate-400 leading-relaxed">' + esc(opt.desc) + '</p>' +
					(opt.note ? '<p class="text-[10px] text-accent-400 mt-2 font-bold">' + esc(opt.note) + '</p>' : '') +
					thumbs +
					'<button type="button" class="club-card__toggle btn-ghost w-full mt-3 !text-[11px] !py-2" data-toggle="' + esc(opt.key) + '">' +
						'<i class="ph-bold ph-plus" aria-hidden="true"></i> <span>Ajouter à ma demande</span>' +
					'</button>' +
				'</article>';
		}).join('');

		grid.querySelectorAll('[data-toggle]').forEach(function (btn) {
			btn.addEventListener('click', function () { toggleOption(btn.dataset.toggle, true); });
		});
		grid.querySelectorAll('[data-preview]').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.stopPropagation();
				openLightbox(btn.dataset.preview, Number(btn.dataset.index));
			});
		});
	}

	// ------------------------------------------------------------
	// 3. Aperçu agrandi des captures (lightbox)
	// ------------------------------------------------------------
	var lightbox = null;

	function buildLightbox() {
		if (lightbox) return lightbox;
		lightbox = document.createElement('div');
		lightbox.id = 'club-lightbox';
		lightbox.setAttribute('role', 'dialog');
		lightbox.setAttribute('aria-modal', 'true');
		lightbox.innerHTML =
			'<button type="button" class="club-lightbox__close" aria-label="Fermer l’aperçu"><i class="ph-bold ph-x" aria-hidden="true"></i></button>' +
			'<button type="button" class="club-lightbox__nav club-lightbox__nav--prev" aria-label="Aperçu précédent"><i class="ph-bold ph-caret-left" aria-hidden="true"></i></button>' +
			'<figure class="club-lightbox__figure">' +
				'<img alt="">' +
				'<figcaption></figcaption>' +
			'</figure>' +
			'<button type="button" class="club-lightbox__nav club-lightbox__nav--next" aria-label="Aperçu suivant"><i class="ph-bold ph-caret-right" aria-hidden="true"></i></button>';
		document.body.appendChild(lightbox);

		lightbox.addEventListener('click', function (e) {
			if (e.target === lightbox || e.target.closest('.club-lightbox__close')) closeLightbox();
		});
		lightbox.querySelector('.club-lightbox__nav--prev').addEventListener('click', function () { step(-1); });
		lightbox.querySelector('.club-lightbox__nav--next').addEventListener('click', function () { step(1); });
		document.addEventListener('keydown', function (e) {
			if (!lightbox.classList.contains('is-open')) return;
			if (e.key === 'Escape') closeLightbox();
			if (e.key === 'ArrowLeft') step(-1);
			if (e.key === 'ArrowRight') step(1);
		});
		return lightbox;
	}

	var current = { key: null, index: 0 };

	function openLightbox(optionKey, index) {
		var opt = optionByKey(optionKey);
		if (!opt || !opt.previews || !opt.previews.length) return;
		buildLightbox();
		current.key = optionKey;
		current.index = index || 0;
		paintLightbox();
		lightbox.classList.add('is-open');
		document.body.style.overflow = 'hidden';
	}

	function paintLightbox() {
		var opt = optionByKey(current.key);
		var p = opt.previews[current.index];
		var img = lightbox.querySelector('img');
		img.src = p.src;
		img.alt = p.alt;
		lightbox.querySelector('figcaption').textContent =
			p.caption + '  ·  ' + (current.index + 1) + '/' + opt.previews.length;
	}

	function step(delta) {
		var opt = optionByKey(current.key);
		if (!opt) return;
		current.index = (current.index + delta + opt.previews.length) % opt.previews.length;
		paintLightbox();
	}

	function closeLightbox() {
		if (!lightbox) return;
		lightbox.classList.remove('is-open');
		document.body.style.overflow = '';
	}

	// ------------------------------------------------------------
	// 4. Modules dans le formulaire
	// ------------------------------------------------------------
	function renderFormOptions() {
		var grid = document.getElementById('club-form-options');
		if (!grid) return;

		grid.innerHTML = (CFG.clubOptions || []).map(function (opt) {
			return '<button type="button" class="club-option flex items-center justify-between gap-2 p-3 rounded-xl bg-dark-950 text-left w-full" data-option="' + esc(opt.key) + '" aria-pressed="false">' +
					'<span class="flex items-center gap-2.5 min-w-0">' +
						'<span class="club-option__box w-4 h-4 rounded border border-slate-600 flex items-center justify-center shrink-0">' +
							'<i class="ph-bold ph-check text-dark-950 text-[10px] opacity-0 scale-50 transition-all" aria-hidden="true"></i>' +
						'</span>' +
						'<span class="text-xs text-slate-300 font-medium truncate">' + esc(opt.label) + '</span>' +
					'</span>' +
					'<span class="text-[10px] font-bold text-slate-500 whitespace-nowrap" data-price-eur="' + opt.priceEur + '" data-price-prefix="+ ">+ ' + opt.priceEur + ' €</span>' +
				'</button>';
		}).join('');

		grid.querySelectorAll('[data-option]').forEach(function (btn) {
			btn.addEventListener('click', function () { toggleOption(btn.dataset.option, false); });
		});
	}

	/** Ajoute ou retire un module, puis synchronise catalogue + formulaire. */
	function toggleOption(key, scrollToForm) {
		var i = state.options.indexOf(key);
		if (i === -1) { state.options.push(key); } else { state.options.splice(i, 1); }
		syncOptions();
		updateTotal();

		if (scrollToForm && i === -1) {
			var block = document.getElementById('club-modules-block');
			if (block) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	/** Reflète l'état des modules aux deux endroits de la page. */
	function syncOptions() {
		document.querySelectorAll('[data-option]').forEach(function (btn) {
			var on = state.options.indexOf(btn.dataset.option) !== -1;
			btn.classList.toggle('selected', on);
			btn.setAttribute('aria-pressed', String(on));
		});
		document.querySelectorAll('[data-card]').forEach(function (card) {
			var on = state.options.indexOf(card.dataset.card) !== -1;
			card.classList.toggle('is-selected', on);
			var btn = card.querySelector('[data-toggle]');
			if (btn) {
				btn.innerHTML = on
					? '<i class="ph-bold ph-check-circle" aria-hidden="true"></i> <span>Ajouté à ma demande</span>'
					: '<i class="ph-bold ph-plus" aria-hidden="true"></i> <span>Ajouter à ma demande</span>';
				btn.classList.toggle('is-on', on);
			}
		});
		var count = document.getElementById('club-modules-count');
		if (count) {
			count.textContent = state.options.length
				? state.options.length + (state.options.length > 1 ? ' modules retenus' : ' module retenu')
				: '';
		}
	}

	// ------------------------------------------------------------
	// 5. Situation : créer un site / site existant
	// ------------------------------------------------------------
	function setRequestType(type) {
		state.requestType = type;

		document.querySelectorAll('[data-club-request]').forEach(function (btn) {
			var on = btn.dataset.clubRequest === type;
			btn.classList.toggle('active-request-type', on);
			btn.querySelectorAll('span')[0].classList.toggle('text-white', on);
			btn.querySelectorAll('span')[0].classList.toggle('text-slate-300', !on);
		});

		var interventionBlock = document.getElementById('club-intervention-block');
		var modulesBlock = document.getElementById('club-modules-block');
		if (interventionBlock) interventionBlock.classList.toggle('hidden', type !== 'existing');
		if (modulesBlock) modulesBlock.classList.toggle('hidden', type === 'existing');

		if (type === 'newsite') {
			state.intervention = null;
			syncInterventions();
		} else {
			state.options = [];
			syncOptions();
		}

		var label = document.getElementById('club-total-label');
		if (label) {
			label.innerHTML = type === 'existing'
				? 'Estimation <span class="text-[10px] font-normal lowercase text-slate-500">(intervention / suivi)</span>'
				: 'Estimation <span class="text-[10px] font-normal lowercase text-slate-500">(création)</span>';
		}
		updateTotal();
	}

	function renderInterventionButtons() {
		var grid = document.getElementById('club-intervention-grid');
		if (!grid) return;
		grid.innerHTML = (CFG.interventions || []).map(function (it) {
			return '<button type="button" class="intervention-btn flex flex-col items-center justify-center py-3 px-2 rounded-xl text-center border border-slate-500/20 bg-dark-950" data-intervention="' + esc(it.key) + '">' +
					'<span class="text-xs text-slate-300 font-bold">' + esc(it.label) + '</span>' +
					'<span class="text-[9px] text-slate-500">' + esc(it.desc) + '</span>' +
					'<span class="text-xs text-accent-400 font-bold mt-1" data-price-eur="' + it.priceEur + '"' +
						(it.from ? ' data-price-prefix="dès "' : '') + '>' + (it.from ? 'dès ' : '') + it.priceEur + ' €</span>' +
				'</button>';
		}).join('');

		grid.querySelectorAll('[data-intervention]').forEach(function (btn) {
			btn.addEventListener('click', function () {
				var key = btn.dataset.intervention;
				var it = (CFG.interventions || []).filter(function (o) { return o.key === key; })[0];
				state.intervention = (state.intervention && state.intervention.key === key) ? null : it;
				syncInterventions();
				updateTotal();
			});
		});
	}

	function syncInterventions() {
		document.querySelectorAll('[data-intervention]').forEach(function (btn) {
			var on = !!state.intervention && state.intervention.key === btn.dataset.intervention;
			btn.classList.toggle('active-intervention', on);
		});
	}

	// ------------------------------------------------------------
	// 6. Formule de suivi
	// ------------------------------------------------------------
	function setSerenity(tier) {
		state.serenityTier = (state.serenityTier === tier) ? null : tier;
		syncSerenity();
		updateTotal();
	}

	function setCycle(cycle) {
		state.serenityCycle = cycle;
		if (window.NM) NM.serenityCycle = cycle;
		document.querySelectorAll('.billing-cycle-pill').forEach(function (pill) {
			pill.classList.toggle('active', pill.dataset.cycle === cycle);
		});
		['serenite', 'serenitePlus'].forEach(function (key) {
			var badge = document.getElementById(key + '-annual-badge');
			if (badge) badge.classList.toggle('hidden', cycle !== 'annual');
		});
		renderSerenityPrices();
		updateTotal();
	}

	function serenityAmountEur(tier, cycle) {
		var offer = (CFG.offers || {})[tier === 'plus' ? 'serenitePlus' : 'serenite'];
		if (!offer) return 0;
		return cycle === 'annual' ? offer.annualPrice.EUR : offer.price.EUR;
	}

	function renderSerenityPrices() {
		var annual = state.serenityCycle === 'annual';
		var suffix = annual ? ' / an' : ' / mois';

		[['serenite', 'club-serenite-price'], ['serenitePlus', 'club-serenite-plus-price']].forEach(function (pair) {
			var offer = (CFG.offers || {})[pair[0]];
			if (!offer) return;
			var amount = annual ? offer.annualPrice.EUR : offer.price.EUR;

			// Carte du catalogue (devise active)
			var card = document.querySelector('[data-offer-key="' + pair[0] + '"][data-offer-skip]');
			if (card) {
				var amountEl = card.querySelector('.price-amount');
				var suffixEl = card.querySelector('.price-suffix');
				if (amountEl) amountEl.textContent = fmt(amount);
				if (suffixEl) suffixEl.textContent = suffix;
			}
			// Bouton du formulaire (toujours en euros : le devis l'est aussi)
			var btn = document.getElementById(pair[1]);
			if (btn) {
				btn.textContent = new Intl.NumberFormat('fr-FR', {
					style: 'currency', currency: 'EUR',
					minimumFractionDigits: (Math.abs(amount % 1) > 0.001) ? 2 : 0,
					maximumFractionDigits: (Math.abs(amount % 1) > 0.001) ? 2 : 0
				}).format(amount) + suffix;
			}
		});
	}

	function syncSerenity() {
		document.querySelectorAll('[data-club-serenity]').forEach(function (btn) {
			var tier = btn.dataset.clubSerenity;
			var on = state.serenityTier === tier;
			if (btn.classList.contains('serenity-btn')) {
				btn.classList.toggle('active', on && tier === 'simple');
				btn.classList.toggle('active-plus', on && tier === 'plus');
			} else {
				btn.innerHTML = on
					? '<i class="ph-bold ph-check-circle" aria-hidden="true"></i> <span>Ajouté au devis</span>'
					: '<span>Ajouter au devis</span> <i class="ph-bold ph-plus" aria-hidden="true"></i>';
				btn.classList.toggle('is-on', on);
			}
		});
		['card-serenite', 'card-serenite-plus'].forEach(function (id, i) {
			var card = document.getElementById(id);
			if (card) card.classList.toggle('serenity-selected-card', state.serenityTier === (i === 0 ? 'simple' : 'plus'));
		});
	}

	// ------------------------------------------------------------
	// 7. Total estimé
	// ------------------------------------------------------------
	function updateTotal() {
		var oneShot = baseAmountEur() + optionsAmountEur() +
			(state.intervention ? state.intervention.priceEur : 0);

		var el = document.getElementById('club-total');
		if (el) el.textContent = oneShot > 0 ? fmt(oneShot) : '—';

		var chip = document.getElementById('club-recurring-chip');
		var chipText = document.getElementById('club-recurring-text');
		if (chip && chipText) {
			if (state.serenityTier) {
				var offer = (CFG.offers || {})[state.serenityTier === 'plus' ? 'serenitePlus' : 'serenite'];
				var amount = serenityAmountEur(state.serenityTier, state.serenityCycle);
				chipText.textContent = fmt(amount) +
					(state.serenityCycle === 'annual' ? ' / an · ' : ' / mois · ') + offer.name;
				chip.classList.remove('hidden');
				chip.classList.add('inline-flex');
			} else {
				chip.classList.add('hidden');
				chip.classList.remove('inline-flex');
			}
		}
	}

	// ------------------------------------------------------------
	// 8. Envoi du formulaire
	// ------------------------------------------------------------
	function showError(message) {
		var banner = document.getElementById('club-error');
		var text = document.getElementById('club-error-text');
		if (!banner || !text) { console.error(message); return; }
		text.textContent = message;
		banner.classList.remove('hidden');
		banner.classList.add('flex');
		banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	function hideError() {
		var banner = document.getElementById('club-error');
		if (banner) { banner.classList.add('hidden'); banner.classList.remove('flex'); }
	}

	function val(id) {
		var el = document.getElementById(id);
		return el ? el.value.trim() : '';
	}

	function setupForm() {
		var form = document.getElementById('club-form');
		if (!form) return;

		var dateInput = document.getElementById('club-date');
		var timeInput = document.getElementById('club-time');

		if (window.NM && NM.calendar) {
			NM.calendar.mount({
				daysEl: document.getElementById('club-calendar-days'),
				slotsEl: document.getElementById('club-calendar-slots'),
				dateInput: dateInput,
				timeInput: timeInput,
				prevBtn: document.getElementById('club-prev-week'),
				nextBtn: document.getElementById('club-next-week')
			});
		}

		form.addEventListener('submit', async function (e) {
			e.preventDefault();
			hideError();

			if (!dateInput.value || !timeInput.value) {
				showError('Choisissez d’abord un jour et un créneau ci-dessus.');
				return;
			}
			if (state.requestType === 'existing' && !state.serenityTier && !state.intervention) {
				showError('Pour un site existant, indiquez une intervention ponctuelle et/ou une formule de suivi.');
				return;
			}

			var submitBtn = document.getElementById('club-submit');
			var original = submitBtn.innerHTML;
			submitBtn.disabled = true;
			submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-xl"></i> Envoi…';

			var firstName = val('club-firstname');
			var lastName = val('club-lastname');
			var email = val('club-email');
			var phone = val('club-phone');
			var clubName = val('club-name');
			var sport = val('club-sport');
			var city = val('club-city');
			var role = val('club-role');
			var members = val('club-members');
			var message = val('club-message');

			var dateObj = new Date(dateInput.value + 'T00:00:00');
			var dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

			var optionLabels = state.options.map(function (key) {
				var o = optionByKey(key);
				return o ? o.label : key;
			});

			var estimated = baseAmountEur() + optionsAmountEur() +
				(state.intervention ? state.intervention.priceEur : 0);

			var payload = {
				source: 'offre-club',
				request_type: state.requestType,
				first_name: firstName,
				last_name: lastName,
				email: email,
				phone: phone,
				organisation: clubName,
				rdv_date: dateInput.value,
				rdv_time: timeInput.value,
				rdv_label: dateStr + ' à ' + timeInput.value,
				pack: state.requestType === 'existing' ? 'existing' : ((CFG.club && CFG.club.baseOfferKey) || 'essentiel'),
				pack_label: state.requestType === 'existing'
					? 'Site existant (suivi seul)'
					: ((CFG.club && CFG.club.name) || 'Offre Club & Associations'),
				pack_price: state.requestType === 'existing' ? null : baseAmountEur(),
				currency: 'EUR',
				serenity_tier: state.serenityTier,
				serenity_cycle: state.serenityTier ? state.serenityCycle : null,
				club_options: optionLabels,
				intervention_type: state.intervention ? state.intervention.key : null,
				intervention_price: state.intervention ? state.intervention.priceEur : null,
				estimated_total: estimated,
				message: [
					sport ? 'Discipline : ' + sport : '',
					city ? 'Ville : ' + city : '',
					members ? 'Adhérents : ' + members : '',
					role ? 'Rôle du contact : ' + role : '',
					message
				].filter(Boolean).join('\n'),
				status: 'nouveau'
			};

			var leadId = null;
			try {
				var db = await window.NM.dbReady;
				leadId = await db.saveLead(payload);
			} catch (err) {
				console.error('Enregistrement de la demande impossible (non bloquant) :', err);
			}

			// Le brief projet (/kickoff/) est pré-rempli avec TOUT ce qui
			// vient d'être saisi : rien à ressaisir pour le club.
			try {
				localStorage.setItem('kickoffData', JSON.stringify({
					source: 'offre-club',
					requestType: state.requestType,
					pack: state.requestType === 'existing' ? 'Site existant' : 'Essentiel',
					packLabel: payload.pack_label,
					packPrice: payload.pack_price,
					name: firstName + ' ' + lastName,
					firstName: firstName,
					lastName: lastName,
					email: email,
					phone: phone,
					company: clubName,
					role: role,
					sport: sport,
					city: city,
					members: members,
					date: dateStr + ' à ' + timeInput.value,
					rdvDate: dateInput.value,
					rdvTime: timeInput.value,
					documents: '',
					clubOptions: optionLabels.join(','),
					intervention: state.intervention ? state.intervention.key : null,
					interventionLabel: state.intervention ? state.intervention.label : null,
					serenite: state.serenityTier,
					sereniteCycle: state.serenityTier ? state.serenityCycle : null,
					estimatedTotal: estimated,
					message: message,
					leadId: leadId
				}));
			} catch (err) { /* localStorage indisponible */ }

			var success = document.getElementById('club-success');
			var successDate = document.getElementById('club-success-date');
			if (successDate) successDate.textContent = 'Le ' + dateStr + ' à ' + timeInput.value;
			if (success) {
				success.classList.remove('hidden');
				success.classList.add('flex');
				success.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}

			submitBtn.disabled = false;
			submitBtn.innerHTML = original;
		});
	}

	// ------------------------------------------------------------
	// Initialisation
	// ------------------------------------------------------------
	function init() {
		var yearEl = document.getElementById('year');
		if (yearEl) yearEl.textContent = new Date().getFullYear();

		renderInterventionsList();
		renderCatalogue();
		renderFormOptions();
		renderInterventionButtons();

		document.querySelectorAll('[data-club-request]').forEach(function (btn) {
			btn.addEventListener('click', function () { setRequestType(btn.dataset.clubRequest); });
		});
		document.querySelectorAll('[data-club-serenity]').forEach(function (btn) {
			btn.addEventListener('click', function () { setSerenity(btn.dataset.clubSerenity); });
		});
		document.querySelectorAll('.billing-cycle-pill').forEach(function (pill) {
			pill.addEventListener('click', function () { setCycle(pill.dataset.cycle); });
		});

		if (window.NM && NM.i18n) {
			NM.i18n.render();
			NM.i18n.onChange(function () {
				renderSerenityPrices();
				updateTotal();
			});
		}

		setRequestType('newsite');
		setCycle('monthly');
		syncOptions();
		syncSerenity();
		updateTotal();
		setupForm();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
