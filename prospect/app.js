function leadApp() {
    return {
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        isLoading: false,
        searchResults: [],
        leads: JSON.parse(localStorage.getItem('myLeads')) || [],
        showEmailModal: false,
        generatedEmail: { subject: '', body: '' },

        get contactedCount() {
            return this.leads.filter(l => l.status !== 'To Contact').length;
        },

        saveLeads() {
            localStorage.setItem('myLeads', JSON.stringify(this.leads));
        },

        // --- C'EST ICI QUE LA MAGIE OPÈRE AVEC L'API ---
        async performRealSearch() {
            if (!this.searchQuery || !this.searchLocation) return alert('Veuillez remplir l\'activité et la ville.');
            
            this.isLoading = true;
            this.searchResults = [];

            try {
                // 1. Appel à TON proxy (qui appelle Google)
                const response = await fetch(`proxy.php?action=search&q=${encodeURIComponent(this.searchQuery)}&loc=${encodeURIComponent(this.searchLocation)}`);
                const data = await response.json();

                if (data.error) throw new Error(data.error);
                if (!data.places || data.places.length === 0) throw new Error("Aucun résultat trouvé dans cette zone.");

                // 2. Traitement des résultats Google
                // On transforme les données Google en format "LeadMachine"
                for (let place of data.places) {
                    
                    let lead = {
                        id: place.id,
                        name: place.displayName.text,
                        address: place.formattedAddress,
                        phone: place.internationalPhoneNumber || 'Non renseigné',
                        website: place.websiteUri || null,
                        hasWebsite: !!place.websiteUri,
                        isOld: false, // Sera déterminé par l'analyse
                        score: 0,
                        issues: [],
                        analyzed: false
                    };

                    // Calcul préliminaire du score (si pas de site = Jackpot)
                    if (!lead.hasWebsite) {
                        lead.issues.push('Pas de site web');
                        lead.score = 0; // Score très bas = Très bonne opportunité
                        lead.analyzed = true; 
                    } else {
                        // Si site existe, on le marque comme "à analyser"
                        lead.score = 50; 
                    }

                    this.searchResults.push(lead);
                }

                // 3. (Optionnel) Analyse automatique des sites trouvés
                // Pour éviter d'attendre trop longtemps, on lance l'analyse en arrière-plan
                this.analyzeWebsitesInResults();

            } catch (err) {
                alert("Erreur : " + err.message);
            } finally {
                this.isLoading = false;
            }
        },

        // Fonction qui parcourt les résultats et analyse les sites un par un
        async analyzeWebsitesInResults() {
            for (let lead of this.searchResults) {
                if (lead.hasWebsite && !lead.analyzed) {
                    try {
                        const res = await fetch(`proxy.php?action=analyze&url=${encodeURIComponent(lead.website)}`);
                        const analysis = await res.json();
                        
                        if (analysis.issues) {
                            lead.issues = analysis.issues;
                            lead.tech = analysis.tech;
                            
                            // Logique de scoring "Maison"
                            if (analysis.issues.length > 0) {
                                lead.isOld = true;
                                lead.score = 30; // Site avec problèmes
                            } else {
                                lead.score = 90; // Site sain
                            }
                        }
                    } catch (e) {
                        lead.issues.push("Site inaccessible");
                        lead.score = 20;
                    }
                    lead.analyzed = true;
                }
            }
        },
        // -----------------------------------------------

        getScoreColor(score) {
            if (score <= 20) return 'border-red-500 bg-red-500/10 text-red-500'; 
            if (score <= 60) return 'border-orange-500 bg-orange-500/10 text-orange-500';
            return 'border-green-500 bg-green-500/10 text-green-500';
        },

        addToCRM(result) {
            const newLead = {
                id: result.id,
                name: result.name,
                city: this.searchLocation,
                email: '', // L'API Google ne donne PAS les emails (RGPD), il faut les chercher sur le site
                phone: result.phone,
                website: result.website,
                mainIssue: result.issues[0] || 'Modernisation',
                status: 'To Contact',
                emailBody: '',
                addedAt: new Date().toISOString()
            };
            
            if(!this.leads.some(l => l.id === newLead.id)) {
                this.leads.unshift(newLead);
                this.saveLeads();
                if(navigator.vibrate) navigator.vibrate(50);
                this.currentTab = 'crm';
            } else {
                alert("Déjà dans le CRM !");
            }
        },

        removeLead(id) {
            if(confirm('Supprimer ce prospect ?')) {
                this.leads = this.leads.filter(l => l.id !== id);
                this.saveLeads();
            }
        },

        generateEmail(result) {
            const isNoSite = !result.hasWebsite;
            
            this.generatedEmail.subject = isNoSite 
                ? `Question visibilité pour ${result.name}` 
                : `Optimisation du site de ${result.name}`;

            this.generatedEmail.body = `Bonjour,

Je suis Nathan Marzilli, développeur web basé près de chez vous.

En faisant des recherches sur les ${this.searchQuery}s à ${this.searchLocation}, je suis tombé sur votre activité.
${isNoSite 
? "J'ai remarqué que vous n'aviez pas encore de site internet visible sur Google Maps. C'est dommage car beaucoup de clients cherchent aujourd'hui uniquement sur leur téléphone." 
: "J'ai visité votre site ("+result.website+") et j'ai noté quelques points techniques qui pourraient être améliorés pour vous apporter plus de clients (notamment sur mobile)."}

Je crée des sites modernes pour les artisans et commerçants. 
Je serais ravi de vous montrer une maquette gratuite, sans engagement.

Êtes-vous disponible pour un court échange téléphonique ?
Mon numéro : [TON NUMERO]

Cordialement,
Nathan Marzilli
nathanmarzilli.com`;

            this.showEmailModal = true;
        },

        copyEmail() {
            navigator.clipboard.writeText(this.generatedEmail.body);
            alert('Email copié dans le presse-papier !');
        },

        exportCSV() {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Nom,Ville,Téléphone,Site Web,Problème,Statut\n";
            this.leads.forEach(row => {
                csvContent += `"${row.name}","${row.city}","${row.phone}","${row.website || ''}","${row.mainIssue}","${row.status}"\n`;
            });
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "mes_prospects.csv");
            document.body.appendChild(link);
            link.click();
        }
    }
}