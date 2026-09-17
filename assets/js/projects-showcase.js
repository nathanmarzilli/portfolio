/* ============================================================
   APERÇU DES RÉALISATIONS — partagé accueil / offre club
   ------------------------------------------------------------
   Rend la liste des projets dans tout élément #projects-grid.
   Un seul code et une seule source de données : avant le
   17/09/2026, /offre-club/ embarquait une copie inline (script
   dans la page) qui divergeait de script.js.

   Options par page (attribut sur #projects-grid) :
     data-projects="bad-evian"   -> ne garder que ces projets
                                    (clés séparées par des virgules)
     data-projects-divider="off" -> pas de séparateur entre projets
   ============================================================ */
(function (root) {
	'use strict';

	var PROJECTS = [
		{
			key: 'bad-evian',
			title: 'Badminton Club Évian',
			subtitle: 'La transformation associative',
			story: 'En modernisant l’identité du club, j’ai donné une image plus soignée et rassurante, qui inspire confiance aux adhérents du Chablais.',
			url: 'https://www.badminton-evian.fr',
			type: 'Site Club Sportif',
			features: [
				{ icon: 'ph-clock-counter-clockwise', text: 'Histoire Chablais', desc: 'Une navigation temporelle interactive retraçant l\'évolution du club en Haute-Savoie.' },
				{ icon: 'ph-newspaper', text: 'Actualités 74', desc: 'Interface d\'administration simplifiée pour publier les news du club d\'Évian sans compétences techniques.' },
				{ icon: 'ph-lightning', text: 'Résultats Live', desc: 'Connexion API temps réel pour afficher les scores des rencontres en direct.' },
				{ icon: 'ph-images', text: 'Galerie HD', desc: 'Optimisation WebP et Lazy Loading pour un chargement instantané des photos de tournois.' },
				{ icon: 'ph-envelope-simple', text: 'Contact Asso', desc: 'Formulaire sécurisé pour les demandes d\'inscription et renseignements.' },
				{ icon: 'ph-users', text: 'Avis Adhérents', desc: 'Intégration automatique des avis Google pour la preuve sociale locale.' }
			]
		}
	];

	function esc(v) {
		return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	function vibrate() { if (root.vibrate) root.vibrate(); else if (navigator.vibrate) navigator.vibrate(10); }

	function projectHtml(project, index, withDivider) {
		var featuresHtml = project.features && project.features.length ? (
			'<div class="w-full mb-6 mt-4 block relative">' +
				'<div class="flex flex-wrap gap-2 mb-4">' +
					project.features.map(function (f, i) {
						return '<button type="button" onclick="window.showProjectDesc(' + index + ', ' + i + ')" ' +
							'class="proj-btn-' + index + ' group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-dark-900 text-xs text-slate-300 hover:border-accent-400 hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer focus:outline-none" ' +
							'data-desc="' + esc(f.desc) + '">' +
							'<i class="ph-bold ' + esc(f.icon) + ' text-accent-400 group-hover:scale-110 transition-transform"></i>' +
							'<span>' + esc(f.text) + '</span>' +
						'</button>';
					}).join('') +
				'</div>' +
				'<div id="project-desc-box-' + index + '" class="hidden w-full bg-white/5 border-l-2 border-accent-400 p-4 rounded-xl text-sm text-slate-300 animate-pop-in relative">' +
					'<i class="ph-duotone ph-info text-xl text-accent-400 absolute top-4 right-4 opacity-50"></i>' +
					'<p id="project-desc-text-' + index + '" class="leading-relaxed pr-8"></p>' +
				'</div>' +
			'</div>') : '';

		var host = project.url.replace(/^https?:\/\//, '');
		return '' +
			'<article class="flex flex-col md:flex-row gap-8 items-stretch min-h-[400px] reveal group" style="transition-delay: ' + (index * 100) + 'ms">' +
				'<div class="md:w-1/3 flex flex-col justify-center order-2 md:order-1 min-w-0">' +
					'<div class="mb-2">' +
						'<span class="text-accent-400 text-xs font-bold uppercase tracking-wider mb-2 block">' + esc(project.type) + '</span>' +
						'<h3 class="text-3xl font-display font-bold text-white mb-1">' + esc(project.title) + '</h3>' +
						'<p class="text-slate-500 italic text-sm mb-4">' + esc(project.subtitle) + '</p>' +
					'</div>' +
					'<p class="text-slate-300 leading-relaxed text-sm mb-2 border-l-2 border-accent-400 pl-4">"' + esc(project.story) + '"</p>' +
					featuresHtml +
					'<a href="' + esc(project.url) + '" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-white font-bold hover:text-accent-400 transition-colors w-fit group/link mt-auto">' +
						'Visiter le site <i class="ph-bold ph-arrow-right group-hover/link:translate-x-1 transition-transform"></i>' +
					'</a>' +
				'</div>' +
				'<div class="md:w-2/3 order-1 md:order-2 relative rounded-3xl overflow-hidden border border-white/10 bg-dark-900 group/frame interactive-hover h-[300px] md:h-auto project-frame-container cursor-pointer" onclick="toggleMobilePreview(this)">' +
					'<div class="absolute top-0 left-0 right-0 h-10 bg-dark-950/90 backdrop-blur border-b border-white/5 flex items-center px-4 gap-2 z-20">' +
						'<div class="flex gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div><div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div></div>' +
						'<div class="ml-4 text-[10px] text-slate-500 font-mono opacity-50 flex-grow truncate">' + esc(host) + '</div>' +
					'</div>' +
					'<div class="absolute inset-0 top-10 bg-white transition-all duration-700 ease-out grayscale group-hover/frame:grayscale-0 iframe-container project-iframe">' +
						'<iframe src="' + esc(project.url) + '" title="Aperçu : ' + esc(project.title) + '" class="w-[200%] h-[200%] border-0 transform scale-50 origin-top-left pointer-events-none" loading="lazy"></iframe>' +
						'<div class="absolute inset-0 bg-dark-950/10 backdrop-blur-[2px] group-hover/frame:backdrop-blur-0 transition-all duration-500 iframe-overlay"></div>' +
						'<div class="absolute inset-0 flex items-center justify-center opacity-100 group-hover/frame:opacity-0 transition-opacity duration-300 pointer-events-none hint-overlay">' +
							'<span class="px-4 py-2 bg-dark-950/80 rounded-full text-xs text-white backdrop-blur-md border border-white/10 flex items-center gap-2">' +
								'<i class="ph-bold ph-hand-tap md:hidden"></i>' +
								'<span class="md:hidden">Touchez pour aperçu</span>' +
								'<span class="hidden md:inline">Survoler pour aperçu</span>' +
							'</span>' +
						'</div>' +
					'</div>' +
					'<a href="' + esc(project.url) + '" target="_blank" rel="noopener" class="absolute inset-0 z-30 md:hidden pointer-events-none" aria-hidden="true" tabindex="-1"></a>' +
				'</div>' +
			'</article>' +
			(withDivider ? '<div class="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-16 last:hidden"></div>' : '');
	}

	function render(grid) {
		var wanted = (grid.getAttribute('data-projects') || '').split(',').map(function (k) { return k.trim(); }).filter(Boolean);
		var list = wanted.length ? PROJECTS.filter(function (p) { return wanted.indexOf(p.key) !== -1; }) : PROJECTS;
		var withDivider = grid.getAttribute('data-projects-divider') !== 'off';
		grid.innerHTML = list.map(function (p, i) { return projectHtml(p, i, withDivider); }).join('');
		// Force l'affichage des éléments « reveal » injectés après coup.
		setTimeout(function () {
			if (root.NM && root.NM.reveal && root.NM.reveal.refresh) root.NM.reveal.refresh();
			grid.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('active'); });
		}, 50);
	}

	root.showProjectDesc = function (projectIndex, btnIndex) {
		vibrate();
		var buttons = document.querySelectorAll('.proj-btn-' + projectIndex);
		buttons.forEach(function (btn) {
			btn.classList.remove('bg-white/10', 'border-accent-400', 'text-white');
			btn.classList.add('bg-dark-900', 'border-white/10', 'text-slate-300');
		});
		var clicked = buttons[btnIndex];
		if (!clicked) return;
		clicked.classList.remove('bg-dark-900', 'border-white/10', 'text-slate-300');
		clicked.classList.add('bg-white/10', 'border-accent-400', 'text-white');
		var box = document.getElementById('project-desc-box-' + projectIndex);
		var text = document.getElementById('project-desc-text-' + projectIndex);
		if (box && text) {
			box.classList.remove('hidden');
			text.textContent = clicked.getAttribute('data-desc');
		}
	};

	// Sur mobile, un toucher active l'aperçu interactif (le suivant le désactive).
	root.toggleMobilePreview = function (element) {
		vibrate();
		if (root.innerWidth >= 768) return;
		if (element.classList.contains('mobile-active')) {
			element.classList.remove('mobile-active');
		} else {
			document.querySelectorAll('.project-frame-container').forEach(function (el) { el.classList.remove('mobile-active'); });
			element.classList.add('mobile-active');
		}
	};

	function init() {
		var grid = document.getElementById('projects-grid');
		if (!grid) return;
		// Court délai pour laisser voir le squelette de chargement.
		setTimeout(function () { render(grid); }, 500);
	}

	root.NM = root.NM || {};
	root.NM.projects = { list: PROJECTS, render: render };

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})(window);
