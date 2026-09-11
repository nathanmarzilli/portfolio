/* ============================================================
   ANIMATIONS D'APPARITION AU DÉFILEMENT — module partagé
   ------------------------------------------------------------
   Deux comportements, un seul observateur :

   • `.reveal`      — l'élément apparaît quand il entre à l'écran.
   • `[data-stagger]` — ses enfants directs apparaissent l'un après
                        l'autre, en cascade (parcours en étapes,
                        grilles de cartes…). L'intervalle se règle
                        avec data-stagger="90" (en millisecondes).

   Les éléments déjà visibles au chargement sont révélés tout de
   suite : rien ne reste jamais invisible, même sans défilement.
   Si l'utilisateur a demandé moins d'animations dans son système,
   tout est affiché immédiatement.
   ============================================================ */
(function (root) {
	'use strict';

	var STAGGER_DEFAULT = 90;

	function prefersReducedMotion() {
		try {
			return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch (e) { return false; }
	}

	function revealAll() {
		document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('active'); });
	}

	function prepareStaggers() {
		document.querySelectorAll('[data-stagger]').forEach(function (parent) {
			var step = parseInt(parent.getAttribute('data-stagger'), 10) || STAGGER_DEFAULT;
			Array.prototype.forEach.call(parent.children, function (child, i) {
				child.classList.add('reveal');
				child.style.transitionDelay = (i * step) + 'ms';
			});
		});
	}

	function init() {
		prepareStaggers();

		if (prefersReducedMotion() || !('IntersectionObserver' in root)) {
			revealAll();
			return;
		}

		var observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (!entry.isIntersecting) return;
				entry.target.classList.add('active');
				observer.unobserve(entry.target);
			});
		}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

		document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });

		// Filet de sécurité : si l'observateur n'a rien déclenché au bout
		// de quelques secondes (page très courte, onglet en arrière-plan…),
		// on affiche tout plutôt que de laisser du contenu invisible.
		root.setTimeout(revealAll, 4000);
	}

	/** À appeler après avoir injecté du contenu dynamiquement. */
	function refresh() { init(); }

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	root.NM = root.NM || {};
	root.NM.reveal = { refresh: refresh, revealAll: revealAll };

})(window);
