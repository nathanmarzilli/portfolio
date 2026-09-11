# Portfolio Nathan Marzilli — documentation technique

Ce document explique comment le site est organisé, où se règlent les tarifs,
comment fonctionne l'espace d'administration et ce qu'il reste à faire côté
comptes tiers. Il est écrit pour être relu dans six mois sans rien avoir à
redécouvrir.

---

## 1. Le principe de base : un seul endroit pour les tarifs

**Tous les prix du site vivent dans `config.js`.** Aucun montant n'est écrit en
dur dans une page HTML. Concrètement :

| Ce que vous voulez changer | Où le faire |
|---|---|
| Prix d'un pack (Éclair, Essentiel, Vitrine, Premium) | `config.js` → `offers.<pack>.price` |
| Prix du Pack Sérénité / Sérénité+ | `config.js` → `offers.serenite(.Plus).price` et `.annualPrice` |
| Prix d'une option « document automatisé » | `config.js` → `documentOptions` |
| Prix d'un module club | `config.js` → `clubOptions` |
| Interventions ponctuelles | `config.js` → `interventions` |
| Tarifs à domicile (facilitateur) | `config.js` → `facilitateur` |
| Hébergement OVH | `config.js` → `hosting` |
| Coordonnées, e-mail, téléphone | `config.js` → `contact` |

Dans le HTML, un montant s'affiche de deux façons seulement :

```html
<!-- Prix d'une offre du catalogue -->
<span data-offer-key="vitrine">1 790 €</span>
<span data-offer-key="serenite-annual" data-price-suffix="/ an">499 € / an</span>

<!-- Montant libre exprimé en euros, converti dans la devise choisie -->
<span data-price-eur="100">100 €</span>
<span data-price-eur="690" data-price-prefix="dès ">dès 690 €</span>
```

Le texte écrit entre les balises n'est qu'une valeur de repli : il est remplacé
au chargement par `assets/js/i18n.js`. **Si vous ajoutez un prix quelque part,
utilisez toujours l'un de ces deux attributs.**

Grille actuelle :

- Vitrine Éclair **690 €** · L'Essentiel & Suivi **990 €** · Vitrine Artisan **1 790 €** · Premium **2 990 €**
- Pack Sérénité **49,90 € / mois** (ou **499 € / an**, 2 mois offerts)
- Pack Sérénité+ **94,90 € / mois** (ou **949 € / an**)
- Toute option de document automatisé : **100 €**
  — sauf **bail de location : 300 €** et **document sur-mesure : à partir de 300 €**
- Tout module club : **100 €**
- Interventions ponctuelles : 100 / 200 / 300 € · relifting dès 690 €

---

## 2. Le parcours client (aucun paiement en ligne)

Le site ne propose **plus aucun paiement direct**. Les liens Stripe ont été
retirés de `config.js` et les boutons « payer par carte » supprimés.

1. **Le visiteur réserve un créneau** (page d'accueil ou page Offre Club).
   La demande part dans Supabase, table `nm_leads`.
2. **Il prépare le rendez-vous** via `/kickoff/`. Le brief est enregistré dans
   `nm_briefs`, avec un brouillon de devis déjà calculé.
3. **Vous transformez la demande en fiche client** depuis `/admin/`.
4. **Vous générez le devis** en un clic : les lignes sont construites à partir
   du pack et des options retenues (`assets/js/quote-builder.js`).
5. **À la livraison, vous envoyez la facture** : Stripe expédie l'e-mail au
   client avec son lien de paiement sécurisé.

---

## 3. Arborescence

```
config.js                    Catalogue, coordonnées, clés publiques, traductions
script.js                    Logique de la page d'accueil
index.html                   Page d'accueil
prospectus.html              Prospectus imprimable
merci.html                   Ancienne URL → redirige vers /merci/

assets/css/
  theme.css                  Couleurs des deux thèmes + composants communs
  app.css                    Composants des pages « application » (formulaires…)
assets/js/
  nm-boot.js                 Amorçage (espace de noms NM, promesse de base)
  theme.js                   Thème clair / sombre, mémorisé et partagé
  tailwind-theme.js          Palette Tailwind branchée sur les tokens CSS
  i18n.js                    Langue, devise, rendu de tous les prix
  calendar.js                Calendrier de rendez-vous (accueil + offre club)
  supabase-client.js         Authentification et accès aux données
  quote-builder.js           Construction automatique d'un devis
  offre-club.js              Logique de la page Offre Club
  admin.js                   Espace d'administration

admin/                       Espace clients (protégé)
offre-club/                  Offre clubs & associations
kickoff/                     Formulaire de préparation de projet
merci/                       Page de confirmation
contrat/devis&contrat/       Générateur de devis et factures (protégé)
contrat/quittance/           Générateur de quittances (protégé)
contrat/bail/                Générateur de baux (protégé)
running/                     Suivi running personnel (protégé)
prospect/                    Outil de prospection (laissé tel quel)
```

---

## 4. Thème clair / sombre

Le **mode clair est le mode par défaut**. Si le visiteur n'a jamais choisi et
que son système est en mode sombre, le mode sombre s'applique automatiquement.
Le choix est mémorisé et **partagé par toutes les pages du site**.

Le mécanisme : `assets/css/theme.css` déclare chaque couleur sous forme de
triplet RVB (`--t-accent-400`, `--t-slate-400`…), en deux versions. La palette
Tailwind (`assets/js/tailwind-theme.js`) pointe vers ces variables. Changer
l'attribut `data-theme` sur `<html>` repeint donc tout le site d'un coup.

**En pratique** : n'écrivez jamais une couleur en dur (`#020617`, `white`,
`rgba(255,255,255,.1)`) dans une page. Utilisez les classes Tailwind
(`bg-dark-900`, `text-slate-400`, `border-white/10`) ou les variables
(`rgb(var(--t-accent-400))`).

Le sélecteur soleil/lune s'ajoute avec un simple `<div data-theme-toggle></div>`.
Le sélecteur langue/devise avec `<div data-lang-select></div>`.

---

## 5. Base de données (Supabase)

Projet : `nathanmarzilli's Project` — `jbhaawganoejgbzozmyb`.

| Table | Contenu | Qui peut quoi |
|---|---|---|
| `nm_leads` | Demandes de rendez-vous | Le site public peut **écrire** ; seul l'admin peut lire |
| `nm_briefs` | Briefs projet (kickoff) | Idem |
| `nm_clients` | Fiches clients | Admin uniquement |
| `nm_documents` | Devis et factures | Admin uniquement |
| `nm_admins` | E-mails autorisés | Lecture par l'admin concerné |

Fonctions :

- `nm_is_admin()` — vrai si l'e-mail connecté figure dans `nm_admins`
- `nm_next_doc_number('devis'|'facture')` — numérotation `DEV-2026-001`
- `nm_taken_slots(date)` — créneaux déjà réservés (ne renvoie **que** des heures,
  c'est la seule chose que le site public peut lire de `nm_leads`)

Ces règles ont été vérifiées : un visiteur anonyme ne voit **aucune** ligne des
tables clients, demandes, briefs ou documents.

### Connexion à l'espace sécurisé

Les six pages protégées (`/admin/`, devis & factures, quittance, bail, running,
et la modale « Administration » de l'accueil) partagent **le même compte
Supabase** : `nathan.marzilli@gmail.com`.

Si vous ne vous souvenez plus du mot de passe, cliquez sur **« Mot de passe
oublié ? »** sur la page `/admin/` : un lien de réinitialisation vous est envoyé
par e-mail, et la page vous propose ensuite d'en définir un nouveau.

---

## 6. Facturation Stripe — ce qu'il reste à faire

L'envoi de facture passe par une fonction serveur Supabase
(`stripe-invoice`), pour que la clé secrète Stripe ne soit **jamais** dans le
code du site. Elle est déjà déployée.

**Une seule action de votre part :**

1. Ouvrez le tableau de bord Supabase → **Edge Functions** → **Secrets**.
2. Ajoutez un secret nommé `STRIPE_SECRET_KEY` avec votre clé secrète Stripe
   (`sk_test_…` pour tester, `sk_live_…` en production).
3. C'est tout. Le bouton « Envoyer la facture » devient opérationnel.

Tant que la clé est absente, le bouton affiche un message explicite plutôt que
d'échouer silencieusement.

Le compte Stripe actuellement relié est un compte **de test**. Une fois votre
compte réel activé, remplacez simplement la valeur du secret : aucun code à
modifier.

---

## 7. Points de vigilance

- **Protection des mots de passe compromis** : à activer dans Supabase →
  Authentication → Policies (« Leaked password protection »). Une case à cocher.
- **Webhook e-mail** : `config.js` → `integrations.zapierWebhookUrl` contient
  encore `TODO_ZAPIER_WEBHOOK_URL`. Tant qu'il n'est pas renseigné, les demandes
  sont bien enregistrées en base mais aucun e-mail de confirmation n'est envoyé
  au client. Créez un Zap « Catch Hook » et collez l'URL ici.
- **Formulaire kickoff** : il passe par Formspree
  (`integrations.formspreeEndpoint`), en plus de l'enregistrement en base.

---

## 8. Vérifier avant de publier

```bash
# Servir le site en local
python3 -m http.server 8000
```

Puis contrôler :

1. La page d'accueil s'affiche en clair, le bouton lune bascule en sombre.
2. Les prix affichés : 690 / 990 / 1 790 / 2 990 €, Sérénité 49,90 €,
   toutes les options de document à 100 € sauf bail (300 €) et sur-mesure (dès 300 €).
3. Le sélecteur FR/CH/EN/US change bien la devise sur tous les montants.
4. La réservation d'un créneau mène à la page de préparation.
5. `/admin/` demande une connexion, puis affiche demandes, clients et documents.
6. Un devis enregistré se recharge à l'identique depuis la liste de gauche.
