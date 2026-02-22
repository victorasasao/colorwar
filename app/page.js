'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveGame } from '../lib/firebase';

const BOARD_SIZES = [
  { size: 6, time: '~3 min' },
  { size: 7, time: '~4 min' },
  { size: 8, time: '~6 min' },
  { size: 9, time: '~8 min' },
  { size: 10, time: '~12 min' },
  { size: 11, time: '~15 min' },
  { size: 12, time: '~20 min' },
];
const DEFAULT_SIZE = 9;
const BORDER = '#E5E5E5';
const TEXT = '#1C1917';
const TEXT_MUTED = '#78716C';
const BLUE_COLOR = '#2563EB';
const RED_COLOR = '#DC2626';

const genId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = '';
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
};

const createBoard = (size) => Array.from({ length: size }, () => Array(size).fill(0));

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSizeSelect, setShowSizeSelect] = useState(false);

  const createGame = async (boardSize) => {
    setCreating(true);
    const code = genId();
    const playerId = Math.random().toString(36).slice(2, 14);

    const state = {
      board: createBoard(boardSize),
      boardSize,
      turn: 'B',
      playerB: playerId,
      playerR: null,
      status: 'waiting',
      winner: null,
      createdAt: Date.now(),
    };

    await saveGame(code, state);

    localStorage.setItem(`colorwar_${code}_player`, playerId);
    localStorage.setItem(`colorwar_${code}_role`, 'B');

    router.push(`/game/${code}`);
  };

  const joinGame = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Enter the game code from your friend');
      return;
    }
    if (code.length !== 6) {
      setJoinError('Code should be 6 characters');
      return;
    }
    router.push(`/game/${code}`);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Header */}
      <div style={{
        width: '100%',
        maxWidth: 440,
        padding: '16px 20px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: BLUE_COLOR }} />
            <div style={{ width: 10, height: 10, borderRadius: 2, background: BLUE_COLOR }} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>ColorWar</span>
          <div style={{ width: 5, height: 5, borderRadius: 1, background: RED_COLOR }} />
        </div>
        <button
          onClick={() => setShowRules(true)}
          style={{
            background: 'none',
            border: `1.5px solid ${BORDER}`,
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 500,
            color: TEXT_MUTED,
            cursor: 'pointer',
          }}
        >
          Rules
        </button>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 20,
        maxWidth: 360,
        width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            Board Coloring Duel
          </h1>
          <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
            Challenge a friend to a strategy game.
            <br />
            <span style={{ color: BLUE_COLOR, fontWeight: 500 }}>Blue</span> places 2×2 blocks, <span style={{ color: RED_COLOR, fontWeight: 500 }}>Red</span> places single cells.
          </p>
        </div>

        {/* How it works */}
        <div style={{
          width: '100%',
          background: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '14px 16px',
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: TEXT_MUTED, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            How it works
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: BLUE_COLOR, minWidth: 18 }}>1.</span>
              <span style={{ fontSize: 13, color: TEXT, lineHeight: 1.4 }}>Create a game and share the link via WhatsApp</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: BLUE_COLOR, minWidth: 18 }}>2.</span>
              <span style={{ fontSize: 13, color: TEXT, lineHeight: 1.4 }}>When your friend opens the link, the board appears instantly</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: BLUE_COLOR, minWidth: 18 }}>3.</span>
              <span style={{ fontSize: 13, color: TEXT, lineHeight: 1.4 }}>Take turns at your own pace — like chess!</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSizeSelect(true)}
          style={{
            width: '100%',
            padding: '14px 0',
            background: TEXT,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Create Game
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          color: TEXT_MUTED,
          fontSize: 11,
        }}>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span>got a code?</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <input
            type="text"
            placeholder="Enter code"
            maxLength={6}
            value={joinCode}
            onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && joinGame()}
            style={{
              flex: 1,
              padding: '12px 14px',
              border: `1.5px solid ${BORDER}`,
              borderRadius: 10,
              fontSize: 16,
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              outline: 'none',
              background: '#fff',
              color: TEXT,
              textAlign: 'center',
            }}
          />
          <button
            onClick={joinGame}
            style={{
              padding: '12px 20px',
              background: '#fff',
              color: TEXT,
              border: `1.5px solid ${TEXT}`,
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Join
          </button>
        </div>
        {joinError && <p style={{ color: RED_COLOR, fontSize: 12, margin: 0 }}>{joinError}</p>}
      </div>

      {/* Board size selection modal */}
      {showSizeSelect && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => { if (!creating) setShowSizeSelect(false); }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '24px 20px',
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
              animation: 'slideUp 0.25s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 600, color: TEXT }}>
              Choose board size
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: TEXT_MUTED }}>
              Larger boards take longer to play
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {BOARD_SIZES.map(({ size, time }) => (
                <button
                  key={size}
                  onClick={() => createGame(size)}
                  disabled={creating}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '14px 0 10px',
                    background: size === DEFAULT_SIZE ? BLUE_COLOR : '#fff',
                    color: size === DEFAULT_SIZE ? '#fff' : TEXT,
                    border: `1.5px solid ${size === DEFAULT_SIZE ? BLUE_COLOR : BORDER}`,
                    borderRadius: 10,
                    cursor: creating ? 'wait' : 'pointer',
                    opacity: creating ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{size}×{size}</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 500,
                    marginTop: 4,
                    opacity: size === DEFAULT_SIZE ? 0.8 : 0.5,
                    color: size === DEFAULT_SIZE ? '#fff' : TEXT_MUTED,
                  }}>
                    {time}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSizeSelect(false)}
              disabled={creating}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '8px 0',
                background: 'none',
                color: TEXT_MUTED,
                border: 'none',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 20,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setShowRules(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 24px',
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
              animation: 'slideUp 0.25s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: TEXT }}>
              How to play
            </h3>
            <div style={{ fontSize: 14, lineHeight: 1.75, color: TEXT_MUTED }}>
              <p style={{ margin: '0 0 10px' }}>
                <span style={{ color: BLUE_COLOR, fontWeight: 600 }}>Blue</span> and{' '}
                <span style={{ color: RED_COLOR, fontWeight: 600 }}>Red</span> take turns on the board.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                Blue goes first — places a <strong>2×2 block</strong> each turn.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                Red places <strong>one cell</strong> each turn.
              </p>
              <p style={{ margin: '0 0 10px' }}>Game ends when a player can't move.</p>
              <p style={{ margin: '0 0 10px' }}>
                All remaining empty cells become <span style={{ color: RED_COLOR, fontWeight: 600 }}>red</span>.
              </p>
              <p style={{ margin: 0, fontWeight: 500, color: TEXT }}>Most cells wins!</p>
            </div>
            <button
              onClick={() => setShowRules(false)}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '10px 0',
                background: TEXT,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
