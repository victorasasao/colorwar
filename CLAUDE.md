# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run dev      # Start dev server on localhost:3000
npm run build    # Production build
npm start        # Start production server
```

There are no tests or linting configured in this project.

## Architecture

ColorWar is a real-time multiplayer board game (Next.js 14 App Router + Firebase Realtime Database). Two players compete on a 9×9 grid — Blue places 2×2 blocks, Red places 1×1 cells.

### Core Files

- **`app/page.js`** — Home screen: create game (generates 6-char code), join game, rules modal
- **`app/game/[code]/page.js`** — Game room: handles invite/waiting, playing, and finished screens. Contains all game logic (move validation, turn flow, win detection) client-side
- **`lib/firebase.js`** — Firebase wrapper: `saveGame`, `loadGame`, `deleteGame`, `subscribeToGame`, `saveEmail`. All game state syncs through Firebase Realtime Database
- **`app/globals.css`** — Keyframe animations (pulse, slideUp, fadeIn, countdownPulse)

### Game State Model

```javascript
{
  board: [[0|1|2, ...], ...],  // 9×9 grid (0=empty, 1=blue, 2=red)
  turn: 'B' | 'R',
  playerB: string,             // 12-char random ID
  playerR: string | null,      // null until opponent joins
  status: 'waiting' | 'playing' | 'finished',
  winner: null | 'B' | 'R' | 'tie',
  createdAt: timestamp
}
```

### Key Design Decisions

- **All game logic is client-side** — Firebase is only used as a state store and real-time sync layer. Move validation, turn switching, and end-game detection happen in the browser.
- **Inline CSS throughout** — No CSS modules or Tailwind. Styles are JS objects using a consistent color/font system (Outfit for text, IBM Plex Mono for game codes).
- **Games expire after 5 minutes** (`GAME_EXPIRY_MS` in firebase.js) if the second player doesn't join. The invite screen shows a countdown timer.
- **Player identity** uses random 12-char IDs stored in localStorage, keyed by game code.
- **Game codes** are 6-char alphanumeric strings that exclude ambiguous characters (I, O, l, 0).
- **WhatsApp sharing** is the primary invite mechanism — the invite screen generates a pre-formatted WhatsApp link.
- **Email capture** is shown once post-game (tracked via localStorage to prevent repeat prompts).

### Environment Variables

Firebase config is loaded from `NEXT_PUBLIC_FIREBASE_*` environment variables (apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId).
