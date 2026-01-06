<?php
// Public/api/booking.php: Procesa reservas desde fetch (JSON) y responde JSON
header('Content-Type: application/json');
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);

set_exception_handler(function($e) {
    http_response_code(500);
    $msg = 'EXCEPTION: ' . $e->getMessage();
    error_log($msg);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit;
});

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    $msg = "ERROR [$errno] $errstr";
    error_log($msg);
    echo json_encode(['success' => false, 'message' => $msg]);
    exit;
});

$dataFile = __DIR__ . '/data/bookings.json';

function clean($data) {
    return htmlspecialchars(stripslashes(trim($data)));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        echo json_encode(['success' => false, 'message' => 'Datos inválidos']);
        exit;
    }

    $name = clean($input['clientName'] ?? '');
    $email = clean($input['clientEmail'] ?? '');
    $phone = clean($input['clientPhone'] ?? '');
    $instagram = clean($input['clientInstagram'] ?? '');
    $service = clean($input['service'] ?? '');
    $date = clean($input['date'] ?? '');
    $time = clean($input['time'] ?? '');

    if (!$name || !$date || !$time || !$service || !$email) {
        echo json_encode(['success' => false, 'message' => 'Faltan datos requeridos']);
        exit;
    }

    // Crear archivo de datos si no existe
    if (!file_exists($dataFile)) {
        if (!is_dir(dirname($dataFile))) {
            mkdir(dirname($dataFile), 0755, true);
        }
        file_put_contents($dataFile, json_encode([]));
    }

    // Leer reservas existentes
    $bookingsRaw = file_get_contents($dataFile);
    $bookings = json_decode($bookingsRaw, true) ?? [];

    // Formato de la clave de fecha
    $dateKey = $date; // YYYY-MM-DD

    // Inicializar el array de reservas para este día si no existe
    if (!isset($bookings[$dateKey])) {
        $bookings[$dateKey] = [];
    }

    // Verificar si la hora ya está ocupada
    foreach ($bookings[$dateKey] as $booking) {
        if ($booking['time'] === $time) {
            echo json_encode(['success' => false, 'message' => 'Esta hora ya está reservada']);
            exit;
        }
    }

    // Crear la nueva reserva
    $newBooking = [
        'id' => uniqid('yc_'),
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'instagram' => $instagram,
        'service' => $service,
        'date' => $date,
        'time' => $time,
        'status' => 'confirmed',
        'createdAt' => date('Y-m-d H:i:s')
    ];

    // Agregar la reserva
    $bookings[$dateKey][] = $newBooking;

    // Guardar las reservas
    if (!file_put_contents($dataFile, json_encode($bookings, JSON_PRETTY_PRINT))) {
        echo json_encode(['success' => false, 'message' => 'Error al guardar la reserva']);
        exit;
    }

    // Enviar email de confirmación (opcional - requiere configuración SMTP)
    // sendConfirmationEmail($email, $name, $service, $date, $time);

    echo json_encode(['success' => true, 'message' => 'Reserva confirmada exitosamente', 'booking' => $newBooking]);
    exit;
}

// GET: Obtener reservas de un día específico
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $date = $_GET['date'] ?? null;
    
    if (!$date) {
        echo json_encode(['success' => false, 'message' => 'Falta el parámetro de fecha']);
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
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Método no permitido']);
exit;
