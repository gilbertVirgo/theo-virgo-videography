import React from "react";

export default ({ title, description, video_file, video_orientation }) => {
	let [showFullText, setShowFullText] = React.useState(false);
	let [isPaused, setIsPaused] = React.useState(false); // Video starts with autoPlay
	let [isMuted, setIsMuted] = React.useState(true);
	let [actionIndicator, setActionIndicator] = React.useState(null); // 'pause', 'rewind', or null

	const mainVideoRef = React.useRef(null);
	const overflowVideoRef = React.useRef(null);
	const syncRAFRef = React.useRef(null);

	let videoMimeType = `video/${video_file.url.split(".").pop()}`;

	// Sync underlay video with main video
	const syncVideos = React.useCallback(() => {
		const mainVideo = mainVideoRef.current;
		const underlayVideo = overflowVideoRef.current;

		if (!mainVideo || !underlayVideo) return;

		// Sync play state
		if (mainVideo.paused && !underlayVideo.paused) {
			underlayVideo.pause();
		} else if (!mainVideo.paused && underlayVideo.paused) {
			underlayVideo.play().catch(() => {}); // Ignore autoplay errors
		}

		// Sync currentTime (only if difference is significant to avoid micro-adjustments)
		const timeDiff = Math.abs(
			mainVideo.currentTime - underlayVideo.currentTime
		);
		if (timeDiff > 0.1) {
			// 100ms threshold
			underlayVideo.currentTime = mainVideo.currentTime;
		}
	}, []);

	// Optimized sync using requestAnimationFrame
	const requestSync = React.useCallback(() => {
		if (syncRAFRef.current) return; // Prevent multiple RAF calls

		syncRAFRef.current = requestAnimationFrame(() => {
			syncVideos();
			syncRAFRef.current = null;
		});
	}, [syncVideos]);

	// Show action indicator and fade it out
	const showActionIndicator = React.useCallback((type) => {
		setActionIndicator(type);
	}, []);

	let handleVideoClick = () => {
		const video = mainVideoRef.current;
		if (!video) return;

		if (video.paused) {
			// Video is paused - play it and hide full text
			video.play();
			setShowFullText(false);
			setIsPaused(false);
		} else {
			// Video is playing - pause it and show full text
			video.pause();
			setShowFullText(true);
			setIsPaused(true);
			showActionIndicator("pause");
		}
	};

	React.useEffect(() => {
		const mainVideo = mainVideoRef.current;
		const underlayVideo = overflowVideoRef.current;

		if (!mainVideo || !underlayVideo) return;

		// Event listeners for main video state changes
		const handlePlay = () => {
			setIsPaused(false);
			requestSync();
		};
		const handlePause = () => {
			setIsPaused(true);
			requestSync();
		};
		const handleVolumeChange = () => {
			setIsMuted(mainVideo.muted);
		};
		const handleSeeked = () => requestSync();
		const handleTimeUpdate = () => requestSync();

		mainVideo.addEventListener("play", handlePlay);
		mainVideo.addEventListener("pause", handlePause);
		mainVideo.addEventListener("volumechange", handleVolumeChange);
		mainVideo.addEventListener("seeked", handleSeeked);
		mainVideo.addEventListener("timeupdate", handleTimeUpdate);

		// Set initial muted state and start playing
		mainVideo.muted = isMuted;

		// Start video manually (better for audio control)
		mainVideo.play().catch(() => {
			// Ignore autoplay errors
		});

		// Initial sync
		requestSync();

		// Set up intersection observer to pause video when scrolling away
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry.isIntersecting && !mainVideo.paused) {
					// Video is out of view and playing - pause it
					mainVideo.pause();
					setShowFullText(false);
				} else if (entry.isIntersecting && mainVideo.paused) {
					// Video is in view and paused - play it
					mainVideo.play().catch(() => {});
				}
			},
			{
				threshold: 0.5, // Trigger when 50% visible
				rootMargin: "0px",
			}
		);

		// Observe the project section
		const projectSection = mainVideo.closest(".project");
		if (projectSection) {
			observer.observe(projectSection);
		}

		// Cleanup
		return () => {
			mainVideo.removeEventListener("play", handlePlay);
			mainVideo.removeEventListener("pause", handlePause);
			mainVideo.removeEventListener("volumechange", handleVolumeChange);
			mainVideo.removeEventListener("seeked", handleSeeked);
			mainVideo.removeEventListener("timeupdate", handleTimeUpdate);

			if (syncRAFRef.current) {
				cancelAnimationFrame(syncRAFRef.current);
			}

			// Cleanup intersection observer
			const projectSection = mainVideo.closest(".project");
			if (projectSection && observer) {
				observer.unobserve(projectSection);
				observer.disconnect();
			}
		};
	}, [requestSync]);

	return (
		<section
			className={`section project project--${video_orientation} ${
				isPaused ? "isPaused" : ""
			}`}
		>
			<div className="video__wrapper">
				<div className="action-indicator">
					{actionIndicator === "pause" && (
						<img
							src={
								require("../../assets/icons/pause.svg").default
							}
							alt="Pause"
						/>
					)}
					{actionIndicator === "rewind" && (
						<img
							src={
								require("../../assets/icons/rewind.svg").default
							}
							alt="Rewind"
						/>
					)}
				</div>
				<button
					type="button"
					className="button"
					onClick={async () => {
						const video = mainVideoRef.current;
						if (!video) return;

						// Toggle mute and try to play with audio
						video.muted = !video.muted;
						setIsMuted(video.muted);

						// If unmuting, restart video from beginning
						if (!video.muted) {
							video.currentTime = 0;
							showActionIndicator("rewind");
						}

						// Force play to activate audio context (browser autoplay policy)
						try {
							await video.play();
						} catch (error) {
							// Ignore autoplay errors
						}
					}}
				>
					{isMuted ? "Sound on" : "Sound off"}
				</button>
				<video
					ref={mainVideoRef}
					loop
					playsInline
					preload="metadata"
					onClick={handleVideoClick}
				>
					<source src={video_file.url} type={videoMimeType} />
				</video>
				<video
					ref={overflowVideoRef}
					className="video-overflow"
					muted
					playsInline
					preload="metadata"
				>
					<source src={video_file.url} type={videoMimeType} />
				</video>
			</div>
			<div
				className={`text__wrapper ${
					showFullText ? "showFullText" : ""
				}`}
				onClick={() => setShowFullText(true)}
			>
				<h2>{title}</h2>
				<p>{description}</p>
			</div>
		</section>
	);
};
