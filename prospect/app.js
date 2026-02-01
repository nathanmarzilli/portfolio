function leadApp() {
    return {
        // --- ETAT ---
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        notifications: [], // Pour les Toasts
        isLoading: false,
        isSending: false,
        mobileMenuOpen: false,
        searchResults: [],
        leads: [],
        expandedEmail: null,
        generatedEmail: { subject: '', body: '', to: '' },
        dailyGoal: 12,
        monthlyGoal: 300,

        // --- DATA (Listes Complètes) ---
        nichesCategories: {
            "TOP Business": ["Rénovation", "Plombier", "Électricien", "Couvreur", "Charpentier", "Maçon", "Peintre", "Menuisier", "Serrurier"],
            "Santé": ["Kiné", "Ostéopathe", "Dentiste", "Infirmier libéral", "Psychologue"],
            "Food": ["Restaurant", "Pizzeria", "Snack", "Traiteur", "Food Truck"],
            "Tourisme": ["Gîte", "Chambre d'hôtes", "Camping", "Hôtel", "Activités touristiques"],
            "Beauté": ["Coiffeur", "Institut de beauté", "Barbier", "Esthéticienne", "Masseur"]
        },
        targetCities: [
            "Thonon-les-Bains", "Annemasse", "Annecy", "Chambéry", "Aix-les-Bains", 
            "Bourg-en-Bresse", "Vénissieux", "Villeurbanne", "Saint-Étienne", "Roanne",
            "Valence", "Montélimar", "Romans-sur-Isère", "Vichy", "Moulins",
            "Mulhouse", "Colmar", "Belfort", "Besançon", "Dijon", "Chalon-sur-Saône",
            "Troyes", "Reims", "Nancy", "Metz", "Thionville",
            "Avignon", "Arles", "Nîmes", "Alès", "Béziers", "Sète", "Narbonne",
            "Perpignan", "Pau", "Bayonne", "Anglet", "Biarritz", "Tarbes",
            "Agen", "Montauban", "Albi", "Castres",
            "La Rochelle", "Niort", "Angoulême", "Poitiers", "Limoges", "Brive-la-Gaillarde",
            "Cholet", "Saint-Nazaire", "La Roche-sur-Yon", "Laval", "Lorient", "Vannes",
            "Quimper", "Saint-Brieuc", "Saint-Malo", "Cherbourg", "Caen", "Le Havre",
            "Orléans", "Blois", "Tours", "Bourges", "Châteauroux", "Chartres",
            "Amiens", "Beauvais", "Compiègne", "Rouen", "Évreux"
        ],

        // --- SYSTEME DE NOTIFICATION (NOUVEAU) ---
        notify(message, type = 'success') {
            const id = Date.now();
            this.notifications.push({ id, message, type });
            // Auto-suppression après 4 secondes
            setTimeout(() => {
                this.notifications = this.notifications.filter(n => n.id !== id);
            }, 4000);
        },

        // --- HELPER ICONS ---
        getCategoryIcon(name) {
            const icons = { "TOP Business": "ph-trend-up", "Santé": "ph-heartbeat", "Food": "ph-fork-knife", "Tourisme": "ph-airplane-tilt", "Beauté": "ph-sparkle" };
            return icons[name] || "ph-briefcase";
        },

        // --- INITIALISATION ---
        init() {
            this.loadLeadsFromServer();
        },

        // --- DASHBOARD ---
        get todayCount() {
            const today = new Date().toISOString().slice(0, 10);
            return this.leads.filter(l => l.status !== 'To Contact' && l.lastContactDate && l.lastContactDate.startsWith(today)).length;
        },
        get monthCount() {
            const currentMonth = new Date().toISOString().slice(0, 7);
            return this.leads.filter(l => l.status !== 'To Contact' && l.lastContactDate && l.lastContactDate.startsWith(currentMonth)).length;
        },
        get followUpCount() {
            return this.leads.filter(l => this.needsRelance(l)).length;
        },

        // --- LOGIQUE METIER ---
        needsRelance(lead) {
            if (lead.status !== 'Contacted' || !lead.lastContactDate) return false;
            const diffDays = Math.ceil(Math.abs(new Date() - new Date(lead.lastContactDate)) / (1000 * 60 * 60 * 24));
            return diffDays >= 3; 
        },

        formatDate(dateStr) {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        },

        getExistingLead(id) {
            return this.leads.find(l => l.id === id);
        },

        // --- MOTEUR DE RECHERCHE (CORRECTIF ERREUR OBJECT) ---
        async performRealSearch() {
            let query = this.searchQuery;
            if (!query) query = "Entreprise"; 
            if (!this.searchLocation) return this.notify('Merci d\'indiquer une ville !', 'error');
            
            this.isLoading = true;
            this.searchResults = [];
            this.expandedEmail = null;

            try {
                const url = `proxy.php?action=search&q=${encodeURIComponent(query)}&loc=${encodeURIComponent(this.searchLocation)}`;
                const response = await fetch(url);
                const data = await response.json();

                // CORRECTION ERREUR JSON : On vérifie si data.error est un objet ou une string
                if (data.error) {
                    let msg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
                    throw new Error(msg);
                }
                
                if (!data.places || data.places.length === 0) throw new Error("Aucun résultat trouvé pour cette zone.");

                for (let place of data.places) {
                    let existing = this.getExistingLead(place.id);
                    let lead = {
                        id: place.id,
                        name: place.displayName.text,
                        address: place.formattedAddress,
                        phone: place.internationalPhoneNumber || 'Non renseigné',
                        website: place.websiteUri || null,
                        hasWebsite: !!place.websiteUri,
                        tech: existing ? existing.tech : 'Inconnu',
                        email: existing ? existing.email : null,
                        crmStatus: existing ? existing.status : null,
                        lastContactDate: existing ? existing.lastContactDate : null,
                        https: true, speed: 0, score: !!place.websiteUri ? 50 : 0, issues: [], 
                        analyzed: !!existing && existing.tech !== 'Inconnu'
                    };
                    if (!place.websiteUri) lead.issues.push("Pas de site web");
                    this.searchResults.push(lead);
                }

                this.searchResults.sort((a, b) => a.score - b.score);
                this.analyzeWebsitesInResults();

            } catch (err) {
                // CORRECTION : On affiche l'erreur proprement via la notification
                this.notify(err.message, 'error');
            } finally {
                this.isLoading = false;
            }
        },

        // --- ANALYSE & SCRAPING ---
        async analyzeWebsitesInResults() {
            for (let lead of this.searchResults) {
                if (lead.hasWebsite && !lead.analyzed) {
                    try {
                        const res = await fetch(`proxy.php?action=analyze&url=${encodeURIComponent(lead.website)}`);
                        const analysis = await res.json();
                        
                        if (!analysis.error) {
                            lead.https = analysis.https;
                            lead.speed = analysis.speed;
                            if(analysis.scraped_email) lead.email = analysis.scraped_email;
                            if(analysis.scraped_phone && lead.phone === 'Non renseigné') lead.phone = analysis.scraped_phone;

                            if (!analysis.mobile) { lead.issues.push("Pas Responsive"); lead.score -= 20; }
                            if (!analysis.https) { lead.issues.push("Non Sécurisé"); lead.score -= 10; }
                            if (analysis.speed > 3) { lead.issues.push("Lent (" + analysis.speed.toFixed(1) + "s)"); lead.score -= 5; }
                            if (analysis.tech !== 'HTML/Autre') { lead.tech = analysis.tech; }
                        }
                        lead.analyzed = true;
                    } catch (e) { console.log(e); }
                }
            }
            this.searchResults.sort((a, b) => a.score - b.score);
        },

        getScoreColor(score) {
            if (score <= 15) return 'border-danger-500 bg-danger-500/10 text-danger-500'; 
            if (score <= 40) return 'border-warning-500 bg-warning-500/10 text-warning-500';
            return 'border-accent-500 bg-accent-500/10 text-accent-500';
        },

        // --- ACTIONS CRM ---
        async addToCRM(result) {
            const newLead = {
                id: result.id, name: result.name, city: this.searchLocation,
                email: result.email || '', phone: result.phone, website: result.website,
                status: 'To Contact', tech: result.tech || 'Inconnu', lastContactDate: null,
                addedAt: new Date().toISOString(), confirmDelete: false 
            };
            if(this.getExistingLead(newLead.id)) return;
            this.leads.unshift(newLead);
            await this.saveLeadToServer(newLead);
            this.notify('Prospect ajouté au CRM');
        },

        toggleEmailPanel(result) {
            if (this.expandedEmail === result.id) { this.expandedEmail = null; return; }
            this.expandedEmail = result.id;
            this.generateEmailContent(result);
            if (!this.getExistingLead(result.id)) this.addToCRM(result);
        },

        // --- EMAIL GENERATOR (Intelligent) ---
        generateEmailContent(result) {
            this.generatedEmail.to = result.email || ''; 
            const isRelance = result.crmStatus === 'Contacted';
            const isNoSite = !result.website;
            
            if (isRelance) {
                this.generatedEmail.subject = `Suite à mon précédent mail – ${result.name}`;
                let body = `Bonjour,\n\nJe me permets de revenir vers vous car je n'ai pas eu de retour concernant mon précédent message.\n\n`;
                body += `Je suis convaincu qu'une meilleure visibilité numérique pourrait faire la différence pour ${result.name} à ${this.searchLocation}.\n\n`;
                body += `Avez-vous eu le temps d'y réfléchir ?\n\nBien à vous,\nNathan Marzilli`;
                this.generatedEmail.body = body;
                return;
            }

            this.generatedEmail.subject = `Visibilité locale pour ${result.name}`;
            let body = `Bonjour,\n\nJe me permets de vous contacter car j’accompagne les professionnels de ${this.searchLocation} (comme ${result.name}) dans leur développement numérique.\n\n`;
            if (isNoSite) body += `J'ai remarqué que vous n'aviez pas de site internet. C'est aujourd'hui le premier réflexe de vos clients.\n`;
            else if (result.issues.includes('Pas Responsive')) body += `Votre site actuel semble difficile à lire sur mobile, ce qui peut faire fuir des clients potentiels.\n`;
            else body += `Avoir un site, c'est bien. Avoir un site qui convertit, c'est mieux.\n`;

            body += `\nJe propose une création clé en main pour 990 € + un suivi mensuel complet (50 €/mois).\n\n`;
            body += `Si cela vous intéresse, je vous invite à répondre à ce mail ou à consulter mes disponibilités sur mon site.\n\n`;
            body += `Cordialement,\nNathan Marzilli`; 
            this.generatedEmail.body = body;
        },

        async sendEmailDirectly(result) {
            if(!this.generatedEmail.to) return this.notify("Adresse email manquante. Cherchez-la sur Google.", "error");
            
            this.isSending = true;
            try {
                const res = await fetch('proxy.php?action=send_email', {
                    method: 'POST', body: JSON.stringify(this.generatedEmail)
                });
                const data = await res.json();
                
                if (data.success) {
                    this.notify("Email envoyé avec succès !");
                    this.markAsContacted(result);
                    this.expandedEmail = null; 
                } else {
                    this.notify("Erreur d'envoi PHP. Passage sur Gmail.", "error");
                    this.openGmail(result);
                }
            } catch(e) {
                this.notify("Erreur technique: " + e.message, "error");
            } finally {
                this.isSending = false;
            }
        },

        openGmail(result) {
            const mailto = `mailto:${this.generatedEmail.to}?subject=${encodeURIComponent(this.generatedEmail.subject)}&body=${encodeURIComponent(this.generatedEmail.body)}`;
            window.open(mailto, '_blank');
            this.markAsContacted(result);
        },

        async markAsContacted(leadData) {
            const searchRes = this.searchResults.find(r => r.id === leadData.id);
            if(searchRes) searchRes.crmStatus = 'Contacted';

            const lead = this.leads.find(l => l.id === leadData.id);
            if (lead) {
                lead.status = lead.status === 'Contacted' ? 'Relance' : 'Contacted';
                lead.lastContactDate = new Date().toISOString();
                lead.email = this.generatedEmail.to;
                await this.saveLeadToServer(lead);
            }
        },

        // --- BACKEND ---
        async loadLeadsFromServer() {
            try {
                const res = await fetch('proxy.php?action=get_leads');
                const data = await res.json();
                if (Array.isArray(data)) this.leads = data.reverse();
            } catch (e) { console.error(e); }
        },

        async saveLeadToServer(lead) {
            const cleanLead = JSON.parse(JSON.stringify(lead));
            // Nettoyage données temporaires
            delete cleanLead.confirmDelete; delete cleanLead.crmStatus; delete cleanLead.analyzed;
            delete cleanLead.score; delete cleanLead.issues; delete cleanLead.speed;

            await fetch('proxy.php?action=save_lead', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cleanLead)
            });
        },

        async removeLead(lead) {
            if (!lead.confirmDelete) {
                lead.confirmDelete = true;
                setTimeout(() => { lead.confirmDelete = false; }, 3000);
                return;
            }
            this.leads = this.leads.filter(l => l.id !== lead.id);
            await fetch(`proxy.php?action=delete_lead&id=${lead.id}`);
            this.notify("Prospect supprimé");
        },

        async updateStatus(lead) {
            if (lead.status === 'To Contact') lead.lastContactDate = null;
            else if (lead.status === 'Contacted' && !lead.lastContactDate) lead.lastContactDate = new Date().toISOString();
            await this.saveLeadToServer(lead);
            this.notify("Statut mis à jour");
        },

        copyEmail() {
            navigator.clipboard.writeText(this.generatedEmail.body);
            this.notify("Texte copié dans le presse-papier");
        },
        
        exportCSV() {
            let csv = "Nom,Email,Tel,Ville,Status,Dernier Contact\n";
            this.leads.forEach(l => {
                const cleanName = (l.name||'').replace(/,/g,' ');
                csv += `${cleanName},${l.email||''},${l.phone},${l.city},${l.status},${l.lastContactDate || ''}\n`;
            });
            const link = document.createElement("a");
            link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
            link.download = "prospects_leadmachine.csv";
            link.click();
        }
    }
}