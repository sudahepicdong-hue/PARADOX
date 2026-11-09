// Helper bersama untuk ruang live (LiveKit): format pesan chat, reaksi, dan moderasi.
import type { Participant } from 'livekit-client';

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  isHost: boolean;
  isMine?: boolean;
  senderIdentity?: string; // dipakai untuk mengeluarkan / memblokir pengirim
}

export type LiveData =
  | { type: 'chat'; id: string; text: string }
  | { type: 'heart' }
  | { type: 'delete'; id: string }; // hanya dihormati kalau dikirim host / moderator

export const MAX_CHAT_LENGTH = 200;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodeData = (d: LiveData) => encoder.encode(JSON.stringify(d));

const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 40;

export function decodeData(payload: Uint8Array): LiveData | null {
  try {
    const d = JSON.parse(decoder.decode(payload));
    if (d?.type === 'chat' && typeof d.text === 'string' && d.text.trim()) {
      return { type: 'chat', id: validId(d.id) ? d.id : newMessageId(), text: d.text.slice(0, MAX_CHAT_LENGTH) };
    }
    if (d?.type === 'heart') return { type: 'heart' };
    if (d?.type === 'delete' && validId(d.id)) return { type: 'delete', id: d.id };
  } catch {
    /* abaikan data rusak */
  }
  return null;
}

// Peran diset oleh server di token (tidak bisa dipalsukan penonton)
const roleOf = (p?: Participant): string => {
  try {
    return JSON.parse(p?.metadata || '{}').role ?? 'viewer';
  } catch {
    return 'viewer';
  }
};

export const isHostParticipant = (p?: Participant) => roleOf(p) === 'host';

// Host atau moderator (admin) boleh menghapus pesan untuk semua orang
export const isModeratorParticipant = (p?: Participant) => {
  const r = roleOf(p);
  return r === 'host' || r === 'moderator';
};

export const newMessageId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Batasi jumlah pesan yang disimpan di layar
export const appendMessage = (list: ChatMessage[], msg: ChatMessage) => [...list.slice(-99), msg];

export const removeMessage = (list: ChatMessage[], id: string) => list.filter((m) => m.id !== id);

// Anti-spam sederhana: minimal jeda antar pesan dari diri sendiri
export const CHAT_COOLDOWN_MS = 1500;
