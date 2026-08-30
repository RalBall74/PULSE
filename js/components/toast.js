/**
 * PULSE Toast Notification & XP Floater Component
 */

import { SoundService } from '../services/sounds.js';

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export const Toast = {
  show({ title, message, type = 'info', duration = 3500 }) {
    const container = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = '⚡';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠️';
    if (type === 'xp') icon = '✨';

    toast.innerHTML = `
      <div style="font-size: 1.2rem;">${icon}</div>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 2px;">${title}</div>
        ${message ? `<div style="font-size: 0.8rem; color: var(--text-secondary);">${message}</div>` : ''}
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(title, message) {
    this.show({ title, message, type: 'success' });
  },

  error(title, message) {
    this.show({ title, message, type: 'error' });
  },

  /**
   * Spawn floating +XP on screen with sound effect
   */
  spawnXpFloater(amount, x = null, y = null) {
    SoundService.playXpChime();

    const floater = document.createElement('div');
    floater.className = 'xp-floater tabular-nums';
    floater.textContent = `+${amount} XP`;

    const posX = x !== null ? x : window.innerWidth / 2;
    const posY = y !== null ? y : window.innerHeight / 2 - 50;

    floater.style.left = `${posX}px`;
    floater.style.top = `${posY}px`;

    document.body.appendChild(floater);
    setTimeout(() => floater.remove(), 1200);
  }
};
