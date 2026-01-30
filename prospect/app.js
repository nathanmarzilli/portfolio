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

        // Sauvegarde auto
        saveLeads() {
            localStorage.setItem('myLeads', JSON.stringify(this.leads));
        },

        // Simulation intelligente de recherche (Mockup pour la démo)
        // Pour la prod : il faudrait appeler ton proxy.php qui ferait un appel à une API (ex: Google Places)
        simulateSearch() {
            if (!this.searchQuery || !this.searchLocation) return alert('Remplissez les champs !');
            
            this.isLoading = true;
            this.searchResults = [];

            // Simulation de délai réseau
            setTimeout(() => {
                // Génération de faux résultats réalistes pour tester l'UI
                const mockTypes = ['Artisan', 'Cabinet', 'Restaurant'];
                const issues = ['Non Responsive', 'Pas de HTTPS', 'Design 2010', 'Lent', 'Erreur 404'];
                
                for(let i=0; i<5; i++) {
                    const hasSite = Math.random() > 0.3;
                    const isOld = hasSite && Math.random() > 0.5;
                    const issueList = [];
                    if(!hasSite) issueList.push('Pas de site web');
                    else if(isOld) {
                        issueList.push(issues[Math.floor(Math.random() * issues.length)]);
                        issueList.push('Score Mobile Faible');
                    }

                    this.searchResults.push({
                        id: Date.now() + i,
                        name: `${this.searchQuery} ${['Durand', 'Martin', 'Léman', 'Savoie'][i%4]}`,
                        address: `${Math.floor(Math.random()*100)} Rue du Lac, ${this.searchLocation}`,
                        hasWebsite: hasSite,
                        website: hasSite ? 'http://www.exemple-vieux-site.fr' : null,
                        isOld: isOld,
                        issues: issueList,
                        score: hasSite ? (isOld ? Math.floor(Math.random() * 40) + 10 : 85) : 0
                    });
                }
                this.isLoading = false;
            }, 1500);
        },

        getScoreColor(score) {
            if (score === 0) return 'border-red-500 bg-red-500/10 text-red-500'; // Pas de site (Opportunité MAX)
            if (score < 50) return 'border-orange-500 bg-orange-500/10 text-orange-500'; // Site pourri
            return 'border-green-500 bg-green-500/10 text-green-500'; // Bon site
        },

        addToCRM(result) {
            const newLead = {
                id: result.id,
                name: result.name,
                city: this.searchLocation,
                email: 'contact@exemple.com', // À scrapper idéalement
                mainIssue: result.issues[0] || 'Modernisation',
                status: 'To Contact',
                emailBody: '',
                addedAt: new Date().toISOString()
            };
            
            // Éviter doublons
            if(!this.leads.some(l => l.id === newLead.id)) {
                this.leads.unshift(newLead);
                this.saveLeads();
                // Petite vibration/notif
                if(navigator.vibrate) navigator.vibrate(50);
                this.currentTab = 'crm';
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

Je suis Nathan Marzilli, développeur web basé à Évian.

En faisant des recherches sur les ${this.searchQuery.toLowerCase()}s à ${this.searchLocation}, je suis tombé sur votre activité.
${isNoSite 
? "J'ai remarqué que vous n'aviez pas encore de site internet, ce qui vous prive d'une grande partie de votre clientèle locale qui cherche sur Google." 
: "J'ai visité votre site web et j'ai remarqué qu'il n'était pas parfaitement adapté aux mobiles d'aujourd'hui (affichage difficile sur smartphone)."}

Je crée des sites ultra-rapides et modernes pour les pros du coin. 
Je serais ravi de vous montrer une maquette gratuite de ce à quoi votre futur site pourrait ressembler.

Dispo pour un court échange ?

Cordialement,
Nathan Marzilli
nathanmarzilli.com`;

            this.showEmailModal = true;
        },

        copyEmail() {
            navigator.clipboard.writeText(this.generatedEmail.body);
            alert('Copié !');
        },

        exportCSV() {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "Nom,Ville,Problème,Statut\n";
            this.leads.forEach(row => {
                csvContent += `${row.name},${row.city},${row.mainIssue},${row.status}\n`;
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