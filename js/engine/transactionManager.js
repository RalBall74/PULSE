/**
 * PULSE XP Transaction Ledger & Recalculation Manager
 * Handles ledger mutations (add, edit, delete) with deterministic cascade recalculation
 */

import { XpEngine, XP_TYPES } from './xpEngine.js';
import { StreakEngine } from './streakEngine.js';
import { generateId } from '../utils/helpers.js';

export const TransactionManager = {
  /**
   * Recalculates full user profile state from raw transaction list
   */
  recalculateUserState(transactions = [], oldProfile = {}) {
    let totalXP = 0;
    
    // Sort transactions by timestamp ascending for sequential processing
    const sortedTxs = [...transactions].sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    // Sum valid XP
    sortedTxs.forEach(tx => {
      const amt = Number(tx.amount);
      if (!isNaN(amt)) {
        totalXP += amt;
      }
    });

    // Ensure XP is non-negative
    totalXP = Math.max(0, totalXP);

    // Compute Level state
    const levelState = XpEngine.calculateLevel(totalXP);

    // Compute Streak state
    const streakState = StreakEngine.calculateStreakFromTransactions(sortedTxs);

    return {
      ...oldProfile,
      totalXP,
      level: levelState.level,
      levelState,
      currentStreak: streakState.currentStreak,
      longestStreak: Math.max(oldProfile.longestStreak || 0, streakState.longestStreak),
      lastActiveDate: streakState.lastActiveDate,
      nextMilestone: streakState.nextMilestone,
      isActiveToday: streakState.isActiveToday
    };
  },

  /**
   * Calculate total XP earned by a user within a specific time window (e.g. a weekly round)
   */
  calculateXPInWindow(transactions = [], startDate, endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    let roundXP = 0;
    transactions.forEach(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      if (txTime >= start && txTime <= end) {
        const amt = Number(tx.amount);
        if (!isNaN(amt) && tx.type !== XP_TYPES.BATTLE_WIN && tx.type !== XP_TYPES.BATTLE_CLOSE_LOSS) {
          roundXP += amt;
        }
      }
    });

    return Math.max(0, roundXP);
  },

  /**
   * Creates a standardized transaction object
   */
  createTransaction({
    userId,
    amount,
    type,
    metadata = {},
    source = 'MANUAL_QUICK_ACTION',
    timestamp = new Date().toISOString()
  }) {
    return {
      id: generateId('tx'),
      userId,
      amount: Number(amount),
      type,
      metadata,
      source,
      timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }
};
