export type Rect = { x: number; y: number; w: number; h: number };

export type SurfaceKind = "grass" | "sand" | "concrete";

export type TabKey = "play" | "levels" | "history" | "leaderboard" | "profile";

export type LevelTier = "free" | "premium";

export type Obstacle = Rect & { kind: "wall" };

export type Surface = Rect & { kind: SurfaceKind };

export type Level = {
	id: string;
	name: string;
	tier: LevelTier;
	theme: string;
	par: number;
	ball: { x: number; y: number };
	hole: { x: number; y: number };
	obstacles: Obstacle[];
	surfaces: Surface[];
};

export type CompletedRun = {
	levelId: string;
	levelName: string;
	strokes: number;
};

export type UserState = {
	id: string;
	name: string;
	isGuest: boolean;
	walletConnected: boolean;
	walletAddress?: string;
	usdcBalance: number;
	gamesPlayed: number;
	totalStrokes: number;
	bestScoreByLevel: Record<string, number>;
	purchasedLevelIds: string[];
	avatarGradient: string;
	completedRuns: CompletedRun[];
};

export type LeaderboardEntry = {
	rank: number;
	name: string;
	wallet: string;
	strokes: number;
};

export const WORLD = { w: 360, h: 640 } as const;

export const CFG = {
	wallPad: 20,
	ballR: 9,
	holeR: 14,
	holeCupR: 7,
	maxShotPower: 20,
	powerScale: 0.085,
	aimLineMax: 130,
	restitution: 0.86,
	tangentialDamp: 0.88,
	rollingFrictionGrass: 0.9928,
	rollingFrictionSand: 0.978,
	rollingFrictionConcrete: 0.9965,
	stopEps: 0.06,
	captureDist: 18,
	captureSpeed: 2.2,
	maxDt: 1 / 30,
	substeps: 3,
} as const;

