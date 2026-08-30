/**
 * PULSE 1v1 Battle Invite & Setup Component
 * Search rivals, send invites, review challenges, and configure battle parameters
 */

import { DatabaseService } from '../services/database.js';
import { AuthService } from '../services/auth.js';
import { Toast } from './toast.js';
import { SoundService } from '../services/sounds.js';
import { getLocalCalendarDate } from '../utils/dateUtils.js';

let modalEl = null;

export const InviteModal = {
  init() {
    modalEl = document.getElementById('modal-invite');
    if (!modalEl) return;
    this.bindEvents();
  },

  async open() {
    if (!modalEl) this.init();
    if (!modalEl) return;

    const user = AuthService.getCurrentUser();
    if (!user) {
      Toast.error('Please log in to manage battle invites.');
      return;
    }

    modalEl.classList.add('open');
    this.resetForms();
    await this.loadPendingInvites();
  },

  close() {
    if (modalEl) modalEl.classList.remove('open');
  },

  resetForms() {
    if (!modalEl) return;
    const searchInput = modalEl.querySelector('#input-search-username');
    const searchResults = modalEl.querySelector('#invite-search-results');
    const setupSection = modalEl.querySelector('#battle-setup-section');
    const inviteSection = modalEl.querySelector('#invite-actions-section');

    if (searchInput) searchInput.value = '';
    if (searchResults) searchResults.innerHTML = '';
    if (setupSection) setupSection.style.display = 'none';
    if (inviteSection) inviteSection.style.display = 'block';
  },

  async loadPendingInvites() {
    const user = AuthService.getCurrentUser();
    if (!user || !modalEl) return;

    const container = modalEl.querySelector('#pending-invites-container');
    if (!container) return;

    try {
      const invites = await DatabaseService.getPendingInvites(user.uid);
      if (invites.length === 0) {
        container.innerHTML = `
          <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 12px 0;">
            No incoming challenges. Search for a rival above!
          </div>
        `;
        return;
      }

      container.innerHTML = invites.map(inv => `
        <div class="card" style="padding: 14px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              <span>⚔️</span>
              <span>${inv.fromUsername}</span>
              <span class="badge badge-cyan">Lvl ${inv.fromLevel || 1}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
              Challenged you to a 1v1 Season Battle
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-danger btn-sm btn-decline-invite" data-id="${inv.id}">Decline</button>
            <button class="btn btn-primary btn-sm btn-accept-invite" data-id="${inv.id}" data-user="${inv.fromUsername}">Accept</button>
          </div>
        </div>
      `).join('');

      // Bind accept / decline handlers
      container.querySelectorAll('.btn-decline-invite').forEach(btn => {
        btn.addEventListener('click', async () => {
          await this.declineInvite(btn.dataset.id);
        });
      });

      container.querySelectorAll('.btn-accept-invite').forEach(btn => {
        btn.addEventListener('click', () => {
          this.showBattleSetup(btn.dataset.id, btn.dataset.user);
        });
      });
    } catch (err) {
      console.error('Failed to load pending invites:', err);
    }
  },

  showBattleSetup(inviteId, opponentUsername) {
    const user = AuthService.getCurrentUser();
    if (!modalEl || !user) return;

    const setupSection = modalEl.querySelector('#battle-setup-section');
    const inviteSection = modalEl.querySelector('#invite-actions-section');

    if (setupSection && inviteSection) {
      inviteSection.style.display = 'none';
      setupSection.style.display = 'block';

      const nameInput = setupSection.querySelector('[name="battleName"]');
      const startInput = setupSection.querySelector('[name="startDate"]');
      const hiddenInviteInput = setupSection.querySelector('[name="acceptedInviteId"]');

      if (nameInput) nameInput.value = `${user.username} vs ${opponentUsername}`;
      if (startInput) startInput.value = getLocalCalendarDate();
      if (hiddenInviteInput) hiddenInviteInput.value = inviteId;
    }
  },

  async declineInvite(inviteId) {
    try {
      await DatabaseService.respondToInvite(inviteId, false);
      SoundService.playClick();
      Toast.show({ title: 'Challenge Declined', message: 'The invite has been removed.' });
      await this.loadPendingInvites();
    } catch (err) {
      Toast.error('Action Failed', err.message);
    }
  },

  bindEvents() {
    if (!modalEl) return;

    modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Search Username
    const searchForm = modalEl.querySelector('#form-search-user');
    const searchInput = modalEl.querySelector('#input-search-username');
    const resultsContainer = modalEl.querySelector('#invite-search-results');

    if (searchForm && searchInput && resultsContainer) {
      searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim();
        const currentUser = AuthService.getCurrentUser();
        if (!query || !currentUser) return;

        resultsContainer.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-muted);">Searching rivals...</div>';

        try {
          const user = await DatabaseService.getUserByUsername(query);
          if (!user || user.uid === currentUser.uid) {
            resultsContainer.innerHTML = `
              <div style="font-size: 0.85rem; color: var(--accent-crimson); padding: 8px 0;">
                ${user && user.uid === currentUser.uid ? 'You cannot challenge yourself.' : 'No user found with that username.'}
              </div>
            `;
            return;
          }

          resultsContainer.innerHTML = `
            <div class="card" style="padding: 14px; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 700; font-size: 0.95rem;">${user.username}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">Level ${user.level || 1} • Streak ${user.currentStreak || 0}d</div>
              </div>
              <button class="btn btn-primary btn-sm btn-send-challenge" data-uid="${user.uid}" data-username="${user.username}" data-level="${user.level || 1}">
                Challenge ⚔️
              </button>
            </div>
          `;

          const sendBtn = resultsContainer.querySelector('.btn-send-challenge');
          if (sendBtn) {
            sendBtn.addEventListener('click', async () => {
              try {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending...';
                await DatabaseService.sendBattleInvite(currentUser, user);
                SoundService.playClick();
                Toast.success('Challenge Sent!', `Battle invite sent to ${user.username}`);
                resultsContainer.innerHTML = `
                  <div style="font-size: 0.85rem; color: var(--accent-emerald); padding: 8px 0;">
                    ✓ Invite sent to ${user.username}! Waiting for acceptance.
                  </div>
                `;
              } catch (err) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Challenge ⚔️';
                Toast.error('Invite Failed', err.message);
              }
            });
          }
        } catch (err) {
          resultsContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--accent-crimson);">${err.message}</div>`;
        }
      });
    }

    // Battle Setup Form Submission
    const setupForm = modalEl.querySelector('#form-battle-setup');
    if (setupForm) {
      setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inviteId = setupForm.querySelector('[name="acceptedInviteId"]').value;
        const name = setupForm.querySelector('[name="battleName"]').value.trim();
        const startDate = setupForm.querySelector('[name="startDate"]').value;
        const endDate = setupForm.querySelector('[name="endDate"]').value || null;

        try {
          await DatabaseService.respondToInvite(inviteId, true, {
            name: name || '1v1 Season Battle',
            startDate,
            endDate
          });

          SoundService.playVictory();
          Toast.show({
            title: '⚔️ BATTLE SEASON ACTIVATED!',
            message: 'Your 1v1 rivalry has commenced. Good luck in Round 1!',
            type: 'xp'
          });

          this.close();
          window.dispatchEvent(new CustomEvent('pulse_state_updated'));
          window.location.hash = '#battles';
        } catch (err) {
          Toast.error('Battle Activation Failed', err.message);
        }
      });

      const cancelSetupBtn = setupForm.querySelector('#btn-cancel-setup');
      if (cancelSetupBtn) {
        cancelSetupBtn.addEventListener('click', () => {
          this.resetForms();
          this.loadPendingInvites();
        });
      }
    }
  }
};
