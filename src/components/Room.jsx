import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../api/supabase';
import { useSocket } from '../hooks/useSocket';
import useSupabaseRoom from '../hooks/useSupabaseRoom';
import { useMediaStream } from '../hooks/useMediaStream';
import { useWebRTC } from '../hooks/useWebRTC';
import { MoviePlayer, WebcamTile } from './VideoArea';
import Chat from './Chat';
import InviteButton from './InviteButton';
import NicknameModal from './NicknameModal';
import styles from './Room.module.css';

const NICKNAME_KEY = 'kinofan_nickname';

function RoomContent({ roomId, nickname, onLeave }) {
  const navigate = useNavigate();
  const useSupabase = !!supabase;
  const validRoomId = roomId && typeof roomId === 'string' && roomId.trim() ? roomId.trim() : null;

  const supabaseRoom = useSupabaseRoom(validRoomId, nickname, { enabled: useSupabase });
  const socketRoom = useSocket(validRoomId, nickname, !useSupabase);

  const [socketChatMessages, setSocketChatMessages] = useState([]);
  useEffect(() => {
    if (useSupabase || !socketRoom.on) return;
    return socketRoom.on('chat', (msg) => setSocketChatMessages((prev) => [...prev, msg]));
  }, [useSupabase, socketRoom.on]);

  const socket = useSupabase ? supabaseRoom.socket : socketRoom.socket;
  const connected = useSupabase ? supabaseRoom.connected : socketRoom.connected;
  const isHost = useSupabase ? supabaseRoom.isHost : socketRoom.isHost;
  const error = useSupabase ? supabaseRoom.error : socketRoom.error;
  const roomHostId = useSupabase ? supabaseRoom.roomHostId : socketRoom.roomHostId;
  const reconnecting = useSupabase ? supabaseRoom.reconnecting : socketRoom.reconnecting;
  const participantsMap = useSupabase ? supabaseRoom.participantsMap : socketRoom.participantsMap;
  const emit = useSupabase ? supabaseRoom.emit : socketRoom.emit;
  const on = useSupabase ? supabaseRoom.on : socketRoom.on;
  const chatMessages = useSupabase ? supabaseRoom.chatMessages : socketChatMessages;
  const handleSendChat = useSupabase
    ? supabaseRoom.handleSendChat
    : useCallback((text) => socketRoom.emit('chat', text), [socketRoom.emit]);

  const {
    stream: webcamStream,
    error: camError,
    start: startCam,
    stopVideo,
    micMuted,
    setMicMuted,
  } = useMediaStream();
  const [movieStream, setMovieStream] = useState(null);
  const hostVideoRef = useRef(null);

  const { remoteStreams } = useWebRTC({
    socket,
    connected,
    isHost,
    webcamStream: webcamStream || undefined,
    movieStream: movieStream || undefined,
    on,
    emit,
  });

  const handleFileSelect = useCallback((stream) => {
    setMovieStream(stream);
  }, []);

  useEffect(() => {
    if (!connected) return;
    startCam();
  }, [connected, startCam]);

  useEffect(() => {
    const baseTitle = 'Kinofan';
    const updateTitle = () => {
      if (document.hidden && chatMessages.length > 0) {
        document.title = `(${chatMessages.length}) ${baseTitle}`;
      } else {
        document.title = baseTitle;
      }
    };
    updateTitle();
    const handleVisibility = () => {
      if (!document.hidden) document.title = baseTitle;
      else if (chatMessages.length > 0) document.title = `(${chatMessages.length}) ${baseTitle}`;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.title = baseTitle;
    };
  }, [chatMessages.length]);

  const hostId = useMemo(
    () => roomHostId ?? Object.keys(remoteStreams).find((id) => remoteStreams[id]?.movie),
    [roomHostId, remoteStreams]
  );

  const [showConnectingOverlay, setShowConnectingOverlay] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  useEffect(() => {
    if (connected) {
      setShowConnectingOverlay(false);
      setConnectionTimeout(false);
      return;
    }
    const showTimer = setTimeout(() => setShowConnectingOverlay(true), 2000);
    const timeoutTimer = setTimeout(() => setConnectionTimeout(true), 15000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(timeoutTimer);
    };
  }, [connected]);

  if (!validRoomId) {
    return (
      <div className={styles.errorPage}>
        <p className={styles.error}>Xona topilmadi</p>
        <button type="button" className={styles.errorBackButton} onClick={() => navigate('/', { replace: true })}>
          Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorPage}>
        <p className={styles.error}>{error}</p>
        <button type="button" className={styles.errorBackButton} onClick={() => navigate('/', { replace: true })}>
          Bosh sahifaga qaytish
        </button>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.title}>Kinofan</span>
        <span className={styles.roomId} title={validRoomId}>
          {validRoomId}
        </span>
        <div className={styles.headerActions}>
          <InviteButton roomId={validRoomId} />
          <button type="button" className={styles.leaveButton} onClick={onLeave}>
            Chiqish
          </button>
        </div>
      </header>

      <div className={styles.main}>
        <div className={styles.camerasColumn}>
          <h3 className={styles.sectionTitle}>Cameras</h3>
          <div className={styles.cameraControls}>
            {webcamStream ? (
              <>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => setMicMuted(!micMuted)}
                  title={micMuted ? 'Mikrofonni yoqish' : 'Mikrofonni o‘chirish'}
                >
                  {micMuted ? 'Mic off' : 'Mic on'}
                </button>
                <button type="button" className={styles.smallButton} onClick={stopVideo} title="Kamerani o‘chirish">
                  Camera off
                </button>
              </>
            ) : (
              <button type="button" className={styles.smallButton} onClick={startCam} title="Kamerani yoqish">
                Camera on
              </button>
            )}
          </div>
          <div className={styles.webcamGrid}>
            {webcamStream ? (
              <WebcamTile stream={webcamStream} label={nickname || 'You'} muted />
            ) : (
              <div className={styles.cameraPlaceholder} title="Kamera o‘chirilgan">
                <span>{nickname || 'You'}</span>
                <span className={styles.placeholderHint}>Camera off</span>
              </div>
            )}
            {Object.entries(remoteStreams).map(([peerId, streams]) => (
              <React.Fragment key={peerId}>
                {streams.webcam && (
                  <WebcamTile
                    key={`${peerId}-webcam`}
                    stream={streams.webcam}
                    label={participantsMap[peerId] || peerId.slice(-6)}
                    muted={false}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className={styles.movieSection}>
          {isHost ? (
            <MoviePlayer
              stream={movieStream}
              isHost
              videoRef={hostVideoRef}
              onFileSelect={handleFileSelect}
            />
          ) : (
            <MoviePlayer
              stream={hostId ? remoteStreams[hostId]?.movie : null}
              isHost={false}
            />
          )}
        </div>
        <div className={styles.chatSection}>
          <Chat
            messages={chatMessages}
            onSend={handleSendChat}
            disabled={!connected}
            mySocketId={socket?.id}
          />
        </div>
      </div>

      {!connected && showConnectingOverlay && (
        <div className={styles.overlay}>
          {connectionTimeout ? (
            <div className={styles.overlayContent}>
              <p className={styles.overlayText}>Ulanish uzoq davom etmoqda.</p>
              <p className={styles.overlayHint}>Tarmoqni tekshiring yoki sahifani yangilab qayta urinib ko‘ring.</p>
              <button
                type="button"
                className={styles.overlayButton}
                onClick={() => window.location.reload()}
              >
                Sahifani yangilash
              </button>
            </div>
          ) : (
            reconnecting ? 'Qayta ulanmoqda…' : 'Connecting…'
          )}
        </div>
      )}
      {camError && (
        <div className={styles.camError}>
          <span>Camera: {camError}</span>
          <button type="button" className={styles.camRetryButton} onClick={startCam}>
            Qayta urinish
          </button>
        </div>
      )}
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(NICKNAME_KEY) || '';
  });

  if (!nickname.trim()) {
    return (
      <NicknameModal
        defaultName={nickname}
        onSubmit={(n) => {
          setNickname(n);
          localStorage.setItem(NICKNAME_KEY, n);
        }}
      />
    );
  }

  return (
    <RoomContent
      roomId={roomId}
      nickname={nickname}
      onLeave={() => navigate('/', { replace: true })}
    />
  );
}
