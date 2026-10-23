<?php
require_once __DIR__ . '/config.php';
require_login();
$page = 'dash';
$pageTitle = 'Dashboard';

$movies = (int) db()->query("SELECT COUNT(*) FROM movies")->fetchColumn();
$published = (int) db()->query("SELECT COUNT(*) FROM movies WHERE status='published'")->fetchColumn();
$users = (int) db()->query("SELECT COUNT(*) FROM users")->fetchColumn();
$recent = db()->query("SELECT * FROM activity ORDER BY id DESC LIMIT 8")->fetchAll();

require __DIR__ . '/includes/header.php';
?>
<div class="grid">
  <div class="card stat"><div class="num"><?= $movies ?></div><div class="label">Total titles</div></div>
  <div class="card stat"><div class="num"><?= $published ?></div><div class="label">Published</div></div>
  <div class="card stat"><div class="num"><?= $users ?></div><div class="label">Users</div></div>
</div>

<div class="card">
  <h2 style="margin-bottom:16px;font-size:1.1rem">Recent activity</h2>
  <?php if (!$recent): ?>
    <p style="color:var(--muted)">No activity yet.</p>
  <?php else: ?>
    <table>
      <thead><tr><th>Action</th><th>Details</th><th>When</th></tr></thead>
      <tbody>
      <?php foreach ($recent as $r): ?>
        <tr>
          <td><?= htmlspecialchars($r['action']) ?></td>
          <td><?= htmlspecialchars($r['details']) ?></td>
          <td style="color:var(--muted);font-size:0.9rem"><?= htmlspecialchars($r['created_at']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
