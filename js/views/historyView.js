/**
 * PULSE Battle History View
 * Displays completed battles archive with detailed final season breakdowns and performance recaps
 */

import { AuthService } from '../services/auth.js';
import { DatabaseService } from '../services/database.js';
import { formatDate, formatShortDate } from '../utils/dateUtils.js';
import { formatNumber, formatXP, escapeHtml } from '../utils/helpers.js';

let selectedBattleModal = null;

export const HistoryView = {
  async render() {
    const container = document.getElementById('view-history');
    if (!container) return;

    const user = AuthService.getCurrentUser();
    if (!user) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <h2 class="empty-title">Battle History</h2>
          <p class="empty-subtitle">Sign in to view your past competitive season battles and trophies.</p>
        </div>
      `;
      return;
    }

    const historyBattles = await DatabaseService.getUserBattleHistory(user.uid);

    if (historyBattles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <h2 class="empty-title">No Battles Yet</h2>
          <p class="empty-subtitle">Completed season rivalries will be archived here with detailed round recaps and Battle Points.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <h3 class="card-title">
            <span class="trophy-shimmer">🏆</span>
            <span>Season Battle History (${historyBattles.length})</span>
          </h3>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Career Record: <strong>${user.wins || 0}W - ${user.losses || 0}L</strong></span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${historyBattles.map(b => {
            const isUser1 = b.user1Id === user.uid;
            const oppName = isUser1 ? b.user2Username : b.user1Username;
            const userBP = isUser1 ? b.user1TotalBP : b.user2TotalBP;
            const oppBP = isUser1 ? b.user2TotalBP : b.user1TotalBP;
            const userRounds = isUser1 ? b.user1RoundsWon : b.user2RoundsWon;
            const oppRounds = isUser1 ? b.user2RoundsWon : b.user1RoundsWon;
            const isWinner = b.winnerId === user.uid;

            return `
              <div class="card battle-history-card" data-battle-id="${b.id}" style="cursor: pointer; padding: 18px; border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <div style="font-size: 2rem;">${isWinner ? '🏆' : '🏁'}</div>
                  <div>
                    <div style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 8px;">
                      <span>${escapeHtml(b.name)}</span>
                      ${isWinner ? '<span class="badge badge-emerald">VICTORY</span>' : '<span class="badge badge-crimson">DEFEAT</span>'}
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 3px;">
                      vs <strong>${escapeHtml(oppName)}</strong> • ${formatDate(b.startDate)} - ${b.endedAt ? formatDate(b.endedAt) : 'Concluded'}
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 24px;">
                  <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Battle Points</div>
                    <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; color: var(--accent-cyan);">
                      ${formatNumber(userBP)} <span style="font-size: 0.8rem; color: var(--text-muted);">vs</span> ${formatNumber(oppBP)}
                    </div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Rounds</div>
                    <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.1rem;">
                      ${userRounds}W - ${oppRounds}L
                    </div>
                  </div>
                  <button class="btn btn-secondary btn-sm">Inspect 🔍</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    container.querySelectorAll('.battle-history-card').forEach(card => {
      card.addEventListener('click', async () => {
        const battleId = card.dataset.battleId;
        await this.showBattleDetailsModal(battleId);
      });
    });
  },

  async showBattleDetailsModal(battleId) {
    const user = AuthService.getCurrentUser();
    const battle = await DatabaseService.getBattle(battleId);
    if (!battle || !user) return;

    const rounds = await DatabaseService.getRoundsForBattle(battleId);
    const isUser1 = battle.user1Id === user.uid;
    const oppName = isUser1 ? battle.user2Username : battle.user1Username;
    const isWinner = battle.winnerId === user.uid;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <div class="modal-title">🏆 Season Final Results</div>
          <button class="btn-close">&times;</button>
        </div>

        <div style="text-align: center; padding: 16px 0 24px;">
          <div style="font-size: 3rem; margin-bottom: 8px;">${isWinner ? '🏆' : '🎖️'}</div>
          <h2 style="font-size: 1.4rem;">${escapeHtml(battle.name)}</h2>
          <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 4px;">
            Winner: <strong style="color: var(--accent-amber);">${escapeHtml(battle.winnerId === user.uid ? user.username : oppName)}</strong> (${battle.winnerReason || 'Battle Points Superiority'})
          </div>
        </div>

        <!-- Standings Grid -->
        <div class="season-score-grid" style="margin-bottom: 20px;">
          <div class="score-card-item">
            <span class="score-card-label">Your Final BP</span>
            <span class="score-card-value tabular-nums" style="color: var(--accent-cyan);">${formatNumber(isUser1 ? battle.user1TotalBP : battle.user2TotalBP)} BP</span>
            <span class="score-card-sub">${isUser1 ? battle.user1RoundsWon : battle.user2RoundsWon} rounds won</span>
          </div>
          <div class="score-card-item">
            <span class="score-card-label">${escapeHtml(oppName)} Final BP</span>
            <span class="score-card-value tabular-nums" style="color: var(--player-opponent);">${formatNumber(isUser1 ? battle.user2TotalBP : battle.user1TotalBP)} BP</span>
            <span class="score-card-sub">${isUser1 ? battle.user2RoundsWon : battle.user1RoundsWon} rounds won</span>
          </div>
        </div>

        <!-- Round by Round Breakdown -->
        <div style="font-weight: 700; margin-bottom: 10px; font-size: 0.95rem;">Round by Round Timeline:</div>
        <div class="round-history-list" style="max-height: 240px; overflow-y: auto;">
          ${rounds.map(r => {
            const uXP = isUser1 ? r.user1XP : r.user2XP;
            const oXP = isUser1 ? r.user2XP : r.user1XP;
            const uBP = isUser1 ? r.user1BP : r.user2BP;
            const rWon = r.winnerId === user.uid;

            return `
              <div class="round-history-item" style="padding: 10px 14px;">
                <div class="round-history-meta">
                  <div class="round-num-badge" style="width: 28px; height: 28px; font-size: 0.8rem;">R${r.roundNumber}</div>
                  <div style="font-size: 0.82rem;">
                    <strong>${rWon ? '🏆 Won' : 'Defeat'}</strong> (${formatXP(uXP)} vs ${formatXP(oXP)} XP)
                  </div>
                </div>
                <div class="tabular-nums" style="font-weight: 700; font-size: 0.9rem; color: ${rWon ? 'var(--accent-emerald)' : 'var(--text-muted)'};">
                  +${uBP} BP
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <button class="btn btn-secondary btn-block btn-close-details" style="margin-top: 20px;">Close Recap</button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('.btn-close').addEventListener('click', closeModal);
    modal.querySelector('.btn-close-details').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
};
