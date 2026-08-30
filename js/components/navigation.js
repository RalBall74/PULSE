/**
 * PULSE Navigation & Header Component
 * Manages responsive routing links, notification bell dropdown, audio cues, and theme toggle
 */

import { AuthService } from '../services/auth.js';
import { DatabaseService } from '../services/database.js';
import { SoundService } from '../services/sounds.js';
import { Storage } from '../utils/storage.js';
import { QuickXpModal } from './quickXpModal.js';
import { InviteModal } from './inviteModal.js';
import { formatRelativeTime, escapeHtml } from '../utils/helpers.js';

export const Navigation = {
  init() {
    this.bindEvents();
    this.initTheme();
    this.updateNotificationBadge();
  },

  initTheme() {
    const savedTheme = Storage.get('app_theme', 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    Storage.set('app_theme', next);
    SoundService.playClick();
  },

  setActiveView(viewName) {
    const cleanView = (viewName || 'dashboard').replace('#', '');
    
    // Update active class on desktop and mobile nav items
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
      const target = item.getAttribute('data-view');
      item.classList.toggle('active', target === cleanView);
    });

    // Update active view section
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `view-${cleanView}`);
    });
  },

  async updateNotificationBadge() {
    const user = AuthService.getCurrentUser();
    const badgeEl = document.getElementById('notif-badge-indicator');
    if (!badgeEl) return;

    if (!user) {
      badgeEl.style.display = 'none';
      return;
    }

    try {
      const notifs = await DatabaseService.getNotifications(user.uid);
      const unreadCount = notifs.filter(n => !n.read).length;
      badgeEl.style.display = unreadCount > 0 ? 'block' : 'none';
    } catch (e) {
      badgeEl.style.display = 'none';
    }
  },

  async renderNotificationsDropdown() {
    const dropdownEl = document.getElementById('notif-dropdown-menu');
    const user = AuthService.getCurrentUser();
    if (!dropdownEl) return;

    if (!user) {
      dropdownEl.innerHTML = `
        <div class="notif-header"><span>Notifications</span></div>
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          Log in to view notifications
        </div>
      `;
      return;
    }

    try {
      const notifs = await DatabaseService.getNotifications(user.uid);
      
      let itemsHtml = '';
      if (notifs.length === 0) {
        itemsHtml = `<div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No notifications yet.</div>`;
      } else {
        itemsHtml = notifs.map(n => `
          <li class="notif-item ${!n.read ? 'unread' : ''}" data-id="${n.id}" data-type="${n.type}" data-invite="${n.inviteId || ''}">
            <div class="notif-item-title">${escapeHtml(n.title)}</div>
            <div class="notif-item-desc">${escapeHtml(n.message)}</div>
            <div class="notif-item-time">${formatRelativeTime(n.createdAt)}</div>
          </li>
        `).join('');
      }

      dropdownEl.innerHTML = `
        <div class="notif-header">
          <span>Notifications</span>
          <button id="btn-mark-all-read" class="btn btn-sm" style="font-size: 0.72rem; padding: 2px 6px; background: transparent; color: var(--text-muted);">Mark read</button>
        </div>
        <ul class="notif-list">${itemsHtml}</ul>
      `;

      // Handle item clicks (e.g. open invite modal if invite notification)
      dropdownEl.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', async () => {
          const notifId = item.dataset.id;
          await DatabaseService.markNotificationAsRead(user.uid, notifId);
          item.classList.remove('unread');
          this.updateNotificationBadge();

          if (item.dataset.type === 'BATTLE_INVITE') {
            dropdownEl.classList.remove('open');
            InviteModal.open();
          }
        });
      });

      const markAllBtn = dropdownEl.querySelector('#btn-mark-all-read');
      if (markAllBtn) {
        markAllBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          for (const n of notifs) {
            if (!n.read) await DatabaseService.markNotificationAsRead(user.uid, n.id);
          }
          this.renderNotificationsDropdown();
          this.updateNotificationBadge();
        });
      }
    } catch (err) {
      console.error('Failed to render notifications:', err);
    }
  },

  bindEvents() {
    // Navigation routing click handlers
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const view = el.getAttribute('data-view');
        window.location.hash = `#${view}`;
        SoundService.playClick();
      });
    });

    // Theme Toggle
    const themeBtn = document.getElementById('btn-toggle-theme');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Audio Toggle
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const isMuted = SoundService.toggleMute();
        soundBtn.innerHTML = isMuted ? '🔇' : '🔊';
        Toast.show({ title: isMuted ? 'Sound Muted' : 'Sound Enabled', duration: 1500 });
      });
    }

    // Header Quick XP Button
    const headerXpBtn = document.getElementById('btn-header-quick-xp');
    if (headerXpBtn) {
      headerXpBtn.addEventListener('click', () => {
        SoundService.playClick();
        QuickXpModal.open();
      });
    }

    // Notification Bell Toggle
    const notifBellBtn = document.getElementById('btn-notif-bell');
    const notifDropdown = document.getElementById('notif-dropdown-menu');

    if (notifBellBtn && notifDropdown) {
      notifBellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = notifDropdown.classList.toggle('open');
        if (isOpen) {
          SoundService.playClick();
          this.renderNotificationsDropdown();
        }
      });

      // Close notification dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!notifDropdown.contains(e.target) && !notifBellBtn.contains(e.target)) {
          notifDropdown.classList.remove('open');
        }
      });
    }
  }
};
