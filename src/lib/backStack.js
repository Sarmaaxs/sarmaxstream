// Things that cover the page (video player, full-screen player, menus) register here so the
// Android Back button closes THEM first instead of leaving the page or the app.
const stack = [];
export function pushBackHandler(fn) {
  stack.push(fn);
  return () => { const i = stack.lastIndexOf(fn); if (i >= 0) stack.splice(i, 1); };
}
export function runBackHandler() {
  const fn = stack[stack.length - 1];
  if (!fn) return false;
  try { fn(); } catch { /* ignore */ }
  return true;
}
