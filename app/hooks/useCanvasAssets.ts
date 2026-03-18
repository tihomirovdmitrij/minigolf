"use client";

import { useEffect, useRef } from "react";
import type React from "react";

import { WORLD } from "../../lib/minigolf/types";

function makeGrassPattern(ctx: CanvasRenderingContext2D) {
	const p = document.createElement("canvas");
	p.width = 240;
	p.height = 240;
	const g = p.getContext("2d")!;
	g.fillStyle = "#1f9a3d";
	g.fillRect(0, 0, p.width, p.height);
	const sun = g.createRadialGradient(70, 55, 10, 120, 120, 210);
	sun.addColorStop(0, "rgba(255,255,210,0.16)");
	sun.addColorStop(1, "rgba(0,0,0,0)");
	g.fillStyle = sun;
	g.fillRect(0, 0, p.width, p.height);
	for (let i = 0; i < 10500; i += 1) {
		const x = Math.random() * p.width;
		const y = Math.random() * p.height;
		const a = Math.random() * 0.16;
		g.fillStyle = Math.random() < 0.56 ? `rgba(240,255,245,${a})` : `rgba(6,45,16,${a})`;
		g.fillRect(x, y, 1, 1);
	}
	g.globalAlpha = 0.1;
	g.fillStyle = "#e8ffd9";
	for (let i = -p.height; i < p.width + p.height; i += 16) {
		g.save();
		g.translate(i, 0);
		g.rotate((26 * Math.PI) / 180);
		g.fillRect(0, 0, 8, p.height * 2);
		g.restore();
	}
	g.globalAlpha = 1;
	return ctx.createPattern(p, "repeat")!;
}

function makeSandPattern(ctx: CanvasRenderingContext2D) {
	const p = document.createElement("canvas");
	p.width = 180;
	p.height = 180;
	const g = p.getContext("2d")!;
	g.fillStyle = "#c9ab73";
	g.fillRect(0, 0, p.width, p.height);
	const shade = g.createLinearGradient(0, 0, p.width, p.height);
	shade.addColorStop(0, "rgba(255,245,210,0.14)");
	shade.addColorStop(1, "rgba(120,84,28,0.08)");
	g.fillStyle = shade;
	g.fillRect(0, 0, p.width, p.height);
	for (let i = 0; i < 7000; i += 1) {
		const x = Math.random() * p.width;
		const y = Math.random() * p.height;
		const r = Math.random() < 0.82 ? 1 : 1.5;
		g.beginPath();
		g.arc(x, y, r, 0, Math.PI * 2);
		g.fillStyle = Math.random() < 0.5 ? "rgba(155,118,63,0.14)" : "rgba(250,236,196,0.12)";
		g.fill();
	}
	g.strokeStyle = "rgba(145,110,60,0.10)";
	g.lineWidth = 1;
	for (let y = 8; y < p.height; y += 10) {
		g.beginPath();
		g.moveTo(0, y);
		g.quadraticCurveTo(p.width * 0.35, y - 2, p.width, y + 1);
		g.stroke();
	}
	return ctx.createPattern(p, "repeat")!;
}

function makeConcretePattern(ctx: CanvasRenderingContext2D) {
	const p = document.createElement("canvas");
	p.width = 220;
	p.height = 220;
	const g = p.getContext("2d")!;
	g.fillStyle = "#9aa3ab";
	g.fillRect(0, 0, p.width, p.height);
	const grad = g.createLinearGradient(0, 0, p.width, p.height);
	grad.addColorStop(0, "rgba(255,255,255,0.10)");
	grad.addColorStop(1, "rgba(45,55,65,0.10)");
	g.fillStyle = grad;
	g.fillRect(0, 0, p.width, p.height);
	for (let i = 0; i < 9000; i += 1) {
		const x = Math.random() * p.width;
		const y = Math.random() * p.height;
		g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(35,45,55,0.06)";
		g.fillRect(x, y, 1, 1);
	}
	g.strokeStyle = "rgba(70,80,92,0.18)";
	g.lineWidth = 1;
	g.strokeRect(18, 18, p.width - 36, p.height - 36);
	g.strokeRect(70, 70, p.width - 140, p.height - 140);
	return ctx.createPattern(p, "repeat")!;
}

function makeBallDimpleTexture() {
	const p = document.createElement("canvas");
	p.width = 160;
	p.height = 160;
	const g = p.getContext("2d")!;
	for (let y = 10; y < p.height; y += 16) {
		for (let x = 10; x < p.width; x += 16) {
			const r = 2.2 + Math.random();
			g.beginPath();
			g.arc(x + 0.8, y + 1.0, r, 0, Math.PI * 2);
			g.fillStyle = "rgba(0,0,0,0.07)";
			g.fill();
			g.beginPath();
			g.arc(x - 0.7, y - 0.7, r * 0.85, 0, Math.PI * 2);
			g.fillStyle = "rgba(255,255,255,0.09)";
			g.fill();
		}
	}
	return p;
}

export function useCanvasAssets(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
	const assetsRef = useRef<{
		grass?: CanvasPattern;
		sand?: CanvasPattern;
		concrete?: CanvasPattern;
		dimples?: HTMLCanvasElement;
	} | null>(null);
	const dprRef = useRef(1);

	useEffect(() => {
		const c = canvasRef.current;
		if (!c) return;
		const resize = () => {
			const dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
			dprRef.current = dpr;
			const rect = c.getBoundingClientRect();
			const cssW = Math.max(1, Math.floor(rect.width || WORLD.w));
			const cssH = Math.max(1, Math.floor(rect.height || (WORLD.h * cssW) / WORLD.w));
			c.width = Math.floor(cssW * dpr);
			c.height = Math.floor(cssH * dpr);
			const ctx = c.getContext("2d");
			if (!ctx) return;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			assetsRef.current = {
				grass: makeGrassPattern(ctx),
				sand: makeSandPattern(ctx),
				concrete: makeConcretePattern(ctx),
				dimples: makeBallDimpleTexture(),
			};
		};
		resize();
		window.addEventListener("resize", resize);
		return () => window.removeEventListener("resize", resize);
	}, [canvasRef]);

	return { assetsRef, dprRef, worldSize: WORLD };
}

export function getWorldPointer(ev: PointerEvent, canvas: HTMLCanvasElement) {
	const rect = canvas.getBoundingClientRect();
	const px = ev.clientX - rect.left;
	const py = ev.clientY - rect.top;
	const scale = Math.min(rect.width / WORLD.w, rect.height / WORLD.h);
	const ox = (rect.width - WORLD.w * scale) / 2;
	const oy = (rect.height - WORLD.h * scale) / 2;
	return { x: (px - ox) / scale, y: (py - oy) / scale };
}

