// Helper bersama untuk ruang live (LiveKit): format pesan chat & reaksi.
import type { Participant } from 'livekit-client';

export interface ChatMessage {
  id: string;
  name: string;
  text: string;
  isHost: boolean;
  isMine?: boolean;
}

export type LiveData = { type: 'chat'; text: string } | { type: 'heart' };

export const MAX_CHAT_LENGTH = 200;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const encodeData = (d: LiveData) => encoder.encode(JSON.stringify(d));

export function decodeData(payload: Uint8Array): LiveData | null {
  try {
    const d = JSON.parse(decoder.decode(payload));
    if (d?.type === 'chat' && typeof d.text === 'string' && d.text.trim()) {
      return { type: 'chat', text: d.text.slice(0, MAX_CHAT_LENGTH) };
    }
    if (d?.type === 'heart') return { type: 'heart' };
  } catch {
    /* abaikan data rusak */
  }
  return null;
}

// Peran diset oleh server di token (tidak bisa dipalsukan penonton)
export function isHostParticipant(p?: Participant): boolean {
  try {
    return JSON.parse(p?.metadata || '{}').role === 'host';
  } catch {
    return false;
  }
}

export const newMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Batasi jumlah pesan yang disimpan di layar
export const appendMessage = (list: ChatMessage[], msg: ChatMessage) => [...list.slice(-99), msg];
