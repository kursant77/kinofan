import { nanoid } from 'nanoid';
import { supabase } from './supabase';

export function getRoomUrl(roomId) {
  const base = window.location.origin + (window.location.pathname.replace(/\/$/, '') || '');
  return `${base}/room/${roomId}`;
}

/** Yangi xona id (Supabase rejimida darhol navigatsiya uchun) */
export function generateRoomId() {
  return nanoid(21);
}

/** Xona yaratish (DB ga yozish). Supabase rejimida kerak bo‘lsa sahifa ochilganda chaqiladi. */
export async function createRoom() {
  if (!supabase) throw new Error('Supabase is not configured');
  const roomId = nanoid(21);
  const { error } = await supabase.from('rooms').insert({ id: roomId, host_id: null });
  if (error) throw new Error(error.message || 'Failed to create room');
  return roomId;
}

/** Xona yo‘q bo‘lsa yaratadi (bir marta). Supabase rejimida tez kirish uchun. */
export async function ensureRoom(roomId) {
  if (!supabase) return false;
  const { error } = await supabase.from('rooms').insert({ id: roomId, host_id: null }).select('id').single();
  if (error) {
    if (error.code === '23505' || error.status === 409) return true;
    return false;
  }
  return true;
}

export async function getRoom(roomId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('rooms').select('id, host_id').eq('id', roomId).maybeSingle();
  if (error) return null;
  return data ?? null;
}

export async function updateRoomHost(roomId, hostId) {
  if (!supabase) return false;
  const { error } = await supabase.from('rooms').update({ host_id: hostId }).eq('id', roomId);
  return !error;
}

export async function sendChatMessage(roomId, senderId, nickname, text) {
  if (!supabase) throw new Error('Supabase is not configured');
  const CHAT_MAX_LENGTH = 2000;
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed || trimmed.length > CHAT_MAX_LENGTH) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_id: roomId,
      sender_id: senderId,
      nickname: nickname || 'Guest',
      text: trimmed,
    })
    .select('id, sender_id, nickname, text, created_at')
    .single();
  if (error) throw new Error(error.message || 'Failed to send message');
  return data ? { id: data.id, from: data.sender_id, nickname: data.nickname, text: data.text, at: new Date(data.created_at).getTime() } : null;
}
