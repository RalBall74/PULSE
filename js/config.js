/**
 * PULSE - Application & Game Engine Configuration
 * Pure Vanilla JavaScript ES Module
 */

export const APP_CONFIG = {
  appName: 'PULSE',
  tagline: 'Competitive 1v1 Season Battle & XP Tracker',
  version: '1.0.0',

  // Game Engine Constants
  game: {
    xpPerLevel: 500,
    
    // XP Values
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

    // Study Streak Rules
    streak: {
      milestoneInterval: 10, // days
      milestoneBonusXP: 50,
      minPomodorosForDailyStreak: 1
    },

    // 1v1 Battle Rules
    battle: {
      roundDurationDays: 7,
      winPoints: {
        bp: 200,
        xp: 200
      },
      closeLossPoints: {
        bp: 50,
        xp: 50
      },
      normalLossPoints: {
        bp: 0,
        xp: 0
      },
      // Configurable close loss threshold (either within 15% margin or within 50 XP margin)
      closeLossThresholdPercentage: 0.15,
      closeLossThresholdXP: 50
    }
  },

  // Firebase Default Config (Configured with pulse-tadfuq)
  firebase: {
    apiKey: "AIzaSyCnHveI12UfUOT7wjWBx9ayt3mNhDXL4xg",
    authDomain: "pulse-tadfuq.firebaseapp.com",
    projectId: "pulse-tadfuq",
    storageBucket: "pulse-tadfuq.firebasestorage.app",
    messagingSenderId: "313190697881",
    appId: "1:313190697881:web:b96e24821f9233f7afa108",
    measurementId: "G-DV0BN3FDMG"
  },

  // OneSignal Default Config
  onesignal: {
    appId: "",
    safariWebId: "",
    allowLocalhostAsSecureOrigin: true
  }
};

/**
 * Load environment or saved runtime overrides
 */
export function getRuntimeConfig() {
  const savedConfig = localStorage.getItem('pulse_runtime_config');
  let runtimeFirebase = APP_CONFIG.firebase;
  let runtimeOneSignal = APP_CONFIG.onesignal;

  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      if (parsed.firebase) runtimeFirebase = { ...runtimeFirebase, ...parsed.firebase };
      if (parsed.onesignal) runtimeOneSignal = { ...runtimeOneSignal, ...parsed.onesignal };
    } catch (e) {
      console.warn('Failed to parse saved runtime config:', e);
    }
  }

  // Check window overrides if defined
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

export function saveRuntimeConfig(firebaseConfig, onesignalConfig) {
  const payload = {
    firebase: firebaseConfig || {},
    onesignal: onesignalConfig || {}
  };
  localStorage.setItem('pulse_runtime_config', JSON.stringify(payload));
}
