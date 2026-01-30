import React, { useState } from 'react';
import { getRoomUrl } from '../api/rooms';
import styles from './InviteButton.module.css';

const canShare = typeof navigator !== 'undefined' && navigator.share;

export default function InviteButton({ roomId }) {
  const [copied, setCopied] = useState(false);

  const [lastUrl, setLastUrl] = useState('');

  async function handleCopy() {
    const url = getRoomUrl(roomId);
    setLastUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function handleShare() {
    const url = getRoomUrl(roomId);
    setLastUrl(url);
    try {
      await navigator.share({
        title: 'Kinofan',
        text: 'Birga kino ko‘ramizmi?',
        url,
      });
    } catch (e) {
      if (e.name !== 'AbortError') handleCopy();
    }
  }

  return (
    <>
      {canShare && (
        <button
          type="button"
          onClick={handleShare}
          className={styles.button}
        >
          Ulashish
        </button>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className={copied ? styles.buttonCopied : styles.button}
      >
        {copied ? 'Nusxalandi!' : 'Invite'}
      </button>

      {lastUrl && (
        <div className={styles.invitePreview} aria-live="polite">
          <small style={{ opacity: 0.85 }}>Link:</small>
          <div>
            <a href={lastUrl} target="_blank" rel="noopener noreferrer">{lastUrl}</a>
          </div>
        </div>
      )}
    </>
  );
}
