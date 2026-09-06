/** Winzige DOM-Helfer. Kein Framework — siehe KONZEPT.md, Abschnitt 8. */

type Attrs = Record<string, string | number | boolean | null | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string | null)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k.startsWith('style:')) node.style.setProperty(k.slice(6), String(v));
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** Die fünf Formen der App. Ein Icon-Grid gibt es bewusst nicht. */
export function icon(name: 'check' | 'cross' | 'tilde' | 'sound' | 'arrow'): SVGSVGElement {
  const paths: Record<string, string> = {
    check: 'M3 3h18v18H3z M7 12l3.5 3.5L17 9',
    cross: 'M5 5l14 14 M19 5L5 19',
    tilde: 'M3 14c3-6 6 6 9 0s6-6 9 0',
    sound: 'M4 9v6 M9 5v14 M14 8v8 M19 10v4',
    arrow: 'M4 12h15 M13 6l6 6-6 6',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', paths[name]!);
  svg.append(p);
  return svg;
}

const live = () => document.getElementById('live');

/** Screenreader-Ansage. Immer polite — assertive würde das Tipp-Echo stören. */
export function announce(text: string): void {
  const node = live();
  if (!node) return;
  node.textContent = '';
  window.setTimeout(() => { node.textContent = text; }, 40);
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** Deterministisch aus einem String — nie Math.random() im Render-Pfad,
    sonst springt das Plakat bei jedem Neuzeichnen. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function pick<T>(items: readonly T[], seed: string): T {
  return items[hash(seed) % items.length]!;
}
