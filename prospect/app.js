function leadApp() {
    return {
        // --- ETAT DE L'APPLICATION ---
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        isLoading: false,
        searchResults: [],
        leads: [],
        expandedEmail: null, // ID du prospect dont on rédige le mail
        generatedEmail: { subject: '', body: '' },
        dailyGoal: 12, // Objectif : 12 mails par jour

        // --- INTELLIGENCE COMMERCIALE (Niches qui paient) ---
        topNiches: [
            "Rénovation", "Plombier", "Électricien", "Couvreur", "Charpentier",
            "Paysagiste", "Pisciniste", "Menuisier", "Serrurier",
            "Avocat", "Notaire", "Expert Comptable", "Cabinet Infirmier",
            "Restaurant", "Traiteur", "Hôtel", "Chambres d'hôtes",
            "Garage Automobile", "Concessionnaire", "Agence Immobilière"
        ],

        // --- STRATÉGIE "VILLES MOYENNES" (10k-200k hab - Potentiel Max) ---
        // Liste exhaustive pour ne jamais manquer d'idées
        targetCities: [
            // Auvergne-Rhône-Alpes
            "Thonon-les-Bains", "Annemasse", "Annecy", "Chambéry", "Aix-les-Bains", 
            "Bourg-en-Bresse", "Vénissieux", "Villeurbanne", "Saint-Étienne", "Roanne",
            "Valence", "Montélimar", "Romans-sur-Isère", "Vichy", "Moulins",
            // Est
            "Mulhouse", "Colmar", "Belfort", "Besançon", "Dijon", "Chalon-sur-Saône",
            "Troyes", "Reims", "Nancy", "Metz", "Thionville",
            // Sud
            "Avignon", "Arles", "Nîmes", "Alès", "Béziers", "Sète", "Narbonne",
            "Perpignan", "Pau", "Bayonne", "Anglet", "Biarritz", "Tarbes",
            "Agen", "Montauban", "Albi", "Castres",
            // Ouest
            "La Rochelle", "Niort", "Angoulême", "Poitiers", "Limoges", "Brive-la-Gaillarde",
            "Cholet", "Saint-Nazaire", "La Roche-sur-Yon", "Laval", "Lorient", "Vannes",
            "Quimper", "Saint-Brieuc", "Saint-Malo", "Cherbourg", "Caen", "Le Havre",
            // Centre / Nord
            "Orléans", "Blois", "Tours", "Bourges", "Châteauroux", "Chartres",
            "Amiens", "Beauvais", "Compiègne", "Rouen", "Évreux"
        ],

        // --- INITIALISATION ---
        init() {
            this.loadLeadsFromServer();
        },

        // --- CALCULS MOTIVATION (Dashboard) ---
        // Calcul corrigé : Compte les prospects contactés AUJOURD'HUI qui ne sont PAS en "A contacter"
        get todayCount() {
            const today = new Date().toISOString().slice(0, 10);
            return this.leads.filter(l => 
                l.status !== 'To Contact' && // Important : si on le remet en "A contacter", il ne compte plus
                l.lastContactDate && 
                l.lastContactDate.startsWith(today)
            ).length;
        },

        // Compte les relances à faire (Contacté il y a + de 3 jours)
        get followUpCount() {
            return this.leads.filter(l => this.needsRelance(l)).length;
        },

        // Texte motivant dynamique
        get motivationText() {
            const pct = (this.todayCount / this.dailyGoal) * 100;
            if (pct === 0) return "Journée vierge. Va chercher tes 12 prospects !";
            if (pct < 50) return "La machine est lancée. Ne lâche rien.";
            if (pct < 100) return "Dernière ligne droite pour l'objectif !";
            return "🎯 OBJECTIF ATTEINT ! Chaque mail de plus est du pur bonus.";
        },

        // --- LOGIQUE METIER ---
        
        // Vérifie si une relance est nécessaire
        needsRelance(lead) {
            if (lead.status !== 'Contacted') return false; // On ne relance que ceux qu'on a contactés
            if (!lead.lastContactDate) return false;
            
            const lastContact = new Date(lead.lastContactDate);
            const now = new Date();
            const diffTime = Math.abs(now - lastContact);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            return diffDays >= 3; // Vrai si >= 3 jours
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
            // Si pas de mot clé, on met "Entreprise" pour chercher large
            let query = this.searchQuery;
            if (!query) query = "Entreprise"; 

            if (!this.searchLocation) return alert('Choisis une ville dans la liste !');
            
            this.isLoading = true;
            this.searchResults = [];
            this.expandedEmail = null;

            try {
                // Appel au Proxy PHP
                const url = `proxy.php?action=search&q=${encodeURIComponent(query)}&loc=${encodeURIComponent(this.searchLocation)}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.error) throw new Error(data.error);
                if (!data.places || data.places.length === 0) throw new Error("Zone vide. Passe à la ville suivante !");

                // Traitement des résultats
                for (let place of data.places) {
                    let lead = {
                        id: place.id,
                        name: place.displayName.text,
                        address: place.formattedAddress,
                        phone: place.internationalPhoneNumber || 'Non renseigné',
                        website: place.websiteUri || null,
                        hasWebsite: !!place.websiteUri,
                        tech: 'Inconnu',
                        https: true, // On suppose oui par défaut
                        speed: 0,
                        isOld: false,
                        // SCORING : Pas de site = 0 (Prioritaire), Site existant = 50
                        score: !!place.websiteUri ? 50 : 0, 
                        issues: !place.websiteUri ? ['Pas de site web'] : [],
                        analyzed: false
                    };
                    this.searchResults.push(lead);
                }

                // TRI 1 : Les "Sans Site" d'abord
                this.searchResults.sort((a, b) => a.score - b.score);

                // Lancer l'analyse technique des sites (en arrière-plan)
                this.analyzeWebsitesInResults();

            } catch (err) {
                alert("Erreur : " + err.message);
            } finally {
                this.isLoading = false;
            }
        },

        // Analyse technique site par site via le Proxy PHP
        async analyzeWebsitesInResults() {
            for (let lead of this.searchResults) {
                // On n'analyse que ceux qui ont un site et qui ne sont pas déjà faits
                if (lead.hasWebsite && !lead.analyzed) {
                    try {
                        const res = await fetch(`proxy.php?action=analyze&url=${encodeURIComponent(lead.website)}`);
                        const analysis = await res.json();
                        
                        if (!analysis.error) {
                            lead.https = analysis.https;
                            lead.speed = analysis.speed;
                            
                            // LOGIQUE DE SCORING AVANCÉE (Le cœur de la machine)
                            if (!analysis.mobile) {
                                lead.issues.push("Pas Responsive");
                                lead.score -= 20; // Très grave -> Score baisse -> Priorité monte
                                lead.isOld = true;
                            }
                            if (!analysis.https) {
                                lead.issues.push("Non Sécurisé");
                                lead.score -= 10;
                            }
                            if (analysis.speed > 3) { // Site lent (> 3 secondes)
                                lead.issues.push("Lent (" + analysis.speed.toFixed(1) + "s)");
                                lead.score -= 5;
                            }
                            if (analysis.tech !== 'HTML/Autre') {
                                lead.tech = analysis.tech;
                            }
                        }
                        lead.analyzed = true;
                    } catch (e) { console.log(e); }
                }
            }
            // TRI 2 : On remonte les pires élèves en haut de la liste
            this.searchResults.sort((a, b) => a.score - b.score);
        },

        getScoreColor(score) {
            // Rouge = Jackpot potentiel (Site pourri ou inexistant)
            if (score <= 15) return 'border-danger-500 bg-danger-500/10 text-danger-500'; 
            // Orange = A améliorer
            if (score <= 40) return 'border-warning-500 bg-warning-500/10 text-warning-500';
            // Vert = Difficile à vendre
            return 'border-accent-500 bg-accent-500/10 text-accent-500';
        },

        // --- ACTIONS CRM & EMAIL ---

        // Ajouter au CRM (sauvegarde automatique)
        async addToCRM(result) {
            const newLead = {
                id: result.id,
                name: result.name,
                city: this.searchLocation,
                email: '', 
                phone: result.phone,
                website: result.website,
                status: 'To Contact',
                tech: result.tech || 'Inconnu',
                lastContactDate: null,
                addedAt: new Date().toISOString(),
                confirmDelete: false // Etat local pour le bouton suppression
            };
            
            if(this.isInCRM(newLead.id)) return;

            this.leads.unshift(newLead);
            await this.saveLeadToServer(newLead);
        },

        // Affiche l'email SOUS la carte (Pas de popup)
        toggleEmailPanel(result) {
            if (this.expandedEmail === result.id) {
                this.expandedEmail = null; // Fermer si déjà ouvert
                return;
            }
            this.expandedEmail = result.id;
            this.generateEmailContent(result);
            
            // On ajoute au CRM dès qu'on commence à rédiger
            if (!this.isInCRM(result.id)) this.addToCRM(result);
        },

        // GÉNÉRATEUR D'EMAIL PERSUASIF
        generateEmailContent(result) {
            const isNoSite = !result.website;
            const isNonResp = result.issues.includes('Pas Responsive');
            const isNotSecure = result.issues.includes('Non Sécurisé');
            const isSlow = result.issues.some(i => i.includes('Lent'));
            
            // OBJET : Doit donner envie d'ouvrir (Curiosité)
            this.generatedEmail.subject = isNoSite 
                ? `Visibilité de ${result.name} sur Google` 
                : `Petit problème d'affichage sur ${result.name}`;

            // CORPS DU MAIL (Technique AIDA)
            let body = `Bonjour,\n\n`;
            
            // 1. CONTEXTE (Rassure le client, je ne suis pas un robot)
            body += `Je suis Nathan, développeur web indépendant. Je faisais le tour des entreprises de ${this.searchQuery || 'votre secteur'} à ${this.searchLocation} et je suis tombé sur votre fiche.\n\n`;
            
            // 2. LE PROBLÈME (Créer le besoin)
            if (isNoSite) {
                body += `Honnêtement, j'ai failli passer à côté. Vous n'avez pas de site web relié à votre fiche Google. C'est dommage car aujourd'hui, 80% des clients (moi le premier) regardent le site avant d'appeler.\n`;
                body += `S'ils ne voient rien, ils cliquent malheureusement chez le concurrent juste en dessous.\n`;
            } else if (isNonResp) {
                body += `Je suis allé sur votre site (${result.website}) depuis mon téléphone, et j'ai eu du mal à naviguer. Le texte est petit, il faut zoomer...\n`;
                body += `Google pénalise ça, et les clients impatients quittent la page en 3 secondes.\n`;
            } else if (isNotSecure) {
                body += `Votre site s'affiche comme "Non Sécurisé" (pas de cadenas) sur mon navigateur. Ça envoie un signal de danger à vos visiteurs, même si vous êtes une entreprise de confiance.\n`;
            } else {
                body += `Votre site est en ligne, c'est bien. Mais il a un design qui ne reflète pas la qualité de votre travail actuel. On pourrait le rendre beaucoup plus vendeur.\n`;
            }

            // 3. LA SOLUTION (Preuve d'autorité)
            body += `\nJe ne suis pas une agence qui facture des fortunes. Je crée des sites modernes, rapides et qui inspirent confiance immédiatement.\n`;
            body += `Vous pouvez voir mes réalisations ici : https://www.nathan-marzilli.fr\n\n`;

            // 4. APPEL À L'ACTION (Faible engagement)
            body += `Je vous ai préparé une petite idée de ce qu'on pourrait faire pour ${result.name}. Je peux vous envoyer la maquette ?\n\n`;
            body += `Bien à vous,\nNathan Marzilli\n06 XX XX XX XX`;

            this.generatedEmail.body = body;
        },

        // Quand on clique sur "Ouvrir Gmail"
        async markAsContacted(leadData) {
            const lead = this.leads.find(l => l.id === leadData.id);
            if (lead) {
                lead.status = 'Contacted';
                lead.lastContactDate = new Date().toISOString(); 
                await this.saveLeadToServer(lead);
            }
        },

        // Quand on clique sur "Relancer"
        async markAsRelanced(lead) {
            lead.status = 'Relance';
            lead.lastContactDate = new Date().toISOString(); // Reset le timer
            await this.saveLeadToServer(lead);
        },

        // --- GESTION SERVEUR (CRUD) ---
        async loadLeadsFromServer() {
            try {
                const res = await fetch('proxy.php?action=get_leads');
                const data = await res.json();
                if (Array.isArray(data)) this.leads = data.reverse();
            } catch (e) { console.error(e); }
        },

        async saveLeadToServer(lead) {
            // On nettoie l'objet avant envoi (on enlève les états temporaires d'interface)
            const cleanLead = JSON.parse(JSON.stringify(lead));
            delete cleanLead.confirmDelete; 

            await fetch('proxy.php?action=save_lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanLead)
            });
        },

        async removeLead(lead) {
            // LOGIQUE DE SUPPRESSION SANS POPUP
            if (!lead.confirmDelete) {
                // Premier clic : on demande confirmation
                lead.confirmDelete = true;
                // Si pas de 2ème clic après 3s, on annule
                setTimeout(() => { lead.confirmDelete = false; }, 3000);
                return; 
            }
            
            // Deuxième clic : on supprime vraiment
            this.leads = this.leads.filter(l => l.id !== lead.id);
            await fetch(`proxy.php?action=delete_lead&id=${lead.id}`);
        },

        async updateStatus(lead) {
            // CORRECTION BUG BARRE PROGRESSION
            if (lead.status === 'To Contact') {
                // Si on remet en "A contacter", on efface la date de contact
                // Donc le compteur "todayCount" ne le prendra plus en compte
                lead.lastContactDate = null; 
            } else if (lead.status === 'Contacted' && !lead.lastContactDate) {
                // Si on passe en contacté, on met la date
                lead.lastContactDate = new Date().toISOString();
            }
            await this.saveLeadToServer(lead);
        },

        copyEmail() {
            navigator.clipboard.writeText(this.generatedEmail.body);
            alert("Email copié !");
        },
        
        exportCSV() {
            let csv = "Nom,Ville,Tel,Status,Dernier Contact\n";
            this.leads.forEach(l => {
                csv += `${(l.name||'').replace(/,/g,'')},${l.city},${l.phone},${l.status},${l.lastContactDate || ''}\n`;
            });
            const link = document.createElement("a");
            link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
            link.download = "prospects.csv";
            link.click();
        }
    }
}