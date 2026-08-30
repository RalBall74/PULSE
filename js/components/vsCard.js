/**
 * PULSE 1v1 VS Card Component
 * Renders face-to-face season rivalry arena, hidden opponent XP fog-of-war bar,
 * and current round battle balance.
 */

import { BattleEngine } from '../engine/battleEngine.js';
import { getCurrentRoundInfo, formatDate } from '../utils/dateUtils.js';
import { formatNumber, formatXP, escapeHtml } from '../utils/helpers.js';

export const VsCard = {
  render({ user, opponent, battle, currentRound, isFullView = false }) {
    if (!battle || !opponent) {
      return `
        <div class="empty-state">
          <div class="empty-icon">⚔️</div>
          <h3 class="empty-title">Ready for a New Rivalry?</h3>
          <p class="empty-subtitle">Challenge a friend to a 1v1 season-long battle. Earn XP, conquer weekly rounds, and claim Battle Points!</p>
          <button class="btn btn-primary btn-open-invite">
            <span>Find Opponent & Invite</span>
          </button>
        </div>
      `;
    }

    const roundInfo = getCurrentRoundInfo(battle.startDate, battle.endDate);
    const isUser1 = battle.user1Id === user.uid;

    const userRoundXP = currentRound ? (isUser1 ? currentRound.user1XP : currentRound.user2XP) : 0;
    const opponentRoundXP = currentRound ? (isUser1 ? currentRound.user2XP : currentRound.user1XP) : 0;

    const userTotalBP = isUser1 ? battle.user1TotalBP : battle.user2TotalBP;
    const oppTotalBP = isUser1 ? battle.user2TotalBP : battle.user1TotalBP;

    const userRoundsWon = isUser1 ? battle.user1RoundsWon : battle.user2RoundsWon;
    const oppRoundsWon = isUser1 ? battle.user2RoundsWon : battle.user1RoundsWon;

    // Calculate concealed relative progress (Fog of War)
    const relProgress = BattleEngine.calculateRelativeProgress(userRoundXP, opponentRoundXP);

    return `
      <div class="battle-arena-card">
        <!-- 1v1 Face-to-Face Section -->
        <div class="vs-container">
          <!-- YOU -->
          <div class="player-card you">
            <div class="player-avatar you">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
            <div class="player-info">
              <div class="player-name-row">
                <span class="player-name">${escapeHtml(user.username)}</span>
                <span class="badge badge-cyan">YOU</span>
              </div>
              <div class="player-stats-row">
                <span class="stat-pill">Lvl ${user.level}</span>
                <span>•</span>
                <span class="stat-pill tabular-nums">${formatXP(user.totalXP)} XP</span>
                <span>•</span>
                <span class="stat-pill streak-pulse">🔥 ${user.currentStreak}d</span>
              </div>
            </div>
          </div>

          <!-- VS EMBLEM -->
          <div class="vs-emblem">
            <div class="vs-badge">VS</div>
          </div>

          <!-- OPPONENT -->
          <div class="player-card opponent">
            <div class="player-avatar opponent">${escapeHtml(opponent.username.charAt(0).toUpperCase())}</div>
            <div class="player-info">
              <div class="player-name-row">
                <span class="badge badge-amber">RIVAL</span>
                <span class="player-name">${escapeHtml(opponent.username)}</span>
              </div>
              <div class="player-stats-row">
                <span class="stat-pill streak-pulse">🔥 ${opponent.currentStreak}d</span>
                <span>•</span>
                <span class="stat-pill tabular-nums">${formatXP(opponent.totalXP)} XP</span>
                <span>•</span>
                <span class="stat-pill">Lvl ${opponent.level}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Current Round Fog-of-War Relative Progress -->
        <div class="round-battle-bar-container">
          <div class="battle-bar-header">
            <div class="round-badge-group">
              <span class="badge badge-cyan">Round ${roundInfo.roundNumber}</span>
              <span class="round-status-text">${escapeHtml(relProgress.statusMessage)}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">
              ${roundInfo.daysRemaining} days left in round
            </div>
          </div>

          <!-- Relative Progress Track (Concealed Opponent XP) -->
          <div class="relative-progress-track">
            <div class="progress-segment-you" style="width: ${relProgress.userPercentage}%;">
              ${relProgress.userPercentage > 15 ? `${relProgress.userPercentage}%` : ''}
            </div>
            <div class="progress-segment-opponent" style="width: ${relProgress.opponentPercentage}%;">
              ${relProgress.opponentPercentage > 15 ? `${relProgress.opponentPercentage}%` : ''}
            </div>
          </div>

          <div class="battle-bar-footer">
            <span>Your Round XP: <strong class="tabular-nums" style="color: var(--accent-cyan);">${formatXP(userRoundXP)} XP</strong></span>
            <span style="font-style: italic; color: var(--text-muted);">Opponent XP is concealed until round conclusion</span>
          </div>
        </div>

        <!-- Season Battle Points & Standing -->
        <div class="season-score-grid">
          <div class="score-card-item">
            <span class="score-card-label">Your Battle Points</span>
            <span class="score-card-value tabular-nums" style="color: var(--accent-cyan);">${formatNumber(userTotalBP)} <span style="font-size: 0.9rem;">BP</span></span>
            <span class="score-card-sub">${userRoundsWon} round${userRoundsWon === 1 ? '' : 's'} won</span>
          </div>
          <div class="score-card-item">
            <span class="score-card-label">Opponent Battle Points</span>
            <span class="score-card-value tabular-nums" style="color: var(--player-opponent);">${formatNumber(oppTotalBP)} <span style="font-size: 0.9rem;">BP</span></span>
            <span class="score-card-sub">${oppRoundsWon} round${oppRoundsWon === 1 ? '' : 's'} won</span>
          </div>
          <div class="score-card-item">
            <span class="score-card-label">Battle Season</span>
            <span class="score-card-value" style="font-size: 1.1rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(battle.name)}
            </span>
            <span class="score-card-sub">Started ${formatDate(battle.startDate)}</span>
          </div>
        </div>

        ${!isFullView ? `
          <div style="display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm btn-go-battles">
              <span>View Full Season Statistics →</span>
            </button>
            <button class="btn btn-primary btn-sm btn-open-quick-xp">
              <span>+ Log Study XP</span>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }
};
