import React, { useState, useEffect } from 'react';
import styles from './NicknameModal.module.css';

export default function NicknameModal({ onSubmit, defaultName = '' }) {
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label="Ismingizni kiriting">
      <div className={styles.modal}>
        <h2 className={styles.title}>Xonaga kirish</h2>
        <p className={styles.subtitle}>Boshqalar sizni qanday ko‘rsin?</p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ismingiz"
            className={styles.input}
            maxLength={32}
            autoFocus
          />
          <button type="submit" className={styles.submit} disabled={!name.trim()}>
            Kirish
          </button>
        </form>
      </div>
    </div>
  );
}
