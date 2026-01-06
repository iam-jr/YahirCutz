<?php
// Public/api/booked-times.php: Retorna las horas ocupadas para un día específico
header('Content-Type: application/json');

$dataFile = __DIR__ . '/data/bookings.json';
$date = $_GET['date'] ?? null;

if (!$date) {
    echo json_encode(['times' => []]);
    exit;
}

if (!file_exists($dataFile)) {
    echo json_encode(['times' => []]);
    exit;
}

$bookingsRaw = file_get_contents($dataFile);
$bookings = json_decode($bookingsRaw, true) ?? [];

$times = [];
if (isset($bookings[$date])) {
    foreach ($bookings[$date] as $booking) {
        if ($booking['status'] === 'confirmed') {
            $times[] = $booking['time'];
        }
    }
}

echo json_encode(['times' => $times]);
