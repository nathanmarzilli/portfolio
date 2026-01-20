document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURATION DES PROJETS & STORYTELLING ---
    const projectsData = [
        {
            title: "Bad Evian",
            subtitle: "La transformation associative",
            story: "En modernisant l’identité du club, j’ai donné une image plus soignée et rassurante, qui inspire confiance aux adhérents et visiteurs.",
            url: "https://nathanmarzilli.github.io/badevian/", 
            type: "Site Club Sportif"
        },
        {
            title: "Roch Fermetures",
            subtitle: "L'élégance industrielle",
            story: "Pour cet artisan menuisier, le défi était de montrer la qualité technique des produits tout en rassurant le particulier. J'ai opté pour un design minimaliste et robuste qui met en avant les photos de chantiers réels.",
            url: "https://nathanmarzilli.github.io/roch-fermetures-prototype/", 
            type: "Vitrine Artisan"
        },
        {
            title: "Tailwind CSS Demo",
            subtitle: "Performance pure",
            story: "Démonstration technique de la puissance d'un site statique moderne. Temps de chargement inférieur à 0.5 seconde, score SEO de 100/100. C'est ce standard que j'applique à tous mes clients.",
            url: "https://tailwindcss.com", 
            type: "Exemple Tech"
        }
    ];

    const projectsGrid = document.getElementById('projects-grid');
    
    if (projectsGrid) {
        projectsGrid.innerHTML = projectsData.map((project, index) => {
            return `
            <article class="flex flex-col md:flex-row gap-8 items-stretch min-h-[400px] reveal group" style="transition-delay: ${index * 100}ms">
                
                <!-- Story Side -->
                <div class="md:w-1/3 flex flex-col justify-center order-2 md:order-1">
                    <div class="mb-4">
                        <span class="text-accent-400 text-xs font-bold uppercase tracking-wider mb-2 block">${project.type}</span>
                        <h3 class="text-3xl font-display font-bold text-white mb-1">${project.title}</h3>
                        <p class="text-slate-500 italic text-sm mb-4">${project.subtitle}</p>
                    </div>
                    <p class="text-slate-300 leading-relaxed text-sm mb-6 border-l-2 border-accent-400 pl-4">
                        "${project.story}"
                    </p>
                    <a href="${project.url}" target="_blank" class="inline-flex items-center gap-2 text-white font-bold hover:text-accent-400 transition-colors w-fit group/link">
                        Visiter le site <i class="ph-bold ph-arrow-right group-hover/link:translate-x-1 transition-transform"></i>
                    </a>
                </div>

                <!-- Visual Side (Subtle Preview) -->
                <div class="md:w-2/3 order-1 md:order-2 relative rounded-3xl overflow-hidden border border-white/10 bg-dark-900 group/frame interactive-hover h-[300px] md:h-auto project-frame-container">
                    
                    <!-- Browser Header -->
                    <div class="absolute top-0 left-0 right-0 h-10 bg-dark-950/90 backdrop-blur border-b border-white/5 flex items-center px-4 gap-2 z-20">
                        <div class="flex gap-1.5">
                            <div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                            <div class="w-2.5 h-2.5 rounded-full bg-slate-600"></div>
                        </div>
                        <div class="ml-4 text-[10px] text-slate-500 font-mono opacity-50 flex-grow truncate">
                            ${project.url.replace('https://', '')}
                        </div>
                    </div>

                    <!-- Iframe with Blur Effect until Hover/Scroll -->
                    <div class="absolute inset-0 top-10 bg-white transition-all duration-700 ease-out grayscale group-hover/frame:grayscale-0 iframe-container project-iframe">
                         <iframe src="${project.url}" 
                            class="w-[200%] h-[200%] border-0 transform scale-50 origin-top-left pointer-events-none" 
                            loading="lazy"
                            title="${project.title}">
                        </iframe>
                        <!-- Overlay Blur -->
                        <div class="absolute inset-0 bg-dark-950/10 backdrop-blur-[2px] group-hover/frame:backdrop-blur-0 transition-all duration-500 iframe-overlay"></div>
                        
                        <!-- Hint -->
                        <div class="absolute inset-0 flex items-center justify-center opacity-100 group-hover/frame:opacity-0 transition-opacity duration-300 pointer-events-none hint-overlay">
                            <span class="px-4 py-2 bg-dark-950/80 rounded-full text-xs text-white backdrop-blur-md border border-white/10">Survoler pour aperçu</span>
                        </div>
                    </div>

                    <!-- Link Cover (for mobile click) -->
                    <a href="${project.url}" target="_blank" class="absolute inset-0 z-30 md:hidden"></a>
                </div>
            </article>
            <div class="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4 last:hidden"></div>
            `;
        }).join('');
    }

    // --- 1.1 MOBILE & TABLET SCROLL OBSERVER ---
    const projectObserver = new IntersectionObserver((entries) => {
        // Se déclenche pour Mobile ET Tablette (< 1024px)
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

    // --- 2. GESTION DES DISPONIBILITÉS ---
    function loadAvailability() {
        const dateContainer = document.getElementById('date-container');
        if (typeof PLANNING_DATA !== 'undefined' && PLANNING_DATA.days) {
            dateContainer.innerHTML = '';
            PLANNING_DATA.days.forEach((dayObj, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `date-btn flex-shrink-0 w-14 h-16 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center hover:border-accent-400 transition-all focus:outline-none interactive-hover ${index === 0 ? 'ml-0' : ''}`;
                
                const dateParts = dayObj.date.split('-'); 
                const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                
                btn.innerHTML = `
                    <span class="text-[10px] text-slate-400 uppercase">${date.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                    <span class="text-lg font-bold text-white">${date.getDate()}</span>
                `;
                btn.onclick = () => {
                    document.querySelectorAll('#date-container button').forEach(b => b.classList.remove('selected-option'));
                    btn.classList.add('selected-option');
                    document.getElementById('selected-date').value = dayObj.date;
                    renderSlots(dayObj.slots);
                };
                dateContainer.appendChild(btn);
            });
        }
    }

    function renderSlots(slots) {
        const container = document.getElementById('slots-container');
        container.innerHTML = '';
        slots.forEach(slot => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 hover:text-white hover:border-accent-400 transition-all interactive-hover';
            btn.textContent = slot;
            btn.onclick = () => {
                document.querySelectorAll('#slots-container button').forEach(b => b.classList.remove('selected-option'));
                btn.classList.add('selected-option');
                document.getElementById('selected-time').value = slot;
            };
            container.appendChild(btn);
        });
    }
    loadAvailability();

    // --- 3. LOGIQUE PRIX ET OFFRES (GOLD & SÉRÉNITÉ) ---
    const PRICES = {
        'Pack Essentiel': 900,
        'Pack Vitrine Artisan': 1700,
        'Pack Premium': 2500,
        'Maintenance': 600
    };
    
    function updateTotalDisplay() {
        const selectedPack = document.getElementById('selected-offer').value;
        const maintenanceChecked = document.getElementById('maintenance-toggle').checked;
        const totalDisplay = document.getElementById('total-price-display');
        
        let total = 0;
        if (selectedPack && PRICES[selectedPack]) {
            total += PRICES[selectedPack];
        }
        if (maintenanceChecked) {
            total += PRICES['Maintenance'];
        }
        
        if (totalDisplay) {
            totalDisplay.style.transform = 'scale(1.1)';
            setTimeout(() => totalDisplay.style.transform = 'scale(1)', 150);
            totalDisplay.innerText = total + '€';
        }
    }

    window.preselectOffer = function(offerName) {
        const btns = document.querySelectorAll('.offer-btn');
        const hiddenInput = document.getElementById('selected-offer');
        if (hiddenInput) hiddenInput.value = offerName;
        
        btns.forEach(btn => {
            btn.classList.remove('selected-option');
            if(btn.dataset.value === offerName) btn.classList.add('selected-option');
        });

        let cardId = '';
        if (offerName === 'Pack Essentiel') cardId = 'card-essentiel';
        else if (offerName === 'Pack Vitrine Artisan') cardId = 'card-vitrine';
        else if (offerName === 'Pack Premium') cardId = 'card-premium';

        document.querySelectorAll('.pricing-card').forEach(card => {
            card.classList.remove('gold-selected-card');
            const badge = card.querySelector('.gold-badge');
            if(badge) badge.remove();
        });

        const selectedCard = document.getElementById(cardId);
        if (selectedCard) {
            selectedCard.classList.add('gold-selected-card');
            const badge = document.createElement('div');
            badge.className = 'gold-badge absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-400 text-dark-950 font-bold text-xs px-3 py-1 rounded-full shadow-lg z-50 animate-pop-in flex items-center gap-1';
            badge.innerHTML = '<i class="ph-fill ph-star"></i> Pack Sélectionné';
            selectedCard.appendChild(badge);
        }
        
        updateTotalDisplay();
    };
    
    const maintenanceToggle = document.getElementById('maintenance-toggle');
    if (maintenanceToggle) {
        maintenanceToggle.addEventListener('change', () => {
            const cardSerenite = document.getElementById('card-serenite');
            if (cardSerenite) {
                if (maintenanceToggle.checked) {
                    cardSerenite.classList.add('serenity-selected-card');
                } else {
                    cardSerenite.classList.remove('serenity-selected-card');
                }
            }
            updateTotalDisplay();
        });
    }
    
    window.scrollToContactWithMaintenance = function() {
        const checkbox = document.getElementById('maintenance-toggle');
        if (checkbox) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        }
        const contactSection = document.getElementById('contact');
        if (contactSection) contactSection.scrollIntoView({ behavior: 'smooth' });
    };

    document.querySelectorAll('.offer-btn').forEach(btn => {
        btn.addEventListener('click', () => preselectOffer(btn.dataset.value));
    });

    // --- 3.1 LOGIQUE CHAMPS AVANCÉS (TOGGLE) ---
    const toggleBtn = document.getElementById('toggle-details');
    const advancedFields = document.getElementById('advanced-fields');
    if (toggleBtn && advancedFields) {
        toggleBtn.addEventListener('click', () => {
            const isHidden = advancedFields.classList.contains('hidden');
            const icon = toggleBtn.querySelector('i');
            const text = toggleBtn.querySelector('span');
            
            if (isHidden) {
                advancedFields.classList.remove('hidden');
                advancedFields.style.opacity = '0';
                advancedFields.style.transform = 'translateY(-10px)';
                advancedFields.style.transition = 'all 0.5s ease';
                setTimeout(() => {
                    advancedFields.style.opacity = '1';
                    advancedFields.style.transform = 'translateY(0)';
                }, 50);
                
                if(icon) icon.className = "ph-bold ph-minus-circle";
                if(text) text.textContent = "Masquer les détails";
            } else {
                advancedFields.classList.add('hidden');
                if(icon) icon.className = "ph-bold ph-plus-circle";
                if(text) text.textContent = "Gagner du temps (Compléter mon projet)";
            }
        });
    }

    function getCheckedValues(name) {
        return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
            .map(cb => cb.value)
            .join(', ');
    }
    function getRadioValue(name) {
        const radio = document.querySelector(`input[name="${name}"]:checked`);
        return radio ? radio.value : '';
    }

    const form = document.getElementById('booking-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const date = document.getElementById('selected-date').value;
            const time = document.getElementById('selected-time').value;

            if(!date || !time) {
                alert("Merci de sélectionner une date et une heure de RDV.");
                return;
            }

            const btn = document.getElementById('submit-btn');
            const planeIcon = document.getElementById('plane-anim');
            const btnText = btn.querySelector('.btn-text');
            const successText = btn.querySelector('.success-text');

            if (btnText) btnText.style.opacity = '0';
            if (planeIcon) {
                planeIcon.classList.add('animate-send');
                planeIcon.style.opacity = '1';
            }

            setTimeout(() => {
                btn.classList.add('bg-accent-400', 'border-accent-400');
                if (planeIcon) planeIcon.style.display = 'none';
                if (successText) {
                    successText.style.opacity = '1';
                    successText.style.transform = 'translateY(0)';
                }

                const prenom = document.getElementById('user-firstname').value;
                const nom = document.getElementById('user-name').value;
                const email = document.getElementById('user-email').value;
                const telephone = document.getElementById('user-phone').value;
                const offer = document.getElementById('selected-offer').value || "Aucun pack sélectionné";
                const maintenance = document.getElementById('maintenance-toggle').checked ? "OUI (Pack Sérénité)" : "Non";
                const userMsg = document.getElementById('user-message').value;

                const objectif = getCheckedValues('objectif');
                const cible = getRadioValue('cible');
                const action = getCheckedValues('action');
                const pages = getCheckedValues('pages');
                const inspirations = document.getElementById('field-inspirations').value;
                const identite = getCheckedValues('identite');
                const contenus = getCheckedValues('contenus');
                const contraintes = document.getElementById('field-contraintes').value;
                const delaiType = getRadioValue('delai');
                const delaiDate = document.getElementById('delai-date').value;
                const delaiFinal = delaiType === "Date précise" ? `Pour le ${delaiDate}` : delaiType;
                const reussite = document.getElementById('field-reussite').value;
                
                const subject = `Nouveau Projet - ${prenom} ${nom}`;
                
                let body = `--- NOUVEAU PROJET ---\n\n`;
                body += `👤 CLIENT\nNom : ${prenom} ${nom}\nEmail : ${email}\nTéléphone : ${telephone}\n\n`;
                body += `📅 RENDEZ-VOUS\nDate : ${date}\nHeure : ${time}\n\n`;
                body += `💎 OFFRE & BUDGET\nPack : ${offer}\nMaintenance : ${maintenance}\nTotal Estimé : ${document.getElementById('total-price-display').innerText}\n\n`;
                
                if (objectif || cible || action || pages || inspirations || identite || contenus || contraintes || delaiType || reussite) {
                    body += `📋 DÉTAILS DU PROJET (Formulaire Avancé)\n`;
                    if(objectif) body += `1. Objectif : ${objectif}\n`;
                    if(cible) body += `2. Cible : ${cible}\n`;
                    if(action) body += `3. Action attendue : ${action}\n`;
                    if(pages) body += `4. Pages : ${pages}\n`;
                    if(inspirations) body += `5. Inspirations : ${inspirations}\n`;
                    if(identite) body += `6. Identité visuelle : ${identite}\n`;
                    if(contenus) body += `7. Contenus : ${contenus}\n`;
                    if(contraintes) body += `8. Contraintes : ${contraintes}\n`;
                    if(delaiFinal) body += `9. Délai : ${delaiFinal}\n`;
                    if(reussite) body += `10. Critère de réussite : ${reussite}\n`;
                    body += `\n`;
                }

                if(userMsg) body += `📝 MESSAGE SUPPLÉMENTAIRE\n${userMsg}`;
                
                setTimeout(() => {
                    window.location.href = `mailto:nathan.marzilli@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                }, 1000);
            }, 1500);
        });
    }

    // --- 4. UTILITAIRES D'INTERFACE ---
    const menuBtn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    if (menuBtn && menu) {
        menuBtn.addEventListener('click', () => {
            menu.classList.toggle('translate-x-full');
            const icon = menuBtn.querySelector('i');
            if (icon) {
                icon.classList.toggle('ph-list');
                icon.classList.toggle('ph-x');
            }
        });
    }

    document.querySelectorAll('.mobile-link').forEach(link => {
        link.addEventListener('click', () => {
            if (menu) menu.classList.add('translate-x-full');
            const icon = menuBtn?.querySelector('i');
            if (icon) {
                icon.classList.add('ph-list');
                icon.classList.remove('ph-x');
            }
        });
    });

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