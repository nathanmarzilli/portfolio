function leadApp() {
    return {
        // --- ETAT DE L'APPLICATION ---
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        isLoading: false,
        searchResults: [],
        leads: [],
        expandedEmail: null, // ID du prospect dont l'email est ouvert
        generatedEmail: { subject: '', body: '' },
        dailyGoal: 12, // Objectif quotidien pour atteindre 8 projets/mois

        // --- INTELLIGENCE COMMERCIALE (Les cibles rentables) ---
        topNiches: [
            "Rénovation", "Plombier", "Électricien", "Couvreur", "Paysagiste",
            "Avocat", "Notaire", "Comptable", "Architecte",
            "Restaurant", "Traiteur", "Hôtel", "Gîte",
            "Dentiste", "Ostéopathe", "Clinique Vétérinaire",
            "Garage Automobile", "Salle de Sport", "Agence Immobilière", "Boutique de Mode"
        ],

        // --- STRATÉGIE GÉOGRAPHIQUE ---
        targetCities: [
            { name: "Thonon-les-Bains" },
            { name: "Évian-les-Bains" },
            { name: "Annemasse" },
            { name: "Annecy" },
            { name: "Lausanne" },
            { name: "Genève" },
            { name: "Chambéry" },
            { name: "Lyon" }
        ],

        // --- DÉMARRAGE ---
        init() {
            this.loadLeadsFromServer();
        },

        // --- CALCULS MOTIVATION (Dashboard) ---
        get todayCount() {
            const today = new Date().toISOString().slice(0, 10);
            return this.leads.filter(l => l.lastContactDate && l.lastContactDate.startsWith(today)).length;
        },

        get followUpCount() {
            return this.leads.filter(l => this.needsRelance(l)).length;
        },

        get motivationText() {
            const pct = (this.todayCount / this.dailyGoal) * 100;
            if (pct === 0) return "La journée commence ! Objectif : 12 contacts.";
            if (pct < 50) return "C'est bien, continue ! Le prochain client t'attend.";
            if (pct < 100) return "Presque là ! Encore quelques efforts pour tes 8 projets.";
            return "🔥 EXCELLENT ! Objectif atteint. Repose-toi ou prends de l'avance.";
        },

        // --- LOGIQUE MÉTIER ---
        
        // Faut-il relancer ce prospect ? (Si contacté il y a > 3 jours)
        needsRelance(lead) {
            if (lead.status !== 'Contacted') return false;
            if (!lead.lastContactDate) return false;
            
            const lastContact = new Date(lead.lastContactDate);
            const now = new Date();
            const diffTime = Math.abs(now - lastContact);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            return diffDays >= 3; 
        },

        formatDate(dateStr) {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        },

        isInCRM(id) {
            return this.leads.some(l => l.id === id);
        },

        // --- MOTEUR DE RECHERCHE ---
        async performRealSearch() {
            // Si pas de mot clé, on met "Entreprise" par défaut
            let query = this.searchQuery;
            if (!query) query = "Entreprise"; 

            if (!this.searchLocation) return alert('Indiquez une ville !');
            
            this.isLoading = true;
            this.searchResults = [];
            this.expandedEmail = null;

            try {
                // Appel Proxy (Serveur)
                const url = `proxy.php?action=search&q=${encodeURIComponent(query)}&loc=${encodeURIComponent(this.searchLocation)}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.error) throw new Error(data.error);
                if (!data.places || data.places.length === 0) throw new Error("Aucun résultat trouvé. Changez de ville ou d'activité.");

                // Mapping des données
                for (let place of data.places) {
                    let lead = {
                        id: place.id,
                        name: place.displayName.text,
                        address: place.formattedAddress,
                        phone: place.internationalPhoneNumber || 'Non renseigné',
                        website: place.websiteUri || null,
                        hasWebsite: !!place.websiteUri,
                        tech: 'Inconnu',
                        isOld: false,
                        // Score par défaut : 50 (Moyen). Si pas de site : 0 (Prioritaire)
                        score: !!place.websiteUri ? 50 : 0, 
                        issues: !place.websiteUri ? ['Pas de site web'] : [],
                        analyzed: false
                    };
                    this.searchResults.push(lead);
                }

                // TRI INITIAL : Les "Pas de site" en premier
                this.searchResults.sort((a, b) => a.score - b.score);

                // Lancer l'analyse technique des sites existants
                this.analyzeWebsitesInResults();

            } catch (err) {
                alert("Erreur : " + err.message);
            } finally {
                this.isLoading = false;
            }
        },

        async analyzeWebsitesInResults() {
            for (let lead of this.searchResults) {
                // On analyse seulement s'il a un site et pas encore analysé
                if (lead.hasWebsite && !lead.analyzed) {
                    try {
                        const res = await fetch(`proxy.php?action=analyze&url=${encodeURIComponent(lead.website)}`);
                        const analysis = await res.json();
                        
                        if (!analysis.error) {
                            // Détection problème Mobile
                            if (!analysis.mobile) {
                                lead.issues.push("Pas responsive");
                                lead.score -= 20; // Le score baisse = Priorité augmente
                                lead.isOld = true;
                            }
                            if (analysis.tech !== 'HTML/Autre') {
                                lead.tech = analysis.tech;
                            }
                        }
                        lead.analyzed = true;
                    } catch (e) { console.log(e); }
                }
            }
            // TRI SECONDAIRE : On remonte les sites vétustes analysés
            this.searchResults.sort((a, b) => a.score - b.score);
        },

        getScoreColor(score) {
            // Code couleur : Rouge = Opportunité en or, Vert = Site probablement OK
            if (score <= 20) return 'border-danger-500 bg-danger-500/10 text-danger-500';
            if (score <= 40) return 'border-warning-500 bg-warning-500/10 text-warning-500';
            return 'border-accent-500 bg-accent-500/10 text-accent-500';
        },

        // --- ACTIONS CRM & EMAIL ---

        async addToCRM(result) {
            const newLead = {
                id: result.id,
                name: result.name,
                city: this.searchLocation,
                email: '', // Sera rempli manuellement
                phone: result.phone,
                website: result.website,
                status: 'To Contact',
                tech: result.tech || 'Inconnu',
                lastContactDate: null,
                addedAt: new Date().toISOString()
            };
            
            if(this.isInCRM(newLead.id)) return;

            this.leads.unshift(newLead);
            await this.saveLeadToServer(newLead);
        },

        // Affiche/Masque le panneau d'email sous la fiche (No Popup)
        toggleEmailPanel(result) {
            if (this.expandedEmail === result.id) {
                this.expandedEmail = null;
                return;
            }
            
            this.expandedEmail = result.id;
            this.generateEmailContent(result);
            
            // Auto-Add to CRM
            if (!this.isInCRM(result.id)) {
                this.addToCRM(result);
            }
        },

        generateEmailContent(result) {
            const isNoSite = !result.website;
            const isOld = result.issues.includes('Pas responsive');
            
            // Sujet
            this.generatedEmail.subject = isNoSite 
                ? `Question visibilité pour ${result.name}` 
                : `Optimisation mobile pour ${result.name}`;

            // Contenu (Copywriting AIDA)
            let body = `Bonjour,\n\n`;
            body += `Je suis Nathan Marzilli, développeur web indépendant dans la région.\n`;
            body += `En cherchant les ${this.searchQuery || 'entreprises'} à ${this.searchLocation}, je suis tombé sur votre activité.\n\n`;
            
            if (isNoSite) {
                body += `J'ai vu que vous n'aviez pas de site internet. Aujourd'hui, 80% des clients cherchent sur Google Maps avant de se déplacer. Ne pas y être, c'est laisser ces clients à vos concurrents.\n`;
            } else if (isOld) {
                body += `J'ai visité votre site (${result.website}) et j'ai vu qu'il s'affichait mal sur les téléphones récents (pas responsive). Cela peut frustrer vos visiteurs.\n`;
            } else {
                body += `Votre site existe, mais il pourrait être modernisé pour attirer plus de clients.\n`;
            }

            body += `\nJe crée des sites modernes et rapides. Voici mon portfolio : https://www.nathan-marzilli.fr\n\n`;
            body += `Je peux vous faire une maquette démo gratuite. Dispo pour un court échange ?\n\n`;
            body += `Cordialement,\nNathan Marzilli\n06 XX XX XX XX`;

            this.generatedEmail.body = body;
        },

        // Marque comme "Contacté" quand on clique sur ouvrir Gmail
        async markAsContacted(leadData) {
            const lead = this.leads.find(l => l.id === leadData.id);
            if (lead) {
                lead.status = 'Contacted';
                lead.lastContactDate = new Date().toISOString(); // Date du jour
                await this.saveLeadToServer(lead);
            }
        },

        // Gestion de la relance
        async markAsRelanced(lead) {
            lead.status = 'Relance';
            lead.lastContactDate = new Date().toISOString(); // Reset le compteur
            await this.saveLeadToServer(lead);
        },

        // --- ECHANGES AVEC LE SERVEUR ---
        async loadLeadsFromServer() {
            try {
                const res = await fetch('proxy.php?action=get_leads');
                const data = await res.json();
                if (Array.isArray(data)) this.leads = data.reverse();
            } catch (e) { console.error(e); }
        },
        async saveLeadToServer(lead) {
            await fetch('proxy.php?action=save_lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lead)
            });
        },
        async removeLead(id) {
            if(confirm('Supprimer définitivement ?')) {
                this.leads = this.leads.filter(l => l.id !== id);
                await fetch(`proxy.php?action=delete_lead&id=${id}`);
            }
        },
        async updateStatus(lead) {
            if (lead.status === 'Contacted' && !lead.lastContactDate) {
                lead.lastContactDate = new Date().toISOString();
            }
            await this.saveLeadToServer(lead);
        },

        // --- OUTILS ---
        copyEmail() {
            navigator.clipboard.writeText(this.generatedEmail.body);
            alert("Texte copié !");
        },
        
        exportCSV() {
            let csv = "Nom,Ville,Tel,Status,Dernier Contact\n";
            this.leads.forEach(l => {
                const cleanName = (l.name || '').replace(/,/g, '');
                csv += `${cleanName},${l.city},${l.phone},${l.status},${l.lastContactDate || ''}\n`;
            });
            const link = document.createElement("a");
            link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
            link.download = "prospects_" + new Date().toISOString().slice(0,10) + ".csv";
            link.click();
        }
    }
}