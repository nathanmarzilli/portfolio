<?php
/*
 * ============================================================
 * FICHIER OBSOLÈTE — À SUPPRIMER DU DÉPÔT
 * ============================================================
 *
 * Ce fichier ne sert plus à rien et ne fonctionnait de toute
 * façon pas en ligne : GitHub Pages est un hébergement
 * statique, il n'exécute pas PHP. Servi tel quel, ce fichier
 * était simplement affiché en texte brut à qui demandait
 * l'adresse — et il contenait une clé d'API Google en clair.
 *
 * Cette clé a été retirée. Elle doit en plus être RÉVOQUÉE
 * dans la console Google Cloud (API et services > Identifiants),
 * car elle reste lisible dans l'historique Git du dépôt public.
 *
 * Ce que ce fichier faisait, et où c'est passé :
 *   - recherche de prospects  -> fonction Supabase `prospect-tools`
 *     (annuaire public de l'État, gratuit, sans clé d'API)
 *   - inspection d'un site    -> même fonction, action `inspect`
 *   - base CRM en JSON        -> table Supabase `nm_prospects`
 *   - envoi d'e-mail          -> retiré volontairement : les
 *     e-mails partent désormais depuis votre propre messagerie,
 *     ce qui évite qu'ils finissent en spam.
 *
 * Pour supprimer proprement ce fichier et ses voisins :
 *   git rm prospect/proxy.php prospect/info.php \
 *          prospect/database_crm.json prospect/cache_quota.json
 *   git commit -m "Retrait de l'ancien backend PHP de prospection"
 * ============================================================
 */
http_response_code(410);
echo "Ce point d'entrée n'existe plus. Voir prospect/ dans l'espace sécurisé.";
