import { useEffect, useState, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { supabase } from '../api/supabase';
import { getRoom, updateRoomHost, sendChatMessage, ensureRoom } from '../api/rooms';

const CHANNEL_PREFIX = 'room:';
const CLIENT_ID_KEY = 'kinofan_client_id';

function getOrCreateClientId() {
  if (typeof window === 'undefined') return nanoid();
  const stored = localStorage.getItem(CLIENT_ID_KEY);
  if (stored && stored.length > 0) return stored;
  const id = nanoid();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

function useSupabaseRoom(roomId, nickname, options = {}) {
  const { enabled = true } = options;
  const clientIdRef = useRef(getOrCreateClientId());
  const clientId = clientIdRef.current;

  const [connected, setConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState(null);
  const [roomHostId, setRoomHostId] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [participantsMap, setParticipantsMap] = useState({});
  const [chatMessages, setChatMessages] = useState([]);

  const channelRef = useRef(null);
  const messagesChannelRef = useRef(null);
  const presenceKeysRef = useRef(new Set());
  const handlersRef = useRef({});
  const roomHostIdRef = useRef(null);

  const emit = useCallback((event, ...args) => {
    const ch = channelRef.current;
    if (!ch) return;
    if (event === 'signal') {
      const payload = args[0];
      if (payload && typeof payload === 'object') {
        ch.send({
          type: 'broadcast',
          event: 'signal',
          payload: { from: clientId, ...payload },
        });
      }
    }
  }, [clientId]);

  const on = useCallback((event, handler) => {
    if (!handlersRef.current[event]) handlersRef.current[event] = [];
    handlersRef.current[event].push(handler);
    return () => {
      handlersRef.current[event] = (handlersRef.current[event] || []).filter((h) => h !== handler);
    };
  }, []);

  const fire = useCallback((event, ...args) => {
    (handlersRef.current[event] || []).forEach((h) => {
      try {
        h(...args);
      } catch (e) {
        console.error('useSupabaseRoom handler error', e);
      }
    });
  }, []);

  useEffect(() => {
    if (!roomId || !supabase || enabled === false) return;

    setError(null);
    let channel;
    const channelName = CHANNEL_PREFIX + roomId;

    (async () => {
      let room = await getRoom(roomId);
      if (!room) {
        const created = await ensureRoom(roomId);
        if (!created) {
          setError('Room not found');
          return;
        }
        room = { id: roomId, host_id: null };
      }

      channel = supabase.channel(channelName, {
        config: {
          presence: { key: clientId },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const nextMap = {};
          const currentKeys = new Set();
          Object.entries(state).forEach(([key, presences]) => {
            currentKeys.add(key);
            const p = Array.isArray(presences) ? presences[0] : presences;
            nextMap[key] = p?.nickname || 'Guest';
          });
          setParticipantsMap(nextMap);

          currentKeys.forEach((key) => {
            if (!presenceKeysRef.current.has(key) && key !== clientId) {
              fire('peer-joined', key);
            }
          });
          presenceKeysRef.current.forEach((key) => {
            if (!currentKeys.has(key)) {
              fire('peer-left', key);
              if (key === roomHostIdRef.current) {
                const remaining = Object.keys(nextMap).filter((k) => k !== key);
                if (remaining.length > 0) {
                  const newHost = remaining[0];
                  updateRoomHost(roomId, newHost).then((ok) => {
                    if (ok) {
                      setRoomHostId(newHost);
                      roomHostIdRef.current = newHost;
                      channel.send({ type: 'broadcast', event: 'host-changed', payload: { newHostId: newHost } });
                    }
                  });
                }
              }
            }
          });
          presenceKeysRef.current = currentKeys;
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          const leftKey = key;
          presenceKeysRef.current.delete(leftKey);
          setParticipantsMap((prev) => {
            const next = { ...prev };
            delete next[leftKey];
            return next;
          });
          fire('peer-left', leftKey);
          if (leftKey === roomHostIdRef.current) {
            const state = channel.presenceState();
            const remaining = Object.keys(state).filter((k) => k !== leftKey);
            if (remaining.length > 0) {
              const newHost = remaining[0];
              updateRoomHost(roomId, newHost).then((ok) => {
                if (ok) {
                  setRoomHostId(newHost);
                  roomHostIdRef.current = newHost;
                  channel.send({ type: 'broadcast', event: 'host-changed', payload: { newHostId: newHost } });
                }
              });
            }
          }
        })
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          if (payload && payload.from !== clientId) fire('signal', payload);
        })
        .on('broadcast', { event: 'host-changed' }, ({ payload }) => {
          if (payload?.newHostId != null) {
            setRoomHostId(payload.newHostId);
            roomHostIdRef.current = payload.newHostId;
            setIsHost(payload.newHostId === clientId);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setConnected(true);
            setReconnecting(false);
            await channel.track({ clientId, nickname: nickname || 'Guest' });

            const roomAgain = await getRoom(roomId);
            if (roomAgain) {
              if (roomAgain.host_id == null || roomAgain.host_id === '') {
                const ok = await updateRoomHost(roomId, clientId);
                if (ok) {
                  setRoomHostId(clientId);
                  setIsHost(true);
                  roomHostIdRef.current = clientId;
                  channel.send({ type: 'broadcast', event: 'host-changed', payload: { newHostId: clientId } });
                } else {
                  const r = await getRoom(roomId);
                  setRoomHostId(r?.host_id ?? null);
                  roomHostIdRef.current = r?.host_id ?? null;
                  setIsHost(r?.host_id === clientId);
                }
              } else {
                setRoomHostId(roomAgain.host_id);
                roomHostIdRef.current = roomAgain.host_id;
                setIsHost(roomAgain.host_id === clientId);
              }
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnected(false);
            setReconnecting(true);
          } else if (status === 'CLOSED') {
            setConnected(false);
          }
        });

      channelRef.current = channel;

      const changesChannel = supabase
        .channel(`messages:${roomId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
          (payload) => {
            const row = payload.new;
            if (row) {
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === row.id)) return prev;
                return [
                  ...prev,
                  {
                    id: row.id,
                    from: row.sender_id,
                    nickname: row.nickname || 'Guest',
                    text: row.text,
                    at: new Date(row.created_at).getTime(),
                  },
                ];
              });
            }
          }
        )
        .subscribe();
      messagesChannelRef.current = changesChannel;

      const { data: initialMessages } = await supabase
        .from('messages')
        .select('id, sender_id, nickname, text, created_at')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (Array.isArray(initialMessages)) {
        setChatMessages(
          initialMessages.map((m) => ({
            id: m.id,
            from: m.sender_id,
            nickname: m.nickname || 'Guest',
            text: m.text,
            at: new Date(m.created_at).getTime(),
          }))
        );
      }
    })();

    return () => {
      const ch = channelRef.current;
      const msgCh = messagesChannelRef.current;
      if (ch) {
        ch.unsubscribe();
        channelRef.current = null;
      }
      if (msgCh) {
        msgCh.unsubscribe();
        messagesChannelRef.current = null;
      }
      setConnected(false);
      setRoomHostId(null);
      setParticipantsMap({});
      presenceKeysRef.current = new Set();
    };
  }, [roomId, clientId, nickname, fire, enabled]);

  const handleSendChat = useCallback(
    (text) => {
      sendChatMessage(roomId, clientId, nickname, text)
        .then((msg) => {
          if (msg) setChatMessages((prev) => [...prev, msg]);
        })
        .catch((e) => {
          console.error('Send chat error', e);
        });
    },
    [roomId, clientId, nickname]
  );

  const socket = { id: clientId };

  return {
    socket,
    connected,
    isHost,
    error,
    roomHostId,
    reconnecting,
    participantsMap,
    emit,
    on,
    chatMessages,
    setChatMessages,
    handleSendChat,
  };
}

export default useSupabaseRoom;
