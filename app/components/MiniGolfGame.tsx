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

type UserRunHistoryApiRow = {
	id: string;
	levelCode: string;
	levelName: string;
	strokes: number;
	completedAt: string;
};

const panelClass =
	"rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[0_20px_45px_rgba(111,221,150,0.16)] backdrop-blur-sm";

const softCardClass =
	"rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_10px_24px_rgba(111,221,150,0.08)]";

const leaderboardExternalIdTruncateInDev = process.env.NODE_ENV === "development";

const secondaryButtonClass =
	"min-h-10 px-3 py-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--foreground)] hover:bg-[color:var(--app-surface-soft)] text-[13px] font-medium";

const primaryButtonClass =
	"min-h-10 px-3 py-2 rounded-2xl bg-[linear-gradient(180deg,var(--app-accent),var(--app-accent-strong))] text-[#123321] text-[13px] font-semibold shadow-[0_12px_24px_rgba(41,191,108,0.22)]";

type PaymentConfigApiResponse = {
	success: boolean;
	config?: {
		usdcContractAddress: string;
		receiverWalletAddress: string;
	};
};

type LeaderboardApiPayload = {
	success?: boolean;
	rows?: LeaderboardApiRow[];
	message?: string;
};

export function MiniGolfGame({ initialUser, onUserChange }: MiniGolfGameProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const playScrollRef = useRef<HTMLDivElement | null>(null);
	const hasAttemptedAutoConnectRef = useRef(false);
	const rafRef = useRef<number | null>(null);
	const activePointerIdRef = useRef<number | null>(null);
	const scrollPointerRef = useRef<{ id: number; lastY: number } | null>(null);
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

		const isTouchLikePointer = (ev: PointerEvent) => ev.pointerType !== "mouse";

		// Radius within which a touch starts aiming; outside → manual scroll forwarding.
		const aimGrabR = CFG.ballR + 18;

		const onDown = (ev: PointerEvent) => {
			const touchLike = isTouchLikePointer(ev);
			if (!canShoot()) {
				if (touchLike) {
					scrollPointerRef.current = { id: ev.pointerId, lastY: ev.clientY };
				} else {
					ev.preventDefault();
				}
				return;
			}
			const p = getWorldPointer(ev, c);
			const s = stateRef.current;
			const d = dist(p.x, p.y, s.ball.x, s.ball.y);
			if (touchLike && d > aimGrabR) {
				scrollPointerRef.current = { id: ev.pointerId, lastY: ev.clientY };
				return;
			}
			ev.preventDefault();
			activePointerIdRef.current = ev.pointerId;
			try {
				c.setPointerCapture(ev.pointerId);
			} catch {}
			s.aiming = true;
			s.aimFrom = { x: s.ball.x, y: s.ball.y };
			s.aimTo = p;
		};

		const onMove = (ev: PointerEvent) => {
			// Forward manual scroll for out-of-aim touches.
			const sp = scrollPointerRef.current;
			if (sp && ev.pointerId === sp.id) {
				const dy = ev.clientY - sp.lastY;
				sp.lastY = ev.clientY;
				playScrollRef.current?.scrollBy(0, -dy * 0.65);
				return;
			}
			const s = stateRef.current;
			if (activePointerIdRef.current != null && ev.pointerId !== activePointerIdRef.current)
				return;
			if (!s.aiming) return;
			ev.preventDefault();
			s.aimTo = getWorldPointer(ev, c);
		};

		const releaseAimCapture = (ev: PointerEvent) => {
			try {
				if (c.hasPointerCapture(ev.pointerId)) {
					c.releasePointerCapture(ev.pointerId);
				}
			} catch {}
		};

		const clearScrollPointer = (ev: PointerEvent) => {
			if (scrollPointerRef.current?.id === ev.pointerId) {
				scrollPointerRef.current = null;
			}
		};

		const cancelAim = (ev: PointerEvent) => {
			clearScrollPointer(ev);
			const s = stateRef.current;
			if (activePointerIdRef.current != null && ev.pointerId !== activePointerIdRef.current)
				return;
			if (!s.aiming) return;
			s.aiming = false;
			activePointerIdRef.current = null;
			releaseAimCapture(ev);
		};

		const completeAimShot = (ev: PointerEvent) => {
			clearScrollPointer(ev);
			const s = stateRef.current;
			if (activePointerIdRef.current != null && ev.pointerId !== activePointerIdRef.current)
				return;
			if (!s.aiming) return;
			ev.preventDefault();
			s.aiming = false;
			activePointerIdRef.current = null;
			releaseAimCapture(ev);
			const dx = s.aimFrom.x - s.aimTo.x;
			const dy = s.aimFrom.y - s.aimTo.y;
			let vx = dx * CFG.powerScale;
			let vy = dy * CFG.powerScale;
			const speed = hypot(vx, vy);
			if (speed > CFG.maxShotPower) {
				vx = (vx / speed) * CFG.maxShotPower;
				vy = (vy / speed) * CFG.maxShotPower;
			}
			if (hypot(vx, vy) < 0.25) return;
			s.ball.vx = vx;
			s.ball.vy = vy;
			setStrokes((x) => x + 1);
		};

		const onPointerLeave = (ev: PointerEvent) => {
			clearScrollPointer(ev);
			if (ev.pointerType !== "mouse") return;
			if (c.hasPointerCapture(ev.pointerId)) return;
			completeAimShot(ev);
		};

		const onLostPointerCapture = () => {
			const s = stateRef.current;
			if (!s.aiming) return;
			s.aiming = false;
			activePointerIdRef.current = null;
		};

		c.addEventListener("pointerdown", onDown, { passive: false });
		c.addEventListener("pointermove", onMove, { passive: false });
		c.addEventListener("pointerup", completeAimShot, { passive: false });
		c.addEventListener("pointercancel", cancelAim, { passive: false });
		c.addEventListener("pointerleave", onPointerLeave, { passive: false });
		c.addEventListener("lostpointercapture", onLostPointerCapture);
		return () => {
			scrollPointerRef.current = null;
			c.removeEventListener("pointerdown", onDown as EventListener);
			c.removeEventListener("pointermove", onMove as EventListener);
			c.removeEventListener("pointerup", completeAimShot as EventListener);
			c.removeEventListener("pointercancel", cancelAim as EventListener);
			c.removeEventListener("pointerleave", onPointerLeave as EventListener);
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

		let cancelled = false;
		const loadLeaderboard = async () => {
			setLeaderboardStatus("loading");
			setLeaderboardError("");
			try {
				const response = await fetch(
					`/api/leaderboard?levelCode=${encodeURIComponent(level.id)}`,
				);
				const payload = (await response
					.json()
					.catch(() => null)) as LeaderboardApiPayload | null;
				if (cancelled) {
					return;
				}
				if (!response.ok) {
					const msg =
						typeof payload?.message === "string" && payload.message.length > 0
							? payload.message
							: "Failed to load leaderboard";
					throw new Error(msg);
				}
				if (!payload?.success || !Array.isArray(payload.rows)) {
					throw new Error("Unexpected leaderboard response");
				}
				setLeaderboardRows(payload.rows);
				setLeaderboardStatus("success");
			} catch (error) {
				if (cancelled) {
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
			cancelled = true;
		};
	}, [level.id, tab]);

	useEffect(() => {
		if ((tab !== "play" && tab !== "profile") || typeof window === "undefined") {
			return;
		}

		let resizeFrameId: number | null = null;
		if (tab === "play") {
			resizeFrameId = window.requestAnimationFrame(() => {
				window.dispatchEvent(new Event("resize"));
			});
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
			if (resizeFrameId !== null) {
				window.cancelAnimationFrame(resizeFrameId);
			}
		};
	}, [tab, user.id]);

	const connectWallet = async () => {
		if (isConnected) {
			return;
		}
		const connector =
			connectors.find((item) => item.id === "baseAccount") ??
			connectors.find((item) => item.id === "coinbaseWalletSDK") ??
			connectors.find((item) => item.id === "coinbaseWallet") ??
			connectors.find((item) => item.id === "injected") ??
			connectors.find((item) => item.ready) ??
			connectors[0];
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

	useEffect(() => {
		if (hasAttemptedAutoConnectRef.current) {
			return;
		}
		if (isConnected || isWalletConnecting || connectors.length === 0) {
			return;
		}

		const connector =
			connectors.find((item) => item.id === "baseAccount") ??
			connectors.find((item) => item.id === "coinbaseWalletSDK") ??
			connectors.find((item) => item.id === "coinbaseWallet") ??
			connectors.find((item) => item.id === "injected") ??
			connectors.find((item) => item.ready) ??
			null;
		if (!connector) {
			return;
		}

		hasAttemptedAutoConnectRef.current = true;
		void connectAsync({
			connector,
			chainId: base.id,
		}).catch(() => {
			setTxState("idle");
			setTxMessage("Auto-connect unavailable. Tap Connect to retry.");
		});
	}, [connectAsync, connectors, isConnected, isWalletConnecting]);

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
			const rawMessage = error instanceof Error ? error.message : "unexpected client error";
			const isUserRejected = rawMessage.includes("User rejected the request");
			const userFacingMessage =
				process.env.NODE_ENV === "development" || !isUserRejected
					? rawMessage
					: "User rejected the request.";
			setTxMessage(`Purchase failed: ${userFacingMessage}`);
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
		<div className="h-[100dvh] min-h-[100dvh] overflow-hidden text-[color:var(--foreground)] flex flex-col items-center px-3 pt-2 pb-3 gap-2">
			<div className="flex min-h-0 min-w-0 w-full max-w-[440px] flex-1 flex-col">
				<div
					ref={playScrollRef}
					className={
						tab === "play"
							? "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
							: "hidden"
					}
				>
					<div className={`${panelClass} rounded-[28px] overflow-hidden shrink-0`}>
						<div className="flex items-center justify-between gap-2 border-b border-[color:var(--app-border)] bg-[rgba(255,255,255,0.88)] px-3 py-2">
							<div className="min-w-0">
								<div className="text-[11px] uppercase tracking-[0.08em] font-medium text-[color:var(--app-muted)]">
									Level {levelIndex + 1}
								</div>
								<div className="truncate text-[13px] font-semibold text-[color:var(--foreground)]">
									{level.name}
								</div>
							</div>
							<div className="shrink-0 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-center">
								<div className="text-[10px] uppercase tracking-[0.08em] font-medium text-[color:var(--app-muted)]">
									Strokes
								</div>
								<div className="text-[13px] font-semibold text-[color:var(--foreground)]">
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
						<div className="relative w-full aspect-[9/16]">
							<canvas
								ref={canvasRef}
								width={WORLD.w}
								height={WORLD.h}
								className="block h-full w-full touch-none"
							/>
							{levelNeedsPurchase && (
								<div className="absolute inset-x-2 bottom-2 z-10 rounded-[18px] border border-[color:var(--app-border-strong)] bg-[linear-gradient(180deg,rgba(230,255,238,0.97),rgba(255,255,255,0.95))] px-3 py-3 shadow-[0_12px_24px_rgba(111,221,150,0.2)] backdrop-blur-sm">
									<div className="text-sm font-semibold text-[color:var(--foreground)]">
										Level locked
									</div>
									<div className="mt-1 text-[12px] leading-snug text-[color:var(--app-muted)]">
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
									{(txMessage || txState !== "idle") && (
										<div
											className={`mt-2 text-[12px] leading-4 ${
												txState === "success"
													? "text-emerald-800"
													: txState === "pending"
														? "text-amber-900"
														: "text-[color:var(--app-muted)]"
											}`}
										>
											{txMessage || "…"}
										</div>
									)}
								</div>
							)}
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

				</div>

				{tab === "leaderboard" && (
					<div
						className={`${panelClass} flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-3`}
					>
						<div className="min-w-0">
							<div className="text-base font-semibold text-[color:var(--foreground)]">
								Leaderboard
							</div>
							<div className="mt-1 break-words text-sm text-[color:var(--app-muted)] [overflow-wrap:anywhere]">
								Top players by best strokes on the level you have selected in Play.
							</div>
						</div>
						<div className="mt-2 min-w-0 break-words text-xs font-medium text-[color:var(--app-muted)] [overflow-wrap:anywhere]">
							Level: {level.name}
						</div>
						<div className="mt-3 grid min-w-0 gap-2">
							{leaderboardStatus === "loading" && (
								<div
									className={`${softCardClass} px-3 py-4 text-sm text-[color:var(--app-muted)]`}
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
									className={`${softCardClass} px-3 py-4 text-sm text-[color:var(--app-muted)]`}
								>
									No runs recorded for this level yet.
								</div>
							)}
							{leaderboardStatus === "success" &&
								leaderboardRows.map((row) => (
									<div
										key={`${row.rank}-${row.userId}-${row.externalId}`}
										className={`${softCardClass} flex min-w-0 items-center justify-between gap-3 px-3 py-3`}
									>
										<div className="flex min-w-0 flex-1 items-center gap-3">
											<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-accent-soft)] text-xs text-[#1e5232]">
												#{row.rank}
											</div>
											<div className="min-w-0 max-w-full flex-1">
												<div className="break-words text-sm text-[#173122] [overflow-wrap:anywhere]">
													{row.displayName}
												</div>
												{row.displayName.trim() !==
													row.externalId.trim() && (
													<div
														className={`text-xs text-[color:var(--app-muted)] ${
															leaderboardExternalIdTruncateInDev
																? "truncate"
																: "break-words [overflow-wrap:anywhere]"
														}`}
													>
														{row.externalId}
													</div>
												)}
											</div>
										</div>
										<div className="shrink-0 text-right">
											<div className="text-[11px] uppercase tracking-[0.08em] text-[color:var(--app-muted)]">
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
					<div
						className={`${panelClass} flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain px-4 py-4`}
					>
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-3 min-w-0">
								<div
									className="w-14 h-14 rounded-full border border-[color:var(--app-border)] shrink-0 shadow-[0_8px_18px_rgba(111,221,150,0.12)]"
									style={{ background: user.avatarGradient }}
								/>
								<div className="min-w-0">
									<div className="text-base font-semibold text-[color:var(--foreground)] truncate">
										{user.name}
									</div>
									<div className="text-xs text-[color:var(--app-muted)] mt-1 truncate">
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
						{(txMessage || txState !== "idle") && (
							<div
								className={`mt-4 text-[13px] ${
									txState === "success"
										? "text-emerald-800"
										: txState === "pending"
											? "text-amber-900"
											: "text-[color:var(--app-muted)]"
								}`}
							>
								<div className="text-[11px] uppercase tracking-[0.08em] font-medium text-[color:var(--app-muted)]">
									Transaction
								</div>
								<div className="mt-1">{txMessage || "…"}</div>
							</div>
						)}
						<div className="mt-6">
							<div className="text-sm font-semibold text-[color:var(--foreground)]">
								Recent runs
							</div>
							<div className="text-[12px] text-[color:var(--app-muted)] mt-1">
								Recent clears from the server.
							</div>
							<div className="mt-3 grid gap-2">
								{historyStatus === "loading" && (
									<div
										className={`${softCardClass} px-3 py-4 text-sm text-[color:var(--app-muted)]`}
									>
										Loading history...
									</div>
								)}
								{historyStatus === "error" && (
									<div className="rounded-2xl border border-rose-300/40 bg-rose-50 px-3 py-4 text-sm text-rose-800">
										Failed to load history: {historyError || "unknown error"}
									</div>
								)}
								{historyStatus === "success" && historyRows.length === 0 && (
									<div
										className={`${softCardClass} px-3 py-4 text-sm text-[color:var(--app-muted)]`}
									>
										No completed runs yet.
									</div>
								)}
								{historyStatus === "success" &&
									historyRows.map((run, index) => (
										<div
											key={run.id}
											className={`${softCardClass} px-3 py-3 flex items-center justify-between gap-3`}
										>
											<div className="min-w-0">
												<div className="text-sm font-medium text-[color:var(--foreground)] truncate">
													{run.levelName}
												</div>
												<div className="text-[11px] text-[color:var(--app-muted)] mt-0.5">
													Run #{historyRows.length - index}
												</div>
											</div>
											<div className="text-right shrink-0">
												<div className="text-[10px] uppercase tracking-[0.08em] font-medium text-[color:var(--app-muted)]">
													Strokes
												</div>
												<div className="text-sm font-semibold text-[color:var(--foreground)]">
													{run.strokes}
												</div>
											</div>
										</div>
									))}
							</div>
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
								: "bg-[color:var(--app-surface-soft)] text-[color:var(--foreground)] hover:bg-white"
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
