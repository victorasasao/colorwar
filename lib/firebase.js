import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
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

// Game expiry constant (5 minutes)
export const GAME_EXPIRY_MS = 5 * 60 * 1000;
