// Daftar layanan yang bisa dipilih per talent (centang di form admin & Profil Saya).
// Topik chat Telegram di profil talent hanya menampilkan layanan yang dicentang talent itu.
export const SERVICE_OPTIONS = [
  { label: 'Video Call S', message: 'memesan Video Call S' },
  { label: 'Konten VVIP', message: 'menanyakan Konten VVIP' },
  { label: 'Call S', message: 'memesan Call S' }
] as const;

// Selalu tersedia untuk semua talent
export const CS_TOPIC = { label: 'CS Alur', message: 'menanyakan alur / cara pemesanan' } as const;

const KNOWN = new Set<string>(SERVICE_OPTIONS.map((s) => s.label));

// Topik chat untuk satu talent: layanan yang dia centang + CS Alur
export const bookingTopicsFor = (services: string[] | undefined) => [
  ...SERVICE_OPTIONS.filter((s) => services?.includes(s.label)),
  CS_TOPIC
];

// Hanya layanan dari daftar resmi (isian lama seperti "VIP Dinner" diabaikan)
export const knownServices = (services: string[] | undefined) => (services ?? []).filter((s) => KNOWN.has(s));
