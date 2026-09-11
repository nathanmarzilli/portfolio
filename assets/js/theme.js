/* ============================================================
   GESTION DU THÈME (clair par défaut / sombre)
   ------------------------------------------------------------
   À charger dans le <head>, AVANT tout rendu, pour éviter le
   "flash" de mauvaise couleur au chargement de la page.

   - Le thème choisi est mémorisé dans localStorage et partagé
     par TOUTES les pages du site (accueil, offre-club, kickoff,
     espace admin, générateurs de documents...).
   - Le mode clair est le mode par défaut. Si l'utilisateur n'a
     jamais choisi et que son système est en mode sombre, on
     respecte sa préférence système.
   - `NM.theme.mount(el)` injecte un petit sélecteur soleil/lune.
     Tout élément portant l'attribut `data-theme-toggle` est
     équipé automatiquement au chargement du DOM.
   ============================================================ */
(function (root) {
	'use strict';

	var STORAGE_KEY = 'nm-theme';
	var DEFAULT_THEME = 'light';
	var VALID = { light: 1, dark: 1 };

	function readStored() {
		try {
			var v = localStorage.getItem(STORAGE_KEY);
			return VALID[v] ? v : null;
		} catch (e) { return null; }
	}

	function systemPrefersDark() {
		try {
			return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
		} catch (e) { return false; }
	}

	function resolveInitial() {
		var stored = readStored();
		if (stored) return stored;
		return systemPrefersDark() ? 'dark' : DEFAULT_THEME;
	}

	function current() {
		var t = document.documentElement.getAttribute('data-theme');
		return VALID[t] ? t : DEFAULT_THEME;
	}

	function apply(theme, opts) {
		if (!VALID[theme]) theme = DEFAULT_THEME;
		var el = document.documentElement;

		if (opts && opts.animate) {
			el.classList.add('theme-transition');
			window.setTimeout(function () { el.classList.remove('theme-transition'); }, 400);
		}

		el.setAttribute('data-theme', theme);
		// `dark` : classe utilisée par Tailwind (darkMode: 'class') pour les
		// rares variantes `dark:` écrites directement dans le HTML.
		el.classList.toggle('dark', theme === 'dark');

		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta) meta.setAttribute('content', theme === 'dark' ? '#020617' : '#f6f8fb');

		syncToggles();
		try {
			document.dispatchEvent(new CustomEvent('nm:themechange', { detail: { theme: theme } }));
		} catch (e) { /* CustomEvent indisponible : sans conséquence */ }
	}

	function set(theme) {
		try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
		apply(theme, { animate: true });
	}

	function toggle() {
		set(current() === 'dark' ? 'light' : 'dark');
	}

	function syncToggles() {
		var theme = current();
		document.querySelectorAll('[data-theme-set]').forEach(function (btn) {
			btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme-set') === theme));
		});
	}

	var TOGGLE_HTML =
		'<button type="button" data-theme-set="light" aria-pressed="false" title="Mode clair" aria-label="Activer le mode clair">' +
			'<i class="ph-bold ph-sun" aria-hidden="true"></i>' +
		'</button>' +
		'<button type="button" data-theme-set="dark" aria-pressed="false" title="Mode sombre" aria-label="Activer le mode sombre">' +
			'<i class="ph-bold ph-moon" aria-hidden="true"></i>' +
		'</button>';

	function mount(el) {
		if (!el || el.dataset.themeMounted === '1') return;
		el.dataset.themeMounted = '1';
		el.classList.add('theme-toggle');
		el.setAttribute('role', 'group');
		el.setAttribute('aria-label', 'Choisir le thème d’affichage');
		el.innerHTML = TOGGLE_HTML;
		el.querySelectorAll('[data-theme-set]').forEach(function (btn) {
			btn.addEventListener('click', function () {
				set(btn.getAttribute('data-theme-set'));
			});
		});
		syncToggles();
	}

	function mountAll() {
		document.querySelectorAll('[data-theme-toggle]').forEach(mount);
	}

	// --- Application immédiate (avant le premier rendu) ---------------
	apply(resolveInitial());

	// Synchronisation entre onglets ouverts.
	window.addEventListener('storage', function (e) {
		if (e.key === STORAGE_KEY && VALID[e.newValue]) apply(e.newValue, { animate: true });
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', mountAll);
	} else {
		mountAll();
	}

	root.NM = root.NM || {};
	root.NM.theme = { get: current, set: set, toggle: toggle, mount: mount, mountAll: mountAll };

})(window);
