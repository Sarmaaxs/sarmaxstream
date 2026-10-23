<?php
require_once __DIR__ . '/config.php';
require_login();
$page = 'activity';
$pageTitle = 'Activity log';

$list = db()->query("SELECT * FROM activity ORDER BY id DESC LIMIT 100")->fetchAll();

require __DIR__ . '/includes/header.php';
?>
<div class="card">
  <?php if (!$list): ?>
    <p style="color:var(--muted)">No activity yet.</p>
  <?php else: ?>
    <table>
      <thead><tr><th>Action</th><th>Details</th><th>When</th></tr></thead>
      <tbody>
      <?php foreach ($list as $r): ?>
        <tr>
          <td><?= htmlspecialchars($r['action']) ?></td>
          <td><?= htmlspecialchars($r['details']) ?></td>
          <td style="color:var(--muted)"><?= htmlspecialchars($r['created_at']) ?></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
