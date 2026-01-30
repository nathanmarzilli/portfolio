function leadApp() {
    return {
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        isLoading: false,
        searchResults: [],
        leads: [], 
        showEmailModal: false,
        generatedEmail: { subject: '', body: '' },

        // --- DÉMARRAGE ---
        init() {
            this.loadLeadsFromServer();
        },

        // Charger les données depuis le fichier JSON via PHP
        async loadLeadsFromServer() {
            try {
                const res = await fetch('proxy.php?action=get_leads');
                const data = await res.json();
                if (data.error) console.error(data.error);
                if (Array.isArray(data)) {
                    this.leads = data.reverse(); // Les plus récents en haut
                }
            } catch (e) {
                console.error("Impossible de charger le CRM", e);
            }
        },

        get contactedCount() {
            return this.leads.filter(l => l.status !== 'To Contact').length;
        },

        // --- RECHERCHE GOOGLE ---
        async performRealSearch() {
            if (!this.searchQuery || !this.searchLocation) return alert('Veuillez remplir l\'activité et la ville.');
            
            this.isLoading = true;
            this.searchResults = [];

            try {
                // Appel au proxy PHP qui appelle Google
                const url = `proxy.php?action=search&q=${encodeURIComponent(this.searchQuery)}&loc=${encodeURIComponent(this.searchLocation)}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.error) throw new Error(data.error);
                if (!data.places || data.places.length === 0) throw new Error("Aucun résultat trouvé dans cette zone.");

                // Transformation des données Google -> Format LeadMachine
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
                        score: !!place.websiteUri ? 50 : 0, // Score bas = Bonne opportunité
                        issues: !place.websiteUri ? ['Pas de site web'] : [],
                        analyzed: false
                    };
                    this.searchResults.push(lead);
                }

                // Lancer l'analyse des sites en arrière-plan
                this.analyzeWebsitesInResults();

            } catch (err) {
                alert("Erreur : " + err.message);
            } finally {
                this.isLoading = false;
            }
        },

        // --- ANALYSE DE SITE ---
        async analyzeWebsitesInResults() {
            for (let lead of this.searchResults) {
                // On n'analyse que ceux qui ont un site et qui ne sont pas déjà faits
                if (lead.hasWebsite && !lead.analyzed) {
                    try {
                        const res = await fetch(`proxy.php?action=analyze&url=${encodeURIComponent(lead.website)}`);
                        const analysis = await res.json();
                        
                        if (!analysis.error) {
                            if (!analysis.mobile) {
                                lead.issues.push("Pas responsive (Mobile)");
                                lead.score -= 20;
                                lead.isOld = true;
                            }
                            if (analysis.tech !== 'HTML/Autre') {
                                lead.tech = analysis.tech;
                            }
                        }
                        lead.analyzed = true;
                    } catch (e) {
                        console.log("Erreur analyse", e);
                    }
                }
            }
        },

        getScoreColor(score) {
            if (score <= 20) return 'border-red-500 bg-red-500/10 text-red-500'; 
            if (score <= 60) return 'border-orange-500 bg-orange-500/10 text-orange-500';
            return 'border-green-500 bg-green-500/10 text-green-500';
        },

        // --- GESTION CRM (CRUD) ---
        
        // Ajouter un prospect
        async addToCRM(result) {
            const newLead = {
                id: result.id,
                name: result.name,
                city: this.searchLocation,
                email: '', // À remplir manuellement après visite du site
                phone: result.phone,
                website: result.website,
                mainIssue: result.issues[0] || 'Modernisation',
                status: 'To Contact',
                tech: result.tech || 'Inconnu',
                addedAt: new Date().toISOString()
            };
            
            if(this.leads.some(l => l.id === newLead.id)) {
                return alert("Ce prospect est déjà dans votre CRM !");
            }

            // Ajout visuel immédiat (UX rapide)
            this.leads.unshift(newLead);
            this.currentTab = 'crm';

            // Sauvegarde serveur
            await this.saveLeadToServer(newLead);
        },

        // Mise à jour (ex: changement de statut)
        async updateStatus(lead) {
            await this.saveLeadToServer(lead);
        },

        // Fonction technique pour sauvegarder
        async saveLeadToServer(leadData) {
            await fetch('proxy.php?action=save_lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(leadData)
            });
        },

        // Supprimer un prospect
        async removeLead(id) {
            if(confirm('Supprimer ce prospect définitivement ?')) {
                // Suppression visuelle
                this.leads = this.leads.filter(l => l.id !== id);
                // Suppression serveur
                await fetch(`proxy.php?action=delete_lead&id=${id}`);
            }
        },

        // --- EMAILING ---
        generateEmail(result) {
            const isNoSite = !result.website; // Attention: vérifier la propriété 'website' ou 'hasWebsite'
            
            this.generatedEmail.subject = isNoSite 
                ? `Visibilité internet pour ${result.name}` 
                : `Optimisation du site de ${result.name}`;

            this.generatedEmail.body = `Bonjour,\n\nJe suis Nathan Marzilli, développeur web indépendant.\n\nEn effectuant des recherches sur votre secteur à ${this.searchLocation}, j'ai remarqué votre activité.\n\n${isNoSite 
? "Sauf erreur de ma part, vous n'avez pas encore de site internet visible sur Google. C'est un manque à gagner important car vos clients cherchent majoritairement sur mobile aujourd'hui." 
: "J'ai visité votre site web ("+result.website+") et j'ai relevé quelques points techniques qui pourraient être modernisés pour attirer plus de clients."}\n\nJe serais ravi de vous proposer une maquette gratuite, sans aucun engagement de votre part.\n\nÊtes-vous disponible pour un court échange ?\n\nCordialement,\nNathan Marzilli\n(Votre Portfolio)`;

            this.showEmailModal = true;
        },

        copyEmail() {
            navigator.clipboard.writeText(this.generatedEmail.body);
            alert('Email copié !');
        },

        // --- EXPORT CSV (Réintégré) ---
        exportCSV() {
            // En-tête du CSV
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Nom,Ville,Téléphone,Site Web,Techno,Problème,Statut\n";
            
            // Lignes
            this.leads.forEach(row => {
                // On nettoie les champs pour éviter de casser le CSV avec des virgules
                const cleanName = (row.name || '').replace(/,/g, '');
                const cleanIssue = (row.mainIssue || '').replace(/,/g, '');
                
                csvContent += `${cleanName},${row.city},${row.phone},${row.website || ''},${row.tech || ''},${cleanIssue},${row.status}\n`;
            });

            // Création du lien de téléchargement
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "mes_prospects_" + new Date().toISOString().slice(0,10) + ".csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
}