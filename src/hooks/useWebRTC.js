import { useEffect, useRef, useState, useCallback } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function createPeerConnection(onTrack) {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.ontrack = (e) => {
    if (e.streams?.[0]) onTrack(e.streams[0]);
  };
  return pc;
}

export function useWebRTC({
  socket,
  connected,
  isHost,
  webcamStream,
  movieStream,
  on,
  emit,
}) {
  const peerRef = useRef(new Map()); // key = `${remoteId}-${label}` -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState({}); // { [peerId]: { movie?: MediaStream, webcam?: MediaStream } }
  const socketIdRef = useRef(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const getOrCreatePc = useCallback((remoteId, label, onTrack) => {
    const key = `${remoteId}-${label}`;
    let pc = peerRef.current.get(key);
    if (!pc) {
      pc = createPeerConnection((stream) => {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          next[remoteId] = { ...next[remoteId], [label]: stream };
          return next;
        });
      });
      pc.onicecandidate = (e) => {
        if (e.candidate) emitRef.current?.('signal', { to: remoteId, type: 'ice', label, candidate: e.candidate });
      };
      peerRef.current.set(key, pc);
    }
    return pc;
  }, []);

  const closePeer = useCallback((remoteId) => {
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[remoteId];
      return next;
    });
    for (const key of peerRef.current.keys()) {
      if (key.startsWith(`${remoteId}-`)) {
        peerRef.current.get(key)?.close();
        peerRef.current.delete(key);
      }
    }
  }, []);

  useEffect(() => {
    if (!connected || !socket || !on || !emit) return;
    socketIdRef.current = socket.id;

    // New joiner does not create offers; existing participants create offers on peer-joined
    const unsubPeerJoined = on('peer-joined', (peerId) => {
      createOfferTo(peerId);
    });

    async function createOfferTo(peerId) {
      const sendOffer = async (label, stream) => {
        if (!stream) return;
        const pc = getOrCreatePc(peerId, label, () => {});
        const track = stream.getVideoTracks()[0] || stream.getTracks()[0];
        if (track) pc.addTrack(track, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('signal', { to: peerId, type: 'offer', label, sdp: offer });
      };
      if (isHost && webcamStream) await sendOffer('webcam', webcamStream);
      if (isHost && movieStream) await sendOffer('movie', movieStream);
      if (!isHost && webcamStream) await sendOffer('webcam', webcamStream);
    }

    const unsubSignal = on('signal', async ({ from, type, label, sdp, candidate }) => {
      if (from === socketIdRef.current) return;
      const key = `${from}-${label || 'webcam'}`;
      let pc = peerRef.current.get(key);
      if (type === 'offer') {
        pc = getOrCreatePc(from, label || 'webcam', () => {});
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        if (webcamStream && (label === 'webcam' || !label)) {
          const track = webcamStream.getVideoTracks()[0] || webcamStream.getTracks()[0];
          if (track) pc.addTrack(track, webcamStream);
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emit('signal', { to: from, type: 'answer', label: label || 'webcam', sdp: answer });
      } else if (type === 'answer' && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } else if (type === 'ice' && pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    const unsubPeerLeft = on('peer-left', (peerId) => {
      closePeer(peerId);
    });

    return () => {
      unsubPeerJoined?.();
      unsubSignal?.();
      unsubPeerLeft?.();
      peerRef.current.forEach((pc) => pc.close());
      peerRef.current.clear();
    };
  }, [connected, socket, isHost, webcamStream, movieStream, on, emit, getOrCreatePc, closePeer]);

  // When host adds movie stream later, send movie offer to all current peers
  useEffect(() => {
    if (!isHost || !movieStream || !emit) return;
    const peerIds = new Set();
    for (const key of peerRef.current.keys()) {
      const peerId = key.split('-')[0];
      if (key.endsWith('-webcam')) peerIds.add(peerId);
    }
    peerIds.forEach((peerId) => {
      const key = `${peerId}-movie`;
      if (peerRef.current.has(key)) return;
      (async () => {
        const pc = getOrCreatePc(peerId, 'movie', () => {});
        const track = movieStream.getVideoTracks()[0] || movieStream.getTracks()[0];
        if (track) pc.addTrack(track, movieStream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emit('signal', { to: peerId, type: 'offer', label: 'movie', sdp: offer });
      })();
    });
  }, [isHost, movieStream, emit, getOrCreatePc]);

  return { remoteStreams, closePeer };
}
