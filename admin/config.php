<?php
declare(strict_types=1);

// TEST CREDENTIALS — change later
define('ADMIN_USER', 'admin');
define('ADMIN_PASS_HASH', '$2y$10$8X88/6Abmsx80s4PMgYJHeYaNyzcmD2.KVyLg73vTXDnuxAnO3J6a'); // password = 1234
define('SITE_NAME', 'SarmaxStream Admin');
define('DB_PATH', __DIR__ . '/data/admin.sqlite');
define('SESSION_NAME', 'sx_admin_sess');

// Security
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_strict_mode', '1');
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_secure', '1');
}

session_name(SESSION_NAME);
session_start();

// Simple CSRF
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
function csrf_token(): string { return $_SESSION['csrf']; }
function csrf_check(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $t = $_POST['csrf'] ?? '';
        if (!hash_equals($_SESSION['csrf'] ?? '', $t)) {
            http_response_code(403);
            die('CSRF validation failed');
        }
    }
}

// DB
function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO('sqlite:' . DB_PATH, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
    }
    return $pdo;
}

// Init tables on first run
function init_db(): void {
    $pdo = db();
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            year INTEGER,
            type TEXT DEFAULT 'movie',
            poster_url TEXT,
            stream_url TEXT,
            status TEXT DEFAULT 'published',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            role TEXT DEFAULT 'user',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            details TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    ");
    $stmt = $pdo->prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
    $stmt->execute(['site_name', SITE_NAME]);
    $stmt->execute(['maintenance', '0']);
}
init_db();

function require_login(): void {
    if (empty($_SESSION['admin_logged_in'])) {
        header('Location: login.php');
        exit;
    }
}

function log_activity(string $action, string $details = ''): void {
    $stmt = db()->prepare("INSERT INTO activity (action, details) VALUES (?, ?)");
    $stmt->execute([$action, $details]);
}
