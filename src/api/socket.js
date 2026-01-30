import { io } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_URL || '';

export function createSocket() {
  return io(BASE_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
}

export function getRoomUrl(roomId) {
  const base = window.location.origin + (window.location.pathname.replace(/\/$/, '') || '');
  return `${base}/room/${roomId}`;
}

export async function createRoom() {
  const res = await fetch(`${BASE_URL}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create room');
  const { roomId } = await res.json();
  return roomId;
}
