'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { saveGame, loadGame, subscribeToGame, deleteGame, updatePlayerStats, GAME_EXPIRY_MS } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';

const EMPTY = 0;
const RED = 1;
const BLUE = 2;

const RED_COLOR = '#DC2626';
const BLUE_COLOR = '#2563EB';
const RED_LIGHT = '#FEE2E2';
const BLUE_LIGHT = '#DBEAFE';
const RED_GHOST = 'rgba(220,38,38,0.18)';
const BLUE_GHOST = 'rgba(37,99,235,0.22)';
const BORDER = '#E5E5E5';
const TEXT = '#1C1917';
const TEXT_MUTED = '#78716C';

const canPlace2x2 = (board, r, c) => {
  const size = board.length;
  if (r < 0 || c < 0 || r + 1 >= size || c + 1 >= size) return false;
  return board[r][c] === EMPTY && board[r][c + 1] === EMPTY && board[r + 1][c] === EMPTY && board[r + 1][c + 1] === EMPTY;
};

const hasValidMoveB = (board) => {
  const size = board.length;
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (canPlace2x2(board, r, c)) return true;
  return false;
};

const hasValidMoveR = (board) => {
  const size = board.length;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (board[r][c] === EMPTY) return true;
  return false;
};

const countCells = (board) => {
  let red = 0, blue = 0, empty = 0;
  board.forEach((row) => row.forEach((v) => {
    if (v === RED) red++;
    else if (v === BLUE) blue++;
    else empty++;
  }));
  return { red, blue, empty };
};

const cloneBoard = (b) => b.map((r) => [...r]);

const finishBoard = (board) => {
  const size = board.length;
  const b = cloneBoard(board);
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (b[r][c] === EMPTY) b[r][c] = RED;
  return b;
};

const formatTime = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code?.toUpperCase();

  const [gameState, setGameState] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoverCell, setHoverCell] = useState(null);
  const [selectedMove, setSelectedMove] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(GAME_EXPIRY_MS);
  const [expired, setExpired] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const { user, loading: authLoading, signInWithGoogle } = useAuth();

  // Initialize game
  useEffect(() => {
    if (!code) return;
    const init = async () => {
      const storedPlayer = localStorage.getItem(`colorwar_${code}_player`);
      const storedRole = localStorage.getItem(`colorwar_${code}_role`);
      const state = await loadGame(code);

      if (!state) {
        setError('Game not found');
        setLoading(false);
        return;
      }

      // Check if game expired (only for waiting games)
      if (state.status === 'waiting') {
        const elapsed = Date.now() - state.createdAt;
        if (elapsed >= GAME_EXPIRY_MS) {
          await deleteGame(code);
          setExpired(true);
          setLoading(false);
          return;
        }
        setTimeRemaining(GAME_EXPIRY_MS - elapsed);
      }

      if (storedPlayer && storedRole) {
        setPlayerId(storedPlayer);
        setMyRole(storedRole);
      } else if (!state.playerR) {
        const newPlayerId = Math.random().toString(36).slice(2, 14);
        state.playerR = newPlayerId;
        state.uidR = user?.uid || null;
        state.nameR = user?.displayName || null;
        state.status = 'playing';
        if (!state.statsUpdated && state.statsUpdated !== false) {
          state.statsUpdated = false;
        }
        await saveGame(code, state);
        localStorage.setItem(`colorwar_${code}_player`, newPlayerId);
        localStorage.setItem(`colorwar_${code}_role`, 'R');
        setPlayerId(newPlayerId);
        setMyRole('R');
      } else {
        setError('This game already has two players');
        setLoading(false);
        return;
      }

      setGameState(state);
      setLoading(false);
    };
    init();
  }, [code]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!code || loading || expired) return;
    const unsubscribe = subscribeToGame(code, (state) => {
      if (state === null) {
        // Game was deleted (expired)
        setExpired(true);
      } else {
        setGameState(state);
      }
    });
    return () => unsubscribe();
  }, [code, loading, expired]);

  // Countdown timer for waiting games
  useEffect(() => {
    if (!gameState || gameState.status !== 'waiting' || expired) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.createdAt;
      const remaining = GAME_EXPIRY_MS - elapsed;
      
      if (remaining <= 0) {
        setExpired(true);
        deleteGame(code);
        clearInterval(interval);
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, code, expired]);

  // Redirect after expiry
  useEffect(() => {
    if (expired) {
      const timeout = setTimeout(() => {
        router.push('/?expired=true');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [expired, router]);

  // Mid-game auth linking: if user signs in while playing, link uid to game
  useEffect(() => {
    if (!user || !gameState || !myRole || gameState.status === 'finished') return;
    const uidField = myRole === 'B' ? 'uidB' : 'uidR';
    const nameField = myRole === 'B' ? 'nameB' : 'nameR';
    if (!gameState[uidField] && user.uid) {
      saveGame(code, { ...gameState, [uidField]: user.uid, [nameField]: user.displayName || null });
    }
  }, [user, gameState, myRole, code]);

  // Stats update when game finishes
  useEffect(() => {
    if (!gameState || gameState.status !== 'finished' || gameState.statsUpdated) return;
    const doUpdate = async () => {
      const { uidB, uidR, nameB, nameR, winner } = gameState;
      const resultForB = winner === 'B' ? 'won' : winner === 'R' ? 'lost' : 'tied';
      const resultForR = winner === 'R' ? 'won' : winner === 'B' ? 'lost' : 'tied';

      if (uidB) await updatePlayerStats(uidB, nameB, null, resultForB);
      if (uidR) await updatePlayerStats(uidR, nameR, null, resultForR);

      await saveGame(code, { ...gameState, statsUpdated: true });
    };
    doUpdate();
  }, [gameState?.status, gameState?.statsUpdated]);

  // Show auth prompt after game ends for non-signed-in users
  useEffect(() => {
    if (gameState?.status === 'finished' && !user && !authLoading) {
      const timeout = setTimeout(() => {
        setShowAuthPrompt(true);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [gameState?.status, user, authLoading]);

  // Retroactive sign-in: if user signs in via post-game modal, link uid and update stats
  useEffect(() => {
    if (!user || !gameState || gameState.status !== 'finished' || !myRole) return;
    const uidField = myRole === 'B' ? 'uidB' : 'uidR';
    if (!gameState[uidField] && user.uid) {
      const nameField = myRole === 'B' ? 'nameB' : 'nameR';
      const result = gameState.winner === myRole ? 'won' : gameState.winner === 'tie' ? 'tied' : 'lost';
      updatePlayerStats(user.uid, user.displayName, user.email, result);
      saveGame(code, { ...gameState, [uidField]: user.uid, [nameField]: user.displayName || null });
      setShowAuthPrompt(false);
    }
  }, [user, gameState?.status]);

  const isMyTurn = gameState && gameState.turn === myRole && gameState.status === 'playing';
  const screen = expired ? 'expired' : !gameState ? 'loading' : gameState.status === 'waiting' ? 'invite' : gameState.status === 'finished' ? 'finished' : 'playing';

  const handleCellClick = (r, c) => {
    if (!isMyTurn || !gameState) return;
    if (myRole === 'R') {
      if (gameState.board[r][c] !== EMPTY) return;
      setSelectedMove({ row: r, col: c });
    } else {
      if (canPlace2x2(gameState.board, r, c)) setSelectedMove({ row: r, col: c, is2x2: true });
    }
  };

  const handleCellHover = (r, c) => {
    if (!isMyTurn || !gameState) { setHoverCell(null); return; }
    if (myRole === 'R') setHoverCell(gameState.board[r][c] === EMPTY ? { row: r, col: c } : null);
    else setHoverCell(canPlace2x2(gameState.board, r, c) ? { row: r, col: c, is2x2: true } : null);
  };

  const confirmMove = async () => {
    if (!selectedMove || !gameState) return;
    const newBoard = cloneBoard(gameState.board);
    if (myRole === 'R') {
      newBoard[selectedMove.row][selectedMove.col] = RED;
    } else {
      const { row, col } = selectedMove;
      newBoard[row][col] = BLUE;
      newBoard[row][col + 1] = BLUE;
      newBoard[row + 1][col] = BLUE;
      newBoard[row + 1][col + 1] = BLUE;
    }
    const nextTurn = myRole === 'B' ? 'R' : 'B';
    let status = 'playing', winner = null, finalBoard = newBoard;
    const nextCanMove = nextTurn === 'B' ? hasValidMoveB(newBoard) : hasValidMoveR(newBoard);
    if (!nextCanMove) {
      finalBoard = finishBoard(newBoard);
      status = 'finished';
      const counts = countCells(finalBoard);
      winner = counts.red > counts.blue ? 'R' : counts.blue > counts.red ? 'B' : 'tie';
    }
    await saveGame(code, { ...gameState, board: finalBoard, turn: nextTurn, status, winner });
    setSelectedMove(null);
    setHoverCell(null);
  };

  const cancelMove = () => setSelectedMove(null);

  const gameUrl = typeof window !== 'undefined' ? `${window.location.origin}/game/${code}` : '';
  const whatsappMsg = `🟦🟥 Let's play ColorWar!\n\nI challenge you to a board coloring duel.\n\nTap to join: ${gameUrl}`;

  const copyLink = () => {
    navigator.clipboard.writeText(gameUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const skipAuthPrompt = () => {
    setShowAuthPrompt(false);
  };

  const isGhost = (r, c) => {
    if (!hoverCell || selectedMove) return false;
    if (myRole === 'R') return hoverCell.row === r && hoverCell.col === c;
    if (hoverCell.is2x2) return r >= hoverCell.row && r <= hoverCell.row + 1 && c >= hoverCell.col && c <= hoverCell.col + 1;
    return false;
  };

  const isSelected = (r, c) => {
    if (!selectedMove) return false;
    if (myRole === 'R') return selectedMove.row === r && selectedMove.col === c;
    if (selectedMove.is2x2) return r >= selectedMove.row && r <= selectedMove.row + 1 && c >= selectedMove.col && c <= selectedMove.col + 1;
    return false;
  };

  const getCellStyle = (r, c) => {
    const val = gameState?.board[r][c];
    if (val === RED) return { background: RED_COLOR };
    if (val === BLUE) return { background: BLUE_COLOR };
    if (isSelected(r, c)) return { background: myRole === 'R' ? RED_COLOR : BLUE_COLOR, opacity: 0.7, transition: 'all 0.15s ease' };
    if (isGhost(r, c)) return { background: myRole === 'R' ? RED_GHOST : BLUE_GHOST, transition: 'all 0.12s ease' };
    return { background: '#fff', transition: 'all 0.12s ease' };
  };

  const boardSize = gameState?.board?.length || 9;
  const counts = gameState ? countCells(gameState.board) : { red: 0, blue: 0, empty: boardSize * boardSize };
  const total = boardSize * boardSize;

  const Header = () => (
    <div style={{ width: '100%', maxWidth: 440, padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => router.push('/')}>
        <div style={{ display: 'flex', gap: 2 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: BLUE_COLOR }} />
          <div style={{ width: 10, height: 10, borderRadius: 2, background: BLUE_COLOR }} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>ColorWar</span>
        <div style={{ width: 5, height: 5, borderRadius: 1, background: RED_COLOR }} />
      </div>
      <button onClick={() => setShowRules(true)} style={{ background: 'none', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: TEXT_MUTED, cursor: 'pointer' }}>Rules</button>
    </div>
  );

  const RulesOverlay = () => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }} onClick={() => setShowRules(false)}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 380, width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.15)' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: TEXT }}>How to play</h3>
        <div style={{ fontSize: 14, lineHeight: 1.75, color: TEXT_MUTED }}>
          <p style={{ margin: '0 0 10px' }}><span style={{ color: BLUE_COLOR, fontWeight: 600 }}>Blue</span> and <span style={{ color: RED_COLOR, fontWeight: 600 }}>Red</span> take turns on a {boardSize}×{boardSize} board.</p>
          <p style={{ margin: '0 0 10px' }}>Blue goes first — places a <strong>2×2 block</strong> each turn.</p>
          <p style={{ margin: '0 0 10px' }}>Red places <strong>one cell</strong> each turn.</p>
          <p style={{ margin: '0 0 10px' }}>Game ends when a player can't move.</p>
          <p style={{ margin: '0 0 10px' }}>All remaining cells become <span style={{ color: RED_COLOR, fontWeight: 600 }}>red</span>.</p>
          <p style={{ margin: 0, fontWeight: 500, color: TEXT }}>Most cells wins!</p>
        </div>
        <button onClick={() => setShowRules(false)} style={{ marginTop: 20, width: '100%', padding: '10px 0', background: TEXT, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Got it</button>
      </div>
    </div>
  );

  const AuthPromptModal = () => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, animation: 'fadeIn 0.3s ease' }} onClick={skipAuthPrompt}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 360, width: '100%', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', animation: 'slideUp 0.3s ease' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600, color: TEXT }}>Track your wins</h3>
          <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0, lineHeight: 1.5 }}>
            Sign in to save your stats and<br />
            compete on the leaderboard.
          </p>
        </div>

        <button onClick={signInWithGoogle} style={{
          width: '100%',
          padding: '12px 0',
          background: '#fff',
          color: TEXT,
          border: `1.5px solid ${BORDER}`,
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sign in with Google
        </button>

        <button onClick={skipAuthPrompt} style={{
          width: '100%',
          padding: '10px 0',
          background: 'none',
          color: TEXT_MUTED,
          border: 'none',
          fontSize: 13,
          cursor: 'pointer',
        }}>
          Maybe later
        </button>
      </div>
    </div>
  );

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={{ color: TEXT_MUTED }}>Loading game...</p></div>;

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ color: RED_COLOR, fontSize: 16 }}>{error}</p>
        <button onClick={() => router.push('/')} style={{ padding: '12px 24px', background: TEXT, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Go Home</button>
      </div>
    </div>
  );

  // Expired screen
  if (screen === 'expired') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Header />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>⏰</div>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: TEXT, margin: 0 }}>Game Expired</h2>
        <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>No one joined within 5 minutes.</p>
        <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0 }}>Redirecting to home...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {showRules && <RulesOverlay />}
      {showAuthPrompt && <AuthPromptModal />}
      <Header />

      {/* INVITE SCREEN */}
      {screen === 'invite' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, maxWidth: 340, width: '100%', animation: 'slideUp 0.3s ease' }}>
          
          {/* Countdown timer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: timeRemaining < 60000 ? RED_LIGHT : '#FEF3C7',
            borderRadius: 20,
            animation: timeRemaining < 60000 ? 'countdownPulse 1s ease infinite' : 'none',
          }}>
            <span style={{ fontSize: 13, color: timeRemaining < 60000 ? RED_COLOR : '#B45309' }}>
              ⏱️ Link expires in <strong>{formatTime(timeRemaining)}</strong>
            </span>
          </div>

          <p style={{ fontSize: 14, fontWeight: 500, color: TEXT, margin: 0, textAlign: 'center' }}>
            Send this link to your opponent:
          </p>
          
          <div style={{ width: '100%', background: '#fff', borderRadius: 14, border: `1.5px solid ${BORDER}`, padding: 16, textAlign: 'center', wordBreak: 'break-all', fontSize: 13, fontFamily: "'IBM Plex Mono', monospace", color: TEXT_MUTED }}>{gameUrl}</div>
          
          <a href={`https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`} target="_blank" rel="noopener noreferrer" style={{ width: '100%', padding: '13px 0', background: '#25D366', color: '#fff', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Send via WhatsApp
          </a>
          
          <button onClick={copyLink} style={{ width: '100%', padding: '12px 0', background: '#fff', color: copied ? '#059669' : TEXT, border: `1.5px solid ${copied ? '#059669' : BORDER}`, borderRadius: 11, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease' }}>{copied ? '✓ Link copied!' : 'Copy link'}</button>
          
          {/* Status indicator */}
          <div style={{
            width: '100%',
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '14px 16px',
            marginTop: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Waiting for opponent...</span>
            </div>
            <p style={{ fontSize: 12, color: TEXT_MUTED, margin: 0, lineHeight: 1.5 }}>
              The game board will appear automatically as soon as they open the link. You don't need to refresh.
            </p>
          </div>

          <p style={{ fontSize: 11, color: TEXT_MUTED, opacity: 0.7, margin: 0 }}>
            You're <span style={{ color: BLUE_COLOR, fontWeight: 600 }}>Blue</span> (2×2 blocks) · You go first
          </p>
        </div>
      )}

      {/* PLAYING / FINISHED */}
      {(screen === 'playing' || screen === 'finished') && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 16px 20px', maxWidth: 440, width: '100%', gap: 10, animation: 'slideUp 0.25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '6px 0' }}>
            <span style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: "'IBM Plex Mono', monospace", opacity: 0.5 }}>#{code}</span>
            <div style={{ fontSize: 13, fontWeight: 600, color: screen === 'finished' ? (gameState.winner === myRole ? '#059669' : gameState.winner === 'tie' ? TEXT_MUTED : RED_COLOR) : (isMyTurn ? '#059669' : TEXT_MUTED), display: 'flex', alignItems: 'center', gap: 6 }}>
              {screen !== 'finished' && !isMyTurn && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', animation: 'pulse 1.5s ease-in-out infinite', display: 'inline-block' }} />}
              {screen === 'finished' ? (gameState.winner === 'tie' ? 'Tie game' : gameState.winner === myRole ? 'You won!' : 'You lost') : (isMyTurn ? 'Your turn' : 'Waiting...')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, width: '100%', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: myRole === 'B' ? BLUE_LIGHT : RED_LIGHT, color: myRole === 'B' ? BLUE_COLOR : RED_COLOR, border: `1px solid ${myRole === 'B' ? BLUE_COLOR : RED_COLOR}22` }}>{(myRole === 'B' ? gameState.nameB : gameState.nameR)?.split(' ')[0] || 'You'}: {myRole === 'B' ? 'Blue 2×2' : 'Red 1×1'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 7, fontSize: 11, fontWeight: 500, background: myRole === 'B' ? RED_LIGHT : BLUE_LIGHT, color: myRole === 'B' ? RED_COLOR : BLUE_COLOR, border: `1px solid ${myRole === 'B' ? RED_COLOR : BLUE_COLOR}18`, opacity: 0.5 }}>{(myRole === 'B' ? gameState.nameR : gameState.nameB)?.split(' ')[0] || 'Opp'}: {myRole === 'B' ? 'Red 1×1' : 'Blue 2×2'}</div>
          </div>

          <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500 }}>
              <span style={{ color: BLUE_COLOR }}>{counts.blue}</span>
              <span style={{ color: TEXT_MUTED, opacity: 0.4 }}>{counts.empty > 0 ? `${counts.empty} empty` : ''}</span>
              <span style={{ color: RED_COLOR }}>{counts.red}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: '#E7E5E4', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(counts.blue / total) * 100}%`, background: BLUE_COLOR, borderRadius: '3px 0 0 3px', transition: 'width 0.3s ease' }} />
              <div style={{ flex: 1 }} />
              <div style={{ width: `${(counts.red / total) * 100}%`, background: RED_COLOR, borderRadius: '0 3px 3px 0', transition: 'width 0.3s ease' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${boardSize}, 1fr)`, gap: 1.5, background: BORDER, borderRadius: 10, padding: 1.5, width: '100%', maxWidth: 380, aspectRatio: '1 / 1', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', userSelect: 'none' }} onMouseLeave={() => setHoverCell(null)}>
            {gameState.board.map((row, r) => row.map((cell, c) => (
              <div key={`${r}-${c}`} onClick={() => handleCellClick(r, c)} onMouseEnter={() => handleCellHover(r, c)} style={{ ...getCellStyle(r, c), borderRadius: r === 0 && c === 0 ? '8px 0 0 0' : r === 0 && c === boardSize - 1 ? '0 8px 0 0' : r === boardSize - 1 && c === 0 ? '0 0 0 8px' : r === boardSize - 1 && c === boardSize - 1 ? '0 0 8px 0' : 0, cursor: isMyTurn && cell === EMPTY ? 'pointer' : 'default' }} />
            )))}
          </div>

          {screen === 'playing' && (
            <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 380 }}>
              {selectedMove ? (
                <>
                  <button onClick={cancelMove} style={{ flex: 1, padding: '12px 0', background: '#fff', color: TEXT_MUTED, border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={confirmMove} style={{ flex: 2, padding: '12px 0', background: myRole === 'B' ? BLUE_COLOR : RED_COLOR, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Confirm Move</button>
                </>
              ) : (
                <div style={{ width: '100%', textAlign: 'center', padding: '12px 0', fontSize: 12, color: TEXT_MUTED, fontStyle: 'italic' }}>
                  {isMyTurn ? (myRole === 'B' ? 'Tap a cell to preview your 2×2 block, then confirm' : 'Tap any empty cell to place your piece, then confirm') : 'Opponent is thinking...'}
                </div>
              )}
            </div>
          )}

          {screen === 'finished' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 380, alignItems: 'center', animation: 'slideUp 0.3s ease' }}>
              <div style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', padding: '4px 0', color: gameState.winner === 'tie' ? TEXT_MUTED : (gameState.winner === myRole ? '#059669' : RED_COLOR) }}>{gameState.winner === 'tie' ? 'Draw!' : gameState.winner === myRole ? '🎉 Victory!' : 'Defeated'}</div>
              <div style={{ fontSize: 13, color: TEXT_MUTED }}><span style={{ color: BLUE_COLOR, fontWeight: 600 }}>{countCells(gameState.board).blue} blue</span> vs <span style={{ color: RED_COLOR, fontWeight: 600 }}>{countCells(gameState.board).red} red</span></div>
              <button onClick={() => router.push('/')} style={{ marginTop: 6, padding: '12px 36px', background: TEXT, color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>New Game</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
