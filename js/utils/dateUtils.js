/**
 * Date and Time utilities for PULSE
 * Strictly handles local calendar day boundaries and weekly round calculations
 */

/**
 * Returns ISO date string (YYYY-MM-DD) for local calendar day
 */
export function getLocalCalendarDate(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes date to the beginning of the local calendar day (00:00:00.000)
 */
export function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Normalizes date to the end of the local calendar day (23:59:59.999)
 */
export function endOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Computes difference in whole calendar days between two dates
 */
export function diffInCalendarDays(dateA, dateB) {
  const startA = startOfLocalDay(dateA).getTime();
  const startB = startOfLocalDay(dateB).getTime();
  const diffMs = startA - startB;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Generates round boundaries for a battle
 * Each round is 7 calendar days starting from the battle start day
 */
export function calculateRoundBounds(battleStartDate, roundNumber = 1) {
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

/**
 * Determines current active round number and boundaries for a battle
 */
export function getCurrentRoundInfo(battleStartDate, battleEndDate = null, currentDate = new Date()) {
  const start = startOfLocalDay(new Date(battleStartDate));
  const now = new Date(currentDate);

  if (now < start) {
    // Battle hasn't started yet
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

  // Check if battle has reached its end date
  let isBattleFinished = false;
  if (battleEndDate) {
    const end = endOfLocalDay(new Date(battleEndDate));
    if (now > end) {
      isBattleFinished = true;
    }
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

/**
 * Format date for display: "Oct 24, 2026"
 */
export function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format short date: "Oct 24"
 */
export function formatShortDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format relative time: "2 hours ago", "Just now"
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diffSeconds = Math.floor((now - d) / 1000);

  if (diffSeconds < 60) return 'Just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return formatShortDate(d);
}
