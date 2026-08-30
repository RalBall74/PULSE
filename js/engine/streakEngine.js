/**
 * PULSE Study Streak Engine
 * Tracks daily study activity, streaks, resets, and milestone rewards
 */

import { APP_CONFIG } from '../config.js';
import { getLocalCalendarDate, diffInCalendarDays, startOfLocalDay } from '../utils/dateUtils.js';

export const StreakEngine = {
  /**
   * Recalculates streak state deterministically from a list of transactions
   * @param {Array} transactions - All user transactions
   * @param {Date} currentDate - Current reference date
   */
  calculateStreakFromTransactions(transactions = [], currentDate = new Date()) {
    if (!transactions || transactions.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        nextMilestone: APP_CONFIG.game.streak.milestoneInterval,
        isActiveToday: false,
        achievedMilestones: []
      };
    }

    // Filter transactions that qualify for daily streak (Pomodoro, Study Hour, Tasks, Homework, Exams)
    const qualifyingTypes = new Set([
      'POMODORO',
      'STUDY_HOUR',
      'TASK',
      'HOMEWORK',
      'WEEKLY_EXAM',
      'MONTHLY_EXAM'
    ]);

    // Extract unique active calendar dates (sorted ascending)
    const activeDatesSet = new Set();
    transactions.forEach(tx => {
      if (qualifyingTypes.has(tx.type)) {
        const txDate = tx.timestamp ? new Date(tx.timestamp) : new Date();
        activeDatesSet.add(getLocalCalendarDate(txDate));
      }
    });

    const activeDates = Array.from(activeDatesSet).sort();

    if (activeDates.length === 0) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
        nextMilestone: APP_CONFIG.game.streak.milestoneInterval,
        isActiveToday: false,
        achievedMilestones: []
      };
    }

    const todayStr = getLocalCalendarDate(currentDate);
    const yesterdayDate = new Date(currentDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = getLocalCalendarDate(yesterdayDate);

    const isActiveToday = activeDatesSet.has(todayStr);
    const lastActiveDateStr = activeDates[activeDates.length - 1];

    // Compute streaks by walking contiguous days
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    for (let i = 0; i < activeDates.length; i++) {
      const dateStr = activeDates[i];
      const curDate = startOfLocalDay(new Date(dateStr));

      if (!prevDate) {
        tempStreak = 1;
      } else {
        const dayDiff = diffInCalendarDays(curDate, prevDate);
        if (dayDiff === 1) {
          tempStreak += 1;
        } else if (dayDiff > 1) {
          tempStreak = 1;
        }
      }

      if (tempStreak > maxStreak) {
        maxStreak = tempStreak;
      }

      prevDate = curDate;
    }

    // Determine if the current streak is still alive:
    // It's alive if the last active date is today or yesterday.
    const lastDate = startOfLocalDay(new Date(lastActiveDateStr));
    const dayDiffFromToday = diffInCalendarDays(startOfLocalDay(currentDate), lastDate);

    if (dayDiffFromToday === 0 || dayDiffFromToday === 1) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }

    // Calculate next milestone (10, 20, 30...)
    const interval = APP_CONFIG.game.streak.milestoneInterval; // 10
    const nextMilestone = (Math.floor(currentStreak / interval) + 1) * interval;

    // Track which milestones have been hit in the historical max streak
    const achievedMilestones = [];
    for (let m = interval; m <= maxStreak; m += interval) {
      achievedMilestones.push(m);
    }

    return {
      currentStreak,
      longestStreak: Math.max(maxStreak, currentStreak),
      lastActiveDate: lastActiveDateStr,
      nextMilestone,
      isActiveToday,
      achievedMilestones
    };
  },

  /**
   * Check if a new streak milestone was just crossed and needs bonus XP
   */
  checkMilestoneUnlocked(oldStreak, newStreak, awardedMilestones = []) {
    const interval = APP_CONFIG.game.streak.milestoneInterval;
    if (newStreak <= oldStreak || newStreak < interval) return null;

    for (let m = interval; m <= newStreak; m += interval) {
      if (m > oldStreak && !awardedMilestones.includes(m)) {
        return {
          milestoneDay: m,
          bonusXP: APP_CONFIG.game.streak.milestoneBonusXP
        };
      }
    }
    return null;
  }
};
