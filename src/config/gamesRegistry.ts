import React from 'react';
import { FlappyGameHub } from '@/components/games/flappy-bird/FlappyGameHub';
import { Game2048 } from '@/components/games/Game2048';
import { Minesweeper } from '@/components/games/Minesweeper';
import { PaperFallGameHub } from '@/components/games/paper-fall/PaperFallGameHub';
import { ArrowMazeGameHub } from '@/components/games/arrow-maze/ArrowMazeGameHub';
import { UltimateTicTacToeGameHub } from '@/components/games/ultimate-tic-tac-toe/UltimateTicTacToeGameHub';
import { DemolitionDerbyGameHub } from '@/components/games/demolition-derby/DemolitionDerbyGameHub';
import { StreetRushGameHub } from '@/components/games/street-rush/components/StreetRushGameHub';

export type GameSupportedMode = 'SOLO' | 'MULTIPLAYER' | 'BOTH';

export interface GameComponentProps {
  onGameEnd: (score: number, playTimeSeconds: number) => void;
}

export interface GameDefinition {
  id: string;
  name: string;
  title: string; // Alias for backward compatibility
  slug: string;
  description: string;
  icon: string;
  thumbnail?: string;
  color: string;
  supportedModes: GameSupportedMode;
  enabled: boolean;
  displayOrder: number;
  type?: 'singleplayer' | 'multiplayer'; // Backward compatibility fallback
  href: string;
  component?: React.ComponentType<GameComponentProps>;
}

export const GAMES_REGISTRY: Record<string, GameDefinition> = {
  'flappy-bird': {
    id: 'flappy-bird',
    name: 'Flappy Bird',
    title: 'Flappy Bird',
    slug: 'flappy-bird',
    description: 'Flap your wings, dodge pipes, and set the ultimate high score in solo or multiplayer.',
    icon: '🐤',
    thumbnail: '/games/flappy-bird.png',
    color: 'from-amber-400 to-yellow-600',
    supportedModes: 'BOTH',
    enabled: true,
    displayOrder: 1,
    type: 'singleplayer',
    href: '/dashboard/games/flappy-bird',
    component: FlappyGameHub
  },
  'bluff': {
    id: 'bluff',
    name: 'Bluff Card Game',
    title: 'Bluff Card Game',
    slug: 'bluff',
    description: 'Card game of lies, deception, and challenges. Get rid of your cards and catch other players bluffing!',
    icon: '🃏',
    color: 'from-emerald-500 to-teal-700',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 2,
    type: 'multiplayer',
    href: '/dashboard/games/bluff'
  },
  'memory-match': {
    id: 'memory-match',
    name: 'Memory Match',
    title: 'Memory Match',
    slug: 'memory-match',
    description: 'Flip cards, find matching pairs, and outscore your opponents in this classic multiplayer memory game!',
    icon: '🧠',
    color: 'from-violet-500 to-fuchsia-700',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 3,
    type: 'multiplayer',
    href: '/dashboard/games/memory-match'
  },
  'dots-and-boxes': {
    id: 'dots-and-boxes',
    name: 'Dots and Boxes',
    title: 'Dots and Boxes',
    slug: 'dots-and-boxes',
    description: 'Connect the dots, close the boxes, and capture the board in this classic strategy game!',
    icon: '✏️',
    color: 'from-blue-500 to-indigo-700',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 4,
    type: 'multiplayer',
    href: '/dashboard/games/dots-and-boxes'
  },
  'color-wars': {
    id: 'color-wars',
    name: 'Chain Reaction',
    title: 'Chain Reaction',
    slug: 'color-wars',
    description: 'Place energy strategically, trigger explosive chain reactions, and capture the board to eliminate your opponents!',
    icon: '💥',
    color: 'from-rose-500 to-red-600',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 5,
    type: 'multiplayer',
    href: '/dashboard/games/color-wars'
  },
  'scribble': {
    id: 'scribble',
    name: 'Scribble',
    title: 'Scribble',
    slug: 'scribble',
    description: 'Draw, guess, and win! The ultimate multiplayer drawing party game.',
    icon: '🎨',
    color: 'from-sky-400 to-indigo-600',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 6,
    type: 'multiplayer',
    href: '/dashboard/games/scribble'
  },
  'ink-deception': {
    id: 'ink-deception',
    name: 'Ink & Deception',
    title: 'Ink & Deception',
    slug: 'ink-deception',
    description: 'One Drawing. One Impostor. Trust No Stroke. Expose the Fake Artist or blend in and guess the secret word!',
    icon: '🖌️',
    color: 'from-slate-900 via-indigo-950 to-pink-950 border-[#FF5DA8]/20',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 7,
    type: 'multiplayer',
    href: '/dashboard/games/ink-deception'
  },
  'chamber-clash': {
    id: 'chamber-clash',
    name: 'Chamber Clash',
    title: 'Chamber Clash',
    slug: 'chamber-clash',
    description: 'Manage risk, use items, and survive the chamber in this tense 2-8 player strategy game!',
    icon: '🔫',
    color: 'from-slate-800 to-zinc-900 border-red-500/20',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 8,
    type: 'multiplayer',
    href: '/dashboard/games/chamber-clash'
  },
  '2048': {
    id: '2048',
    name: '2048',
    title: '2048',
    slug: '2048',
    description: 'Slide tiles and merge them to reach 2048. A simple but addictive puzzle game.',
    icon: '🔢',
    color: 'from-yellow-500 to-orange-600',
    supportedModes: 'SOLO',
    enabled: true,
    displayOrder: 9,
    type: 'singleplayer',
    href: '/dashboard/games/2048',
    component: Game2048
  },
  'minesweeper': {
    id: 'minesweeper',
    name: 'Minesweeper',
    title: 'Minesweeper',
    slug: 'minesweeper',
    description: 'Clear the board without detonating any hidden mines. Use logic to figure out where they are.',
    icon: '💣',
    color: 'from-red-500 to-rose-700',
    supportedModes: 'SOLO',
    enabled: true,
    displayOrder: 10,
    type: 'singleplayer',
    href: '/dashboard/games/minesweeper',
    component: Minesweeper
  },
  'paper-fall': {
    id: 'paper-fall',
    name: 'PaperFall',
    title: 'PaperFall',
    slug: 'paper-fall',
    description: 'Words drift down from the sky on paper slips. Type them to fire your cannon before they hit the ground!',
    icon: '📜',
    color: 'from-orange-400 to-amber-600',
    supportedModes: 'BOTH',
    enabled: true,
    displayOrder: 11,
    type: 'singleplayer',
    href: '/dashboard/games/paper-fall',
    component: PaperFallGameHub
  },
  'arrow-maze': {
    id: 'arrow-maze',
    name: 'Arrow Maze',
    title: 'Arrow Maze',
    slug: 'arrow-maze',
    description: 'Clear the grid by clicking arrows in the right order. Race your friends or play solo in this puzzle game!',
    icon: '🏹',
    color: 'from-cyan-500 to-blue-600',
    supportedModes: 'BOTH',
    enabled: true,
    displayOrder: 12,
    type: 'multiplayer',
    href: '/dashboard/games/arrow-maze',
    component: ArrowMazeGameHub
  },
  'ultimate-tic-tac-toe': {
    id: 'ultimate-tic-tac-toe',
    name: 'Ultimate Tic-Tac-Toe',
    title: 'Ultimate Tic-Tac-Toe',
    slug: 'ultimate-tic-tac-toe',
    description: 'A strategic 9x9 battleground of mini Tic-Tac-Toe boards. Every move forces your opponent into a specific board!',
    icon: '📐',
    color: 'from-cyan-500 via-indigo-600 to-purple-800',
    supportedModes: 'BOTH',
    enabled: true,
    displayOrder: 13,
    type: 'multiplayer',
    href: '/dashboard/games/ultimate-tic-tac-toe',
    component: UltimateTicTacToeGameHub
  },
  'demolition-derby': {
    id: 'demolition-derby',
    name: 'Demolition Derby',
    title: 'Demolition Derby',
    slug: 'demolition-derby',
    description: 'Chaotic 3D vehicular combat multiplayer derby! Crash into opponents, deal damage, and survive as the last driver standing.',
    icon: '🏎️',
    color: 'from-amber-600 via-red-600 to-zinc-900',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 14,
    type: 'multiplayer',
    href: '/dashboard/games/demolition-derby',
    component: DemolitionDerbyGameHub
  },
  'street-rush': {
    id: 'street-rush',
    name: 'Street Rush',
    title: 'Street Rush',
    slug: 'street-rush',
    description: 'Fast arcade-style 3D multiplayer racing on a neon city circuit! Drift sharp corners, blast nitro, and race 3 laps to victory.',
    icon: '🏎️',
    color: 'from-cyan-500 via-blue-600 to-purple-800',
    supportedModes: 'MULTIPLAYER',
    enabled: true,
    displayOrder: 15,
    type: 'multiplayer',
    href: '/dashboard/games/street-rush',
    component: StreetRushGameHub
  }
};

export const supportsSolo = (game: GameDefinition): boolean =>
  game.supportedModes === 'SOLO' || game.supportedModes === 'BOTH';

export const supportsMultiplayer = (game: GameDefinition): boolean =>
  game.supportedModes === 'MULTIPLAYER' || game.supportedModes === 'BOTH';

export const getAllGames = (): GameDefinition[] =>
  Object.values(GAMES_REGISTRY)
    .filter((game) => game.enabled)
    .sort((a, b) => {
      const aMulti = supportsMultiplayer(a) ? 0 : 1;
      const bMulti = supportsMultiplayer(b) ? 0 : 1;
      if (aMulti !== bMulti) return aMulti - bMulti;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });

export const getSinglePlayerGames = (): GameDefinition[] =>
  getAllGames().filter((game) => supportsSolo(game));

export const getMultiplayerGames = (): GameDefinition[] =>
  getAllGames().filter((game) => supportsMultiplayer(game));

export const getGameDefinition = (idOrSlug: string): GameDefinition | undefined =>
  GAMES_REGISTRY[idOrSlug] || Object.values(GAMES_REGISTRY).find((g) => g.slug === idOrSlug);
