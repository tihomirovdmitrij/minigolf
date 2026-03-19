"use client";

import type { ReactNode } from "react";
import { useMiniApp } from "@/app/providers/MiniAppProvider";

interface SafeAreaProps {
	children: ReactNode;
	className?: string;
}

export function SafeArea({ children, className }: SafeAreaProps) {
	const { context, isReady } = useMiniApp();
	const insets = isReady && context ? context.client?.safeAreaInsets : undefined;

	return (
		<div
			className={className}
			style={{
				minHeight: "100dvh",
				backgroundColor: "#effcf3",
				paddingTop: insets?.top ?? 0,
				paddingBottom: insets?.bottom ?? 0,
				paddingLeft: insets?.left ?? 0,
				paddingRight: insets?.right ?? 0,
			}}
		>
			{children}
		</div>
	);
}
