// ============================================================
// SCRIPT PRINCIPAL — page d'accueil
// ------------------------------------------------------------
// Dépendances chargées AVANT ce fichier (voir index.html) :
//   • config.js                 -> window.APP_CONFIG (tarifs, textes)
//   • assets/js/supabase-client -> window.NM.db (données + auth)
//   • assets/js/i18n.js         -> window.NM.i18n (langue, devise, prix)
//   • assets/js/theme.js        -> window.NM.theme (clair / sombre)
//
// ⚠️ Ce site ne propose AUCUN paiement en ligne. Le tunnel s'arrête
// à la prise de rendez-vous : réservation d'un créneau, puis brief
// projet (page /kickoff/), puis devis envoyé manuellement depuis
// l'espace d'administration.
// ============================================================

var CFG = window.APP_CONFIG || { offers: {}, currencies: {}, launchPromo: { active: false }, defaultCurrency: 'EUR' };

// Cycle de facturation des packs Sérénité : 'monthly' | 'annual'
// (forcé sur 'annual' quand le pack Essentiel est sélectionné).
// Déclaré en `var` au niveau du module car il est lu par des fonctions
// hissées appelées dès le premier rendu.
var serenityBillingCycle = 'monthly';

// --- Ponts vers le module i18n partagé ------------------------------
function getCurrentCurrency() {
	return (window.NM && NM.i18n) ? NM.i18n.currency() : (CFG.defaultCurrency || 'EUR');
}
function getCurrentLocale() {
	return (window.NM && NM.i18n) ? NM.i18n.locale() : (CFG.currentLocale || 'fr');
}
function formatMoney(amount, currencyCode) {
	if (window.NM && NM.i18n) return NM.i18n.format(amount, currencyCode);
	return amount + ' €';
}
function applyI18n() {
	if (window.NM && NM.i18n) NM.i18n.render();
}
window.applyI18n = applyI18n;

// ============================================================
// ENREGISTREMENT D'UNE DEMANDE
// ------------------------------------------------------------
// Point d'entrée unique du tunnel : enregistre la demande dans
// Supabase (table nm_leads). C'est Supabase lui-même qui prévient
// ensuite Zapier (déclencheur SQL sur la table), donc rien à faire
// ici : voir /admin/ → Réglages pour coller l'URL « Catch Hook ».
// Best-effort : une erreur ici ne doit JAMAIS empêcher l'affichage
// de la confirmation à l'internaute.
// ============================================================
window.submitForm = async function (data) {
	// 1. Ancien webhook appelé depuis le navigateur — désactivé par
	//    défaut (config.integrations.zapierWebhookUrl vide). Conservé
	//    comme filet de secours si un jour le déclencheur base échoue.
	/* eslint-disable-next-line */
	var webhookUrl = CFG.integrations && CFG.integrations.zapierWebhookUrl;
	if (webhookUrl && webhookUrl.indexOf('TODO_') !== 0) {
		try {
			await fetch(webhookUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
		} catch (e) {
			console.error('submitForm : webhook Zapier injoignable (non bloquant)', e);
		}
	}

	// 2. Enregistrement en base (visible ensuite dans l'espace admin)
	try {
		var db = await window.NM.dbReady;
		return await db.saveLead(data);
	} catch (e) {
		console.error("submitForm : enregistrement Supabase impossible (non bloquant)", e);
		return null;
	}
};

document.addEventListener('DOMContentLoaded', () => {
	// --- INITIALISATION DYNAMIQUE DES TARIFS, DEVISES ET PROMOTIONS ---
    function renderPricing() {
        var offers = CFG.offers || {};
        var promo = CFG.launchPromo || { active: false };
        const isPromoValid = !!(promo.active && promo.totalPacks > 0);

        // 1. Bannière « offre de lancement » (masquée si la promo est inactive)
        const bannerContainer = document.getElementById('promo-banner-container');
        if (bannerContainer && isPromoValid) {
            bannerContainer.innerHTML = `
                <div class="p-1 rounded-2xl bg-gradient-to-r from-accent-400 via-blue-500 to-purple-500 shadow-lg mb-8">
                    <div class="bg-dark-950 rounded-xl p-6 text-center relative overflow-hidden flex flex-col items-center">
                        <div class="absolute top-0 right-0 p-24 bg-accent-400/10 blur-3xl rounded-full pointer-events-none"></div>
                        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-400/20 text-accent-400 text-xs font-bold uppercase tracking-wider mb-3">
                            <i class="ph-bold ph-rocket-launch"></i> Opportunité nouveaux clients
                        </span>
                        <h3 class="text-xl sm:text-2xl font-display font-bold text-white mb-2">
                            Offre de lancement : -${promo.discountPercent}% sur les créations Essentiel &amp; Vitrine
                        </h3>
                        <p class="text-slate-400 text-sm font-medium flex items-center gap-2 flex-wrap justify-center">
                            Pour fêter le lancement de mon activité.
                            <span class="text-dark-950 bg-accent-400 px-3 py-1 rounded-full font-bold shadow-sm">
                               réservé aux ${promo.totalPacks} prochains projets
                            </span>
                        </p>
                    </div>
                </div>
            `;
            bannerContainer.classList.remove('hidden');
        } else if (bannerContainer) {
            bannerContainer.classList.add('hidden');
            bannerContainer.innerHTML = '';
        }

        // 2. Remise éventuelle appliquée aux montants du formulaire (toujours en EUR)
        const getDiscounted = (basePrice, applyDiscount) => {
            if (applyDiscount && isPromoValid) {
                return Math.round(basePrice * (1 - (promo.discountPercent / 100)) * 100) / 100;
            }
            return basePrice;
        };

        // 3. Les prix affichés (cartes, pastilles, options) sont rendus par
        //    NM.i18n à partir des attributs data-offer-key / data-price-eur.
        //    Les cartes Sérénité gèrent en plus le cycle mensuel/annuel.
        applyI18n();
        renderSerenityCardPrices();

        // 4. Montants de référence du formulaire de demande (toujours en EUR :
        //    le devis et le brief projet sont établis en euros).
        var packs = { eclair: 'pack-eclair', essentiel: 'pack-essentiel', vitrine: 'pack-vitrine', premium: 'pack-premium' };
        Object.keys(packs).forEach(function (key) {
            var offer = offers[key];
            var input = document.getElementById(packs[key]);
            if (!offer || !input) return;
            var applyDiscount = isPromoValid && (promo.appliesTo || []).indexOf(key) !== -1;
            input.setAttribute('data-price', getDiscounted(offer.price.EUR, applyDiscount));
        });
    }

    // Expose pour les gestionnaires de devise + appel immédiat
    window.renderPricing = renderPricing;
    renderPricing();
    applyI18n();

    // Changement de langue / devise : NM.i18n prévient tout le monde.
    if (window.NM && NM.i18n) {
        NM.i18n.onChange(function () {
            if (window.vibrate) window.vibrate();
            renderPricing();
        });
    }

    // ==============================================
    // 0. UX & DESIGN ENHANCEMENTS
    // ==============================================
    
    // Fonction Helper Vibration (Mobile tactile)
    window.vibrate = function() {
        if (navigator.vibrate) navigator.vibrate(10);
    };

    // 1. Cursor Spotlight
    const spotlight = document.querySelector('.spotlight-overlay');
    window.addEventListener('mousemove', (e) => {
        if (spotlight) {
            spotlight.style.setProperty('--mouse-x', `${e.clientX}px`);
            spotlight.style.setProperty('--mouse-y', `${e.clientY}px`);
        }
    });

    // 2. Scroll Progress Bar
    const progressBar = document.getElementById('scroll-progress');
    window.addEventListener('scroll', () => {
        if (progressBar) {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = (scrollTop / docHeight) * 100;
            progressBar.style.width = `${scrollPercent}%`;
        }
    });
    
    // ==============================================
    // 2. GESTION DES PROJETS (OPTIMISÉ SEO & ALIGNEMENT)
    // ==============================================
    const projectsData = [
        {
            title: "Badminton Club Évian",
            subtitle: "La transformation associative",
            story: "En modernisant l’identité du club, j’ai donné une image plus soignée et rassurante, qui inspire confiance aux adhérents du Chablais.",
            url: "https://www.badminton-evian.fr", 
            type: "Site Club Sportif",
            features: [
                { icon: "ph-clock-counter-clockwise", text: "Histoire Chablais", desc: "Une navigation temporelle interactive retraçant l'évolution du club en Haute-Savoie." },
                { icon: "ph-newspaper", text: "Actualités 74", desc: "Interface d'administration simplifiée pour publier les news du club d'Évian sans compétences techniques." },
                { icon: "ph-lightning", text: "Résultats Live", desc: "Connexion API temps réel pour afficher les scores des rencontres en direct." },
                { icon: "ph-images", text: "Galerie HD", desc: "Optimisation WebP et Lazy Loading pour un chargement instantané des photos de tournois." },
                { icon: "ph-envelope-simple", text: "Contact Asso", desc: "Formulaire sécurisé pour les demandes d'inscription et renseignements." },
                { icon: "ph-users", text: "Avis Adhérents", desc: "Intégration automatique des avis Google pour la preuve sociale locale." }
            ]
        }
    ];

    const projectsGrid = document.getElementById('projects-grid');
    
    if (projectsGrid) {
        // Simulation délai réseau pour laisser voir le Skeleton (effet de chargement)
        setTimeout(() => {
            projectsGrid.innerHTML = projectsData.map((project, index) => {
                const featuresHtml = project.features && project.features.length > 0 ? `
                    <div class="w-full mb-6 mt-4 block relative">
                        <div class="flex flex-wrap gap-2 mb-4">
                            ${project.features.map((f, i) => `
                                <button onclick="window.showProjectDesc(${index}, ${i})" 
                                    class="proj-btn-${index} group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-dark-900 text-xs text-slate-300 hover:border-accent-400 hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer focus:outline-none"
                                    data-desc="${f.desc}">
                                    <i class="ph-bold ${f.icon} text-accent-400 group-hover:scale-110 transition-transform"></i>
                                    <span>${f.text}</span>
                                </button>
                            `).join('')}
                        </div>
                        <div id="project-desc-box-${index}" class="hidden w-full bg-white/5 border-l-2 border-accent-400 p-4 rounded-xl text-sm text-slate-300 animate-pop-in relative">
                            <i class="ph-duotone ph-info text-xl text-accent-400 absolute top-4 right-4 opacity-50"></i>
                            <p id="project-desc-text-${index}" class="leading-relaxed pr-8"></p>
                        </div>
                    </div>
                ` : '';

                return `
                <article class="flex flex-col md:flex-row gap-8 items-stretch min-h-[400px] reveal group" style="transition-delay: ${index * 100}ms">
                    <div class="md:w-1/3 flex flex-col justify-center order-2 md:order-1 min-w-0">
                        <div class="mb-2">
                            <span class="text-accent-400 text-xs font-bold uppercase tracking-wider mb-2 block">${project.type}</span>
                            <h3 class="text-3xl font-display font-bold text-white mb-1">${project.title}</h3>
                            <p class="text-slate-500 italic text-sm mb-4">${project.subtitle}</p>
                        </div>
                        <p class="text-slate-300 leading-relaxed text-sm mb-2 border-l-2 border-accent-400 pl-4">"${project.story}"</p>
                        ${featuresHtml}
                        <a href="${project.url}" target="_blank" class="inline-flex items-center gap-2 text-white font-bold hover:text-accent-400 transition-colors w-fit group/link mt-auto">
                            Visiter le site <i class="ph-bold ph-arrow-right group-hover/link:translate-x-1 transition-transform"></i>
                        </a>
                    </div>
                    <div class="md:w-2/3 order-1 md:order-2 relative rounded-3xl overflow-hidden border border-white/10 bg-dark-900 group/frame interactive-hover h-[300px] md:h-auto project-frame-container cursor-pointer" onclick="toggleMobilePreview(this)">
                        <div class="absolute top-0 left-0 right-0 h-10 bg-dark-950/90 backdrop-blur border-b border-white/5 flex items-center px-4 gap-2 z-20">
                            <div class="flex gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div><div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div></div>
                            <div class="ml-4 text-[10px] text-slate-500 font-mono opacity-50 flex-grow truncate">${project.url.replace('https://', '')}</div>
                        </div>
                        <div class="absolute inset-0 top-10 bg-white transition-all duration-700 ease-out grayscale group-hover/frame:grayscale-0 iframe-container project-iframe">
                             <iframe src="${project.url}" class="w-[200%] h-[200%] border-0 transform scale-50 origin-top-left pointer-events-none" loading="lazy"></iframe>
                            <div class="absolute inset-0 bg-dark-950/10 backdrop-blur-[2px] group-hover/frame:backdrop-blur-0 transition-all duration-500 iframe-overlay"></div>
                            <div class="absolute inset-0 flex items-center justify-center opacity-100 group-hover/frame:opacity-0 transition-opacity duration-300 pointer-events-none hint-overlay">
                                <span class="px-4 py-2 bg-dark-950/80 rounded-full text-xs text-white backdrop-blur-md border border-white/10 flex items-center gap-2">
                                    <i class="ph-bold ph-hand-tap md:hidden"></i>
                                    <span class="md:hidden">Touchez pour aperçu</span>
                                    <span class="hidden md:inline">Survoler pour aperçu</span>
                                </span>
                            </div>
                        </div>
                        <a href="${project.url}" target="_blank" class="absolute inset-0 z-30 md:hidden pointer-events-none"></a>
                    </div>
                </article>
                <div class="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-16 last:hidden"></div>
                `;
            }).join('');

            // FORCE L'AFFICHAGE (Correction du bug "invisible")
            setTimeout(() => {
                if (window.NM && NM.reveal) NM.reveal.refresh();
                const newProjectElements = document.querySelectorAll('#projects-grid .reveal');
                newProjectElements.forEach(el => el.classList.add('active'));
            }, 50);

        }, 500);
    }

    // --- FONCTIONS D'INTERACTIVITÉ ---

    // 1. Gestion de l'affichage des descriptions
    window.showProjectDesc = function(projectIndex, btnIndex) {
        if(window.vibrate) window.vibrate(); // Feedback tactile
        
        // Reset de tous les boutons de ce projet
        document.querySelectorAll(`.proj-btn-${projectIndex}`).forEach(btn => {
            btn.classList.remove('bg-white/10', 'border-accent-400', 'text-white');
            btn.classList.add('bg-dark-900', 'border-white/10', 'text-slate-300');
        });

        // Activation du bouton cliqué
        const clickedBtn = document.querySelectorAll(`.proj-btn-${projectIndex}`)[btnIndex];
        if(clickedBtn) {
            clickedBtn.classList.remove('bg-dark-900', 'border-white/10', 'text-slate-300');
            clickedBtn.classList.add('bg-white/10', 'border-accent-400', 'text-white');
            
            // Affichage de la boîte de description
            const box = document.getElementById(`project-desc-box-${projectIndex}`);
            const text = document.getElementById(`project-desc-text-${projectIndex}`);
            
            if(box && text) {
                box.classList.remove('hidden');
                text.textContent = clickedBtn.getAttribute('data-desc');
            }
        }
    };

    // 2. Fonction Globale pour le fix mobile (Aperçu site)
    window.toggleMobilePreview = function(element) {
        if(window.vibrate) window.vibrate();
        if (window.innerWidth < 768) {
            if (element.classList.contains('mobile-active')) {
                element.classList.remove('mobile-active');
            } else {
                document.querySelectorAll('.project-frame-container').forEach(el => el.classList.remove('mobile-active'));
                element.classList.add('mobile-active');
            }
        }
    };

    // ==============================================
    // 3. AUTHENTIFICATION & ESPACE ADMINISTRATION
    // ----------------------------------------------
    // L'authentification passe par Supabase (voir
    // assets/js/supabase-client.js). Les mêmes identifiants
    // ouvrent TOUTES les pages sécurisées du site : espace
    // clients, générateur de devis/factures, quittances, bail
    // et suivi running.
    // ==============================================
    const adminModal = document.getElementById('admin-modal');
    const adminContent = document.getElementById('admin-content');
    const loginView = document.getElementById('admin-login-view');
    const dashboardView = document.getElementById('admin-dashboard-view');
    const actionsGrid = document.getElementById('admin-actions-grid');
    const loginError = document.getElementById('login-error');
    const shieldIcon = document.getElementById('header-shield-icon');

    function paintShield(isConnected) {
        if (!shieldIcon) return;
        shieldIcon.classList.toggle('text-slate-600', !isConnected);
        shieldIcon.classList.toggle('text-green-400', !!isConnected);
        if (shieldIcon.parentElement) {
            shieldIcon.parentElement.classList.toggle('animate-pulse-slow', !!isConnected);
        }
    }

    window.NM.dbReady.then(function (db) {
        db.currentUser().then(function (user) { paintShield(!!user); });
        db.onAuthChange(function (user) {
            paintShield(!!user);
            if (adminModal && !adminModal.classList.contains('hidden')) {
                user ? showDashboard() : showLogin();
            }
        });
    }).catch(function (e) {
        console.error('Espace sécurisé indisponible :', e);
    });

    window.toggleAdminModal = function () {
        if (window.vibrate) window.vibrate();
        if (!adminModal) return;

        if (adminModal.classList.contains('hidden')) {
            adminModal.classList.remove('hidden');
            setTimeout(function () {
                adminModal.classList.remove('opacity-0');
                adminContent.classList.remove('scale-95');
                adminContent.classList.add('scale-100');
            }, 10);
            showLogin();
            window.NM.dbReady.then(function (db) {
                return db.currentUser();
            }).then(function (user) {
                if (user) showDashboard();
            }).catch(function () { /* hors ligne : on reste sur le formulaire */ });
        } else {
            adminModal.classList.add('opacity-0');
            adminContent.classList.remove('scale-100');
            adminContent.classList.add('scale-95');
            setTimeout(function () {
                adminModal.classList.add('hidden');
                resetAdminForm();
            }, 300);
        }
    };

    window.togglePasswordVisibility = function () {
        const passInput = document.getElementById('admin-pass');
        const eyeIcon = document.getElementById('eye-icon');
        if (!passInput || !eyeIcon) return;
        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeIcon.classList.replace('ph-eye', 'ph-eye-slash');
        } else {
            passInput.type = 'password';
            eyeIcon.classList.replace('ph-eye-slash', 'ph-eye');
        }
    };

    function resetAdminForm() {
        const id = document.getElementById('admin-id');
        const pass = document.getElementById('admin-pass');
        if (id) id.value = '';
        if (pass) pass.value = '';
        if (loginError) loginError.classList.add('hidden');
    }

    function showLoginError(message) {
        if (!loginError) return;
        loginError.querySelector('.login-error-text').textContent = message;
        loginError.classList.remove('hidden');
        if (adminContent) {
            adminContent.classList.add('animate-pulse');
            setTimeout(function () { adminContent.classList.remove('animate-pulse'); }, 500);
        }
    }

    function showLogin() {
        if (loginView) loginView.classList.remove('hidden');
        if (dashboardView) dashboardView.classList.add('hidden');
    }

    function showDashboard() {
        if (loginView) loginView.classList.add('hidden');
        if (dashboardView) dashboardView.classList.remove('hidden');
        renderAdminButtons();
    }

    window.attemptLogin = async function () {
        if (window.vibrate) window.vibrate();
        const identifier = (document.getElementById('admin-id') || {}).value || '';
        const password = (document.getElementById('admin-pass') || {}).value || '';
        if (!identifier.trim() || !password) {
            showLoginError('Merci de renseigner votre identifiant et votre mot de passe.');
            return;
        }
        try {
            const db = await window.NM.dbReady;
            await db.signIn(identifier.trim(), password);
            if (loginError) loginError.classList.add('hidden');
            showDashboard();
        } catch (error) {
            console.error('Connexion refusée :', error);
            showLoginError(
                (error && /Invalid login/i.test(error.message || ''))
                    ? 'Identifiant ou mot de passe incorrect.'
                    : 'Connexion impossible. Vérifiez votre connexion internet et réessayez.'
            );
        }
    };

    window.requestPasswordReset = async function () {
        const identifier = (document.getElementById('admin-id') || {}).value || '';
        if (!identifier.trim()) {
            showLoginError('Saisissez d’abord votre identifiant, je vous envoie un lien de réinitialisation.');
            return;
        }
        try {
            const db = await window.NM.dbReady;
            await db.sendPasswordReset(identifier.trim(), window.location.origin + '/portfolio/admin/');
            showLoginError('Lien de réinitialisation envoyé. Consultez votre boîte mail.');
        } catch (error) {
            console.error(error);
            showLoginError('Envoi impossible pour le moment. Réessayez dans un instant.');
        }
    };

    window.logout = async function () {
        if (window.vibrate) window.vibrate();
        try {
            const db = await window.NM.dbReady;
            await db.signOut();
        } catch (e) { console.error(e); }
        showLogin();
    };

    // Toutes les pages réservées, accessibles une fois connecté.
    const adminActions = [
        { label: "Espace clients", icon: "ph-users-three", color: "text-accent-400", link: "admin/", primary: true },
        { label: "Créer un devis / une facture", icon: "ph-file-text", color: "text-blue-400", link: "contrat/devis&contrat/" },
        { label: "Quittance de loyer", icon: "ph-house-line", color: "text-green-400", link: "contrat/quittance/" },
        { label: "Bail location meublée", icon: "ph-key", color: "text-purple-400", link: "contrat/bail/" },
        { label: "Prospection", icon: "ph-target", color: "text-pink-400", link: "prospect/" },
        { label: "Suivi running", icon: "ph-person-simple-run", color: "text-orange-400", link: "running/" }
    ];

    function renderAdminButtons() {
        if (!actionsGrid) return;
        let html = adminActions.map(function (action) {
            return `
                <a href="${action.link}" class="flex items-center gap-4 p-4 rounded-xl bg-slate-500/5 border ${action.primary ? 'border-accent-400/40' : 'border-slate-500/15'} hover:bg-slate-500/10 hover:border-accent-400 transition-all group">
                    <span class="w-10 h-10 rounded-full bg-dark-950 flex items-center justify-center border border-slate-500/20 shrink-0">
                        <i class="ph-bold ${action.icon} ${action.color} text-xl"></i>
                    </span>
                    <span class="font-bold text-slate-200 group-hover:text-white transition-colors">${action.label}</span>
                    <i class="ph-bold ph-arrow-right ml-auto text-slate-500 group-hover:text-accent-400 transition-colors"></i>
                </a>
            `;
        }).join('');
        html += `
            <button onclick="window.logout()" class="w-full mt-2 py-3 rounded-xl border border-slate-500/20 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-slate-500/10 hover:text-white transition-all">
                Se déconnecter
            </button>
        `;
        actionsGrid.innerHTML = html;
    }

    const passField = document.getElementById('admin-pass');
    if (passField) {
        passField.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') window.attemptLogin();
        });
    }

    // ==============================================
    // 4. ANIMATIONS & UI (TECH & ABOUT)
    // ==============================================
    const techDescriptions = {
        'html': { title: 'Structure HTML5 Sémantique', text: 'Respect rigoureux des standards W3C. Je structure chaque page pour assurer une accessibilité maximale et une base solide pour le référencement naturel.', icon: 'ph-file-html', color: 'text-orange-500' },
        'css': { title: 'Design CSS3 Moderne', text: 'Création de layouts complexes (Grid/Flexbox) et d’animations fluides. Je soigne chaque transition pour une expérience utilisateur agréable et dynamique.', icon: 'ph-file-css', color: 'text-blue-500' },
        'js': { title: 'JavaScript Dynamique', text: 'Interactivité sur-mesure sans alourdir le site. J’ajoute juste ce qu’il faut de logique pour rendre votre site vivant et réactif.', icon: 'ph-file-js', color: 'text-yellow-400' },
        'tailwind': { title: 'Tailwind CSS', text: 'Développement rapide d\'interfaces uniques et légères. Pas de "template" tout fait, mais un design système cohérent.', icon: 'ph-paint-brush-broad', color: 'text-cyan-400' },
        'git': { title: 'Versionning Git', text: 'Sécurité du code et historique des modifications. Votre projet est sauvegardé étape par étape, zéro risque de perte.', icon: 'ph-git-branch', color: 'text-red-500' },
        'responsive': { title: 'Mobile First', text: 'Votre site est pensé pour les smartphones en priorité, car c\'est là que vos clients se trouvent aujourd\'hui.', icon: 'ph-device-mobile', color: 'text-purple-400' },
        'supabase': { title: 'Supabase (PostgreSQL)', text: 'Base de données PostgreSQL hébergée en Europe, avec authentification sécurisée et règles d\'accès par ligne. Vos données restent les vôtres.', icon: 'ph-database', color: 'text-emerald-400' },
        'seo': { title: 'SEO & Performance', text: 'Optimisation technique avancée (Core Web Vitals) pour plaire à Google et faire monter votre site dans les résultats.', icon: 'ph-magnifying-glass', color: 'text-green-500' },
        'formspree': { title: 'Formspree', text: 'Gestion fiable et instantanée des formulaires de contact. Réception des e-mails en temps réel avec protection anti-spam intégrée.', icon: 'ph-paper-plane-tilt', color: 'text-red-500' }
    };

    const aboutDescriptions = {
        'diplome': { title: "Ingénieur Diplômé CTI", text: "Ce n'est pas juste un titre. C'est la garantie d'une rigueur scientifique validée par l'État, d'une capacité d'analyse complexe et d'un travail structuré.", color: 'text-orange-400' },
        'expert': { title: "14 ans d'expérience", text: "J'ai vu le web évoluer. Cette séniorité me permet d'éviter les pièges techniques, de coder plus vite, et de livrer un produit fini robuste du premier coup.", color: 'text-pink-400' },
        'comptes': { title: "Grands Comptes (EDF / ELCA)", text: "3 ans chez EDF et 9 ans chez ELCA (Suisse). J'applique pour vous les standards de qualité exigés par ces grandes industries.", color: 'text-purple-400' },
        'partenaire': { title: "Partenaire de confiance", text: "'We make it work'. Je ne suis pas un simple exécutant. Je vous conseille, je propose, et je ne vous lâche pas tant que tout n'est pas parfait.", color: 'text-emerald-400' }
    };

    // Initialisation Tech (Premier item)
    setTimeout(() => {
        const firstTech = document.querySelector('[data-tech="html"]');
        if(firstTech) updateDescriptionBox('tech', firstTech, techDescriptions['html']);
    }, 1000);

    // Event Listeners Tech
    document.querySelectorAll('.tech-item').forEach(item => {
        item.addEventListener('click', () => {
            window.vibrate();
            const techKey = item.getAttribute('data-tech');
            updateDescriptionBox('tech', item, techDescriptions[techKey]);
        });
    });

    // Event Listeners About
    document.querySelectorAll('.about-badge').forEach(badge => {
        badge.addEventListener('click', () => {
            window.vibrate();
            const key = badge.getAttribute('data-about');
            updateDescriptionBox('about', badge, aboutDescriptions[key]);
        });
    });

    function updateDescriptionBox(type, element, data) {
        if(!data) return;

        // Reset Styles
        const selector = type === 'tech' ? '.tech-item' : '.about-badge';
        document.querySelectorAll(selector).forEach(el => {
            el.classList.remove('border-accent-400', 'bg-white/10');
            el.classList.add('border-white/5', 'bg-dark-900', 'bg-white/5');
        });
        
        // Active Style
        element.classList.remove('border-white/5', 'bg-dark-900');
        element.classList.add('border-accent-400', 'bg-white/10');

        const box = document.getElementById(`${type}-description-box`) || document.getElementById(`${type}-desc-box`);
        const title = document.getElementById(`${type}-title`);
        const text = document.getElementById(`${type}-text`);
        const icon = document.getElementById(`${type}-bg-icon`);

        if (box) {
            box.classList.remove('opacity-100', 'translate-y-0');
            box.classList.add('opacity-0', 'translate-y-4');
            setTimeout(() => {
                title.textContent = data.title;
                text.textContent = data.text;
                if(icon && data.icon) {
                    icon.className = `ph-duotone ${data.icon} text-6xl absolute top-4 right-4 opacity-10 transition-colors duration-300 ${data.color}`;
                }
                box.classList.remove('opacity-0', 'translate-y-4');
                box.classList.add('opacity-100', 'translate-y-0');
            }, 300);
        }
    }

    // Les apparitions au défilement sont gérées par assets/js/reveal.js
    // (module partagé avec la page Offre Club). On lui signale simplement
    // les blocs injectés dynamiquement, comme la grille des réalisations.

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ==============================================
    // 5. SELECTION OFFRES & CALCULATEUR (REFONDU)
    // ==============================================

    // Variables globales pour le calcul
	let currentBasePrice = 1790;
	let serenityTier = null; // null | 'simple' | 'plus'
	// serenityBillingCycle est déclaré tout en haut du fichier (voir commentaire là-bas)
	let isDocumentSelected = false;
	let requestType = 'newsite'; // 'newsite' | 'existing'
	let selectedIntervention = null; // { type, price } | null
	// Récapitulatif du formulaire : toujours exprimé en euros, et TOUJOURS
	// lu depuis le catalogue central (config.js). Aucun montant n'est figé
	// ici : modifier un prix dans config.js suffit à mettre à jour le site.
	const SERENITY_PRICES = {
		simple: CFG.offers.serenite.price.EUR,
		plus: CFG.offers.serenitePlus.price.EUR
	};
	const SERENITY_PRICES_ANNUAL = {
		simple: CFG.offers.serenite.annualPrice.EUR,
		plus: CFG.offers.serenitePlus.annualPrice.EUR
	};

	// Formatage court d'un montant en euros (49,90 € — 1 790 €).
	function eur(amount) {
		return new Intl.NumberFormat('fr-FR', {
			style: 'currency', currency: 'EUR',
			minimumFractionDigits: (Math.abs(amount % 1) > 0.001) ? 2 : 0,
			maximumFractionDigits: (Math.abs(amount % 1) > 0.001) ? 2 : 0
		}).format(amount);
	}

    // --- Fonctions exposées à window pour les onclick HTML ---

    // --- Sélection des Offres (Bi-directionnel & Premium Violet) ---
    window.selectOffer = function(btnElement, packName, price) {
        if(window.vibrate) window.vibrate(); 
        
        // 1. Cocher le radio bouton du formulaire (ce qui déclenchera updateCardSelection via onchange)
        const radioBtn = document.querySelector(`input[name="project_pack"][value="${packName}"]`);
        if (radioBtn) {
            radioBtn.checked = true;
            // On appelle manuellement updateCardSelection pour être sûr de l'UI immédiate
            updateCardSelection(packName, price);
        }
    }
    
    // Fonction Helper depuis la section Service pour activer l'option doc
    window.toggleDocumentOptionFromService = function() {
        window.vibrate();
        if(!isDocumentSelected) {
            window.toggleDocumentOption();
        }
        document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    }

    // --- CORRECTION BUG : GESTION CLIC CARTE DOCUMENT (FORMULAIRE & SYNC INVERSE) ---      
    window.handleDocClick = function(label, skipLogic = false) {
        // Petit délai pour laisser le temps à la checkbox native de changer d'état
        setTimeout(() => {
            const checkbox = label.querySelector('input[type="checkbox"]');
            const box = label.querySelector('.custom-checkbox-box');
            const icon = label.querySelector('.custom-checkbox-icon');
            const text = label.querySelector('.custom-checkbox-label');
            const overlay = label.querySelector('.selection-overlay');
            
            // 1. Mise à jour visuelle du FORMULAIRE
            if (checkbox.checked) {
                label.classList.remove('border-white/10', 'bg-dark-950');
                label.classList.add('border-emerald-500', 'bg-dark-900');
                box.classList.remove('border-slate-600', 'bg-dark-900');
                box.classList.add('border-emerald-500', 'bg-emerald-500');
                icon.classList.remove('opacity-0', 'scale-50');
                text.classList.add('text-white', 'font-bold');
                text.classList.remove('text-slate-300');
                overlay.classList.remove('opacity-0');
            } else {
                label.classList.add('border-white/10', 'bg-dark-950');
                label.classList.remove('border-emerald-500', 'bg-dark-900');
                box.classList.add('border-slate-600', 'bg-dark-900');
                box.classList.remove('border-emerald-500', 'bg-emerald-500');
                icon.classList.add('opacity-0', 'scale-50');
                text.classList.remove('text-white', 'font-bold');
                text.classList.add('text-slate-300');
                overlay.classList.add('opacity-0');
            }

            // 2. SYNC INVERSE : Mettre à jour la section SERVICES
            // On trouve la checkbox correspondante dans le bloc du haut
            const val = checkbox.value;
            const serviceChk = document.querySelector(`.service-doc-chk[value="${val}"]`);
            if (serviceChk) {
                // On synchronise l'état coché
                serviceChk.checked = checkbox.checked;
                
                // On met à jour le style visuel de la carte Service manuellement
                const sLabel = serviceChk.closest('label');
                const sBox = sLabel.querySelector('.custom-checkbox-box');
                const sIcon = sLabel.querySelector('.custom-checkbox-icon');
                const sText = sLabel.querySelector('.custom-checkbox-label');
                const sOverlay = sLabel.querySelector('.selection-overlay');

                if (checkbox.checked) {
                    sLabel.classList.remove('border-white/10', 'bg-dark-900');
                    sLabel.classList.add('border-emerald-500', 'bg-dark-950');
                    sBox.classList.remove('border-slate-600', 'bg-dark-950');
                    sBox.classList.add('border-emerald-500', 'bg-emerald-500');
                    sIcon.classList.remove('opacity-0', 'scale-50');
                    sText.classList.add('text-white');
                    sText.classList.remove('text-slate-300');
                    sOverlay.classList.remove('opacity-0');
                } else {
                    sLabel.classList.add('border-white/10', 'bg-dark-900');
                    sLabel.classList.remove('border-emerald-500', 'bg-dark-950');
                    sBox.classList.add('border-slate-600', 'bg-dark-950');
                    sBox.classList.remove('border-emerald-500', 'bg-emerald-500');
                    sIcon.classList.add('opacity-0', 'scale-50');
                    sText.classList.remove('text-white');
                    sText.classList.add('text-slate-300');
                    sOverlay.classList.add('opacity-0');
                }
                updateServicePrice(); // On recalcule le prix affiché en haut
            }

            if (!skipLogic) {
                updateTotal();
            }
        }, 20);
    }
    
    // Nouvelle fonction pour gérer l'affichage du champ "Autre" avec paramètre de focus optionnel
    window.toggleCustomDocInput = function(shouldFocus = true) {
        const checkbox = document.getElementById('check-custom-doc');
        const input = document.getElementById('custom-doc-input');
        
        setTimeout(() => {
             if (checkbox && input) {
                if (checkbox.checked) {
                    input.classList.remove('hidden');
                    setTimeout(() => {
                        input.classList.remove('opacity-0', 'translate-y-2');
                        // CORRECTION SCROLL : On ne focus que si demandé (depuis le formulaire direct)
                        if(shouldFocus) input.focus();
                    }, 10);
                } else {
                    input.classList.add('opacity-0', 'translate-y-2');
                    setTimeout(() => {
                        input.classList.add('hidden');
                        input.value = ''; 
                    }, 300);
                }
            }
            updateTotal();
        }, 20);
    }
    
    window.saveCustomDocName = function() {
        // Juste pour s'assurer que l'input reste accessible, pas de logique complexe ici
    }

    // --- Sérénité (Sélection à 3 états, mutuellement exclusif) ---
	window.toggleSerenityOption = function(tier) {
		window.toggleSerenityForm(tier);
	};

	// --- Facturation Sérénité : mensuel ou annuel (2 mois offerts) ---
	// locked=true : verrouille visuellement le choix sur 'annual' (cas Essentiel).
	window.setSerenityBillingCycle = function(cycle, locked) {
		if (cycle !== 'monthly' && cycle !== 'annual') return;
		serenityBillingCycle = cycle;

		document.querySelectorAll('.billing-cycle-pill').forEach(function (pill) {
			const isActive = pill.getAttribute('data-cycle') === cycle;
			pill.classList.toggle('active', isActive);
			pill.disabled = !!locked && pill.getAttribute('data-cycle') === 'monthly';
			pill.classList.toggle('opacity-40', pill.disabled);
			pill.classList.toggle('cursor-not-allowed', pill.disabled);
		});

		// Prix (EUR) affichés dans les boutons du formulaire — le devis/kickoff
		// reste toujours en EUR, indépendamment de la devise du header.
		const priceSimpleEl = document.getElementById('serenite-form-price');
		const pricePlusEl = document.getElementById('serenitePlus-form-price');
		if (cycle === 'annual') {
			if (priceSimpleEl) priceSimpleEl.textContent = eur(SERENITY_PRICES_ANNUAL.simple) + ' / an';
			if (pricePlusEl) pricePlusEl.textContent = eur(SERENITY_PRICES_ANNUAL.plus) + ' / an';
		} else {
			if (priceSimpleEl) priceSimpleEl.textContent = eur(SERENITY_PRICES.simple) + ' / mois';
			if (pricePlusEl) pricePlusEl.textContent = eur(SERENITY_PRICES.plus) + ' / mois';
		}

		renderSerenityCardPrices();
		updateTotal();
	};

	// Prix des cartes Sérénité / Sérénité+ dans la section Services,
	// selon la devise active (pill-menu du header) et le cycle choisi.
	function renderSerenityCardPrices() {
		var currency = getCurrentCurrency();

		// La pastille « Sérénité annuel inclus » de la carte Essentiel est rendue
		// par NM.i18n (data-offer-key="serenite-annual") : rien à faire ici.

		['serenite', 'serenitePlus'].forEach(function (key) {
			var offer = CFG.offers[key];
			if (!offer) return;
			var container = document.querySelector('[data-offer-key="' + key + '"]');
			var badge = document.getElementById(key === 'serenite' ? 'serenite-annual-badge' : 'serenitePlus-annual-badge');
			if (!container) return;

			var wrap = container.querySelector('.price-wrap');
			if (!wrap) {
				var existingAmount = container.querySelector('.price-amount');
				wrap = document.createElement('span');
				wrap.className = 'price-wrap';
				if (existingAmount) { existingAmount.replaceWith(wrap); } else { container.appendChild(wrap); }
			}

			if (serenityBillingCycle === 'annual' && offer.annualPrice && offer.annualPrice[currency] != null) {
				wrap.innerHTML = '<span class="price-amount">' + formatMoney(offer.annualPrice[currency], currency) + '</span>';
				var suffix = container.querySelector('.price-suffix');
				if (suffix) suffix.textContent = '/an';
				if (badge) badge.classList.remove('hidden');
			} else {
				wrap.innerHTML = '<span class="price-amount">' + formatMoney(offer.price[currency], currency) + '</span>';
				var suffix2 = container.querySelector('.price-suffix');
				if (suffix2) suffix2.textContent = '/mois';
				if (badge) badge.classList.add('hidden');
			}
		});
	}
	window.renderSerenityCardPrices = renderSerenityCardPrices;

	// Mise à jour visuelle des DEUX cartes dans la section Services
	window.updateSerenityCardInServices = function() {
		const cardSimple = document.getElementById('card-serenite');
		const cardPlus = document.getElementById('card-serenite-plus');
		const btnSimple = document.getElementById('btn-serenite-action');
		const btnPlus = document.getElementById('btn-serenite-plus-action');

		// Reset des deux
		[cardSimple, cardPlus].forEach(c => c?.classList.remove('serenity-selected-card'));
		if (btnSimple) {
			btnSimple.innerHTML = '<span>Ajouter au devis</span> <i class="ph-bold ph-plus"></i>';
			btnSimple.classList.remove('bg-blue-500', 'text-white', 'shadow-[0_0_20px_rgba(59,130,246,0.5)]', 'scale-105');
			btnSimple.classList.add('bg-blue-500/20', 'text-blue-300');
		}
		if (btnPlus) {
			btnPlus.innerHTML = '<span>Ajouter au devis</span> <i class="ph-bold ph-plus"></i>';
			btnPlus.classList.remove('bg-indigo-500', 'text-white', 'shadow-[0_0_20px_rgba(99,102,241,0.5)]', 'scale-105');
			btnPlus.classList.add('bg-indigo-500/20', 'text-indigo-300');
		}

		// Active le bon
		if (serenityTier === 'simple' && cardSimple && btnSimple) {
			cardSimple.classList.add('serenity-selected-card');
			btnSimple.innerHTML = '<span>Ajouté</span> <i class="ph-bold ph-check-circle text-lg animate-pop-in"></i>';
			btnSimple.classList.remove('bg-blue-500/20', 'text-blue-300');
			btnSimple.classList.add('bg-blue-500', 'text-white', 'shadow-[0_0_20px_rgba(59,130,246,0.5)]', 'scale-105');
		} else if (serenityTier === 'plus' && cardPlus && btnPlus) {
			cardPlus.classList.add('serenity-selected-card');
			btnPlus.innerHTML = '<span>Ajouté</span> <i class="ph-bold ph-check-circle text-lg animate-pop-in"></i>';
			btnPlus.classList.remove('bg-indigo-500/20', 'text-indigo-300');
			btnPlus.classList.add('bg-indigo-500', 'text-white', 'shadow-[0_0_20px_rgba(99,102,241,0.5)]', 'scale-105');
		}
	};

	// Mise à jour visuelle des DEUX boutons dans le formulaire
	window.updateSerenityFormButtons = function() {
		const btnSimple = document.getElementById('serenite-toggle-btn');
		const btnPlus = document.getElementById('serenite-plus-toggle-btn');
		btnSimple?.classList.remove('active');
		btnPlus?.classList.remove('active-plus');

		if (serenityTier === 'simple') btnSimple?.classList.add('active');
		if (serenityTier === 'plus') btnPlus?.classList.add('active-plus');
	};

	window.toggleSerenityForm = function(tier) {
		// Si "Essentiel" est sélectionné, Sérénité simple est le minimum forcé et inclus :
		// on ne peut pas le désélectionner complètement, mais on DOIT pouvoir basculer
		// librement entre "simple" et "plus" dans les deux sens (bug historique : un clic
		// sur "plus" bloquait tout retour vers "simple").
		const radioEssentiel = document.querySelector('input[name="project_pack"][value="Essentiel"]');
		const isForced = !!(radioEssentiel && radioEssentiel.checked);

		if (isForced && tier === 'simple' && serenityTier === 'simple') {
			// Déjà sur le minimum forcé : un reclic ne doit pas désélectionner.
			return;
		}

		window.vibrate();

		if (serenityTier === tier) {
			// Reclique sur l'option active -> on désélectionne (sauf si forcé par Essentiel)
			serenityTier = isForced ? 'simple' : null;
		} else {
			serenityTier = tier;
		}

		updateSerenityFormButtons();
		updateSerenityCardInServices();
		updateTotal();
	};

	// Mise à jour des cartes tarifaires (Essentiel / Vitrine / Premium)
	window.updateCardSelection = function(packName, price) {
		currentBasePrice = price;

		['Eclair', 'Essentiel', 'Vitrine', 'Premium'].forEach(pName => {
			let cardId = `card-${pName.toLowerCase()}`;
			let card = document.getElementById(cardId);
			if(card) {
				card.classList.remove('gold-selected-card');
				let btn = card.querySelector('.offer-btn');
				if(btn) {
                    // 1. Nettoyage complet des classes actives et inactives de tous les packs
					btn.classList.remove(
                        'bg-accent-400', 'text-dark-950', 'shadow-[0_0_20px_rgba(45,212,191,0.4)]', // Actif Vitrine/Essentiel
                        'bg-purple-500', 'text-white', 'shadow-[0_0_20px_rgba(168,85,247,0.4)]', // Actif Premium
                        'bg-amber-400', 'shadow-[0_0_20px_rgba(251,191,36,0.4)]', // Actif Eclair
                        'border-white/10', 'text-white', 'hover:bg-white', 'hover:text-dark-950', 'hover:bg-purple-400', // Inactifs Standards
                        'border-amber-400/30', 'text-amber-400', 'hover:bg-amber-400', 'hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]' // Inactif Eclair
                    );

                    // 2. Réapplication des styles INACTIFS selon le pack
					if(pName === 'Premium') {
                        btn.innerHTML = '<span>Choisir</span>';
						btn.classList.add('border-white/10', 'text-white', 'hover:bg-purple-400');
					} else if (pName === 'Eclair') {
                        btn.innerHTML = '<span>Choisir l\'Éclair</span> <i class="ph-bold ph-lightning"></i>';
                        btn.classList.add('border-amber-400/30', 'text-amber-400', 'hover:bg-amber-400', 'hover:text-dark-950', 'hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]');
                    } else {
                        btn.innerHTML = '<span>Choisir</span>';
						btn.classList.add('border-white/10', 'text-white', 'hover:bg-white', 'hover:text-dark-950');
					}
				}
			}
		});

        // 3. Application des styles ACTIFS au pack sélectionné
		let targetId = `card-${packName.toLowerCase()}`;
		const targetEl = document.getElementById(targetId);
		if(targetEl) {
			targetEl.classList.add('gold-selected-card');
			const targetBtn = targetEl.querySelector('.offer-btn');
			if(targetBtn) {
				targetBtn.innerHTML = '<span>Sélectionné</span> <i class="ph-bold ph-check animate-pop-in"></i>';
				
                // On retire les classes inactives qu'on vient d'ajouter lors de la boucle ci-dessus
                targetBtn.classList.remove('border-white/10', 'text-white', 'hover:bg-white', 'hover:text-dark-950', 'hover:bg-purple-400', 'border-amber-400/30', 'text-amber-400', 'hover:bg-amber-400', 'hover:shadow-[0_0_20px_rgba(251,191,36,0.3)]');

				if (packName === 'Premium') {
					targetBtn.classList.add('bg-purple-500', 'text-white', 'shadow-[0_0_20px_rgba(168,85,247,0.4)]');
				} else if (packName === 'Eclair') {
                    targetBtn.classList.add('bg-amber-400', 'text-dark-950', 'shadow-[0_0_20px_rgba(251,191,36,0.4)]');
                } else {
					targetBtn.classList.add('bg-accent-400', 'text-dark-950', 'shadow-[0_0_20px_rgba(45,212,191,0.4)]');
				}
			}
		}

		// Gestion Forçage Sérénité pour Essentiel
		if (packName === 'Essentiel') {
			forceSerenity(true);
		} else {
			forceSerenity(false);
		}

		updateTotal();
	};

	// Gestion de l'état "Forcé" du pack Sérénité (simple, jamais Plus, quand Essentiel est choisi)
	// Essentiel INCLUT obligatoirement Sérénité simple, facturée annuellement (2 mois offerts).
	function forceSerenity(forced) {
		const btnSimple = document.getElementById('serenite-toggle-btn');

		if (forced) {
			// Si Plus était choisi, on redescend sur Simple (Essentiel n'inclut que la base)
			serenityTier = 'simple';
			// Remarque : "Simple" reste cliquable (pas de cursor-not-allowed) — on peut
			// toujours basculer vers "Plus" puis revenir sur "Simple", seule la désélection
			// complète est bloquée (voir toggleSerenityForm).
			btnSimple?.classList.add('opacity-80');

			if (btnSimple && !document.getElementById('forced-msg')) {
				const msg = document.createElement('span');
				msg.id = 'forced-msg';
				msg.className = 'text-[9px] text-blue-300 absolute top-1 right-2 uppercase font-bold tracking-widest';
				msg.innerText = 'Engagement : 1 an';
				btnSimple.classList.add('relative');
				btnSimple.appendChild(msg);
			}

			// Essentiel impose la facturation annuelle (pas de mensuel possible)
			window.setSerenityBillingCycle('annual', true);
		} else {
			btnSimple?.classList.remove('opacity-80');
			const msg = document.getElementById('forced-msg');
			if(msg) msg.remove();

			// On repasse la facturation en libre choix (retour au mensuel par défaut)
			window.setSerenityBillingCycle('monthly', false);
		}

		updateSerenityFormButtons();
		updateSerenityCardInServices();
	}

	function updateTotal() {
		let totalOneShot = currentBasePrice;
		let docTotal = 0;

		if (isDocumentSelected) {
			const checkedDocs = document.querySelectorAll('.doc-sub-checkbox:checked');
			checkedDocs.forEach(cb => {
				const price = parseInt(cb.getAttribute('data-price')) || 0;
				docTotal += price;
			});
			totalOneShot += docTotal;
		}

		if (selectedIntervention) {
			totalOneShot += selectedIntervention.price;
		}

		const priceTag = document.getElementById('docs-price-tag');
		if(priceTag) {
			if(isDocumentSelected) {
				priceTag.textContent = `+${docTotal}€`;
				if(docTotal > 0) {
					priceTag.classList.remove('text-slate-500');
					priceTag.classList.add('text-emerald-400', 'bg-emerald-400/10');
				} else {
					priceTag.classList.add('text-slate-500');
					priceTag.classList.remove('text-emerald-400', 'bg-emerald-400/10');
				}
			} else {
				priceTag.textContent = '+0€';
				priceTag.classList.add('text-slate-500');
				priceTag.classList.remove('text-emerald-400', 'bg-emerald-400/10');
			}
		}

		const displayEl = document.getElementById('total-price-display');
		const labelEl = document.getElementById('total-label');
		const recurringChip = document.getElementById('total-recurring-chip');
		const recurringChipText = document.getElementById('total-recurring-chip-text');

		if(displayEl) {
			// Partie ponctuelle (une fois) et partie récurrente (mensuel/annuel) sont
			// maintenant deux blocs visuellement distincts (gros montant + puce à part),
			// plutôt qu'un seul texte fusionné — pour une hiérarchie plus claire.
			let text;
			if (totalOneShot > 0) {
				const prefix = (selectedIntervention && selectedIntervention.type === 'relifting') ? 'Dès ' : '';
				text = prefix + eur(totalOneShot);
			} else {
				text = '—';
			}
			displayEl.textContent = text;

			if (recurringChip && recurringChipText) {
				if (serenityTier) {
					const label = serenityTier === 'plus' ? 'Sérénité+' : 'Sérénité';
					const isEssentielBundle = requestType !== 'existing' && document.querySelector('input[name="project_pack"][value="Essentiel"]')?.checked;

					if (serenityBillingCycle === 'annual') {
						const annual = SERENITY_PRICES_ANNUAL[serenityTier];
						const bundleNote = isEssentielBundle ? `${label} incluse, payée avec le pack` : `${label}, -2 mois offerts`;
						recurringChipText.textContent = `${eur(annual)} / an · ${bundleNote}`;
					} else {
						const monthly = SERENITY_PRICES[serenityTier];
						recurringChipText.textContent = `${eur(monthly)} / mois · ${label}`;
					}
					recurringChip.classList.remove('hidden');
					recurringChip.classList.add('flex');
				} else {
					recurringChip.classList.add('hidden');
					recurringChip.classList.remove('flex');
					recurringChipText.textContent = '';
				}
			}
		}

		if(labelEl) {
			labelEl.innerHTML = requestType === 'existing'
				? 'Total Estimé <span class="text-[10px] font-normal lowercase">(Intervention / Abonnement)</span>'
				: 'Total Estimé <span class="text-[10px] font-normal lowercase">(Création)</span>';
		}
	}

    // Écouter les changements directs sur les radios (sécurité si l'utilisateur clique directement)
    document.querySelectorAll('input[name="project_pack"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
             window.vibrate();
             const val = e.target.value;
             const price = parseInt(e.target.getAttribute('data-price'));
             window.updateCardSelection(val, price);
        });
    });

    // --- GESTION IMAGES PREVIEW ---
    window.openImageModal = function(imageSrc) {
        const modal = document.getElementById('image-preview-modal');
        const img = document.getElementById('preview-img');
        if(modal && img) {
            img.src = imageSrc;
            modal.classList.add('active');
        }
    }

    window.closeImageModal = function() {
        const modal = document.getElementById('image-preview-modal');
        if(modal) modal.classList.remove('active');
    }

    // Init défaut
    // On simule une sélection Vitrine au chargement (prix lu dynamiquement, promo incluse)
    window.updateCardSelection('Vitrine', parseInt(document.getElementById('pack-vitrine')?.getAttribute('data-price')) || 1790);


    // ==============================================
    // 6. CALENDRIER DE PRISE DE RENDEZ-VOUS
    // ----------------------------------------------
    // La logique complète (jours ouverts, créneaux, vérification
    // des créneaux déjà réservés) vit dans assets/js/calendar.js,
    // partagée avec la page Offre Club pour éviter toute
    // divergence de disponibilités entre les deux formulaires.
    // ==============================================
    const dateInput = document.getElementById('selected-date');
    const timeInput = document.getElementById('selected-time');

    if (window.NM && NM.calendar) {
        NM.calendar.mount({
            daysEl: document.getElementById('calendar-days'),
            slotsEl: document.getElementById('calendar-slots'),
            dateInput: dateInput,
            timeInput: timeInput,
            prevBtn: document.getElementById('prev-week'),
            nextBtn: document.getElementById('next-week')
        });
    }

    // Affiche un message d'erreur inline (bannière) au lieu d'un popup alert()
    let bookingErrorTimeout = null;
    function showBookingError(message) {
        const banner = document.getElementById('booking-error-banner');
        const text = document.getElementById('booking-error-text');
        if (!banner || !text) {
            console.error(message);
            return;
        }
        text.textContent = message;
        banner.classList.remove('hidden');
        banner.classList.add('flex');
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });

        clearTimeout(bookingErrorTimeout);
        bookingErrorTimeout = setTimeout(() => {
            banner.classList.add('hidden');
            banner.classList.remove('flex');
        }, 6000);
    }

    // FORM SUBMIT
    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (window.vibrate) window.vibrate(); // Petite sécurité si la fonction n'existe pas

            const submitBtn = document.getElementById('submit-booking');
            const originalText = submitBtn.innerHTML;

            const dateInput = document.getElementById('selected-date');
            const timeInput = document.getElementById('selected-time');

            if (!dateInput.value || !timeInput.value) {
                showBookingError("Veuillez sélectionner une date et une heure.");
                return;
            }

			if (requestType === 'existing' && !serenityTier && !selectedIntervention) {
				showBookingError("Merci de choisir une intervention ponctuelle et/ou une formule Sérénité pour votre site existant.");
				return;
			}

            // Récupération des données du formulaire
			const packRadio = document.querySelector('input[name="project_pack"]:checked');
			const selectedPack = requestType === 'existing' ? 'Site existant (Sérénité seul)' : (packRadio ? packRadio.value : '');
			const hasSerenity = serenityTier !== null;
            const desc = document.getElementById('client-desc').value;
            const total = document.getElementById('total-price-display').textContent;

            const name = document.getElementById('client-lastname').value;
            const firstname = document.getElementById('client-firstname').value;
            const email = document.getElementById('client-email').value;

            // --- NOUVELLE LOGIQUE DOCUMENTS ---
            const isDocActive = document.getElementById('check-documents')?.checked || false;
            let selectedDocumentsList = [];

            if (isDocActive) {
                // On récupère toutes les sous-cases cochées
                const checkboxes = document.querySelectorAll('.doc-sub-checkbox:checked');
                checkboxes.forEach(cb => {
                    if (cb.value === 'Autre') {
                        // Si c'est "Autre", on prend le texte de l'input
                        const customVal = document.getElementById('custom-doc-input').value.trim();
                        selectedDocumentsList.push(`Autre : ${customVal || 'Non précisé'}`);
                    } else {
                        selectedDocumentsList.push(cb.value);
                    }
                });
            }
            // ----------------------------------

            // Calcul de l'heure de fin (+30 minutes)
            const [hours, minutes] = timeInput.value.split(':').map(Number);
            const dateObj = new Date();
            dateObj.setHours(hours, minutes);
            dateObj.setMinutes(dateObj.getMinutes() + 30);

            const endH = String(dateObj.getHours()).padStart(2, '0');
            const endM = String(dateObj.getMinutes()).padStart(2, '0');
            const calculatedEndTime = `${endH}:${endM}`;

            // Date formatée en toutes lettres (ex: "lundi 26 janvier") — calculée AVANT l'envoi
            // pour être disponible dans rdv_label ci-dessous (elle était calculée trop tard,
            // ce qui provoquait un ReferenceError et faisait échouer toute la réservation).
            const dateObjFormatted = new Date(dateInput.value);
            const dateStr = dateObjFormatted.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-xl"></i> Envoi...';

                // Payload complet de la demande de RDV — envoyé à la fois vers Firebase
                // (trace interne) et vers submitForm() (webhook Zapier -> email de
                // confirmation), pour que le mail parte bien sur ce tunnel aussi.
                // Payload aligné sur les colonnes de la table nm_leads
                // (voir migration nm_portfolio_core_schema). Il alimente à la
                // fois l'espace d'administration et l'e-mail de confirmation.
                const numericTotal = Number(String(total).replace(/[^0-9,.-]/g, '').replace(/\s/g, '').replace(',', '.')) || null;
                const packRadioForPrice = document.querySelector('input[name="project_pack"]:checked');
                const packPrice = (requestType === 'existing' || !packRadioForPrice)
                    ? null
                    : parseFloat(packRadioForPrice.getAttribute('data-price')) || null;

                const bookingPayload = {
                    source: 'portfolio',
                    request_type: requestType,                 // 'newsite' | 'existing'
                    first_name: firstname,
                    last_name: name,
                    email: email,
                    phone: document.getElementById('client-phone').value,
                    rdv_date: dateInput.value,
                    rdv_time: timeInput.value,
                    rdv_label: `${dateStr} à ${timeInput.value}`,
                    pack: requestType === 'existing' ? 'existing' : (packRadioForPrice ? packRadioForPrice.value.toLowerCase() : null),
                    pack_label: selectedPack,
                    pack_price: packPrice,
                    currency: 'EUR',
                    serenity_tier: serenityTier,               // null | 'simple' | 'plus'
                    serenity_cycle: hasSerenity ? serenityBillingCycle : null,
                    documents: selectedDocumentsList,          // ex : ["Devis", "Autre : Attestation"]
                    intervention_type: selectedIntervention ? selectedIntervention.type : null,
                    intervention_price: selectedIntervention ? selectedIntervention.price : null,
                    estimated_total: numericTotal,
                    message: desc,
                    status: 'nouveau'
                };

                // submitForm() enregistre la demande dans Supabase ET déclenche
                // l'e-mail de confirmation via le webhook Zapier. Best-effort :
                // un échec ne doit jamais bloquer la confirmation à l'écran.
                let savedLeadId = null;
                try {
                    savedLeadId = await window.submitForm(bookingPayload);
                } catch (e) {
                    console.error('submitForm (RDV découverte) a échoué (non bloquant) :', e);
                }

                // Configuration Message Succès (AVEC REDIRECTION KICKOFF)
                document.getElementById('success-message-date').textContent = `Le ${dateStr} à ${timeInput.value}`;

                const kickoffBtn = document.querySelector('#booking-success a[href*="kickoff"]');
                if (kickoffBtn) {
                    // Conversion du tableau de documents en une chaîne séparée par des virgules
                    const docsStr = (typeof selectedDocumentsList !== 'undefined' && selectedDocumentsList) 
                        ? selectedDocumentsList.join(',') 
                        : '';

                    // -----------------------------------------------------------
                    // MODIFICATION ICI : AU LIEU DE PARAMS URL -> LOCALSTORAGE
                    // -----------------------------------------------------------
                    const kickoffData = {
						pack: selectedPack,
						name: `${firstname} ${name}`,
						email: email,
						date: dateStr + ' à ' + timeInput.value,
						documents: docsStr,
						// Nouveaux champs pour gérer "J'ai déjà un site" et les interventions
						requestType: requestType,
						intervention: selectedIntervention ? selectedIntervention.type : null,
						serenite: serenityTier,
						sereniteCycle: serenityTier ? serenityBillingCycle : null,
						// Permet de rattacher le brief à la demande enregistrée
						// (et donc de pré-remplir le devis côté administration).
						leadId: savedLeadId,
						phone: document.getElementById('client-phone').value,
						estimatedTotal: numericTotal,
						source: 'portfolio'
					};
                    
                    // Sauvegarde dans le stockage local du navigateur
                    localStorage.setItem('kickoffData', JSON.stringify(kickoffData));

                    // URL propre
                    kickoffBtn.href = 'kickoff/';
                    // -----------------------------------------------------------
                }

                // Affichage Overlay
                document.getElementById('booking-success').classList.remove('hidden');
                document.getElementById('booking-success').classList.add('flex');

                // Défilement doux vers le message de confirmation : sur desktop, le
                // formulaire est haut et le message (centré sur toute sa hauteur) pouvait
                // rester masqué au-dessus ou au milieu de l'écran une fois validé.
                // On cible le contenu du message (pas l'overlay plein écran) pour un
                // centrage fiable quelle que soit la hauteur du formulaire.
                const successContent = document.getElementById('booking-success-content');
                if (successContent) {
                    requestAnimationFrame(() => {
                        successContent.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    });
                }

            } catch (error) {
                console.error("Booking error:", error);
                showBookingError("Une erreur est survenue lors de la réservation. Merci de réessayer.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
    
    // ==============================================
    // (Le bloc « paiement direct par carte » a été supprimé :
    //  le site ne propose plus aucun paiement en ligne. Le
    //  règlement se fait sur facture, envoyée depuis l'espace
    //  d'administration une fois la prestation livrée.)
    // ==============================================

    // ==============================================
    // GESTION ACCORDÉON HÉBERGEMENT
    // ==============================================
    window.toggleHosting = function(forceOpen = false) {
        window.vibrate();
        const content = document.getElementById('hosting-content');
        const chevron = document.getElementById('hosting-chevron');
        const section = document.getElementById('hosting-section');

        if (!content || !chevron) return;

        const open = () => {
            content.classList.add('open');
            chevron.classList.add('rotate-chevron');
        };

        const close = () => {
            content.classList.remove('open');
            chevron.classList.remove('rotate-chevron');
        };

        if (forceOpen) {
            open();
            if(section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            if (content.classList.contains('open')) {
                close();
            } else {
                open();
            }
        }
    };
    
    // --- GESTION FAQ ---
    window.toggleFaq = function(button) {
        // 1. Gestion de l'icone
        const icon = button.querySelector('i');
        
        // 2. Gestion du contenu
        const content = button.nextElementSibling;
        
        // Si c'est déjà ouvert, on ferme
        if (content.style.maxHeight && content.style.maxHeight !== '0px') {
            content.style.maxHeight = '0px';
            icon.style.transform = 'rotate(0deg)';
            button.classList.remove('active-faq'); // Optionnel pour le style
        } else {
            // OPTIONNEL : Fermer les autres quand on en ouvre un (effet accordéon strict)
            /* document.querySelectorAll('#faq .max-h-0').forEach(el => {
                el.style.maxHeight = '0px';
                el.previousElementSibling.querySelector('i').style.transform = 'rotate(0deg)';
            });
            */

            // On ouvre celui-ci
            content.style.maxHeight = content.scrollHeight + "px";
            icon.style.transform = 'rotate(180deg)';
            button.classList.add('active-faq');
        }
    };
    
    // ==============================================
    // GESTION MENU MOBILE (MANQUANT)
    // ==============================================
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            window.vibrate(); // Petit retour haptique
            
            // Bascule l'affichage du menu (enlève/ajoute la translation)
            mobileMenu.classList.toggle('translate-x-full');
            
            // Change l'icône (List <-> X)
            const icon = mobileMenuBtn.querySelector('i');
            if (mobileMenu.classList.contains('translate-x-full')) {
                icon.classList.remove('ph-x');
                icon.classList.add('ph-list');
                document.body.style.overflow = ''; // Réactive le scroll
            } else {
                icon.classList.remove('ph-list');
                icon.classList.add('ph-x');
                document.body.style.overflow = 'hidden'; // Bloque le scroll arrière-plan
            }
        });

        // Ferme le menu quand on clique sur un lien
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('translate-x-full');
                const icon = mobileMenuBtn.querySelector('i');
                icon.classList.remove('ph-x');
                icon.classList.add('ph-list');
                document.body.style.overflow = '';
            });
        });
    }
    
    // --- GESTION SERVICES (Style & Logique) ---

    // 1. Gestion du clic sur les cartes dans la section SERVICE (similaire au formulaire)
    window.handleServiceDocClick = function(label) {
        // Délai pour laisser le temps au clic de se propager à la checkbox
        setTimeout(() => {
            const checkbox = label.querySelector('input[type="checkbox"]');
            const box = label.querySelector('.custom-checkbox-box');
            const icon = label.querySelector('.custom-checkbox-icon');
            const text = label.querySelector('.custom-checkbox-label');
            const overlay = label.querySelector('.selection-overlay');
            
            if (checkbox.checked) {
                // STYLE ACTIF (Service)
                label.classList.remove('border-white/10', 'bg-dark-900');
                label.classList.add('border-emerald-500', 'bg-dark-950'); // Inversement léger des couleurs vs formulaire pour contraste
                
                box.classList.remove('border-slate-600', 'bg-dark-950');
                box.classList.add('border-emerald-500', 'bg-emerald-500');
                
                icon.classList.remove('opacity-0', 'scale-50');
                text.classList.add('text-white');
                text.classList.remove('text-slate-300');
                overlay.classList.remove('opacity-0');
            } else {
                // STYLE INACTIF
                label.classList.add('border-white/10', 'bg-dark-900');
                label.classList.remove('border-emerald-500', 'bg-dark-950');
                
                box.classList.add('border-slate-600', 'bg-dark-950');
                box.classList.remove('border-emerald-500', 'bg-emerald-500');
                
                icon.classList.add('opacity-0', 'scale-50');
                text.classList.remove('text-white');
                text.classList.add('text-slate-300');
                overlay.classList.add('opacity-0');
            }
            updateServicePrice(); // Calcul du prix local (Services)
        }, 20);
    }

    // 2. Ouvre le mode configuration (Services)
    window.toggleServiceConfig = function() {
        const selector = document.getElementById('service-doc-selector');
        const btnConfig = document.getElementById('btn-config-doc');
        const btnValidate = document.getElementById('btn-validate-doc');
        
        if (selector.classList.contains('hidden')) {
            selector.classList.remove('hidden');
            btnConfig.classList.add('hidden');
            btnValidate.classList.remove('hidden');
            btnValidate.classList.add('flex');
            
            // CORRECTION: Au lieu de reset, on synchronise AVEC le formulaire
            // On regarde ce qui est coché en bas pour l'afficher coché en haut
            const formCheckboxes = document.querySelectorAll('.doc-sub-checkbox:checked');
            
            // D'abord on reset visuellement tout en haut
            document.querySelectorAll('.service-doc-chk').forEach(c => {
                 c.checked = false;
                 handleServiceDocClick(c.closest('label'), true); // true = skip total calculation update temporarily
            });

            // Ensuite on coche ce qui doit l'être
            formCheckboxes.forEach(fc => {
                const val = fc.value;
                const serviceChk = document.querySelector(`.service-doc-chk[value="${val}"]`);
                if(serviceChk) {
                    serviceChk.checked = true;
                    handleServiceDocClick(serviceChk.closest('label'), true);
                }
            });

            updateServicePrice(); 
        }
    }

    // 3. Prix affiché au-dessus du sélecteur « Documents & Automatisation ».
    //    Le montant de repli vient du catalogue (config.js) : aucun tarif
    //    n'est écrit en dur ici.
    window.updateServicePrice = function() {
        let total = 0;
        const checked = document.querySelectorAll('.service-doc-chk:checked');
        checked.forEach(chk => { total += parseInt(chk.getAttribute('data-price'), 10) || 0; });

        const display = document.getElementById('service-price-display');
        const label = document.getElementById('service-price-label');
        if (!display || !label) return;

        // Tarif d'entrée = option de document la moins chère du catalogue.
        const cheapest = (CFG.documentOptions || [])
            .reduce((min, o) => Math.min(min, o.priceEur), Infinity);
        const baseEur = isFinite(cheapest) ? cheapest : 100;

        if (total > 0) {
            display.removeAttribute('data-price-eur');
            display.textContent = formatMoney(NM.i18n.convert(total), getCurrentCurrency());
            label.textContent = "pour la sélection (" + checked.length +
                (checked.length > 1 ? " documents)" : " document)");
            label.classList.add('text-emerald-400');
        } else {
            display.setAttribute('data-price-eur', String(baseEur));
            display.textContent = formatMoney(NM.i18n.convert(baseEur), getCurrentCurrency());
            label.textContent = "par type de document";
            label.classList.remove('text-emerald-400');
        }
    }

    // 4. Validation et Transfert (Animation améliorée + Correction Scroll)
    window.validateServiceDocs = function() {
        const checked = document.querySelectorAll('.service-doc-chk:checked');
        if(checked.length === 0) return; 

        // A. Activer le module Document dans le formulaire s'il ne l'est pas
        if (!isDocumentSelected) {
             window.toggleDocumentOption();
        }

        // B. Reset du formulaire documents
        document.querySelectorAll('.doc-sub-checkbox').forEach(cb => {
            if(cb.checked) {
                cb.checked = false; 
                handleDocClick(cb.closest('label'), true);
            }
        });

        // C. Transférer la sélection
        checked.forEach(sChk => {
            const val = sChk.value;
            const formChk = document.querySelector(`.doc-sub-checkbox[value="${val}"]`);
            if (formChk) {
                formChk.checked = true;
                handleDocClick(formChk.closest('label'), false);
                
                // Cas spécial "Autre" : ouvrir l'input MAIS SANS FOCUS (false) pour éviter le scroll
                if(val === 'Autre') {
                    window.toggleCustomDocInput(false);
                }
            }
        });

        // D. Animation Bouton "Valider" (Plus propre)
        const btn = document.getElementById('btn-validate-doc');
        const textSpan = document.getElementById('btn-validate-text');
        const originalContent = textSpan.innerHTML;
        
        // Changement d'état
        btn.classList.remove('bg-accent-400', 'text-dark-950');
        btn.classList.add('bg-emerald-500', 'text-white', 'scale-105'); // Vert Succès + Pop
        textSpan.innerHTML = 'Sélection ajoutée ! <i class="ph-bold ph-check text-lg"></i>';

        // Retour à la normale
        setTimeout(() => {
            btn.classList.remove('bg-emerald-500', 'text-white', 'scale-105');
            btn.classList.add('bg-accent-400', 'text-dark-950');
            textSpan.innerHTML = originalContent;
        }, 2000);
    }
    
    // --- GESTION FORMULAIRE (Toggle Bloc Détails) ---

    window.toggleDocumentOption = function() {
        window.vibrate();
        const checkbox = document.getElementById('check-documents');
        const fakeCheckbox = document.getElementById('doc-fake-checkbox');
        const icon = document.getElementById('doc-check-icon');
        const btn = document.getElementById('document-toggle-btn');
        
        // Le bloc détails
        const listContainer = document.getElementById('documents-details-list');
        const priceTag = document.getElementById('docs-price-tag');

        isDocumentSelected = !isDocumentSelected;
        if(checkbox) checkbox.checked = isDocumentSelected;

        if (isDocumentSelected) {
            // Style actif (bouton principal)
            icon?.classList.remove('opacity-0', 'scale-50');
            fakeCheckbox?.classList.add('bg-emerald-500/20', 'border-emerald-500');
            btn?.classList.add('bg-emerald-500/10', 'border-emerald-500/30');
            priceTag?.classList.remove('opacity-50');
            
            // Ouvrir la liste (Animation CSS)
            listContainer?.classList.remove('hidden');
            setTimeout(() => {
                listContainer?.classList.remove('opacity-0', 'scale-y-95');
            }, 10);

        } else {
            // Style inactif
            icon?.classList.add('opacity-0', 'scale-50');
            fakeCheckbox?.classList.remove('bg-emerald-500/20', 'border-emerald-500');
            btn?.classList.remove('bg-emerald-500/10', 'border-emerald-500/30');
            priceTag?.classList.add('opacity-50');

            // Fermer la liste
            listContainer?.classList.add('opacity-0', 'scale-y-95');
            setTimeout(() => {
                listContainer?.classList.add('hidden');
                
                // Optionnel : Reset des choix quand on ferme le module
                document.querySelectorAll('.doc-sub-checkbox').forEach(cb => {
                    if(cb.checked) {
                        cb.checked = false;
                        handleDocClick(cb.closest('label'), true);
                    }
                });
                updateTotal();
            }, 500); // Correspond à duration-500
        }
        updateTotal();
    }
	
	window.setRequestType = function(type) {
		window.vibrate();
		requestType = type;

		const btnNew = document.getElementById('request-type-newsite');
		const btnExisting = document.getElementById('request-type-existing');
		const packBlock = document.getElementById('pack-selection-block');
		const interventionBlock = document.getElementById('intervention-selection-block');

		btnNew?.classList.remove('active-request-type');
		btnExisting?.classList.remove('active-request-type');

		if (type === 'existing') {
			btnExisting?.classList.add('active-request-type');
			packBlock?.classList.add('hidden');
			interventionBlock?.classList.remove('hidden');

			document.querySelectorAll('input[name="project_pack"]').forEach(r => r.checked = false);
			currentBasePrice = 0;
			forceSerenity(false);

		} else {
			btnNew?.classList.add('active-request-type');
			packBlock?.classList.remove('hidden');
			interventionBlock?.classList.add('hidden');

			// On retire l'intervention ponctuelle si on repart sur une création
			selectedIntervention = null;
			document.querySelectorAll('.intervention-btn').forEach(b => b.classList.remove('active-intervention'));

			const checkedRadio = document.querySelector('input[name="project_pack"]:checked');
			if (checkedRadio) {
				currentBasePrice = parseInt(checkedRadio.getAttribute('data-price'));
				window.updateCardSelection(checkedRadio.value, currentBasePrice);
			} else {
				document.getElementById('pack-vitrine').checked = true;
				const vitrinePrice = parseInt(document.getElementById('pack-vitrine')?.getAttribute('data-price')) || 1790;
				currentBasePrice = vitrinePrice;
				window.updateCardSelection('Vitrine', vitrinePrice);
			}
		}

		updateTotal();
	};
	
	window.selectIntervention = function(btnElement) {
		window.vibrate();
		const type = btnElement.getAttribute('data-type');
		const price = parseInt(btnElement.getAttribute('data-price'));

		const isAlreadyActive = selectedIntervention && selectedIntervention.type === type;

		document.querySelectorAll('.intervention-btn').forEach(b => b.classList.remove('active-intervention'));

		if (isAlreadyActive) {
			selectedIntervention = null;
		} else {
			selectedIntervention = { type, price };
			btnElement.classList.add('active-intervention');
		}

		updateTotal();
	};
	
	// SECTION FACILITATEUR NUMÉRIQUE - CLIC A DOMICILE// Synchronise le téléphone du flyer avec celui affiché sur le site
	const sitePhone = "06 25 96 51 12"; // ← change ici une seule fois
	document.querySelectorAll('[href^="tel:"]').forEach(el => el.href = `tel:${sitePhone.replace(/\s/g,'')}`);
	document.querySelectorAll('[href^="tel:"], .site-phone').forEach(el => { if(el.textContent.includes('06')) el.textContent = sitePhone; });
	const flyerPhone = document.getElementById('flyer-phone');
	if(flyerPhone) flyerPhone.textContent = sitePhone;
});