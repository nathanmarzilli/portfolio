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

    // --- Sélection des Offres (Modification : Animation bouton, pas de scroll) ---
    window.selectOffer = function(btnElement, packName, price) {
        window.vibrate(); 
        const radioBtn = document.querySelector(`input[name="project_pack"][value="${packName}"]`);
        if (radioBtn) {
            radioBtn.checked = true;
            updateCardSelection(packName, price);
        }

        // Réinitialisation visuelle de tous les boutons "Choisir"
        document.querySelectorAll('.offer-btn').forEach(b => {
            b.innerHTML = '<span>Choisir</span>';
            b.classList.remove('bg-accent-400', 'text-dark-950', 'hover:shadow-[0_0_20px_rgba(45,212,191,0.4)]');
            b.classList.add('border-white/10', 'text-white', 'hover:bg-white', 'hover:text-dark-950');
            // Cas spécial pour le bouton Premium qui était hover:purple
            if(b.parentElement.id === 'card-premium') {
                b.classList.remove('hover:bg-white', 'hover:text-dark-950');
                b.classList.add('hover:bg-purple-400');
            }
        });

        // Animation du bouton cliqué
        if(btnElement) {
            btnElement.classList.remove('border-white/10', 'text-white', 'hover:bg-white', 'hover:text-dark-950', 'hover:bg-purple-400');
            btnElement.classList.add('bg-accent-400', 'text-dark-950', 'hover:shadow-[0_0_20px_rgba(45,212,191,0.4)]');
            btnElement.innerHTML = '<span>Sélectionné</span> <i class="ph-bold ph-check animate-pop-in"></i>';
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
	
	// Nouvelle fonction pour gérer l'affichage du champ "Autre"
    window.toggleCustomDocInput = function() {
        const checkbox = document.getElementById('check-custom-doc');
        const input = document.getElementById('custom-doc-input');
        
        // Petit délai pour attendre que handleDocClick ait fini son travail visuel
        setTimeout(() => {
             if (checkbox && input) {
                if (checkbox.checked) {
                    input.classList.remove('hidden');
                    setTimeout(() => {
                        input.classList.remove('opacity-0', 'translate-y-2');updateSerenityCardInServices
                        input.focus();
                    }, 10);
                } else {
                    input.classList.add('opacity-0', 'translate-y-2');
                    setTimeout(() => {
                        input.classList.add('hidden');
                        input.value = ''; // Reset valeur
                    }, 300);
                }
            }
            updateTotal();
        }, 20);
    }
	
	window.saveCustomDocName = function() {
        // Juste pour s'assurer que l'input reste accessible, pas de logique complexe ici
    }

    // --- Sérénité (Modification : Toggle visuel bouton, pas de scroll) ---
    window.toggleSerenityOption = function(btnElement) {
        if (!isSerenitySelected) {
            window.toggleSerenityForm();
        } else {
            // Si déjà sélectionné, le bouton permet de retirer (sauf si forcé par Essentiel)
            // Note: toggleSerenityForm gère déjà la logique d'exclusion "Essentiel"
             window.toggleSerenityForm();
        }
    }

	// Mise à jour visuelle du bouton Sérénité dans la section Services
    function updateSerenityCardInServices(isChecked) {
        const card = document.getElementById('card-serenite');
        const btn = document.getElementById('btn-serenite-action');

        if(card) {
            if(isChecked) {
                card.classList.add('serenity-selected-card');
                if(btn) {
                    btn.innerHTML = '<span>Ajouté</span> <i class="ph-bold ph-check"></i>';
                    btn.classList.remove('bg-blue-500/20', 'text-blue-300');
                    btn.classList.add('bg-blue-500', 'text-white', 'shadow-lg');
                }
            } else {
                card.classList.remove('serenity-selected-card');
                if(btn) {
                    btn.innerHTML = '<span>Ajouter</span> <i class="ph-bold ph-plus"></i>';
                    btn.classList.add('bg-blue-500/20', 'text-blue-300');
                    btn.classList.remove('bg-blue-500', 'text-white', 'shadow-lg');
                }
            }
        }
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
        let docTotal = 0;

        // Calculer le prix des documents SEULEMENT si le module est activé
        if (isDocumentSelected) {
            const checkedDocs = document.querySelectorAll('.doc-sub-checkbox:checked');
            checkedDocs.forEach(cb => {
                // On récupère le prix depuis l'attribut data-price (converti en entier)
                const price = parseInt(cb.getAttribute('data-price')) || 0;
                docTotal += price;
            });
            totalOneShot += docTotal;
        }

        // Mise à jour du tag de prix dans le bouton Documents
        const priceTag = document.getElementById('docs-price-tag');
        if(priceTag) {
            // Si module actif, on affiche le montant total des docs sélectionnés
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
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (window.vibrate) window.vibrate(); // Petite sécurité si la fonction n'existe pas

            const submitBtn = document.getElementById('submit-booking');
            const originalText = submitBtn.innerHTML;

            const dateInput = document.getElementById('selected-date');
            const timeInput = document.getElementById('selected-time');

            if (!dateInput.value || !timeInput.value) {
                alert("Veuillez sélectionner une date et une heure.");
                return;
            }

            // Récupération des données du formulaire
            const selectedPack = document.querySelector('input[name="project_pack"]:checked').value;
            const hasSerenity = document.getElementById('check-serenite').checked;
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

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="ph-bold ph-spinner animate-spin text-xl"></i> Envoi...';

                // Envoi vers Firebase
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
                    
                    // Nouveaux champs Documents
                    option_documents_active: isDocActive,
                    documents_list: selectedDocumentsList, // Tableau (ex: ["Devis", "Autre : Attestation"])
                    documents_count: selectedDocumentsList.length,

                    description: desc,
                    estimated_total: total,
                    created_at: new Date().toISOString(),
                    status: 'pending'
                });

                // Configuration Message Succès (AVEC REDIRECTION KICKOFF)
                const dateObjFormatted = new Date(dateInput.value);
                const dateStr = dateObjFormatted.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                });
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
                alert("Une erreur est survenue lors de la réservation.");
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

    // 2. Ouvre le mode configuration
    window.toggleServiceConfig = function() {
        const selector = document.getElementById('service-doc-selector');
        const btnConfig = document.getElementById('btn-config-doc');
        const btnValidate = document.getElementById('btn-validate-doc');
        
        if (selector.classList.contains('hidden')) {
            selector.classList.remove('hidden');
            btnConfig.classList.add('hidden');
            btnValidate.classList.remove('hidden');
            btnValidate.classList.add('flex');
            
            // Reset des checkbox service
            document.querySelectorAll('.service-doc-chk').forEach(c => {
                c.checked = false;
                // Reset visuel via handler
                handleServiceDocClick(c.closest('label'));
            });
            updateServicePrice(); 
        }
    }

    // 3. Calcul Prix Service (Local)
    window.updateServicePrice = function() {
        let total = 0;
        const checked = document.querySelectorAll('.service-doc-chk:checked');
        
        checked.forEach(chk => {
            total += parseInt(chk.getAttribute('data-price'));
        });

        const display = document.getElementById('service-price-display');
        const label = document.getElementById('service-price-label');

        if (total > 0) {
            display.textContent = total + '€';
            label.textContent = "pour la sélection (" + checked.length + " docs)";
            label.classList.add('text-emerald-400');
        } else {
            display.textContent = '250€';
            label.textContent = "par type de document";
            label.classList.remove('text-emerald-400');
        }
    }

    // 4. Validation et Transfert (Sans Scroll, avec Anim)
    window.validateServiceDocs = function() {
        const checked = document.querySelectorAll('.service-doc-chk:checked');
        if(checked.length === 0) return; // Rien à faire si rien cochée

        // A. Activer le module Document dans le formulaire s'il ne l'est pas
        if (!isDocumentSelected) {
             window.toggleDocumentOption();
        }

        // B. Reset du formulaire documents (nettoyage avant import)
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
                
                // Cas spécial "Autre" : ouvrir l'input
                if(val === 'Autre') {
                    window.toggleCustomDocInput();
                }
            }
        });

        // D. Animation de succès sur le bouton (Feedback UX)
        const btn = document.getElementById('btn-validate-doc');
        const overlay = document.getElementById('btn-validate-overlay');
        const textSpan = document.getElementById('btn-validate-text');
        
        // Etat Success
        overlay.classList.remove('translate-y-full'); // Fond blanc/flash
        setTimeout(() => {
            textSpan.innerHTML = 'Ajouté au devis ! <i class="ph-bold ph-check-circle text-lg"></i>';
            btn.classList.remove('bg-emerald-500');
            btn.classList.add('bg-emerald-600');
        }, 200);

        // Retour à la normale après 2.5s
        setTimeout(() => {
            overlay.classList.add('translate-y-full');
            textSpan.innerHTML = 'Valider & Ajouter <i class="ph-bold ph-plus-circle"></i>';
            btn.classList.add('bg-emerald-500');
            btn.classList.remove('bg-emerald-600');
        }, 2500);
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
});