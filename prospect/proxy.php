<?php
// proxy.php - VERSION SNIPER V4.0
// Fonctionnalités :
// - Proxy Google Maps API
// - Scraping intelligent (Email, Tel, Copyright, Tech)
// - Détection Social Media (Facebook, Instagram)
// - Génération d'emails probables (Permutations sur domaine)
// - Gestion Database JSON (CRUD Leads)
// - Envoi Email (PHP Mailer simple)

error_reporting(E_ALL);
ini_set('display_errors', 0);
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$API_KEY = ""; // ⚠️ TA CLÉ ICI
$DB_FILE = 'database_crm.json';

function sendError($msg) { echo json_encode(['error' => $msg]); exit; }
function getDB() { global $DB_FILE; if (!file_exists($DB_FILE)) return []; $c = file_get_contents($DB_FILE); return $c ? json_decode($c, true) : []; }
function saveDB($data) { global $DB_FILE; file_put_contents($DB_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)); }

// Helper pour extraire le domaine
function get_domain($url) {
    $pieces = parse_url($url);
    $domain = isset($pieces['host']) ? $pieces['host'] : $pieces['path'];
    if (preg_match('/(?P<domain>[a-z0-9][a-z0-9\-]{1,63}\.[a-z\.]{2,6})$/i', $domain, $regs)) {
        return $regs['domain'];
    }
    return false;
}

$action = $_GET['action'] ?? '';

try {
    if ($action === 'search') {
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
        curl_setopt($ch, CURLOPT_TIMEOUT, 10); // Un peu plus de temps pour parser
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0); curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
        curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LeadMachine/4.0");
        
        $html = curl_exec($ch);
        $info = curl_getinfo($ch);
        curl_close($ch);

        $mail = null; $phone = null; $year = null;
        $socials = ['facebook' => false, 'instagram' => false];
        $probableEmails = [];

        if($html) {
            // Regex Email Strict
            if (preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $html, $m)) {
                if (!preg_match('/\.(png|jpg|css|js|webp)$/i', $m[0])) $mail = $m[0];
            }
            // Regex Phone
            if (preg_match('/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/', $html, $m)) $phone = $m[0];
            
            // Regex Année Copyright
            if (preg_match('/(?:©|copyright).*?(20[1-2][0-9])/', strtolower($html), $m)) {
                $year = intval($m[1]);
            } else if (preg_match('/20[1-2][0-9]/', substr($html, -2000), $m)) { 
                $year = intval($m[0]);
            }

            // Détection Social Media
            if (stripos($html, 'facebook.com') !== false) $socials['facebook'] = true;
            if (stripos($html, 'instagram.com') !== false) $socials['instagram'] = true;

            // Génération d'Emails Probables (Permutations)
            $domain = get_domain($url);
            if ($domain && !$mail) {
                // On ne génère que si on n'a pas trouvé l'email exact pour éviter le bruit
                $probableEmails[] = "contact@" . $domain;
                $probableEmails[] = "info@" . $domain;
                $probableEmails[] = "bonjour@" . $domain;
                // Si on a un nom d'entreprise dans l'URL ? (compliqué, on reste sur du standard)
            } else if ($domain && $mail) {
                // Si on a trouvé un mail bizarre, on propose quand même contact@
                if (strpos($mail, 'contact@') === false) $probableEmails[] = "contact@" . $domain;
            }

            echo json_encode([
                'status' => $info['http_code'],
                'mobile' => stripos($html, 'viewport') !== false,
                'https' => (strpos($url, 'https://') === 0),
                'speed' => $info['total_time'],
                'scraped_email' => $mail,
                'scraped_phone' => $phone,
                'copyright_year' => $year,
                'tech' => (stripos($html, 'wp-content') !== false) ? 'WordPress' : 'Autre',
                'socials' => $socials,
                'probable_emails' => $probableEmails
            ]);
        } else { echo json_encode(['error' => 'Site inaccessible']); }
        exit;
    }

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