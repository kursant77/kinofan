import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export function createSocket() {
  return io(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
}

/**
 * Build a canonical public URL for a room (used by sharing/links).
 * Prefer VITE_PUBLIC_URL when available so links work from CI/CD domain.
 */
export function getRoomUrl(roomId) {
  const publicUrl = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/$/, '');
  return `${publicUrl}/room/${roomId}`;
}

export async function createRoom() {
  const res = await fetch(`${BASE_URL}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create room');
  const { roomId } = await res.json();
  return roomId;
}
