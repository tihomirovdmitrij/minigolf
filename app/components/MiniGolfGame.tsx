"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type UserRunHistoryApiRow = {
	id: string;
	levelCode: string;
	levelName: string;
	strokes: number;
	completedAt: string;
};

type PaymentConfigApiResponse = {
	success: boolean;
	config?: {
		usdcContractAddress: string;
		receiverWalletAddress: string;
	};
};

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
	const [txMessage, setTxMessage] = useState("");
	const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardApiRow[]>([]);
	const [leaderboardStatus, setLeaderboardStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [leaderboardError, setLeaderboardError] = useState("");
	const [historyRows, setHistoryRows] = useState<UserRunHistoryApiRow[]>([]);
	const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "success" | "error">(
		"idle",
	);
	const [historyError, setHistoryError] = useState("");
	const [paymentConfig, setPaymentConfig] = useState<{
		usdcContractAddress: string;
		receiverWalletAddress: string;
	} | null>(null);
	const { address, isConnected, chainId } = useAccount();
	const { connectAsync, connectors, isPending: isWalletConnecting } = useConnect();
	const { data: walletClient } = useWalletClient();

	const level = LEVELS[levelIndex];
	const levelNeedsPurchase =
		levelIndex >= FREE_LEVELS.length && !user.purchasedLevelIds.includes(level.id);

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
		let isCancelled = false;
		const loadPaymentConfig = async () => {
			try {
				const response = await fetch("/api/payments/config");
				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(errorText || "failed to fetch payment config");
				}
				const payload = (await response.json()) as PaymentConfigApiResponse;
				if (!payload.success || !payload.config) {
					throw new Error("missing payment config in response");
				}
				if (!isCancelled) {
					setPaymentConfig(payload.config);
				}
			} catch (error) {
				if (!isCancelled) {
					setTxMessage(
						`Payment config unavailable: ${error instanceof Error ? error.message : "unknown error"}`,
					);
				}
			}
		};
		void loadPaymentConfig();
		return () => {
			isCancelled = true;
		};
	}, []);

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

		let isCancelled = false;
		const loadLeaderboard = async () => {
			setLeaderboardStatus("loading");
			setLeaderboardError("");

			try {
				const response = await fetch(
					`/api/leaderboard?levelCode=${encodeURIComponent(level.id)}`,
				);
				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(errorText || "failed to fetch leaderboard");
				}

				const payload = (await response.json()) as { rows?: LeaderboardApiRow[] };
				if (isCancelled) {
					return;
				}
				setLeaderboardRows(Array.isArray(payload.rows) ? payload.rows : []);
				setLeaderboardStatus("success");
			} catch (error) {
				if (isCancelled) {
					return;
				}
				setLeaderboardStatus("error");
				setLeaderboardRows([]);
				setLeaderboardError(
					error instanceof Error ? error.message : "Unexpected leaderboard error",
				);
			}
		};

		void loadLeaderboard();

		return () => {
			isCancelled = true;
		};
	}, [level.id, tab]);

	useEffect(() => {
		if (tab !== "history") {
			return;
		}

		let isCancelled = false;
		const loadHistory = async () => {
			setHistoryStatus("loading");
			setHistoryError("");
			try {
				const response = await fetch(
					`/api/levels/runs?userExternalId=${encodeURIComponent(user.id)}&limit=30`,
				);
				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(errorText || "failed to fetch history");
				}

				const payload = (await response.json()) as { rows?: UserRunHistoryApiRow[] };
				if (isCancelled) {
					return;
				}
				setHistoryRows(Array.isArray(payload.rows) ? payload.rows : []);
				setHistoryStatus("success");
			} catch (error) {
				if (isCancelled) {
					return;
				}
				setHistoryStatus("error");
				setHistoryRows([]);
				setHistoryError(
					error instanceof Error ? error.message : "Unexpected history error",
				);
			}
		};

		void loadHistory();

		return () => {
			isCancelled = true;
		};
	}, [tab, user.id]);

	const freeCount = FREE_LEVELS.length;
	const currentGroup = levelIndex < freeCount ? "Free" : "Premium";
	const bestForLevel = user.bestScoreByLevel[level.id];

	const header = useMemo(() => {
		if (finished && levelIndex >= LEVELS.length - 1) return "✅ All levels complete";
		return `${currentGroup} · ${level.name} · Par ${level.par} · Strokes: ${strokes}`;
	}, [currentGroup, finished, level.name, level.par, levelIndex, strokes]);

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
		if (!paymentConfig) {
			setTxState("idle");
			setTxMessage("Payment config is not loaded yet.");
			return;
		}
		if (!isAddress(paymentConfig.usdcContractAddress)) {
			setTxState("idle");
			setTxMessage("USDC contract address is not configured.");
			return;
		}
		if (!isAddress(paymentConfig.receiverWalletAddress)) {
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
				address: paymentConfig.usdcContractAddress,
				abi: erc20Abi,
				functionName: "transfer",
				args: [paymentConfig.receiverWalletAddress, transferAmount],
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

			const responsePayload = (await response.json().catch(() => null)) as {
				success?: boolean;
				message?: string;
				purchase?: { status?: "created" | "already_purchased"; txHash?: string };
			} | null;
			const responseMessage =
				typeof responsePayload?.message === "string" && responsePayload.message.length > 0
					? responsePayload.message
					: "unexpected server error";

			if (!response.ok) {
				setTxState("idle");
				if (response.status === 409) {
					setTxMessage(`Purchase rejected: ${responseMessage}`);
				} else if (response.status === 422) {
					setTxMessage(`Purchase validation failed: ${responseMessage}`);
				} else {
					setTxMessage(`Purchase failed: ${responseMessage}`);
				}
				return;
			}

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
				`USDC payment confirmed (${responsePayload?.purchase?.status ?? "created"}). ${targetLevel.name} unlocked. Tx: ${responsePayload?.purchase?.txHash ?? txHash}`,
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
		<div className="min-h-screen bg-[#070b10] text-slate-100 flex flex-col items-center px-3 pt-4 pb-24 gap-3">
			<div className="w-full max-w-[440px] flex items-start justify-between gap-2">
				<div className="flex-1 px-3 py-2 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))]">
					<div className="text-xs text-white/80">{header}</div>
					<div className="text-[11px] text-white/50 mt-1">{level.theme}</div>
				</div>
				<button
					className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
					type="button"
					onClick={resetRun}
				>
					Restart
				</button>
			</div>

			<div className="w-full max-w-[440px] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_24px_60px_rgba(0,0,0,0.42)] overflow-hidden backdrop-blur-sm">
				<canvas
					ref={canvasRef}
					width={WORLD.w}
					height={WORLD.h}
					className="block w-full h-auto aspect-[9/16] touch-none"
				/>
			</div>

			<div className="w-full max-w-[440px] grid grid-cols-2 gap-2">
				<button
					className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
					type="button"
					onClick={() => {
						setFinished(false);
						setLevelIndex((i) => Math.max(0, i - 1));
					}}
				>
					Prev Level
				</button>
				<button
					className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
					type="button"
					onClick={() => {
						setFinished(false);
						setLevelIndex((i) => Math.min(LEVELS.length - 1, i + 1));
					}}
				>
					Next Level
				</button>
			</div>

			{tab === "play" && (
				<div className="w-full max-w-[440px] grid grid-cols-3 gap-2">
					<div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
						<div className="text-[10px] text-white/50">Best</div>
						<div className="text-sm mt-1">{bestForLevel ?? "—"}</div>
					</div>
					<div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
						<div className="text-[10px] text-white/50">Surface</div>
						<div className="text-sm mt-1">{level.surfaces[0]?.kind ?? "grass"}</div>
					</div>
					<div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
						<div className="text-[10px] text-white/50">Unlock price</div>
						<div className="text-sm mt-1">
							{levelIndex >= FREE_LEVELS.length ? `${LEVEL_PRICE_USDC} USDC` : "Free"}
						</div>
					</div>
				</div>
			)}

			{levelNeedsPurchase && (
				<div className="w-full max-w-[440px] rounded-2xl border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.18),rgba(16,185,129,0.10))] px-4 py-3">
					<div className="text-sm font-medium">Level locked</div>
					<div className="text-xs text-white/70 mt-1">
						Starting from level 5, each level is bought separately for{" "}
						{LEVEL_PRICE_USDC} USDC.
					</div>
					<button
						className="mt-3 w-full px-3 py-2 rounded-xl bg-emerald-500 text-black text-sm font-medium"
						type="button"
						disabled={txState === "pending"}
						onClick={() => purchaseLevelWithWallet(level)}
					>
						Buy this level for {LEVEL_PRICE_USDC} USDC
					</button>
				</div>
			)}

			{tab === "levels" && (
				<div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-3 py-3">
					<div className="text-sm font-medium">Levels</div>
					<div className="text-[11px] text-white/55 mt-1">
						Levels 1–4 are free. Starting from level 5, each level unlock costs 0.1
						USDC.
					</div>
					<div className="mt-3 grid grid-cols-2 gap-2">
						{LEVELS.map((lvl, idx) => {
							const locked =
								idx >= FREE_LEVELS.length &&
								!user.purchasedLevelIds.includes(lvl.id);
							const active = idx === levelIndex;
							const best = user.bestScoreByLevel[lvl.id];
							return (
								<div
									key={lvl.id}
									className={`rounded-2xl border px-3 py-3 ${
										active
											? "border-emerald-300 bg-emerald-400/10"
											: "border-white/10 bg-white/5"
									}`}
								>
									<div className="text-xs text-white/80 flex items-center justify-between gap-2">
										<span>{lvl.name}</span>
										<span>
											{locked ? "🔒" : idx >= FREE_LEVELS.length ? "◦" : "•"}
										</span>
									</div>
									<div className="text-[11px] text-white/50 mt-1">
										Par {lvl.par} · {lvl.surfaces[0]?.kind}
									</div>
									<div className="text-[11px] text-white/40 mt-1">
										Best: {best ?? "—"}
									</div>
									<div className="mt-3 flex gap-2">
										<button
											className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs disabled:opacity-50"
											type="button"
											disabled={locked}
											onClick={() => {
												if (locked) return;
												setLevelIndex(idx);
												setTab("play");
											}}
										>
											{active ? "Current" : "Play"}
										</button>
										{locked && (
											<button
												className="px-3 py-2 rounded-xl bg-white text-black text-xs font-medium"
												type="button"
												disabled={txState === "pending"}
												onClick={() => purchaseLevelWithWallet(lvl)}
											>
												Buy 0.1
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
					<div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
						<div className="text-[11px] text-white/55">Transaction status</div>
						<div
							className={`text-sm mt-1 ${
								txState === "success"
									? "text-emerald-300"
									: txState === "pending"
										? "text-yellow-300"
										: "text-white/80"
							}`}
						>
							{txMessage || "No active transaction."}
						</div>
					</div>
				</div>
			)}

			{tab === "history" && (
				<div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-3 py-3">
					<div className="text-sm font-medium">Completed levels</div>
					<div className="text-[11px] text-white/55 mt-1">
						Recent clears and how many strokes each run took.
					</div>
					<div className="mt-3 grid gap-2">
						{historyStatus === "loading" && (
							<div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/60">
								Loading history...
							</div>
						)}
						{historyStatus === "error" && (
							<div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-3 py-4 text-sm text-rose-100">
								Failed to load history: {historyError || "unknown error"}
							</div>
						)}
						{historyStatus === "success" && historyRows.length === 0 && (
							<div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/60">
								No completed runs yet.
							</div>
						)}
						{historyStatus === "success" &&
							historyRows.map((run, index) => (
								<div
									key={run.id}
									className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex items-center justify-between gap-3"
								>
									<div>
										<div className="text-sm text-white/85">{run.levelName}</div>
										<div className="text-[11px] text-white/45 mt-1">
											Run #{historyRows.length - index}
										</div>
									</div>
									<div className="text-right">
										<div className="text-[10px] text-white/50">Strokes</div>
										<div className="text-sm">{run.strokes}</div>
									</div>
								</div>
							))}
					</div>
				</div>
			)}

			{tab === "leaderboard" && (
				<div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-3 py-3">
					<div>
						<div className="text-sm font-medium">Leaderboard</div>
						<div className="text-[11px] text-white/55 mt-1">
							Top 10 players by best result on current level.
						</div>
					</div>
					<div className="mt-2 text-[11px] text-white/50">Level: {level.name}</div>
					<div className="mt-3 grid gap-2">
						{leaderboardStatus === "loading" && (
							<div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/60">
								Loading leaderboard...
							</div>
						)}
						{leaderboardStatus === "error" && (
							<div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-3 py-4 text-sm text-rose-100">
								Failed to load leaderboard: {leaderboardError || "unknown error"}
							</div>
						)}
						{leaderboardStatus === "success" && leaderboardRows.length === 0 && (
							<div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-sm text-white/60">
								No runs recorded for this level yet.
							</div>
						)}
						{leaderboardStatus === "success" &&
							leaderboardRows.map((row) => (
								<div
									key={row.userId}
									className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 flex items-center justify-between gap-3"
								>
									<div className="flex items-center gap-3 min-w-0">
										<div className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/80 shrink-0">
											#{row.rank}
										</div>
										<div className="min-w-0">
											<div className="text-sm text-white/85 truncate">
												{row.displayName}
											</div>
											<div className="text-[11px] text-white/45 truncate">
												{row.externalId}
											</div>
										</div>
									</div>
									<div className="text-right shrink-0">
										<div className="text-[10px] text-white/50">
											Best strokes
										</div>
										<div className="text-sm">{row.bestStrokes}</div>
									</div>
								</div>
							))}
					</div>
				</div>
			)}

			{tab === "profile" && (
				<div className="w-full max-w-[440px] rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] px-3 py-3">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-3 min-w-0">
							<div
								className="w-14 h-14 rounded-full border border-white/10 shrink-0"
								style={{ background: user.avatarGradient }}
							/>
							<div className="min-w-0">
								<div className="text-sm font-medium truncate">{user.name}</div>
								<div className="text-[11px] text-white/50 mt-1 truncate">
									{shortAddress(user.walletAddress)}
								</div>
							</div>
						</div>
						<button
							className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs"
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

			<div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[440px] rounded-2xl border border-white/10 bg-[rgba(10,14,20,0.82)] backdrop-blur-md px-2 py-2 grid grid-cols-5 gap-2">
				{(
					[
						["play", "Play"],
						["levels", "Levels"],
						["history", "History"],
						["leaderboard", "Leaders"],
						["profile", "Profile"],
					] as [TabKey, string][]
				).map(([key, label]) => (
					<button
						key={key}
						className={`px-2 py-2 rounded-xl text-xs ${
							tab === key
								? "bg-emerald-500 text-black font-medium"
								: "bg-white/5 text-white/75 hover:bg-white/10"
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
