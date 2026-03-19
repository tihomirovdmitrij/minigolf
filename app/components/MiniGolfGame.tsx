"use client";

import { useEffect, useRef, useState } from "react";
import { createPublicClient, erc20Abi, http, isAddress, parseUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useConnect, useWalletClient } from "wagmi";
import { createMiniGolfEngine, type MiniGolfRuntimeState } from "../../lib/minigolf/engine";
import {
	DEFAULT_USER,
	FREE_LEVELS,
	LEVEL_PRICE_USDC,
	LEVELS,
	shortAddress,
} from "../../lib/minigolf/level-data";
import { hypot } from "../../lib/minigolf/math";
import { CFG, type TabKey, type UserState, WORLD } from "../../lib/minigolf/types";
import { getWorldPointer, useCanvasAssets } from "../hooks/useCanvasAssets";

type MiniGolfGameProps = {
	initialUser?: UserState;
	onUserChange?: (next: UserState) => void;
};

type LeaderboardApiRow = {
	rank: number;
	userId: number;
	displayName: string;
	externalId: string;
	bestStrokes: number;
};

const MOCK_LEADERBOARD_PLAYERS = [
	{ userId: 101, displayName: "Mia Green", externalId: "mia-green" },
	{ userId: 102, displayName: "Noah Park", externalId: "noah-park" },
	{ userId: 103, displayName: "Luca Vale", externalId: "luca-vale" },
	{ userId: 104, displayName: "Ivy Lane", externalId: "ivy-lane" },
	{ userId: 105, displayName: "Leo Hart", externalId: "leo-hart" },
	{ userId: 106, displayName: "Nora Bloom", externalId: "nora-bloom" },
	{ userId: 107, displayName: "Owen Brook", externalId: "owen-brook" },
	{ userId: 108, displayName: "Ava Finch", externalId: "ava-finch" },
];

const panelClass =
	"rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[0_20px_45px_rgba(111,221,150,0.16)] backdrop-blur-sm";

const softCardClass =
	"rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_10px_24px_rgba(111,221,150,0.08)]";

const secondaryButtonClass =
	"min-h-10 px-3 py-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[#20402c] hover:bg-[color:var(--app-surface-soft)] text-[13px] font-medium";

const primaryButtonClass =
	"min-h-10 px-3 py-2 rounded-2xl bg-[linear-gradient(180deg,var(--app-accent),var(--app-accent-strong))] text-[#123321] text-[13px] font-semibold shadow-[0_12px_24px_rgba(41,191,108,0.22)]";

export function MiniGolfGame({ initialUser, onUserChange }: MiniGolfGameProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const activePointerIdRef = useRef<number | null>(null);
	const { assetsRef, dprRef } = useCanvasAssets(canvasRef);

	const [tab, setTab] = useState<TabKey>("play");
	const [levelIndex, setLevelIndex] = useState(0);
	const [strokes, setStrokes] = useState(0);
	const [finished, setFinished] = useState(false);
	const [user, setUser] = useState<UserState>(initialUser ?? DEFAULT_USER);
	const [txState, setTxState] = useState<"idle" | "pending" | "success">("idle");
	const [_txMessage, setTxMessage] = useState("");
	const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardApiRow[]>([]);
	const [leaderboardStatus, setLeaderboardStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [leaderboardError, setLeaderboardError] = useState("");
	const { address, isConnected, chainId } = useAccount();
	const { connectAsync, connectors, isPending: isWalletConnecting } = useConnect();
	const { data: walletClient } = useWalletClient();

	const level = LEVELS[levelIndex];
	const levelNeedsPurchase =
		levelIndex >= FREE_LEVELS.length && !user.purchasedLevelIds.includes(level.id);
	const usdcContractAddress = process.env.NEXT_PUBLIC_USDC_BASE_MAINNET_CONTRACT;
	const usdcReceiverWallet = process.env.NEXT_PUBLIC_USDC_RECEIVER_WALLET;

	const stateRef = useRef<MiniGolfRuntimeState>({
		ball: { x: level.ball.x, y: level.ball.y, vx: 0, vy: 0 },
		won: false,
		aiming: false,
		aimFrom: { x: 0, y: 0 },
		aimTo: { x: 0, y: 0 },
		rollAngle: 0,
		lastT: 0,
	});

	useEffect(() => {
		setUser((prev) => {
			const next = initialUser ?? prev;
			onUserChange?.(next);
			return next;
		});
	}, [initialUser, onUserChange]);

	useEffect(() => {
		const s = stateRef.current;
		s.ball = { x: level.ball.x, y: level.ball.y, vx: 0, vy: 0 };
		s.won = false;
		s.aiming = false;
		s.rollAngle = 0;
		s.lastT = 0;
		setStrokes(0);
		setFinished(false);
	}, [level.ball.x, level.ball.y]);

	useEffect(() => {
		const c = canvasRef.current;
		if (!c) return;

		const canShoot = () => {
			const s = stateRef.current;
			return (
				!s.won &&
				!levelNeedsPurchase &&
				tab === "play" &&
				hypot(s.ball.vx, s.ball.vy) < CFG.stopEps * 1.5
			);
		};

		const onDown = (ev: PointerEvent) => {
			ev.preventDefault();
			if (!canShoot()) return;
			const p = getWorldPointer(ev, c);
			const s = stateRef.current;
			if (dist(p.x, p.y, s.ball.x, s.ball.y) <= CFG.ballR + 18) {
				activePointerIdRef.current = ev.pointerId;
				try {
					c.setPointerCapture(ev.pointerId);
				} catch {}
				s.aiming = true;
				s.aimFrom = { x: s.ball.x, y: s.ball.y };
				s.aimTo = p;
			}
		};

		const onMove = (ev: PointerEvent) => {
			const s = stateRef.current;
			if (activePointerIdRef.current != null && ev.pointerId !== activePointerIdRef.current)
				return;
			if (!s.aiming) return;
			ev.preventDefault();
			s.aimTo = getWorldPointer(ev, c);
		};

		const onUp = (ev: PointerEvent) => {
			const s = stateRef.current;
			if (activePointerIdRef.current != null && ev.pointerId !== activePointerIdRef.current)
				return;
			if (!s.aiming) return;
			ev.preventDefault();
			s.aiming = false;
			activePointerIdRef.current = null;
			try {
				if (c.hasPointerCapture(ev.pointerId)) {
					c.releasePointerCapture(ev.pointerId);
				}
			} catch {}
			const dx = s.aimFrom.x - s.aimTo.x;
			const dy = s.aimFrom.y - s.aimTo.y;
			let vx = dx * CFG.powerScale;
			let vy = dy * CFG.powerScale;
			const sp = hypot(vx, vy);
			if (sp > CFG.maxShotPower) {
				vx = (vx / sp) * CFG.maxShotPower;
				vy = (vy / sp) * CFG.maxShotPower;
			}
			if (hypot(vx, vy) < 0.25) return;
			s.ball.vx = vx;
			s.ball.vy = vy;
			setStrokes((x) => x + 1);
		};
		const onLostPointerCapture = () => {
			const s = stateRef.current;
			if (!s.aiming) return;
			s.aiming = false;
			activePointerIdRef.current = null;
		};

		c.addEventListener("pointerdown", onDown, { passive: false });
		c.addEventListener("pointermove", onMove, { passive: false });
		c.addEventListener("pointerup", onUp, { passive: false });
		c.addEventListener("pointercancel", onUp, { passive: false });
		c.addEventListener("pointerleave", onUp, { passive: false });
		c.addEventListener("lostpointercapture", onLostPointerCapture);
		return () => {
			c.removeEventListener("pointerdown", onDown as EventListener);
			c.removeEventListener("pointermove", onMove as EventListener);
			c.removeEventListener("pointerup", onUp as EventListener);
			c.removeEventListener("pointercancel", onUp as EventListener);
			c.removeEventListener("pointerleave", onUp as EventListener);
			c.removeEventListener("lostpointercapture", onLostPointerCapture as EventListener);
		};
	}, [levelNeedsPurchase, tab]);

	useEffect(() => {
		const c = canvasRef.current;
		if (!c) return;
		const ctx = c.getContext("2d");
		if (!ctx) return;

		const recordWin = () => {
			const finalStrokes = Math.max(1, strokes);

			setUser((prev) => {
				const runPayload = {
					userExternalId: prev.id,
					userDisplayName: prev.name,
					levelCode: level.id,
					strokes: finalStrokes,
				};
				const best = prev.bestScoreByLevel[level.id];
				const nextBest = best == null ? finalStrokes : Math.min(best, finalStrokes);
				const next: UserState = {
					...prev,
					gamesPlayed: prev.gamesPlayed + 1,
					totalStrokes: prev.totalStrokes + finalStrokes,
					bestScoreByLevel: { ...prev.bestScoreByLevel, [level.id]: nextBest },
					completedRuns: [
						{
							id: `${level.id}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
							levelId: level.id,
							levelName: level.name,
							strokes: finalStrokes,
						},
						...prev.completedRuns,
					].slice(0, 30),
				};
				onUserChange?.(next);

				void fetch("/api/levels/runs", {
					method: "POST",
					headers: {
						"content-type": "application/json",
					},
					body: JSON.stringify(runPayload),
				}).catch((error) => {
					console.warn("Failed to record completed run", error);
				});

				return next;
			});
		};

		const engine = createMiniGolfEngine(ctx, {
			level,
			state: stateRef.current,
			assets: assetsRef.current,
			recordWin,
			onAdvanceLevel: () => {
				if (levelIndex < LEVELS.length - 1) {
					setLevelIndex((i) => i + 1);
				} else {
					setFinished(true);
				}
			},
			isPlayBlocked: () => finished || tab !== "play" || levelNeedsPurchase,
		});

		const render = () => {
			const rect = c.getBoundingClientRect();
			engine.tick();
			engine.renderFrame(rect, dprRef.current);
			rafRef.current = requestAnimationFrame(render);
		};

		rafRef.current = requestAnimationFrame(render);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [
		assetsRef,
		dprRef,
		finished,
		level,
		levelIndex,
		levelNeedsPurchase,
		strokes,
		tab,
		onUserChange,
	]);

	useEffect(() => {
		if (tab !== "leaderboard") {
			return;
		}

		const baseline = Math.max(2, level.par - 1);
		const rows = MOCK_LEADERBOARD_PLAYERS.map((player, index) => ({
			rank: index + 1,
			userId: player.userId,
			displayName: player.displayName,
			externalId: `${player.externalId}-${level.id}`,
			bestStrokes: baseline + (index % 4) + Math.floor(index / 3),
		}))
			.sort((left, right) => {
				if (left.bestStrokes !== right.bestStrokes) {
					return left.bestStrokes - right.bestStrokes;
				}
				return left.userId - right.userId;
			})
			.map((row, index) => ({
				...row,
				rank: index + 1,
			}));

		setLeaderboardError("");
		setLeaderboardRows(rows);
		setLeaderboardStatus("success");
	}, [level.id, level.par, tab]);

	useEffect(() => {
		if (tab !== "play" || typeof window === "undefined") {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			window.dispatchEvent(new Event("resize"));
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [tab]);

	const connectWallet = async () => {
		if (isConnected) {
			return;
		}
		const connector = connectors.find((item) => item.id === "injected") ?? connectors[0];
		if (!connector) {
			setTxState("idle");
			setTxMessage("No browser wallet connector found.");
			return;
		}
		try {
			await connectAsync({
				connector,
				chainId: base.id,
			});
		} catch (error) {
			setTxState("idle");
			setTxMessage(
				`Wallet connection failed: ${error instanceof Error ? error.message : "unknown error"}`,
			);
		}
	};

	const purchaseLevelWithWallet = async (targetLevel: (typeof LEVELS)[number]) => {
		const normalizedAddress = address?.toLowerCase();
		if (!isConnected || !normalizedAddress) {
			setTxState("idle");
			setTxMessage("Connect wallet first to buy levels with USDC.");
			return;
		}
		if (!walletClient) {
			setTxState("idle");
			setTxMessage("Wallet client is not ready yet. Try again.");
			return;
		}
		if (chainId !== base.id) {
			setTxState("idle");
			setTxMessage("Switch wallet network to Base mainnet first.");
			return;
		}
		if (!usdcContractAddress || !isAddress(usdcContractAddress)) {
			setTxState("idle");
			setTxMessage("USDC contract address is not configured.");
			return;
		}
		if (!usdcReceiverWallet || !isAddress(usdcReceiverWallet)) {
			setTxState("idle");
			setTxMessage("USDC receiver wallet is not configured.");
			return;
		}
		if (user.purchasedLevelIds.includes(targetLevel.id)) {
			setTxState("idle");
			setTxMessage("Level already purchased.");
			return;
		}
		setTxState("pending");
		setTxMessage(`Sending USDC transfer for ${targetLevel.name}...`);

		try {
			const transferAmount = parseUnits(String(LEVEL_PRICE_USDC), 6);
			const txHash = await walletClient.writeContract({
				account: walletClient.account,
				address: usdcContractAddress,
				abi: erc20Abi,
				functionName: "transfer",
				args: [usdcReceiverWallet, transferAmount],
				chain: base,
			});
			setTxMessage(`Waiting for on-chain confirmation: ${txHash}`);

			const publicClient = createPublicClient({
				chain: base,
				transport: http(),
			});
			const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
			if (receipt.status !== "success") {
				throw new Error("USDC transaction reverted on-chain");
			}

			const response = await fetch("/api/levels/purchase", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					userExternalId: `wallet:${normalizedAddress}`,
					userDisplayName: user.name,
					levelCode: targetLevel.id,
					txHash,
					amountUsdc: LEVEL_PRICE_USDC,
				}),
			});

			if (!response.ok) {
				const errorText = await response.text();
				setTxState("idle");
				setTxMessage(`Purchase failed: ${errorText || "unexpected server error"}`);
				return;
			}

			const payload = (await response.json()) as {
				purchase?: { status?: "created" | "already_purchased"; txHash?: string };
			};

			setUser((prev) => {
				if (prev.purchasedLevelIds.includes(targetLevel.id)) {
					return prev;
				}
				const next: UserState = {
					...prev,
					purchasedLevelIds: [...prev.purchasedLevelIds, targetLevel.id],
				};
				onUserChange?.(next);
				return next;
			});

			setTxState("success");
			setTxMessage(
				`USDC payment confirmed (${payload.purchase?.status ?? "created"}). ${targetLevel.name} unlocked. Tx: ${payload.purchase?.txHash ?? txHash}`,
			);
		} catch (error) {
			setTxState("idle");
			setTxMessage(
				`Purchase failed: ${error instanceof Error ? error.message : "unexpected client error"}`,
			);
		}
	};

	const resetRun = () => {
		const s = stateRef.current;
		s.ball = { x: level.ball.x, y: level.ball.y, vx: 0, vy: 0 };
		s.won = false;
		s.rollAngle = 0;
		setStrokes(0);
		setFinished(false);
	};

	return (
		<div className="h-[100dvh] min-h-[100dvh] overflow-hidden text-[var(--foreground)] flex flex-col items-center px-3 pt-2 pb-3 gap-2">
			<div className="w-full max-w-[440px] flex-1 min-h-0">
				<div className={tab === "play" ? "flex h-full min-h-0 flex-col gap-1" : "hidden"}>
					<div className={`${panelClass} rounded-[28px] overflow-hidden shrink-0`}>
						<div className="flex items-center justify-between gap-2 border-b border-[color:var(--app-border)] bg-[rgba(255,255,255,0.88)] px-3 py-2">
							<div className="min-w-0">
								<div className="text-[11px] uppercase tracking-[0.08em] text-[var(--app-muted)]">
									Level {levelIndex + 1}
								</div>
								<div className="truncate text-[13px] font-semibold text-[#173122]">
									{level.name}
								</div>
							</div>
							<div className="shrink-0 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-center">
								<div className="text-[10px] uppercase tracking-[0.08em] text-[var(--app-muted)]">
									Strokes
								</div>
								<div className="text-[13px] font-semibold text-[#173122]">
									{strokes}
								</div>
							</div>
							<button
								className={`${secondaryButtonClass} min-h-8 shrink-0 px-3 py-1 text-[12px]`}
								type="button"
								onClick={resetRun}
							>
								Restart
							</button>
						</div>
						<div className="w-full aspect-[9/16]">
							<canvas
								ref={canvasRef}
								width={WORLD.w}
								height={WORLD.h}
								className="block h-full w-full touch-none"
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-2">
						<button
							className={`${secondaryButtonClass} min-h-9 py-1.5 text-[12px]`}
							type="button"
							onClick={() => {
								setFinished(false);
								setLevelIndex((i) => Math.max(0, i - 1));
							}}
						>
							Prev Level
						</button>
						<button
							className={`${secondaryButtonClass} min-h-9 py-1.5 text-[12px]`}
							type="button"
							onClick={() => {
								setFinished(false);
								setLevelIndex((i) => Math.min(LEVELS.length - 1, i + 1));
							}}
						>
							Next Level
						</button>
					</div>

					{levelNeedsPurchase && (
						<div className="rounded-[22px] border border-[color:var(--app-border-strong)] bg-[linear-gradient(180deg,var(--app-accent-soft),rgba(255,255,255,0.96))] px-3 py-3 shadow-[0_12px_24px_rgba(111,221,150,0.16)]">
							<div className="text-sm font-semibold text-[#173122]">Level locked</div>
							<div className="mt-1 text-[12px] leading-4 text-[var(--app-muted)]">
								Starting from level 5, each level is bought separately for{" "}
								{LEVEL_PRICE_USDC} USDC.
							</div>
							<button
								className={`${primaryButtonClass} mt-3 w-full`}
								type="button"
								disabled={txState === "pending"}
								onClick={() => purchaseLevelWithWallet(level)}
							>
								Buy this level for {LEVEL_PRICE_USDC} USDC
							</button>
						</div>
					)}
				</div>

				{tab === "leaderboard" && (
					<div className={`${panelClass} h-full overflow-y-auto px-3 py-3`}>
						<div>
							<div className="text-base font-semibold text-[#173122]">
								Leaderboard
							</div>
							<div className="text-sm text-[var(--app-muted)] mt-1">
								Top 10 players by best result on current level.
							</div>
						</div>
						<div className="mt-2 text-xs text-[var(--app-muted)]">
							Level: {level.name}
						</div>
						<div className="mt-3 grid gap-2">
							{leaderboardStatus === "loading" && (
								<div
									className={`${softCardClass} px-3 py-4 text-sm text-[var(--app-muted)]`}
								>
									Loading leaderboard...
								</div>
							)}
							{leaderboardStatus === "error" && (
								<div className="rounded-2xl border border-rose-300/40 bg-rose-50 px-3 py-4 text-sm text-rose-800">
									Failed to load leaderboard:{" "}
									{leaderboardError || "unknown error"}
								</div>
							)}
							{leaderboardStatus === "success" && leaderboardRows.length === 0 && (
								<div
									className={`${softCardClass} px-3 py-4 text-sm text-[var(--app-muted)]`}
								>
									No runs recorded for this level yet.
								</div>
							)}
							{leaderboardStatus === "success" &&
								leaderboardRows.map((row) => (
									<div
										key={row.userId}
										className={`${softCardClass} px-3 py-3 flex items-center justify-between gap-3`}
									>
										<div className="flex items-center gap-3 min-w-0">
											<div className="w-9 h-9 rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-accent-soft)] flex items-center justify-center text-xs text-[#1e5232] shrink-0">
												#{row.rank}
											</div>
											<div className="min-w-0">
												<div className="text-sm text-[#173122] truncate">
													{row.displayName}
												</div>
												<div className="text-xs text-[var(--app-muted)] truncate">
													{row.externalId}
												</div>
											</div>
										</div>
										<div className="text-right shrink-0">
											<div className="text-[11px] uppercase tracking-[0.08em] text-[var(--app-muted)]">
												Best strokes
											</div>
											<div className="text-lg text-[#173122]">
												{row.bestStrokes}
											</div>
										</div>
									</div>
								))}
						</div>
					</div>
				)}

				{tab === "profile" && (
					<div className={`${panelClass} h-full overflow-y-auto px-4 py-4`}>
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-3 min-w-0">
								<div
									className="w-14 h-14 rounded-full border border-[color:var(--app-border)] shrink-0 shadow-[0_8px_18px_rgba(111,221,150,0.12)]"
									style={{ background: user.avatarGradient }}
								/>
								<div className="min-w-0">
									<div className="text-base font-semibold text-[#173122] truncate">
										{user.name}
									</div>
									<div className="text-xs text-[var(--app-muted)] mt-1 truncate">
										{shortAddress(user.walletAddress)}
									</div>
								</div>
							</div>
							<button
								className={
									user.walletConnected ? secondaryButtonClass : primaryButtonClass
								}
								type="button"
								disabled={isWalletConnecting || isConnected}
								onClick={connectWallet}
							>
								{isWalletConnecting
									? "Connecting..."
									: user.walletConnected
										? "Connected"
										: "Connect"}
							</button>
						</div>
					</div>
				)}
			</div>

			<div className="w-full max-w-[440px] shrink-0 rounded-[24px] border border-[color:var(--app-border)] bg-[rgba(255,255,255,0.92)] backdrop-blur-md px-2 py-2 grid grid-cols-3 gap-2 shadow-[0_12px_24px_rgba(111,221,150,0.16)]">
				{(
					[
						["play", "Play"],
						["leaderboard", "Leaders"],
						["profile", "Profile"],
					] as [TabKey, string][]
				).map(([key, label]) => (
					<button
						key={key}
						className={`min-h-10 px-2 py-2 rounded-2xl text-[13px] ${
							tab === key
								? "bg-[linear-gradient(180deg,var(--app-accent),var(--app-accent-strong))] text-[#123321] font-semibold shadow-[0_10px_18px_rgba(41,191,108,0.2)]"
								: "bg-[color:var(--app-surface-soft)] text-[#203b2a] hover:bg-white"
						}`}
						type="button"
						onClick={() => setTab(key)}
					>
						{label}
					</button>
				))}
			</div>
		</div>
	);
}

function dist(ax: number, ay: number, bx: number, by: number): number {
	return Math.hypot(ax - bx, ay - by);
}
