function leadApp() {
    return {
        // --- ETAT DE L'APPLICATION ---
        currentTab: 'search',
        searchQuery: '',
        searchLocation: '',
        searchRadius: 5, // Par défaut 5km
        isLoading: false,
        isSending: false, // Etat chargement envoi mail
        searchResults: [],
        leads: [], // Données CRM locales
        expandedEmail: null, // ID du prospect en cours de rédaction
        generatedEmail: { subject: '', body: '', to: '' },
        dailyGoal: 12,
        monthlyGoal: 300, // Nouvel objectif mensuel

        // --- INTELLIGENCE COMMERCIALE (Niches Catégorisées) ---
        // Liste complète réorganisée pour affichage moderne
        nichesCategories: {
            "🔥 TOP Business": ["Rénovation", "Plombier", "Électricien", "Couvreur", "Charpentier", "Maçon", "Peintre", "Menuisier", "Serrurier"],
            "🧑‍⚕️ Santé": ["Kiné", "Ostéopathe", "Dentiste", "Infirmier libéral", "Psychologue"],
            "🍽️ Food": ["Restaurant", "Pizzeria", "Snack", "Traiteur", "Food Truck"],
            "🏨 Tourisme": ["Gîte", "Chambre d'hôtes", "Camping", "Hôtel", "Activités touristiques"],
            "💇‍♀️ Beauté": ["Coiffeur", "Institut de beauté", "Barbier", "Esthéticienne", "Masseur"]
        },

        // --- VILLES CIBLES (Liste Exhaustive 10k-200k hab) ---
        // J'ai remis la liste COMPLETE que tu avais avant
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

        // --- DASHBOARD & OBJECTIFS ---
        // Compte les prospects contactés aujourd'hui (hors statut "A contacter")
        get todayCount() {
            const today = new Date().toISOString().slice(0, 10);
            return this.leads.filter(l => 
                l.status !== 'To Contact' && 
                l.lastContactDate && 
                l.lastContactDate.startsWith(today)
            ).length;
        },
        
        // Compte les prospects contactés ce mois-ci
        get monthCount() {
            const currentMonth = new Date().toISOString().slice(0, 7); // Format "YYYY-MM"
            return this.leads.filter(l => 
                l.status !== 'To Contact' && 
                l.lastContactDate && 
                l.lastContactDate.startsWith(currentMonth)
            ).length;
        },

        // Compte les relances à faire (+3 jours)
        get followUpCount() {
            return this.leads.filter(l => this.needsRelance(l)).length;
        },

        get motivationText() {
            const pct = (this.todayCount / this.dailyGoal) * 100;
            if (pct === 0) return "Journée vierge. Va chercher tes 12 prospects !";
            if (pct < 50) return "La machine est lancée. Ne lâche rien.";
            if (pct < 100) return "Dernière ligne droite pour l'objectif !";
            return "🎯 OBJECTIF ATTEINT ! Chaque mail de plus est du pur bonus.";
        },

        // --- LOGIQUE METIER ---
        needsRelance(lead) {
            if (lead.status !== 'Contacted') return false; 
            if (!lead.lastContactDate) return false;
            
            const lastContact = new Date(lead.lastContactDate);
            const now = new Date();
            const diffTime = Math.abs(now - lastContact);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            
            return diffDays >= 3; // Relance si >= 3 jours
        },

        formatDate(dateStr) {
            if (!dateStr) return '-';
            return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        },

        // Vérifie si un prospect est déjà dans le CRM local
        getExistingLead(id) {
            return this.leads.find(l => l.id === id);
        },

        // --- MOTEUR DE RECHERCHE ---
        async performRealSearch() {
            let query = this.searchQuery;
            if (!query) query = "Entreprise"; 

            if (!this.searchLocation) return alert('Choisis une ville dans la liste !');
            
            this.isLoading = true;
            this.searchResults = [];
            this.expandedEmail = null;

            try {
                // On inclut le rayon (radius) dans la logique visuelle ou contextuelle
                // Note : L'API "Text Search" utilise la requête en langage naturel.
                // On pourrait ajouter "within X km" à la query, mais Google gère mieux "Ville".
                const url = `proxy.php?action=search&q=${encodeURIComponent(query)}&loc=${encodeURIComponent(this.searchLocation)}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.error) throw new Error(data.error);
                if (!data.places || data.places.length === 0) throw new Error("Aucun résultat. Essaie une autre ville.");

                // Traitement des résultats
                for (let place of data.places) {
                    
                    // Vérification si le lead existe déjà dans le CRM
                    let existing = this.getExistingLead(place.id);

                    let lead = {
                        id: place.id,
                        name: place.displayName.text,
                        address: place.formattedAddress,
                        phone: place.internationalPhoneNumber || 'Non renseigné',
                        website: place.websiteUri || null,
                        hasWebsite: !!place.websiteUri,
                        
                        // Si existe, on garde les infos déjà connues (Tech, Email, Status)
                        tech: existing ? existing.tech : 'Inconnu',
                        email: existing ? existing.email : null,
                        crmStatus: existing ? existing.status : null,
                        lastContactDate: existing ? existing.lastContactDate : null,
                        
                        // Scoring initial
                        https: true,
                        speed: 0,
                        score: !!place.websiteUri ? 50 : 0, 
                        issues: !place.websiteUri ? ['Pas de site web'] : [],
                        analyzed: !!existing && existing.tech !== 'Inconnu' // Si déjà en base avec tech connue, on évite le re-scraping
                    };
                    
                    this.searchResults.push(lead);
                }

                // TRI 1 : Score (Les sans sites en premier)
                this.searchResults.sort((a, b) => a.score - b.score);

                // Lancer l'analyse technique (Scraping)
                this.analyzeWebsitesInResults();

            } catch (err) {
                alert("Erreur : " + err.message);
            } finally {
                this.isLoading = false;
            }
        },

        // Analyse technique site par site + SCRAPING EMAIL/TEL
        async analyzeWebsitesInResults() {
            for (let lead of this.searchResults) {
                // On n'analyse que ceux qui ont un site, qui ne sont pas déjà analysés
                if (lead.hasWebsite && !lead.analyzed) {
                    try {
                        const res = await fetch(`proxy.php?action=analyze&url=${encodeURIComponent(lead.website)}`);
                        const analysis = await res.json();
                        
                        if (!analysis.error) {
                            lead.https = analysis.https;
                            lead.speed = analysis.speed;
                            
                            // 1. Récupération Email & Tel scrapés
                            if(analysis.scraped_email) {
                                lead.email = analysis.scraped_email;
                            }
                            if(analysis.scraped_phone && lead.phone === 'Non renseigné') {
                                lead.phone = analysis.scraped_phone;
                            }

                            // 2. LOGIQUE DE SCORING (Pourquoi contacter ?)
                            if (!analysis.mobile) {
                                lead.issues.push("Pas Responsive");
                                lead.score -= 20; // Gros problème
                            }
                            if (!analysis.https) {
                                lead.issues.push("Non Sécurisé");
                                lead.score -= 10;
                            }
                            if (analysis.speed > 3) { // Site lent
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
            // TRI 2 : Mise à jour du tri après analyse
            this.searchResults.sort((a, b) => a.score - b.score);
        },

        getScoreColor(score) {
            // Rouge = À contacter absolument
            if (score <= 15) return 'border-danger-500 bg-danger-500/10 text-danger-500'; 
            // Orange = Potentiel
            if (score <= 40) return 'border-warning-500 bg-warning-500/10 text-warning-500';
            // Vert = Site probablement déjà bon
            return 'border-accent-500 bg-accent-500/10 text-accent-500';
        },

        // --- ACTIONS CRM & EMAIL ---

        // Ajouter au CRM (auto)
        async addToCRM(result) {
            const newLead = {
                id: result.id,
                name: result.name,
                city: this.searchLocation,
                email: result.email || '', 
                phone: result.phone,
                website: result.website,
                status: 'To Contact',
                tech: result.tech || 'Inconnu',
                lastContactDate: null,
                addedAt: new Date().toISOString(),
                confirmDelete: false 
            };
            
            if(this.getExistingLead(newLead.id)) return; // Évite doublons

            this.leads.unshift(newLead);
            await this.saveLeadToServer(newLead);
        },

        // Affiche le panneau Email
        toggleEmailPanel(result) {
            if (this.expandedEmail === result.id) {
                this.expandedEmail = null; 
                return;
            }
            this.expandedEmail = result.id;
            
            // On génère le contenu
            this.generateEmailContent(result);
            
            // On l'ajoute au CRM si pas déjà fait
            if (!this.getExistingLead(result.id)) {
                this.addToCRM(result);
            }
        },

        // GÉNÉRATEUR D'EMAIL (CONTENU EXACT DEMANDÉ)
        generateEmailContent(result) {
            // Tentative de remplissage auto de l'email destinataire
            this.generatedEmail.to = result.email || ''; 

            const isNoSite = !result.website;
            
            // OBJET
            this.generatedEmail.subject = `Améliorer votre visibilité en ligne – accompagnement site internet clé en main`;

            // CORPS DU MAIL
            let body = `Bonjour,\n\n`;
            
            // Intro Contextuelle
            body += `Je me permets de vous contacter car j’accompagne des artisans et professionnels locaux (comme ${result.name}) dans la création et la modernisation de leur site internet, avec un objectif simple : vous aider à être visible, crédible et facilement contactable par vos futurs clients.\n\n`;

            // Problème (Personnalisation légère)
            if (isNoSite) {
                body += `Aujourd’hui, beaucoup d’entreprises perdent des opportunités faute d’un site internet. Les clients cherchent sur Google, et s'ils ne trouvent rien, ils vont chez le concurrent.\n`;
            } else if (result.issues.includes('Pas Responsive')) {
                body += `J'ai remarqué que votre site actuel n'était pas adapté aux mobiles. Aujourd'hui, beaucoup de clients cherchent depuis leur téléphone et quittent un site s'il est difficile à lire.\n`;
            } else {
                body += `Aujourd’hui, beaucoup d’entreprises perdent des opportunités faute d’un site clair, à jour et rapide. Mon rôle est justement de vous éviter cela.\n`;
            }

            // Solution (Offre Nathan)
            body += `\nConcrètement, je propose une solution clé en main, sans contrainte technique pour vous :\n\n`;
            body += `👉 La création ou la refonte complète de votre site internet (design moderne, adapté mobile, clair pour vos clients)\n`;
            body += `   Prix : 990 € (paiement unique)\n\n`;
            body += `👉 Un accompagnement mensuel à 50 € / mois comprenant :\n`;
            body += `   - l’hébergement du site\n`;
            body += `   - la maintenance technique\n`;
            body += `   - les mises à jour et améliorations\n`;
            body += `   - la mise au goût du jour du contenu si besoin\n`;
            body += `   - un suivi régulier, avec un interlocuteur unique : moi\n\n`;

            body += `Mon approche est volontairement humaine et durable : je travaille avec un nombre limité de clients afin d’assurer un vrai suivi.\n\n`;

            // Appel à l'action
            body += `Si vous le souhaitez, je vous propose un échange gratuit et sans engagement, simplement pour faire un point sur votre présence actuelle en ligne.\n\n`;
            body += `👉 Vous pouvez répondre directement à ce mail,\n`;
            body += `ou, si c’est plus simple pour vous, prendre rendez-vous en ligne via mon portfolio (https://nathanmarzilli.github.io/portfolio/) afin de consulter mes disponibilités.\n\n`;

            body += `Je reste bien entendu à votre disposition.\n\n`;
            body += `Bien cordialement,\nNathan Marzilli\n06 XX XX XX XX`; // Pense à mettre ton vrai tel ici si tu veux

            this.generatedEmail.body = body;
        },

        // ENVOYER LE MAIL (Action)
        async sendEmailDirectly(result) {
            if(!this.generatedEmail.to) return alert("Je n'ai pas trouvé l'adresse email de ce client.\n\nTu dois la chercher manuellement (Google, Facebook, PagesJaunes) et la coller dans le champ 'Destinataire'.");
            
            this.isSending = true;
            try {
                // Envoi via PHP
                const res = await fetch('proxy.php?action=send_email', {
                    method: 'POST',
                    body: JSON.stringify(this.generatedEmail)
                });
                const data = await res.json();
                
                if (data.success) {
                    alert("✅ Email envoyé avec succès !");
                    this.markAsContacted(result);
                    this.expandedEmail = null; // Fermer le panneau
                } else {
                    alert("⚠️ Erreur d'envoi serveur (PHP mail). J'ouvre Gmail à la place.");
                    this.openGmail(result);
                }
            } catch(e) {
                alert("Erreur technique : " + e.message);
            } finally {
                this.isSending = false;
            }
        },

        // Fallback Gmail
        openGmail(result) {
            const mailto = `mailto:${this.generatedEmail.to}?subject=${encodeURIComponent(this.generatedEmail.subject)}&body=${encodeURIComponent(this.generatedEmail.body)}`;
            window.open(mailto, '_blank');
            this.markAsContacted(result);
        },

        // Marquer comme contacté (Met à jour Local + Serveur)
        async markAsContacted(leadData) {
            // 1. Visuel dans la recherche
            const searchRes = this.searchResults.find(r => r.id === leadData.id);
            if(searchRes) searchRes.crmStatus = 'Contacted';

            // 2. Mise à jour donnée réelle
            const lead = this.leads.find(l => l.id === leadData.id);
            if (lead) {
                lead.status = 'Contacted';
                lead.lastContactDate = new Date().toISOString();
                lead.email = this.generatedEmail.to; // On sauvegarde l'email qu'on vient d'utiliser
                await this.saveLeadToServer(lead);
            }
        },

        // Relance manuelle
        async markAsRelanced(lead) {
            lead.status = 'Relance';
            lead.lastContactDate = new Date().toISOString(); // Reset le timer de relance
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
            // Nettoyage avant envoi
            const cleanLead = JSON.parse(JSON.stringify(lead));
            // On retire les champs "temporaires" d'affichage pour ne pas polluer la DB
            delete cleanLead.confirmDelete;
            delete cleanLead.crmStatus;
            delete cleanLead.analyzed;
            delete cleanLead.score;
            delete cleanLead.issues;
            delete cleanLead.speed;

            await fetch('proxy.php?action=save_lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cleanLead)
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
        },

        async updateStatus(lead) {
            if (lead.status === 'To Contact') {
                lead.lastContactDate = null;
            } else if (lead.status === 'Contacted' && !lead.lastContactDate) {
                lead.lastContactDate = new Date().toISOString();
            }
            await this.saveLeadToServer(lead);
        },

        copyEmail() {
            navigator.clipboard.writeText(this.generatedEmail.body);
            alert("Email copié !");
        },
        
        exportCSV() {
            let csv = "Nom,Email,Tel,Ville,Status,Dernier Contact\n";
            this.leads.forEach(l => {
                // On gère les virgules dans les noms pour ne pas casser le CSV
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