/**
 * PULSE Dashboard View
 * Primary focus: Active 1v1 Battle Hero, Concealed Opponent Round Progress,
 * Study Streak & Level Progress, and Fast Quick Action triggers.
 */

import { AuthService } from '../services/auth.js';
import { DatabaseService } from '../services/database.js';
import { VsCard } from '../components/vsCard.js';
import { QuickXpModal } from '../components/quickXpModal.js';
import { InviteModal } from '../components/inviteModal.js';
import { XpEngine } from '../engine/xpEngine.js';
import { formatNumber, formatXP } from '../utils/helpers.js';

export const DashboardView = {
  async render() {
    const container = document.getElementById('view-dashboard');
    if (!container) return;

    const user = AuthService.getCurrentUser();
    if (!user) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚡</div>
          <h2 class="empty-title">Welcome to PULSE</h2>
          <p class="empty-subtitle">The competitive 1v1 season battle platform. Sign in to track XP, build study streaks, and crush weekly rounds.</p>
          <button class="btn btn-primary" id="btn-dashboard-auth">
            <span>Sign In / Register</span>
          </button>
        </div>
      `;

      const authBtn = container.querySelector('#btn-dashboard-auth');
      if (authBtn) {
        authBtn.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('pulse_open_auth'));
        });
      }
      return;
    }

    // Fetch active battle and opponent
    let activeBattle = null;
    let opponent = null;
    let currentRound = null;

    if (user.activeBattleId) {
      activeBattle = await DatabaseService.getBattle(user.activeBattleId);
      if (activeBattle && activeBattle.status === 'ACTIVE') {
        const opponentId = activeBattle.user1Id === user.uid ? activeBattle.user2Id : activeBattle.user1Id;
        opponent = await DatabaseService.getUserProfile(opponentId);
        
        const rounds = await DatabaseService.getRoundsForBattle(activeBattle.id);
        currentRound = rounds.find(r => r.roundNumber === activeBattle.currentRound) || rounds[rounds.length - 1];
      }
    }

    // Calculate level progression
    const levelState = XpEngine.calculateLevel(user.totalXP);

    container.innerHTML = `
      <!-- Active 1v1 Battle Hero Arena -->
      <div id="dashboard-vs-section">
        ${VsCard.render({ user, opponent, battle: activeBattle, currentRound, isFullView: false })}
      </div>

      <!-- Player Progress & Quick Actions Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-top: 24px;">
        
        <!-- Level & XP Progress Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <span>🎖️</span>
              <span>Level ${levelState.level} Progression</span>
            </h3>
            <span class="badge badge-cyan">${levelState.progressPercentage}%</span>
          </div>

          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
              <span style="color: var(--text-secondary);">Total XP</span>
              <strong class="tabular-nums" style="color: var(--accent-cyan); font-family: var(--font-display);">${formatXP(user.totalXP)} XP</strong>
            </div>
            <div style="height: 10px; border-radius: var(--radius-full); background: var(--bg-tertiary); overflow: hidden; border: 1px solid var(--border-subtle);">
              <div style="height: 100%; width: ${levelState.progressPercentage}%; background: linear-gradient(90deg, var(--accent-cyan), #8B5CF6); border-radius: var(--radius-full); transition: width 0.5s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">
              <span>Lvl ${levelState.level} (${formatXP(levelState.currentLevelBaseXP)} XP)</span>
              <span>${formatXP(levelState.xpNeededForNextLevel)} XP to Level ${levelState.level + 1}</span>
            </div>
          </div>
        </div>

        <!-- Study Streak & Milestone Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              <span class="streak-pulse">🔥</span>
              <span>Study Streak</span>
            </h3>
            <span class="badge ${user.currentStreak > 0 ? 'badge-amber' : 'badge-muted'}">
              ${user.currentStreak > 0 ? `${user.currentStreak} Days Active` : 'Streak Inactive'}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div style="background: var(--bg-primary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current Streak</div>
              <div style="font-family: var(--font-display); font-size: 1.4rem; font-weight: 800; color: var(--accent-amber);">
                ${user.currentStreak} <span style="font-size: 0.8rem;">days</span>
              </div>
            </div>
            <div style="background: var(--bg-primary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Longest Streak</div>
              <div style="font-family: var(--font-display); font-size: 1.4rem; font-weight: 800; color: var(--text-primary);">
                ${user.longestStreak || user.currentStreak} <span style="font-size: 0.8rem;">days</span>
              </div>
            </div>
          </div>
          <div style="margin-top: 10px; font-size: 0.78rem; color: var(--text-secondary); display: flex; align-items: center; justify-content: space-between;">
            <span>Next Milestone: <strong>Day ${user.nextMilestone || 10}</strong></span>
            <span class="badge badge-amber">+50 XP Bonus</span>
          </div>
        </div>
      </div>

      <!-- Fast Quick XP Logger Grid -->
      <div style="margin-top: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
            <span>⚡</span>
            <span>Quick XP Actions</span>
          </h3>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Instant 1-click achievement logging</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px;">
          <!-- Study Hour -->
          <button class="card btn-quick-action" data-action="STUDY_HOUR" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.4rem; margin-bottom: 6px;">⏱️</div>
            <div style="font-weight: 700; font-size: 0.95rem;">Study Hour</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">1 hr continuous study</div>
            <div class="badge badge-cyan" style="margin-top: 8px;">+25 XP</div>
          </button>

          <!-- Pomodoro Session -->
          <button class="card btn-quick-action" data-action="POMODORO" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.4rem; margin-bottom: 6px;">🍅</div>
            <div style="font-weight: 700; font-size: 0.95rem;">Pomodoro</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Preserves daily streak</div>
            <div class="badge badge-amber" style="margin-top: 8px;">Streak Save / +25 XP pair</div>
          </button>

          <!-- Task -->
          <button class="card btn-quick-action" data-action="TASK" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.4rem; margin-bottom: 6px;">📋</div>
            <div style="font-weight: 700; font-size: 0.95rem;">Task Completed</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Easy / Medium / Hard</div>
            <div class="badge badge-cyan" style="margin-top: 8px;">+10 - +30 XP</div>
          </button>

          <!-- Homework -->
          <button class="card btn-quick-action" data-action="HOMEWORK" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.4rem; margin-bottom: 6px;">📝</div>
            <div style="font-weight: 700; font-size: 0.95rem;">Homework</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Perfect or with mistakes</div>
            <div class="badge badge-cyan" style="margin-top: 8px;">+1 / +10 XP</div>
          </button>

          <!-- Weekly Exam -->
          <button class="card btn-quick-action" data-action="WEEKLY_EXAM" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.4rem; margin-bottom: 6px;">🏆</div>
            <div style="font-weight: 700; font-size: 0.95rem;">Weekly Exam</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Full score check</div>
            <div class="badge badge-emerald" style="margin-top: 8px;">+3 / +30 XP</div>
          </button>

          <!-- Monthly Exam -->
          <button class="card btn-quick-action" data-action="MONTHLY_EXAM" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
            <div style="font-size: 1.4rem; margin-bottom: 6px;">🎖️</div>
            <div style="font-weight: 700; font-size: 0.95rem;">Monthly Exam</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Major evaluation</div>
            <div class="badge badge-emerald" style="margin-top: 8px;">+7.5 / +75 XP</div>
          </button>
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  bindEvents(container) {
    // Quick XP actions
    container.querySelectorAll('.btn-quick-action, .btn-open-quick-xp').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action || 'STUDY_HOUR';
        QuickXpModal.open(action);
      });
    });

    // Invite opponent modal trigger
    container.querySelectorAll('.btn-open-invite').forEach(btn => {
      btn.addEventListener('click', () => {
        InviteModal.open();
      });
    });

    // Navigate to Battles view
    const goBattlesBtn = container.querySelector('.btn-go-battles');
    if (goBattlesBtn) {
      goBattlesBtn.addEventListener('click', () => {
        window.location.hash = '#battles';
      });
    }
  }
};
