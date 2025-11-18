import React from "react";

export default ({ title, description, video_file, video_orientation }) => {
	let [showFullText, setShowFullText] = React.useState(false);
	let [isPaused, setIsPaused] = React.useState(false);
	let [isMuted, setIsMuted] = React.useState(true);
	let [actionIndicator, setActionIndicator] = React.useState(null); // 'pause', 'rewind', or null

	const mainVideoRef = React.useRef(null);
	const canvasRef = React.useRef(null);
	const animationFrameRef = React.useRef(null);

	let videoMimeType = `video/${video_file.url.split(".").pop()}`;

	// Canvas reflection drawing (mirrors video across X axis) with DPR scaling
	const drawReflection = React.useCallback(() => {
		const video = mainVideoRef.current;
		const canvas = canvasRef.current;

		if (!video || !canvas || video.readyState < 2) return;

		const ctx = canvas.getContext("2d");
		const rect = video.getBoundingClientRect();
		if (!rect.width || !rect.height) return;

		// Device pixel ratio for crisp rendering on Retina displays
		const dpr =
			typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
		const w = Math.floor(rect.width);
		const h = Math.floor(rect.height);

		// Set canvas pixel size taking DPR into account; keep CSS size = displayed size
		const pixelW = Math.max(1, Math.floor(w * dpr));
		const pixelH = Math.max(1, Math.floor(h * dpr));
		if (canvas.width !== pixelW || canvas.height !== pixelH) {
			canvas.width = pixelW;
			canvas.height = pixelH;
			canvas.style.width = w + "px";
			canvas.style.height = h + "px";
		}

		// Clear full pixel buffer before applying transforms
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Map coordinate system: scale by DPR and flip vertically so we can draw with video coords
		ctx.setTransform(dpr, 0, 0, -dpr, 0, canvas.height);

		// drawImage(video, dx, dy, dWidth, dHeight) using video-space w,h
		ctx.drawImage(video, 0, 0, w, h);

		// restore to identity transform for any future operations
		ctx.setTransform(1, 0, 0, 1, 0, 0);

		if (!video.paused) {
			animationFrameRef.current = requestAnimationFrame(drawReflection);
		}
	}, []);

	// Show action indicator and fade it out
	const showActionIndicator = React.useCallback((type) => {
		setActionIndicator(type);
		setTimeout(() => setActionIndicator(null), 660);
	}, []);

	let handleVideoClick = () => {
		const video = mainVideoRef.current;
		if (!video) return;

		if (video.paused) {
			// Video is paused - play it and hide full text
			video.play();
			setShowFullText(false);
		} else {
			// Video is playing - pause it and show full text
			video.pause();
			setShowFullText(true);
			showActionIndicator("pause");
		}
	};

	React.useEffect(() => {
		const mainVideo = mainVideoRef.current;

		if (!mainVideo) return;

		// Event listeners for main video state changes
		const handlePlay = () => {
			setIsPaused(false);
			drawReflection(); // start canvas drawing loop
		};
		const handlePause = () => {
			setIsPaused(true);
			if (animationFrameRef.current)
				cancelAnimationFrame(animationFrameRef.current);
		};
		const handleVolumeChange = () => setIsMuted(mainVideo.muted);
		const handleLoaded = () => {
			if (!mainVideo.paused) drawReflection();
		};

		mainVideo.addEventListener("play", handlePlay);
		mainVideo.addEventListener("pause", handlePause);
		mainVideo.addEventListener("volumechange", handleVolumeChange);
		mainVideo.addEventListener("loadeddata", handleLoaded);

		// Ensure the video element starts with the same muted state as React.
		try {
			mainVideo.muted = !!isMuted;
		} catch (e) {
			// ignore (defensive)
		}

		// Set up intersection observer to pause video when scrolling away
		// Find the nearest scrollable ancestor (so intersections are calculated
		// relative to the element that actually scrolls, not necessarily the viewport)
		const findScrollParent = (el) => {
			if (!el) return null;
			let parent = el.parentElement;
			while (parent) {
				try {
					const style = getComputedStyle(parent);
					const overflowY =
						(style.overflowY || "") + (style.overflow || "");
					if (/(auto|scroll|overlay)/.test(overflowY)) return parent;
				} catch (e) {
					// ignore cross-origin or other access errors
				}
				parent = parent.parentElement;
			}
			return null;
		};

		const scrollRoot = document.querySelector("main");
		// Use a high threshold so the section is considered 'in-view' when it's mostly filling the
		// scroll container (good for snap-to behavior).
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry) return;
				// Toggle in-view class on the observed project element
				if (entry.target) {
					if (entry.isIntersecting) {
						console.log("IN VIEW:", entry.target);
						entry.target.classList.add("in-view");
						// Use React state to mark this project as active
						try {
							setIsPaused(false);
						} catch (e) {}

						// Debug: log playing and muted status of every video inside `.project`
						// immediately after this project is assigned `.in-view`.

						const projectVideos = Array.from(
							document.querySelectorAll(".project video")
						);
						const statuses = projectVideos.map((v, i) => ({
							src: v.currentSrc || v.src || `project-video#${i}`,
							playing: !!(
								!v.paused &&
								!v.ended &&
								v.readyState > 2
							),
							muted: !!v.muted,
							paused: !!v.paused,
							readyState: v.readyState,
							currentTime: Number.isFinite(v.currentTime)
								? v.currentTime
								: null,
						}));
						console.log(
							"[project] .in-view assigned -> video statuses:",
							{
								project: entry.target,
								videoStatuses: statuses,
							}
						);
					} else {
						// Deactivate this project and mark it paused
						entry.target.classList.remove("in-view");
						try {
							setIsPaused(true);
						} catch (e) {}
					}
					// After toggling classes, mute all videos that are not in the active project

					const vids = Array.from(
						document.querySelectorAll(
							".project:not(.in-view) video"
						)
					);
					vids.forEach((v) => {
						try {
							v.pause();
							v.currentTime = 0;
						} catch (e) {
							// ignore errors (e.g., removed element)
						}
					});
				}

				// When out-of-view, hide full text. Do not auto-mute videos here.
				if (!entry.isIntersecting) {
					try {
						setShowFullText(false);
					} catch (e) {}
				} else {
					// When in-view, leave playback running (autoPlay handles it).
				}
				// Debug: log playing and muted status of every video when a new
				// project is assigned `.in-view` so we can trace playback state.

				const allVideos = Array.from(
					document.querySelectorAll("video")
				);
				const statuses = allVideos.map((v, i) => ({
					src: v.currentSrc || v.src || `video#${i}`,
					playing: !!(!v.paused && !v.ended && v.readyState > 2),
					muted: !!v.muted,
					currentTime: Number.isFinite(v.currentTime)
						? v.currentTime
						: null,
				}));
				console.log("[project] Assigned .in-view to:", entry.target, {
					videoStatuses: statuses,
				});
			},
			{ root: scrollRoot, threshold: 0.75, rootMargin: "0px" }
		);

		const projectSection = mainVideo.closest(".project");
		if (projectSection) observer.observe(projectSection);

		// Simple hack: when the window scrolls, mute all video elements to avoid
		// accidental audio during scroll. Kept minimal and defensive.
		const handleWindowScroll = () => {
			try {
				const vids = Array.from(document.querySelectorAll("video"));
				vids.forEach((v) => {
					try {
						v.muted = true;
					} catch (e) {
						// ignore
					}
				});
				try {
					setIsMuted(true);
				} catch (e) {}
			} catch (e) {}
		};

		window.addEventListener("scroll", handleWindowScroll, {
			passive: true,
		});

		// ResizeObserver to keep canvas matched to video displayed size
		let resizeObserver = null;
		if (canvasRef && canvasRef.current) {
			resizeObserver = new ResizeObserver(() => {
				const canvas = canvasRef.current;
				const rect = mainVideo.getBoundingClientRect();
				if (!rect.width || !rect.height) return;
				const w = Math.floor(rect.width);
				const h = Math.floor(rect.height);
				const dpr =
					typeof window !== "undefined"
						? window.devicePixelRatio || 1
						: 1;
				const pixelW = Math.max(1, Math.floor(w * dpr));
				const pixelH = Math.max(1, Math.floor(h * dpr));
				if (canvas.width !== pixelW || canvas.height !== pixelH) {
					canvas.width = pixelW;
					canvas.height = pixelH;
					canvas.style.width = w + "px";
					canvas.style.height = h + "px";
				}
				// If video is playing, ensure drawing continues with the new size
				if (!mainVideo.paused) {
					drawReflection();
				}
			});

			// Observe the video element for size changes
			resizeObserver.observe(mainVideo);
		}

		return () => {
			mainVideo.removeEventListener("play", handlePlay);
			mainVideo.removeEventListener("pause", handlePause);
			mainVideo.removeEventListener("volumechange", handleVolumeChange);
			mainVideo.removeEventListener("loadeddata", handleLoaded);
			if (animationFrameRef.current)
				cancelAnimationFrame(animationFrameRef.current);
			if (projectSection && observer) {
				observer.unobserve(projectSection);
				observer.disconnect();
			}

			if (resizeObserver) {
				resizeObserver.disconnect();
			}

			// No play-retry timers to clear after switching to mute-only behavior
		};
	}, []);

	return (
		<section className={`section project project--${video_orientation}`}>
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
						if (video.paused) {
							video.currentTime = 0;
							showActionIndicator("rewind");
						}
						// Force play to activate audio context (browser autoplay policy)
						try {
							await video.play();
						} catch (error) {}
					}}
				>
					{isMuted ? "Sound on" : "Sound off"}
				</button>
				<video
					ref={mainVideoRef}
					loop
					playsInline
					autoPlay={video_orientation !== "landscape"}
					muted={video_orientation !== "landscape"}
					preload="metadata"
					onClick={handleVideoClick}
				>
					<source src={video_file.url} type={videoMimeType} />
				</video>
				<canvas ref={canvasRef} className="video-reflection" />
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
