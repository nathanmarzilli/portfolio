<?php
// proxy.php - Permet de récupérer le HTML d'un site distant pour analyse JS
// Sécurité basique pour éviter que n'importe qui l'utilise
header("Access-Control-Allow-Origin: *"); 
header("Content-Type: application/json");

if (!isset($_GET['url'])) {
    echo json_encode(['error' => 'URL manquante']);
    exit;
}

$url = $_GET['url'];

// Validation URL simple
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    echo json_encode(['error' => 'URL invalide']);
    exit;
}

// Initialisation cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_USERAGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

$html = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

if ($html) {
    // Analyse sommaire côté serveur pour gagner du temps
    $isWordpress = strpos($html, 'wp-content') !== false;
    $hasViewport = strpos($html, 'viewport') !== false;
    
    echo json_encode([
        'status' => $info['http_code'],
        'isWordpress' => $isWordpress,
        'hasViewport' => $hasViewport, // Indice de responsive
        'loadTime' => $info['total_time']
    ]);
} else {
    echo json_encode(['error' => 'Impossible de charger le site']);
}
?>