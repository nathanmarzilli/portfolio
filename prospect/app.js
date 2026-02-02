/**
 * LEADMACHINE V4.0 - APP.JS
 * Fonctionnalités:
 * - State Management (AlpineJS)
 * - Gestion de la "Pain-based Qualification" (Injection texte email)
 * - Gestion des dates de relance automatique (J+3, J+7)
 * - Tri intelligent des leads (Score Vétusté)
 * - Gestion multi-canaux (LastContactChannel)
 */

function leadApp() {
    return {
        // --- ETAT ---
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        filterHighPot: false, // Nouveau filtre Score > 75
        notifications: [],
        isLoading: false,
        isSending: false,
        mobileMenuOpen: false,
        searchResults: [],
        leads: [],
        expandedEmail: null,
        generatedEmail: { subject: '', body: '', to: '' },
        dailyGoal: 12,

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
            if (!lead.nextFollowUpDate || lead.status === 'Won') return false;
            return new Date(lead.nextFollowUpDate) <= new Date();
        },
        
        formatDate(dateStr) {
            if(!dateStr) return '';
            return new Date(dateStr).toLocaleDateString('fr-FR');
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
                        // Nouveaux champs V4
                        contactCount: existing ? existing.contactCount : 0,
                        lastContactChannel: existing ? existing.lastContactChannel : null,
                        nextFollowUpDate: existing ? existing.nextFollowUpDate : null,
                        
                        score: !!place.websiteUri ? 100 : 90, 
                        issues: [], 
                        painPointsDetected: '',
                        analyzed: !!existing && existing.tech !== 'Inconnu',
                        socials: existing ? existing.socials : { facebook: false, instagram: false },
                        probableEmails: []
                    };
                    
                    if (!place.websiteUri) {
                        lead.issues.push("Pas de Site Web");
                        lead.score = 95; // Top priorité
                    }
                    this.searchResults.push(lead);
                }
                
                await this.analyzeWebsitesInResults();
                // Tri par score (Potentiel décroissant)
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
                            
                            // Nouveautés V4 : Socials & Probable Emails
                            if(data.socials) lead.socials = data.socials;
                            if(data.probable_emails) lead.probableEmails = data.probable_emails;

                            // Scoring & Pain Points
                            if (!data.mobile) {
                                lead.issues.push("Pas Responsive");
                            } else {
                                lead.score -= 20; 
                            }

                            if (!data.https) {
                                lead.issues.push("Non Sécurisé");
                                lead.score += 10;
                            }

                            if (data.speed > 2.5) {
                                lead.issues.push("Lent (>2.5s)");
                                lead.score += 5;
                            }

                            if (data.copyright_year && data.copyright_year < 2021) {
                                lead.issues.push(`Vieux Copyright (${data.copyright_year})`);
                                lead.score += 25;
                            }

                            if (data.tech === 'WordPress' || data.tech === 'Wix') {
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
            if (score >= 80) return 'border-green-500 bg-green-500/10 text-green-400'; 
            if (score >= 50) return 'border-orange-500 bg-orange-500/10 text-orange-400';
            return 'border-slate-600 bg-slate-600/10 text-slate-500';
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
            // Recherche affinée pour trouver l'email
            const q = `"${result.name}" "${this.searchLocation}" email OR contact OR "@gmail.com" site:facebook.com OR site:instagram.com`;
            return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        },

        // --- EMAIL & PAIN POINTS ---
        generateEmailContent(result) {
            this.generatedEmail.to = result.email || (result.probableEmails && result.probableEmails.length > 0 ? result.probableEmails[0] : ''); 
            
            // 1. Détection des Pain Points pour injection
            let painPointsText = "";
            let painSummary = "";
            
            if (result.issues.includes("Pas Responsive")) {
                painPointsText += "- votre site n'est pas adapté aux mobiles (très pénalisant pour Google aujourd'hui)\n";
                painSummary += "[Mobile] ";
            }
            if (result.issues.includes("Lent (>2.5s)")) {
                painPointsText += "- le chargement semble lent, ce qui fait souvent fuir les visiteurs\n";
                painSummary += "[Lent] ";
            }
            if (result.issues.some(i => i.includes("Vieux"))) {
                painPointsText += "- le design semble dater de quelques années et ne reflète pas la qualité de votre travail\n";
                painSummary += "[Vieux] ";
            }
            if (result.issues.includes("Non Sécurisé")) {
                painPointsText += "- le site apparaît comme 'Non Sécurisé', ce qui effraie les clients\n";
                painSummary += "[Sécurité] ";
            }

            // Fallback si pas de problème majeur détecté mais qu'on veut pitcher
            if (painPointsText === "") {
                painPointsText = "- votre site pourrait être modernisé pour attirer plus de clients locaux\n";
            }
            
            result.painPointsDetected = painSummary;

            // 2. Template
            const body = `Bonjour,

Je me permets de vous contacter car j’ai analysé votre présence en ligne pour ${result.name}.

En regardant votre site, j’ai remarqué quelques points qui freinent sans doute votre visibilité :
${painPointsText}
Aujourd’hui, beaucoup d’artisans perdent des opportunités à cause de ces détails techniques. C'est dommage car votre activité mérite d'être mise en valeur.

Je propose une solution simple et accessible (990€ tout inclus) pour remettre votre site au goût du jour, le sécuriser et surtout vous amener des clients.

Pas de bla-bla technique, je m'occupe de tout.

Si vous le souhaitez, je peux vous envoyer une maquette ou un exemple de ce que je pourrais faire pour vous.

Vous pouvez me répondre directement ici, ou on peut en discuter rapidement par téléphone.

Bien cordialement,
Nathan
Spécialiste visibilité locale`;

            this.generatedEmail.subject = `Question sur le site de ${result.name}`;
            this.generatedEmail.body = body;
        },

        // --- BACKEND & HELPERS ---
        async addToCRM(result) {
            const newLead = { 
                id: result.id, name: result.name, city: this.searchLocation, 
                email: result.email || '', phone: result.phone, website: result.website, 
                status: 'To Contact', tech: result.tech || 'Inconnu', 
                lastContactDate: null, 
                addedAt: new Date().toISOString(),
                // V4 Fields
                contactCount: 0,
                lastContactChannel: null,
                nextFollowUpDate: null,
                socials: result.socials || {}
            };
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
            if(!this.generatedEmail.to) return this.notify("Aucun email destinataire.", "error");
            this.isSending = true;
            try {
                const res = await fetch('proxy.php?action=send_email', { method: 'POST', body: JSON.stringify(this.generatedEmail) });
                const data = await res.json();
                if (data.success) { 
                    this.notify("Email envoyé !"); 
                    this.markAsContacted(result, 'Email'); 
                    this.expandedEmail = null; 
                }
                else { 
                    this.notify("Erreur PHP Mail. Ouverture Gmail...", "error"); 
                    this.openGmail(result); 
                }
            } catch(e) { this.notify("Erreur: " + e.message, "error"); } finally { this.isSending = false; }
        },

        openGmail(result) {
            window.open(`mailto:${this.generatedEmail.to}?subject=${encodeURIComponent(this.generatedEmail.subject)}&body=${encodeURIComponent(this.generatedEmail.body)}`, '_blank');
            this.markAsContacted(result, 'Email');
        },

        async updateLeadChannel(result, channel) {
            this.markAsContacted(result, channel);
            this.notify(`Marqué comme contacté via ${channel}`);
        },

        async markAsContacted(l, channel) {
            const s = this.searchResults.find(r => r.id === l.id); if(s) s.crmStatus = 'Contacted';
            const dbL = this.leads.find(i => i.id === l.id);
            if (dbL) { 
                dbL.status = 'Contacted'; 
                dbL.lastContactDate = new Date().toISOString(); 
                dbL.email = this.generatedEmail.to; 
                
                // V4 Logic: Smart Relance
                dbL.contactCount = (dbL.contactCount || 0) + 1;
                dbL.lastContactChannel = channel;
                
                // Calcul prochaine relance (J+3 après 1er contact, J+7 après 2eme)
                const daysToAdd = dbL.contactCount === 1 ? 3 : 7;
                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + daysToAdd);
                dbL.nextFollowUpDate = nextDate.toISOString();

                await this.saveLeadToServer(dbL); 
            }
        },

        copyEmail() { navigator.clipboard.writeText(this.generatedEmail.body); this.notify("Copié !"); },
        
        async loadLeadsFromServer() { try { const r = await fetch('proxy.php?action=get_leads'); const d = await r.json(); if(Array.isArray(d)) this.leads = d.reverse(); } catch(e){} },
        async saveLeadToServer(l) { 
            const c=JSON.parse(JSON.stringify(l)); 
            // On nettoie les objets UI avant sauvegarde DB
            delete c.issues; delete c.score; delete c.crmStatus; delete c.analyzed; delete c.painPointsDetected; delete c.probableEmails;
            await fetch('proxy.php?action=save_lead', { method:'POST', body:JSON.stringify(c) }); 
        },
        async removeLead(l) { this.leads=this.leads.filter(i=>i.id!==l.id); await fetch(`proxy.php?action=delete_lead&id=${l.id}`); this.notify("Supprimé"); },
        async updateStatus(l) { 
            if(l.status==='Contacted') {
                 if(!l.lastContactDate) l.lastContactDate=new Date().toISOString();
            }
            if (l.status === 'Won') l.nextFollowUpDate = null; // Pas de relance si gagné
            await this.saveLeadToServer(l); 
        },
        exportCSV() { let c="Nom,Email,Tel,Status,Canal,Relances\n"; this.leads.forEach(l=>c+=`${l.name.replace(/,/g,' ')},${l.email},${l.phone},${l.status},${l.lastContactChannel||''},${l.contactCount||0}\n`); const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURI(c); a.download="leads_sniper.csv"; a.click(); }
    }
}