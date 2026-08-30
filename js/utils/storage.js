/**
 * Local Storage wrapper for PULSE
 * Provides safe JSON serialization, error handling, and demo-mode caching
 */

const STORAGE_PREFIX = 'pulse_app_';

export const Storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.warn(`Storage get error for key "${key}":`, e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Storage set error for key "${key}":`, e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return true;
    } catch (e) {
      console.error(`Storage remove error for key "${key}":`, e);
      return false;
    }
  },

  clearAllPulseData() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      return true;
    } catch (e) {
      console.error('Storage clear error:', e);
      return false;
    }
  }
};
