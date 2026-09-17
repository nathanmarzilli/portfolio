/* ============================================================
   AIDE À DOMICILE — estimation du temps de trajet
   ------------------------------------------------------------
   Le visiteur tape son adresse (ou sa ville) ; on calcule le
   trajet routier depuis le domicile de Nathan.

   Services utilisés — GRATUITS, SANS CLÉ, appelés depuis le
   navigateur (aucune donnée stockée) :
     1. Géoplateforme IGN — autocomplétion + géocodage (France)
        https://data.geopf.fr/geocodage/…
     2. Géoplateforme IGN — itinéraire voiture (France)
        https://data.geopf.fr/navigation/itineraire
   Replis successifs si l'un d'eux ne répond pas (ou adresse
   suisse, hors couverture IGN) :
     3. Nominatim (OpenStreetMap) pour le géocodage
     4. OSRM (démo publique OpenStreetMap) pour l'itinéraire
     5. Estimation « à vol d'oiseau » × 1,35 à 55 km/h, signalée
        comme approximative.
   ⚠️ Ne PAS utiliser l'API Google (payante, voir DOCUMENTATION).
   ============================================================ */
(function () {
	'use strict';

	// Point de départ : domicile de Nathan (Champanges, 74500).
	// Volontairement jamais affiché en clair sur la page.
	var ORIGIN = { lon: 6.556051, lat: 46.371707 };

	var form = document.getElementById('travel-form');
	if (!form) return;
	var input = document.getElementById('travel-address');
	var list = document.getElementById('travel-suggestions');
	var submitBtn = document.getElementById('travel-submit');
	var els = {
		idle: document.getElementById('travel-idle'),
		loading: document.getElementById('travel-loading'),
		output: document.getElementById('travel-output'),
		error: document.getElementById('travel-error'),
		errorText: document.getElementById('travel-error-text'),
		duration: document.getElementById('travel-duration'),
		distance: document.getElementById('travel-distance'),
		destination: document.getElementById('travel-destination'),
		bar: document.getElementById('travel-bar'),
		zone: document.getElementById('travel-zone')
	};

	var selected = null;      // { lon, lat, label } choisi dans la liste
	var suggestTimer = null;
	var suggestAbort = null;
	var activeIndex = -1;
	var lastSuggestions = [];

	function show(state) {
		['idle', 'loading', 'output', 'error'].forEach(function (k) {
			els[k].classList.toggle('hidden', k !== state);
		});
	}

	function fetchJson(url, ms) {
		var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
		var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 8000);
		return fetch(url, ctrl ? { signal: ctrl.signal } : {})
			.then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
			.finally(function () { clearTimeout(timer); });
	}

	function esc(v) {
		return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	// ---------- Autocomplétion ----------
	function suggest(text) {
		if (suggestAbort) suggestAbort.abort();
		suggestAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
		var url = 'https://data.geopf.fr/geocodage/completion?maximumResponses=5&text=' + encodeURIComponent(text);
		fetch(url, suggestAbort ? { signal: suggestAbort.signal } : {})
			.then(function (r) { return r.ok ? r.json() : { results: [] }; })
			.then(function (data) {
				lastSuggestions = (data.results || []).filter(function (r) { return r.x && r.y; }).map(function (r) {
					return { lon: r.x, lat: r.y, label: r.fulltext };
				});
				renderSuggestions();
			})
			.catch(function () { /* silencieux : la saisie libre reste possible */ });
	}

	function renderSuggestions() {
		activeIndex = -1;
		if (!lastSuggestions.length) { list.classList.add('hidden'); list.innerHTML = ''; return; }
		list.innerHTML = lastSuggestions.map(function (s, i) {
			return '<li role="option" data-i="' + i + '" class="px-4 py-2.5 text-sm text-slate-300 hover:bg-accent-400/10 hover:text-white cursor-pointer flex items-center gap-2 border-b border-slate-500/10 last:border-0">' +
				'<i class="ph-bold ph-map-pin text-accent-400" aria-hidden="true"></i><span class="truncate">' + esc(s.label) + '</span></li>';
		}).join('');
		list.classList.remove('hidden');
	}

	function pick(i) {
		var s = lastSuggestions[i];
		if (!s) return;
		selected = s;
		input.value = s.label;
		list.classList.add('hidden');
		estimate();
	}

	input.addEventListener('input', function () {
		selected = null;
		var text = input.value.trim();
		clearTimeout(suggestTimer);
		if (text.length < 3) { list.classList.add('hidden'); return; }
		suggestTimer = setTimeout(function () { suggest(text); }, 250);
	});
	input.addEventListener('keydown', function (e) {
		var items = list.querySelectorAll('li');
		if (list.classList.contains('hidden') || !items.length) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
			items.forEach(function (li, i) { li.classList.toggle('bg-accent-400/10', i === activeIndex); });
		} else if (e.key === 'Enter' && activeIndex >= 0) {
			e.preventDefault();
			pick(activeIndex);
		} else if (e.key === 'Escape') {
			list.classList.add('hidden');
		}
	});
	list.addEventListener('mousedown', function (e) {
		var li = e.target.closest('li[data-i]');
		if (li) { e.preventDefault(); pick(parseInt(li.getAttribute('data-i'), 10)); }
	});
	input.addEventListener('blur', function () { setTimeout(function () { list.classList.add('hidden'); }, 150); });

	// ---------- Géocodage ----------
	function geocode(text) {
		var ign = 'https://data.geopf.fr/geocodage/search?limit=1&q=' + encodeURIComponent(text);
		return fetchJson(ign).then(function (data) {
			var f = data && data.features && data.features[0];
			// Score faible = probablement hors de France (ex. Lausanne) : on tente OSM.
			if (!f || (f.properties && f.properties.score < 0.45)) throw new Error('ign-miss');
			return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], label: f.properties.label };
		}).catch(function () {
			var osm = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=fr,ch&accept-language=fr&q=' + encodeURIComponent(text);
			return fetchJson(osm).then(function (rows) {
				if (!rows || !rows[0]) throw new Error('not-found');
				return { lon: parseFloat(rows[0].lon), lat: parseFloat(rows[0].lat), label: rows[0].display_name.split(',').slice(0, 3).join(',') };
			});
		});
	}

	// ---------- Itinéraire ----------
	function route(dest) {
		var ign = 'https://data.geopf.fr/navigation/itineraire?resource=bdtopo-osrm&profile=car&optimization=fastest' +
			'&getSteps=false&getBbox=false&timeUnit=minute&distanceUnit=kilometer' +
			'&start=' + ORIGIN.lon + ',' + ORIGIN.lat + '&end=' + dest.lon + ',' + dest.lat;
		return fetchJson(ign).then(function (d) {
			if (d == null || d.duration == null) throw new Error('ign-route');
			return { minutes: Number(d.duration), km: Number(d.distance), approx: false };
		}).catch(function () {
			var osrm = 'https://router.project-osrm.org/route/v1/driving/' + ORIGIN.lon + ',' + ORIGIN.lat + ';' + dest.lon + ',' + dest.lat + '?overview=false';
			return fetchJson(osrm).then(function (d) {
				var r = d && d.routes && d.routes[0];
				if (!r) throw new Error('osrm');
				return { minutes: r.duration / 60, km: r.distance / 1000, approx: false };
			});
		}).catch(function () {
			var km = haversineKm(ORIGIN, dest) * 1.35;
			return { minutes: km / 55 * 60, km: km, approx: true };
		});
	}

	function haversineKm(a, b) {
		var R = 6371, toRad = Math.PI / 180;
		var dLat = (b.lat - a.lat) * toRad, dLon = (b.lon - a.lon) * toRad;
		var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		return 2 * R * Math.asin(Math.sqrt(h));
	}

	function formatDuration(min) {
		var m = Math.max(1, Math.round(min));
		if (m < 60) return m + ' min';
		var h = Math.floor(m / 60), r = m % 60;
		return h + ' h' + (r ? ' ' + String(r).padStart(2, '0') : '');
	}

	function zoneText(min) {
		if (min <= 12) return 'Vous êtes tout près : je peux être chez vous très rapidement.';
		if (min <= 30) return 'Vous êtes dans ma zone d’intervention habituelle.';
		if (min <= 50) return 'Vous êtes dans mon rayon d’intervention : appelez-moi pour caler un créneau.';
		return 'Un peu plus loin que ma zone habituelle : appelez-moi, on regarde ensemble ce qui est possible.';
	}

	function estimate() {
		var text = input.value.trim();
		if (!text) {
			show('error');
			els.errorText.textContent = 'Indiquez votre ville ou votre adresse pour obtenir une estimation.';
			input.focus();
			return;
		}
		show('loading');
		submitBtn.disabled = true;
		var destPromise = selected ? Promise.resolve(selected) : geocode(text);
		destPromise.then(function (dest) {
			return route(dest).then(function (r) { return { dest: dest, r: r }; });
		}).then(function (res) {
			els.duration.textContent = (res.r.approx ? '≈ ' : '') + formatDuration(res.r.minutes);
			els.distance.textContent = '· ' + (Math.round(res.r.km * 10) / 10).toString().replace('.', ',') + ' km' + (res.r.approx ? ' (estimation approximative)' : ' en voiture');
			els.destination.textContent = 'Jusqu’à : ' + res.dest.label;
			els.zone.textContent = zoneText(res.r.minutes);
			show('output');
			els.bar.style.width = '0%';
			requestAnimationFrame(function () {
				els.bar.style.width = Math.min(100, Math.max(6, res.r.minutes / 60 * 100)) + '%';
			});
		}).catch(function () {
			show('error');
			els.errorText.textContent = 'Je n’ai pas trouvé cette adresse. Essayez avec le nom de votre ville (ex : Thonon-les-Bains), ou appelez-moi directement.';
		}).finally(function () {
			submitBtn.disabled = false;
		});
	}

	form.addEventListener('submit', function (e) {
		e.preventDefault();
		list.classList.add('hidden');
		estimate();
	});

	var year = document.getElementById('year');
	if (year) year.textContent = new Date().getFullYear();
})();
