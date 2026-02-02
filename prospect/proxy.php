<?php
// proxy.php - VERSION SNIPER V3.3
error_reporting(E_ALL);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$API_KEY = ""; // ⚠️ METS TA CLÉ ICI
$DB_FILE = 'database_crm.json';
$QUOTA_FILE = 'cache_quota.json';

function sendError($msg) { echo json_encode(['error' => $msg]); exit; }
function getDB() { global $DB_FILE; if (!file_exists($DB_FILE)) return []; $c = file_get_contents($DB_FILE); return $c ? json_decode($c, true) : []; }
function saveDB($data) { global $DB_FILE; file_put_contents($DB_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); }

$action = $_GET['action'] ?? '';

try {
    if ($action === 'search') {
        // ... (Code quota inchangé, voir version précédente si besoin, je raccourcis pour la lisibilité)
        $loc = $_GET['loc'] ?? ''; $q = $_GET['q'] ?? "Entreprise";
        $url = "https://places.googleapis.com/v1/places:searchText";
        $postData = json_encode(["textQuery" => $q . " in " . $loc]);
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json", "X-Goog-Api-Key: " . $API_KEY, "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber"]);
        echo curl_exec($ch); curl_close($ch); exit;
    }

    if ($action === 'analyze') {
        $url = $_GET['url'] ?? '';
        if (!filter_var($url, FILTER_VALIDATE_URL)) sendError("URL invalide");

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8); // Timeout réduit pour aller vite
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        
        $html = curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);

        $mail = null; $phone = null; $year = null;
        if($html) {
            // Regex Email
            if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $html, $m)) {
                if (!preg_match('/\.(png|jpg|css|js)$/i', $m[0])) $mail = $m[0];
            }
            // Regex Phone
            if (preg_match('/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/', $html, $m)) $phone = $m[0];
            
            // Regex Année Copyright (Cherche "2015", "2020", etc dans le bas de page)
            if (preg_match('/(?:©|copyright).*?(20[1-2][0-9])/', strtolower($html), $m)) {
                $year = intval($m[1]);
            }
            // Fallback: cherche juste une année récente isolée
            else if (preg_match('/20[1-2][0-9]/', substr($html, -2000), $m)) { 
                $year = intval($m[0]);
            }

            echo json_encode([
                'status' => $info['http_code'],
                'mobile' => stripos($html, 'viewport') !== false,
                'https' => (strpos($url, 'https://') === 0),
                'speed' => $info['total_time'],
                'scraped_email' => $mail,
                'scraped_phone' => $phone,
                'copyright_year' => $year,
                'tech' => (stripos($html, 'wp-content') !== false) ? 'WordPress' : 'Autre'
            ]);
        } else { echo json_encode(['error' => 'Site inaccessible']); }
        exit;
    }

    // ... (Reste du code mail/save/delete inchangé)
    if ($action === 'send_email') {
        $in = json_decode(file_get_contents('php://input'), true);
        if(mail($in['to'], $in['subject'], $in['body'], "From: Contact <contact@leadmachine.fr>\r\nContent-Type: text/plain; charset=UTF-8")) echo json_encode(['success'=>true]);
        else echo json_encode(['error'=>'SMTP Error']);
        exit;
    }
    if ($action === 'get_leads') { echo json_encode(getDB()); exit; }
    if ($action === 'save_lead') {
        $in=json_decode(file_get_contents('php://input'),true); $db=getDB(); $found=false;
        foreach($db as &$l) if($l['id']===$in['id']) { $l=$in; $found=true; break; }
        if(!$found) $db[]=$in; saveDB($db); echo json_encode(['success'=>true]); exit;
    }
    if ($action === 'delete_lead') {
        $id=$_GET['id']; $db=getDB(); $n=[]; foreach($db as $l) if($l['id']!==$id) $n[]=$l;
        saveDB($n); echo json_encode(['success'=>true]); exit;
    }
} catch (Exception $e) { sendError($e->getMessage()); }
?>