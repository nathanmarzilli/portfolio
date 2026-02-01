<?php
// proxy.php - VERSION ULTRA-COMPLETE (LeadMachine V2)
// Gère : API Google + Analyse Site (Vitesse/Tech/Mobile) + CRM JSON + Sécurité Quota

// 1. CONFIGURATION DU SERVEUR
// -------------------------------------------------------
// On désactive l'affichage des erreurs HTML pour ne pas corrompre le JSON
error_reporting(E_ALL);
ini_set('display_errors', 0); 

// On autorise les requêtes venant de n'importe où (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// 2. VOS PARAMETRES PERSONNELS
// -------------------------------------------------------
$API_KEY = ""; // ⚠️ VOTRE CLÉ GOOGLE ICI
$DB_FILE = 'database_crm.json';        // Fichier où sont stockés les clients
$QUOTA_FILE = 'cache_quota.json';      // Fichier pour compter les requêtes
$MAX_DAILY_REQUESTS = 150;             // Sécurité : Max 150 recherches par jour
// -------------------------------------------------------

// 3. FONCTIONS UTILITAIRES
// -------------------------------------------------------

// Fonction pour renvoyer une erreur propre au JS
function sendError($msg) { 
    echo json_encode(['error' => $msg]); 
    exit; 
}

// Fonction pour lire la base de données
function getDB() { 
    global $DB_FILE; 
    if (!file_exists($DB_FILE)) return [];
    $content = file_get_contents($DB_FILE);
    return $content ? json_decode($content, true) : []; 
}

// Fonction pour sauvegarder dans la base de données
function saveDB($data) { 
    global $DB_FILE; 
    // JSON_PRETTY_PRINT permet de rendre le fichier lisible par un humain si besoin
    file_put_contents($DB_FILE, json_encode($data, JSON_PRETTY_PRINT)); 
}

// Fonction de SÉCURITÉ (Quota)
function checkQuota($file, $limit) {
    // Si le fichier n'existe pas, on le crée
    if (!file_exists($file)) file_put_contents($file, json_encode(['date' => date('Y-m-d'), 'count' => 0]));
    
    $data = json_decode(file_get_contents($file), true);
    
    // Si on a changé de jour, on remet le compteur à zéro
    if ($data['date'] !== date('Y-m-d')) {
        $data = ['date' => date('Y-m-d'), 'count' => 0];
    }
    
    // Si on dépasse la limite, on bloque
    if ($data['count'] >= $limit) return false;
    
    // Sinon on incrémente et on sauvegarde
    $data['count']++;
    file_put_contents($file, json_encode($data));
    return true;
}

// Vérification technique avant de commencer
if (!function_exists('curl_init')) {
    sendError("ERREUR CRITIQUE : L'extension PHP 'cURL' n'est pas activée. Modifiez php.ini.");
}

// 4. TRAITEMENT DES REQUETES
// -------------------------------------------------------
$action = $_GET['action'] ?? '';

try {
    
    // === ACTION : RECHERCHE GOOGLE ===
    if ($action === 'search') {
        // 1. Sécurité
        if (!checkQuota($QUOTA_FILE, $MAX_DAILY_REQUESTS)) {
            sendError("⛔ QUOTA ATTEINT : Vous avez fait trop de recherches aujourd'hui. Revenez demain !");
        }

        // 2. Validation
        if(empty($_GET['loc'])) sendError("Veuillez indiquer une ville.");
        $q = empty($_GET['q']) ? "Entreprise" : $_GET['q']; 
        
        // 3. Appel API Google Places (New)
        $url = "https://places.googleapis.com/v1/places:searchText";
        $postData = json_encode(["textQuery" => $q . " in " . $_GET['loc']]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        
        // Options pour éviter les erreurs SSL en local (Important !)
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); 
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-Goog-Api-Key: " . $API_KEY,
            // On demande uniquement les champs nécessaires pour optimiser le coût
            "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber"
        ]);

        $response = curl_exec($ch);
        
        if ($response === false) {
            sendError('Erreur de connexion Google : ' . curl_error($ch));
        }
        
        curl_close($ch);
        echo $response;
        exit;
    }

    // === ACTION : ANALYSE DE SITE (SCRAPING) ===
    if ($action === 'analyze') {
        $url = $_GET['url'] ?? '';
        if (!filter_var($url, FILTER_VALIDATE_URL)) sendError("URL invalide");

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1); // Suivre les redirections
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);       // Max 10 secondes
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        // On se fait passer pour un vrai navigateur Chrome
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
        
        $html = curl_exec($ch);
        $info = curl_getinfo($ch); // Infos techniques (vitesse, code http)
        curl_close($ch);

        if($html) {
            // Détection des technologies
            $isWp = stripos($html, 'wp-content') !== false;
            $isWix = stripos($html, 'wix.com') !== false;
            $isShopify = stripos($html, 'shopify') !== false;
            $isSquarespace = stripos($html, 'squarespace') !== false;
            
            // Détection Responsive (Viewport)
            $hasMeta = stripos($html, 'viewport') !== false;
            
            // Détection HTTPS
            $isHttps = (strpos($url, 'https://') === 0);

            echo json_encode([
                'status' => $info['http_code'],
                'tech' => $isWp ? 'WordPress' : ($isWix ? 'Wix' : ($isShopify ? 'Shopify' : ($isSquarespace ? 'Squarespace' : 'HTML/Autre'))),
                'mobile' => $hasMeta,
                'https' => $isHttps,
                'speed' => $info['total_time'] // Temps total de chargement
            ]);
        } else {
            echo json_encode(['error' => 'Site inaccessible']);
        }
        exit;
    }

    // === ACTION : CRM - LIRE LES PROSPECTS ===
    if ($action === 'get_leads') {
        echo json_encode(getDB());
        exit;
    }

    // === ACTION : CRM - SAUVEGARDER UN PROSPECT ===
    if ($action === 'save_lead') {
        // On récupère les données envoyées par le JS
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['id'])) sendError('Données invalides');
        
        $db = getDB();
        $found = false;
        
        // On cherche si le prospect existe déjà
        foreach ($db as &$lead) {
            if ($lead['id'] === $input['id']) {
                $lead = $input; // Mise à jour
                $found = true;
                break;
            }
        }
        
        // S'il n'existe pas, on l'ajoute
        if (!$found) $db[] = $input;
        
        saveDB($db);
        echo json_encode(['success' => true]);
        exit;
    }

    // === ACTION : CRM - SUPPRIMER UN PROSPECT ===
    if ($action === 'delete_lead') {
        $id = $_GET['id'] ?? '';
        $db = getDB();
        
        // On recrée un tableau sans le prospect à supprimer
        $newDb = [];
        foreach($db as $lead) {
            if($lead['id'] !== $id) {
                $newDb[] = $lead;
            }
        }
        
        saveDB($newDb);
        echo json_encode(['success' => true]);
        exit;
    }

    // Si aucune action reconnue
    sendError("Action inconnue : " . htmlspecialchars($action));

} catch (Exception $e) {
    sendError("Erreur Serveur: " . $e->getMessage());
}
?>