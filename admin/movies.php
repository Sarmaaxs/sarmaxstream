<?php
require_once __DIR__ . '/config.php';
require_login();
$page = 'movies';
$pageTitle = 'Movies / Series';

// Delete
if (isset($_GET['delete'])) {
    csrf_check(); // will only work on POST, so we use POST form
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
    csrf_check();
    $id = (int) $_POST['delete_id'];
    db()->prepare("DELETE FROM movies WHERE id=?")->execute([$id]);
    log_activity('delete_movie', "ID $id");
    header('Location: movies.php?msg=deleted');
    exit;
}

// Save (add/edit)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['save'])) {
    csrf_check();
    $id = (int) ($_POST['id'] ?? 0);
    $title = trim($_POST['title'] ?? '');
    $year = (int) ($_POST['year'] ?? 0) ?: null;
    $type = $_POST['type'] === 'series' ? 'series' : 'movie';
    $poster = trim($_POST['poster_url'] ?? '');
    $stream = trim($_POST['stream_url'] ?? '');
    $status = in_array($_POST['status'] ?? '', ['published','draft','hidden'], true) ? $_POST['status'] : 'draft';

    if ($title === '') {
        $error = 'Title is required';
    } else {
        if ($id > 0) {
            $stmt = db()->prepare("UPDATE movies SET title=?,year=?,type=?,poster_url=?,stream_url=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");
            $stmt->execute([$title,$year,$type,$poster,$stream,$status,$id]);
            log_activity('edit_movie', $title);
        } else {
            $stmt = db()->prepare("INSERT INTO movies (title,year,type,poster_url,stream_url,status) VALUES (?,?,?,?,?,?)");
            $stmt->execute([$title,$year,$type,$poster,$stream,$status]);
            log_activity('add_movie', $title);
        }
        header('Location: movies.php?msg=saved');
        exit;
    }
}

$edit = null;
if (isset($_GET['edit'])) {
    $stmt = db()->prepare("SELECT * FROM movies WHERE id=?");
    $stmt->execute([(int)$_GET['edit']]);
    $edit = $stmt->fetch();
}

$list = db()->query("SELECT * FROM movies ORDER BY id DESC")->fetchAll();
$msg = $_GET['msg'] ?? '';

require __DIR__ . '/includes/header.php';
?>
<?php if ($msg === 'saved'): ?><div class="success">Saved.</div><?php endif; ?>
<?php if ($msg === 'deleted'): ?><div class="success">Deleted.</div><?php endif; ?>
<?php if (!empty($error)): ?><div class="error"><?= htmlspecialchars($error) ?></div><?php endif; ?>

<div class="card">
  <h2 style="margin-bottom:16px;font-size:1.1rem"><?= $edit ? 'Edit title' : 'Add new title' ?></h2>
  <form method="post">
    <input type="hidden" name="csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
    <input type="hidden" name="id" value="<?= (int)($edit['id'] ?? 0) ?>">
    <div class="form-group">
      <label>Title *</label>
      <input type="text" name="title" required value="<?= htmlspecialchars($edit['title'] ?? '') ?>">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="form-group">
        <label>Year</label>
        <input type="number" name="year" value="<?= htmlspecialchars((string)($edit['year'] ?? '')) ?>">
      </div>
      <div class="form-group">
        <label>Type</label>
        <select name="type">
          <option value="movie" <?= ($edit['type'] ?? '') === 'movie' ? 'selected' : '' ?>>Movie</option>
          <option value="series" <?= ($edit['type'] ?? '') === 'series' ? 'selected' : '' ?>>Series</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Poster URL</label>
      <input type="url" name="poster_url" value="<?= htmlspecialchars($edit['poster_url'] ?? '') ?>">
    </div>
    <div class="form-group">
      <label>Stream / Source URL</label>
      <input type="url" name="stream_url" value="<?= htmlspecialchars($edit['stream_url'] ?? '') ?>">
    </div>
    <div class="form-group">
      <label>Status</label>
      <select name="status">
        <option value="published" <?= ($edit['status'] ?? '') === 'published' ? 'selected' : '' ?>>Published</option>
        <option value="draft" <?= ($edit['status'] ?? 'draft') === 'draft' ? 'selected' : '' ?>>Draft</option>
        <option value="hidden" <?= ($edit['status'] ?? '') === 'hidden' ? 'selected' : '' ?>>Hidden</option>
      </select>
    </div>
    <button type="submit" name="save" class="btn"><?= $edit ? 'Update' : 'Add title' ?></button>
    <?php if ($edit): ?>
      <a href="movies.php" class="btn btn-secondary" style="margin-left:8px">Cancel</a>
    <?php endif; ?>
  </form>
</div>

<div class="card">
  <h2 style="margin-bottom:16px;font-size:1.1rem">All titles</h2>
  <?php if (!$list): ?>
    <p style="color:var(--muted)">No titles yet.</p>
  <?php else: ?>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Year</th>
          <th>Type</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($list as $m): ?>
        <tr>
          <td><?= htmlspecialchars($m['title']) ?></td>
          <td><?= $m['year'] ?: '—' ?></td>
          <td><?= htmlspecialchars($m['type']) ?></td>
          <td><?= htmlspecialchars($m['status']) ?></td>
          <td style="white-space:nowrap">
            <a href="movies.php?edit=<?= $m['id'] ?>" class="btn btn-secondary" style="padding:4px 10px;font-size:0.8rem">Edit</a>
            <form method="post" style="display:inline" onsubmit="return confirm('Delete this title?')">
              <input type="hidden" name="csrf" value="<?= htmlspecialchars(csrf_token()) ?>">
              <input type="hidden" name="delete_id" value="<?= $m['id'] ?>">
              <button type="submit" class="btn btn-danger" style="padding:4px 10px;font-size:0.8rem">Delete</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>
<?php require __DIR__ . '/includes/footer.php'; ?>
