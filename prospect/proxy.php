<?php
// proxy.php - VERSION FINALE SÉCURISÉE
// Inclus : API Google + Scraping + Base de Données + SÉCURITÉ BUDGET

// 1. Configuration système
error_reporting(E_ALL);
ini_set('display_errors', 0); // On cache les erreurs HTML pour ne pas casser le JSON
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// --- 2. VOS CONFIGURATIONS ---
$API_KEY = ""; // ⚠️ VOTRE CLÉ ICI
$DB_FILE = 'database_crm.json';        // Fichier de stockage des clients
$QUOTA_FILE = 'cache_quota.json';      // Fichier de comptage pour sécurité
$MAX_DAILY_REQUESTS = 150;             // Limite stricte pour rester gratuit
// -----------------------------

// 3. Fonctions Utilitaires
function sendError($msg) { 
    echo json_encode(['error' => $msg]); 
    exit; 
}

// Gestion Base de données CRM
function getDB() { 
    global $DB_FILE; 
    return file_exists($DB_FILE) ? json_decode(file_get_contents($DB_FILE), true) : []; 
}

function saveDB($data) { 
    global $DB_FILE; 
    file_put_contents($DB_FILE, json_encode($data, JSON_PRETTY_PRINT)); 
}

// Gestion Sécurité Quota (Réintégré !)
function checkQuota($file, $limit) {
    if (!file_exists($file)) file_put_contents($file, json_encode(['date' => date('Y-m-d'), 'count' => 0]));
    $data = json_decode(file_get_contents($file), true);
    
    // Reset quotidien
    if ($data['date'] !== date('Y-m-d')) {
        $data = ['date' => date('Y-m-d'), 'count' => 0];
    }
    
    if ($data['count'] >= $limit) return false; // Bloque si trop de requêtes
    
    $data['count']++;
    file_put_contents($file, json_encode($data));
    return true;
}

// Vérification technique
if (!function_exists('curl_init')) {
    sendError("L'extension PHP 'cURL' n'est pas activée. Vérifiez votre php.ini.");
}

$action = $_GET['action'] ?? '';

try {
    // ==========================================
    // ACTION 1 : RECHERCHE GOOGLE (Avec Sécurité)
    // ==========================================
    if ($action === 'search') {
        // 1. Vérification Quota
        if (!checkQuota($QUOTA_FILE, $MAX_DAILY_REQUESTS)) {
            sendError("🛑 SÉCURITÉ : Quota journalier atteint (150 recherches). Revenez demain !");
        }

        // 2. Préparation requête
        if(empty($_GET['loc'])) sendError("Ville manquante");
        $q = empty($_GET['q']) ? "Entreprise" : $_GET['q']; // Recherche large par défaut
        
        $url = "https://places.googleapis.com/v1/places:searchText";
        $postData = json_encode(["textQuery" => $q . " in " . $_GET['loc']]);

        // 3. Appel Google
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); // Fix local
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0); // Fix local
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-Goog-Api-Key: " . $API_KEY,
            "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber"
        ]);

        $response = curl_exec($ch);
        if ($response === false) sendError('Erreur cURL Google: ' . curl_error($ch));
        curl_close($ch);
        
        echo $response;
        exit;
    }

    // ==========================================
    // ACTION 2 : ANALYSE DE SITE (Scraping)
    // ==========================================
    if ($action === 'analyze') {
        $url = $_GET['url'] ?? '';
        if (!filter_var($url, FILTER_VALIDATE_URL)) sendError("URL invalide");

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Max 10s
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
        
        $html = curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);

        if($html) {
            // Analyse basique
            $isWp = stripos($html, 'wp-content') !== false;
            $isWix = stripos($html, 'wix.com') !== false;
            $hasMeta = stripos($html, 'viewport') !== false;
            
            echo json_encode([
                'status' => $info['http_code'],
                'tech' => $isWp ? 'WordPress' : ($isWix ? 'Wix' : 'HTML/Autre'),
                'mobile' => $hasMeta
            ]);
        } else {
            echo json_encode(['error' => 'Site inaccessible']);
        }
        exit;
    }

    // ==========================================
    // ACTION 3 : CRM (Base de données)
    // ==========================================
    
    // Lire
    if ($action === 'get_leads') {
        echo json_encode(getDB());
        exit;
    }

    // Sauvegarder (Ajout ou Modif)
    if ($action === 'save_lead') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) sendError('Données invalides');
        
        $db = getDB();
        $found = false;
        
        foreach ($db as &$lead) {
            if ($lead['id'] === $input['id']) {
                $lead = $input; // Mise à jour
                $found = true;
                break;
            }
        }
        if (!$found) $db[] = $input; // Nouvel ajout
        
        saveDB($db);
        echo json_encode(['success' => true]);
        exit;
    }

    // Supprimer
    if ($action === 'delete_lead') {
        $id = $_GET['id'] ?? '';
        $db = getDB();
        // Syntaxe compatible vieux PHP pour OVH
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

    sendError("Action inconnue");

} catch (Exception $e) {
    sendError("Erreur Serveur: " . $e->getMessage());
}
?>