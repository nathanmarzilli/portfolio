<?php
// proxy.php - VERSION LEADMACHINE V3.2
// Correction : Headers UTF-8 stricts et gestion d'erreurs JSON propre.

error_reporting(E_ALL);
ini_set('display_errors', 0); // On cache les erreurs brutes PHP
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8"); // Encodage forcé

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// --- CONFIGURATION ---
$API_KEY = "AIzaSyDFuzcbwdR0cvk7uYwdeGE9tsSoNHUXPjI"; // ⚠️ VOTRE CLÉ GOOGLE API ICI
$DB_FILE = 'database_crm.json';
$QUOTA_FILE = 'cache_quota.json';
$MAX_DAILY_REQUESTS = 150;

function sendError($msg) { echo json_encode(['error' => $msg]); exit; }
function getDB() { global $DB_FILE; if (!file_exists($DB_FILE)) return []; $c = file_get_contents($DB_FILE); return $c ? json_decode($c, true) : []; }
function saveDB($data) { global $DB_FILE; file_put_contents($DB_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); } // JSON_UNESCAPED_UNICODE protège les accents

function checkQuota($file, $limit) {
    if (!file_exists($file)) file_put_contents($file, json_encode(['date' => date('Y-m-d'), 'count' => 0]));
    $data = json_decode(file_get_contents($file), true);
    if ($data['date'] !== date('Y-m-d')) $data = ['date' => date('Y-m-d'), 'count' => 0];
    if ($data['count'] >= $limit) return false;
    $data['count']++;
    file_put_contents($file, json_encode($data));
    return true;
}

$action = $_GET['action'] ?? '';

try {
    // --- RECHERCHE GOOGLE ---
    if ($action === 'search') {
        if (!checkQuota($QUOTA_FILE, $MAX_DAILY_REQUESTS)) sendError("⛔ QUOTA ATTEINT : Trop de recherches aujourd'hui.");
        $loc = $_GET['loc'] ?? ''; $q = $_GET['q'] ?? "Entreprise";
        if(empty($loc)) sendError("Veuillez indiquer une ville.");

        $url = "https://places.googleapis.com/v1/places:searchText";
        $postData = json_encode(["textQuery" => $q . " in " . $loc]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); 
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Content-Type: application/json", "X-Goog-Api-Key: " . $API_KEY,
            "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.location"
        ]);
        
        $res = curl_exec($ch);
        if ($res === false) sendError('Erreur Curl: ' . curl_error($ch));
        curl_close($ch);
        echo $res; exit;
    }

    // --- ANALYSE URL ---
    if ($action === 'analyze') {
        $url = $_GET['url'] ?? '';
        if (!filter_var($url, FILTER_VALIDATE_URL)) sendError("URL invalide");

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        
        $html = curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);

        $mail = null; $phone = null;
        if($html) {
            // Regex Email (améliorée)
            if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $html, $m)) {
                if (!preg_match('/\.(png|jpg|css|js)$/i', $m[0])) $mail = $m[0];
            }
            // Regex Tel FR
            if (preg_match('/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/', $html, $m)) $phone = $m[0];

            echo json_encode([
                'status' => $info['http_code'],
                'mobile' => stripos($html, 'viewport') !== false,
                'https' => (strpos($url, 'https://') === 0),
                'speed' => $info['total_time'],
                'scraped_email' => $mail,
                'scraped_phone' => $phone,
                'tech' => (stripos($html, 'wp-content') !== false) ? 'WordPress' : 'Autre'
            ]);
        } else { echo json_encode(['error' => 'Site inaccessible']); }
        exit;
    }

    // --- ENVOI MAIL ---
    if ($action === 'send_email') {
        $in = json_decode(file_get_contents('php://input'), true);
        if (!$in || empty($in['to'])) sendError('Données manquantes');
        
        $headers = "From: Nathan <contact@nathan-marzilli.fr>\r\nReply-To: contact@nathan-marzilli.fr\r\nX-Mailer: PHP/" . phpversion();
        
        if (mail($in['to'], $in['subject'], $in['body'], $headers)) echo json_encode(['success' => true]);
        else echo json_encode(['error' => 'Erreur SMTP']);
        exit;
    }

    // --- CRM CRUD ---
    if ($action === 'get_leads') { echo json_encode(getDB()); exit; }
    
    if ($action === 'save_lead') {
        $in = json_decode(file_get_contents('php://input'), true);
        if (!$in || !isset($in['id'])) sendError('ID manquant');
        $db = getDB(); $found = false;
        foreach ($db as &$l) { if ($l['id'] === $in['id']) { $l = $in; $found = true; break; } }
        if (!$found) $db[] = $in;
        saveDB($db); echo json_encode(['success' => true]); exit;
    }

    if ($action === 'delete_lead') {
        $id = $_GET['id'] ?? ''; $db = getDB(); $new = [];
        foreach($db as $l) if($l['id'] !== $id) $new[] = $l;
        saveDB($new); echo json_encode(['success' => true]); exit;
    }

    sendError("Action inconnue");

} catch (Exception $e) { sendError("Erreur Serveur: " . $e->getMessage()); }
?>