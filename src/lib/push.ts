// Notifikasi push "talent sedang live" untuk member.
import { supabase } from './supabase';

export type PushState =
  | 'unsupported' // browser tidak mendukung
  | 'ios-needs-install' // iPhone: harus "Tambah ke Layar Utama" dulu
  | 'denied' // izin notifikasi diblokir di browser
  | 'off'
  | 'on';

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function getRegistration() {
  return (await navigator.serviceWorker.getRegistration('/')) ?? navigator.serviceWorker.register('/sw.js');
}

export async function getPushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return 'ios-needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

const toUint8 = (base64url: string) => {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// Minta izin, berlangganan, lalu simpan ke akun yang sedang login
export async function enablePush(): Promise<PushState> {
  const state = await getPushState();
  if (state === 'unsupported' || state === 'ios-needs-install' || state === 'denied') return state;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const { data: key, error: keyErr } = await supabase.rpc('get_vapid_public_key');
  if (keyErr || !key) throw new Error('Notifikasi belum diatur di server. Hubungi admin.');

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(key as string) }));

  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth
  });
  if (error) throw error;
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return 'off';
}

export const PUSH_STATE_TEXT: Record<PushState, string> = {
  unsupported: 'Browser ini belum mendukung notifikasi. Coba Chrome di Android atau browser laptop.',
  'ios-needs-install':
    'Di iPhone, notifikasi hanya bisa setelah website di-install: ketuk Bagikan → Tambah ke Layar Utama, lalu buka dari ikon PARADOX.',
  denied: 'Notifikasi diblokir di browser. Izinkan lewat ikon gembok di samping alamat website, lalu coba lagi.',
  off: 'Dapat notifikasi saat talent yang Anda sukai (❤️) mulai live.',
  on: 'Aktif. Anda akan diberi tahu saat talent yang Anda sukai (❤️) mulai live.'
};
