export interface DeveloperSocials {
  github?: string;
  linkedin?: string;
  portfolio?: string;
  twitter?: string;
  email?: string;
}

export interface DeveloperGameRef {
  gameId: string;
  roleInGame: string;
  highlights?: string[];
}

export interface Developer {
  id: string;
  name: string;
  roles: string[];
  avatar?: string;
  location?: string;
  bio: string;
  tagline: string;
  contributions: string[];
  technologies: string[];
  games: DeveloperGameRef[];
  socials: DeveloperSocials;
  featured?: boolean;
}

export interface GameDevCredit {
  developerId: string;
  role: string;
  contribution: string;
}

export interface AboutGame {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  href: string;
  supportedModes: 'SOLO' | 'MULTIPLAYER' | 'BOTH';
  status: 'Live' | 'Beta' | 'In Development';
  technologies: string[];
  featured?: boolean;
  developers: GameDevCredit[];
}

export interface PlatformPillar {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  iconName: 'Zap' | 'Users' | 'Sparkles' | 'Layers';
  badge: string;
  gradient: string;
}

export interface EvolutionMilestone {
  phase: string;
  title: string;
  period?: string;
  description: string;
  highlights: string[];
  iconName: 'Sparkles' | 'Server' | 'Gamepad2' | 'MessageSquare' | 'Box';
  status: 'completed' | 'current' | 'upcoming';
}

// Centralized Developer Roster
export const DEVELOPERS: Developer[] = [
  {
    id: "adarsh-sachan",
    name: "Adarsh Sachan",
    roles: ["Founder & Lead Developer"],
    avatar: "/Adarsh-Sachan.png",
    location: "India",
    tagline: "Founder & Lead Developer",
    bio: "Creator and lead engineer of Ano.",
    contributions: [
      "Authoritative Socket.IO multiplayer game server architecture",
      "Full platform Next.js frontend with dark glassmorphism design system",
      "Real-time social feed with community voting, media upload, and comments",
      "Interactive 2D HTML5 canvas drawing engine with stroke replays",
      "3D Three.js scene & WebGL vehicle dynamics for Street Rush & Chamber Clash",
      "Turn-based synchronization & cascade chain reaction engines"
    ],
    technologies: [
      "Next.js",
      "React",
      "TypeScript",
      "Node.js",
      "Socket.IO",
      "PostgreSQL",
      "Prisma",
      "Three.js",
      "HTML5 Canvas",
      "TailwindCSS"
    ],
    games: [
      {
        gameId: "street-rush",
        roleInGame: "Lead Developer & WebGL Engine"
      },
      {
        gameId: "chamber-clash",
        roleInGame: "Lead Developer & 3D Systems"
      },
      {
        gameId: "color-wars",
        roleInGame: "Core Mechanics & Cascade Engine"
      },
      {
        gameId: "bluff",
        roleInGame: "Rules & Turn-Based Engine"
      },
      {
        gameId: "dots-and-boxes",
        roleInGame: "Logic & Board Geometry"
      },
      {
        gameId: "flappy-bird",
        roleInGame: "Physics & Multiplayer Sync"
      },
      {
        gameId: "scribble",
        roleInGame: "Collaborative Canvas Engine"
      },
      {
        gameId: "memory-match",
        roleInGame: "Turn-Based Card Logic"
      },
      {
        gameId: "2048",
        roleInGame: "Tile Sliding & Merging Matrix"
      },
      {
        gameId: "minesweeper",
        roleInGame: "Recursive Flood-Fill & Board Logic"
      }
    ],
    socials: {
      portfolio: "https://theadarsh.me/",
      github: "https://github.com/theadarsh1m",
      linkedin: "https://www.linkedin.com/in/adarshsachan01"
    },
    featured: true
  },
  {
    id: "abhinav-sahu",
    name: "Abhinav Sahu",
    roles: ["President & Senior Developer"],
    avatar: "/abhinav-sahu.jpeg",
    location: "India",
    tagline: "President & Senior Developer",
    bio: "President and senior developer contributing to game mechanics and multiplayer experiences on Ano.",
    contributions: [
      "PaperFall speed typing mechanics and arcade difficulty progression",
      "Arrow Maze directional grid pathfinding and puzzle logic"
    ],
    technologies: [
      "React",
      "TypeScript",
      "Next.js",
      "Socket.IO",
      "HTML5 Canvas",
      "TailwindCSS"
    ],
    games: [
      {
        gameId: "paper-fall",
        roleInGame: "Game Developer"
      },
      {
        gameId: "arrow-maze",
        roleInGame: "Game Developer"
      }
    ],
    socials: {
      portfolio: "https://www.abhinavsahu.me/",
      github: "https://github.com/Abhinav-2312307",
      linkedin: "https://www.linkedin.com/in/abhinav-sahu-865a01297/"
    },
    featured: true
  },
  {
    id: "aditya-prajapati",
    name: "Aditya Prajapati",
    roles: ["Junior Developer"],
    avatar: "/Aditya-prajapati.jpeg",
    location: "India",
    tagline: "Junior Developer",
    bio: "Junior developer at Ano contributing to real-time multiplayer party games, 3D demolition vehicular combat lobbies, and interactive social deduction mechanics.",
    contributions: [
      "Demolition Derby chaotic 3D vehicular combat arena, multiplayer lobby room matchmaking, and collision damage physics",
      "Ink & Deception social deduction game loop, canvas stroke synchronization, and impostor mechanics",
      "Ultimate Tic-Tac-Toe strategic 9x9 multi-board engine, authoritative sub-grid evaluation, and multiplayer lobby system",
      "Collaborative drawing workflow, role reveals, and real-time player voting systems"
    ],
    technologies: [
      "React",
      "TypeScript",
      "Next.js",
      "Socket.IO",
      "Three.js",
      "HTML5 Canvas",
      "TailwindCSS"
    ],
    games: [
      {
        gameId: "demolition-derby",
        roleInGame: "Game Developer"
      },
      {
        gameId: "ink-deception",
        roleInGame: "Game Developer"
      },
      {
        gameId: "ultimate-tic-tac-toe",
        roleInGame: "Game Developer"
      }
    ],
    socials: {
      portfolio: "https://aditya-prajapati.vercel.app/",
      github: "https://github.com/Aditya4405",
      linkedin: "https://www.linkedin.com/in/aditya-prajapati-4405q/"
    },
    featured: true
  }
];

// Centralized Games Built At Ano
export const ABOUT_GAMES: AboutGame[] = [
  {
    id: "demolition-derby",
    name: "Demolition Derby",
    tagline: "High-octane 3D vehicular combat & multiplayer lobby destruction",
    description: "Multiplayer 3D vehicular combat derby. Crash into opponents, trigger high-impact collisions, survive in tactical arenas, and compete in real-time lobbies.",
    icon: "🏎️",
    color: "from-amber-600 via-red-600 to-zinc-900",
    href: "/dashboard/games/demolition-derby",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["React", "Three.js", "Socket.IO", "Zustand", "Custom 3D Physics Engine"],
    featured: true,
    developers: [
      {
        developerId: "aditya-prajapati",
        role: "Game Developer",
        contribution: "Multiplayer lobby architecture, real-time vehicular combat synchronization, and arena collision dynamics."
      }
    ]
  },
  {
    id: "ultimate-tic-tac-toe",
    name: "Ultimate Tic-Tac-Toe",
    tagline: "Strategic 9x9 battleground of nested Tic-Tac-Toe boards",
    description: "A nested 9x9 strategy game where each move determines which mini-board your opponent must play in next. Win 3 mini-boards in a row to win the match.",
    icon: "📐",
    color: "from-cyan-500 via-indigo-600 to-purple-800",
    href: "/dashboard/games/ultimate-tic-tac-toe",
    supportedModes: "BOTH",
    status: "Live",
    technologies: ["React", "TypeScript", "Socket.IO", "Zustand", "Tailwind CSS"],
    featured: true,
    developers: [
      {
        developerId: "aditya-prajapati",
        role: "Game Developer",
        contribution: "Nested grid win verification, active board routing logic, and multiplayer matchmaking."
      }
    ]
  },
  {
    id: "street-rush",
    name: "Street Rush",
    tagline: "High-speed 3D Arcade Multiplayer Racing",
    description: "Battle up to 8 racers in a high-octane 3D street circuit featuring nitro boosts, drifting physics, and live spectator tracking.",
    icon: "🏎️",
    color: "from-cyan-900 via-blue-950 to-purple-950",
    href: "/dashboard/games/street-rush",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["Next.js", "React", "Three.js", "WebGL", "Socket.IO", "Web Audio API"],
    featured: true,
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Lead Developer",
        contribution: "3D street circuit builder, vehicle physics & drift engine, server-authoritative lap checkpointing."
      }
    ]
  },
  {
    id: "chamber-clash",
    name: "Chamber Clash",
    tagline: "High-stakes turn-based survival strategy",
    description: "Manage risk, deploy strategic items, and survive the chamber in this tense 2-8 player multiplayer showdown.",
    icon: "🔫",
    color: "from-slate-800 to-zinc-900",
    href: "/dashboard/games/chamber-clash",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["Next.js", "React", "Three.js", "React Three Fiber", "Socket.IO", "Web Audio API"],
    featured: true,
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Lead Developer",
        contribution: "3D scene integration, chamber item logic, and authoritative match lifecycle."
      }
    ]
  },
  {
    id: "ink-deception",
    name: "Ink & Deception",
    tagline: "One Drawing. One Impostor. Trust No Stroke.",
    description: "Multiplayer social deduction party game. Expose the Fake Artist through collaborative drawing strokes or blend in to steal the win.",
    icon: "🖌️",
    color: "from-slate-900 via-indigo-950 to-pink-950",
    href: "/dashboard/games/ink-deception",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["React", "HTML5 Canvas", "Velocity Physics", "Socket.IO", "Web Audio Synth"],
    featured: true,
    developers: [
      {
        developerId: "aditya-prajapati",
        role: "Game Developer",
        contribution: "Social deduction game loop, canvas stroke synchronization, and role assignment logic."
      }
    ]
  },
  {
    id: "color-wars",
    name: "Chain Reaction (Color Wars)",
    tagline: "Tactical explosive grid capture",
    description: "Place energy orbs strategically, trigger cascading chain explosions, and capture the board to eliminate your opponents.",
    icon: "💥",
    color: "from-rose-500 to-red-600",
    href: "/dashboard/games/color-wars",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["React", "Socket.IO", "Recursive Cascade Engine", "Tailwind CSS"],
    featured: true,
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Core Engine Developer",
        contribution: "Recursive orthogonal explosion algorithm, room lobbies, and turn queue management."
      }
    ]
  },
  {
    id: "bluff",
    name: "Bluff (Liar's Dice)",
    tagline: "The classic game of deception and challenges",
    description: "Bid on the total count of dice values across all players. Challenge when you suspect a bluff, or push your luck to the limit.",
    icon: "🃏",
    color: "from-emerald-500 to-teal-700",
    href: "/dashboard/games/bluff",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["React", "Socket.IO", "Turn State Machine", "Framer Motion"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Bid validation, challenge resolution, and real-time dice roll secrecy."
      }
    ]
  },
  {
    id: "dots-and-boxes",
    name: "Dots and Boxes",
    tagline: "Classic grid tactical connection",
    description: "Connect lines between dots, close boxes to score, and chain consecutive moves to outmaneuver your opponent.",
    icon: "✏️",
    color: "from-blue-500 to-indigo-700",
    href: "/dashboard/games/dots-and-boxes",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["React", "SVG Grid Engine", "Socket.IO"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Geometric edge detection, box closure scoring, and interactive grid UI."
      }
    ]
  },
  {
    id: "flappy-bird",
    name: "Flappy Bird",
    tagline: "Fast-paced arcade reflex challenge",
    description: "Flap your wings, dodge pipes, and set the ultimate high score in solo runs or synchronized multiplayer duels.",
    icon: "🐤",
    color: "from-amber-400 to-yellow-600",
    href: "/dashboard/games/flappy-bird",
    supportedModes: "BOTH",
    status: "Live",
    technologies: ["React", "HTML5 Canvas", "Physics Engine", "Socket.IO"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Arcade physics loop, high score persistence, and dual solo/multiplayer modes."
      }
    ]
  },
  {
    id: "memory-match",
    name: "Memory Match",
    tagline: "Competitive multiplayer card matching",
    description: "Flip cards, find matching pairs, and score consecutive points in this classic turn-based memory challenge.",
    icon: "🧠",
    color: "from-violet-500 to-fuchsia-700",
    href: "/dashboard/games/memory-match",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["React", "CSS 3D Transforms", "Socket.IO"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "3D card flip transitions, deck shuffling, and turn synchronization."
      }
    ]
  },
  {
    id: "scribble",
    name: "Scribble",
    tagline: "Real-time draw & guess party game",
    description: "Draw prompts in real-time, guess what other players are sketching, and race the clock to climb the scoreboard.",
    icon: "🎨",
    color: "from-sky-400 to-indigo-600",
    href: "/dashboard/games/scribble",
    supportedModes: "MULTIPLAYER",
    status: "Live",
    technologies: ["React", "Canvas 2D", "Socket.IO Broadcast", "Word Bank Generator"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Real-time stroke broadcast, fuzzy answer matching, and scoring timer."
      }
    ]
  },
  {
    id: "paper-fall",
    name: "PaperFall",
    tagline: "Speed typing arcade defense",
    description: "Words drift down from the sky on paper slips. Type them swiftly to fire your cannon before they hit the ground.",
    icon: "📜",
    color: "from-orange-400 to-amber-600",
    href: "/dashboard/games/paper-fall",
    supportedModes: "BOTH",
    status: "Live",
    technologies: ["React", "Typing Input Engine", "Web Audio API"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Falling projectile animation, keyboard input listener, and difficulty curve."
      }
    ]
  },
  {
    id: "arrow-maze",
    name: "Arrow Maze",
    tagline: "Directional logic puzzle grid",
    description: "Clear the grid by clicking arrows in the right order. Race your friends or solve puzzles solo.",
    icon: "🏹",
    color: "from-cyan-500 to-blue-600",
    href: "/dashboard/games/arrow-maze",
    supportedModes: "BOTH",
    status: "Live",
    technologies: ["React", "Graph Traversal Logic", "Socket.IO"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Directional vector pathfinding, grid generation, and multiplayer race synchronization."
      }
    ]
  },
  {
    id: "2048",
    name: "2048",
    tagline: "Classic tile sliding and merging puzzle",
    description: "Slide numbered tiles across the board and combine identical tiles to reach 2048.",
    icon: "🔢",
    color: "from-yellow-500 to-orange-600",
    href: "/dashboard/games/2048",
    supportedModes: "SOLO",
    status: "Live",
    technologies: ["React", "Matrix Engine", "State Machine"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Tile sliding matrix calculation, score persistence, and animations."
      }
    ]
  },
  {
    id: "minesweeper",
    name: "Minesweeper",
    tagline: "Strategic deduction minefield clearing",
    description: "Clear all safe tiles across the grid without triggering hidden explosive mines.",
    icon: "💣",
    color: "from-red-500 to-rose-700",
    href: "/dashboard/games/minesweeper",
    supportedModes: "SOLO",
    status: "Live",
    technologies: ["React", "Recursive Flood Fill", "Board Matrix"],
    developers: [
      {
        developerId: "adarsh-sachan",
        role: "Game Developer",
        contribution: "Recursive flood-fill reveal, randomized mine generation, and timer logic."
      }
    ]
  }
];

// Mission & Core Principles ("Why Ano?")
export const PLATFORM_PILLARS: PlatformPillar[] = [
  {
    id: "instant-play",
    title: "Zero-Friction Play",
    subtitle: "No downloads, no installations",
    description: "Jump into any game instantly via direct link. Play with friends across desktop, tablet, or phone in pure modern web technology.",
    iconName: "Zap",
    badge: "100% Web Native",
    gradient: "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30"
  },
  {
    id: "realtime-multiplayer",
    title: "Authoritative Real-Time",
    subtitle: "Low-latency WebSocket engine",
    description: "Built on an authoritative Socket.IO backend architecture that guarantees fair turn states, real-time board updates, and smooth spectator streaming.",
    iconName: "Server" as any,
    badge: "Socket.IO + Node.js",
    gradient: "from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30"
  },
  {
    id: "social-community",
    title: "Community & Interaction",
    subtitle: "Chat, rooms, feed & presence",
    description: "More than just a game arcade — Ano combines customizable public/private rooms, community discussions, direct messaging, and live user presence.",
    iconName: "Users",
    badge: "Social Hub",
    gradient: "from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30"
  },
  {
    id: "developer-creativity",
    title: "Developer Playground",
    subtitle: "Where creative game ideas come alive",
    description: "Engineered as an open canvas for rapid experimentation — from HTML5 canvas party games and logic puzzles to immersive 3D Three.js environments.",
    iconName: "Sparkles",
    badge: "Rapid Innovation",
    gradient: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30"
  }
];

// Evolution Milestones (Data-Driven Timeline)
export const EVOLUTION_MILESTONES: EvolutionMilestone[] = [
  {
    phase: "Phase 1",
    title: "Core Platform & Real-Time Engine",
    description: "Inception of Ano as a unified platform for turn-based multiplayer web gaming.",
    highlights: [
      "Authoritative Socket.IO connection manager & room lobbies",
      "User authentication, profiles, and Google OAuth integration",
      "Persistent PostgreSQL database with Prisma ORM"
    ],
    iconName: "Server",
    status: "completed"
  },
  {
    phase: "Phase 2",
    title: "Classic Strategy & Cascade Games",
    description: "Implementation of first-wave turn-based multiplayer strategy and puzzle games.",
    highlights: [
      "Color Wars with recursive orthogonal explosion cascade engine",
      "Bluff (Liar's dice) bidding and challenge resolution",
      "Dots and Boxes, Memory Match, and Flappy Bird"
    ],
    iconName: "Gamepad2",
    status: "completed"
  },
  {
    phase: "Phase 3",
    title: "Social Ecosystem & Community Feed",
    description: "Expanded beyond arcade games into a full-fledged social platform for players and groups.",
    highlights: [
      "Community feed with rich posts, tag filtering, and voting",
      "Direct messaging system with unread indicators",
      "Public and private custom room creation with invite links",
      "Live stats and real-time user presence tracking"
    ],
    iconName: "MessageSquare",
    status: "completed"
  },
  {
    phase: "Phase 4",
    title: "3D Graphics & Interactive Canvas Engines",
    description: "Pushed the boundaries of web capabilities with 3D scenes and advanced drawing physics.",
    highlights: [
      "Chamber Clash survival game with Three.js rendering",
      "Ink & Deception social deduction game with velocity-simulated brush strokes and replay timeline player",
      "Web Audio API synthesized sound cues and audio feedback"
    ],
    iconName: "Box",
    status: "completed"
  },
  {
    phase: "Phase 5",
    title: "Community Expansion & Tournament Engine",
    description: "Current development focused on deeper voice channels, automated tournament brackets, and community game creator APIs.",
    highlights: [
      "Integrated low-latency WebRTC voice channels in game rooms",
      "Multi-round tournament management and leaderboards",
      "Modular game registry SDK for community developers"
    ],
    iconName: "Sparkles",
    status: "current"
  }
];

// Data Relationship Queries
export function getDevelopers(): Developer[] {
  return DEVELOPERS;
}

export function getDeveloperById(id: string): Developer | undefined {
  return DEVELOPERS.find((d) => d.id === id);
}

export function getAllAboutGames(): AboutGame[] {
  return ABOUT_GAMES;
}

export function getAboutGameById(id: string): AboutGame | undefined {
  return ABOUT_GAMES.find((g) => g.id === id);
}

export function getGamesWithDevs(): (AboutGame & {
  devDetails: { developer: Developer; role: string; contribution: string }[];
})[] {
  return ABOUT_GAMES.map((game) => {
    const devDetails = game.developers
      .map((credit) => {
        const developer = getDeveloperById(credit.developerId);
        if (!developer) return null;
        return {
          developer,
          role: credit.role,
          contribution: credit.contribution
        };
      })
      .filter((d): d is { developer: Developer; role: string; contribution: string } => d !== null);

    return {
      ...game,
      devDetails
    };
  });
}

export interface DevWithGames extends Developer {
  gameDetails: (AboutGame & { roleInGame: string; highlights?: string[] })[];
}

export function getDevWithGames(devId: string): DevWithGames | undefined {
  const developer = getDeveloperById(devId);
  if (!developer) return undefined;

  const gameDetails: (AboutGame & { roleInGame: string; highlights?: string[] })[] = [];
  for (const gameRef of developer.games) {
    const game = getAboutGameById(gameRef.gameId);
    if (game) {
      gameDetails.push({
        ...game,
        roleInGame: gameRef.roleInGame,
        highlights: gameRef.highlights
      });
    }
  }

  return {
    ...developer,
    gameDetails
  };
}

