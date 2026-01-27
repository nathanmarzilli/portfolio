document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CONFIGURATION DES PROJETS & STORYTELLING ---
    const projectsData = [
        {
            title: "Bad Evian",
            subtitle: "La transformation associative",
            story: "En modernisant l’identité du club, j’ai donné une image plus soignée et rassurante, qui inspire confiance aux adhérents et visiteurs.",
            url: "https://www.badminton-evian.fr", 
            type: "Site Club Sportif",
            features: [
                { 
                    icon: "ph-clock-counter-clockwise", 
                    text: "Frise Chrono", 
                    desc: "Historique interactif du club pour renforcer l'identité." 
                },
                { 
                    icon: "ph-newspaper", 
                    text: "News & Blog", 
                    desc: "Gestion autonome des articles par le bureau du club." 
                },
                { 
                    icon: "ph-lightning", 
                    text: "Live Score", 
                    desc: "Connexion API temps réel pour suivre les tournois." 
                },
                { 
                    icon: "ph-images", 
                    text: "Galerie", 
                    desc: "Optimisation automatique des photos pour la rapidité." 
                },
                { 
                    icon: "ph-envelope-simple", 
                    text: "Contact", 
                    desc: "Formulaire sécurisé avec anti-spam intégré." 
                },
                { 
                    icon: "ph-users", 
                    text: "Avis", 
                    desc: "Intégration des témoignages pour la preuve sociale." 
                }
            ]
        }
        /* Ajoutez vos autres projets ici */
    ];

    const projectsGrid = document.getElementById('projects-grid');
    
    if (projectsGrid) {
        projectsGrid.innerHTML = projectsData.map((project, index) => {
            
            // Génération HTML des badges AVEC Tooltip
            const featuresHtml = project.features && project.features.length > 0 ? `
                <div class="flex flex-wrap gap-2 mb-6 mt-2">
                    ${project.features.map(f => `
                        <div class="group/badge relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-slate-300 cursor-help hover:bg-accent-400/10 hover:border-accent-400/30 hover:text-white hover:scale-105 transition-all duration-300">
                            <i class="ph-bold ${f.icon} text-accent-400"></i>
                            <span>${f.text}</span>
                            
                            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-dark-950/90 backdrop-blur-md border border-white/10 rounded-lg text-center opacity-0 invisible transform translate-y-2 group-hover/badge:opacity-100 group-hover/badge:visible group-hover/badge:translate-y-0 transition-all duration-200 z-50 shadow-xl pointer-events-none">
                                <p class="text-[10px] text-slate-200 leading-tight">${f.desc}</p>
                                <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-dark-950 rotate-45 border-r border-b border-white/10"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '';

            return `
            <article class="flex flex-col md:flex-row gap-8 items-stretch min-h-[400px] reveal group" style="transition-delay: ${index * 100}ms">
                
                <div class="md:w-1/3 flex flex-col justify-center order-2 md:order-1">
                    <div class="mb-4">
                        <span class="text-accent-400 text-xs font-bold uppercase tracking-wider mb-2 block">${project.type}</span>
                        <h3 class="text-3xl font-display font-bold text-white mb-1">${project.title}</h3>
                        <p class="text-slate-500 italic text-sm mb-4">${project.subtitle}</p>
                    </div>
                    
                    <p class="text-slate-300 leading-relaxed text-sm mb-4 border-l-2 border-accent-400 pl-4">
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
                         <iframe src="${project.url}" 
                            class="w-[200%] h-[200%] border-0 transform scale-50 origin-top-left pointer-events-none" 
                            loading="lazy"
                            title="${project.title}">
                        </iframe>
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

    // --- 1.1 MOBILE OBSERVER (Inchangé) ---
    const projectObserver = new IntersectionObserver((entries) => {
        if (window.innerWidth < 1024) { 
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('mobile-active');
                } else {
                    entry.target.classList.remove('mobile-active');
                }
            });
        }
    }, { threshold: 0.6 });

    document.querySelectorAll('.project-frame-container').forEach(el => {
        projectObserver.observe(el);
    });

    // --- 2. DISPONIBILITÉS (Inchangé - Voir script précédent) ---
    function loadAvailability() { /* ... Code inchangé ... */ }
    loadAvailability(); // Supposé présent dans availability.js ou à inclure

    // --- 3. PRIX & OFFRES (Inchangé - Voir script précédent) ---
    /* ... Code existant des prix ... */

    // --- 4. INTERACTION SKILLS (NOUVEAU) ---
    const techDescriptions = {
        'html': {
            title: 'Structure HTML5 Sémantique',
            text: 'Je construis le squelette de votre site en respectant les standards du web (W3C). Un code propre garantit une meilleure accessibilité pour les personnes handicapées et une lecture parfaite par les robots de Google (SEO).',
            icon: 'ph-file-html',
            color: 'text-orange-500'
        },
        'css': {
            title: 'Design CSS3 Moderne',
            text: 'Mise en forme avancée sans alourdir le site. J\'utilise les animations CSS fluides (60fps) et les layouts Flexbox/Grid pour que votre site soit beau et réactif sur tous les écrans.',
            icon: 'ph-file-css',
            color: 'text-blue-500'
        },
        'js': {
            title: 'JavaScript Dynamique',
            text: 'Le moteur de l\'interactivité. Je développe des fonctionnalités sur-mesure (calculateurs, filtres, cartes) sans dépendre de plugins lourds. Votre site réagit instantanément aux actions de l\'utilisateur.',
            icon: 'ph-file-js',
            color: 'text-yellow-400'
        },
        'tailwind': {
            title: 'Tailwind CSS Framework',
            text: 'Mon outil de prédilection pour le design. Il permet de construire des interfaces uniques ultra-rapidement tout en générant un fichier CSS final minuscule pour un chargement éclair.',
            icon: 'ph-paint-brush-broad',
            color: 'text-cyan-400'
        },
        'git': {
            title: 'Versionning Git',
            text: 'La sécurité de votre code. Chaque modification est enregistrée dans un historique. Cela permet de travailler sans risque et de revenir en arrière si une nouvelle fonctionnalité ne convient pas.',
            icon: 'ph-git-branch',
            color: 'text-red-500'
        },
        'responsive': {
            title: 'Mobile First',
            text: 'Plus de 60% des visites se font sur mobile. Je conçois votre site d\'abord pour les smartphones, puis j\'adapte l\'affichage pour les tablettes et ordinateurs. L\'expérience est parfaite partout.',
            icon: 'ph-device-mobile',
            color: 'text-purple-400'
        },
        'firebase': {
            title: 'Backend Google Firebase',
            text: 'Une base de données puissante et sécurisée par Google. Idéal pour héberger vos données dynamiques (scores en direct, commentaires, authentification utilisateurs) sans gérer de serveur complexe.',
            icon: 'ph-fire',
            color: 'text-orange-400'
        },
        'seo': {
            title: 'SEO & Performance',
            text: 'La visibilité avant tout. J\'optimise la structure technique (balises meta, sitemap, vitesse) pour que Google adore votre site autant que vos visiteurs. Objectif : Score 100/100.',
            icon: 'ph-magnifying-glass',
            color: 'text-green-500'
        }
    };

    const techItems = document.querySelectorAll('.tech-item');
    const descBox = document.getElementById('tech-description-box');
    const descTitle = document.getElementById('tech-title');
    const descText = document.getElementById('tech-text');
    const descIcon = document.getElementById('tech-bg-icon');

    // Initialisation : Simuler un clic sur HTML au chargement après 1s
    setTimeout(() => {
        const firstTech = document.querySelector('[data-tech="html"]');
        if(firstTech) updateTechDescription(firstTech);
    }, 1000);

    techItems.forEach(item => {
        item.addEventListener('click', () => updateTechDescription(item));
    });

    function updateTechDescription(element) {
        // 1. Gestion visuelle de la sélection
        techItems.forEach(t => {
            t.classList.remove('border-accent-400', 'bg-white/10');
            t.classList.add('border-white/5', 'bg-dark-900');
        });
        element.classList.remove('border-white/5', 'bg-dark-900');
        element.classList.add('border-accent-400', 'bg-white/10');

        // 2. Récupération des données
        const techKey = element.getAttribute('data-tech');
        const data = techDescriptions[techKey];

        if (data && descBox) {
            // Animation de sortie
            descBox.classList.remove('opacity-100', 'translate-y-0');
            descBox.classList.add('opacity-0', 'translate-y-4');

            setTimeout(() => {
                // Mise à jour du contenu
                descTitle.textContent = data.title;
                descText.textContent = data.text;
                
                // Icone de fond
                descIcon.className = `ph-duotone ${data.icon} text-6xl absolute top-4 right-4 opacity-10 transition-colors duration-300 ${data.color}`;
                
                // Animation d'entrée
                descBox.classList.remove('opacity-0', 'translate-y-4');
                descBox.classList.add('opacity-100', 'translate-y-0');
            }, 300);
        }
    }

    // --- 5. RESTE DU CODE (Menu, Observer...) ---
    /* ... Le reste du code JS existant (Menu, Observer, Date) doit être conservé ici ... */
    
    // Observer pour animations d'apparition
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { 
            if (entry.isIntersecting) {
                entry.target.classList.add('active'); 
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
});