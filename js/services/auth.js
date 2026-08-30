/**
 * PULSE Authentication Service
 * Clean Username + Password authentication over Firebase Auth and Sandbox storage
 */

import { FirebaseService } from './firebase.js';
import { Storage } from '../utils/storage.js';
import { generateId } from '../utils/helpers.js';

let currentUser = null;
const authListeners = new Set();

function notifyAuthChange(user) {
  currentUser = user;
  authListeners.forEach(listener => {
    try {
      listener(user);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
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

/**
 * Sanitize username to create a deterministic internal auth identifier
 */
function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `${clean || 'user'}@pulse.local`;
}

export const AuthService = {
  async init() {
    // Check cached session
    const cachedUser = Storage.get('current_session');
    if (cachedUser) {
      currentUser = cachedUser;
      notifyAuthChange(currentUser);
    }

    const { auth, isLive } = await FirebaseService.init();

    if (isLive && auth) {
      const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // Fetch full user profile
          const { DatabaseService } = await import('./database.js');
          let profile = await DatabaseService.getUserProfile(firebaseUser.uid);
          if (profile) {
            currentUser = profile;
            Storage.set('current_session', profile);
            notifyAuthChange(currentUser);
          }
        } else if (!cachedUser) {
          currentUser = null;
          Storage.remove('current_session');
          notifyAuthChange(null);
        }
      });
    }

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

  /**
   * Register a new user with username and password
   */
  async register(username, password, confirmPassword) {
    const trimmedUsername = (username || '').trim();

    if (!trimmedUsername || trimmedUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!/^[\p{L}\p{N}_]{3,25}$/u.test(trimmedUsername)) {
      throw new Error('Username can only contain letters, numbers, and underscores.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }

    const { DatabaseService } = await import('./database.js');

    // Check username uniqueness
    const existingUser = await DatabaseService.getUserByUsername(trimmedUsername);
    if (existingUser) {
      throw new Error(`Username "${trimmedUsername}" is already taken.`);
    }

    const isLive = FirebaseService.isLive();

    if (isLive) {
      const { createUserWithEmailAndPassword, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const auth = FirebaseService.getAuth();
      const email = usernameToEmail(trimmedUsername);

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: trimmedUsername });

      const newProfile = {
        uid: userCred.user.uid,
        username: trimmedUsername,
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
    } else {
      // Local Sandbox registration
      const newUid = generateId('user');
      const newProfile = {
        uid: newUid,
        username: trimmedUsername,
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
    }
  },

  /**
   * Log in with username and password
   */
  async login(username, password) {
    const trimmedUsername = (username || '').trim();

    if (!trimmedUsername || !password) {
      throw new Error('Please enter both username and password.');
    }

    const { DatabaseService } = await import('./database.js');
    const isLive = FirebaseService.isLive();

    if (isLive) {
      const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const auth = FirebaseService.getAuth();
      const email = usernameToEmail(trimmedUsername);

      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const profile = await DatabaseService.getUserProfile(userCred.user.uid);
        if (!profile) {
          throw new Error('Profile record not found.');
        }
        currentUser = profile;
        Storage.set('current_session', profile);
        notifyAuthChange(currentUser);
        return profile;
      } catch (err) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          throw new Error('Invalid username or password.');
        }
        throw new Error(err.message || 'Login failed.');
      }
    } else {
      // Local Sandbox login
      const user = await DatabaseService.getUserByUsername(trimmedUsername);
      if (!user) {
        throw new Error('User not found. Check your username or register a new account.');
      }
      if (user.passwordHash && user.passwordHash !== safeHash(password)) {
        throw new Error('Incorrect password.');
      }

      currentUser = user;
      Storage.set('current_session', user);
      notifyAuthChange(currentUser);
      return user;
    }
  },

  /**
   * Log out
   */
  async logout() {
    const isLive = FirebaseService.isLive();
    if (isLive) {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js');
      const auth = FirebaseService.getAuth();
      await signOut(auth);
    }
    currentUser = null;
    Storage.remove('current_session');
    notifyAuthChange(null);
  },

  /**
   * Switch or simulate opponent account (for seamless 1v1 local demo testing)
   */
  async switchUser(userProfile) {
    currentUser = userProfile;
    Storage.set('current_session', userProfile);
    notifyAuthChange(currentUser);
  }
};
