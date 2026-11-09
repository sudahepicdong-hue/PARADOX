import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserAccount } from '../types/talent';
import { fetchMyLikes } from './db';

type Role = UserAccount['role'];

// Ambil baris profiles milik user yang login, lalu ubah ke bentuk UserAccount yang dipakai App.
export async function loadAccount(user: User): Promise<UserAccount> {
  const [{ data, error }, likedTalentIds] = await Promise.all([
    supabase.from('profiles').select('name, email, role, talent_id').eq('id', user.id).maybeSingle(),
    fetchMyLikes(user.id),
  ]);

  if (error) throw error;

  return {
    id: user.id,
    name: data?.name || user.email?.split('@')[0] || 'Member',
    emailOrPhone: data?.email || user.email || '',
    role: (data?.role as Role) || 'user',
    talentId: data?.talent_id || undefined,
    likedTalentIds,
  };
}

const ROLE_LABEL: Record<Role, string> = {
  user: 'Member VIP',
  talent: 'Talent',
  admin: 'Admin',
};

// Login email + password. Kalau role akun tidak cocok dengan tab yang dipilih, langsung logout lagi.
export async function signIn(email: string, password: string, expectedRole: Role): Promise<UserAccount> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateError(error.message));

  const account = await loadAccount(data.user);
  if (expectedRole !== 'user' && account.role !== expectedRole) {
    await supabase.auth.signOut();
    throw new Error(`Akun ini bukan akun ${ROLE_LABEL[expectedRole]}.`);
  }
  return account;
}

// Daftar akun Member VIP baru. Kalau konfirmasi email aktif di Supabase, session = null.
export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<{ account: UserAccount | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw new Error(translateError(error.message));

  if (!data.session || !data.user) {
    return { account: null, needsConfirmation: true };
  }
  return { account: await loadAccount(data.user), needsConfirmation: false };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Kirim email berisi link reset kata sandi. Link akan kembali ke website ini.
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(translateError(error.message));
}

// Dipanggil setelah user membuka link reset dari email
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(translateError(error.message));
}

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
  if (m.includes('email not confirmed')) return 'Email belum dikonfirmasi. Cek inbox email Anda.';
  if (m.includes('already registered')) return 'Email ini sudah terdaftar. Silakan masuk.';
  if (m.includes('password should be at least')) return 'Kata sandi minimal 6 karakter.';
  if (m.includes('invalid') && m.includes('email')) return 'Format email tidak valid.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Terlalu sering mencoba. Tunggu sebentar lalu coba lagi.';
  if (m.includes('should be different')) return 'Kata sandi baru harus berbeda dari yang lama.';
  return message;
}
