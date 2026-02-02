function leadApp() {
    return {
        // --- ETAT ---
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        notifications: [],
        isLoading: false,
        isSending: false,
        mobileMenuOpen: false,
        searchResults: [],
        leads: [],
        expandedEmail: null,
        generatedEmail: { subject: '', body: '', to: '' },
        dailyGoal: 12,
        monthlyGoal: 300,

        // --- DATA ---
        nichesCategories: {
            "TOP Business": ["Rénovation", "Plombier", "Électricien", "Couvreur", "Charpentier", "Maçon", "Peintre", "Menuisier", "Serrurier"],
            "Santé": ["Kiné", "Ostéopathe", "Dentiste", "Infirmier libéral", "Psychologue"],
            "Food": ["Restaurant", "Pizzeria", "Snack", "Traiteur", "Food Truck"],
            "Tourisme": ["Gîte", "Chambre d'hôtes", "Camping", "Hôtel", "Activités touristiques"],
            "Beauté": ["Coiffeur", "Institut de beauté", "Barbier", "Esthéticienne", "Masseur"]
        },
        targetCities: ["Thonon-les-Bains", "Annemasse", "Annecy", "Chambéry", "Aix-les-Bains", "Bourg-en-Bresse", "Vénissieux", "Villeurbanne", "Saint-Étienne", "Roanne", "Valence", "Montélimar", "Romans-sur-Isère", "Vichy", "Moulins", "Mulhouse", "Colmar", "Belfort", "Besançon", "Dijon", "Chalon-sur-Saône", "Troyes", "Reims", "Nancy", "Metz", "Thionville", "Avignon", "Arles", "Nîmes", "Alès", "Béziers", "Sète", "Narbonne", "Perpignan", "Pau", "Bayonne", "Anglet", "Biarritz", "Tarbes", "Agen", "Montauban", "Albi", "Castres", "La Rochelle", "Niort", "Angoulême", "Poitiers", "Limoges", "Brive-la-Gaillarde", "Cholet", "Saint-Nazaire", "La Roche-sur-Yon", "Laval", "Lorient", "Vannes", "Quimper", "Saint-Brieuc", "Saint-Malo", "Cherbourg", "Caen", "Le Havre", "Orléans", "Blois", "Tours", "Bourges", "Châteauroux", "Chartres", "Amiens", "Beauvais", "Compiègne", "Rouen", "Évreux"],

        notify(message, type = 'success') {
            const id = Date.now();
            this.notifications.push({ id, message, type });
            setTimeout(() => { this.notifications = this.notifications.filter(n => n.id !== id); }, 4000);
        },

        init() { this.loadLeadsFromServer(); },

        get todayCount() { return this.leads.filter(l => l.status !== 'To Contact' && l.lastContactDate && l.lastContactDate.startsWith(new Date().toISOString().slice(0, 10))).length; },
        get followUpCount() { return this.leads.filter(l => this.needsRelance(l)).length; },
        
        needsRelance(lead) {
            if (lead.status !== 'Contacted' || !lead.lastContactDate) return false;
            const diff = Math.ceil(Math.abs(new Date() - new Date(lead.lastContactDate)) / (86400000));
            return diff >= 3; 
        },

        getExistingLead(id) { return this.leads.find(l => l.id === id); },

        // --- SEARCH ---
        async performRealSearch() {
            if (!this.searchLocation) return this.notify('Indiquez une ville', 'error');
            this.isLoading = true;
            this.searchResults = [];
            this.expandedEmail = null;

            try {
                const url = `proxy.php?action=search&q=${encodeURIComponent(this.searchQuery || "Entreprise")}&loc=${encodeURIComponent(this.searchLocation)}`;
                const res = await fetch(url);
                const data = await res.json();

                if (data.error) throw new Error(typeof data.error === 'string' ? data.error : 'Erreur API');
                if (!data.places) throw new Error("Aucun résultat");

                for (let place of data.places) {
                    let existing = this.getExistingLead(place.id);
                    let lead = {
                        id: place.id, name: place.displayName.text, address: place.formattedAddress,
                        phone: place.internationalPhoneNumber || 'Non renseigné',
                        website: place.websiteUri || null, hasWebsite: !!place.websiteUri,
                        tech: existing ? existing.tech : 'Inconnu',
                        email: existing ? existing.email : null,
                        crmStatus: existing ? existing.status : null,
                        // Score Initial
                        score: !!place.websiteUri ? 100 : 90, // On part de 100 (ou 90 si pas de site, car très bon lead)
                        issues: [], 
                        analyzed: !!existing && existing.tech !== 'Inconnu'
                    };
                    
                    if (!place.websiteUri) {
                        lead.issues.push("Pas de Site Web");
                        // Un sans site est un EXCELLENT lead, donc score élevé
                        lead.score = 95; 
                    }
                    this.searchResults.push(lead);
                }
                
                // Analyse technique des sites trouvés
                await this.analyzeWebsitesInResults();
                
                // TRI FINAL : On veut voir les scores "Moyens" (Vieux sites) et "Sans Site" en premier.
                // On inverse le tri : Score élevé = Gros Potentiel de vente (donc site pourri)
                this.searchResults.sort((a, b) => b.score - a.score);

            } catch (err) { this.notify(err.message, 'error'); } 
            finally { this.isLoading = false; }
        },

        async analyzeWebsitesInResults() {
            for (let lead of this.searchResults) {
                if (lead.hasWebsite && !lead.analyzed) {
                    try {
                        const res = await fetch(`proxy.php?action=analyze&url=${encodeURIComponent(lead.website)}`);
                        const data = await res.json();
                        
                        if (!data.error) {
                            if(data.scraped_email) lead.email = data.scraped_email;
                            if(data.scraped_phone && lead.phone === 'Non renseigné') lead.phone = data.scraped_phone;

                            // ALGORITHME DE VÉTUSTÉ "SNIPER"
                            // Plus le score est HAUT, plus le prospect est INTÉRESSANT (donc site pourri)
                            
                            // 1. Mobile First (Critique)
                            if (!data.mobile) {
                                lead.issues.push("Pas Responsive");
                                // Si pas responsive, c'est quasi sûr à refaire
                            } else {
                                lead.score -= 20; // Si responsive, moins intéressant
                            }

                            // 2. Sécurité
                            if (!data.https) {
                                lead.issues.push("Non Sécurisé");
                                lead.score += 10; // Bonus de potentiel vente
                            }

                            // 3. Vitesse (Indice de lourdeur/vieux code)
                            if (data.speed > 2.5) {
                                lead.issues.push("Lent (>2.5s)");
                                lead.score += 5;
                            }

                            // 4. DATE DE COPYRIGHT (Le tueur)
                            if (data.copyright_year && data.copyright_year < 2021) {
                                lead.issues.push(`Vieux Copyright (${data.copyright_year})`);
                                lead.score += 25; // Bingo !
                            }

                            // 5. Tech
                            if (data.tech === 'WordPress' || data.tech === 'Wix') {
                                // Souvent plus dur à vendre une refonte si ils ont déjà un CMS récent
                                lead.score -= 10; 
                            }
                        }
                        lead.analyzed = true;
                    } catch (e) { console.log(e); }
                }
            }
        },

        // COULEURS INDICATEURS
        getScoreColor(score) {
            // Score élevé = Très bon prospect (Site pourri)
            if (score >= 80) return 'border-green-500 bg-green-500/10 text-green-400'; 
            if (score >= 50) return 'border-orange-500 bg-orange-500/10 text-orange-400';
            return 'border-slate-600 bg-slate-600/10 text-slate-500'; // Site récent, dur à vendre
        },

        getIssueColor(issue) {
            if (issue.includes('Pas de Site')) return 'border-red-500 bg-red-500/10 text-red-400';
            if (issue.includes('Vieux')) return 'border-purple-500 bg-purple-500/10 text-purple-400';
            if (issue.includes('Non Sécurisé')) return 'border-orange-500 bg-orange-500/10 text-orange-400';
            return 'border-white/10 bg-white/5 text-slate-400';
        },
        
        getIssueIcon(issue) {
            if (issue.includes('Pas de Site')) return 'ph-globe-x';
            if (issue.includes('Vieux')) return 'ph-clock-counter-clockwise';
            if (issue.includes('Responsive')) return 'ph-device-mobile-slash';
            return 'ph-warning';
        },

        getSearchLink(result) {
            // Recherche Google Intelligente pour trouver l'email
            const q = `"${result.name}" "${this.searchLocation}" email @gmail.com OR @orange.fr OR contact`;
            return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        },

        // --- EMAIL & TEXTE (Ton modèle exact) ---
        generateEmailContent(result) {
            this.generatedEmail.to = result.email || ''; 
            
            // TON TEXTE EXACT (Avec sauts de lignes préservés)
            const body = `Bonjour,

Je me permets de vous contacter car j’accompagne des artisans et professionnels locaux dans la création et la modernisation de leur site internet, avec un objectif simple : vous aider à être visible, crédible et facilement contactable par vos futurs clients.

Aujourd’hui, beaucoup d’entreprises perdent des opportunités faute d’un site clair, à jour et adapté au mobile. Mon rôle est justement de vous éviter cela, en vous proposant une solution clé en main, sans contrainte technique pour vous.

Concrètement, je propose :

👉 La création ou la refonte complète de votre site internet (design moderne, adapté mobile, clair pour vos clients)
Prix : 990 € (paiement unique)

👉 Un accompagnement mensuel à 50 € / mois comprenant :
- l’hébergement du site
- la maintenance technique
- les mises à jour et améliorations
- la mise au goût du jour du contenu si besoin
- un suivi régulier, avec un interlocuteur unique : moi

Mon approche est volontairement humaine et durable : je travaille avec un nombre limité de clients afin d’assurer un vrai suivi, et je reste disponible pour faire évoluer votre site en fonction de votre activité (nouvelles prestations, photos, horaires, saisonnalité, etc.).

Si vous le souhaitez, je vous propose un échange gratuit et sans engagement, simplement pour faire un point sur votre présence actuelle en ligne et voir si un site internet pourrait réellement vous être utile.

👉 Vous pouvez répondre directement à ce mail,
ou, si c’est plus simple pour vous, prendre rendez-vous en ligne via mon portfolio afin de consulter mes disponibilités et choisir le créneau qui vous convient.

Je reste bien entendu à votre disposition.

Bien cordialement,
Nathan`;

            this.generatedEmail.subject = `Visibilité locale pour ${result.name}`;
            this.generatedEmail.body = body;
        },

        // --- BACKEND & HELPERS ---
        async addToCRM(result) {
            const newLead = { id: result.id, name: result.name, city: this.searchLocation, email: result.email || '', phone: result.phone, website: result.website, status: 'To Contact', tech: result.tech || 'Inconnu', lastContactDate: null, addedAt: new Date().toISOString() };
            if(this.getExistingLead(newLead.id)) return;
            this.leads.unshift(newLead);
            await this.saveLeadToServer(newLead);
            this.notify('Ajouté au CRM');
        },

        toggleEmailPanel(result) {
            if (this.expandedEmail === result.id) { this.expandedEmail = null; return; }
            this.expandedEmail = result.id;
            this.generateEmailContent(result);
            if (!this.getExistingLead(result.id)) this.addToCRM(result);
        },

        async sendEmailDirectly(result) {
            if(!this.generatedEmail.to) return this.notify("Veuillez trouver et coller l'email d'abord.", "error");
            this.isSending = true;
            try {
                const res = await fetch('proxy.php?action=send_email', { method: 'POST', body: JSON.stringify(this.generatedEmail) });
                const data = await res.json();
                if (data.success) { this.notify("Email envoyé !"); this.markAsContacted(result); this.expandedEmail = null; }
                else { this.notify("Erreur envoi PHP. Utilise Gmail.", "error"); this.openGmail(result); }
            } catch(e) { this.notify("Erreur: " + e.message, "error"); } finally { this.isSending = false; }
        },

        openGmail(result) {
            window.open(`mailto:${this.generatedEmail.to}?subject=${encodeURIComponent(this.generatedEmail.subject)}&body=${encodeURIComponent(this.generatedEmail.body)}`, '_blank');
            this.markAsContacted(result);
        },

        async markAsContacted(l) {
            const s = this.searchResults.find(r => r.id === l.id); if(s) s.crmStatus = 'Contacted';
            const dbL = this.leads.find(i => i.id === l.id);
            if (dbL) { dbL.status = 'Contacted'; dbL.lastContactDate = new Date().toISOString(); dbL.email = this.generatedEmail.to; await this.saveLeadToServer(dbL); }
        },

        copyEmail() { navigator.clipboard.writeText(this.generatedEmail.body); this.notify("Copié !"); },
        
        async loadLeadsFromServer() { try { const r = await fetch('proxy.php?action=get_leads'); const d = await r.json(); if(Array.isArray(d)) this.leads = d.reverse(); } catch(e){} },
        async saveLeadToServer(l) { const c=JSON.parse(JSON.stringify(l)); delete c.issues; delete c.score; delete c.crmStatus; delete c.analyzed; await fetch('proxy.php?action=save_lead', { method:'POST', body:JSON.stringify(c) }); },
        async removeLead(l) { this.leads=this.leads.filter(i=>i.id!==l.id); await fetch(`proxy.php?action=delete_lead&id=${l.id}`); this.notify("Supprimé"); },
        async updateStatus(l) { if(l.status==='Contacted') l.lastContactDate=new Date().toISOString(); await this.saveLeadToServer(l); },
        exportCSV() { let c="Nom,Email,Tel,Status\n"; this.leads.forEach(l=>c+=`${l.name.replace(/,/g,' ')},${l.email},${l.phone},${l.status}\n`); const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURI(c); a.download="leads.csv"; a.click(); }
    }
}