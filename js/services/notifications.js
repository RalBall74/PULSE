/**
 * PULSE Notification Service
 * Integrates OneSignal Push Notifications & in-app bell indicator
 */

import { getRuntimeConfig } from '../config.js';
import { DatabaseService } from './database.js';

let isOneSignalLoaded = false;
let streakTimer = null;

export const NotificationService = {
  async init(user = null) {
    const config = getRuntimeConfig();

    if (config.isOneSignalConfigured && typeof window !== 'undefined') {
      try {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        // Load OneSignal SDK script dynamically if not present
        if (!document.getElementById('onesignal-sdk')) {
          const script = document.createElement('script');
          script.id = 'onesignal-sdk';
          script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
          script.defer = true;
          document.head.appendChild(script);
        }

        window.OneSignalDeferred.push(async (OneSignal) => {
          await OneSignal.init({
            appId: config.onesignal.appId,
            safari_web_id: config.onesignal.safariWebId || undefined,
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true
          });
          isOneSignalLoaded = true;

          if (user) {
            await OneSignal.login(user.uid);
            await OneSignal.User.addTag('username', user.username);
          }
        });
      } catch (err) {
        console.warn('OneSignal initialization skipped:', err);
      }
    }

    if (user) {
      this.setupDailyStreakReminder(user);
    }
  },

  /**
   * Schedules a daily streak check and reminder alert
   */
  setupDailyStreakReminder(user) {
    if (streakTimer) clearInterval(streakTimer);

    const checkReminder = async () => {
      const reminderTime = user.reminderTime || '20:00'; // HH:mm
      const [targetHours, targetMinutes] = reminderTime.split(':').map(Number);
      const now = new Date();

      if (now.getHours() === targetHours && now.getMinutes() === targetMinutes) {
        const profile = await DatabaseService.getUserProfile(user.uid);
        if (profile && !profile.isActiveToday) {
          // Send streak preservation warning
          await DatabaseService.addNotification(user.uid, {
            title: '🔥 Streak in Danger!',
            message: 'Complete at least 1 Pomodoro before midnight to keep your Study Streak alive!',
            type: 'STREAK_REMINDER'
          });

          // Trigger local browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🔥 PULSE - Streak in Danger!', {
              body: 'Complete at least 1 Pomodoro today to preserve your Study Streak!',
              icon: '/favicon.ico'
            });
          }
        }
      }
    };

    // Check once every minute
    streakTimer = setInterval(checkReminder, 60000);
  },

  async requestPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        const result = await Notification.requestPermission();
        return result === 'granted';
      } catch (e) {
        return false;
      }
    }
    return true;
  }
};
