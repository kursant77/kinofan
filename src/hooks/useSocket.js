import { useEffect, useState, useRef, useCallback } from 'react';
import { createSocket } from '../api/socket';

function doJoin(s, roomId, nickname, setError, setIsHost, setRoomHostId) {
  const cb = (reply) => {
    if (reply?.error) {
      setError(reply.error);
      return;
    }
    setError(null);
    setIsHost(!!reply?.isHost);
    if (reply?.hostId != null) setRoomHostId(reply.hostId);
  };
  if (typeof nickname === 'string' && nickname.trim()) {
    s.emit('join-room', roomId, nickname.trim(), cb);
  } else {
    s.emit('join-room', roomId, cb);
  }
}


export function useSocket(roomId, nickname, enabled = true) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState(null);
  const [roomHostId, setRoomHostId] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [participantsMap, setParticipantsMap] = useState({});
  const nicknameRef = useRef(nickname);
  nicknameRef.current = nickname;

  useEffect(() => {
    if (!roomId || enabled === false) return;
    const s = createSocket();
    setSocket(s);

    const join = () => {
      doJoin(s, roomId, nicknameRef.current, setError, setIsHost, setRoomHostId);
    };

    s.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      join();
    });

    s.on('connect_error', () => {
      setError('Connection failed');
      setReconnecting(true);
    });
    s.on('disconnect', (reason) => {
      setConnected(false);
      if (reason === 'io server disconnect' || reason === 'io client disconnect') setReconnecting(false);
      else setReconnecting(true);
    });
    s.on('reconnect', () => {
      setReconnecting(false);
      join();
    });
    s.on('host-changed', (newHostId) => {
      setRoomHostId(newHostId);
      if (s.id === newHostId) setIsHost(true);
    });
    s.on('participants', (list) => {
      setParticipantsMap((prev) =>
        (Array.isArray(list) ? list : []).reduce((acc, p) => ({ ...acc, [p.id]: p.nickname || 'Guest' }), {})
      );
    });
    s.on('participant-info', ({ id, nickname: n }) => {
      setParticipantsMap((prev) => ({ ...prev, [id]: n || 'Guest' }));
    });
    s.on('peer-left', (id) => {
      setParticipantsMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });

    return () => {
      s.disconnect();
      setSocket(null);
      setRoomHostId(null);
      setParticipantsMap({});
    };
  }, [roomId, enabled]);

  const emit = useCallback((event, ...args) => {
    socket?.emit(event, ...args);
  }, [socket]);

  const on = useCallback((event, handler) => {
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, [socket]);

  return { socket, connected, isHost, error, roomHostId, reconnecting, participantsMap, emit, on };
}
