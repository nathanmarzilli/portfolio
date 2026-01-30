<?php
// proxy.php - Version Finale Complète
// Gère : API Google + Analyse de site + Base de données JSON (CRM)

// Configuration des erreurs (Masquer le HTML, afficher le JSON)
error_reporting(E_ALL);
ini_set('display_errors', 0); 

// Headers pour autoriser l'accès depuis le JS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// --- VOS CONFIGURATIONS ---
$API_KEY = "VOTRE_CLE_API_GOOGLE_ICI"; // ⚠️ Collez votre clé AIza... ici
$DB_FILE = 'database_crm.json';        // Fichier de stockage des clients
$MAX_DAILY_REQUESTS = 150;             // Sécurité budget
// --------------------------

// Fonctions utilitaires
function sendError($msg) { 
    echo json_encode(['error' => $msg]); 
    exit; 
}

function getDB() { 
    global $DB_FILE; 
    return file_exists($DB_FILE) ? json_decode(file_get_contents($DB_FILE), true) : []; 
}

function saveDB($data) { 
    global $DB_FILE; 
    file_put_contents($DB_FILE, json_encode($data, JSON_PRETTY_PRINT)); 
}

// Vérification pré-requis
if (!function_exists('curl_init')) {
    sendError("L'extension PHP 'cURL' n'est pas activée. Vérifiez votre php.ini.");
}

// Récupération de l'action demandée
$action = $_GET['action'] ?? '';

try {
    // ==========================================
    // 1. RECHERCHE GOOGLE (SEARCH)
    // ==========================================
    if ($action === 'search') {
        // (Ici on pourrait ajouter la vérification de quota journalier)
        
        if(empty($_GET['q']) || empty($_GET['loc'])) sendError("Paramètres manquants");

        $url = "https://places.googleapis.com/v1/places:searchText";
        $postData = json_encode(["textQuery" => $_GET['q'] . " in " . $_GET['loc']]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        // SSL options pour local (à retirer en prod si nécessaire, mais sans danger ici)
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); 
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-Goog-Api-Key: " . $API_KEY,
            // Optimisation des coûts : on ne demande que l'essentiel
            "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber"
        ]);

        $response = curl_exec($ch);
        if ($response === false) sendError('Erreur cURL Google: ' + curl_error($ch));
        curl_close($ch);
        
        echo $response;
        exit;
    }

    // ==========================================
    // 2. ANALYSE DE SITE (SCRAPING)
    // ==========================================
    if ($action === 'analyze') {
        $url = $_GET['url'] ?? '';
        if (!filter_var($url, FILTER_VALIDATE_URL)) sendError("URL invalide");

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Max 10s d'attente
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
        
        $html = curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);

        if($html) {
            // Logique de détection simple
            $isWp = stripos($html, 'wp-content') !== false;
            $isWix = stripos($html, 'wix.com') !== false;
            $hasMeta = stripos($html, 'viewport') !== false; // Indice de responsive
            
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
    // 3. CRM : GESTION DONNÉES (JSON)
    // ==========================================
    
    // Lire la base
    if ($action === 'get_leads') {
        echo json_encode(getDB());
        exit;
    }

    // Sauvegarder (Ajout ou Modif)
    if ($action === 'save_lead') {
        // Récupérer le JSON envoyé par le JS
        $inputJSON = file_get_contents('php://input');
        $input = json_decode($inputJSON, true);
        
        if (!$input || !isset($input['id'])) sendError('Données invalides');
        
        $db = getDB();
        $found = false;
        
        // Mise à jour si existe, sinon ajout
        foreach ($db as &$lead) {
            if ($lead['id'] === $input['id']) {
                $lead = $input;
                $found = true;
                break;
            }
        }
        if (!$found) $db[] = $input; // Ajout en fin de tableau
        
        saveDB($db);
        echo json_encode(['success' => true]);
        exit;
    }

    // Supprimer
    if ($action === 'delete_lead') {
        $id = $_GET['id'] ?? '';
        $db = getDB();
        // On filtre pour garder tout sauf celui qu'on veut supprimer
        $newDb = array_values(array_filter($db, function($lead) use ($id) {
            return $lead['id'] !== $id;
        }));
        saveDB($newDb);
        echo json_encode(['success' => true]);
        exit;
    }

    sendError("Action inconnue : " . htmlspecialchars($action));

} catch (Exception $e) {
    sendError("Erreur Serveur: " . $e->getMessage());
}
?>