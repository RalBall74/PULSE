/**
 * PULSE Profile & Transaction Manager View
 * Profile stats, XP ledger (with edit & delete actions), settings, and runtime config
 */

import { AuthService } from '../services/auth.js';
import { DatabaseService } from '../services/database.js';
import { NotificationService } from '../services/notifications.js';
import { TransactionModal } from '../components/transactionModal.js';
import { Toast } from '../components/toast.js';
import { SoundService } from '../services/sounds.js';
import { XP_TYPE_LABELS } from '../engine/xpEngine.js';
import { formatDate, formatRelativeTime } from '../utils/dateUtils.js';
import { formatNumber, formatXP, escapeHtml } from '../utils/helpers.js';
import { getRuntimeConfig, saveRuntimeConfig } from '../config.js';

export const ProfileView = {
  async render() {
    const container = document.getElementById('view-profile');
    if (!container) return;

    const user = AuthService.getCurrentUser();
    if (!user) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <h2 class="empty-title">User Profile</h2>
          <p class="empty-subtitle">Sign in to access your profile, XP transaction ledger, and battle settings.</p>
        </div>
      `;
      return;
    }

    const transactions = await DatabaseService.getTransactions(user.uid);
    const config = getRuntimeConfig();

    container.innerHTML = `
      <!-- User Profile Header Card -->
      <div class="card" style="margin-bottom: 24px; position: relative; overflow: hidden;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 18px;">
            <div class="player-avatar you" style="width: 64px; height: 64px; font-size: 1.6rem;">
              ${escapeHtml(user.username.charAt(0).toUpperCase())}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <h2 style="font-size: 1.5rem; font-family: var(--font-display);">${escapeHtml(user.username)}</h2>
                <span class="badge badge-cyan">Level ${user.level || 1}</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
                Member since ${formatDate(user.createdAt || new Date())}
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary btn-sm" id="btn-profile-logout">
              <span>Log Out 🚪</span>
            </button>
          </div>
        </div>

        <!-- Career Statistics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-top: 24px;">
          <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total XP</div>
            <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--accent-cyan);" class="tabular-nums">
              ${formatXP(user.totalXP)}
            </div>
          </div>

          <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current Streak</div>
            <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--accent-amber);" class="streak-pulse">
              🔥 ${user.currentStreak || 0}d
            </div>
          </div>

          <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Best Streak</div>
            <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800;">
              ${user.longestStreak || user.currentStreak || 0}d
            </div>
          </div>

          <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Battle Record</div>
            <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--accent-emerald);">
              ${user.wins || 0}W - ${user.losses || 0}L
            </div>
          </div>
        </div>
      </div>

      <!-- XP Transaction Ledger (Edit / Delete) -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 class="card-title">
            <span>📋</span>
            <span>XP Transaction Ledger (${transactions.length})</span>
          </h3>
          <span style="font-size: 0.78rem; color: var(--text-muted);">Click any transaction to edit or delete</span>
        </div>

        ${transactions.length === 0 ? `
          <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">
            No XP transactions logged yet. Use Quick Actions on the Dashboard to start earning XP!
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-medium); color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">
                  <th style="padding: 10px 12px;">Type</th>
                  <th style="padding: 10px 12px;">Notes / Detail</th>
                  <th style="padding: 10px 12px; text-align: right;">XP</th>
                  <th style="padding: 10px 12px;">Time</th>
                  <th style="padding: 10px 12px; text-align: center;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.map(tx => `
                  <tr style="border-bottom: 1px solid var(--border-subtle); transition: background var(--transition-fast);">
                    <td style="padding: 12px; font-weight: 600;">
                      <span class="badge ${tx.amount > 25 ? 'badge-emerald' : 'badge-cyan'}">${escapeHtml(tx.type)}</span>
                    </td>
                    <td style="padding: 12px; color: var(--text-secondary);">
                      ${escapeHtml(tx.metadata?.notes || XP_TYPE_LABELS[tx.type] || tx.type)}
                    </td>
                    <td style="padding: 12px; text-align: right; font-weight: 800; font-family: var(--font-display); color: var(--accent-cyan);" class="tabular-nums">
                      +${formatXP(tx.amount)}
                    </td>
                    <td style="padding: 12px; font-size: 0.78rem; color: var(--text-muted);">
                      ${formatRelativeTime(tx.timestamp)}
                    </td>
                    <td style="padding: 12px; text-align: center;">
                      <button class="btn btn-secondary btn-sm btn-edit-tx" data-tx-id="${tx.id}">
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- Settings & Notification Preferences -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <span>⚙️</span>
            <span>Preferences & Settings</span>
          </h3>
        </div>

        <form id="form-user-settings" style="max-width: 600px;">
          <div class="form-group">
            <label class="form-label">Daily Study Streak Reminder Time</label>
            <input type="time" class="form-input" name="reminderTime" value="${user.reminderTime || '20:00'}">
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">
              PULSE will alert you to complete at least 1 Pomodoro before this time to protect your Study Streak.
            </div>
          </div>

          <div style="display: flex; gap: 12px; margin-top: 18px; flex-wrap: wrap;">
            <button type="submit" class="btn btn-primary btn-sm">Save Reminder Settings</button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-request-notif-perm">Enable Push Notifications 🔔</button>
          </div>
        </form>

        <!-- Firebase / OneSignal Config Accordion -->
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border-subtle);">
          <details>
            <summary style="cursor: pointer; font-weight: 700; font-size: 0.95rem; color: var(--text-secondary);">
              <span>🔧 Cloud Sync & Credentials Configuration</span>
              <span class="badge ${config.isFirebaseConfigured ? 'badge-emerald' : 'badge-amber'}" style="margin-left: 8px;">
                ${config.isFirebaseConfigured ? 'Firebase Connected' : 'Local Sandbox Active'}
              </span>
            </summary>

            <form id="form-cloud-config" style="margin-top: 16px;">
              <div class="form-group">
                <label class="form-label">Firebase API Key</label>
                <input type="text" class="form-input" name="apiKey" value="${escapeHtml(config.firebase.apiKey || '')}" placeholder="AIzaSy...">
              </div>
              <div class="form-group">
                <label class="form-label">Firebase Project ID</label>
                <input type="text" class="form-input" name="projectId" value="${escapeHtml(config.firebase.projectId || '')}" placeholder="pulse-app-123">
              </div>
              <div class="form-group">
                <label class="form-label">Firebase Auth Domain</label>
                <input type="text" class="form-input" name="authDomain" value="${escapeHtml(config.firebase.authDomain || '')}" placeholder="pulse-app-123.firebaseapp.com">
              </div>
              <div class="form-group">
                <label class="form-label">OneSignal App ID (Optional)</label>
                <input type="text" class="form-input" name="onesignalAppId" value="${escapeHtml(config.onesignal.appId || '')}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
              </div>
              <button type="submit" class="btn btn-primary btn-sm">Save Cloud Configuration</button>
            </form>
          </details>
        </div>
      </div>
    `;

    this.bindEvents(container, user, transactions);
  },

  bindEvents(container, user, transactions) {
    // Logout
    const logoutBtn = container.querySelector('#btn-profile-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out?')) {
          await AuthService.logout();
          SoundService.playClick();
          Toast.show({ title: 'Logged Out', message: 'See you next battle season!' });
          window.location.hash = '#dashboard';
          window.dispatchEvent(new CustomEvent('pulse_state_updated'));
        }
      });
    }

    // Edit Transaction
    container.querySelectorAll('.btn-edit-tx').forEach(btn => {
      btn.addEventListener('click', () => {
        const txId = btn.dataset.txId;
        const tx = transactions.find(t => t.id === txId);
        if (tx) {
          TransactionModal.open(tx);
        }
      });
    });

    // Save Reminder Settings
    const settingsForm = container.querySelector('#form-user-settings');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reminderTime = settingsForm.querySelector('[name="reminderTime"]').value;
        try {
          await DatabaseService.updateUserProfile(user.uid, { reminderTime });
          SoundService.playClick();
          Toast.success('Settings Saved', `Daily streak reminder updated to ${reminderTime}`);
        } catch (err) {
          Toast.error('Save Failed', err.message);
        }
      });
    }

    // Push Notification Permission
    const notifPermBtn = container.querySelector('#btn-request-notif-perm');
    if (notifPermBtn) {
      notifPermBtn.addEventListener('click', async () => {
        const granted = await NotificationService.requestPermission();
        if (granted) {
          Toast.success('Notifications Enabled!', 'You will receive battle challenges and streak alerts.');
        } else {
          Toast.error('Permission Denied', 'Browser notification permission was blocked.');
        }
      });
    }

    // Save Cloud Credentials
    const cloudForm = container.querySelector('#form-cloud-config');
    if (cloudForm) {
      cloudForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const apiKey = cloudForm.querySelector('[name="apiKey"]').value.trim();
        const projectId = cloudForm.querySelector('[name="projectId"]').value.trim();
        const authDomain = cloudForm.querySelector('[name="authDomain"]').value.trim();
        const onesignalAppId = cloudForm.querySelector('[name="onesignalAppId"]').value.trim();

        saveRuntimeConfig(
          { apiKey, projectId, authDomain },
          { appId: onesignalAppId }
        );

        Toast.success('Config Saved!', 'Reloading application to connect to Firebase...');
        setTimeout(() => window.location.reload(), 1000);
      });
    }
  }
};
