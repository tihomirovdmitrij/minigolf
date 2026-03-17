import { clamp, dist, hypot } from "./math";
import { CFG, WORLD, type Rect, type SurfaceKind } from "./types";
import type { Level } from "./types";

type BallState = {
	x: number;
	y: number;
	vx: number;
	vy: number;
};

export type MiniGolfRuntimeState = {
	ball: BallState;
	won: boolean;
	aiming: boolean;
	aimFrom: { x: number; y: number };
	aimTo: { x: number; y: number };
	rollAngle: number;
	lastT: number;
};

type EngineDeps = {
	level: Level;
	state: MiniGolfRuntimeState;
	assets: {
		grass?: CanvasPattern;
		sand?: CanvasPattern;
		concrete?: CanvasPattern;
		dimples?: HTMLCanvasElement;
	} | null;
	recordWin: () => void;
	onAdvanceLevel: () => void;
	isPlayBlocked: () => boolean;
};

function pointInRect(x: number, y: number, r: Rect) {
	return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function createMiniGolfEngine(ctx: CanvasRenderingContext2D, deps: EngineDeps) {
	const { level, state, assets, recordWin, onAdvanceLevel, isPlayBlocked } = deps;

	const getSurfaceAt = (x: number, y: number): SurfaceKind => {
		for (let i = level.surfaces.length - 1; i >= 0; i -= 1) {
			if (pointInRect(x, y, level.surfaces[i])) return level.surfaces[i].kind;
		}
		return "grass";
	};

	const getFriction = (kind: SurfaceKind) => {
		if (kind === "sand") return CFG.rollingFrictionSand;
		if (kind === "concrete") return CFG.rollingFrictionConcrete;
		return CFG.rollingFrictionGrass;
	};

	const collideWalls = () => {
		const pad = CFG.wallPad;
		const r = CFG.ballR;
		const b = state.ball;
		if (b.x - r < pad) {
			b.x = pad + r;
			b.vx = -b.vx * CFG.restitution;
			b.vy *= CFG.tangentialDamp;
		}
		if (b.x + r > WORLD.w - pad) {
			b.x = WORLD.w - pad - r;
			b.vx = -b.vx * CFG.restitution;
			b.vy *= CFG.tangentialDamp;
		}
		if (b.y - r < pad) {
			b.y = pad + r;
			b.vy = -b.vy * CFG.restitution;
			b.vx *= CFG.tangentialDamp;
		}
		if (b.y + r > WORLD.h - pad) {
			b.y = WORLD.h - pad - r;
			b.vy = -b.vy * CFG.restitution;
			b.vx *= CFG.tangentialDamp;
		}
	};

	const collideBallRect = (rect: Rect) => {
		const b = state.ball;
		const r = CFG.ballR;
		const closestX = clamp(b.x, rect.x, rect.x + rect.w);
		const closestY = clamp(b.y, rect.y, rect.y + rect.h);
		const dx = b.x - closestX;
		const dy = b.y - closestY;
		const d2 = dx * dx + dy * dy;
		if (d2 > r * r) return;
		const d = Math.sqrt(d2) || 0.0001;
		const nx = dx / d;
		const ny = dy / d;
		const overlap = r - d;
		b.x += nx * overlap;
		b.y += ny * overlap;
		const vn = b.vx * nx + b.vy * ny;
		if (vn < 0) {
			b.vx = b.vx - (1 + CFG.restitution) * vn * nx;
			b.vy = b.vy - (1 + CFG.restitution) * vn * ny;
		}
		const tx = b.vx - (b.vx * nx + b.vy * ny) * nx;
		const ty = b.vy - (b.vx * nx + b.vy * ny) * ny;
		b.vx -= tx * (1 - CFG.tangentialDamp);
		b.vy -= ty * (1 - CFG.tangentialDamp);
	};

	const checkHole = () => {
		const { x: hx, y: hy } = level.hole;
		const b = state.ball;
		const d = dist(b.x, b.y, hx, hy);
		const sp = hypot(b.vx, b.vy);
		if (d < CFG.captureDist * 1.35 && sp < CFG.captureSpeed * 1.25 && !state.won) {
			const pull = clamp((CFG.captureDist * 1.35 - d) / (CFG.captureDist * 1.35), 0, 1);
			const ax = (hx - b.x) / (d || 1);
			const ay = (hy - b.y) / (d || 1);
			b.vx += ax * pull * 0.08;
			b.vy += ay * pull * 0.08;
		}
		if (d < CFG.captureDist && sp < CFG.captureSpeed && !state.won) {
			state.won = true;
			b.vx = 0;
			b.vy = 0;
			b.x = hx;
			b.y = hy;
			recordWin();
			window.setTimeout(() => {
				onAdvanceLevel();
			}, 650);
		}
	};

	const step = (dt: number) => {
		const b = state.ball;
		const prevX = b.x;
		const prevY = b.y;
		b.x += b.vx * dt * 60;
		b.y += b.vy * dt * 60;
		collideWalls();
		for (const ob of level.obstacles) collideBallRect(ob);
		const fr = Math.pow(getFriction(getSurfaceAt(b.x, b.y)), dt * 60);
		b.vx *= fr;
		b.vy *= fr;
		if (hypot(b.vx, b.vy) < CFG.stopEps) {
			b.vx = 0;
			b.vy = 0;
		}
		const dd = Math.hypot(b.x - prevX, b.y - prevY);
		state.rollAngle += dd / (CFG.ballR + 0.0001);
		checkHole();
	};

	const drawField = () => {
		const pad = CFG.wallPad;
		ctx.fillStyle = assets?.grass || "#1f9a3d";
		ctx.fillRect(0, 0, WORLD.w, WORLD.h);
		ctx.fillStyle = "rgba(0,0,0,0.08)";
		ctx.beginPath();
		ctx.roundRect(pad, pad, WORLD.w - pad * 2, WORLD.h - pad * 2, 16);
		ctx.fill();
		ctx.lineWidth = 2.4;
		ctx.strokeStyle = "rgba(255,255,255,0.16)";
		ctx.beginPath();
		ctx.roundRect(pad, pad, WORLD.w - pad * 2, WORLD.h - pad * 2, 16);
		ctx.stroke();
	};

	const drawSurfaces = () => {
		for (const sfc of level.surfaces) {
			if (sfc.kind === "grass") continue;
			ctx.beginPath();
			ctx.roundRect(sfc.x, sfc.y, sfc.w, sfc.h, sfc.kind === "sand" ? 10 : 8);
			ctx.fillStyle = sfc.kind === "sand" ? assets?.sand || "#c9ab73" : assets?.concrete || "#9aa3ab";
			ctx.fill();
			ctx.strokeStyle = sfc.kind === "sand" ? "rgba(120,84,28,0.14)" : "rgba(255,255,255,0.10)";
			ctx.lineWidth = 1.1;
			ctx.stroke();
		}
	};

	const drawWalls = () => {
		for (const ob of level.obstacles) {
			const isPost = ob.w <= 14 || ob.h <= 14;
			const grad = ctx.createLinearGradient(ob.x, ob.y, ob.x + ob.w, ob.y + ob.h);
			grad.addColorStop(0, isPost ? "rgba(138,88,48,0.82)" : "rgba(118,74,40,0.82)");
			grad.addColorStop(1, isPost ? "rgba(54,28,14,0.86)" : "rgba(34,18,10,0.86)");
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.roundRect(ob.x, ob.y, ob.w, ob.h, Math.min(6, Math.min(ob.w, ob.h) / 2));
			ctx.fill();
			ctx.strokeStyle = "rgba(0,0,0,0.34)";
			ctx.lineWidth = 1.2;
			ctx.stroke();
		}
	};

	const drawHole = () => {
		const { x, y } = level.hole;
		ctx.beginPath();
		ctx.arc(x, y, CFG.holeR + 3.5, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(0,0,0,0.18)";
		ctx.fill();
		const ring = ctx.createRadialGradient(x, y, 2, x, y, CFG.holeR + 2);
		ring.addColorStop(0, "rgba(255,255,255,0.42)");
		ring.addColorStop(0.5, "rgba(210,218,226,0.22)");
		ring.addColorStop(1, "rgba(84,92,102,0.28)");
		ctx.beginPath();
		ctx.arc(x, y, CFG.holeR + 2, 0, Math.PI * 2);
		ctx.fillStyle = ring;
		ctx.fill();
		const cup = ctx.createRadialGradient(x, y, 1, x, y, CFG.holeR);
		cup.addColorStop(0, "rgba(0,0,0,0.90)");
		cup.addColorStop(0.55, "rgba(10,10,12,0.76)");
		cup.addColorStop(1, "rgba(35,38,42,0.50)");
		ctx.beginPath();
		ctx.arc(x, y, CFG.holeR - 1, 0, Math.PI * 2);
		ctx.fillStyle = cup;
		ctx.fill();
	};

	const drawAim = () => {
		if (!state.aiming) return;
		const dx = state.aimFrom.x - state.aimTo.x;
		const dy = state.aimFrom.y - state.aimTo.y;
		const len = Math.hypot(dx, dy);
		const cl = Math.min(len, CFG.aimLineMax);
		const nx = dx / (len || 1);
		const ny = dy / (len || 1);
		const endX = state.aimFrom.x + nx * cl;
		const endY = state.aimFrom.y + ny * cl;
		ctx.beginPath();
		ctx.moveTo(state.aimFrom.x, state.aimFrom.y);
		ctx.lineTo(endX, endY);
		ctx.strokeStyle = "rgba(255,255,255,0.18)";
		ctx.lineWidth = 10;
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(state.aimFrom.x, state.aimFrom.y);
		ctx.lineTo(endX, endY);
		ctx.strokeStyle = "rgba(255,255,255,0.78)";
		ctx.lineWidth = 3;
		ctx.stroke();
	};

	const drawBall = () => {
		const dimples = assets?.dimples;
		const b = state.ball;
		const r = CFG.ballR;
		ctx.beginPath();
		ctx.ellipse(b.x + 2.8, b.y + 5.4, r * 0.95, r * 0.62, 0, 0, Math.PI * 2);
		ctx.fillStyle = "rgba(0,0,0,0.24)";
		ctx.fill();
		const grad = ctx.createRadialGradient(b.x - r * 0.45, b.y - r * 0.55, 2, b.x, b.y, r * 1.25);
		grad.addColorStop(0, "#ffffff");
		grad.addColorStop(0.5, "#f3f6ff");
		grad.addColorStop(1, "#cdd5e6");
		ctx.beginPath();
		ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
		ctx.fillStyle = grad;
		ctx.fill();
		if (dimples) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(b.x, b.y, r - 0.2, 0, Math.PI * 2);
			ctx.clip();
			ctx.translate(b.x, b.y);
			const dir = Math.atan2(b.vy, b.vx);
			ctx.rotate(state.rollAngle * 0.65 + dir * 0.15);
			ctx.globalAlpha = 0.75;
			const scale = 0.26;
			const w = dimples.width * scale;
			const h = dimples.height * scale;
			for (let yy = -r * 2; yy <= r * 2; yy += h) {
				for (let xx = -r * 2; xx <= r * 2; xx += w) {
					ctx.drawImage(dimples, xx, yy, w, h);
				}
			}
			ctx.restore();
		}
		ctx.beginPath();
		ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
		ctx.strokeStyle = "rgba(0,0,0,0.22)";
		ctx.lineWidth = 1.4;
		ctx.stroke();
	};

	const tick = () => {
		const now = performance.now();
		if (!state.lastT) state.lastT = now;
		let dt = (now - state.lastT) / 1000;
		state.lastT = now;
		dt = Math.min(CFG.maxDt, dt);
		const h = dt / CFG.substeps;
		for (let i = 0; i < CFG.substeps; i += 1) {
			if (!state.won && !isPlayBlocked()) {
				step(h);
			}
		}
	};

	const renderFrame = (canvasRect: DOMRect, dpr: number) => {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, canvasRect.width, canvasRect.height);
		const scale = Math.min(canvasRect.width / WORLD.w, canvasRect.height / WORLD.h);
		const ox = (canvasRect.width - WORLD.w * scale) / 2;
		const oy = (canvasRect.height - WORLD.h * scale) / 2;
		ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
		drawField();
		drawSurfaces();
		drawWalls();
		drawHole();
		drawAim();
		drawBall();
	};

	return {
		tick,
		renderFrame,
	};
}

