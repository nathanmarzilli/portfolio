<?php
// proxy.php - Tour de contrôle pour Google Places + Analyse de site
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// --- CONFIGURATION ---
$API_KEY = ""; // ⚠️ COLLES TA CLÉ ICI
$MAX_DAILY_REQUESTS = 150; // Sécurité supplémentaire côté serveur
// ---------------------

$action = $_GET['action'] ?? '';
$cacheFile = 'cache_quota.json';

// Petit système de quota maison (stocké dans un fichier texte sur ton serveur)
function checkQuota($file, $limit) {
    if (!file_exists($file)) file_put_contents($file, json_encode(['date' => date('Y-m-d'), 'count' => 0]));
    $data = json_decode(file_get_contents($file), true);
    
    if ($data['date'] !== date('Y-m-d')) {
        $data = ['date' => date('Y-m-d'), 'count' => 0]; // Reset quotidien
    }
    
    if ($data['count'] >= $limit) return false;
    
    $data['count']++;
    file_put_contents($file, json_encode($data));
    return true;
}

// 1. ACTION : RECHERCHE GOOGLE (SEARCH)
if ($action === 'search') {
    if (!checkQuota($cacheFile, $MAX_DAILY_REQUESTS)) {
        echo json_encode(['error' => 'Quota journalier de sécurité atteint (défini dans proxy.php)']);
        exit;
    }

    $query = urlencode($_GET['q'] . ' ' . $_GET['loc']);
    
    // On utilise l'API "Text Search (New)" qui permet de filtrer les champs pour payer moins cher
    // FieldMask permet de ne demander QUE le nom, adresse, site web et coordonnées
    $url = "https://places.googleapis.com/v1/places:searchText";
    
    $data = json_encode([
        "textQuery" => $_GET['q'] . " in " . $_GET['loc']
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Content-Type: application/json",
        "X-Goog-Api-Key: " . $API_KEY,
        // C'est ICI qu'on économise : on demande juste ce qu'il faut
        "X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.websiteUri,places.internationalPhoneNumber,places.businessStatus"
    ]);

    $response = curl_exec($ch);
    curl_close($ch);
    echo $response;
    exit;
}

// 2. ACTION : ANALYSE DU SITE (SCRAPING LÉGER)
if ($action === 'analyze') {
    $url = $_GET['url'];
    
    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        echo json_encode(['error' => 'URL invalide']); exit;
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8); // Max 8 secondes pour répondre
    curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Compatible; LeadMachine/1.0)");
    
    $html = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    if ($html) {
        // Détection basique de vétusté
        $isWordpress = stripos($html, 'wp-content') !== false;
        $isWix = stripos($html, 'wix.com') !== false;
        $hasViewport = stripos($html, '<meta name="viewport"') !== false;
        $isHttps = (strpos($url, 'https://') === 0);
        
        // Calcul d'un score de vétusté simulé
        $issues = [];
        if (!$hasViewport) $issues[] = "Non Responsive (Mobile)";
        if (!$isHttps) $issues[] = "Non Sécurisé (HTTP)";
        if ($info['total_time'] > 2) $issues[] = "Chargement lent (>2s)";
        
        echo json_encode([
            'status' => $info['http_code'],
            'tech' => $isWordpress ? 'WordPress' : ($isWix ? 'Wix' : 'HTML/Autre'),
            'responsive' => $hasViewport,
            'issues' => $issues
        ]);
    } else {
        echo json_encode(['error' => 'Site inaccessible']);
    }
    exit;
}

echo json_encode(['error' => 'Action inconnue']);
?>