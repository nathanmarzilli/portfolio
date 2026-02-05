// ============================================================
// IMPORTS FIREBASE
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD6Q-HVto8eybwGo9YgcFx4hu7rWBLNYfg",
    authDomain: "portfolio-nathan-e148f.firebaseapp.com",
    projectId: "portfolio-nathan-e148f",
    storageBucket: "portfolio-nathan-e148f.firebasestorage.app",
    messagingSenderId: "61408006418",
    appId: "1:61408006418:web:8a448e8ca60ec77bf523cb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {

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
    // 3. AUTH & ADMIN
    // ==============================================
    const adminModal = document.getElementById('admin-modal');
    const adminContent = document.getElementById('admin-content');
    const loginView = document.getElementById('admin-login-view');
    const dashboardView = document.getElementById('admin-dashboard-view');
    const actionsGrid = document.getElementById('admin-actions-grid');
    const loginError = document.getElementById('login-error');
    const shieldIcon = document.getElementById('header-shield-icon');

    onAuthStateChanged(auth, (user) => {
        if (user && shieldIcon) {
            shieldIcon.classList.remove('text-slate-600');
            shieldIcon.classList.add('text-green-400');
            // Admin doit pulser
            shieldIcon.parentElement.classList.add('animate-pulse-slow');
        } else if(shieldIcon) {
            shieldIcon.classList.add('text-slate-600');
            shieldIcon.classList.remove('text-green-400');
            shieldIcon.parentElement.classList.remove('animate-pulse-slow');
        }
    });

    window.toggleAdminModal = function() {
        window.vibrate(); // Haptic
        if (adminModal.classList.contains('hidden')) {
            adminModal.classList.remove('hidden');
            setTimeout(() => {
                adminModal.classList.remove('opacity-0');
                adminContent.classList.remove('scale-95');
                adminContent.classList.add('scale-100');
            }, 10);
            if(auth.currentUser) showDashboard();
            else showLogin();
        } else {
            adminModal.classList.add('opacity-0');
            adminContent.classList.remove('scale-100');
            adminContent.classList.add('scale-95');
            setTimeout(() => {
                adminModal.classList.add('hidden');
                resetAdminForm();
            }, 300);
        }
    };

    window.togglePasswordVisibility = function() {
        const passInput = document.getElementById('admin-pass');
        const eyeIcon = document.getElementById('eye-icon');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeIcon.classList.replace('ph-eye', 'ph-eye-slash');
            eyeIcon.parentElement.classList.add('text-white');
        } else {
            passInput.type = 'password';
            eyeIcon.classList.replace('ph-eye-slash', 'ph-eye');
            eyeIcon.parentElement.classList.remove('text-white');
        }
    };

    function resetAdminForm() {
        document.getElementById('admin-id').value = '';
        document.getElementById('admin-pass').value = '';
        loginError.classList.add('hidden');
    }

    function showLogin() {
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
    }

    function showDashboard() {
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        renderAdminButtons();
    }

    window.attemptLogin = function() {
        window.vibrate(); // Haptic
        const idInput = document.getElementById('admin-id').value.trim();
        const passInput = document.getElementById('admin-pass').value.trim();
        const emailToUse = idInput.includes('@') ? idInput : idInput + '@gmail.com';

        signInWithEmailAndPassword(auth, emailToUse, passInput)
            .then(() => {
                loginError.classList.add('hidden');
                showDashboard();
            })
            .catch((error) => {
                loginError.classList.remove('hidden');
                adminContent.classList.add('animate-pulse');
                setTimeout(() => adminContent.classList.remove('animate-pulse'), 500);
            });
    };

    window.logout = function() {
        window.vibrate();
        signOut(auth).then(() => showLogin()).catch((error) => console.error(error));
    };

    const adminActions = [
        { label: "Créer Devis / Facture", icon: "ph-file-text", color: "text-blue-400", link: "/portfolio/contrat/devis&contrat/" },
        { label: "Quittance de Loyer", icon: "ph-house-line", color: "text-green-400", link: "/portfolio/contrat/quittance/" },
        { label: "Bail Location Meublée", icon: "ph-key", color: "text-purple-400", link: "/portfolio/contrat/bail/" },
        { label: "Prospecter", icon: "ph-target", color: "text-pink-400", link: "/portfolio/prospect/" }
    ];

    function renderAdminButtons() {
        if(actionsGrid) {
            let html = adminActions.map(action => `
                <a href="${action.link}" target="_blank" class="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent-400 transition-all group">
                    <div class="w-10 h-10 rounded-full bg-dark-950 flex items-center justify-center border border-white/10 group-hover:border-${action.color.split('-')[1]}-400 transition-colors">
                        <i class="ph-bold ${action.icon} ${action.color} text-xl"></i>
                    </div>
                    <span class="font-bold text-slate-200 group-hover:text-white transition-colors">${action.label}</span>
                    <i class="ph-bold ph-arrow-right ml-auto text-slate-500 group-hover:text-accent-400 transition-colors"></i>
                </a>
            `).join('');
            html += `
                <button onclick="window.logout()" class="w-full mt-4 py-3 rounded-xl border border-white/10 text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-white/5 hover:text-white transition-all">
                    Se déconnecter
                </button>
            `;
            actionsGrid.innerHTML = html;
        }
    }

    const passField = document.getElementById('admin-pass');
    if(passField) {
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
        'firebase': { title: 'Google Firebase', text: 'Base de données temps réel et authentification sécurisée par Google. Performance et fiabilité industrielle.', icon: 'ph-fire', color: 'text-orange-400' },
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

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ==============================================
    // 5. SELECTION OFFRES & CALCULATEUR (REFONDU)
    // ==============================================

    // Variables globales pour le calcul
    let currentBasePrice = 1790;
    let isSerenitySelected = false;
    let isDocumentSelected = false;
    const SERENITY_MONTHLY = 49.90;
    const DOC_PRICE = 250;

    // --- Fonctions exposées à window pour les onclick HTML ---

    window.selectOffer = function(packName, price) {
        window.vibrate(); 
        const radioBtn = document.querySelector(`input[name="project_pack"][value="${packName}"]`);
        if (radioBtn) {
            radioBtn.checked = true;
            updateCardSelection(packName, price);
        }
        
        // Scroll doux vers le formulaire avec délai pour effet visuel
        setTimeout(() => {
            document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
    
    // Fonction Helper depuis la section Service pour activer l'option doc
    window.toggleDocumentOptionFromService = function() {
        window.vibrate();
        if(!isDocumentSelected) {
            window.toggleDocumentOption();
        }
        document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    }

    window.toggleDocumentOption = function() {
        window.vibrate();
        const checkbox = document.getElementById('check-documents');
        const fakeCheckbox = document.getElementById('doc-fake-checkbox');
        const icon = document.getElementById('doc-check-icon');
        const btn = document.getElementById('document-toggle-btn');

        isDocumentSelected = !isDocumentSelected;
        if(checkbox) checkbox.checked = isDocumentSelected;

        if (isDocumentSelected) {
            icon?.classList.remove('opacity-0', 'scale-50');
            fakeCheckbox?.classList.add('bg-emerald-500/20', 'border-emerald-500');
            btn?.classList.add('bg-emerald-500/10', 'border-emerald-500/30');
        } else {
            icon?.classList.add('opacity-0', 'scale-50');
            fakeCheckbox?.classList.remove('bg-emerald-500/20', 'border-emerald-500');
            btn?.classList.remove('bg-emerald-500/10', 'border-emerald-500/30');
        }
        updateTotal();
    }

    // Toggle Sérénité (Depuis le bouton du haut ou du bas)
    window.toggleSerenityOption = function() {
        if (!isSerenitySelected) {
            window.toggleSerenityForm();
        }
        document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    }

    window.toggleSerenityForm = function() {
        // Si "Essentiel" est sélectionné, on empêche de décocher
        const radioEssentiel = document.querySelector('input[name="project_pack"][value="Essentiel"]');
        if (radioEssentiel && radioEssentiel.checked) return;

        window.vibrate();
        const checkbox = document.getElementById('check-serenite');
        const fakeCheckbox = document.getElementById('serenite-fake-checkbox');
        const icon = document.getElementById('serenite-check-icon');
        const btn = document.getElementById('serenite-toggle-btn');

        isSerenitySelected = !isSerenitySelected;
        if(checkbox) checkbox.checked = isSerenitySelected;

        if (isSerenitySelected) {
            icon?.classList.remove('opacity-0', 'scale-50');
            fakeCheckbox?.classList.add('bg-blue-500/20', 'border-blue-500');
            btn?.classList.add('active');
            updateSerenityCardInServices(true);
        } else {
            icon?.classList.add('opacity-0', 'scale-50');
            fakeCheckbox?.classList.remove('bg-blue-500/20', 'border-blue-500');
            btn?.classList.remove('active');
            updateSerenityCardInServices(false);
        }
        updateTotal();
    }

    // Mise à jour visuelle des cartes (contour doré)
    window.updateCardSelection = function(packName, price) {
        currentBasePrice = price;

        // Reset classes
        ['card-essentiel', 'card-vitrine', 'card-premium'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.remove('gold-selected-card');
        });

        // Add class
        let targetId = '';
        if(packName === 'Essentiel') targetId = 'card-essentiel';
        if(packName === 'Vitrine') targetId = 'card-vitrine';
        if(packName === 'Premium') targetId = 'card-premium';

        const targetEl = document.getElementById(targetId);
        if(targetEl) targetEl.classList.add('gold-selected-card');
        
        // Gestion Forçage Sérénité pour Essentiel
        if (packName === 'Essentiel') {
            forceSerenity(true);
        } else {
            forceSerenity(false);
        }

        updateTotal();
    }

    // Gestion de l'état "Forcé" du pack Sérénité
    function forceSerenity(forced) {
        const btn = document.getElementById('serenite-toggle-btn');
        const checkbox = document.getElementById('check-serenite');
        const fakeCheckbox = document.getElementById('serenite-fake-checkbox');
        const icon = document.getElementById('serenite-check-icon');
        
        if (forced) {
            isSerenitySelected = true;
            if(checkbox) checkbox.checked = true;
            
            // Style visuel "Forcé/Verrouillé"
            btn?.classList.add('active', 'opacity-80', 'cursor-not-allowed');
            // On désactive le clic en enlevant l'event listener via HTML onclick check
            // (La fonction toggleSerenityForm a aussi un check de sécurité)
            
            // Icone Checked
            icon?.classList.remove('opacity-0', 'scale-50');
            fakeCheckbox?.classList.add('bg-blue-500/20', 'border-blue-500');
            
            // Ajout du texte "Inclus"
            if(btn && !document.getElementById('forced-msg')) {
                const msg = document.createElement('span');
                msg.id = 'forced-msg';
                msg.className = 'text-[9px] text-blue-300 absolute top-1 right-2 uppercase font-bold tracking-widest';
                msg.innerText = 'Inclus';
                btn.classList.add('relative');
                btn.appendChild(msg);
            }
            updateSerenityCardInServices(true);

        } else {
            // Restaure l'interaction normale
            btn?.classList.remove('opacity-80', 'cursor-not-allowed');
            
            // Retire le message "Inclus"
            const msg = document.getElementById('forced-msg');
            if(msg) msg.remove();
        }
    }

    function updateSerenityCardInServices(isChecked) {
        const card = document.getElementById('card-serenite');
        if(card) {
            if(isChecked) card.classList.add('serenity-selected-card');
            else card.classList.remove('serenity-selected-card');
        }
    }

    function updateTotal() {
        let totalOneShot = currentBasePrice;
        
        if (isDocumentSelected) {
            totalOneShot += DOC_PRICE;
        }

        const displayEl = document.getElementById('total-price-display');
        if(displayEl) {
            // Formatage : 1 790 € (+ 49.90€/mois)
            let text = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(totalOneShot);
            
            if (isSerenitySelected) {
                text += ` <span class="text-xs font-normal text-blue-300 block text-right mt-1">+ ${SERENITY_MONTHLY}€ /mois</span>`;
            }
            
            displayEl.innerHTML = text;
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
    // On simule une sélection Vitrine au chargement
    window.updateCardSelection('Vitrine', 1790);


    // ==============================================
    // 6. CALENDRIER
    // ==============================================
    const daysContainer = document.getElementById('calendar-days');
    const slotsContainer = document.getElementById('calendar-slots');
    const dateInput = document.getElementById('selected-date');
    const timeInput = document.getElementById('selected-time');
    
    // Matin uniquement
    const DEFAULT_SLOTS = ["09:00", "09:30", "10:00", "10:30"];

    let calendarStartDate = new Date();
    let currentDateOffset = 0;
    const DAYS_TO_SHOW = 12;

    // Init
    renderCalendar();

    // Boutons Pagination
    document.getElementById('next-week')?.addEventListener('click', () => {
        window.vibrate();
        currentDateOffset += DAYS_TO_SHOW; 
        renderCalendar();
    });
    document.getElementById('prev-week')?.addEventListener('click', () => {
        if(currentDateOffset > 0) {
            window.vibrate();
            currentDateOffset -= DAYS_TO_SHOW;
            if(currentDateOffset < 0) currentDateOffset = 0;
            renderCalendar();
        }
    });

    function renderCalendar() {
        if(!daysContainer) return;
        daysContainer.innerHTML = '';
        
        const btnPrev = document.getElementById('prev-week');
        if(btnPrev) btnPrev.disabled = currentDateOffset === 0;

        let daysGenerated = 0;
        let i = 1 + currentDateOffset;

        while (daysGenerated < DAYS_TO_SHOW) {
            if (i > 60) break; // Limite de sécurité

            const d = new Date();
            d.setDate(d.getDate() + i);

            // Exclure Week-end (0=Dim, 6=Sam) ET MERCREDI (3)
            const day = d.getDay();
            if (day !== 0 && day !== 6 && day !== 3) {
                const dateStr = d.toISOString().split('T')[0];
                const dayName = d.toLocaleDateString('fr-FR', { weekday: 'short' });
                const dayNum = d.toLocaleDateString('fr-FR', { day: 'numeric' });
                const monthName = d.toLocaleDateString('fr-FR', { month: 'short' });

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `date-btn flex-shrink-0 h-20 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center transition-all duration-300 group focus:outline-none w-full`;
                
                if(dateInput.value === dateStr) {
                    btn.classList.add('active-date');
                }

                btn.innerHTML = `
                    <span class="text-xs text-slate-400 uppercase font-bold group-hover:text-accent-400">${dayName}</span>
                    <span class="text-xl font-bold text-white my-1">${dayNum}</span>
                    <span class="text-[10px] text-slate-500">${monthName}</span>
                `;
                btn.addEventListener('click', () => selectDate(btn, dateStr));
                daysContainer.appendChild(btn);
                
                daysGenerated++;
            }
            i++;
        }
    }

    async function selectDate(btn, dateStr) {
        window.vibrate();
        // RESET TOTAL
        document.querySelectorAll('.date-btn').forEach(b => {
            b.classList.remove('active-date');
            const spans = b.querySelectorAll('span');
            spans[0].className = "text-xs text-slate-400 uppercase font-bold group-hover:text-accent-400";
            spans[1].className = "text-xl font-bold text-white my-1";
            spans[2].className = "text-[10px] text-slate-500";
        });

        // ACTIVER NOUVEAU
        btn.classList.add('active-date');
        
        const spans = btn.querySelectorAll('span');
        spans[0].className = "text-xs text-dark-950 uppercase font-bold";
        spans[1].className = "text-xl font-bold text-dark-950 my-1";
        spans[2].className = "text-[10px] text-dark-950";

        dateInput.value = dateStr;
        timeInput.value = ""; 
        await loadSlotsForDate(dateStr);
    }

    async function loadSlotsForDate(dateStr) {
        slotsContainer.innerHTML = '<div class="col-span-full text-center text-accent-400"><i class="ph-duotone ph-spinner animate-spin text-2xl"></i></div>';
        try {
            const q = query(collection(db, "bookings"), where("date", "==", dateStr));
            const querySnapshot = await getDocs(q);
            const takenSlots = [];
            querySnapshot.forEach((doc) => takenSlots.push(doc.data().time));

            slotsContainer.innerHTML = '';
            if(DEFAULT_SLOTS.length === takenSlots.length) {
                slotsContainer.innerHTML = '<div class="col-span-full text-center text-slate-500 text-xs py-2">Complet ce jour</div>';
                return;
            }

            DEFAULT_SLOTS.forEach(time => {
                const isTaken = takenSlots.includes(time);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.disabled = isTaken;
                btn.textContent = time;
                btn.className = `py-2 rounded-lg text-sm font-medium border transition-all duration-200
                    ${isTaken 
                        ? 'bg-dark-900 border-transparent text-slate-700 cursor-not-allowed line-through' 
                        : 'bg-white/5 border-white/10 text-white hover:border-accent-400 hover:text-accent-400 time-btn'}`;
                
                if(!isTaken) {
                    btn.addEventListener('click', () => {
                        window.vibrate();
                        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('bg-accent-400', 'text-dark-950', 'hover:text-accent-400'));
                        btn.classList.remove('bg-white/5', 'hover:text-accent-400');
                        btn.classList.add('bg-accent-400', 'text-dark-950');
                        timeInput.value = time;
                    });
                }
                slotsContainer.appendChild(btn);
            });
        } catch (err) {
            console.error(err);
            slotsContainer.innerHTML = '<div class="col-span-full text-center text-red-400 text-xs">Erreur connexion</div>';
        }
    }

    // FORM SUBMIT
    const bookingForm = document.getElementById('booking-form');
    if(bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            window.vibrate();
            const submitBtn = document.getElementById('submit-booking');
            const originalText = submitBtn.innerHTML;
            
            if(!dateInput.value || !timeInput.value) {
                alert("Veuillez sélectionner une date et une heure.");
                return;
            }

            const selectedPack = document.querySelector('input[name="project_pack"]:checked').value;
            const hasSerenity = document.getElementById('check-serenite').checked;
            const hasDocuments = document.getElementById('check-documents')?.checked || false;
            const desc = document.getElementById('client-desc').value;
            const total = document.getElementById('total-price-display').textContent;
            
            const name = document.getElementById('client-lastname').value;
            const firstname = document.getElementById('client-firstname').value;
            const email = document.getElementById('client-email').value;
            
            // Calcul de l'heure de fin (+30 minutes)
            const [hours, minutes] = timeInput.value.split(':').map(Number);
            const dateObj = new Date();
            dateObj.setHours(hours, minutes);
            dateObj.setMinutes(dateObj.getMinutes() + 30);

            const endH = String(dateObj.getHours()).padStart(2, '0');
            const endM = String(dateObj.getMinutes()).padStart(2, '0');
            const calculatedEndTime = `${endH}:${endM}`;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-xl"></i> Envoi...';

                await addDoc(collection(db, "bookings"), {
                    date: dateInput.value,
                    time: timeInput.value,
                    endTime: calculatedEndTime,
                    lastname: name,
                    firstname: firstname,
                    fullname: `${firstname} ${name}`,
                    email: email,
                    phone: document.getElementById('client-phone').value,
                    pack: selectedPack,
                    option_serenite: hasSerenity,
                    option_documents: hasDocuments,
                    description: desc,
                    estimated_total: total,
                    created_at: new Date().toISOString(),
                    status: 'pending' 
                });

                // Configuration Message Succès (AVEC REDIRECTION KICKOFF)
                const dateObjFormatted = new Date(dateInput.value);
                const dateStr = dateObjFormatted.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
                document.getElementById('success-message-date').textContent = `Le ${dateStr} à ${timeInput.value}`;

                const kickoffBtn = document.querySelector('#booking-success a[href*="kickoff"]');
                if (kickoffBtn) {
                    const params = new URLSearchParams({
                        pack: selectedPack,             
                        name: `${firstname} ${name}`,    
                        email: email,                    
                        date: dateStr + ' à ' + timeInput.value 
                    });
                    kickoffBtn.href = `/portfolio/kickoff/?${params.toString()}`;
                }

                // Affichage Overlay
                document.getElementById('booking-success').classList.remove('hidden');
                document.getElementById('booking-success').classList.add('flex');
            } catch (error) {
                console.error("Booking error:", error);
                alert("Une erreur est survenue.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }
    
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
});