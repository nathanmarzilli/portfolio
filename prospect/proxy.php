<?php
// proxy.php - VERSION LEADMACHINE V3 (FULL)
// Gère : API Google + Analyse Site (Vitesse/Tech/Mobile/Email/Tel) + CRM JSON + Sécurité Quota + Envoi Mail

// 1. CONFIGURATION DU SERVEUR
// -------------------------------------------------------
error_reporting(E_ALL);
ini_set('display_errors', 0); // On cache les erreurs PHP pour ne pas casser le JSON
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");

// Gestion des requêtes "OPTIONS" (Pre-flight CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. VOS PARAMETRES PERSONNELS
// -------------------------------------------------------
$API_KEY = ""; // ⚠️ TA CLÉ GOOGLE ICI
$DB_FILE = 'database_crm.json';        // Stockage des clients
$QUOTA_FILE = 'cache_quota.json';      // Compteur de requêtes
$MAX_DAILY_REQUESTS = 150;             // Max 150 recherches Google par jour
// -------------------------------------------------------

// 3. FONCTIONS UTILITAIRES
// -------------------------------------------------------

function sendError($msg) { 
    echo json_encode(['error' => $msg]); 
    exit; 
}

// Lecture de la base de données
function getDB() { 
    global $DB_FILE; 
    if (!file_exists($DB_FILE)) return [];
    $content = file_get_contents($DB_FILE);
    return $content ? json_decode($content, true) : []; 
}

// Sauvegarde dans la base de données
function saveDB($data) { 
    global $DB_FILE; 
    // JSON_PRETTY_PRINT pour pouvoir lire le fichier à l'œil nu si besoin
    file_put_contents($DB_FILE, json_encode($data, JSON_PRETTY_PRINT)); 
}

// Gestion des Quotas Journaliers
function checkQuota($file, $limit) {
    if (!file_exists($file)) file_put_contents($file, json_encode(['date' => date('Y-m-d'), 'count' => 0]));
    
    $data = json_decode(file_get_contents($file), true);
    
    // Reset si nouveau jour
    if ($data['date'] !== date('Y-m-d')) {
        $data = ['date' => date('Y-m-d'), 'count' => 0];
    }
    
    // Blocage si limite atteinte
    if ($data['count'] >= $limit) return false;
    
    // Incrémentation
    $data['count']++;
    file_put_contents($file, json_encode($data));
    return true;
}

// 4. TRAITEMENT DES REQUETES
// -------------------------------------------------------
$action = $_GET['action'] ?? '';

try {
    
    // === ACTION : RECHERCHE GOOGLE PLACES ===
    if ($action === 'search') {
        // 1. Vérification Quota
        if (!checkQuota($QUOTA_FILE, $MAX_DAILY_REQUESTS)) {
            sendError("⛔ QUOTA ATTEINT : Trop de recherches aujourd'hui. Reviens demain !");
        }

        // 2. Paramètres
        $loc = $_GET['loc'] ?? '';
        $q = $_GET['q'] ?? "Entreprise";
        
        if(empty($loc)) sendError("Veuillez indiquer une ville.");

        // Google Places Text Search (New API)
        $url = "https://places.googleapis.com/v1/places:searchText";
        // On construit la requête texte "Plombier in Paris"
        $postData = json_encode(["textQuery" => $q . " in " . $loc]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        
        // SSL Options (pour éviter erreurs en local)
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); 
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json",
            "X-Goog-Api-Key: " . $API_KEY,
            // On demande uniquement les champs nécessaires (Optimisation Coûts)
            "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.location"
        ]);

        $response = curl_exec($ch);
        
        if ($response === false) {
            sendError('Erreur de connexion Google : ' . curl_error($ch));
        }
        
        curl_close($ch);
        echo $response;
        exit;
    }

    // === ACTION : ANALYSE DE SITE (SCRAPING AVANCÉ V3) ===
    if ($action === 'analyze') {
        $url = $_GET['url'] ?? '';
        if (!filter_var($url, FILTER_VALIDATE_URL)) sendError("URL invalide");

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1); // Suivre les redirections
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);       // Max 10 secondes d'analyse
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        // User Agent pour passer pour un vrai navigateur Chrome
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
        
        $html = curl_exec($ch);
        $info = curl_getinfo($ch); // Infos techniques (vitesse, code http)
        curl_close($ch);

        $extractedEmail = null;
        $extractedPhone = null;

        if($html) {
            // Détection CMS
            $isWp = stripos($html, 'wp-content') !== false;
            $isWix = stripos($html, 'wix.com') !== false;
            $isShopify = stripos($html, 'shopify') !== false;
            $isSquarespace = stripos($html, 'squarespace') !== false;
            
            // Détection Mobile (Viewport)
            $hasMeta = stripos($html, 'viewport') !== false;
            
            // Détection HTTPS
            $isHttps = (strpos($url, 'https://') === 0);

            // --- SCRAPING EMAIL (NOUVEAU V3) ---
            // 1. Chercher dans les liens mailto:
            if (preg_match('/mailto:([\w\.\-]+@[\w\.\-]+\.[a-zA-Z]{2,})/', $html, $matches)) {
                $extractedEmail = $matches[1];
            } 
            // 2. Sinon chercher pattern email dans le texte visible
            else if (preg_match('/[\w\.\-]+@[\w\.\-]+\.[a-zA-Z]{2,}/', $html, $matches)) {
                // On exclut les extensions d'image pour éviter les faux positifs (ex: image.png)
                if (!preg_match('/\.(png|jpg|jpeg|gif|css|js|svg)$/i', $matches[0])) {
                    $extractedEmail = $matches[0];
                }
            }

            // --- SCRAPING PHONE (NOUVEAU V3) ---
            // Pattern pour 06/07 ou format international +33
            if (preg_match('/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/', $html, $matches)) {
                $extractedPhone = $matches[0];
            }

            echo json_encode([
                'status' => $info['http_code'],
                'tech' => $isWp ? 'WordPress' : ($isWix ? 'Wix' : ($isShopify ? 'Shopify' : ($isSquarespace ? 'Squarespace' : 'HTML/Autre'))),
                'mobile' => $hasMeta,
                'https' => $isHttps,
                'speed' => $info['total_time'],
                'scraped_email' => $extractedEmail,
                'scraped_phone' => $extractedPhone
            ]);
        } else {
            echo json_encode(['error' => 'Site inaccessible']);
        }
        exit;
    }

    // === ACTION : ENVOI EMAIL DIRECT (NOUVEAU V3) ===
    if ($action === 'send_email') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || empty($input['to']) || empty($input['subject']) || empty($input['body'])) {
            sendError('Données manquantes pour l\'envoi');
        }

        $to = $input['to'];
        $subject = $input['subject'];
        $message = $input['body'];
        
        // Headers pour éviter le SPAM (A configurer selon ton hébergeur)
        $headers = "From: Nathan <contact@nathan-marzilli.fr>\r\n"; // ⚠️ METS TON VRAI MAIL ICI
        $headers .= "Reply-To: contact@nathan-marzilli.fr\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion();
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        if (mail($to, $subject, $message, $headers)) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Échec de l\'envoi. Vérifiez la config SMTP du serveur.']);
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
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['id'])) sendError('Données invalides');
        
        $db = getDB();
        $found = false;
        
        // Mise à jour si existe
        foreach ($db as &$lead) {
            if ($lead['id'] === $input['id']) {
                $lead = $input; 
                $found = true;
                break;
            }
        }
        
        // Ajout si nouveau
        if (!$found) $db[] = $input;
        
        saveDB($db);
        echo json_encode(['success' => true]);
        exit;
    }

    // === ACTION : CRM - SUPPRIMER UN PROSPECT ===
    if ($action === 'delete_lead') {
        $id = $_GET['id'] ?? '';
        $db = getDB();
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

    sendError("Action inconnue : " . htmlspecialchars($action));

} catch (Exception $e) {
    sendError("Erreur Serveur: " . $e->getMessage());
}
?>