"use client";

import styles from "./page.module.css";

const APP_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "Base Putt";

export default function Success() {
	const handleShare = async () => {
		const shareText = `Yay! I just joined the waitlist for ${APP_NAME.toUpperCase()}!`;
		const shareUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;

		try {
			if (navigator.share) {
				await navigator.share({
					title: APP_NAME,
					text: shareText,
					url: shareUrl,
				});
				return;
			}

			const intentUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(
				`${shareText} ${shareUrl}`,
			)}`;
			window.open(intentUrl, "_blank", "noopener,noreferrer");
		} catch (error) {
			console.error("Error sharing:", error);
		}
	};

	return (
		<div className={styles.container}>
			<button className={styles.closeButton} type="button">
				✕
			</button>

			<div className={styles.content}>
				<div className={styles.successMessage}>
					<div className={styles.checkmark}>
						<div className={styles.checkmarkCircle}>
							<div className={styles.checkmarkStem}></div>
							<div className={styles.checkmarkKick}></div>
						</div>
					</div>

					<h1 className={styles.title}>Welcome to the {APP_NAME.toUpperCase()}!</h1>

					<p className={styles.subtitle}>
						You&apos;re in! We&apos;ll notify you as soon as we launch.
						<br />
						Get ready to experience the future of onchain marketing.
					</p>

					<button type="button" onClick={handleShare} className={styles.shareButton}>
						SHARE
					</button>
				</div>
			</div>
		</div>
	);
}
