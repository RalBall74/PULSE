/**
 * PULSE Battles View
 * Full season command center, comprehensive round breakdown, season score, and round history
 */

import { AuthService } from '../services/auth.js';
import { DatabaseService } from '../services/database.js';
import { VsCard } from '../components/vsCard.js';
import { InviteModal } from '../components/inviteModal.js';
import { Toast } from '../components/toast.js';
import { SoundService } from '../services/sounds.js';
import { formatDate, formatShortDate } from '../utils/dateUtils.js';
import { formatNumber, formatXP, escapeHtml } from '../utils/helpers.js';

export const BattlesView = {
  async render() {
    const container = document.getElementById('view-battles');
    if (!container) return;

    const user = AuthService.getCurrentUser();
    if (!user) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚔️</div>
          <h2 class="empty-title">1v1 Season Battles</h2>
          <p class="empty-subtitle">Sign in to view your battle arena, inspect round histories, and manage your rivalry.</p>
        </div>
      `;
      return;
    }

    if (!user.activeBattleId) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚔️</div>
          <h2 class="empty-title">No Active Battle</h2>
          <p class="empty-subtitle">You are not currently in a 1v1 battle season. Challenge a friend or accept an incoming invite to begin!</p>
          <button class="btn btn-primary btn-open-invite" style="margin-top: 12px;">
            <span>Find Opponent & Invite</span>
          </button>
        </div>
      `;

      const inviteBtn = container.querySelector('.btn-open-invite');
      if (inviteBtn) {
        inviteBtn.addEventListener('click', () => InviteModal.open());
      }
      return;
    }

    const battle = await DatabaseService.getBattle(user.activeBattleId);
    if (!battle) return;

    const opponentId = battle.user1Id === user.uid ? battle.user2Id : battle.user1Id;
    const opponent = await DatabaseService.getUserProfile(opponentId);
    const rounds = await DatabaseService.getRoundsForBattle(battle.id);
    const currentRound = rounds.find(r => r.roundNumber === battle.currentRound) || rounds[rounds.length - 1];

    const isUser1 = battle.user1Id === user.uid;
    const userRoundsWon = isUser1 ? battle.user1RoundsWon : battle.user2RoundsWon;
    const oppRoundsWon = isUser1 ? battle.user2RoundsWon : battle.user1RoundsWon;
    const userTotalBP = isUser1 ? battle.user1TotalBP : battle.user2TotalBP;
    const oppTotalBP = isUser1 ? battle.user2TotalBP : battle.user1TotalBP;

    // Render round history list (completed rounds reveal full numbers!)
    let roundsHtml = '';
    const completedRounds = rounds.filter(r => r.status === 'COMPLETED');

    if (completedRounds.length === 0) {
      roundsHtml = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">
          Round 1 is in progress! Round scores and winners will appear here upon round completion.
        </div>
      `;
    } else {
      roundsHtml = completedRounds.map(r => {
        const uXP = isUser1 ? r.user1XP : r.user2XP;
        const oXP = isUser1 ? r.user2XP : r.user1XP;
        const uBP = isUser1 ? r.user1BP : r.user2BP;
        const isWinner = r.winnerId === user.uid;
        const isCloseLoss = (isUser1 ? r.user1Result : r.user2Result) === 'CLOSE_LOSS';

        return `
          <div class="round-history-item">
            <div class="round-history-meta">
              <div class="round-num-badge">R${r.roundNumber}</div>
              <div>
                <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                  <span>${formatShortDate(r.startDate)} - ${formatShortDate(r.endDate)}</span>
                  ${isWinner ? '<span class="badge badge-emerald">🏆 Victory (+200 BP)</span>' : (isCloseLoss ? '<span class="badge badge-amber">⚡ Close Fight (+50 BP)</span>' : '<span class="badge badge-crimson">Defeat (0 BP)</span>')}
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
                  Your XP: <strong class="tabular-nums" style="color: var(--accent-cyan);">${formatXP(uXP)}</strong> vs Opponent XP: <strong class="tabular-nums" style="color: var(--player-opponent);">${formatXP(oXP)}</strong>
                </div>
              </div>
            </div>
            <div class="round-history-scores">
              <span class="tabular-nums" style="color: ${isWinner ? 'var(--accent-emerald)' : 'var(--text-secondary)'};">
                +${uBP} BP
              </span>
            </div>
          </div>
        `;
      }).join('');
    }

    container.innerHTML = `
      <!-- Full VS Arena Card -->
      ${VsCard.render({ user, opponent, battle, currentRound, isFullView: true })}

      <!-- Season Details & End Battle Actions -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 class="card-title">
            <span>📊</span>
            <span>Season 1 Competition Rules & Timeline</span>
          </h3>
          <button class="btn btn-danger btn-sm" id="btn-end-battle">
            <span>End Battle Season 🏁</span>
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; font-size: 0.88rem;">
          <div>
            <span style="color: var(--text-muted); display: block;">Start Date:</span>
            <strong>${formatDate(battle.startDate)}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">End Date:</span>
            <strong>${battle.endDate ? formatDate(battle.endDate) : 'Ongoing (Until ended manually)'}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Round Win Reward:</span>
            <strong style="color: var(--accent-emerald);">+200 XP & +200 BP</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Close Fight Bonus:</span>
            <strong style="color: var(--accent-amber);">+50 XP & +50 BP</strong>
          </div>
        </div>
      </div>

      <!-- Weekly Round History -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <span>📜</span>
            <span>Weekly Round History</span>
          </h3>
          <span class="badge badge-cyan">${completedRounds.length} Completed</span>
        </div>
        <div class="round-history-list">
          ${roundsHtml}
        </div>
      </div>
    `;

    this.bindEvents(container, battle);
  },

  bindEvents(container, battle) {
    const endBattleBtn = container.querySelector('#btn-end-battle');
    if (endBattleBtn && battle) {
      endBattleBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to conclude "${battle.name}"? The season winner will be crowned based on total Battle Points!`)) {
          try {
            endBattleBtn.disabled = true;
            endBattleBtn.textContent = 'Concluding Season...';

            const finishedBattle = await DatabaseService.endBattle(battle.id);
            SoundService.playVictory();

            const outcome = finishedBattle.seasonOutcome;
            const isWinner = outcome.winnerId === AuthService.getCurrentUser().uid;

            Toast.show({
              title: isWinner ? '🏆 SEASON VICTORY!' : '🏁 Season Concluded',
              message: isWinner ? 'You won the season rivalry!' : `${outcome.winnerReason}. Check History for details.`,
              type: 'xp',
              duration: 6000
            });

            window.dispatchEvent(new CustomEvent('pulse_state_updated'));
            window.location.hash = '#history';
          } catch (err) {
            endBattleBtn.disabled = false;
            endBattleBtn.textContent = 'End Battle Season 🏁';
            Toast.error('Failed to end battle', err.message);
          }
        }
      });
    }
  }
};
