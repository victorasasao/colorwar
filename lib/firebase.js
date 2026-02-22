import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
export { app };
const db = getDatabase(app);

// Game functions
export const saveGame = async (code, state) => {
  try {
    await set(ref(db, `games/${code}`), state);
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
};

export const loadGame = async (code) => {
  try {
    const snapshot = await get(ref(db, `games/${code}`));
    return snapshot.exists() ? snapshot.val() : null;
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
};

export const deleteGame = async (code) => {
  try {
    await remove(ref(db, `games/${code}`));
    return true;
  } catch (e) {
    console.error('Delete failed:', e);
    return false;
  }
};

export const subscribeToGame = (code, callback) => {
  const gameRef = ref(db, `games/${code}`);
  return onValue(gameRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });
};

// Email capture functions
export const saveEmail = async (email, context = {}) => {
  try {
    const emailKey = email.replace(/[.#$\[\]]/g, '_');
    await set(ref(db, `emails/${emailKey}`), {
      email,
      capturedAt: Date.now(),
      gamesPlayed: context.gamesPlayed || 1,
      lastGameCode: context.gameCode || null,
      source: 'colorwar',
    });
    return true;
  } catch (e) {
    console.error('Email save failed:', e);
    return false;
  }
};

// Player stats functions
export const updatePlayerStats = async (uid, displayName, email, result) => {
  try {
    const playerRef = ref(db, `players/${uid}`);
    const snapshot = await get(playerRef);
    const existing = snapshot.exists() ? snapshot.val() : {
      displayName: '',
      email: '',
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      gamesTied: 0,
      winRate: 0,
    };

    existing.displayName = displayName || existing.displayName;
    existing.email = email || existing.email;
    existing.gamesPlayed += 1;
    if (result === 'won') existing.gamesWon += 1;
    else if (result === 'lost') existing.gamesLost += 1;
    else if (result === 'tied') existing.gamesTied += 1;
    existing.winRate = existing.gamesPlayed > 0
      ? Math.round((existing.gamesWon / existing.gamesPlayed) * 100)
      : 0;
    existing.lastPlayedAt = Date.now();

    await set(playerRef, existing);
    return true;
  } catch (e) {
    console.error('Stats update failed:', e);
    return false;
  }
};

export const loadLeaderboard = async () => {
  try {
    const snapshot = await get(ref(db, 'players'));
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    const players = Object.entries(data).map(([uid, p]) => ({ uid, ...p }));

    const qualified = players.filter((p) => p.gamesPlayed >= 5);
    const unqualified = players.filter((p) => p.gamesPlayed < 5);

    qualified.sort((a, b) => b.winRate - a.winRate || b.gamesWon - a.gamesWon);
    unqualified.sort((a, b) => b.gamesWon - a.gamesWon);

    return [...qualified, ...unqualified];
  } catch (e) {
    console.error('Leaderboard load failed:', e);
    return [];
  }
};

// Game expiry constant (5 minutes)
export const GAME_EXPIRY_MS = 5 * 60 * 1000;
