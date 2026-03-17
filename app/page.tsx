"use client";

import { MiniGolfGame } from "./components/MiniGolfGame";
import { useMiniGolfUser } from "./providers/MiniGolfUserProvider";

export default function Home() {
	const { user } = useMiniGolfUser();
	return <MiniGolfGame initialUser={user} />;
}

