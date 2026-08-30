/**
 * PULSE Database Service
 * Provides unified data access layer for Cloud Firestore and Local Sandbox storage
 */

import { FirebaseService } from './firebase.js';
import { Storage } from '../utils/storage.js';
import { generateId } from '../utils/helpers.js';
import { TransactionManager } from '../engine/transactionManager.js';
import { BattleEngine } from '../engine/battleEngine.js';
import { getCurrentRoundInfo, calculateRoundBounds } from '../utils/dateUtils.js';

// Local storage collection keys for Sandbox Mode
const TABLES = {
  USERS: 'db_users',
  TRANSACTIONS: 'db_transactions',
  INVITES: 'db_invites',
  BATTLES: 'db_battles',
  ROUNDS: 'db_rounds',
  NOTIFICATIONS: 'db_notifications'
};

// Seed initial demo data in sandbox if empty
function ensureSeedData() {
  const users = Storage.get(TABLES.USERS, null);
  if (!users) {
    const demoUser1 = {
      uid: 'user_apex',
      username: 'ApexLegend',
      passwordHash: btoa('password123'),
      level: 4,
      totalXP: 1750,
      currentStreak: 7,
      longestStreak: 14,
      wins: 2,
      losses: 0,
      activeBattleId: 'battle_demo_1',
      reminderTime: '20:00',
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
    };

    const demoUser2 = {
      uid: 'user_vortex',
      username: 'VortexStriker',
      passwordHash: btoa('password123'),
      level: 3,
      totalXP: 1425,
      currentStreak: 5,
      longestStreak: 9,
      wins: 1,
      losses: 1,
      activeBattleId: 'battle_demo_1',
      reminderTime: '21:00',
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString()
    };

    const battleStart = new Date(Date.now() - 10 * 86400000).toISOString();
    const demoBattle = {
      id: 'battle_demo_1',
      name: 'Season 1 Grand Rivalry',
      user1Id: demoUser1.uid,
      user1Username: demoUser1.username,
      user2Id: demoUser2.uid,
      user2Username: demoUser2.username,
      participants: [demoUser1.uid, demoUser2.uid],
      startDate: battleStart,
      endDate: null,
      status: 'ACTIVE',
      currentRound: 2,
      user1TotalBP: 200,
      user2TotalBP: 50,
      user1RoundsWon: 1,
      user2RoundsWon: 0,
      createdAt: battleStart
    };

    // Round 1 (Completed)
    const round1Bounds = calculateRoundBounds(battleStart, 1);
    const demoRound1 = {
      id: 'round_demo_1_r1',
      battleId: demoBattle.id,
      roundNumber: 1,
      startDate: round1Bounds.startDate,
      endDate: round1Bounds.endDate,
      status: 'COMPLETED',
      user1Id: demoUser1.uid,
      user2Id: demoUser2.uid,
      user1XP: 350,
      user2XP: 310,
      winnerId: demoUser1.uid,
      user1BP: 200,
      user2BP: 50,
      user1Result: 'WIN',
      user2Result: 'CLOSE_LOSS',
      resolvedAt: round1Bounds.endDate
    };

    // Round 2 (Active)
    const round2Bounds = calculateRoundBounds(battleStart, 2);
    const demoRound2 = {
      id: 'round_demo_1_r2',
      battleId: demoBattle.id,
      roundNumber: 2,
      startDate: round2Bounds.startDate,
      endDate: round2Bounds.endDate,
      status: 'ACTIVE',
      user1Id: demoUser1.uid,
      user2Id: demoUser2.uid,
      user1XP: 125,
      user2XP: 100
    };

    // Initial transactions for ApexLegend
    const tx1 = TransactionManager.createTransaction({
      userId: demoUser1.uid,
      amount: 25,
      type: 'STUDY_HOUR',
      metadata: { notes: 'Deep math practice' },
      timestamp: new Date().toISOString()
    });
    const tx2 = TransactionManager.createTransaction({
      userId: demoUser1.uid,
      amount: 30,
      type: 'TASK',
      metadata: { difficulty: 'HARD' },
      timestamp: new Date(Date.now() - 3600000).toISOString()
    });

    Storage.set(TABLES.USERS, [demoUser1, demoUser2]);
    Storage.set(TABLES.BATTLES, [demoBattle]);
    Storage.set(TABLES.ROUNDS, [demoRound1, demoRound2]);
    Storage.set(TABLES.TRANSACTIONS, [tx1, tx2]);
    Storage.set(TABLES.INVITES, []);
    Storage.set(TABLES.NOTIFICATIONS, [
      {
        id: 'notif_welcome',
        userId: demoUser1.uid,
        title: 'Welcome to PULSE',
        message: 'Your 1v1 battle against VortexStriker is live. Log XP to lead the round!',
        type: 'SYSTEM',
        read: false,
        createdAt: new Date().toISOString()
      }
    ]);
  }
}

export const DatabaseService = {
  async init() {
    ensureSeedData();
  },

  // ----------------------------------------------------
  // USER PROFILES
  // ----------------------------------------------------
  async createUserProfile(profile) {
    if (FirebaseService.isLive()) {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await setDoc(doc(db, 'users', profile.uid), profile);
      await setDoc(doc(db, 'usernames', profile.username.toLowerCase()), { uid: profile.uid, createdAt: profile.createdAt });
      return profile;
    } else {
      const users = Storage.get(TABLES.USERS, []);
      users.push(profile);
      Storage.set(TABLES.USERS, users);
      return profile;
    }
  },

  async getUserProfile(uid) {
    if (FirebaseService.isLive()) {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const snap = await getDoc(doc(db, 'users', uid));
      return snap.exists() ? snap.data() : null;
    } else {
      const users = Storage.get(TABLES.USERS, []);
      return users.find(u => u.uid === uid) || null;
    }
  },

  async getUserByUsername(username) {
    const clean = (username || '').trim().toLowerCase();
    if (!clean) return null;

    if (FirebaseService.isLive()) {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const uSnap = await getDoc(doc(db, 'usernames', clean));
      if (!uSnap.exists()) return null;
      return await this.getUserProfile(uSnap.data().uid);
    } else {
      const users = Storage.get(TABLES.USERS, []);
      return users.find(u => u.username.toLowerCase() === clean) || null;
    }
  },

  async searchUsers(query, currentUserId) {
    const clean = (query || '').trim().toLowerCase();
    if (!clean) return [];

    if (FirebaseService.isLive()) {
      const { collection, query: fireQuery, where, getDocs, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const q = fireQuery(collection(db, 'users'), limit(10));
      const snap = await getDocs(q);
      const results = [];
      snap.forEach(docSnap => {
        const u = docSnap.data();
        if (u.uid !== currentUserId && u.username.toLowerCase().includes(clean)) {
          results.push(u);
        }
      });
      return results;
    } else {
      const users = Storage.get(TABLES.USERS, []);
      return users.filter(u => u.uid !== currentUserId && u.username.toLowerCase().includes(clean));
    }
  },

  async updateUserProfile(uid, updates) {
    if (FirebaseService.isLive()) {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await updateDoc(doc(db, 'users', uid), updates);
    } else {
      const users = Storage.get(TABLES.USERS, []);
      const index = users.findIndex(u => u.uid === uid);
      if (index !== -1) {
        users[index] = { ...users[index], ...updates };
        Storage.set(TABLES.USERS, users);
      }
    }
  },

  // ----------------------------------------------------
  // XP TRANSACTIONS
  // ----------------------------------------------------
  async addTransaction(transaction) {
    if (FirebaseService.isLive()) {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await setDoc(doc(db, 'users', transaction.userId, 'xpTransactions', transaction.id), transaction);
    } else {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      txs.push(transaction);
      Storage.set(TABLES.TRANSACTIONS, txs);
    }

    // Auto-recalculate user profile
    await this.syncUserCalculations(transaction.userId);
    return transaction;
  },

  async getTransactions(userId) {
    if (FirebaseService.isLive()) {
      const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const q = query(collection(db, 'users', userId, 'xpTransactions'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } else {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      return txs
        .filter(t => t.userId === userId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
  },

  async updateTransaction(userId, transactionId, updates) {
    if (FirebaseService.isLive()) {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await updateDoc(doc(db, 'users', userId, 'xpTransactions', transactionId), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } else {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      const index = txs.findIndex(t => t.id === transactionId && t.userId === userId);
      if (index !== -1) {
        txs[index] = { ...txs[index], ...updates, updatedAt: new Date().toISOString() };
        Storage.set(TABLES.TRANSACTIONS, txs);
      }
    }

    await this.syncUserCalculations(userId);
  },

  async deleteTransaction(userId, transactionId) {
    if (FirebaseService.isLive()) {
      const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await deleteDoc(doc(db, 'users', userId, 'xpTransactions', transactionId));
    } else {
      const txs = Storage.get(TABLES.TRANSACTIONS, []);
      const filtered = txs.filter(t => !(t.id === transactionId && t.userId === userId));
      Storage.set(TABLES.TRANSACTIONS, filtered);
    }

    await this.syncUserCalculations(userId);
  },

  /**
   * Recalculates user XP, level, streak, and syncs active battle round XP
   */
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

    // If user has an active battle, update current round XP
    if (profile.activeBattleId) {
      await this.syncActiveBattleRoundXP(profile.activeBattleId, userId, transactions);
    }
  },

  // ----------------------------------------------------
  // BATTLE INVITES
  // ----------------------------------------------------
  async sendBattleInvite(fromUser, toUser) {
    if (fromUser.activeBattleId) {
      throw new Error('You already have an active battle. Complete or end it first.');
    }
    if (toUser.activeBattleId) {
      throw new Error(`${toUser.username} already has an active battle.`);
    }
    if (fromUser.uid === toUser.uid) {
      throw new Error('You cannot battle yourself.');
    }

    const invite = {
      id: generateId('inv'),
      fromUserId: fromUser.uid,
      fromUsername: fromUser.username,
      fromLevel: fromUser.level,
      toUserId: toUser.uid,
      toUsername: toUser.username,
      status: 'PENDING', // PENDING, ACCEPTED, DECLINED, EXPIRED
      createdAt: new Date().toISOString()
    };

    if (FirebaseService.isLive()) {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await setDoc(doc(db, 'battleInvites', invite.id), invite);
    } else {
      const invites = Storage.get(TABLES.INVITES, []);
      invites.push(invite);
      Storage.set(TABLES.INVITES, invites);
    }

    // Send in-app notification to recipient
    await this.addNotification(toUser.uid, {
      title: '⚔️ New Battle Challenge!',
      message: `${fromUser.username} (Lvl ${fromUser.level}) challenged you to a 1v1 Season Battle.`,
      type: 'BATTLE_INVITE',
      inviteId: invite.id
    });

    return invite;
  },

  async getPendingInvites(userId) {
    if (FirebaseService.isLive()) {
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const q = query(collection(db, 'battleInvites'), where('toUserId', '==', userId), where('status', '==', 'PENDING'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } else {
      const invites = Storage.get(TABLES.INVITES, []);
      return invites.filter(i => i.toUserId === userId && i.status === 'PENDING');
    }
  },

  async respondToInvite(inviteId, accept, battleConfig = {}) {
    let invite = null;
    if (FirebaseService.isLive()) {
      const { doc, getDoc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const snap = await getDoc(doc(db, 'battleInvites', inviteId));
      if (!snap.exists()) throw new Error('Invite not found.');
      invite = snap.data();
      await updateDoc(doc(db, 'battleInvites', inviteId), {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date().toISOString()
      });
    } else {
      const invites = Storage.get(TABLES.INVITES, []);
      const index = invites.findIndex(i => i.id === inviteId);
      if (index === -1) throw new Error('Invite not found.');
      invites[index].status = accept ? 'ACCEPTED' : 'DECLINED';
      invites[index].respondedAt = new Date().toISOString();
      invite = invites[index];
      Storage.set(TABLES.INVITES, invites);
    }

    if (accept) {
      // Create battle
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

  // ----------------------------------------------------
  // BATTLES & ROUNDS
  // ----------------------------------------------------
  async createBattle({ name, user1Id, user1Username, user2Id, user2Username, startDate, endDate }) {
    const battleId = generateId('battle');
    const battle = {
      id: battleId,
      name: name.trim(),
      user1Id,
      user1Username,
      user2Id,
      user2Username,
      participants: [user1Id, user2Id],
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || null,
      status: 'ACTIVE', // ACTIVE, COMPLETED
      currentRound: 1,
      user1TotalBP: 0,
      user2TotalBP: 0,
      user1RoundsWon: 0,
      user2RoundsWon: 0,
      createdAt: new Date().toISOString()
    };

    // Create Round 1
    const round1Bounds = calculateRoundBounds(battle.startDate, 1);
    const round1 = {
      id: generateId('round'),
      battleId: battle.id,
      roundNumber: 1,
      startDate: round1Bounds.startDate,
      endDate: round1Bounds.endDate,
      status: 'ACTIVE',
      user1Id,
      user2Id,
      user1XP: 0,
      user2XP: 0
    };

    if (FirebaseService.isLive()) {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await setDoc(doc(db, 'battles', battleId), battle);
      await setDoc(doc(db, 'battles', battleId, 'rounds', round1.id), round1);
    } else {
      const battles = Storage.get(TABLES.BATTLES, []);
      battles.push(battle);
      Storage.set(TABLES.BATTLES, battles);

      const rounds = Storage.get(TABLES.ROUNDS, []);
      rounds.push(round1);
      Storage.set(TABLES.ROUNDS, rounds);
    }

    // Link active battle to both users
    await this.updateUserProfile(user1Id, { activeBattleId: battleId });
    await this.updateUserProfile(user2Id, { activeBattleId: battleId });

    return battle;
  },

  async getBattle(battleId) {
    if (!battleId) return null;
    if (FirebaseService.isLive()) {
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const snap = await getDoc(doc(db, 'battles', battleId));
      return snap.exists() ? snap.data() : null;
    } else {
      const battles = Storage.get(TABLES.BATTLES, []);
      return battles.find(b => b.id === battleId) || null;
    }
  },

  async getUserActiveBattle(userId) {
    if (!userId) return null;
    const profile = await this.getUserProfile(userId);
    if (!profile || !profile.activeBattleId) return null;
    return await this.getBattle(profile.activeBattleId);
  },

  async getUserBattleHistory(userId) {
    if (!userId) return [];
    if (FirebaseService.isLive()) {
      const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const q = query(collection(db, 'battles'), where('participants', 'array-contains', userId), where('status', '==', 'COMPLETED'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } else {
      const battles = Storage.get(TABLES.BATTLES, []);
      return battles.filter(b => b.participants.includes(userId) && b.status === 'COMPLETED');
    }
  },

  async getRoundsForBattle(battleId) {
    if (!battleId) return [];
    if (FirebaseService.isLive()) {
      const { collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const q = query(collection(db, 'battles', battleId, 'rounds'), orderBy('roundNumber', 'asc'));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } else {
      const rounds = Storage.get(TABLES.ROUNDS, []);
      return rounds
        .filter(r => r.battleId === battleId)
        .sort((a, b) => a.roundNumber - b.roundNumber);
    }
  },

  async syncActiveBattleRoundXP(battleId, userId, userTransactions = null) {
    const battle = await this.getBattle(battleId);
    if (!battle || battle.status !== 'ACTIVE') return;

    const roundInfo = getCurrentRoundInfo(battle.startDate, battle.endDate);
    const rounds = await this.getRoundsForBattle(battleId);

    // Find or create current active round
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

      if (FirebaseService.isLive()) {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const db = FirebaseService.getDb();
        await setDoc(doc(db, 'battles', battleId, 'rounds', currentRound.id), currentRound);
      } else {
        const allRounds = Storage.get(TABLES.ROUNDS, []);
        allRounds.push(currentRound);
        Storage.set(TABLES.ROUNDS, allRounds);
      }
    }

    const txs = userTransactions || await this.getTransactions(userId);
    const calculatedXP = TransactionManager.calculateXPInWindow(txs, currentRound.startDate, currentRound.endDate);

    const isUser1 = battle.user1Id === userId;
    const updates = isUser1 ? { user1XP: calculatedXP } : { user2XP: calculatedXP };

    if (FirebaseService.isLive()) {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await updateDoc(doc(db, 'battles', battleId, 'rounds', currentRound.id), updates);
    } else {
      const allRounds = Storage.get(TABLES.ROUNDS, []);
      const idx = allRounds.findIndex(r => r.id === currentRound.id);
      if (idx !== -1) {
        allRounds[idx] = { ...allRounds[idx], ...updates };
        Storage.set(TABLES.ROUNDS, allRounds);
      }
    }
  },

  /**
   * End a battle manually or on season conclusion
   */
  async endBattle(battleId) {
    const battle = await this.getBattle(battleId);
    if (!battle) return null;

    const rounds = await this.getRoundsForBattle(battleId);
    
    // Resolve any active rounds
    const resolvedRounds = rounds.map(r => {
      if (r.status === 'ACTIVE') {
        const resolved = BattleEngine.resolveRound(r.roundNumber, r.user1XP, r.user2XP, r.user1Id, r.user2Id);
        return {
          ...r,
          ...resolved,
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

    if (FirebaseService.isLive()) {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await updateDoc(doc(db, 'battles', battleId), updates);
      for (const r of resolvedRounds) {
        await updateDoc(doc(db, 'battles', battleId, 'rounds', r.id), r);
      }
    } else {
      const battles = Storage.get(TABLES.BATTLES, []);
      const bIdx = battles.findIndex(b => b.id === battleId);
      if (bIdx !== -1) {
        battles[bIdx] = { ...battles[bIdx], ...updates };
        Storage.set(TABLES.BATTLES, battles);
      }
      Storage.set(TABLES.ROUNDS, resolvedRounds);
    }

    // Free both users from active battle
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

  // ----------------------------------------------------
  // IN-APP NOTIFICATIONS
  // ----------------------------------------------------
  async addNotification(userId, { title, message, type = 'SYSTEM', inviteId = null, battleId = null }) {
    const notif = {
      id: generateId('notif'),
      userId,
      title,
      message,
      type,
      inviteId,
      battleId,
      read: false,
      createdAt: new Date().toISOString()
    };

    if (FirebaseService.isLive()) {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await setDoc(doc(db, 'users', userId, 'notifications', notif.id), notif);
    } else {
      const list = Storage.get(TABLES.NOTIFICATIONS, []);
      list.unshift(notif);
      Storage.set(TABLES.NOTIFICATIONS, list);
    }

    return notif;
  },

  async getNotifications(userId) {
    if (FirebaseService.isLive()) {
      const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      const q = query(collection(db, 'users', userId, 'notifications'), orderBy('createdAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach(d => list.push(d.data()));
      return list;
    } else {
      const list = Storage.get(TABLES.NOTIFICATIONS, []);
      return list.filter(n => n.userId === userId).slice(0, 30);
    }
  },

  async markNotificationAsRead(userId, notifId) {
    if (FirebaseService.isLive()) {
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const db = FirebaseService.getDb();
      await updateDoc(doc(db, 'users', userId, 'notifications', notifId), { read: true });
    } else {
      const list = Storage.get(TABLES.NOTIFICATIONS, []);
      const n = list.find(item => item.id === notifId && item.userId === userId);
      if (n) {
        n.read = true;
        Storage.set(TABLES.NOTIFICATIONS, list);
      }
    }
  }
};
