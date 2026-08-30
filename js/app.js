/**
 * PULSE - Master Application Coordinator
 * Pure Vanilla JavaScript ES Module
 */

import { FirebaseService } from './services/firebase.js';
import { DatabaseService } from './services/database.js';
import { AuthService } from './services/auth.js';
import { NotificationService } from './services/notifications.js';
import { Navigation } from './components/navigation.js';
import { QuickXpModal } from './components/quickXpModal.js';
import { InviteModal } from './components/inviteModal.js';
import { TransactionModal } from './components/transactionModal.js';
import { AuthView } from './views/authView.js';
import { DashboardView } from './views/dashboardView.js';
import { BattlesView } from './views/battlesView.js';
import { HistoryView } from './views/historyView.js';
import { ProfileView } from './views/profileView.js';
import { escapeHtml, formatXP } from './utils/helpers.js';

class PulseApp {
  constructor() {
    this.currentView = 'dashboard';
  }

  async init() {
    console.log('🚀 Initializing PULSE Competitive Season Platform...');

    // 1. Initialize core database & storage
    await DatabaseService.init();

    // 2. Initialize Authentication & Session
    const user = await AuthService.init();

    // 3. Initialize Notifications
    await NotificationService.init(user);

    // 4. Initialize Navigation & Global Modals
    Navigation.init();
    QuickXpModal.init();
    InviteModal.init();
    TransactionModal.init();
    AuthView.init();

    // 5. Setup Router & State Listeners
    this.setupRouter();
    this.setupGlobalEvents();

    // 6. Initial Render
    this.updateUserHeader(user);
    this.navigate(window.location.hash || '#dashboard');

    console.log('⚡ PULSE Ready. Current Session:', user ? user.username : 'Guest');
  }

  setupRouter() {
    window.addEventListener('hashchange', () => {
      this.navigate(window.location.hash);
    });
  }

  setupGlobalEvents() {
    // Re-render when XP, battle, or profile state changes
    window.addEventListener('pulse_state_updated', async () => {
      const user = AuthService.getCurrentUser();
      if (user) {
        const freshProfile = await DatabaseService.getUserProfile(user.uid);
        this.updateUserHeader(freshProfile);
      } else {
        this.updateUserHeader(null);
      }
      this.renderCurrentView();
      Navigation.updateNotificationBadge();
    });

    // Auth modal trigger
    window.addEventListener('pulse_open_auth', (e) => {
      const mode = e.detail?.mode || 'LOGIN';
      AuthView.open(mode);
    });

    // Header user chip / login button click
    const headerUserBtn = document.getElementById('btn-header-user');
    if (headerUserBtn) {
      headerUserBtn.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        if (user) {
          window.location.hash = '#profile';
        } else {
          AuthView.open('LOGIN');
        }
      });
    }
  }

  updateUserHeader(user) {
    const userBtn = document.getElementById('btn-header-user');
    if (!userBtn) return;

    if (user) {
      userBtn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600;">
          <div class="player-avatar you" style="width: 28px; height: 28px; font-size: 0.85rem; border-radius: var(--radius-sm);">
            ${escapeHtml(user.username.charAt(0).toUpperCase())}
          </div>
          <span style="display: inline-block; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(user.username)}
          </span>
          <span class="badge badge-cyan" style="font-size: 0.7rem; padding: 2px 6px;">Lvl ${user.level || 1}</span>
        </div>
      `;
    } else {
      userBtn.innerHTML = `
        <span class="badge badge-cyan" style="padding: 6px 12px; font-size: 0.82rem; cursor: pointer;">
          Sign In ⚡
        </span>
      `;
    }
  }

  async navigate(hash) {
    const viewName = (hash || '#dashboard').replace('#', '') || 'dashboard';
    this.currentView = viewName;
    Navigation.setActiveView(viewName);
    await this.renderCurrentView();
    window.scrollTo(0, 0);
  }

  async renderCurrentView() {
    switch (this.currentView) {
      case 'battles':
        await BattlesView.render();
        break;
      case 'history':
        await HistoryView.render();
        break;
      case 'profile':
        await ProfileView.render();
        break;
      case 'dashboard':
      default:
        await DashboardView.render();
        break;
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.Pulse = new PulseApp();
  window.Pulse.init();
});
