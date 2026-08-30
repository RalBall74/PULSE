/**
 * PULSE 1v1 Battle Engine
 * Manages season rules, weekly rounds, concealed XP calculation (fog of war),
 * Battle Points, close loss bonuses, and season winner evaluation.
 */

import { APP_CONFIG } from '../config.js';
import { calculateRoundBounds, getCurrentRoundInfo } from '../utils/dateUtils.js';

export const BattleEngine = {
  /**
   * Evaluates relative balance during an active round without exposing opponent's exact XP
   * @param {number} userRoundXP - User's XP in this round
   * @param {number} opponentRoundXP - Opponent's XP in this round (used only for relative math)
   */
  calculateRelativeProgress(userRoundXP = 0, opponentRoundXP = 0) {
    const uXP = Math.max(0, Number(userRoundXP) || 0);
    const oXP = Math.max(0, Number(opponentRoundXP) || 0);
    const totalXP = uXP + oXP;

    let userPercentage = 50;
    let opponentPercentage = 50;
    let status = 'TIED'; // 'LEADING', 'TRAILING', 'TIED', 'CLOSE_BATTLE'
    let statusMessage = 'Evenly matched';

    if (totalXP > 0) {
      userPercentage = Number(((uXP / totalXP) * 100).toFixed(1));
      opponentPercentage = Number((100 - userPercentage).toFixed(1));
    }

    const diff = Math.abs(uXP - oXP);
    const isClose = (totalXP > 0) && (diff <= APP_CONFIG.game.battle.closeLossThresholdXP || (diff / Math.max(uXP, oXP)) <= APP_CONFIG.game.battle.closeLossThresholdPercentage);

    if (uXP > oXP) {
      status = isClose ? 'SLIGHT_LEAD' : 'LEADING';
      statusMessage = isClose ? 'Holding a slight lead' : 'Currently in the lead';
    } else if (oXP > uXP) {
      status = isClose ? 'CLOSE_BEHIND' : 'TRAILING';
      statusMessage = isClose ? 'Trailing closely behind' : 'Currently trailing';
    } else {
      status = 'TIED';
      statusMessage = totalXP === 0 ? 'Round underway — No XP logged yet' : 'Dead even match';
    }

    return {
      userPercentage,
      opponentPercentage,
      status,
      statusMessage,
      isClose
    };
  },

  /**
   * Resolves completed round results and awards Battle Points
   */
  resolveRound(roundNumber, user1XP, user2XP, user1Id, user2Id) {
    const u1XP = Math.max(0, Number(user1XP) || 0);
    const u2XP = Math.max(0, Number(user2XP) || 0);
    const diff = Math.abs(u1XP - u2XP);
    const winPoints = APP_CONFIG.game.battle.winPoints;
    const closeLossPoints = APP_CONFIG.game.battle.closeLossPoints;
    const normalLossPoints = APP_CONFIG.game.battle.normalLossPoints;

    let winnerId = null;
    let isTie = false;
    let user1BP = 0;
    let user1BonusXP = 0;
    let user2BP = 0;
    let user2BonusXP = 0;
    let user1Result = 'LOSS';
    let user2Result = 'LOSS';

    if (u1XP > u2XP) {
      winnerId = user1Id;
      user1BP = winPoints.bp;
      user1BonusXP = winPoints.xp;
      user1Result = 'WIN';

      // Check if user2 qualifies for close loss bonus
      const isClose = diff <= APP_CONFIG.game.battle.closeLossThresholdXP || (diff / u1XP) <= APP_CONFIG.game.battle.closeLossThresholdPercentage;
      if (isClose) {
        user2BP = closeLossPoints.bp;
        user2BonusXP = closeLossPoints.xp;
        user2Result = 'CLOSE_LOSS';
      } else {
        user2BP = normalLossPoints.bp;
        user2BonusXP = normalLossPoints.xp;
        user2Result = 'LOSS';
      }
    } else if (u2XP > u1XP) {
      winnerId = user2Id;
      user2BP = winPoints.bp;
      user2BonusXP = winPoints.xp;
      user2Result = 'WIN';

      // Check if user1 qualifies for close loss bonus
      const isClose = diff <= APP_CONFIG.game.battle.closeLossThresholdXP || (diff / u2XP) <= APP_CONFIG.game.battle.closeLossThresholdPercentage;
      if (isClose) {
        user1BP = closeLossPoints.bp;
        user1BonusXP = closeLossPoints.xp;
        user1Result = 'CLOSE_LOSS';
      } else {
        user1BP = normalLossPoints.bp;
        user1BonusXP = normalLossPoints.xp;
        user1Result = 'LOSS';
      }
    } else {
      // Tie
      isTie = true;
      user1BP = closeLossPoints.bp;
      user1BonusXP = closeLossPoints.xp;
      user2BP = closeLossPoints.bp;
      user2BonusXP = closeLossPoints.xp;
      user1Result = 'TIE';
      user2Result = 'TIE';
    }

    return {
      roundNumber,
      user1Id,
      user2Id,
      user1XP: u1XP,
      user2XP: u2XP,
      winnerId,
      isTie,
      user1BP,
      user1BonusXP,
      user2BP,
      user2BonusXP,
      user1Result,
      user2Result
    };
  },

  /**
   * Computes the overall season winner from resolved rounds
   */
  calculateSeasonWinner(battle, rounds = []) {
    let user1TotalBP = 0;
    let user2TotalBP = 0;
    let user1RoundsWon = 0;
    let user2RoundsWon = 0;
    let user1TotalXP = 0;
    let user2TotalXP = 0;

    rounds.forEach(r => {
      user1TotalBP += r.user1BP || 0;
      user2TotalBP += r.user2BP || 0;
      user1TotalXP += r.user1XP || 0;
      user2TotalXP += r.user2XP || 0;

      if (r.winnerId === battle.user1Id) {
        user1RoundsWon += 1;
      } else if (r.winnerId === battle.user2Id) {
        user2RoundsWon += 1;
      }
    });

    let winnerId = null;
    let winnerReason = '';

    if (user1TotalBP > user2TotalBP) {
      winnerId = battle.user1Id;
      winnerReason = 'Higher Battle Points';
    } else if (user2TotalBP > user1TotalBP) {
      winnerId = battle.user2Id;
      winnerReason = 'Higher Battle Points';
    } else {
      // Tie-breaker 1: Rounds won
      if (user1RoundsWon > user2RoundsWon) {
        winnerId = battle.user1Id;
        winnerReason = 'Tie-breaker: More Rounds Won';
      } else if (user2RoundsWon > user1RoundsWon) {
        winnerId = battle.user2Id;
        winnerReason = 'Tie-breaker: More Rounds Won';
      } else {
        // Tie-breaker 2: Total XP
        if (user1TotalXP > user2TotalXP) {
          winnerId = battle.user1Id;
          winnerReason = 'Tie-breaker: Total XP';
        } else if (user2TotalXP > user1TotalXP) {
          winnerId = battle.user2Id;
          winnerReason = 'Tie-breaker: Total XP';
        } else {
          winnerId = null; // Perfect Draw
          winnerReason = 'Dead Tie across all metrics';
        }
      }
    }

    return {
      winnerId,
      winnerReason,
      user1: {
        id: battle.user1Id,
        username: battle.user1Username,
        totalBP: user1TotalBP,
        roundsWon: user1RoundsWon,
        totalXP: user1TotalXP,
        isWinner: winnerId === battle.user1Id
      },
      user2: {
        id: battle.user2Id,
        username: battle.user2Username,
        totalBP: user2TotalBP,
        roundsWon: user2RoundsWon,
        totalXP: user2TotalXP,
        isWinner: winnerId === battle.user2Id
      },
      roundsCount: rounds.length
    };
  }
};
