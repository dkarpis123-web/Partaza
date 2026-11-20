// Guesses the visitor's country from the device's time zone. Nothing is sent anywhere and
// no permission is asked; the guess is only a suggestion the person can change.
const BY_ZONE: Record<string, string> = {
  'Europe/Vilnius': 'Lietuva', 'Europe/Riga': 'Latvija', 'Europe/Tallinn': 'Estija', 'Europe/Warsaw': 'Lenkija',
  'Europe/Berlin': 'Vokietija', 'Europe/Busingen': 'Vokietija', 'Europe/Helsinki': 'Suomija', 'Europe/Stockholm': 'Švedija',
  'Europe/Oslo': 'Norvegija', 'Europe/Copenhagen': 'Danija', 'Europe/London': 'Jungtinė Karalystė', 'Europe/Dublin': 'Airija',
  'Europe/Amsterdam': 'Nyderlandai', 'Europe/Brussels': 'Belgija', 'Europe/Paris': 'Prancūzija', 'Europe/Madrid': 'Ispanija',
  'Europe/Rome': 'Italija', 'Europe/Vienna': 'Austrija', 'Europe/Prague': 'Čekija', 'Europe/Kyiv': 'Ukraina', 'Europe/Kiev': 'Ukraina',
};

/** Countries a seller can choose from, in Lithuanian (the form stored in listings). */
export const COUNTRIES = ['Lietuva', 'Latvija', 'Estija', 'Lenkija', 'Vokietija', 'Suomija', 'Švedija', 'Norvegija', 'Danija', 'Jungtinė Karalystė', 'Airija', 'Nyderlandai', 'Belgija', 'Prancūzija', 'Ispanija', 'Italija', 'Austrija', 'Čekija', 'Ukraina'];

export function detectCountry(): string | null {
  try {
    return BY_ZONE[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? null;
  } catch {
    return null;
  }
}
