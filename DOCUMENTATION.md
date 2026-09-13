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
- Modules club : **100 €**
  — sauf **Actualités simplifiées : 1 000 €** (le club devient autonome sur ses
  mises à jour de contenu et se passe de la maintenance : le tarif reflète le
  back-office livré, pas une simple option)
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

integrations/
  notifications-agenda-gmail.gs   Script Google Apps Script (agenda + e-mail, sans Zapier)

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
  reveal.js                  Apparitions au défilement (.reveal, data-stagger)
  offre-club.js              Logique de la page Offre Club
  admin.js                   Espace d'administration

admin/                       Espace clients (protégé)
offre-club/                  Offre clubs & associations
offre-club/images-tournoi/   Captures du module tournois (miniatures + loupe)
kickoff/                     Formulaire de préparation de projet
merci/                       Page de confirmation
supports/                    Flyers A4 (5 thèmes) + planche de cartes de visite (noindex)
contrat/devis&contrat/       Générateur de devis et factures (protégé)
contrat/quittance/           Générateur de quittances (protégé)
contrat/bail/                Générateur de baux (protégé)
running/                     Suivi running personnel (protégé)
prospect/                    Prospection clubs & associations (protégé)
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
| `nm_settings` | Réglages (URL de notification RDV/brief) | Admin uniquement |
| `nm_running` | Sauvegarde du suivi sportif | Admin uniquement |

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
- **Notifications RDV (Google Agenda + Gmail, ou Zapier)** : les URL se
  collent dans `/admin/` → onglet **Réglages** (voir la section 9 ci-dessous).
  Tant qu'elles sont vides, les demandes sont bien enregistrées en base mais
  aucun e-mail de confirmation ni événement d'agenda ne part.
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
7. Sur `/offre-club/`, cocher un module dans le catalogue le coche aussi dans le
   formulaire (et inversement), et le total se met à jour.
8. Dans `/admin/`, une demande passée en « classée sans suite » peut revenir à
   « nouveau » : la liste déroulante de statut n'a plus rien d'irréversible.

---

## 9. Notifications automatiques — Google Agenda + Gmail (sans Zapier)

Zapier a été abandonné pour cette partie : le déclencheur générique
« Webhooks by Zapier » n'existe que sur les forfaits payants. La solution
retenue est **gratuite, tourne sur votre propre compte Google, et fait
directement ce que vous vouliez** : un événement dans votre agenda et un
e-mail au moment même de la réservation — sans compte tiers, sans abonnement.

### Pourquoi ce fonctionnement

Ce n'est pas le navigateur du visiteur qui envoie la notification, mais
**Supabase lui-même** : un déclencheur SQL posé sur `nm_leads` et `nm_briefs`
envoie la ligne complète à l'adresse que vous aurez collée. Conséquence : la
notification part même si le visiteur ferme son onglet aussitôt, et l'adresse
n'est jamais exposée dans le code public du site. Cette mécanique existait déjà
pour Zapier ; seule la destination change.

### Installation (5 minutes, une seule fois)

Le script à utiliser est livré avec le site :
`integrations/notifications-agenda-gmail.gs`.

1. Ouvrez [script.google.com](https://script.google.com/) avec votre compte
   Google habituel → **Nouveau projet**.
2. Collez tout le contenu de `integrations/notifications-agenda-gmail.gs` à la
   place du code par défaut.
3. Tout en haut du script, remplacez `CHANGE_ME` par un mot de passe de votre
   choix (gardez-le en tête, il sert à la dernière étape).
4. **Déployer** → **Nouveau déploiement** → type **Application web** →
   « Exécuter en tant que » : *Moi* · « Qui a accès » : *Tout le monde* →
   **Déployer**. Autorisez l'accès à l'agenda et à Gmail quand Google le
   demande — c'est votre propre script, sur votre propre compte, c'est normal.
5. Copiez l'adresse fournie (`https://script.google.com/macros/s/…/exec`),
   ajoutez `?key=` suivi de votre mot de passe, et collez le tout dans
   `/admin/` → onglet **Réglages**, dans les deux champs de notification (la
   même adresse convient aux deux : le script reconnaît de lui-même une
   demande de RDV d'un brief projet).
6. Cliquez **Envoyer un test** : un événement de test apparaît dans votre
   agenda et un e-mail arrive dans votre boîte.

Ce script crée l'événement dans votre agenda, vous envoie un e-mail
récapitulatif, **et** envoie un accusé de réception au client si son e-mail
est connu — le tout au moment même de la réservation.

### Zapier reste possible (forfait payant)

Si vous passez un jour sur un forfait Zapier payant, la même mécanique
fonctionne à l'identique : ouvrez le Zap → son déclencheur → **Webhooks by
Zapier** → **Catch Hook** → copiez l'adresse `https://hooks.zapier.com/…` et
collez-la à la place de l'adresse Google dans `/admin/` → Réglages.

### Les champs envoyés

La ligne complète, telle qu'elle est enregistrée, plus trois champs
techniques : `source_table`, `event` et `sent_at`.

Pour une demande de rendez-vous (`nm_leads`) : `first_name`, `last_name`,
`email`, `phone`, `organisation`, `rdv_date`, `rdv_time`, `rdv_label`, `pack`,
`pack_label`, `pack_price`, `currency`, `request_type`, `documents`,
`club_options`, `serenity_tier`, `serenity_cycle`, `intervention_type`,
`intervention_price`, `estimated_total`, `message`, `status`,
`source` (`portfolio`, `offre-club` ou `manuel`), `created_at`.

Pour un brief (`nm_briefs`) : `contact_name`, `email`, `organisation`, `pack`,
`payload` (toutes les réponses du formulaire de préparation) et `lead_id`, qui
permet de recoller le brief à la demande d'origine.

---

## 10. Un rendez-vous pris par téléphone, e-mail ou en personne

Le calendrier du site ne peut bloquer que les créneaux qu'il connaît : ceux
réservés **via le site**. Un rendez-vous pris autrement (téléphone, e-mail,
sur place) doit être saisi manuellement pour que le créneau n'apparaisse plus
disponible aux autres visiteurs.

Dans `/admin/` → onglet **Demandes**, bouton **Ajouter un RDV** : renseignez
le nom, la date et le créneau (les mêmes horaires que ceux proposés sur le
site), puis enregistrez. Il apparaît aussitôt dans la liste des demandes et
bloque le créneau, exactement comme une réservation en ligne.

*Remarque technique — l'ancien statut irréversible :* une demande passée par
erreur en « classée sans suite » avant la correction de ce point restait
bloquée dans cet état, et ne comptait donc plus comme un créneau pris. Ce
n'est plus le cas : le statut est désormais une liste déroulante modifiable à
tout moment (section 8, point 8). Si un rendez-vous existant s'est retrouvé
marqué par erreur, il suffit de repasser son statut sur « Nouveau ».

---

## 11. Le suivi sportif est désormais sauvegardé en ligne

Les séances (running, badminton, renforcement) étaient uniquement dans le
`localStorage` : vider le cache du navigateur les effaçait définitivement.
C'est ce qui explique la perte constatée.

Désormais, chaque enregistrement est aussi **sauvegardé dans Supabase**
(table `nm_running`) :

- une pastille en haut de page indique l'état (« Enregistré », « Enregistrement… »,
  « Hors ligne ») ;
- au chargement, les données locales et distantes sont **fusionnées** (jamais
  écrasées) : une séance saisie hors connexion n'est pas perdue ;
- le bouton **Exporter** télécharge un fichier JSON de sauvegarde, à conserver
  de temps en temps.

Ce qui est déjà perdu ne peut pas être récupéré — il n'en existait aucune copie.

---

## 12. De la demande à la fiche client, puis au devis et à la facture

Dans `/admin/` → onglet **Demandes**, chaque ligne propose un bouton
**« Fiche client »**. C'est le point de passage unique vers la suite :

- S'il n'y a pas encore de client lié à cette demande, il ouvre une fiche
  client **pré-remplie** (nom, société, e-mail, pack, options) à vérifier
  puis enregistrer.
- S'il y en a déjà un, il rouvre directement sa fiche.

Une fois la fiche client enregistrée, c'est dans l'onglet **Clients** que se
génèrent le devis et la facture (boutons « Générer le devis » /
« Créer la facture » sur la fiche) — c'est le fonctionnement d'origine du
site. *(Une première version de cette mise à jour ajoutait des boutons
« Devis » / « Facture » directement sur chaque ligne de Demandes ; ils
faisaient double emploi avec la fiche client et ont été retirés à la
demande de Nathan.)*

**Transformer un devis en facture** — sur un devis déjà enregistré, un
bouton **« Transformer ce devis en facture »** apparaît dans le générateur
(`contrat/devis&contrat/`). Il crée une **nouvelle facture** reprenant les
mêmes lignes et le même client, et référençant le devis d'origine (le devis
lui-même n'est pas modifié — vous gardez une trace des deux documents, comme
pour une vraie facturation). La fiche du document affiche ensuite « Issue du
devis n°… » côté facture, et « Déjà transformé en facture n°… » côté devis.

*Correction associée — passage du statut d'une demande à « Client » :*
auparavant, choisir « Client » dans la liste déroulante des statuts changeait
juste l'étiquette affichée, sans jamais créer de fiche client (c'était un
bug, pas une erreur de manipulation — la fonction correspondante ne
contenait tout simplement pas cette logique). Il n'y avait donc personne à
sélectionner ensuite dans le générateur de devis. Désormais, choisir
« Client » ouvre la fiche client pré-remplie pour vérification ; le statut ne
change vraiment qu'une fois la fiche enregistrée. Un deuxième bug lié a été
corrigé au passage : l'enregistrement de la fiche client depuis cette
modale échouait silencieusement (un champ inexistant était envoyé à la base
de données), ce qui explique que « 0 client » apparaissait jusqu'ici même
après avoir suivi la procédure. Comme les deux façons de créer un client ont
un temps coexisté, il est possible que certaines fiches soient en double :
un bouton **« Supprimer »** a été ajouté sur chaque fiche (onglet Clients)
pour faire le ménage — supprimer une fiche ne touche pas aux devis/factures
déjà émis, qui restent consultables dans l'onglet Documents.

---

## 13. Fenêtres de confirmation « maison » (fini les popups du navigateur)

Les confirmations avant un envoi de facture Stripe, une suppression de
document ou de client, ou une transformation devis → facture, ne passent
plus par les popups natifs du navigateur (`window.confirm`) — ceux qui
affichent « nathanmarzilli.github.io indique… » avec l'icône du navigateur.
Elles utilisent désormais une petite fenêtre stylée, cohérente avec le reste
du site (`assets/js/confirm-dialog.js`, chargé sur les pages `/admin/` et
`contrat/devis&contrat/`). Le comportement est le même (Annuler / confirmer),
juste sans l'aspect intrusif du popup système.

**Bug corrigé — envoi de facture par Stripe impossible** : cliquer sur
« Envoyer » renvoyait l'erreur *« Received unknown parameter: unit_amount.
Did you mean unit_amount_decimal? »*. L'API Stripe de votre compte
n'accepte plus le paramètre `unit_amount` tel quel sur la création d'une
ligne de facture — Stripe suggère lui-même `unit_amount_decimal` (même
valeur, en centimes, sous forme de texte). La fonction Supabase
`stripe-invoice` a été corrigée en ce sens et redéployée (version 3) ; le
bouton « Envoyer la facture » fonctionne à nouveau.

**Affichage sur mobile/tablette** — dans `/admin/` → Demandes, le bouton
« Fiche client » était poussé hors de l'écran sur petit écran (il fallait
faire défiler le tableau horizontalement pour l'atteindre). Deux colonnes
moins utiles (« Reçue le », « Estimation ») se masquent maintenant sur les
petits écrans, et la colonne d'actions reste **toujours visible** à droite
pendant le défilement du tableau.

**Offre club — sélection de plusieurs modules** — cliquer sur « Ajouter à ma
demande » depuis le catalogue de modules faisait défiler la page jusqu'au
formulaire à chaque clic, empêchant d'en sélectionner plusieurs à la suite.
Ce défilement automatique a été retiré : le bouton cliqué change déjà
d'apparence sur place pour confirmer l'ajout, on peut donc enchaîner les
clics puis descendre au formulaire une fois la sélection terminée.

**Tarif des modules club** — l'étiquette « 100 € par module » a été
remplacée par « dès 100 € », pour ne pas laisser penser que le module
« Actualités simplifiées » (1 000 €) coûte 100 €.

---

## 14. Supports imprimés : flyers et cartes de visite

Ils ont quitté la page d'accueil pour une page dédiée : **`/supports/`**
(le bouton « Flyers & cartes de visite » de l'accueil y mène).

**Cinq flyers A4**, au choix selon ce que vous mettez en avant : souvenirs
(numérisation), dépannage, sécurité, formation, démarches numériques. Ils
partagent le même gabarit — logo, titre, visuel, prix, téléphone — seuls le
titre, la liste et l'illustration changent. Les prix viennent de `config.js`
(`facilitateur`) : changez-les là, les cinq flyers suivent.

Les illustrations sont dessinées en vectoriel (SVG) : elles restent nettes à
l'impression, quel que soit l'agrandissement.

**Les cartes de visite** sont prêtes pour un imprimeur professionnel : format
fini 85 × 55 mm, **3 mm de fonds perdus**, traits de coupe et zone de sécurité
de 4 mm. Pour commander en ligne, imprimez la planche en choisissant
« Enregistrer au format PDF » comme destination (échelle 100 %, marges
« aucune », graphiques d'arrière-plan cochés), et envoyez ce PDF en précisant
« 85 × 55 mm, fonds perdus 3 mm, recto/verso ».

L'adresse du site affichée en pied de flyer se règle dans `config.js` →
`brand.site`. Le jour où vous prenez un vrai nom de domaine, c'est la seule
ligne à changer.

---

## 15. Assistant d'analyse (Gemini) — gratuit, et sans risque de facturation

Deux pages font appel à une intelligence artificielle : le suivi sportif
(analyse de séance) et l'outil de prospection (analyse de site + e-mail).

**C'est gratuit.** L'offre gratuite de l'API Gemini ne demande aucune carte
bancaire, et **sans facturation activée, aucun frais ne peut survenir** : en
cas de dépassement de quota, l'API renvoie une erreur et c'est tout, elle ne
bascule jamais sur une offre payante toute seule. Le passage au payant est un
acte volontaire (lier un compte de facturation et prépayer).

**Pour l'activer** : créez une clé sur `aistudio.google.com`, puis déposez-la
dans Supabase → *Edge Functions* → *Secrets*, sous le nom `GEMINI_API_KEY`.
Tant que ce n'est pas fait, les deux pages fonctionnent normalement et
affichent simplement un message expliquant que l'analyse rédigée n'est pas
encore branchée.

**La clé ne vit que côté serveur.** Elle est utilisée par la fonction Supabase
`ai-assist` (`integrations/ai-assist.ts`), jamais par le navigateur : le site
étant public, une clé placée dans le JavaScript serait lisible — et utilisable
— par n'importe qui. Les consignes envoyées au modèle sont elles aussi
écrites côté serveur.

*À savoir* : sur l'offre gratuite, Google utilise les contenus envoyés pour
améliorer ses produits. On ne lui envoie donc que vos séances de sport et des
pages de sites publics — rien de confidentiel, aucune donnée client.

---

## 16. Prospection (`/prospect/`) — refaite de fond en comble

L'ancienne version reposait sur un fichier `proxy.php` qui **ne pouvait pas
fonctionner en ligne** (GitHub Pages n'exécute pas PHP), stockait le CRM dans
un fichier JSON (impossible à écrire sur un hébergement statique), utilisait
l'API **payante** Google Places, et contenait une clé d'API Google en clair
dans un dépôt public.

Tout cela a été remplacé :

- **La recherche** interroge l'annuaire des entreprises et associations de
  l'État français (`recherche-entreprises.api.gouv.fr`) : gratuit, sans clé,
  et il couvre précisément les clubs sportifs et les associations. Des
  raccourcis sont prévus (clubs de badminton, tennis, football, associations,
  comités des fêtes…).
- **Le CRM** vit maintenant dans Supabase, table `nm_prospects` (vos 13
  prospects existants ont été repris). Statut, relances, notes, score.
- **L'analyse d'un site** se fait en deux temps : la fonction
  `prospect-tools` va lire la page et en relève les faiblesses mesurables
  (pas de HTTPS, pas de version mobile, lenteur, copyright périmé…), puis
  l'assistant rédige le verdict, choisit **l'offre la plus adaptée** parmi
  votre catalogue et propose **un e-mail personnalisé**.
- **La liste est classée du plus intéressant au moins intéressant** (score
  décroissant), comme demandé.
- **Aucun e-mail n'est envoyé automatiquement** : vous le relisez, vous le
  modifiez, et vous l'envoyez depuis votre propre messagerie (bouton
  « Ouvrir dans ma messagerie »). C'est aussi meilleur pour la délivrabilité.

*Limite assumée* : l'annuaire public ne donne pas l'adresse du site. Un lien
de recherche pré-rempli est proposé pour la trouver en un clic, puis vous la
collez sur la fiche.

⚠️ **Fichiers à supprimer du dépôt.** `prospect/proxy.php`, `prospect/info.php`,
`prospect/database_crm.json` et `prospect/cache_quota.json` ne servent plus.
Leur contenu a été neutralisé (la clé Google en a été retirée), mais il faut
les sortir du dépôt :

```bash
git rm prospect/proxy.php prospect/info.php prospect/database_crm.json prospect/cache_quota.json
```

Et surtout : **la clé Google doit être révoquée** dans la console Google Cloud,
car elle reste lisible dans l'historique Git du dépôt public.

---

## 17. Publier les changements (GitHub Pages)

Le site est hébergé sur GitHub Pages, à partir de ce dépôt. Les fichiers de
cette livraison ont été **écrits sur votre disque**, mais le site en ligne ne
changera que lorsque vous les aurez **envoyés sur GitHub** :

```bash
git add -A
git commit -m "Refonte : suppression du paiement en ligne, admin, offre club, notifications"
git push
```

(ou l'équivalent dans votre client Git habituel — GitHub Desktop, VS Code…).
Tant que ce n'est pas fait, `nathanmarzilli.github.io/portfolio` continue
d'afficher l'ancienne version.
