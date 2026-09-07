/**
 * Zielsprachen. Die Ausgangssprache ist immer Deutsch — das steckt in der
 * Mechanik (deutsches Wort auf dem Plakat) und ist nicht konfigurierbar.
 *
 * `code` ist BCP-47 und geht direkt an die Sprachausgabe. Für Latein gibt es
 * auf keinem Gerät eine Stimme; die App blendet den Lautsprecher dann aus,
 * statt eine falsche Stimme zu nehmen.
 */

export interface Lang {
  code: string;
  /** Kurzname in der Oberfläche: "Deutsch → Englisch". */
  label: string;
  /** Auswahlliste beim Import, wo die Variante zählt. */
  long: string;
}

export const LANGS: readonly Lang[] = [
  { code: 'en-GB', label: 'Englisch', long: 'Englisch (britisch)' },
  { code: 'en-US', label: 'Englisch', long: 'Englisch (amerikanisch)' },
  { code: 'fr-FR', label: 'Französisch', long: 'Französisch' },
  { code: 'es-ES', label: 'Spanisch', long: 'Spanisch' },
  { code: 'it-IT', label: 'Italienisch', long: 'Italienisch' },
  { code: 'nl-NL', label: 'Niederländisch', long: 'Niederländisch' },
  { code: 'tr-TR', label: 'Türkisch', long: 'Türkisch' },
  { code: 'la', label: 'Latein', long: 'Latein (ohne Sprachausgabe)' },
];

export const DEFAULT_LANG = LANGS[0]!;

export function langByCode(code: string): Lang {
  return LANGS.find((l) => l.code === code) ?? DEFAULT_LANG;
}

/** Nur Englisch kennt das vorangestellte "to" als Infinitivmarker. */
export function isEnglish(code: string): boolean {
  return code.startsWith('en');
}
