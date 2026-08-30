/**
 * PULSE Automated Engine Verification Test Suite
 * Tests deterministic XP, Level, Streak, 1v1 Battle, and Transaction Recalculations
 */

import { XpEngine, XP_TYPES } from '../js/engine/xpEngine.js';
import { StreakEngine } from '../js/engine/streakEngine.js';
import { BattleEngine } from '../js/engine/battleEngine.js';
import { TransactionManager } from '../js/engine/transactionManager.js';
import { calculateRoundBounds, getCurrentRoundInfo, diffInCalendarDays } from '../js/utils/dateUtils.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

export function runAllTests() {
  console.log('🧪 Starting PULSE Engine Automated Verification...');

  // 1. XP & Level Calculations
  console.log('\n--- 1. Testing Level System (500 XP = 1 Level) ---');
  assert(XpEngine.calculateLevel(0).level === 1, '0 XP should be Level 1');
  assert(XpEngine.calculateLevel(499).level === 1, '499 XP should be Level 1');
  assert(XpEngine.calculateLevel(500).level === 2, '500 XP should be Level 2');
  assert(XpEngine.calculateLevel(999).level === 2, '999 XP should be Level 2');
  assert(XpEngine.calculateLevel(1000).level === 3, '1000 XP should be Level 3');
  assert(XpEngine.calculateLevel(1250).progressPercentage === 50, '1250 XP should have 50% progress in Level 3');
  assert(XpEngine.calculateLevel(1250).xpNeededForNextLevel === 250, '1250 XP should need 250 XP for Level 4');

  // 2. XP Action Values
  console.log('\n--- 2. Testing XP Action Formulas ---');
  assert(XpEngine.calculateActionXP(XP_TYPES.STUDY_HOUR) === 25, '1 continuous Study Hour = 25 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.POMODORO, { count: 1 }) === 0, '1 single Pomodoro = 0 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.POMODORO, { count: 2 }) === 25, '2 Pomodoros = 25 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.POMODORO, { count: 4 }) === 50, '4 Pomodoros = 50 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.TASK, { difficulty: 'EASY' }) === 10, 'Easy Task = 10 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.TASK, { difficulty: 'MEDIUM' }) === 20, 'Medium Task = 20 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.TASK, { difficulty: 'HARD' }) === 30, 'Hard Task = 30 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.HOMEWORK, { isPerfect: true }) === 10, 'Perfect Homework = 10 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.HOMEWORK, { isPerfect: false }) === 1, 'Imperfect Homework = 1 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.WEEKLY_EXAM, { isFullScore: true }) === 30, 'Perfect Weekly Exam = 30 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.WEEKLY_EXAM, { isFullScore: false }) === 3, 'Imperfect Weekly Exam = 3 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.MONTHLY_EXAM, { isFullScore: true }) === 75, 'Perfect Monthly Exam = 75 XP');
  assert(XpEngine.calculateActionXP(XP_TYPES.MONTHLY_EXAM, { isFullScore: false }) === 7.5, 'Imperfect Monthly Exam = 7.5 XP');

  // 3. Study Streak & Milestone Calculations
  console.log('\n--- 3. Testing Study Streak & Milestones ---');
  const now = new Date();
  const txDay1 = TransactionManager.createTransaction({ userId: 'u1', amount: 0, type: XP_TYPES.POMODORO, timestamp: new Date(now.getTime() - 2 * 86400000).toISOString() });
  const txDay2 = TransactionManager.createTransaction({ userId: 'u1', amount: 0, type: XP_TYPES.POMODORO, timestamp: new Date(now.getTime() - 1 * 86400000).toISOString() });
  const txDay3 = TransactionManager.createTransaction({ userId: 'u1', amount: 25, type: XP_TYPES.STUDY_HOUR, timestamp: now.toISOString() });

  const streakResult = StreakEngine.calculateStreakFromTransactions([txDay1, txDay2, txDay3], now);
  assert(streakResult.currentStreak === 3, '3 contiguous active days should yield current streak of 3');
  assert(streakResult.isActiveToday === true, 'Activity today should flag isActiveToday true');

  const milestoneCheck = StreakEngine.checkMilestoneUnlocked(9, 10, []);
  assert(milestoneCheck !== null && milestoneCheck.bonusXP === 50, 'Crossing day 10 milestone should award +50 XP bonus');

  // 4. 1v1 Battle Round & Fog of War Relative Calculation
  console.log('\n--- 4. Testing 1v1 Battle & Fog of War ---');
  const rel1 = BattleEngine.calculateRelativeProgress(100, 100);
  assert(rel1.userPercentage === 50 && rel1.status === 'TIED', 'Equal XP should be 50%-50% and TIED');

  const rel2 = BattleEngine.calculateRelativeProgress(150, 50);
  assert(rel2.userPercentage === 75 && rel2.status === 'LEADING', '150 vs 50 should be 75% and LEADING');

  // Round Resolution
  const resWin = BattleEngine.resolveRound(1, 300, 100, 'u1', 'u2');
  assert(resWin.winnerId === 'u1', 'Higher XP wins round');
  assert(resWin.user1BP === 200 && resWin.user1BonusXP === 200, 'Round winner receives +200 BP and +200 XP');
  assert(resWin.user2BP === 0 && resWin.user2Result === 'LOSS', 'Decisive loss receives 0 BP');

  // Close Loss Bonus
  const resClose = BattleEngine.resolveRound(1, 300, 270, 'u1', 'u2'); // diff 30 <= 50 XP margin
  assert(resClose.user2Result === 'CLOSE_LOSS', 'Losing by <= 50 XP qualifies for CLOSE_LOSS');
  assert(resClose.user2BP === 50 && resClose.user2BonusXP === 50, 'Close loss awards +50 BP and +50 XP bonus');

  // 5. Transaction Ledger Recalculation
  console.log('\n--- 5. Testing Cascade Transaction Recalculations ---');
  const txA = TransactionManager.createTransaction({ userId: 'u1', amount: 25, type: XP_TYPES.STUDY_HOUR, timestamp: now.toISOString() });
  const txB = TransactionManager.createTransaction({ userId: 'u1', amount: 30, type: XP_TYPES.TASK, timestamp: now.toISOString() });
  const userRecalc1 = TransactionManager.recalculateUserState([txA, txB]);
  assert(userRecalc1.totalXP === 55, 'Adding txs should sum total XP to 55');

  // Delete transaction txA
  const userRecalc2 = TransactionManager.recalculateUserState([txB]);
  assert(userRecalc2.totalXP === 30, 'Deleting tx should recalculate total XP accurately to 30');

  console.log(`\n========================================`);
  console.log(`🏁 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  return { passed, failed };
}

// Auto-run if running directly
if (typeof window !== 'undefined') {
  window.runPulseTests = runAllTests;
}
