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
| Prix ANNUEL d'un pack (Éclair, Essentiel, Vitrine, Premium) | `config.js` → `offers.<pack>.price` |
| Prix du Pack Sérénité / Sérénité+ | `config.js` → `offers.serenite(.Plus).price` et `.annualPrice` |
| Supplément mensuel d'une option « document » | `config.js` → `documentOptions[].monthlyEur` |
| Supplément mensuel d'un module club | `config.js` → `clubOptions[].monthlyEur` |
| Remise « lot de 3 options » | `config.js` → `optionBundle` |
| Interventions ponctuelles | `config.js` → `interventions` |
| Tarifs à domicile (facilitateur) | `config.js` → `facilitateur` |
| Surcoût du paiement au mois | `config.js` → `packBilling.monthlySurcharge` |
| Coordonnées, e-mail, téléphone | `config.js` → `contact` |

*(Il n'y a plus de ligne « hébergement » : voir la section 19.)*

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

- **Les packs de création sont des abonnements annuels reconductibles**, réglés
  en une fois, hébergement et nom de domaine compris. **Le cycle annuel est
  sélectionné par défaut partout**, et le gros chiffre affiché est toujours un
  montant mensuel (voir section 20).

  | Pack | À l'année | Affiché (annuel) | Au mois |
  |---|---|---|---|
  | Vitrine Éclair | 690 € | **58 € / mois** | 68 € |
  | Vitrine Essentiel (= offre club) | 790 € | **66 € / mois** | 77 € |
  | Vitrine Artisan | 890 € | **74 € / mois** | 86 € |
  | Vitrine Premium | 1 188 € | **99 € / mois** | 116 € |

  Le tarif de renouvellement est **le même chaque année**. Aucun montant
  mensuel n'est écrit en dur : `APP_CONFIG.packMonthlyEquivalent()` calcule
  l'affichage (annuel / 12) et `APP_CONFIG.packMonthlyPrice()` le tarif du
  cycle mensuel (équivalent × 14/12).
- Pack Sérénité **49,90 € / mois** ou **499 € / an** (2 mois offerts)
- Pack Sérénité+ **94,90 € / mois** ou **949 € / an** (2 mois offerts)
- **Options documentaires : 5 € / mois** l'unité (devis, factures, quittances,
  notes de frais) — **10 € / mois** pour le bail de location et **15 € / mois**
  pour un document sur-mesure.
- **Modules club : 5 € / mois** l'unité — sauf **Actualités simplifiées à
  33 € / mois** (back-office de publication : il porte l'abonnement du club au
  niveau du pack Premium, 66 + 33 = 99 € / mois).
- **Lot de 3** : trois options à 5 € prises ensemble coûtent **10 € / mois** au
  lieu de 15 €, par groupe complet de 3 (`config.js` → `optionBundle`).
- Interventions ponctuelles : 100 / 200 / 300 €
- **Relifting complet : 66 € / mois, 1 580 € pour 2 ans réglés en une fois**
  (ce n'est plus une prestation ponctuelle : c'est un abonnement au tarif
  Vitrine Essentiel, avec deux ans payés d'avance à la commande)

**Le Pack Sérénité n'est jamais obligatoire ni engageant** : il se choisit
librement, en mensuel ou en annuel, et reste résiliable à tout moment.

Une remise s'applique automatiquement quand il est pris **en même temps**
qu'un pack de création ou qu'une offre club, et **uniquement sur la formule
annuelle** :

| | Plein tarif | Avec création (annuel) |
|---|---|---|
| Pack Sérénité | 49,90 € / mois · 499 € / an | **37,43 € / mois** · 449,10 € / an (1 mois offert supplémentaire) |
| Pack Sérénité+ | 94,90 € / mois · 949 € / an | **71,18 € / mois** · 854,10 € / an (1 mois offert supplémentaire) |

En **mensuel**, aucune remise : 49,90 € et 94,90 €, quel que soit le pack.

C'est `APP_CONFIG.comboDiscountFor(packKey, tier, cycle)` qui tranche, et
`APP_CONFIG.applyComboToAnnual()` qui calcule — une seule règle, réutilisée
partout (accueil, offre club, devis, admin).

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
| `nm_prospects` | Prospection (clubs, associations) | Admin uniquement |

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
Supabase** : `nathan.marzilli@gmail.com` (`config.js` → `contact.authEmail`).

**Attention à ne pas confondre deux adresses distinctes** depuis la refonte de
septembre 2026 :

- `nathan.marzilli@gmail.com` — identifiant de connexion admin (Supabase Auth)
  et destinataire des notifications techniques (Google Apps Script). Ne doit
  **jamais** apparaître comme contact public.
- `contact@clicalaide.com` — adresse affichée publiquement partout sur le site
  (`config.js` → `contact.email`). C'est celle que voient les visiteurs et les
  clients.

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
Tant que ce n'est pas fait, `clicalaide.fr` continue d'afficher l'ancienne
version.

---

## 18. Refonte septembre 2026 : tarifs sans engagement, marque « Clic à l'aide », domaine propre

Cette section résume le gros chantier livré en une fois. Les sections
précédentes restent valables ; celle-ci documente ce qui a changé par-dessus.

### Fini l'engagement forcé sur le Pack Sérénité

Avant : prendre le pack « L'Essentiel & Suivi » forçait l'ajout du Pack
Sérénité en annuel, avec un engagement de 12 mois impossible à retirer depuis
le formulaire (la case restait cochée). Ce n'était pas qu'un problème
d'affichage : la fonction `forceSerenity()` dans `script.js` bloquait
réellement la désélection.

Désormais :

- Le Pack Sérénité (et Sérénité+) est **toujours facultatif et toujours
  désélectionnable**, quel que soit le pack de création choisi.
- **Aucun engagement, sur aucun cycle.** Résiliable à tout moment, sans
  justification.
- Quatre cycles de facturation possibles : mensuel, trimestriel, annuel
  (2 mois offerts), 3 ans. Le visiteur choisit librement.
- Une remise combo s'applique **seulement** si Sérénité est pris **en même
  temps** qu'un pack de création (ou une offre club) : -50 % la 1ère année
  pour Sérénité, -10 % en continu pour Sérénité+. Sans création (« site déjà
  existant »), c'est le tarif plein.

Cette logique est **centralisée dans `config.js`**
(`APP_CONFIG.comboDiscountFor`) et consommée à l'identique par `script.js`
(accueil), `assets/js/offre-club.js`, `assets/js/quote-builder.js` (donc
`/kickoff/`, `/admin/` et le générateur devis/contrat) et `assets/js/admin.js`.
Un seul endroit à modifier si les pourcentages doivent changer un jour.

*Remarque de prudence* : la remise Sérénité+ est volontairement présentée
comme « tant que vous êtes accompagné avec moi » plutôt que « à vie » dans
tous les textes publics — la formulation d'un avantage tarifaire permanent
mérite d'être validée juridiquement avant d'être affichée telle quelle.

### Renouvellement du Pack Sérénité — ce qui est écrit noir sur blanc

Une nouvelle question FAQ sur l'accueil explique la mécanique du
renouvellement annuel : la facture part 10 jours avant la date anniversaire,
l'abonnement est résiliable à tout moment sans justification, mais une
facture impayée après échéance peut entraîner une mise hors ligne du site (le
nom de domaine et l'hébergement OVH, eux, restent la propriété du client). Ce
point n'a **pas** de mécanique d'envoi automatique côté admin pour l'instant
— seule la mention légale côté client est en place. Si vous voulez un rappel
automatique avant chaque échéance, c'est à construire séparément (par exemple
un cron Supabase qui interroge `nm_documents`/`nm_clients` et déclenche une
notification).

### Hébergement OVH : ce qui est inclus

La section « Hébergement » de l'accueil a été clarifiée : la mise en place
technique, la sécurité et le suivi de l'hébergement sont **inclus** dans
l'accompagnement (ce n'est pas une prestation facturée à part). Seul
l'abonnement OVH lui-même reste une ligne séparée, car il doit rester au nom
du client pour garantir une propriété à 100 % du site et du domaine.

### Marque : « Clic à l'aide » passe devant

Le site met maintenant en avant le nom **Clic à l'aide** (logo, titre des
pages, pied de page, prospectus) ; le nom de Nathan reste visible juste
derrière, pour la confiance et le contact humain direct — l'objectif n'est
pas d'effacer la personne, juste de donner un nom d'entreprise mémorisable et
cessible. Pages internes (admin, prospection) : titres alignés par cohérence,
sans autre changement puisqu'elles ne sont vues que par vous.

### Domaine propre : clicalaide.fr / clicalaide.com

`config.js` → `brand.site` pointe désormais vers `clicalaide.fr` (domaine
principal), avec `clicalaide.com` en alias (`brand.siteAlt`). Balises
canonical, Open Graph, Twitter Card et JSON-LD (`ProfessionalService`) ajoutées
sur les pages publiques pour le référencement. `robots.txt` et `sitemap.xml`
ont été créés à la racine.

⚠️ **Le QR code du prospectus** (`images/flyer/qr-site.png`) encode encore
l'ancienne adresse GitHub Pages en dur dans l'image : ce n'est pas un texte
modifiable ici, il faudra régénérer ce visuel avec la nouvelle URL avant de
réimprimer ce support.

### Lien « Flyers & cartes de visite » masqué au public

Ce lien, sur l'accueil, ne s'affiche plus que si vous êtes connecté en admin
(vérification `db.isAdmin()` au chargement, échec = masqué par défaut). Les
visiteurs ne le voient plus.

### Nouveau champ au kickoff

Le formulaire `/kickoff/` demande maintenant le **nom de site souhaité** (avec
un exemple), en plus des informations déjà collectées.

---

## 19. Correctif septembre 2026 (2ᵉ passe) : abonnement annuel, hébergement interne

Cette passe corrige trois choses qui avaient été mal comprises lors de la
première livraison. Elle **remplace** ce qui était écrit plus haut sur les
cycles de facturation.

### Retour à deux cycles seulement

Les cycles « trimestriel » et « 3 ans » ont été **retirés** : le Pack Sérénité
et Sérénité+ se choisissent uniquement en **mensuel** ou en **annuel**
(2 mois offerts), comme avant. Toujours sans engagement, résiliables à tout
moment sur les deux cycles.

La remise de bienvenue est inchangée : **-50 % la première année** sur Sérénité
si le client le prend en même temps qu'un pack de création (-10 % en continu
pour Sérénité+). Le site le dit explicitement dès qu'un pack est sélectionné.
Au bout d'un an, Sérénité repasse au tarif normal, **facturé en même temps que
le renouvellement du site** : une seule échéance à retenir pour le client.

### Les packs de création sont des abonnements annuels

C'est le vrai changement de modèle. Un pack n'est plus un achat unique : c'est
un **abonnement annuel reconductible au même tarif**, réglé en une fois, qui
comprend le site, l'hébergement, le nom de domaine et la sécurité.

Le site affiche **le prix mensuel en gros** (69 / 99 / 179 / 299 €) avec une
bascule Mensuel / Annuel identique à celle des packs Sérénité, comme sur
theralys-web.fr. Le mensuel est une facilité de paiement volontairement plus
chère (annuel ÷ 10), ce qui rend l'annuel visiblement plus intéressant.

Techniquement :

- `config.js` → `packBilling.monthlyDivisor` (10) et `monthsFree` (2) ;
- `APP_CONFIG.packMonthlyPrice(offerKey, devise)` calcule l'équivalent mensuel
  dans n'importe quelle devise — **aucun prix mensuel n'est écrit en dur** ;
- dans le HTML, une carte de pack porte `data-pack-price="<clé>"` et contient
  `.pack-price-amount`, `.pack-price-suffix` et `.pack-price-detail`, remplis
  par `renderPackCardPrices()` (`script.js`) ou `renderClubPackPrice()`
  (`offre-club.js`) — pas par `i18n.js`, puisque l'affichage dépend du cycle ;
- `data-offer-key="essentiel-monthly"` existe aussi pour afficher l'équivalent
  mensuel dans du texte courant (i18n.js sait résoudre le suffixe `-monthly`).

Le choix du client suit tout le parcours : nouvelle colonne **`pack_cycle`**
dans `nm_leads` et `nm_clients` (migration `add_pack_cycle_to_leads_and_clients`,
nullable — une valeur absente est traitée comme `annual`, le tarif de
référence). Elle est lue par `quote-builder.js`, donc le devis, le kickoff,
l'admin et la facture Stripe reprennent automatiquement le bon montant et la
bonne formulation. La fiche client (`/admin/`) a un nouveau sélecteur
« Facturation du site ».

### Plus d'hébergement OVH facturé à part

L'hébergement professionnel et les noms de domaine sont désormais gérés en
interne. Conséquences appliquées partout sur le site :

- l'objet `hosting` de `config.js` a été **supprimé** (ainsi que les
  `hostingKey` des packs) — ne pas le réintroduire ;
- la section dépliante « Pourquoi payer l'hébergement à part ? » et la fonction
  `toggleHosting()` ont disparu, remplacées par un bloc **« Hébergement, domaine
  et sécurité : tout est compris »** (4 tuiles : domaine, hébergement pro,
  sécurité/HTTPS, sauvegardes) ;
- les 4 cartes de packs affichent « Hébergement, domaine & sécurité inclus » à
  la place de la ligne de tarif OVH ;
- le formulaire `/kickoff/` ne demande plus l'hébergeur du client : il demande
  seulement s'il possède déjà un nom de domaine et lequel.

### La propriété du site n'est plus promise en l'état

L'ancienne FAQ « Suis-je vraiment propriétaire du site ? » promettait au client
d'être « 100 % propriétaire de son nom de domaine et de son hébergement ».
Ce n'est plus exact maintenant que tout est hébergé en interne : la question a
été remplacée par **« Qu'est-ce qui est compris, et qu'est-ce que je paie
exactement ? »**, qui reste factuelle (tout est inclus, les contenus restent
ceux du client) **sans promettre de transfert**. À rediscuter avec un juriste
si vous voulez réintroduire une garantie de sortie (transfert du domaine).

La même prudence a été appliquée sur `/offre-club/`, où le discours porte
maintenant sur la continuité entre bureaux successifs plutôt que sur la
propriété du domaine par l'association.

### Vérifications automatiques

- `qa/func-home-pricing.mjs` — **20 assertions** : cycles des packs, montants
  dans les deux cycles, « 2 mois offerts », absence de trimestriel/3 ans,
  absence de toute mention OVH, remise combo, note de facturation, lien flyers
  masqué, sous-titre de nav, zéro erreur JS.
- `qa/func-club.mjs` — **19 assertions**, dont la bascule mensuel/annuel du site
  club et l'absence d'OVH.
- `audit.mjs` : **0 anomalie** sur les 10 pages.

---

## 20. Nouvelle grille tarifaire (septembre 2026, 3ᵉ passe)

Cette section **remplace les montants** donnés plus haut dans les sections 18
et 19. Le modèle (abonnement annuel, hébergement compris) ne change pas ; ce
sont les prix et la façon de les afficher qui changent.

### Le cycle annuel est sélectionné par défaut, partout

Accueil et offre club démarrent sur « Annuel », pour les packs comme pour le
Pack Sérénité. C'est le tarif de référence, et celui que le client doit voir
en premier.

### Deux montants mensuels à ne pas confondre

Dans les **deux** cycles, le gros chiffre affiché est un montant mensuel —
c'est ce que le client compare. Ce qui change, c'est lequel :

| | Éclair | Essentiel | Artisan | Premium |
|---|---|---|---|---|
| Tarif annuel (catalogue) | 690 € | 790 € | 890 € | 1 188 € |
| **Affiché en annuel** (annuel / 12) | **58 €** | **66 €** | **74 €** | **99 €** |
| Tarif du cycle mensuel (× 14/12) | 68 € | 77 € | 86 € | 116 € |
| Coût réel sur l'année au mois | 816 € | 924 € | 1 032 € | 1 392 € |

Payer au mois revient donc à **14 mensualités** au lieu de 12 : c'est ce qui
justifie le « 2 mois offerts » affiché sur le cycle annuel.

Le calcul se fait en **deux arrondis successifs** (et pas en une seule
formule) : l'équivalent mensuel est arrondi d'abord, puis multiplié par 14/12.
C'est ce qui garantit que le chiffre affiché (58 €) et le chiffre facturé
(68 €) restent cohérents entre eux. Voir `APP_CONFIG.packMonthlyEquivalent()`
et `APP_CONFIG.packMonthlyPrice()`.

Dans le HTML, `data-offer-key="<pack>-monthly"` affiche **l'équivalent
mensuel** (58 €), jamais le tarif du cycle mensuel.

### Les options deviennent des suppléments mensuels

Les automatisations de documents et les modules club ne sont plus des achats
uniques. Ils s'ajoutent à l'abonnement :

- options documentaires : **5 € / mois** (devis, factures, quittances, notes de
  frais, bail) ; **15 € / mois** pour un document sur-mesure ;
- modules club : **5 € / mois**, sauf **Actualités simplifiées à 33 € / mois**
  (ce qui porte l'abonnement du club à 99 € / mois, soit le niveau Premium) ;
- nouveau module club : **Suivi de présence dans les cours** (5 € / mois).

**Lot de 3** : trois options à 5 € prises ensemble coûtent 10 € / mois au lieu
de 15 €, **par groupe complet de 3** (6 options → 20 €, 7 → 25 €). Les options
à 15 € et 33 € n'entrent jamais dans le lot. Une seule fonction porte cette
règle : `APP_CONFIG.optionsMonthlyTotal()`, avec
`APP_CONFIG.optionsBundleSaving()` pour afficher l'économie.

Conséquence sur le devis : chaque option est facturée à son tarif, puis une
**ligne de remise unique** « lot de 3 options » apparaît — c'est ce qui reste
lisible sur un devis papier, plutôt que des prix unitaires bricolés.

### Ce que montre le récapitulatif du formulaire

Le gros total est le **premier versement** :

- en annuel : prix annuel du pack + (options mensuelles × 12) + intervention
  éventuelle ;
- au mois : tarif mensuel du pack + options mensuelles + intervention.

Une note sous le total détaille les deux lignes (site / options) et signale
quand le lot de 3 a été appliqué.

### Autres changements

- **Vitrine Éclair** est désormais annoncée « livré en une semaine » (et non
  plus 48 h) ; `deliveryDays` passe de 2 à 7.
- **Vitrine Artisan** est positionnée comme le pack *modulable* (`modular:
  true` dans le catalogue).
- La remise **-50 % sur le Pack Sérénité la 1ère année** reste valable avec
  **tous** les packs de création (décision de Nathan), inchangée.
- Point d'équilibre de l'offre club recalculé : **6 adhésions** au lieu de 7
  (790 € / 140 € de cotisation moyenne).

---

## 21. Ajustements du 15 septembre 2026

### Noms des packs harmonisés

Toute la gamme porte désormais le préfixe « Vitrine » : **Vitrine Éclair**,
**Vitrine Essentiel** (ex « L'Essentiel & Suivi »), **Vitrine Artisan**,
**Vitrine Premium**. Les noms vivent dans `config.js` → `offers.<pack>.name` ;
les titres de cartes, les libellés de boutons radio et l'outil de prospection
ont été alignés.

### Affichage : toujours le mensuel en grand

La règle vaut maintenant pour **tous** les tarifs récurrents du site, packs
comme formules de suivi : le gros chiffre est un montant mensuel, le montant
réellement facturé (l'année réglée en une fois) est rappelé juste en dessous.
Quand une remise s'applique, les **deux** tarifs pleins — mensuel ET annuel —
sont barrés au-dessus du prix remisé.

Côté code, les cartes Sérénité fonctionnent comme les cartes de packs :
`.price-amount` (le gros chiffre), `.price-suffix` et une ligne
`.serenity-price-detail` remplie par `renderSerenityCardPrices()` (accueil) ou
`renderSerenityPrices()` (club).

⚠️ **Piège corrigé** : ces fonctions cherchaient la carte avec
`document.querySelector('[data-offer-key="serenite"]')`. Or « serenite »
apparaît aussi dans le comparatif et dans la FAQ : le sélecteur attrapait le
premier de ces textes et y écrivait le prix de la carte — la carte, elle, ne
changeait jamais. Le filtre **`[data-offer-skip]` est obligatoire** : seules
les cartes le portent.

### Les remises ne s'appliquent plus qu'en annuel

`comboDiscount.cycles: ['annual']` dans `config.js`. En facturation mensuelle,
Sérénité reste à 49,90 € et Sérénité+ à 94,90 €, quel que soit le pack choisi.
`APP_CONFIG.comboDiscountFor()` prend un troisième argument `cycle` et renvoie
`null` si le cycle n'est pas éligible.

### Sérénité+ : -10 € par mois au lieu de -10 % *(remplacé le jour même — voir § 22)*

Un montant rond se lit mieux qu'un pourcentage. La remise vaut donc **-10 € par
mois, soit -120 € sur l'année** : 949 € → 829 € / an (69,08 € / mois affichés).
Le catalogue accepte les deux formes et `APP_CONFIG.applyComboToAnnual()` gère
l'une comme l'autre :

```js
comboDiscount: { percent: 50, ... }      // Pack Sérénité
comboDiscount: { monthlyEur: 10, ... }   // Pack Sérénité+
```

> ⚠️ **Ce mécanisme (-50 % / -10 €) a été jugé trop généreux par Nathan dès
> réception (« c'est l'hécatombe pour moi ») et remplacé le jour même par un
> mois offert supplémentaire — voir le § 22 ci-dessous pour la règle
> actuellement en vigueur. Cette section est conservée pour l'historique.

### Bug corrigé : le tarif remisé restait affiché

Dans le formulaire de la page d'accueil, choisir Sérénité puis basculer sur
« j'ai déjà un site » laissait le tarif remisé dans les boutons alors que la
remise ne s'appliquait plus. En cause : les prix des boutons n'étaient mis à
jour que par `setSerenityBillingCycle()`. Ils sont désormais dans
`renderSerenityFormPrices()`, appelée aussi par `refreshComboHint()` — donc à
chaque changement de pack ou de type de demande. Le même réflexe a été vérifié
sur `/offre-club/`.

### Contraste de la bascule mensuel / annuel

Le « — le plus avantageux » était écrit en vert sur la pastille active, qui est
bleu plein : illisible en thème clair (vert #059669 sur bleu #1D4ED8). Une
classe dédiée règle le problème dans `app.css` :

```css
.billing-cycle-pill__hint { color: rgb(var(--t-emerald-400)); }
.billing-cycle-pill.active .billing-cycle-pill__hint { color: #ffe08a; }
```

**Ne pas remettre `text-emerald-400` en dur** dans le HTML des pastilles.

### Autres changements

- **Bail de location** : 5 € → **10 € / mois** (document plus lourd que les
  autres : clauses légales, annexes).
- **Relifting complet** : ce n'est plus une intervention ponctuelle à prix fixe.
  C'est un **abonnement au tarif Vitrine Essentiel (66 € / mois affichés)** dont
  les **deux premières années sont réglées en une fois** à la commande, soit
  1 580 €. Décrit par `interventions.relifting` avec `subscription: true`,
  `offerKey`, `prepaidYears` — le devis en tire automatiquement son libellé.
- **Tables de conversion** (`config.js` → `conversion.<devise>.exact`)
  rafraîchies : les paliers couvrent les nouveaux montants libres (5, 10, 15,
  33, 66, 120, 1 580 €) ; les anciens paliers des packs et de l'hébergement OVH
  ont été retirés.
- **Stripe** : aucune modification nécessaire. La fonction `stripe-invoice`
  facture à partir des documents produits par `quote-builder.js`, qui applique
  déjà la bonne règle de cycle et de remise — vérifié sur les trois cas
  (annuel avec création, mensuel sans remise, site existant).

### Vérifications

`qa/func-home-pricing.mjs` **36 assertions** et `qa/func-club.mjs`
**30 assertions**, toutes au vert, dont le bug de bascule ci-dessus et le
contraste réellement calculé (`getComputedStyle`). `audit.mjs` à 0 anomalie.

---

## 22. Correctif du 15 septembre 2026 (même jour) : un mois offert plutôt qu'une remise en %/€

Dès réception du § 21, Nathan a signalé que la remise combo (-50 % Sérénité /
-10 € par mois Sérénité+) rognait bien trop sa marge (« c'est l'hécatombe pour
moi ») : au tarif remisé, Sérénité tombait à 20,79 € / mois et Sérénité+ à
69,08 € / mois. Il a demandé un mécanisme beaucoup plus simple et **identique
sur les deux tiers** : puisque la formule annuelle inclut déjà 2 mois offerts
par rapport au tarif mensuel (499 € au lieu de 10 × 49,90 € = 599 €), la
remise combo se limite désormais à **un mois offert supplémentaire** la
première année — soit 3 mois offerts en tout — au lieu d'un pourcentage ou
d'un montant fixe par mois.

### Nouveau calcul

`config.js` → `offers.serenite.comboDiscount` et
`offers.serenitePlus.comboDiscount` prennent tous les deux la forme :

```js
comboDiscount: {
  extraMonthsFree: 1,
  scope: 'firstYear',
  cycles: ['annual'],
  label: 'un mois offert supplémentaire, formule annuelle, si créé avec moi'
}
```

`APP_CONFIG.applyComboToAnnual(annualEur, combo, monthlyRefEur)` gère la
nouvelle forme (`extraMonthsFree`) en plus des deux anciennes (`percent`,
`monthlyEur`, conservées pour compatibilité) :

```js
if (combo.extraMonthsFree) {
  return Math.max(0, Math.round((annualEur - monthlyRefEur * combo.extraMonthsFree) * 100) / 100);
}
```

Le troisième argument `monthlyRefEur` est **le tarif mensuel plein de
l'offre** (`offers.serenite.price.EUR` = 49,90, `offers.serenitePlus.price.EUR`
= 94,90) — jamais recalculé depuis l'annuel, pour rester exact au centime.
Chacun des 4 appelants (`script.js`, `assets/js/offre-club.js`,
`assets/js/quote-builder.js`, `assets/js/admin.js`) le transmet désormais.

### Nouveaux tarifs

| | Plein tarif | Avec création (annuel) |
|---|---|---|
| Pack Sérénité | 49,90 € / mois · 499 € / an | **37,43 € / mois** · 449,10 € / an |
| Pack Sérénité+ | 94,90 € / mois · 949 € / an | **71,18 € / mois** · 854,10 € / an |

Calcul : 499 − 49,90 = 449,10 € / an (÷ 12 = 37,425 → arrondi 37,43 € / mois) ;
949 − 94,90 = 854,10 € / an (÷ 12 = 71,175 → arrondi 71,18 € / mois). Toujours
**uniquement sur la formule annuelle** (`comboDiscount.cycles: ['annual']`) :
en mensuel, Sérénité reste à 49,90 € et Sérénité+ à 94,90 €, sans aucune
remise — inchangé depuis le § 21.

### Textes remplacés

Toute mention de « -50 % la 1ère année » ou « -10 € / mois » a été remplacée,
dans `index.html` et `offre-club/index.html`, par une formulation centrée sur
le mois offert (badges courts, paragraphes sous les cartes Sérénité/Sérénité+,
FAQ, comparatif « Ailleurs sur le marché »). Le libellé du catalogue
(`combo.label`) alimente aussi directement la puce récapitulative du
formulaire et la ligne de devis générée par `quote-builder.js` — une seule
source de texte, comme pour les prix.

### Vérifications

Les assertions combo-discount de `qa/func-home-pricing.mjs` et
`qa/func-club.mjs` ont été réécrites avec les nouveaux montants (37,43 € /
449,10 € et 71,18 € / 854,10 €) et le nouveau texte (« mois offert
supplémentaire »). Les deux suites repassent au vert (36/36 et 30/30), ainsi
que `audit.mjs` (0 anomalie) et une vérification directe de la sortie de
`quote-builder.js` (via un script Node isolé) pour les 4 cas : pack + Sérénité
annuel, pack + Sérénité+ annuel, site existant + Sérénité annuel (pas de
remise), pack + Sérénité mensuel (pas de remise).

---

## 23. Passe de cohérence avant prospection (17/09/2026)

Objectif : un site transmissible aux clubs et prêt pour une cinquantaine
d'e-mails de prospection.

### Tarifs Sérénité « nets »

La remise combo (formule annuelle + site créé par Nathan) affiche désormais
des montants ronds : **Sérénité 37,90 € / mois · 454,80 € / an**,
**Sérénité+ 71,90 € / mois · 862,80 € / an**. Porté par
`comboDiscount.firstYearMonthlyEur` dans `config.js`, lu en priorité par
`APP_CONFIG.applyComboToAnnual()` (× 12). `extraMonthsFree: 1` reste la
description commerciale (« +1 mois offert »). Mensuel inchangé (49,90 / 94,90).

- Cartes Sérénité : phrase « Un mois offert supplémentaire… » supprimée ; à
  côté de « 2 mois offerts », étiquette **« +1 mois offert »** avec infobulle
  (site créé par Nathan). Les cartes de `offre-club/index.html` sont une
  **copie conforme** de celles d'`index.html` (seuls les boutons diffèrent :
  `data-club-serenity` au lieu de `onclick`).

### Composants partagés ajoutés (`assets/css/app.css`)

- `.nm-tip` / `.nm-tip--start` : infobulle CSS (survol, focus, toucher).
  Utilisée sur « Livré en … » (délai indicatif) et « +1 mois offert ».
- `.hover-tile` : même animation de survol que `.interactive-hover`, pour les
  tuiles (hébergement, comparatif, chiffres de l'offre club…).
- `.funnel-step.is-current` + `.funnel-step__here` / `__free` : étape 1
  « Vous êtes ici — gratuit & sans engagement » (accueil et club).
- `.eq-frame` : bordure animée du « point d'équilibre » (dégradé conique via
  `@property`), remplace le carré de 2 500 px en rotation.
- `.total-split` / `.total-legend` : total estimé en deux couleurs (site en
  accent + Sérénité en bleu), qui passe à la ligne au lieu de déborder.
- Cartes de packs : sous 1024 px, les hauteurs minimales d'alignement et les
  lignes fantômes sont neutralisées (alignement ordinateur conservé).

### Bugs corrigés

- **Pastille « Annuel » pas bleue** : le sélecteur de survol était plus
  spécifique que `.active`. Le survol ne vise plus que la pastille inactive.
  Le libellé devient une étiquette verre dépoli (fini le jaune clair).
- **« / mois / mois »** : `data-offer-key` sur une offre récurrente ou
  `*-monthly` ajoute DÉJÀ « / mois ». Ne jamais écrire « / mois » derrière
  (ou poser `data-price-suffix=""`).
- Bail de location : affiché 5 € alors que facturé 10 € (catalogue) → 10 €,
  même couleur que les autres documents.
- `prospect/` — **« Analyser le site » sans effet** : l'adresse tapée dans la
  fiche n'était pas enregistrée, et Gemini renvoyait parfois un JSON tronqué
  (`data: null` enregistré en silence). Adresse enregistrée automatiquement,
  réponse vide signalée, et fonction Edge `ai-assist` **v3 déployée** (sortie
  JSON forcée, 4 096 jetons, repli d'extraction, `ok:false` si illisible).
- `prospect/` — prix des modules vides (`priceEur` → `monthlyEur`).

### Nouveautés

- **`/aide-domicile/`** : page dédiée (section « Le numérique, sans prise de
  tête » déplacée depuis l'accueil, où reste un encart + onglet de nav),
  bouton « Appelez-moi » (nav, en-tête, barre fixe mobile) et **estimation du
  temps de trajet** (`assets/js/aide-domicile.js`) : Géoplateforme IGN
  (autocomplétion, géocodage, itinéraire — gratuit, sans clé), repli
  Nominatim / OSRM, puis estimation à vol d'oiseau. Point de départ : domicile
  de Nathan, jamais affiché. Ajoutée au `sitemap.xml` et à `config.pages`.
- **`assets/js/projects-showcase.js`** : aperçu des réalisations partagé
  accueil / club (le script inline de `offre-club/` est supprimé).
  `data-projects="bad-evian"` filtre les projets affichés.
- Module club **« Gestion & suivi des essais »** (5 € / mois).
- FAQ réécrite en une seule grille alignée (10 questions) : délais par pack,
  paiement Stripe uniquement (plus de RIB), disponibilité de Nathan.
- Parrainage : les 50 € sont versés une fois le site du filleul livré et réglé.
- Largeur harmonisée : `max-w-7xl` sur `/offre-club/`, `/aide-domicile/`, FAQ
  et contact de l'accueil.
- Formulaire : packs nommés Éclair / Essentiel / Artisan / Premium ; total en
  deux montants + « Paiement reconduit chaque année à la date de facturation ».

### Prospection (`prospect/`)

- Pagination complète des résultats (numéros + « Charger la suite ») et tri
  (date de création, nom, ville, non suivis d'abord) — tri appliqué aux pages
  chargées (l'annuaire ne trie pas).
- Tri des prospects (score, date d'ajout, nom, dernier contact, relance).
- E-mail pré-rempli : modèle **club** (reconversion, adhérent, bureau soulagé,
  nouveaux adhérents, premier échange gratuit, conseils offerts) ou modèle
  structure. Bouton « Message pré-rempli ».
- Blocs « Ce que vous pouvez leur proposer » cliquables : 1 vitrine, 1 Pack
  Sérénité, modules multiples → réécrit le paragraphe « Concrètement… ».
- **Passage en rendez-vous** (bouton « RDV » ou statut « Rendez-vous ») :
  fenêtre de saisie puis insertion dans `nm_leads` (`source: 'prospection'`),
  donc visible dans `/admin/`.
- `/admin/` : **suppression d'une demande** (`db.deleteLead`, confirmation
  `nmConfirm`) ; briefs/documents liés conservés (FK ON DELETE SET NULL).

---

## 24. Aide à domicile : tarifs centralisés, fidélité, facture rapide, flyers photo (17/09/2026)

### Tarifs — un seul endroit : `config.js → facilitateur`

| Clé | Valeur | Rôle |
|---|---|---|
| `prestationEur` | 70 € | prix d'une prestation (plus de tarif horaire) |
| `complexSurchargeEur` | 15 € | supplément si le problème s'avère complexe |
| `noFixNoFee` | `true` | déplacement sans solution = gratuit |
| `diagnosticEur` | 90 € | diagnostic complet |
| `cassetteEur` | 70 € | numérisation d'une cassette |
| `cassetteBundle` | `{ count: 10, freeItems: 1 }` | lot de 10 = 630 € (calculé) |
| `photoEur` | 0,15 € | photo numérisée |
| `loyalty` | `{ visits: 5, discountPercent: 50 }` | carte de fidélité |
| `services` | liste | prestations facturables (facture rapide) |

`hourlyEur` reste un **alias** (getter) de `prestationEur`. L'ancien `pack5hEur`
est supprimé : le « pack 5 heures » devient la carte de fidélité (rien à payer
d'avance).

- Montants dérivés : `APP_CONFIG.facilitateurAmount('cassetteBundle' | 'loyaltyVisit' | 'prestationComplex' | <clé>)`.
- Textes dérivés : `APP_CONFIG.facilitateurText('loyaltyVisitOrdinal' | 'loyaltyPercent' | 'bundleCount' | 'bundleFree')`.
- Dans le HTML : `data-fac-price="<clé>"` (reçoit `data-price-eur`, rendu par i18n.js)
  et `data-fac-text="<clé>"`. `hydrateFacilitateur()` tourne automatiquement
  au chargement de config.js, AVANT le rendu des prix.
- **Passer à 80 €** : modifier `prestationEur` (et `cassetteEur` si besoin) —
  la page, l'encart, les flyers et la facture rapide suivent (vérifié par test).

### Page `/aide-domicile/`

- Bandeau d'engagements (70 € la prestation, +15 € si complexe, pas de solution
  = gratuit, carte de fidélité), prix « / prestation » sur chaque carte, option
  **lot de 10 cassettes**, carte « Votre fidélité est récompensée » avec les
  tampons dessinés depuis `loyalty`.
- **Mode admin** (utilisateur connecté présent dans `nm_admins`, vérifié via
  `db.isAdmin()`) : barre « Mode administrateur » (facture rapide + liens
  d'impression des flyers `../supports/?theme=…`) et bouton « Facturer » sur
  chaque prestation. Rien de visible pour un visiteur (`.admin-only.hidden`).

### Facture rapide — `assets/js/quick-invoice.js`

Disponible sur `/aide-domicile/` (admin) et `/admin/` (onglet Clients →
« Facture rapide »). Une fenêtre : prestation, quantité, supplément complexe,
remise fidélité, « aucune solution trouvée » (visite gratuite enregistrée),
coordonnées du client.

1. `nm_clients` : fiche `source: 'aide-domicile'`, `pack: 'aide-domicile'`,
   `pack_label` = prestation, `status: 'livre'`.
2. `nm_documents` : facture numérotée (`nm_next_doc_number`).
3. Stripe (`stripe-invoice` **v5**, `onsite: true`) : e-mail facultatif ;
   s'il est fourni, Stripe envoie aussi la facture.
4. QR code de la page de paiement Stripe (bibliothèque `qrcode-generator`
   chargée depuis cdnjs) + bouton « Ouvrir la page de paiement ».
5. Suivi toutes les 4 s (`action: 'status'`) : facture → `payee`,
   client → `invoice_status: 'payee'`.

Stripe refuse les lignes négatives : la remise fidélité est intégrée à la
ligne principale (« — remise fidélité appliquée »), le détail reste sur la
facture interne.

**Limite assumée :** « poser son téléphone sur celui de Nathan » (Tap to Pay,
NFC) n'est pas possible depuis une page web — Stripe le réserve à son
application mobile / SDK Terminal. Le client paie en scannant le QR code avec
son téléphone (carte, Apple Pay, Google Pay), ou sur le téléphone de Nathan.

`/admin/` : `packLabel('aide-domicile')` = « Aide à domicile », option ajoutée
au sélecteur de pack ; modifier une telle fiche conserve le montant et le
libellé de la prestation.

### Fonction Edge `stripe-invoice` v5 (`integrations/stripe-invoice.ts`)

Rétrocompatible : sans `onsite`, comportement identique à la v4 (e-mail
obligatoire, envoi par Stripe). Ajouts : `onsite` (e-mail facultatif, client
Stripe créé au nom), `action: 'status'`, champ `emailed` dans la réponse.
Toujours `unit_amount_decimal` (règle 10).

### Flyers & cartes (`/supports/`)

- Case **« Image de fond »** (cochée par défaut, mémorisée) : photos
  `images/flyer/cassettes.jpeg`, `ordi-imprimante.jpeg`, `securite.jpeg`,
  `assistance.jpeg`, `ameli.jpeg`. La photo est un calque de la zone visuelle
  (`.f-photo`) : calque flou + calque net, fondus par des **voiles blancs en
  dégradé** (pas de masques combinés : ignorés à l'impression). Le dessin
  vectoriel reste dans le flux en `visibility: hidden` → **aucun texte ne
  bouge**. Les blocs au-dessus de la photo passent en `z-index: 2`.
- Prix « / prestation » issus de `prestationEur`.
- **Pied de flyer** (dans la marge basse, sans décaler le reste) : carte de
  fidélité ; sur « Souvenirs », le lot de 10 cassettes.
- Case **« recto carte de fidélité »** : 5 cases à tamponner, la dernière
  « -50 % », note « à garder sur le frigo » ; conseils d'impression (recto mat
  non pelliculé, aimant adhésif).
- Lien direct `?theme=souvenirs|depannage|securite|formation|demarches|cartes`.
