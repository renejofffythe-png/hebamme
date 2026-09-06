/**
 * Höhenquelle der App.
 *
 * iOS Safari verkleinert beim Öffnen der Tastatur nur den *Visual* Viewport,
 * nicht den Layout-Viewport — deshalb helfen weder 100vh noch dvh zuverlässig,
 * und `position: fixed; bottom: 0` landet unter der Tastatur. Einzige
 * verlässliche Quelle ist die VisualViewport-API.
 */
export function installViewport(): void {
  const vv = window.visualViewport;
  const root = document.documentElement;
  let frame = 0;

  const apply = () => {
    frame = 0;
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    root.style.setProperty('--app-h', `${h}px`);
    const app = document.getElementById('app');
    if (app) app.style.transform = top ? `translateY(${top}px)` : '';
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
