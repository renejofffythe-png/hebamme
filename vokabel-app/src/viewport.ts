/**
 * Höhenquelle der App.
 *
 * iOS Safari verkleinert beim Öffnen der Tastatur nur den *Visual* Viewport,
 * nicht den Layout-Viewport — deshalb helfen weder 100vh noch dvh zuverlässig,
 * und `position: fixed; bottom: 0` landet unter der Tastatur. Einzige
 * verlässliche Quelle ist die VisualViewport-API.
 */
export function installViewport(onResize?: () => void): void {
  const vv = window.visualViewport;
  const root = document.documentElement;
  let frame = 0;

  const apply = () => {
    frame = 0;
    // Die API meldet gelegentlich 0 (versteckter Tab, Rotation). Ungeprüft
    // übernommen kollabiert das ganze Layout.
    const raw = vv ? vv.height : window.innerHeight;
    const h = Math.max(240, raw || window.innerHeight || 240);
    const top = vv ? vv.offsetTop : 0;
    root.style.setProperty('--app-h', `${h}px`);
    const app = document.getElementById('app');
    if (app) app.style.transform = top ? `translateY(${top}px)` : '';
    onResize?.();
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(apply);
  };

  apply();
  if (vv) {
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
  }
  window.addEventListener('orientationchange', () => window.setTimeout(apply, 120));
}
