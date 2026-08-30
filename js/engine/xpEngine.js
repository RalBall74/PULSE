/**
 * PULSE XP & Level Calculation Engine
 * Pure, deterministic mathematical formulas for XP, levels, and achievements
 */

import { APP_CONFIG } from '../config.js';

export const XP_TYPES = {
  STUDY_HOUR: 'STUDY_HOUR',
  POMODORO: 'POMODORO',
  TASK: 'TASK',
  HOMEWORK: 'HOMEWORK',
  WEEKLY_EXAM: 'WEEKLY_EXAM',
  MONTHLY_EXAM: 'MONTHLY_EXAM',
  STREAK_MILESTONE: 'STREAK_MILESTONE',
  BATTLE_WIN: 'BATTLE_WIN',
  BATTLE_CLOSE_LOSS: 'BATTLE_CLOSE_LOSS'
};

export const XP_TYPE_LABELS = {
  STUDY_HOUR: 'Study Hour (1 hr continuous)',
  POMODORO: 'Pomodoro Session',
  TASK: 'Task Completion',
  HOMEWORK: 'Homework Assignment',
  WEEKLY_EXAM: 'Weekly Exam',
  MONTHLY_EXAM: 'Monthly Exam',
  STREAK_MILESTONE: '10-Day Streak Milestone',
  BATTLE_WIN: 'Round Victory Reward',
  BATTLE_CLOSE_LOSS: 'Close Fight Bonus'
};

export const XpEngine = {
  /**
   * Deterministic Level Calculation:
   * Every 500 XP = +1 Level
   * 0 - 499 XP -> Level 1
   * 500 - 999 XP -> Level 2
   * 1000 - 1499 XP -> Level 3
   */
  calculateLevel(totalXP = 0) {
    const validXP = Math.max(0, Number(totalXP) || 0);
    const xpPerLevel = APP_CONFIG.game.xpPerLevel; // 500
    
    const level = Math.floor(validXP / xpPerLevel) + 1;
    const currentLevelBaseXP = (level - 1) * xpPerLevel;
    const nextLevelBaseXP = level * xpPerLevel;
    const currentLevelProgressXP = validXP - currentLevelBaseXP;
    const xpNeededForNextLevel = nextLevelBaseXP - validXP;
    const progressPercentage = Math.min(100, Math.max(0, (currentLevelProgressXP / xpPerLevel) * 100));

    return {
      level,
      totalXP: validXP,
      currentLevelBaseXP,
      nextLevelBaseXP,
      currentLevelProgressXP,
      xpNeededForNextLevel,
      progressPercentage: Number(progressPercentage.toFixed(1))
    };
  },

  /**
   * Calculate XP awarded for specific action types and options
   */
  calculateActionXP(type, options = {}) {
    const values = APP_CONFIG.game.xpValues;

    switch (type) {
      case XP_TYPES.STUDY_HOUR:
        // 1 continuous hour = +25 XP
        return values.STUDY_HOUR;

      case XP_TYPES.POMODORO:
        // 1 Pomodoro = 0 XP; 2 Pomodoros = +25 XP
        // options.count is number of pomodoros being submitted
        const count = Math.max(1, Number(options.count) || 1);
        return Math.floor(count / 2) * values.POMODORO_PAIR;

      case XP_TYPES.TASK:
        // Easy = 10, Medium = 20, Hard = 30
        const diff = (options.difficulty || 'MEDIUM').toUpperCase();
        if (diff === 'EASY') return values.TASK_EASY;
        if (diff === 'HARD') return values.TASK_HARD;
        return values.TASK_MEDIUM;

      case XP_TYPES.HOMEWORK:
        // Perfect = 10, Imperfect = 1
        return options.isPerfect ? values.HOMEWORK_PERFECT : values.HOMEWORK_IMPERFECT;

      case XP_TYPES.WEEKLY_EXAM:
        // Full score = 30, Not full = 3
        return options.isFullScore ? values.WEEKLY_EXAM_PERFECT : values.WEEKLY_EXAM_IMPERFECT;

      case XP_TYPES.MONTHLY_EXAM:
        // Full score = 75, Not full = 7.5
        return options.isFullScore ? values.MONTHLY_EXAM_PERFECT : values.MONTHLY_EXAM_IMPERFECT;

      case XP_TYPES.STREAK_MILESTONE:
        // Milestone reached = +50 XP
        return values.STREAK_MILESTONE_10_DAYS;

      case XP_TYPES.BATTLE_WIN:
        return APP_CONFIG.game.battle.winPoints.xp; // 200

      case XP_TYPES.BATTLE_CLOSE_LOSS:
        return APP_CONFIG.game.battle.closeLossPoints.xp; // 50

      default:
        return Number(options.customAmount) || 0;
    }
  }
};
