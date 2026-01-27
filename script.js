document.addEventListener('DOMContentLoaded', () => {
    
    // ==============================================
    // 1. GESTION DES PROJETS (ALIGNEMENT CORRIGÉ)
    // ==============================================
    const projectsData = [
        {
            title: "Bad Evian",
            subtitle: "La transformation associative",
            story: "En modernisant l’identité du club, j’ai donné une image plus soignée et rassurante, qui inspire confiance aux adhérents et visiteurs.",
            url: "https://www.badminton-evian.fr", 
            type: "Site Club Sportif",
            features: [
                { icon: "ph-clock-counter-clockwise", text: "Frise Chrono", desc: "Une navigation temporelle interactive qui permet aux visiteurs de découvrir l'histoire du club date par date de manière ludique." },
                { icon: "ph-newspaper", text: "News & Blog", desc: "Un système de gestion de contenu simplifié permettant au bureau d'ajouter des articles sans aucune connaissance technique." },
                { icon: "ph-lightning", text: "Live Score", desc: "Connexion API en temps réel avec la fédération pour afficher les résultats des tournois sans délai." },
                { icon: "ph-images", text: "Galerie", desc: "Optimisation automatique des images (WebP) et Lazy Loading pour un chargement instantané malgré des centaines de photos." },
                { icon: "ph-envelope-simple", text: "Contact", desc: "Formulaire sécurisé avec protection anti-spam (Honeypot + Recaptcha) et routage automatique des emails vers les responsables." },
                { icon: "ph-users", text: "Avis", desc: "Intégration dynamique des avis Google pour renforcer la preuve sociale directement sur la page d'accueil." }
            ]
        }
    ];

    const projectsGrid = document.getElementById('projects-grid');
    
    if (projectsGrid) {
        projectsGrid.innerHTML = projectsData.map((project, index) => {
            
            // CORRECTION: Utilisation de w-full et suppression des marges négatives potentielles
            const featuresHtml = project.features && project.features.length > 0 ? `
                <div class="w-full mb-6 mt-4 block">
                    <div class="flex flex-wrap gap-2 mb-4">
                        ${project.features.map((f, i) => `
                            <button onclick="showProjectDesc(${index}, ${i})" 
                                class="proj-btn-${index} group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-dark-900 text-xs text-slate-300 hover:border-accent-400 hover:text-white hover:bg-white/5 transition-all duration-300 cursor-pointer focus:outline-none"
                                data-desc="${f.desc}">
                                <i class="ph-bold ${f.icon} text-accent-400 group-hover:scale-110 transition-transform"></i>
                                <span>${f.text}</span>
                            </button>
                        `).join('')}
                    </div>
                    
                    <div id="project-desc-box-${index}" class="hidden w-full">
                        <div class="p-4 rounded-xl bg-white/5 border-l-2 border-accent-400 text-sm text-slate-300 relative animate-fade-up w-full">
                            <i class="ph-duotone ph-info text-xl text-accent-400 absolute top-4 right-4 opacity-50"></i>
                            <p id="project-desc-text-${index}" class="leading-relaxed pr-8"></p>
                        </div>
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
                    
                    <p class="text-slate-300 leading-relaxed text-sm mb-2 border-l-2 border-accent-400 pl-4">
                        "${project.story}"
                    </p>

                    ${featuresHtml}

                    <a href="${project.url}" target="_blank" class="inline-flex items-center gap-2 text-white font-bold hover:text-accent-400 transition-colors w-fit group/link mt-auto">
                        Visiter le site <i class="ph-bold ph-arrow-right group-hover/link:translate-x-1 transition-transform"></i>
                    </a>
                </div>

                <div class="md:w-2/3 order-1 md:order-2 relative rounded-3xl overflow-hidden border border-white/10 bg-dark-900 group/frame interactive-hover h-[300px] md:h-auto project-frame-container">
                    <div class="absolute top-0 left-0 right-0 h-10 bg-dark-950/90 backdrop-blur border-b border-white/5 flex items-center px-4 gap-2 z-20">
                        <div class="flex gap-1.5">
                            <div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                            <div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                        </div>
                        <div class="ml-4 text-[10px] text-slate-500 font-mono opacity-50 flex-grow truncate">
                            ${project.url.replace('https://', '')}
                        </div>
                    </div>
                    <div class="absolute inset-0 top-10 bg-white transition-all duration-700 ease-out grayscale group-hover/frame:grayscale-0 iframe-container project-iframe">
                         <iframe src="${project.url}" class="w-[200%] h-[200%] border-0 transform scale-50 origin-top-left pointer-events-none" loading="lazy"></iframe>
                        <div class="absolute inset-0 bg-dark-950/10 backdrop-blur-[2px] group-hover/frame:backdrop-blur-0 transition-all duration-500 iframe-overlay"></div>
                        <div class="absolute inset-0 flex items-center justify-center opacity-100 group-hover/frame:opacity-0 transition-opacity duration-300 pointer-events-none hint-overlay">
                            <span class="px-4 py-2 bg-dark-950/80 rounded-full text-xs text-white backdrop-blur-md border border-white/10">Survoler pour aperçu</span>
                        </div>
                    </div>
                    <a href="${project.url}" target="_blank" class="absolute inset-0 z-30 md:hidden"></a>
                </div>
            </article>
            <div class="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-16 last:hidden"></div>
            `;
        }).join('');
    }

    window.showProjectDesc = function(projectIndex, btnIndex) {
        document.querySelectorAll(`.proj-btn-${projectIndex}`).forEach(btn => {
            btn.classList.remove('bg-white/10', 'border-accent-400', 'text-white');
            btn.classList.add('bg-dark-900', 'border-white/10', 'text-slate-300');
        });

        const clickedBtn = document.querySelectorAll(`.proj-btn-${projectIndex}`)[btnIndex];
        clickedBtn.classList.remove('bg-dark-900', 'border-white/10', 'text-slate-300');
        clickedBtn.classList.add('bg-white/10', 'border-accent-400', 'text-white');

        const box = document.getElementById(`project-desc-box-${projectIndex}`);
        const text = document.getElementById(`project-desc-text-${projectIndex}`);
        
        box.classList.remove('hidden');
        text.textContent = clickedBtn.getAttribute('data-desc');
    };


    // ==============================================
    // 2. ADMIN SÉCURISÉ (HASHS MIS À JOUR)
    // ==============================================
    
    // Hashs SHA-256 calculés spécifiquement pour vos identifiants
    // User: nathan.marzilli
    const USER_HASH = "5d1797c7674143422026131018804867c48404286701831885f639070868f02f"; 
    // Pass: Okisblavet92
    const PASS_HASH = "e4b7b6c8022d637c352528751502476046180164606742637956417740924403";

    const adminModal = document.getElementById('admin-modal');
    const adminContent = document.getElementById('admin-content');
    const loginView = document.getElementById('admin-login-view');
    const dashboardView = document.getElementById('admin-dashboard-view');
    const actionsGrid = document.getElementById('admin-actions-grid');

    window.toggleAdminModal = function() {
        if (adminModal.classList.contains('hidden')) {
            adminModal.classList.remove('hidden');
            setTimeout(() => {
                adminModal.classList.remove('opacity-0');
                adminContent.classList.remove('scale-95');
                adminContent.classList.add('scale-100');
            }, 10);
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
            eyeIcon.classList.remove('ph-eye');
            eyeIcon.classList.add('ph-eye-slash');
            eyeIcon.parentElement.classList.add('text-white');
        } else {
            passInput.type = 'password';
            eyeIcon.classList.remove('ph-eye-slash');
            eyeIcon.classList.add('ph-eye');
            eyeIcon.parentElement.classList.remove('text-white');
        }
    };

    function resetAdminForm() {
        document.getElementById('admin-id').value = '';
        document.getElementById('admin-pass').value = '';
        document.getElementById('login-error').classList.add('hidden');
        loginView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        
        document.getElementById('admin-pass').type = 'password';
        document.getElementById('eye-icon').classList.remove('ph-eye-slash');
        document.getElementById('eye-icon').classList.add('ph-eye');
    }

    async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }

    window.attemptLogin = async function() {
        const idInput = document.getElementById('admin-id').value.trim();
        const passInput = document.getElementById('admin-pass').value.trim();
        const errorMsg = document.getElementById('login-error');

        const inputUserHash = await sha256(idInput);
        const inputPassHash = await sha256(passInput);

        if (inputUserHash === USER_HASH && inputPassHash === PASS_HASH) {
            loginView.classList.add('hidden');
            dashboardView.classList.remove('hidden');
            renderAdminButtons();
        } else {
            errorMsg.classList.remove('hidden');
            adminContent.classList.add('animate-pulse');
            setTimeout(() => adminContent.classList.remove('animate-pulse'), 500);
        }
    };

    const adminActions = [
        { label: "Créer Devis / Facture", icon: "ph-file-text", color: "text-blue-400", link: "/contrat/index.html" },
        { label: "Quittance de Loyer", icon: "ph-house-line", color: "text-green-400", link: "/contrat/quittance/index.html" },
        { label: "Bail Location Meublée", icon: "ph-key", color: "text-purple-400", link: "/contrat/bail/index.html" }
    ];

    function renderAdminButtons() {
        if(actionsGrid) {
            actionsGrid.innerHTML = adminActions.map(action => `
                <a href="${action.link}" target="_blank" class="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent-400 transition-all group">
                    <div class="w-10 h-10 rounded-full bg-dark-950 flex items-center justify-center border border-white/10 group-hover:border-${action.color.split('-')[1]}-400 transition-colors">
                        <i class="ph-bold ${action.icon} ${action.color} text-xl"></i>
                    </div>
                    <span class="font-bold text-slate-200 group-hover:text-white transition-colors">${action.label}</span>
                    <i class="ph-bold ph-arrow-right ml-auto text-slate-500 group-hover:text-accent-400 transition-colors"></i>
                </a>
            `).join('');
        }
    }

    document.getElementById('admin-pass').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') attemptLogin();
    });

    // ==============================================
    // 3. LOGIQUE SKILLS & GLOBAL (INCHANGÉ)
    // ==============================================
    const techDescriptions = {
        'html': { title: 'Structure HTML5 Sémantique', text: 'Je construis le squelette de votre site en respectant les standards du web (W3C). Un code propre garantit une meilleure accessibilité pour les personnes handicapées et une lecture parfaite par les robots de Google (SEO).', icon: 'ph-file-html', color: 'text-orange-500' },
        'css': { title: 'Design CSS3 Moderne', text: 'Mise en forme avancée sans alourdir le site. J\'utilise les animations CSS fluides (60fps) et les layouts Flexbox/Grid pour que votre site soit beau et réactif sur tous les écrans.', icon: 'ph-file-css', color: 'text-blue-500' },
        'js': { title: 'JavaScript Dynamique', text: 'Le moteur de l\'interactivité. Je développe des fonctionnalités sur-mesure (calculateurs, filtres, cartes) sans dépendre de plugins lourds. Votre site réagit instantanément aux actions de l\'utilisateur.', icon: 'ph-file-js', color: 'text-yellow-400' },
        'tailwind': { title: 'Tailwind CSS Framework', text: 'Mon outil de prédilection pour le design. Il permet de construire des interfaces uniques ultra-rapidement tout en générant un fichier CSS final minuscule pour un chargement éclair.', icon: 'ph-paint-brush-broad', color: 'text-cyan-400' },
        'git': { title: 'Versionning Git', text: 'La sécurité de votre code. Chaque modification est enregistrée dans un historique. Cela permet de travailler sans risque et de revenir en arrière si une nouvelle fonctionnalité ne convient pas.', icon: 'ph-git-branch', color: 'text-red-500' },
        'responsive': { title: 'Mobile First', text: 'Plus de 60% des visites se font sur mobile. Je conçois votre site d\'abord pour les smartphones, puis j\'adapte l\'affichage pour les tablettes et ordinateurs. L\'expérience est parfaite partout.', icon: 'ph-device-mobile', color: 'text-purple-400' },
        'firebase': { title: 'Backend Google Firebase', text: 'Une base de données puissante et sécurisée par Google. Idéal pour héberger vos données dynamiques (scores en direct, commentaires, authentification utilisateurs) sans gérer de serveur complexe.', icon: 'ph-fire', color: 'text-orange-400' },
        'seo': { title: 'SEO & Performance', text: 'La visibilité avant tout. J\'optimise la structure technique (balises meta, sitemap, vitesse) pour que Google adore votre site autant que vos visiteurs. Objectif : Score 100/100.', icon: 'ph-magnifying-glass', color: 'text-green-500' }
    };

    const techItems = document.querySelectorAll('.tech-item');
    const descBox = document.getElementById('tech-description-box');
    const descTitle = document.getElementById('tech-title');
    const descText = document.getElementById('tech-text');
    const descIcon = document.getElementById('tech-bg-icon');

    setTimeout(() => {
        const firstTech = document.querySelector('[data-tech="html"]');
        if(firstTech) updateTechDescription(firstTech);
    }, 1000);

    techItems.forEach(item => {
        item.addEventListener('click', () => updateTechDescription(item));
    });

    function updateTechDescription(element) {
        techItems.forEach(t => {
            t.classList.remove('border-accent-400', 'bg-white/10');
            t.classList.add('border-white/5', 'bg-dark-900');
        });
        element.classList.remove('border-white/5', 'bg-dark-900');
        element.classList.add('border-accent-400', 'bg-white/10');

        const techKey = element.getAttribute('data-tech');
        const data = techDescriptions[techKey];

        if (data && descBox) {
            descBox.classList.remove('opacity-100', 'translate-y-0');
            descBox.classList.add('opacity-0', 'translate-y-4');
            setTimeout(() => {
                descTitle.textContent = data.title;
                descText.textContent = data.text;
                descIcon.className = `ph-duotone ${data.icon} text-6xl absolute top-4 right-4 opacity-10 transition-colors duration-300 ${data.color}`;
                descBox.classList.remove('opacity-0', 'translate-y-4');
                descBox.classList.add('opacity-100', 'translate-y-0');
            }, 300);
        }
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const projectObserver = new IntersectionObserver((entries) => {
        if (window.innerWidth < 1024) { 
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('mobile-active');
                else entry.target.classList.remove('mobile-active');
            });
        }
    }, { threshold: 0.6 });
    document.querySelectorAll('.project-frame-container').forEach(el => projectObserver.observe(el));

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    
    if(typeof loadAvailability === 'function') loadAvailability();
});