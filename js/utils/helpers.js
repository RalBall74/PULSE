/**
 * General helper utilities for PULSE
 */

/**
 * Generate unique random ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Format numbers with commas: 1,250
 */
export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString();
}

/**
 * Format XP (handles decimal .5 nicely)
 */
export function formatXP(xp) {
  if (xp === null || xp === undefined || isNaN(xp)) return '0';
  const num = Number(xp);
  return num % 1 === 0 ? num.toLocaleString() : num.toFixed(1);
}

/**
 * Clamp a number between min and max
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Sanitize strings to avoid XSS in innerHTML
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Debounce helper
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
