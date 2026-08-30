/**
 * PULSE Standalone Unified Bundle
 * Pure Vanilla JavaScript - Works both on file:/// protocol and HTTP/HTTPS servers
 */

(function (window, document) {
  'use strict';

  // ==========================================
  // 1. CONFIGURATION
  // ==========================================
  const APP_CONFIG = {
    appName: 'PULSE',
    tagline: 'Competitive 1v1 Season Battle & XP Tracker',
    version: '1.0.0',
    game: {
      xpPerLevel: 500,
      xpValues: {
        STUDY_HOUR: 25,
        POMODORO_SINGLE: 0,
        POMODORO_PAIR: 25,
        TASK_EASY: 10,
        TASK_MEDIUM: 20,
        TASK_HARD: 30,
        HOMEWORK_PERFECT: 10,
        HOMEWORK_IMPERFECT: 1,
        WEEKLY_EXAM_PERFECT: 30,
        WEEKLY_EXAM_IMPERFECT: 3,
        MONTHLY_EXAM_PERFECT: 75,
        MONTHLY_EXAM_IMPERFECT: 7.5,
        STREAK_MILESTONE_10_DAYS: 50
      },
      streak: {
        milestoneInterval: 10,
        milestoneBonusXP: 50,
        minPomodorosForDailyStreak: 1
      },
      battle: {
        roundDurationDays: 7,
        winPoints: { bp: 200, xp: 200 },
        closeLossPoints: { bp: 50, xp: 50 },
        normalLossPoints: { bp: 0, xp: 0 },
        closeLossThresholdPercentage: 0.15,
        closeLossThresholdXP: 50
      }
    },
    firebase: {
      apiKey: "AIzaSyCnHveI12UfUOT7wjWBx9ayt3mNhDXL4xg",
      authDomain: "pulse-tadfuq.firebaseapp.com",
      projectId: "pulse-tadfuq",
      storageBucket: "pulse-tadfuq.firebasestorage.app",
      messagingSenderId: "313190697881",
      appId: "1:313190697881:web:b96e24821f9233f7afa108",
      measurementId: "G-DV0BN3FDMG"
    },
    onesignal: {
      appId: "",
      safariWebId: "",
      allowLocalhostAsSecureOrigin: true
    }
  };

  function getRuntimeConfig() {
    const savedConfig = localStorage.getItem('pulse_runtime_config');
    let runtimeFirebase = APP_CONFIG.firebase;
    let runtimeOneSignal = APP_CONFIG.onesignal;

    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        if (parsed.firebase) runtimeFirebase = { ...runtimeFirebase, ...parsed.firebase };
        if (parsed.onesignal) runtimeOneSignal = { ...runtimeOneSignal, ...parsed.onesignal };
      } catch (e) {}
    }

    if (typeof window !== 'undefined' && window.PULSE_CONFIG) {
      if (window.PULSE_CONFIG.firebase) runtimeFirebase = { ...runtimeFirebase, ...window.PULSE_CONFIG.firebase };
      if (window.PULSE_CONFIG.onesignal) runtimeOneSignal = { ...runtimeOneSignal, ...window.PULSE_CONFIG.onesignal };
    }

    return {
      ...APP_CONFIG,
      firebase: runtimeFirebase,
      onesignal: runtimeOneSignal,
      isFirebaseConfigured: Boolean(runtimeFirebase.apiKey && runtimeFirebase.projectId),
      isOneSignalConfigured: Boolean(runtimeOneSignal.appId && runtimeOneSignal.appId !== 'your_onesignal_app_id_here')
    };
  }

  function saveRuntimeConfig(firebaseConfig, onesignalConfig) {
    const payload = {
      firebase: firebaseConfig || {},
      onesignal: onesignalConfig || {}
    };
    localStorage.setItem('pulse_runtime_config', JSON.stringify(payload));
  }

  // ==========================================
  // 2. STORAGE WRAPPER
  // ==========================================
  const STORAGE_PREFIX = 'pulse_app_';
  const Storage = {
    get(key, defaultValue = null) {
      try {
        const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (item === null) return defaultValue;
        return JSON.parse(item);
      } catch (e) {
        return defaultValue;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        return true;
      } catch (e) {
        return false;
      }
    }
  };

  // ==========================================
  // 3. UTILITIES & HELPERS
  // ==========================================
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
  }

  function safeHash(str) {
    if (!str) return '';
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return String(hash);
    }
  }

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString();
  }

  function formatXP(xp) {
    if (xp === null || xp === undefined || isNaN(xp)) return '0';
    const num = Number(xp);
    return num % 1 === 0 ? num.toLocaleString() : num.toFixed(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getLocalCalendarDate(date = new Date()) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function startOfLocalDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function endOfLocalDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function diffInCalendarDays(dateA, dateB) {
    const startA = startOfLocalDay(dateA).getTime();
    const startB = startOfLocalDay(dateB).getTime();
    return Math.round((startA - startB) / (1000 * 60 * 60 * 24));
  }

  function calculateRoundBounds(battleStartDate, roundNumber = 1) {
    const battleStart = startOfLocalDay(new Date(battleStartDate));
    const roundStart = new Date(battleStart);
    roundStart.setDate(battleStart.getDate() + (roundNumber - 1) * 7);

    const roundEnd = new Date(roundStart);
    roundEnd.setDate(roundStart.getDate() + 6);
    roundEnd.setHours(23, 59, 59, 999);

    return {
      roundNumber,
      startDate: roundStart.toISOString(),
      endDate: roundEnd.toISOString(),
      startFormatted: formatShortDate(roundStart),
      endFormatted: formatShortDate(roundEnd)
    };
  }

  function getCurrentRoundInfo(battleStartDate, battleEndDate = null, currentDate = new Date()) {
    const start = startOfLocalDay(new Date(battleStartDate));
    const now = new Date(currentDate);

    if (now < start) {
      return {
        ...calculateRoundBounds(battleStartDate, 1),
        status: 'UPCOMING',
        daysRemaining: diffInCalendarDays(start, now),
        isFinished: false
      };
    }

    const daysPassed = diffInCalendarDays(now, start);
    const roundNumber = Math.max(1, Math.floor(daysPassed / 7) + 1);
    const roundBounds = calculateRoundBounds(battleStartDate, roundNumber);

    let isBattleFinished = false;
    if (battleEndDate) {
      const end = endOfLocalDay(new Date(battleEndDate));
      if (now > end) isBattleFinished = true;
    }

    const roundEnd = new Date(roundBounds.endDate);
    const daysLeftInRound = Math.max(0, diffInCalendarDays(roundEnd, now));

    return {
      ...roundBounds,
      status: isBattleFinished ? 'COMPLETED' : 'ACTIVE',
      daysRemaining: daysLeftInRound,
      isFinished: isBattleFinished
    };
  }

  function formatDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatShortDate(date) {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }

  function formatRelativeTime(date) {
    if (!date) return '';
    const diffSeconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
    return formatShortDate(date);
  }

  // ==========================================
  // 4. GAME ENGINE
  // ==========================================
  const XP_TYPES = {
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

  const XP_TYPE_LABELS = {
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

  const XpEngine = {
    calculateLevel(totalXP = 0) {
      const validXP = Math.max(0, Number(totalXP) || 0);
      const xpPerLevel = APP_CONFIG.game.xpPerLevel;
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

    calculateActionXP(type, options = {}) {
      const values = APP_CONFIG.game.xpValues;
      switch (type) {
        case XP_TYPES.STUDY_HOUR:
          return values.STUDY_HOUR;
        case XP_TYPES.POMODORO:
          const count = Math.max(1, Number(options.count) || 1);
          return Math.floor(count / 2) * values.POMODORO_PAIR;
        case XP_TYPES.TASK:
          const diff = (options.difficulty || 'MEDIUM').toUpperCase();
          if (diff === 'EASY') return values.TASK_EASY;
          if (diff === 'HARD') return values.TASK_HARD;
          return values.TASK_MEDIUM;
        case XP_TYPES.HOMEWORK:
          return options.isPerfect ? values.HOMEWORK_PERFECT : values.HOMEWORK_IMPERFECT;
        case XP_TYPES.WEEKLY_EXAM:
          return options.isFullScore ? values.WEEKLY_EXAM_PERFECT : values.WEEKLY_EXAM_IMPERFECT;
        case XP_TYPES.MONTHLY_EXAM:
          return options.isFullScore ? values.MONTHLY_EXAM_PERFECT : values.MONTHLY_EXAM_IMPERFECT;
        case XP_TYPES.STREAK_MILESTONE:
          return values.STREAK_MILESTONE_10_DAYS;
        case XP_TYPES.BATTLE_WIN:
          return APP_CONFIG.game.battle.winPoints.xp;
        case XP_TYPES.BATTLE_CLOSE_LOSS:
          return APP_CONFIG.game.battle.closeLossPoints.xp;
        default:
          return Number(options.customAmount) || 0;
      }
    }
  };

  const StreakEngine = {
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

      const qualifyingTypes = new Set([
        'POMODORO', 'STUDY_HOUR', 'TASK', 'HOMEWORK', 'WEEKLY_EXAM', 'MONTHLY_EXAM'
      ]);

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
      const isActiveToday = activeDatesSet.has(todayStr);
      const lastActiveDateStr = activeDates[activeDates.length - 1];

      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 0;
      let prevDate = null;

      for (let i = 0; i < activeDates.length; i++) {
        const curDate = startOfLocalDay(new Date(activeDates[i]));
        if (!prevDate) {
          tempStreak = 1;
        } else {
          const dayDiff = diffInCalendarDays(curDate, prevDate);
          if (dayDiff === 1) tempStreak += 1;
          else if (dayDiff > 1) tempStreak = 1;
        }
        if (tempStreak > maxStreak) maxStreak = tempStreak;
        prevDate = curDate;
      }

      const lastDate = startOfLocalDay(new Date(lastActiveDateStr));
      const dayDiffFromToday = diffInCalendarDays(startOfLocalDay(currentDate), lastDate);
      if (dayDiffFromToday === 0 || dayDiffFromToday === 1) {
        currentStreak = tempStreak;
      } else {
        currentStreak = 0;
      }

      const interval = APP_CONFIG.game.streak.milestoneInterval;
      const nextMilestone = (Math.floor(currentStreak / interval) + 1) * interval;
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

  const BattleEngine = {
    calculateRelativeProgress(userRoundXP = 0, opponentRoundXP = 0) {
      const uXP = Math.max(0, Number(userRoundXP) || 0);
      const oXP = Math.max(0, Number(opponentRoundXP) || 0);
      const totalXP = uXP + oXP;

      let userPercentage = 50;
      let opponentPercentage = 50;
      let status = 'TIED';
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

      return { userPercentage, opponentPercentage, status, statusMessage, isClose };
    },

    resolveRound(roundNumber, user1XP, user2XP, user1Id, user2Id) {
      const u1XP = Math.max(0, Number(user1XP) || 0);
      const u2XP = Math.max(0, Number(user2XP) || 0);
      const diff = Math.abs(u1XP - u2XP);
      const winPoints = APP_CONFIG.game.battle.winPoints;
      const closeLossPoints = APP_CONFIG.game.battle.closeLossPoints;
      const normalLossPoints = APP_CONFIG.game.battle.normalLossPoints;

      let winnerId = null;
      let isTie = false;
      let user1BP = 0, user1BonusXP = 0;
      let user2BP = 0, user2BonusXP = 0;
      let user1Result = 'LOSS', user2Result = 'LOSS';

      if (u1XP > u2XP) {
        winnerId = user1Id;
        user1BP = winPoints.bp;
        user1BonusXP = winPoints.xp;
        user1Result = 'WIN';

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
        isTie = true;
        user1BP = closeLossPoints.bp;
        user1BonusXP = closeLossPoints.xp;
        user2BP = closeLossPoints.bp;
        user2BonusXP = closeLossPoints.xp;
        user1Result = 'TIE';
        user2Result = 'TIE';
      }

      return {
        roundNumber, user1Id, user2Id, user1XP: u1XP, user2XP: u2XP,
        winnerId, isTie, user1BP, user1BonusXP, user2BP, user2BonusXP,
        user1Result, user2Result
      };
    },

    calculateSeasonWinner(battle, rounds = []) {
      let user1TotalBP = 0, user2TotalBP = 0;
      let user1RoundsWon = 0, user2RoundsWon = 0;
      let user1TotalXP = 0, user2TotalXP = 0;

      rounds.forEach(r => {
        user1TotalBP += r.user1BP || 0;
        user2TotalBP += r.user2BP || 0;
        user1TotalXP += r.user1XP || 0;
        user2TotalXP += r.user2XP || 0;
        if (r.winnerId === battle.user1Id) user1RoundsWon += 1;
        else if (r.winnerId === battle.user2Id) user2RoundsWon += 1;
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
        if (user1RoundsWon > user2RoundsWon) {
          winnerId = battle.user1Id;
          winnerReason = 'Tie-breaker: More Rounds Won';
        } else if (user2RoundsWon > user1RoundsWon) {
          winnerId = battle.user2Id;
          winnerReason = 'Tie-breaker: More Rounds Won';
        } else {
          if (user1TotalXP > user2TotalXP) {
            winnerId = battle.user1Id;
            winnerReason = 'Tie-breaker: Total XP';
          } else if (user2TotalXP > user1TotalXP) {
            winnerId = battle.user2Id;
            winnerReason = 'Tie-breaker: Total XP';
          } else {
            winnerId = null;
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

  const TransactionManager = {
    recalculateUserState(transactions = [], oldProfile = {}) {
      let totalXP = 0;
      const sortedTxs = [...transactions].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

      sortedTxs.forEach(tx => {
        const amt = Number(tx.amount);
        if (!isNaN(amt)) totalXP += amt;
      });

      totalXP = Math.max(0, totalXP);
      const levelState = XpEngine.calculateLevel(totalXP);
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

    createTransaction({ userId, amount, type, metadata = {}, source = 'MANUAL_QUICK_ACTION', timestamp = new Date().toISOString() }) {
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

  // ==========================================
  // 5. SOUNDS & TOASTS
  // ==========================================
  let audioCtx = null;
  let isMuted = Storage.get('audio_muted', false);

  function getAudioContext() {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  const SoundService = {
    isMuted() { return isMuted; },
    toggleMute() {
      isMuted = !isMuted;
      Storage.set('audio_muted', isMuted);
      return isMuted;
    },
    playXpChime() {
      if (isMuted) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {}
    },
    playLevelUp() {
      if (isMuted) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = ctx.currentTime + i * 0.08;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.15, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.22);
        });
      } catch (e) {}
    },
    playVictory() {
      if (isMuted) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = ctx.currentTime + i * 0.12;
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.1, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.38);
        });
      } catch (e) {}
    },
    playClick() {
      if (isMuted) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.04);
      } catch (e) {}
    }
  };

  const Toast = {
    show({ title, message, type = 'info', duration = 3500 }) {
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      let icon = '⚡';
      if (type === 'success') icon = '✓';
      if (type === 'error') icon = '⚠️';
      if (type === 'xp') icon = '✨';

      toast.innerHTML = `
        <div style="font-size: 1.2rem;">${icon}</div>
        <div style="flex: 1;">
          <div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 2px;">${title}</div>
          ${message ? `<div style="font-size: 0.8rem; color: var(--text-secondary);">${message}</div>` : ''}
        </div>
      `;

      container.appendChild(toast);
      setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },
    success(title, message) { this.show({ title, message, type: 'success' }); },
    error(title, message) { this.show({ title, message, type: 'error' }); },
    spawnXpFloater(amount, x = null, y = null) {
      SoundService.playXpChime();
      const floater = document.createElement('div');
      floater.className = 'xp-floater tabular-nums';
      floater.textContent = `+${amount} XP`;
      floater.style.left = `${x !== null ? x : window.innerWidth / 2}px`;
      floater.style.top = `${y !== null ? y : window.innerHeight / 2 - 50}px`;
      document.body.appendChild(floater);
      setTimeout(() => floater.remove(), 1200);
    }
  };

  // ==========================================
  // 6. DATABASE & STORAGE LAYER
  // ==========================================
  const TABLES = {
    USERS: 'db_users',
    TRANSACTIONS: 'db_transactions',
    INVITES: 'db_invites',
    BATTLES: 'db_battles',
    ROUNDS: 'db_rounds',
    NOTIFICATIONS: 'db_notifications'
  };

  function ensureSeedData() {
    // Clean out legacy demo accounts if they were cached previously
    const users = Storage.get(TABLES.USERS, []);
    const filteredUsers = users.filter(u => u.uid !== 'user_apex' && u.uid !== 'user_vortex');
    if (filteredUsers.length !== users.length) {
      Storage.set(TABLES.USERS, filteredUsers);
      const battles = Storage.get(TABLES.BATTLES, []).filter(b => b.id !== 'battle_demo_1');
      Storage.set(TABLES.BATTLES, battles);
      const rounds = Storage.get(TABLES.ROUNDS, []).filter(r => r.battleId !== 'battle_demo_1');
      Storage.set(TABLES.ROUNDS, rounds);
      const txs = Storage.get(TABLES.TRANSACTIONS, []).filter(t => t.userId !== 'user_apex' && t.userId !== 'user_vortex');
      Storage.set(TABLES.TRANSACTIONS, txs);
      const notifs = Storage.get(TABLES.NOTIFICATIONS, []).filter(n => n.id !== 'notif_welcome');
      Storage.set(TABLES.NOTIFICATIONS, notifs);
      const curSession = Storage.get('current_session');
      if (curSession && (curSession.uid === 'user_apex' || curSession.uid === 'user_vortex')) {
        Storage.remove('current_session');
      }
    }
  }

  const DatabaseService = {
    async init() {
      ensureSeedData();
    },

    async createUserProfile(profile) {
      const users = Storage.get(TABLES.USERS, []);
      users.push(profile);
      Storage.set(TABLES.USERS, users);
      return profile;
    },

    async getUserProfile(uid) {
      const users = Storage.get(TABLES.USERS, []);
      return users.find(u => u.uid === uid) || null;
    },

    async getUserByUsername(username) {
      const clean = (username || '').trim().toLowerCase();
      if (!clean) return null;
      const users = Storage.get(TABLES.USERS, []);
      return users.find(u => u.username.toLowerCase() === clean) || null;
    },

    async updateUserProfile(uid, updates) {
      const users = Storage.get(TABLES.USERS, []);
      const index = users.findIndex(u => u.uid === uid);
      if (index !== -1) {
        users[index] = { ...users[index], ...updates };
        Storage.set(TABLES.USERS, users);
      }
    },

    async addTransaction(transaction) {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      txs.push(transaction);
      Storage.set(TABLES.TRANSACTIONS, txs);
      await this.syncUserCalculations(transaction.userId);
      return transaction;
    },

    async getTransactions(userId) {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      return txs
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    async updateTransaction(userId, transactionId, updates) {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      const index = txs.findIndex(t => t.id === transactionId && t.userId === userId);
      if (index !== -1) {
        txs[index] = { ...txs[index], ...updates, updatedAt: new Date().toISOString() };
        Storage.set(TABLES.TRANSACTIONS, txs);
      }
      await this.syncUserCalculations(userId);
    },

    async deleteTransaction(userId, transactionId) {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      const filtered = txs.filter(t => !(t.id === transactionId && t.userId === userId));
      Storage.set(TABLES.TRANSACTIONS, filtered);
      await this.syncUserCalculations(userId);
    },

    async syncUserCalculations(userId) {
      const transactions = await this.getTransactions(userId);
      const profile = await this.getUserProfile(userId);
      if (!profile) return;

      const recalculated = TransactionManager.recalculateUserState(transactions, profile);
      await this.updateUserProfile(userId, {
        totalXP: recalculated.totalXP,
        level: recalculated.level,
        currentStreak: recalculated.currentStreak,
        longestStreak: recalculated.longestStreak,
        lastActiveDate: recalculated.lastActiveDate,
        nextMilestone: recalculated.nextMilestone
      });

      if (profile.activeBattleId) {
        await this.syncActiveBattleRoundXP(profile.activeBattleId, userId, transactions);
      }
    },

    async sendBattleInvite(fromUser, toUser) {
      if (fromUser.activeBattleId) throw new Error('You already have an active battle. Complete or end it first.');
      if (toUser.activeBattleId) throw new Error(`${toUser.username} already has an active battle.`);
      if (fromUser.uid === toUser.uid) throw new Error('You cannot battle yourself.');

      const invite = {
        id: generateId('inv'),
        fromUserId: fromUser.uid,
        fromUsername: fromUser.username,
        fromLevel: fromUser.level,
        toUserId: toUser.uid,
        toUsername: toUser.username,
        status: 'PENDING',
        createdAt: new Date().toISOString()
      };

      const invites = Storage.get(TABLES.INVITES, []);
      invites.push(invite);
      Storage.set(TABLES.INVITES, invites);

      await this.addNotification(toUser.uid, {
        title: '⚔️ New Battle Challenge!',
        message: `${fromUser.username} (Lvl ${fromUser.level}) challenged you to a 1v1 Season Battle.`,
        type: 'BATTLE_INVITE',
        inviteId: invite.id
      });

      return invite;
    },

    async getPendingInvites(userId) {
      const invites = Storage.get(TABLES.INVITES, []);
      return invites.filter(i => i.toUserId === userId && i.status === 'PENDING');
    },

    async respondToInvite(inviteId, accept, battleConfig = {}) {
      const invites = Storage.get(TABLES.INVITES, []);
      const index = invites.findIndex(i => i.id === inviteId);
      if (index === -1) throw new Error('Invite not found.');

      invites[index].status = accept ? 'ACCEPTED' : 'DECLINED';
      invites[index].respondedAt = new Date().toISOString();
      const invite = invites[index];
      Storage.set(TABLES.INVITES, invites);

      if (accept) {
        const battle = await this.createBattle({
          name: battleConfig.name || `${invite.fromUsername} vs ${invite.toUsername}`,
          user1Id: invite.fromUserId,
          user1Username: invite.fromUsername,
          user2Id: invite.toUserId,
          user2Username: invite.toUsername,
          startDate: battleConfig.startDate || new Date().toISOString(),
          endDate: battleConfig.endDate || null
        });

        await this.addNotification(invite.fromUserId, {
          title: '⚔️ Battle Accepted!',
          message: `${invite.toUsername} accepted your challenge! Season 1 is now active.`,
          type: 'BATTLE_ACCEPTED',
          battleId: battle.id
        });
        return battle;
      } else {
        await this.addNotification(invite.fromUserId, {
          title: 'Challenge Declined',
          message: `${invite.toUsername} declined your battle invitation.`,
          type: 'BATTLE_DECLINED'
        });
        return null;
      }
    },

    async createBattle({ name, user1Id, user1Username, user2Id, user2Username, startDate, endDate }) {
      const battleId = generateId('battle');
      const battle = {
        id: battleId,
        name: name.trim(),
        user1Id, user1Username, user2Id, user2Username,
        participants: [user1Id, user2Id],
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || null,
        status: 'ACTIVE',
        currentRound: 1,
        user1TotalBP: 0, user2TotalBP: 0,
        user1RoundsWon: 0, user2RoundsWon: 0,
        createdAt: new Date().toISOString()
      };

      const round1Bounds = calculateRoundBounds(battle.startDate, 1);
      const round1 = {
        id: generateId('round'),
        battleId: battle.id,
        roundNumber: 1,
        startDate: round1Bounds.startDate,
        endDate: round1Bounds.endDate,
        status: 'ACTIVE',
        user1Id, user2Id,
        user1XP: 0, user2XP: 0
      };

      const battles = Storage.get(TABLES.BATTLES, []);
      battles.push(battle);
      Storage.set(TABLES.BATTLES, battles);

      const rounds = Storage.get(TABLES.ROUNDS, []);
      rounds.push(round1);
      Storage.set(TABLES.ROUNDS, rounds);

      await this.updateUserProfile(user1Id, { activeBattleId: battleId });
      await this.updateUserProfile(user2Id, { activeBattleId: battleId });

      return battle;
    },

    async getBattle(battleId) {
      if (!battleId) return null;
      const battles = Storage.get(TABLES.BATTLES, []);
      return battles.find(b => b.id === battleId) || null;
    },

    async getUserBattleHistory(userId) {
      if (!userId) return [];
      const battles = Storage.get(TABLES.BATTLES, []);
      return battles.filter(b => b.participants.includes(userId) && b.status === 'COMPLETED');
    },

    async getRoundsForBattle(battleId) {
      if (!battleId) return [];
      const rounds = Storage.get(TABLES.ROUNDS, []);
      return rounds.filter(r => r.battleId === battleId).sort((a, b) => a.roundNumber - b.roundNumber);
    },

    async syncActiveBattleRoundXP(battleId, userId, userTransactions = null) {
      const battle = await this.getBattle(battleId);
      if (!battle || battle.status !== 'ACTIVE') return;

      const roundInfo = getCurrentRoundInfo(battle.startDate, battle.endDate);
      const rounds = await this.getRoundsForBattle(battleId);

      let currentRound = rounds.find(r => r.roundNumber === roundInfo.roundNumber);
      if (!currentRound) {
        currentRound = {
          id: generateId('round'),
          battleId: battle.id,
          roundNumber: roundInfo.roundNumber,
          startDate: roundInfo.startDate,
          endDate: roundInfo.endDate,
          status: 'ACTIVE',
          user1Id: battle.user1Id,
          user2Id: battle.user2Id,
          user1XP: 0,
          user2XP: 0
        };
        const allRounds = Storage.get(TABLES.ROUNDS, []);
        allRounds.push(currentRound);
        Storage.set(TABLES.ROUNDS, allRounds);
      }

      const txs = userTransactions || await this.getTransactions(userId);
      const calculatedXP = TransactionManager.calculateXPInWindow(txs, currentRound.startDate, currentRound.endDate);

      const isUser1 = battle.user1Id === userId;
      const updates = isUser1 ? { user1XP: calculatedXP } : { user2XP: calculatedXP };

      const allRounds = Storage.get(TABLES.ROUNDS, []);
      const idx = allRounds.findIndex(r => r.id === currentRound.id);
      if (idx !== -1) {
        allRounds[idx] = { ...allRounds[idx], ...updates };
        Storage.set(TABLES.ROUNDS, allRounds);
      }
    },

    async endBattle(battleId) {
      const battle = await this.getBattle(battleId);
      if (!battle) return null;

      const rounds = await this.getRoundsForBattle(battleId);
      const resolvedRounds = rounds.map(r => {
        if (r.status === 'ACTIVE') {
          const resolved = BattleEngine.resolveRound(r.roundNumber, r.user1XP, r.user2XP, r.user1Id, r.user2Id);
          return {
            ...r, ...resolved,
            status: 'COMPLETED',
            resolvedAt: new Date().toISOString()
          };
        }
        return r;
      });

      const seasonOutcome = BattleEngine.calculateSeasonWinner(battle, resolvedRounds);
      const updates = {
        status: 'COMPLETED',
        endedAt: new Date().toISOString(),
        winnerId: seasonOutcome.winnerId,
        winnerReason: seasonOutcome.winnerReason,
        user1TotalBP: seasonOutcome.user1.totalBP,
        user2TotalBP: seasonOutcome.user2.totalBP,
        user1RoundsWon: seasonOutcome.user1.roundsWon,
        user2RoundsWon: seasonOutcome.user2.roundsWon,
        user1TotalXP: seasonOutcome.user1.totalXP,
        user2TotalXP: seasonOutcome.user2.totalXP
      };

      const battles = Storage.get(TABLES.BATTLES, []);
      const bIdx = battles.findIndex(b => b.id === battleId);
      if (bIdx !== -1) {
        battles[bIdx] = { ...battles[bIdx], ...updates };
        Storage.set(TABLES.BATTLES, battles);
      }
      Storage.set(TABLES.ROUNDS, resolvedRounds);

      const u1 = await this.getUserProfile(battle.user1Id);
      const u2 = await this.getUserProfile(battle.user2Id);
      if (u1) {
        await this.updateUserProfile(battle.user1Id, {
          activeBattleId: null,
          wins: (u1.wins || 0) + (seasonOutcome.winnerId === battle.user1Id ? 1 : 0),
          losses: (u1.losses || 0) + (seasonOutcome.winnerId === battle.user2Id ? 1 : 0)
        });
      }
      if (u2) {
        await this.updateUserProfile(battle.user2Id, {
          activeBattleId: null,
          wins: (u2.wins || 0) + (seasonOutcome.winnerId === battle.user2Id ? 1 : 0),
          losses: (u2.losses || 0) + (seasonOutcome.winnerId === battle.user1Id ? 1 : 0)
        });
      }

      return { ...battle, ...updates, seasonOutcome };
    },

    async addNotification(userId, { title, message, type = 'SYSTEM', inviteId = null, battleId = null }) {
      const notif = {
        id: generateId('notif'),
        userId, title, message, type, inviteId, battleId,
        read: false,
        createdAt: new Date().toISOString()
      };
      const list = Storage.get(TABLES.NOTIFICATIONS, []);
      list.unshift(notif);
      Storage.set(TABLES.NOTIFICATIONS, list);
      return notif;
    },

    async getNotifications(userId) {
      const list = Storage.get(TABLES.NOTIFICATIONS, []);
      return list.filter(n => n.userId === userId).slice(0, 30);
    },

    async markNotificationAsRead(userId, notifId) {
      const list = Storage.get(TABLES.NOTIFICATIONS, []);
      const n = list.find(item => item.id === notifId && item.userId === userId);
      if (n) {
        n.read = true;
        Storage.set(TABLES.NOTIFICATIONS, list);
      }
    }
  };

  // ==========================================
  // 7. AUTH SERVICE
  // ==========================================
  let currentUser = null;
  const authListeners = new Set();

  function notifyAuthChange(user) {
    currentUser = user;
    authListeners.forEach(listener => {
      try { listener(user); } catch (e) {}
    });
  }

  const AuthService = {
    async init() {
      const cachedUser = Storage.get('current_session');
      if (cachedUser) {
        currentUser = cachedUser;
      } else {
        currentUser = null;
      }
      notifyAuthChange(currentUser);
      return currentUser;
    },

    getCurrentUser() {
      return currentUser;
    },

    onAuthStateChanged(callback) {
      authListeners.add(callback);
      callback(currentUser);
      return () => authListeners.delete(callback);
    },

    async register(username, password, confirmPassword) {
      const trimmed = (username || '').trim();
      if (!trimmed || trimmed.length < 3) throw new Error('Username must be at least 3 characters.');
      if (!/^[\p{L}\p{N}_]{3,25}$/u.test(trimmed)) throw new Error('Username can only contain letters, numbers, and underscores.');
      if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');

      const existing = await DatabaseService.getUserByUsername(trimmed);
      if (existing) throw new Error(`Username "${trimmed}" is already taken.`);

      const newProfile = {
        uid: generateId('user'),
        username: trimmed,
        passwordHash: safeHash(password),
        level: 1,
        totalXP: 0,
        currentStreak: 0,
        longestStreak: 0,
        wins: 0,
        losses: 0,
        activeBattleId: null,
        reminderTime: '20:00',
        createdAt: new Date().toISOString()
      };

      await DatabaseService.createUserProfile(newProfile);
      currentUser = newProfile;
      Storage.set('current_session', newProfile);
      notifyAuthChange(currentUser);
      return newProfile;
    },

    async login(username, password) {
      const trimmed = (username || '').trim();
      if (!trimmed || !password) throw new Error('Please enter both username and password.');

      const user = await DatabaseService.getUserByUsername(trimmed);
      if (!user) throw new Error('User not found. Check username or register.');
      if (user.passwordHash && user.passwordHash !== safeHash(password)) {
        throw new Error('Incorrect password.');
      }

      currentUser = user;
      Storage.set('current_session', user);
      notifyAuthChange(currentUser);
      return user;
    },

    async logout() {
      currentUser = null;
      Storage.remove('current_session');
      notifyAuthChange(null);
    },

    async switchUser(userProfile) {
      currentUser = userProfile;
      Storage.set('current_session', userProfile);
      notifyAuthChange(currentUser);
    }
  };

  // ==========================================
  // 8. NOTIFICATIONS & AUDIO
  // ==========================================
  const NotificationService = {
    async init(user = null) {},
    async requestPermission() {
      if ('Notification' in window && Notification.permission !== 'granted') {
        try {
          const result = await Notification.requestPermission();
          return result === 'granted';
        } catch (e) { return false; }
      }
      return true;
    }
  };

  // ==========================================
  // 9. UI COMPONENTS
  // ==========================================
  const VsCard = {
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

      const relProgress = BattleEngine.calculateRelativeProgress(userRoundXP, opponentRoundXP);

      return `
        <div class="battle-arena-card">
          <div class="vs-container">
            <div class="player-card you">
              <div class="player-avatar you">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
              <div class="player-info">
                <div class="player-name-row">
                  <span class="player-name">${escapeHtml(user.username)}</span>
                  <span class="badge badge-cyan">YOU</span>
                </div>
                <div class="player-stats-row">
                  <span class="stat-pill">Lvl ${user.level || 1}</span>
                  <span>•</span>
                  <span class="stat-pill tabular-nums">${formatXP(user.totalXP)} XP</span>
                  <span>•</span>
                  <span class="stat-pill streak-pulse">🔥 ${user.currentStreak || 0}d</span>
                </div>
              </div>
            </div>

            <div class="vs-emblem">
              <div class="vs-badge">VS</div>
            </div>

            <div class="player-card opponent">
              <div class="player-avatar opponent">${escapeHtml(opponent.username.charAt(0).toUpperCase())}</div>
              <div class="player-info">
                <div class="player-name-row">
                  <span class="badge badge-amber">RIVAL</span>
                  <span class="player-name">${escapeHtml(opponent.username)}</span>
                </div>
                <div class="player-stats-row">
                  <span class="stat-pill streak-pulse">🔥 ${opponent.currentStreak || 0}d</span>
                  <span>•</span>
                  <span class="stat-pill tabular-nums">${formatXP(opponent.totalXP)} XP</span>
                  <span>•</span>
                  <span class="stat-pill">Lvl ${opponent.level || 1}</span>
                </div>
              </div>
            </div>
          </div>

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

  const Navigation = {
    init() {
      this.bindEvents();
      this.initTheme();
      this.updateNotificationBadge();
    },

    initTheme() {
      const saved = Storage.get('app_theme', 'dark');
      document.documentElement.setAttribute('data-theme', saved);
    },

    toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      Storage.set('app_theme', next);
      SoundService.playClick();
    },

    setActiveView(viewName) {
      const cleanView = (viewName || 'dashboard').replace('#', '');
      document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-view') === cleanView);
      });
      document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `view-${cleanView}`);
      });
    },

    async updateNotificationBadge() {
      const user = AuthService.getCurrentUser();
      const badgeEl = document.getElementById('notif-badge-indicator');
      if (!badgeEl) return;
      if (!user) { badgeEl.style.display = 'none'; return; }
      try {
        const notifs = await DatabaseService.getNotifications(user.uid);
        badgeEl.style.display = notifs.some(n => !n.read) ? 'block' : 'none';
      } catch (e) {
        badgeEl.style.display = 'none';
      }
    },

    async renderNotificationsDropdown() {
      const dropdownEl = document.getElementById('notif-dropdown-menu');
      const user = AuthService.getCurrentUser();
      if (!dropdownEl) return;

      if (!user) {
        dropdownEl.innerHTML = `
          <div class="notif-header"><span>Notifications</span></div>
          <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            Sign in to view notifications
          </div>
        `;
        return;
      }

      try {
        const notifs = await DatabaseService.getNotifications(user.uid);
        let itemsHtml = '';
        if (notifs.length === 0) {
          itemsHtml = `<div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No notifications yet.</div>`;
        } else {
          itemsHtml = notifs.map(n => `
            <li class="notif-item ${!n.read ? 'unread' : ''}" data-id="${n.id}" data-type="${n.type}">
              <div class="notif-item-title">${escapeHtml(n.title)}</div>
              <div class="notif-item-desc">${escapeHtml(n.message)}</div>
              <div class="notif-item-time">${formatRelativeTime(n.createdAt)}</div>
            </li>
          `).join('');
        }

        dropdownEl.innerHTML = `
          <div class="notif-header">
            <span>Notifications</span>
            <button id="btn-mark-all-read" class="btn btn-sm" style="font-size: 0.72rem; padding: 2px 6px; background: transparent; color: var(--text-muted);">Mark read</button>
          </div>
          <ul class="notif-list">${itemsHtml}</ul>
        `;

        dropdownEl.querySelectorAll('.notif-item').forEach(item => {
          item.addEventListener('click', async () => {
            await DatabaseService.markNotificationAsRead(user.uid, item.dataset.id);
            item.classList.remove('unread');
            this.updateNotificationBadge();
            if (item.dataset.type === 'BATTLE_INVITE') {
              dropdownEl.classList.remove('open');
              InviteModal.open();
            }
          });
        });

        const markAllBtn = dropdownEl.querySelector('#btn-mark-all-read');
        if (markAllBtn) {
          markAllBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            for (const n of notifs) {
              if (!n.read) await DatabaseService.markNotificationAsRead(user.uid, n.id);
            }
            this.renderNotificationsDropdown();
            this.updateNotificationBadge();
          });
        }
      } catch (err) {}
    },

    bindEvents() {
      document.querySelectorAll('[data-view]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.hash = `#${el.getAttribute('data-view')}`;
          SoundService.playClick();
        });
      });

      const themeBtn = document.getElementById('btn-toggle-theme');
      if (themeBtn) themeBtn.addEventListener('click', () => this.toggleTheme());

      const soundBtn = document.getElementById('btn-toggle-sound');
      if (soundBtn) {
        soundBtn.addEventListener('click', () => {
          const muted = SoundService.toggleMute();
          soundBtn.innerHTML = muted ? '🔇' : '🔊';
          Toast.show({ title: muted ? 'Sound Muted' : 'Sound Enabled', duration: 1500 });
        });
      }

      const headerXpBtn = document.getElementById('btn-header-quick-xp');
      if (headerXpBtn) {
        headerXpBtn.addEventListener('click', () => {
          SoundService.playClick();
          QuickXpModal.open();
        });
      }

      const notifBellBtn = document.getElementById('btn-notif-bell');
      const notifDropdown = document.getElementById('notif-dropdown-menu');
      if (notifBellBtn && notifDropdown) {
        notifBellBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = notifDropdown.classList.toggle('open');
          if (isOpen) {
            SoundService.playClick();
            this.renderNotificationsDropdown();
          }
        });
        document.addEventListener('click', (e) => {
          if (!notifDropdown.contains(e.target) && !notifBellBtn.contains(e.target)) {
            notifDropdown.classList.remove('open');
          }
        });
      }
    }
  };

  const QuickXpModal = {
    init() {
      this.bindEvents();
    },
    open(defaultAction = 'STUDY_HOUR') {
      const modalEl = document.getElementById('modal-quick-xp');
      if (!modalEl) return;
      const user = AuthService.getCurrentUser();
      if (!user) {
        Toast.error('Please sign in first to log XP.');
        return;
      }
      this.selectTab(defaultAction);
      modalEl.classList.add('open');
    },
    close() {
      const modalEl = document.getElementById('modal-quick-xp');
      if (modalEl) modalEl.classList.remove('open');
    },
    selectTab(actionType) {
      const modalEl = document.getElementById('modal-quick-xp');
      if (!modalEl) return;
      modalEl.querySelectorAll('.xp-action-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.action === actionType);
      });
      modalEl.querySelectorAll('.xp-form-panel').forEach(panel => {
        panel.style.display = panel.dataset.action === actionType ? 'block' : 'none';
      });
    },
    bindEvents() {
      const modalEl = document.getElementById('modal-quick-xp');
      if (!modalEl) return;

      modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      modalEl.querySelectorAll('.xp-action-tab').forEach(tab => {
        tab.addEventListener('click', () => {
          SoundService.playClick();
          this.selectTab(tab.dataset.action);
        });
      });

      const formStudy = modalEl.querySelector('#form-study-hour');
      if (formStudy) {
        formStudy.addEventListener('submit', async (e) => {
          e.preventDefault();
          const hours = Number(formStudy.querySelector('[name="hours"]').value) || 1;
          const notes = formStudy.querySelector('[name="notes"]').value.trim();
          await this.submitXP({
            type: XP_TYPES.STUDY_HOUR,
            amount: hours * 25,
            metadata: { hours, notes: notes || `${hours} hr study session` }
          });
        });
      }

      const formPomo = modalEl.querySelector('#form-pomodoro');
      if (formPomo) {
        formPomo.addEventListener('submit', async (e) => {
          e.preventDefault();
          const count = Number(formPomo.querySelector('[name="count"]').value) || 1;
          const notes = formPomo.querySelector('[name="notes"]').value.trim();
          const xp = XpEngine.calculateActionXP(XP_TYPES.POMODORO, { count });
          await this.submitXP({
            type: XP_TYPES.POMODORO,
            amount: xp,
            metadata: { count, notes: notes || `${count} Pomodoro session` }
          });
        });
      }

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

      const formHw = modalEl.querySelector('#form-homework');
      if (formHw) {
        formHw.addEventListener('submit', async (e) => {
          e.preventDefault();
          const isPerfect = formHw.querySelector('[name="isPerfect"]:checked')?.value === 'true';
          const notes = formHw.querySelector('[name="notes"]').value.trim();
          const xp = XpEngine.calculateActionXP(XP_TYPES.HOMEWORK, { isPerfect });
          await this.submitXP({
            type: XP_TYPES.HOMEWORK,
            amount: xp,
            metadata: { isPerfect, notes: notes || `Homework (${isPerfect ? 'Perfect' : 'Mistakes'})` }
          });
        });
      }

      const formWeekly = modalEl.querySelector('#form-weekly-exam');
      if (formWeekly) {
        formWeekly.addEventListener('submit', async (e) => {
          e.preventDefault();
          const isFullScore = formWeekly.querySelector('[name="isFullScore"]:checked')?.value === 'true';
          const notes = formWeekly.querySelector('[name="notes"]').value.trim();
          const xp = XpEngine.calculateActionXP(XP_TYPES.WEEKLY_EXAM, { isFullScore });
          await this.submitXP({
            type: XP_TYPES.WEEKLY_EXAM,
            amount: xp,
            metadata: { isFullScore, notes: notes || `Weekly Exam (${isFullScore ? 'Full Score' : 'Partial'})` }
          });
        });
      }

      const formMonthly = modalEl.querySelector('#form-monthly-exam');
      if (formMonthly) {
        formMonthly.addEventListener('submit', async (e) => {
          e.preventDefault();
          const isFullScore = formMonthly.querySelector('[name="isFullScore"]:checked')?.value === 'true';
          const notes = formMonthly.querySelector('[name="notes"]').value.trim();
          const xp = XpEngine.calculateActionXP(XP_TYPES.MONTHLY_EXAM, { isFullScore });
          await this.submitXP({
            type: XP_TYPES.MONTHLY_EXAM,
            amount: xp,
            metadata: { isFullScore, notes: notes || `Monthly Exam (${isFullScore ? 'Full Score' : 'Partial'})` }
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
          metadata
        });

        await DatabaseService.addTransaction(tx);
        const updatedProfile = await DatabaseService.getUserProfile(user.uid);
        this.close();

        if (amount > 0) Toast.spawnXpFloater(amount);
        else SoundService.playClick();

        Toast.success('Achievement Logged!', `${metadata.notes || type} (+${amount} XP)`);

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

        if (updatedProfile) {
          const milestoneHit = StreakEngine.checkMilestoneUnlocked(prevStreak, updatedProfile.currentStreak, []);
          if (milestoneHit) {
            setTimeout(async () => {
              const milestoneTx = TransactionManager.createTransaction({
                userId: user.uid,
                amount: milestoneHit.bonusXP,
                type: XP_TYPES.STREAK_MILESTONE,
                metadata: { milestoneDay: milestoneHit.milestoneDay, notes: `${milestoneHit.milestoneDay}-Day Streak Bonus!` }
              });
              await DatabaseService.addTransaction(milestoneTx);
              Toast.spawnXpFloater(milestoneHit.bonusXP);
              Toast.show({
                title: `🔥 ${milestoneHit.milestoneDay}-DAY STREAK MILESTONE!`,
                message: `Awarded +${milestoneHit.bonusXP} XP!`,
                type: 'xp',
                duration: 5000
              });
            }, 800);
          }
        }

        window.dispatchEvent(new CustomEvent('pulse_state_updated'));
      } catch (err) {
        Toast.error('Submission Failed', err.message);
      }
    }
  };

  const InviteModal = {
    init() {
      this.bindEvents();
    },
    async open() {
      const modalEl = document.getElementById('modal-invite');
      if (!modalEl) return;
      const user = AuthService.getCurrentUser();
      if (!user) {
        Toast.error('Please sign in to manage invites.');
        return;
      }
      modalEl.classList.add('open');
      this.resetForms();
      await this.loadPendingInvites();
    },
    close() {
      const modalEl = document.getElementById('modal-invite');
      if (modalEl) modalEl.classList.remove('open');
    },
    resetForms() {
      const modalEl = document.getElementById('modal-invite');
      if (!modalEl) return;
      const searchInput = modalEl.querySelector('#input-search-username');
      const searchResults = modalEl.querySelector('#invite-search-results');
      const setupSection = modalEl.querySelector('#battle-setup-section');
      const inviteSection = modalEl.querySelector('#invite-actions-section');
      if (searchInput) searchInput.value = '';
      if (searchResults) searchResults.innerHTML = '';
      if (setupSection) setupSection.style.display = 'none';
      if (inviteSection) inviteSection.style.display = 'block';
    },
    async loadPendingInvites() {
      const user = AuthService.getCurrentUser();
      const modalEl = document.getElementById('modal-invite');
      if (!user || !modalEl) return;
      const container = modalEl.querySelector('#pending-invites-container');
      if (!container) return;

      const invites = await DatabaseService.getPendingInvites(user.uid);
      if (invites.length === 0) {
        container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 12px 0;">No incoming challenges. Search for a rival above!</div>`;
        return;
      }

      container.innerHTML = invites.map(inv => `
        <div class="card" style="padding: 14px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              <span>⚔️</span><span>${inv.fromUsername}</span><span class="badge badge-cyan">Lvl ${inv.fromLevel || 1}</span>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">Challenged you to a 1v1 Season Battle</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-danger btn-sm btn-decline-invite" data-id="${inv.id}">Decline</button>
            <button class="btn btn-primary btn-sm btn-accept-invite" data-id="${inv.id}" data-user="${inv.fromUsername}">Accept</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('.btn-decline-invite').forEach(btn => {
        btn.addEventListener('click', async () => {
          await DatabaseService.respondToInvite(btn.dataset.id, false);
          Toast.show({ title: 'Challenge Declined', message: 'Invite removed.' });
          await this.loadPendingInvites();
        });
      });

      container.querySelectorAll('.btn-accept-invite').forEach(btn => {
        btn.addEventListener('click', () => {
          this.showBattleSetup(btn.dataset.id, btn.dataset.user);
        });
      });
    },
    showBattleSetup(inviteId, opponentUsername) {
      const user = AuthService.getCurrentUser();
      const modalEl = document.getElementById('modal-invite');
      if (!modalEl || !user) return;
      const setupSection = modalEl.querySelector('#battle-setup-section');
      const inviteSection = modalEl.querySelector('#invite-actions-section');
      if (setupSection && inviteSection) {
        inviteSection.style.display = 'none';
        setupSection.style.display = 'block';
        setupSection.querySelector('[name="battleName"]').value = `${user.username} vs ${opponentUsername}`;
        setupSection.querySelector('[name="startDate"]').value = getLocalCalendarDate();
        setupSection.querySelector('[name="acceptedInviteId"]').value = inviteId;
      }
    },
    bindEvents() {
      const modalEl = document.getElementById('modal-invite');
      if (!modalEl) return;
      modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      const searchForm = modalEl.querySelector('#form-search-user');
      const searchInput = modalEl.querySelector('#input-search-username');
      const resultsContainer = modalEl.querySelector('#invite-search-results');

      if (searchForm && searchInput && resultsContainer) {
        searchForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const query = searchInput.value.trim();
          const currentUser = AuthService.getCurrentUser();
          if (!query || !currentUser) return;

          const user = await DatabaseService.getUserByUsername(query);
          if (!user || user.uid === currentUser.uid) {
            resultsContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--accent-crimson); padding: 8px 0;">${user && user.uid === currentUser.uid ? 'You cannot challenge yourself.' : 'No user found with that username.'}</div>`;
            return;
          }

          resultsContainer.innerHTML = `
            <div class="card" style="padding: 14px; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <div style="font-weight: 700; font-size: 0.95rem;">${user.username}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">Level ${user.level || 1} • Streak ${user.currentStreak || 0}d</div>
              </div>
              <button class="btn btn-primary btn-sm btn-send-challenge" data-uid="${user.uid}">Challenge ⚔️</button>
            </div>
          `;

          const sendBtn = resultsContainer.querySelector('.btn-send-challenge');
          if (sendBtn) {
            sendBtn.addEventListener('click', async () => {
              try {
                sendBtn.disabled = true;
                await DatabaseService.sendBattleInvite(currentUser, user);
                SoundService.playClick();
                Toast.success('Challenge Sent!', `Invite sent to ${user.username}`);
                resultsContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--accent-emerald); padding: 8px 0;">✓ Challenge sent to ${user.username}!</div>`;
              } catch (err) {
                sendBtn.disabled = false;
                Toast.error('Invite Failed', err.message);
              }
            });
          }
        });
      }

      const setupForm = modalEl.querySelector('#form-battle-setup');
      if (setupForm) {
        setupForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const inviteId = setupForm.querySelector('[name="acceptedInviteId"]').value;
          const name = setupForm.querySelector('[name="battleName"]').value.trim();
          const startDate = setupForm.querySelector('[name="startDate"]').value;
          const endDate = setupForm.querySelector('[name="endDate"]').value || null;

          try {
            await DatabaseService.respondToInvite(inviteId, true, { name, startDate, endDate });
            SoundService.playVictory();
            Toast.show({ title: '⚔️ BATTLE SEASON ACTIVATED!', message: 'Good luck in Round 1!', type: 'xp' });
            this.close();
            window.dispatchEvent(new CustomEvent('pulse_state_updated'));
            window.location.hash = '#battles';
          } catch (err) {
            Toast.error('Activation Failed', err.message);
          }
        });

        const cancelBtn = setupForm.querySelector('#btn-cancel-setup');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            this.resetForms();
            this.loadPendingInvites();
          });
        }
      }
    }
  };

  const TransactionModal = {
    init() { this.bindEvents(); },
    open(transaction) {
      const modalEl = document.getElementById('modal-transaction-edit');
      if (!modalEl || !transaction) return;
      this.currentTx = transaction;
      const form = modalEl.querySelector('#form-edit-transaction');
      if (form) {
        form.querySelector('[name="txId"]').value = transaction.id;
        form.querySelector('[name="txAmount"]').value = transaction.amount;
        form.querySelector('[name="notes"]').value = transaction.metadata?.notes || '';
        form.querySelector('[name="txType"]').value = transaction.type;
      }
      modalEl.classList.add('open');
    },
    close() {
      const modalEl = document.getElementById('modal-transaction-edit');
      if (modalEl) modalEl.classList.remove('open');
      this.currentTx = null;
    },
    bindEvents() {
      const modalEl = document.getElementById('modal-transaction-edit');
      if (!modalEl) return;
      modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      const form = modalEl.querySelector('#form-edit-transaction');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const user = AuthService.getCurrentUser();
          if (!user || !this.currentTx) return;

          const newAmount = Number(form.querySelector('[name="txAmount"]').value);
          const newNotes = form.querySelector('[name="notes"]').value.trim();
          const newType = form.querySelector('[name="txType"]').value;

          if (isNaN(newAmount) || newAmount < 0) {
            Toast.error('Invalid Amount', 'Must be a positive number.');
            return;
          }

          try {
            await DatabaseService.updateTransaction(user.uid, this.currentTx.id, {
              amount: newAmount,
              type: newType,
              metadata: { ...this.currentTx.metadata, notes: newNotes }
            });
            Toast.success('Updated', 'XP and levels recalculated.');
            this.close();
            window.dispatchEvent(new CustomEvent('pulse_state_updated'));
          } catch (err) {
            Toast.error('Update Failed', err.message);
          }
        });

        const deleteBtn = form.querySelector('#btn-delete-tx');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', async () => {
            const user = AuthService.getCurrentUser();
            if (!user || !this.currentTx) return;
            if (confirm('Delete this XP transaction? Your total XP and levels will be automatically recalculated.')) {
              try {
                await DatabaseService.deleteTransaction(user.uid, this.currentTx.id);
                Toast.success('Deleted', 'Recalculation complete.');
                this.close();
                window.dispatchEvent(new CustomEvent('pulse_state_updated'));
              } catch (err) {
                Toast.error('Delete Failed', err.message);
              }
            }
          });
        }
      }
    }
  };

  const AuthView = {
    init() { this.bindEvents(); },
    open(mode = 'LOGIN') {
      const modalEl = document.getElementById('modal-auth');
      if (!modalEl) return;
      this.setMode(mode);
      modalEl.classList.add('open');
    },
    close() {
      const modalEl = document.getElementById('modal-auth');
      if (modalEl) modalEl.classList.remove('open');
    },
    setMode(mode) {
      const modalEl = document.getElementById('modal-auth');
      if (!modalEl) return;
      const isLogin = mode === 'LOGIN';
      modalEl.querySelector('#auth-modal-title').textContent = isLogin ? 'Sign In to PULSE' : 'Create Rival Account';
      modalEl.querySelector('#form-login').style.display = isLogin ? 'block' : 'none';
      modalEl.querySelector('#form-register').style.display = isLogin ? 'none' : 'block';
      modalEl.querySelector('#auth-toggle-prompt').innerHTML = isLogin
        ? `Don't have an account? <a href="#" id="btn-toggle-register" style="color: var(--accent-cyan); font-weight: 700;">Register</a>`
        : `Already have an account? <a href="#" id="btn-toggle-login" style="color: var(--accent-cyan); font-weight: 700;">Sign In</a>`;

      const regToggle = modalEl.querySelector('#btn-toggle-register');
      const logToggle = modalEl.querySelector('#btn-toggle-login');
      if (regToggle) regToggle.addEventListener('click', (e) => { e.preventDefault(); this.setMode('REGISTER'); });
      if (logToggle) logToggle.addEventListener('click', (e) => { e.preventDefault(); this.setMode('LOGIN'); });
    },
    bindEvents() {
      const modalEl = document.getElementById('modal-auth');
      if (!modalEl) return;

      modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
        btn.addEventListener('click', () => this.close());
      });

      const loginForm = modalEl.querySelector('#form-login');
      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = loginForm.querySelector('[name="username"]').value;
          const password = loginForm.querySelector('[name="password"]').value;
          const submitBtn = loginForm.querySelector('button[type="submit"]');
          try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in...';
            await AuthService.login(username, password);
            SoundService.playClick();
            Toast.success('Welcome Back!', `Signed in as ${username}`);
            this.close();
            window.dispatchEvent(new CustomEvent('pulse_state_updated'));
          } catch (err) {
            Toast.error('Login Failed', err.message);
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
          }
        });
      }

      const registerForm = modalEl.querySelector('#form-register');
      if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = registerForm.querySelector('[name="username"]').value;
          const password = registerForm.querySelector('[name="password"]').value;
          const confirmPassword = registerForm.querySelector('[name="confirmPassword"]').value;
          const submitBtn = registerForm.querySelector('button[type="submit"]');
          try {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';
            await AuthService.register(username, password, confirmPassword);
            SoundService.playVictory();
            Toast.show({ title: `Welcome, ${username}!`, message: 'Account ready for competition!', type: 'xp' });
            this.close();
            window.dispatchEvent(new CustomEvent('pulse_state_updated'));
          } catch (err) {
            Toast.error('Registration Failed', err.message);
          } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
          }
        });
      }

    }
  };

  // ==========================================
  // 10. VIEWS
  // ==========================================
  const DashboardView = {
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
            <button class="btn btn-primary" id="btn-dashboard-auth"><span>Sign In / Register</span></button>
          </div>
        `;
        container.querySelector('#btn-dashboard-auth')?.addEventListener('click', () => AuthView.open('LOGIN'));
        return;
      }

      let activeBattle = null, opponent = null, currentRound = null;
      if (user.activeBattleId) {
        activeBattle = await DatabaseService.getBattle(user.activeBattleId);
        if (activeBattle && activeBattle.status === 'ACTIVE') {
          const opponentId = activeBattle.user1Id === user.uid ? activeBattle.user2Id : activeBattle.user1Id;
          opponent = await DatabaseService.getUserProfile(opponentId);
          const rounds = await DatabaseService.getRoundsForBattle(activeBattle.id);
          currentRound = rounds.find(r => r.roundNumber === activeBattle.currentRound) || rounds[rounds.length - 1];
        }
      }

      const levelState = XpEngine.calculateLevel(user.totalXP);

      container.innerHTML = `
        <div id="dashboard-vs-section">
          ${VsCard.render({ user, opponent, battle: activeBattle, currentRound, isFullView: false })}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-top: 24px;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><span>🎖️</span><span>Level ${levelState.level} Progression</span></h3>
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

          <div class="card">
            <div class="card-header">
              <h3 class="card-title"><span class="streak-pulse">🔥</span><span>Study Streak</span></h3>
              <span class="badge ${user.currentStreak > 0 ? 'badge-amber' : 'badge-muted'}">${user.currentStreak > 0 ? `${user.currentStreak} Days Active` : 'Streak Inactive'}</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div style="background: var(--bg-primary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current Streak</div>
                <div style="font-family: var(--font-display); font-size: 1.4rem; font-weight: 800; color: var(--accent-amber);">${user.currentStreak || 0} <span style="font-size: 0.8rem;">days</span></div>
              </div>
              <div style="background: var(--bg-primary); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Longest Streak</div>
                <div style="font-family: var(--font-display); font-size: 1.4rem; font-weight: 800; color: var(--text-primary);">${user.longestStreak || user.currentStreak || 0} <span style="font-size: 0.8rem;">days</span></div>
              </div>
            </div>
            <div style="margin-top: 10px; font-size: 0.78rem; color: var(--text-secondary); display: flex; align-items: center; justify-content: space-between;">
              <span>Next Milestone: <strong>Day ${user.nextMilestone || 10}</strong></span>
              <span class="badge badge-amber">+50 XP Bonus</span>
            </div>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <h3 style="font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;"><span>⚡</span><span>Quick XP Actions</span></h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Instant 1-click achievement logging</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px;">
            <button class="card btn-quick-action" data-action="STUDY_HOUR" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 1.4rem; margin-bottom: 6px;">⏱️</div>
              <div style="font-weight: 700; font-size: 0.95rem;">Study Hour</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">1 hr continuous study</div>
              <div class="badge badge-cyan" style="margin-top: 8px;">+25 XP</div>
            </button>

            <button class="card btn-quick-action" data-action="POMODORO" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 1.4rem; margin-bottom: 6px;">🍅</div>
              <div style="font-weight: 700; font-size: 0.95rem;">Pomodoro</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Preserves daily streak</div>
              <div class="badge badge-amber" style="margin-top: 8px;">Streak Save / +25 XP pair</div>
            </button>

            <button class="card btn-quick-action" data-action="TASK" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 1.4rem; margin-bottom: 6px;">📋</div>
              <div style="font-weight: 700; font-size: 0.95rem;">Task Completed</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Easy / Medium / Hard</div>
              <div class="badge badge-cyan" style="margin-top: 8px;">+10 - +30 XP</div>
            </button>

            <button class="card btn-quick-action" data-action="HOMEWORK" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 1.4rem; margin-bottom: 6px;">📝</div>
              <div style="font-weight: 700; font-size: 0.95rem;">Homework</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Perfect or with mistakes</div>
              <div class="badge badge-cyan" style="margin-top: 8px;">+1 / +10 XP</div>
            </button>

            <button class="card btn-quick-action" data-action="WEEKLY_EXAM" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 1.4rem; margin-bottom: 6px;">🏆</div>
              <div style="font-weight: 700; font-size: 0.95rem;">Weekly Exam</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Full score check</div>
              <div class="badge badge-emerald" style="margin-top: 8px;">+3 / +30 XP</div>
            </button>

            <button class="card btn-quick-action" data-action="MONTHLY_EXAM" style="text-align: left; cursor: pointer; padding: 16px; border: 1px solid var(--border-subtle);">
              <div style="font-size: 1.4rem; margin-bottom: 6px;">🎖️</div>
              <div style="font-weight: 700; font-size: 0.95rem;">Monthly Exam</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">Major evaluation</div>
              <div class="badge badge-emerald" style="margin-top: 8px;">+7.5 / +75 XP</div>
            </button>
          </div>
        </div>
      `;

      container.querySelectorAll('.btn-quick-action, .btn-open-quick-xp').forEach(btn => {
        btn.addEventListener('click', () => QuickXpModal.open(btn.dataset.action || 'STUDY_HOUR'));
      });
      container.querySelectorAll('.btn-open-invite').forEach(btn => {
        btn.addEventListener('click', () => InviteModal.open());
      });
      container.querySelector('.btn-go-battles')?.addEventListener('click', () => { window.location.hash = '#battles'; });
    }
  };

  const BattlesView = {
    async render() {
      const container = document.getElementById('view-battles');
      if (!container) return;
      const user = AuthService.getCurrentUser();

      if (!user) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⚔️</div>
            <h2 class="empty-title">1v1 Season Battles</h2>
            <p class="empty-subtitle">Sign in to view your battle arena and round history.</p>
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
            <button class="btn btn-primary btn-open-invite" style="margin-top: 12px;"><span>Find Opponent & Invite</span></button>
          </div>
        `;
        container.querySelector('.btn-open-invite')?.addEventListener('click', () => InviteModal.open());
        return;
      }

      const battle = await DatabaseService.getBattle(user.activeBattleId);
      if (!battle) return;

      const opponentId = battle.user1Id === user.uid ? battle.user2Id : battle.user1Id;
      const opponent = await DatabaseService.getUserProfile(opponentId);
      const rounds = await DatabaseService.getRoundsForBattle(battle.id);
      const currentRound = rounds.find(r => r.roundNumber === battle.currentRound) || rounds[rounds.length - 1];
      const isUser1 = battle.user1Id === user.uid;

      const completedRounds = rounds.filter(r => r.status === 'COMPLETED');
      let roundsHtml = completedRounds.length === 0
        ? `<div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">Round 1 is in progress! Completed round scores will appear here.</div>`
        : completedRounds.map(r => {
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
                  <span class="tabular-nums" style="color: ${isWinner ? 'var(--accent-emerald)' : 'var(--text-secondary)'};">+${uBP} BP</span>
                </div>
              </div>
            `;
          }).join('');

      container.innerHTML = `
        ${VsCard.render({ user, opponent, battle, currentRound, isFullView: true })}

        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 class="card-title"><span>📊</span><span>Season 1 Competition Rules & Timeline</span></h3>
            <button class="btn btn-danger btn-sm" id="btn-end-battle"><span>End Battle Season 🏁</span></button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; font-size: 0.88rem;">
            <div><span style="color: var(--text-muted); display: block;">Start Date:</span><strong>${formatDate(battle.startDate)}</strong></div>
            <div><span style="color: var(--text-muted); display: block;">End Date:</span><strong>${battle.endDate ? formatDate(battle.endDate) : 'Ongoing (Until ended manually)'}</strong></div>
            <div><span style="color: var(--text-muted); display: block;">Round Win Reward:</span><strong style="color: var(--accent-emerald);">+200 XP & +200 BP</strong></div>
            <div><span style="color: var(--text-muted); display: block;">Close Fight Bonus:</span><strong style="color: var(--accent-amber);">+50 XP & +50 BP</strong></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><span>📜</span><span>Weekly Round History</span></h3>
            <span class="badge badge-cyan">${completedRounds.length} Completed</span>
          </div>
          <div class="round-history-list">${roundsHtml}</div>
        </div>
      `;

      container.querySelector('#btn-end-battle')?.addEventListener('click', async () => {
        if (confirm(`Conclude "${battle.name}"? The winner will be crowned based on total Battle Points!`)) {
          const finishedBattle = await DatabaseService.endBattle(battle.id);
          SoundService.playVictory();
          const outcome = finishedBattle.seasonOutcome;
          const isWinner = outcome.winnerId === AuthService.getCurrentUser().uid;
          Toast.show({
            title: isWinner ? '🏆 SEASON VICTORY!' : '🏁 Season Concluded',
            message: isWinner ? 'You won the season rivalry!' : `${outcome.winnerReason}.`,
            type: 'xp',
            duration: 6000
          });
          window.dispatchEvent(new CustomEvent('pulse_state_updated'));
          window.location.hash = '#history';
        }
      });
    }
  };

  const HistoryView = {
    async render() {
      const container = document.getElementById('view-history');
      if (!container) return;
      const user = AuthService.getCurrentUser();

      if (!user) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📜</div>
            <h2 class="empty-title">Battle History</h2>
            <p class="empty-subtitle">Sign in to view your past competitive season battles.</p>
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
            <p class="empty-subtitle">Completed season rivalries will be archived here with detailed round recaps.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><span class="trophy-shimmer">🏆</span><span>Season Battle History (${historyBattles.length})</span></h3>
            <span style="font-size: 0.85rem; color: var(--text-muted);">Career: <strong>${user.wins || 0}W - ${user.losses || 0}L</strong></span>
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
                      <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; color: var(--accent-cyan);">${formatNumber(userBP)} vs ${formatNumber(oppBP)}</div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Rounds</div>
                      <div style="font-family: var(--font-display); font-weight: 800; font-size: 1.1rem;">${userRounds}W - ${oppRounds}L</div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
  };

  const ProfileView = {
    async render() {
      const container = document.getElementById('view-profile');
      if (!container) return;
      const user = AuthService.getCurrentUser();

      if (!user) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">👤</div>
            <h2 class="empty-title">User Profile</h2>
            <p class="empty-subtitle">Sign in to access your profile and XP transaction ledger.</p>
          </div>
        `;
        return;
      }

      const transactions = await DatabaseService.getTransactions(user.uid);
      const config = getRuntimeConfig();

      container.innerHTML = `
        <div class="card" style="margin-bottom: 24px; position: relative;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 18px;">
              <div class="player-avatar you" style="width: 64px; height: 64px; font-size: 1.6rem;">
                ${escapeHtml(user.username.charAt(0).toUpperCase())}
              </div>
              <div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <h2 style="font-size: 1.5rem; font-family: var(--font-display);">${escapeHtml(user.username)}</h2>
                  <span class="badge badge-cyan">Level ${user.level || 1}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
                  Member since ${formatDate(user.createdAt || new Date())}
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 10px;">
              <button class="btn btn-secondary btn-sm" id="btn-profile-logout">Log Out 🚪</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-top: 24px;">
            <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total XP</div>
              <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--accent-cyan);" class="tabular-nums">${formatXP(user.totalXP)}</div>
            </div>
            <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Current Streak</div>
              <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--accent-amber);" class="streak-pulse">🔥 ${user.currentStreak || 0}d</div>
            </div>
            <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Best Streak</div>
              <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800;">${user.longestStreak || user.currentStreak || 0}d</div>
            </div>
            <div style="background: var(--bg-primary); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Battle Record</div>
              <div style="font-family: var(--font-display); font-size: 1.3rem; font-weight: 800; color: var(--accent-emerald);">${user.wins || 0}W - ${user.losses || 0}L</div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 class="card-title"><span>📋</span><span>XP Transaction Ledger (${transactions.length})</span></h3>
            <span style="font-size: 0.78rem; color: var(--text-muted);">Click edit to modify or delete</span>
          </div>

          ${transactions.length === 0 ? `
            <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.88rem;">No XP transactions yet. Use Quick Actions to earn XP!</div>
          ` : `
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--border-medium); color: var(--text-muted); font-size: 0.78rem; text-transform: uppercase;">
                    <th style="padding: 10px 12px;">Type</th>
                    <th style="padding: 10px 12px;">Notes / Detail</th>
                    <th style="padding: 10px 12px; text-align: right;">XP</th>
                    <th style="padding: 10px 12px;">Time</th>
                    <th style="padding: 10px 12px; text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${transactions.map(tx => `
                    <tr style="border-bottom: 1px solid var(--border-subtle);">
                      <td style="padding: 12px; font-weight: 600;"><span class="badge ${tx.amount > 25 ? 'badge-emerald' : 'badge-cyan'}">${escapeHtml(tx.type)}</span></td>
                      <td style="padding: 12px; color: var(--text-secondary);">${escapeHtml(tx.metadata?.notes || XP_TYPE_LABELS[tx.type] || tx.type)}</td>
                      <td style="padding: 12px; text-align: right; font-weight: 800; font-family: var(--font-display); color: var(--accent-cyan);" class="tabular-nums">+${formatXP(tx.amount)}</td>
                      <td style="padding: 12px; font-size: 0.78rem; color: var(--text-muted);">${formatRelativeTime(tx.timestamp)}</td>
                      <td style="padding: 12px; text-align: center;">
                        <button class="btn btn-secondary btn-sm btn-edit-tx" data-tx-id="${tx.id}">✏️ Edit</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title"><span>⚙️</span><span>Preferences & Settings</span></h3>
          </div>
          <form id="form-user-settings" style="max-width: 600px;">
            <div class="form-group">
              <label class="form-label">Daily Study Streak Reminder Time</label>
              <input type="time" class="form-input" name="reminderTime" value="${user.reminderTime || '20:00'}">
            </div>
            <div style="display: flex; gap: 12px; margin-top: 18px; flex-wrap: wrap;">
              <button type="submit" class="btn btn-primary btn-sm">Save Reminder Settings</button>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-request-notif-perm">Enable Notifications 🔔</button>
            </div>
          </form>
        </div>
      `;

      container.querySelector('#btn-profile-logout')?.addEventListener('click', async () => {
        if (confirm('Log out of PULSE?')) {
          await AuthService.logout();
          Toast.show({ title: 'Logged Out' });
          window.location.hash = '#dashboard';
          window.dispatchEvent(new CustomEvent('pulse_state_updated'));
        }
      });

      container.querySelectorAll('.btn-edit-tx').forEach(btn => {
        btn.addEventListener('click', () => {
          const tx = transactions.find(t => t.id === btn.dataset.txId);
          if (tx) TransactionModal.open(tx);
        });
      });

      container.querySelector('#form-user-settings')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const reminderTime = e.target.querySelector('[name="reminderTime"]').value;
        await DatabaseService.updateUserProfile(user.uid, { reminderTime });
        Toast.success('Saved', `Reminder set to ${reminderTime}`);
      });

      container.querySelector('#btn-request-notif-perm')?.addEventListener('click', async () => {
        const granted = await NotificationService.requestPermission();
        Toast.show({ title: granted ? 'Notifications Enabled!' : 'Permission Denied' });
      });
    }
  };

  // ==========================================
  // 11. MASTER APP COORDINATOR
  // ==========================================
  class PulseApp {
    constructor() {
      this.currentView = 'dashboard';
    }

    async init() {
      console.log('🚀 Initializing PULSE Unified Application Engine...');
      await DatabaseService.init();
      const user = await AuthService.init();
      await NotificationService.init(user);

      Navigation.init();
      QuickXpModal.init();
      InviteModal.init();
      TransactionModal.init();
      AuthView.init();

      this.setupRouter();
      this.setupGlobalEvents();

      this.updateUserHeader(user);
      this.navigate(window.location.hash || '#dashboard');
    }

    setupRouter() {
      window.addEventListener('hashchange', () => {
        this.navigate(window.location.hash);
      });
    }

    setupGlobalEvents() {
      window.addEventListener('pulse_state_updated', async () => {
        const user = AuthService.getCurrentUser();
        if (user) {
          const fresh = await DatabaseService.getUserProfile(user.uid);
          this.updateUserHeader(fresh);
        } else {
          this.updateUserHeader(null);
        }
        this.renderCurrentView();
        Navigation.updateNotificationBadge();
      });

      window.addEventListener('pulse_open_auth', (e) => {
        AuthView.open(e.detail?.mode || 'LOGIN');
      });

      document.getElementById('btn-header-user')?.addEventListener('click', () => {
        const user = AuthService.getCurrentUser();
        if (user) window.location.hash = '#profile';
        else AuthView.open('LOGIN');
      });
    }

    updateUserHeader(user) {
      const userBtn = document.getElementById('btn-header-user');
      if (!userBtn) return;
      if (user) {
        userBtn.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600;">
            <div class="player-avatar you" style="width: 28px; height: 28px; font-size: 0.85rem; border-radius: var(--radius-sm);">
              ${escapeHtml(user.username.charAt(0).toUpperCase())}
            </div>
            <span style="display: inline-block; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(user.username)}
            </span>
            <span class="badge badge-cyan" style="font-size: 0.7rem; padding: 2px 6px;">Lvl ${user.level || 1}</span>
          </div>
        `;
      } else {
        userBtn.innerHTML = `<span class="badge badge-cyan" style="padding: 6px 12px; font-size: 0.82rem; cursor: pointer;">Sign In ⚡</span>`;
      }
    }

    async navigate(hash) {
      const viewName = (hash || '#dashboard').replace('#', '') || 'dashboard';
      this.currentView = viewName;
      Navigation.setActiveView(viewName);
      await this.renderCurrentView();
      window.scrollTo(0, 0);
    }

    async renderCurrentView() {
      switch (this.currentView) {
        case 'battles': await BattlesView.render(); break;
        case 'history': await HistoryView.render(); break;
        case 'profile': await ProfileView.render(); break;
        case 'dashboard':
        default:
          await DashboardView.render();
          break;
      }
    }
  }

  // Expose global Pulse engine
  window.Pulse = new PulseApp();
  window.PulseEngine = {
    XpEngine,
    StreakEngine,
    BattleEngine,
    TransactionManager,
    DatabaseService,
    AuthService,
    Toast,
    SoundService
  };

  // Bootstrap when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.Pulse.init());
  } else {
    window.Pulse.init();
  }

})(window, document);
