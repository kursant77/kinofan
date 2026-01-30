import { useState, useEffect, useCallback, useRef } from 'react';

export function useMediaStream(constraints = { video: true, audio: true }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [micMuted, setMicMutedState] = useState(false);
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraintsRef.current);
      setStream(s);
      return s;
    } catch (e) {
      setError(e.message || 'Camera/mic access denied');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!stream || !stream.getAudioTracks) return;
    const muted = Boolean(micMuted);
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, [stream, micMuted]);

  const stopVideo = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setMicMutedState(false);
  }, [stream]);

  const setMicMuted = useCallback((muted) => {
    setMicMutedState(Boolean(muted));
    if (stream) {
      const audioTracks = stream.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = !muted;
      });
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks?.().forEach((t) => t.stop());
    };
  }, [stream]);

  return { stream, error, start, stopVideo, micMuted, setMicMuted };
}
