/* ============================================================
   CALENDRIER DE PRISE DE RENDEZ-VOUS — module partagé
   ------------------------------------------------------------
   Utilisé par la page d'accueil ET par la page Offre Club, afin
   qu'il n'existe qu'une seule logique de disponibilités sur tout
   le site (mêmes jours ouverts, mêmes créneaux, même vérification
   des créneaux déjà réservés).

   Les créneaux déjà pris sont lus dans Supabase (table nm_leads).
   En cas d'indisponibilité du réseau, tous les créneaux restent
   proposés : mieux vaut un doublon qu'un visiteur bloqué.

   Utilisation :
     NM.calendar.mount({
       daysEl:   document.getElementById('calendar-days'),
       slotsEl:  document.getElementById('calendar-slots'),
       dateInput: document.getElementById('selected-date'),
       timeInput: document.getElementById('selected-time'),
       prevBtn:  document.getElementById('prev-week'),
       nextBtn:  document.getElementById('next-week')
     });
   ============================================================ */
(function (root) {
	'use strict';

	// Créneaux proposés (matinée). Un même créneau n'est proposé
	// qu'une fois par jour : la réservation d'un créneau le retire.
	var DEFAULT_SLOTS = ['09:00', '09:30', '10:00', '10:30'];
	// Jours fermés : dimanche (0), mercredi (3) et samedi (6).
	var CLOSED_DAYS = [0, 3, 6];
	var DAYS_TO_SHOW = 12;
	var MAX_LOOKAHEAD = 60;

	function vibrate() { if (root.vibrate) root.vibrate(); }

	function toISODate(d) {
		// Date locale au format AAAA-MM-JJ (pas d'UTC : évite le
		// décalage d'un jour pour les fuseaux à l'est de Greenwich).
		var m = String(d.getMonth() + 1).padStart(2, '0');
		var day = String(d.getDate()).padStart(2, '0');
		return d.getFullYear() + '-' + m + '-' + day;
	}

	function mount(opts) {
		var daysEl = opts.daysEl;
		var slotsEl = opts.slotsEl;
		var dateInput = opts.dateInput;
		var timeInput = opts.timeInput;
		if (!daysEl || !slotsEl || !dateInput || !timeInput) return null;

		var offset = 0;

		function render() {
			daysEl.innerHTML = '';
			if (opts.prevBtn) opts.prevBtn.disabled = offset === 0;

			var generated = 0;
			var i = 1 + offset;

			while (generated < DAYS_TO_SHOW && i <= MAX_LOOKAHEAD) {
				var d = new Date();
				d.setDate(d.getDate() + i);

				if (CLOSED_DAYS.indexOf(d.getDay()) === -1) {
					daysEl.appendChild(buildDayButton(d));
					generated++;
				}
				i++;
			}

			if (!generated) {
				daysEl.innerHTML = '<p class="col-span-full text-xs text-slate-500 italic">Aucun créneau sur cette période. Revenez en arrière ou écrivez-moi directement.</p>';
			}
		}

		function buildDayButton(d) {
			var dateStr = toISODate(d);
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'date-btn flex-shrink-0 h-20 rounded-xl border border-slate-500/20 bg-slate-500/5 hover:bg-slate-500/10 flex flex-col items-center justify-center transition-all duration-300 group focus:outline-none w-full';
			btn.setAttribute('aria-label', d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));

			btn.innerHTML =
				'<span class="text-xs text-slate-400 uppercase font-bold group-hover:text-accent-400">' +
					d.toLocaleDateString('fr-FR', { weekday: 'short' }) + '</span>' +
				'<span class="text-xl font-bold text-white my-1">' +
					d.toLocaleDateString('fr-FR', { day: 'numeric' }) + '</span>' +
				'<span class="text-[10px] text-slate-500">' +
					d.toLocaleDateString('fr-FR', { month: 'short' }) + '</span>';

			if (dateInput.value === dateStr) paintSelected(btn, true);
			btn.addEventListener('click', function () { selectDate(btn, dateStr); });
			return btn;
		}

		function paintSelected(btn, selected) {
			var spans = btn.querySelectorAll('span');
			btn.classList.toggle('active-date', selected);
			if (selected) {
				spans[0].className = 'text-xs uppercase font-bold text-dark-950';
				spans[1].className = 'text-xl font-bold my-1 text-dark-950';
				spans[2].className = 'text-[10px] text-dark-950';
			} else {
				spans[0].className = 'text-xs text-slate-400 uppercase font-bold group-hover:text-accent-400';
				spans[1].className = 'text-xl font-bold text-white my-1';
				spans[2].className = 'text-[10px] text-slate-500';
			}
		}

		function selectDate(btn, dateStr) {
			vibrate();
			daysEl.querySelectorAll('.date-btn').forEach(function (b) { paintSelected(b, false); });
			paintSelected(btn, true);
			dateInput.value = dateStr;
			timeInput.value = '';
			loadSlots(dateStr);
		}

		async function fetchTakenSlots(dateStr) {
			try {
				var db = await root.NM.dbReady;
				// Fonction dédiée côté base : elle ne renvoie que des heures,
				// jamais les coordonnées des personnes ayant réservé (la table
				// nm_leads elle-même reste illisible depuis le site public).
				var res = await db.client.rpc('nm_taken_slots', { p_date: dateStr });
				if (res.error) throw res.error;
				return (res.data || []).map(function (r) {
					return typeof r === 'string' ? r : r.rdv_time;
				}).filter(Boolean);
			} catch (e) {
				// Réseau indisponible : on préfère proposer tous les créneaux
				// plutôt que de bloquer la prise de rendez-vous.
				console.warn('Créneaux déjà réservés non vérifiables :', e && e.message);
				return [];
			}
		}

		async function loadSlots(dateStr) {
			slotsEl.innerHTML = '<div class="col-span-full text-center text-accent-400 py-2"><i class="ph-duotone ph-spinner animate-spin text-2xl" aria-hidden="true"></i><span class="sr-only">Chargement des créneaux…</span></div>';

			var taken = await fetchTakenSlots(dateStr);
			var free = DEFAULT_SLOTS.filter(function (t) { return taken.indexOf(t) === -1; });

			slotsEl.innerHTML = '';
			if (!free.length) {
				slotsEl.innerHTML = '<div class="col-span-full text-center text-slate-500 text-xs py-2">Complet ce jour — choisissez une autre date.</div>';
				return;
			}

			DEFAULT_SLOTS.forEach(function (time) {
				var isTaken = taken.indexOf(time) !== -1;
				var btn = document.createElement('button');
				btn.type = 'button';
				btn.disabled = isTaken;
				btn.textContent = time;
				btn.className = isTaken
					? 'py-2 rounded-lg text-sm font-medium border border-transparent bg-dark-900 text-slate-600 cursor-not-allowed line-through'
					: 'time-btn py-2 rounded-lg text-sm font-medium border border-slate-500/20 bg-slate-500/5 text-white hover:border-accent-400 hover:text-accent-400 transition-all duration-200';

				if (!isTaken) {
					btn.addEventListener('click', function () {
						vibrate();
						slotsEl.querySelectorAll('.time-btn').forEach(function (b) {
							b.classList.remove('bg-accent-400', 'text-dark-950');
							b.classList.add('bg-slate-500/5', 'text-white');
						});
						btn.classList.remove('bg-slate-500/5', 'text-white');
						btn.classList.add('bg-accent-400', 'text-dark-950');
						timeInput.value = time;
						if (typeof opts.onSelect === 'function') opts.onSelect(dateInput.value, time);
					});
				}
				slotsEl.appendChild(btn);
			});
		}

		if (opts.nextBtn) {
			opts.nextBtn.addEventListener('click', function () {
				vibrate();
				offset += DAYS_TO_SHOW;
				render();
			});
		}
		if (opts.prevBtn) {
			opts.prevBtn.addEventListener('click', function () {
				if (offset === 0) return;
				vibrate();
				offset = Math.max(0, offset - DAYS_TO_SHOW);
				render();
			});
		}

		render();
		return { render: render, slots: DEFAULT_SLOTS };
	}

	root.NM = root.NM || {};
	root.NM.calendar = { mount: mount, SLOTS: DEFAULT_SLOTS, CLOSED_DAYS: CLOSED_DAYS };

})(window);
