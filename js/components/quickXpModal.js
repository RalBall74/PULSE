/**
 * PULSE Quick XP Action Component
 * Fast manual achievement logger for Study Hours, Pomodoros, Tasks, Homework, and Exams
 */

import { XpEngine, XP_TYPES } from '../engine/xpEngine.js';
import { TransactionManager } from '../engine/transactionManager.js';
import { DatabaseService } from '../services/database.js';
import { AuthService } from '../services/auth.js';
import { Toast } from './toast.js';
import { SoundService } from '../services/sounds.js';
import { StreakEngine } from '../engine/streakEngine.js';

let modalEl = null;

export const QuickXpModal = {
  init() {
    modalEl = document.getElementById('modal-quick-xp');
    if (!modalEl) return;

    this.bindEvents();
  },

  open(defaultAction = 'STUDY_HOUR') {
    if (!modalEl) this.init();
    if (!modalEl) return;

    const user = AuthService.getCurrentUser();
    if (!user) {
      Toast.error('Please log in first to log XP.');
      return;
    }

    this.selectTab(defaultAction);
    modalEl.classList.add('open');
  },

  close() {
    if (modalEl) modalEl.classList.remove('open');
  },

  selectTab(actionType) {
    if (!modalEl) return;
    const tabs = modalEl.querySelectorAll('.xp-action-tab');
    const forms = modalEl.querySelectorAll('.xp-form-panel');

    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.action === actionType);
    });

    forms.forEach(panel => {
      panel.style.display = panel.dataset.action === actionType ? 'block' : 'none';
    });
  },

  bindEvents() {
    if (!modalEl) return;

    // Close button and backdrop
    modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    // Tab switching
    modalEl.querySelectorAll('.xp-action-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        SoundService.playClick();
        this.selectTab(tab.dataset.action);
      });
    });

    // 1. Study Hour Log
    const formStudyHour = modalEl.querySelector('#form-study-hour');
    if (formStudyHour) {
      formStudyHour.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hours = Number(formStudyHour.querySelector('[name="hours"]').value) || 1;
        const notes = formStudyHour.querySelector('[name="notes"]').value.trim();
        const xp = hours * 25;

        await this.submitXP({
          type: XP_TYPES.STUDY_HOUR,
          amount: xp,
          metadata: { hours, notes: notes || `${hours} hr study session` }
        });
      });
    }

    // 2. Pomodoro Log
    const formPomodoro = modalEl.querySelector('#form-pomodoro');
    if (formPomodoro) {
      formPomodoro.addEventListener('submit', async (e) => {
        e.preventDefault();
        const count = Number(formPomodoro.querySelector('[name="count"]').value) || 1;
        const notes = formPomodoro.querySelector('[name="notes"]').value.trim();
        const xp = XpEngine.calculateActionXP(XP_TYPES.POMODORO, { count });

        await this.submitXP({
          type: XP_TYPES.POMODORO,
          amount: xp,
          metadata: {
            count,
            notes: notes || `${count} Pomodoro session${count > 1 ? 's' : ''}`
          }
        });
      });
    }

    // 3. Task Log
    const formTask = modalEl.querySelector('#form-task');
    if (formTask) {
      formTask.addEventListener('submit', async (e) => {
        e.preventDefault();
        const difficulty = formTask.querySelector('[name="difficulty"]:checked')?.value || 'MEDIUM';
        const notes = formTask.querySelector('[name="notes"]').value.trim();
        const xp = XpEngine.calculateActionXP(XP_TYPES.TASK, { difficulty });

        await this.submitXP({
          type: XP_TYPES.TASK,
          amount: xp,
          metadata: { difficulty, notes: notes || `${difficulty} Task` }
        });
      });
    }

    // 4. Homework Log
    const formHomework = modalEl.querySelector('#form-homework');
    if (formHomework) {
      formHomework.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isPerfect = formHomework.querySelector('[name="isPerfect"]:checked')?.value === 'true';
        const notes = formHomework.querySelector('[name="notes"]').value.trim();
        const xp = XpEngine.calculateActionXP(XP_TYPES.HOMEWORK, { isPerfect });

        await this.submitXP({
          type: XP_TYPES.HOMEWORK,
          amount: xp,
          metadata: { isPerfect, notes: notes || `Homework (${isPerfect ? 'Perfect' : 'With Mistakes'})` }
        });
      });
    }

    // 5. Weekly Exam Log
    const formWeeklyExam = modalEl.querySelector('#form-weekly-exam');
    if (formWeeklyExam) {
      formWeeklyExam.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isFullScore = formWeeklyExam.querySelector('[name="isFullScore"]:checked')?.value === 'true';
        const notes = formWeeklyExam.querySelector('[name="notes"]').value.trim();
        const xp = XpEngine.calculateActionXP(XP_TYPES.WEEKLY_EXAM, { isFullScore });

        await this.submitXP({
          type: XP_TYPES.WEEKLY_EXAM,
          amount: xp,
          metadata: { isFullScore, notes: notes || `Weekly Exam (${isFullScore ? 'Full Score' : 'Partial Score'})` }
        });
      });
    }

    // 6. Monthly Exam Log
    const formMonthlyExam = modalEl.querySelector('#form-monthly-exam');
    if (formMonthlyExam) {
      formMonthlyExam.addEventListener('submit', async (e) => {
        e.preventDefault();
        const isFullScore = formMonthlyExam.querySelector('[name="isFullScore"]:checked')?.value === 'true';
        const notes = formMonthlyExam.querySelector('[name="notes"]').value.trim();
        const xp = XpEngine.calculateActionXP(XP_TYPES.MONTHLY_EXAM, { isFullScore });

        await this.submitXP({
          type: XP_TYPES.MONTHLY_EXAM,
          amount: xp,
          metadata: { isFullScore, notes: notes || `Monthly Exam (${isFullScore ? 'Full Score' : 'Partial Score'})` }
        });
      });
    }
  },

  async submitXP({ type, amount, metadata = {} }) {
    const user = AuthService.getCurrentUser();
    if (!user) return;

    try {
      const prevLevel = user.level || 1;
      const prevStreak = user.currentStreak || 0;

      const tx = TransactionManager.createTransaction({
        userId: user.uid,
        amount,
        type,
        metadata,
        source: 'MANUAL_QUICK_ACTION'
      });

      await DatabaseService.addTransaction(tx);
      const updatedProfile = await DatabaseService.getUserProfile(user.uid);

      this.close();

      // Spawn visual feedback
      if (amount > 0) {
        Toast.spawnXpFloater(amount);
      } else {
        SoundService.playClick();
      }

      Toast.success('Achievement Logged!', `${metadata.notes || type} recorded (+${amount} XP)`);

      // Check level up celebration
      if (updatedProfile && updatedProfile.level > prevLevel) {
        setTimeout(() => {
          SoundService.playLevelUp();
          Toast.show({
            title: `🎖️ LEVEL UP! Reached Level ${updatedProfile.level}`,
            message: 'Your competitive prowess is growing!',
            type: 'xp',
            duration: 5000
          });
        }, 500);
      }

      // Check streak milestone celebration (+50 XP)
      if (updatedProfile) {
        const milestoneHit = StreakEngine.checkMilestoneUnlocked(prevStreak, updatedProfile.currentStreak, []);
        if (milestoneHit) {
          setTimeout(async () => {
            const milestoneTx = TransactionManager.createTransaction({
              userId: user.uid,
              amount: milestoneHit.bonusXP,
              type: XP_TYPES.STREAK_MILESTONE,
              metadata: { milestoneDay: milestoneHit.milestoneDay, notes: `${milestoneHit.milestoneDay}-Day Study Streak Milestone!` }
            });
            await DatabaseService.addTransaction(milestoneTx);
            Toast.spawnXpFloater(milestoneHit.bonusXP);
            Toast.show({
              title: `🔥 ${milestoneHit.milestoneDay}-DAY STREAK MILESTONE!`,
              message: `Incredible consistency! Awarded +${milestoneHit.bonusXP} XP`,
              type: 'xp',
              duration: 5000
            });
          }, 800);
        }
      }

      // Trigger global UI re-render event
      window.dispatchEvent(new CustomEvent('pulse_state_updated'));
    } catch (err) {
      console.error('Failed to log XP:', err);
      Toast.error('Submission Failed', err.message);
    }
  }
};
