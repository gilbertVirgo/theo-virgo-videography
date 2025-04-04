import clamp from "lodash.clamp";
import React from "react";
import { client } from "./prismic";

const TRANSITION_LENGTH = 500,
	DELTA_Y_THRESHHOLD = 1.5;

function App() {
	let [portfolioIsActive, setPortfolioIsActive] = React.useState(false);
	let [carouselState, setCarouselState] = React.useState([]);
	let [documents, setDocuments] = React.useState([]);

	let portfolioSectionRef = React.useRef(null);

	let wheelEventDisabled = React.useRef(false);

	let selectedSlideIndex =
		carouselState && carouselState.length > 0
			? carouselState.findIndex((slide) => slide.selected)
			: 0;

	let createFreshCarouselState = (docs, selectedIndex) =>
		docs.map((doc, index) => {
			let slide = {
				index,
				selected: index === selectedIndex,
				getClassNames: () => {
					let classNames = [];
					if (slide.selected) classNames.push("selected");
					if (slide.animation) classNames.push(slide.animation);
					return classNames.join(" ");
				},
			};

			return slide;
		});

	let selectAndAnimateToNewSlideIndex = (newSelectedIndex) => {
		if (selectedSlideIndex === newSelectedIndex) return;

		let newState = createFreshCarouselState(documents, newSelectedIndex);

		if (newSelectedIndex > selectedSlideIndex) {
			newState[selectedSlideIndex].animation = "animation--up-and-out";
			newState[newSelectedIndex].animation = "animation--up-and-in";
		} else {
			newState[selectedSlideIndex].animation = "animation--down-and-out";
			newState[newSelectedIndex].animation = "animation--down-and-in";
		}

		setCarouselState(newState);
	};

	let handleBodyWheelEvent = (e) => {
		if (Math.abs(e.deltaY) < DELTA_Y_THRESHHOLD) {
			wheelEventDisabled.current = false;
			return;
		}

		if (!portfolioIsActive) return setPortfolioIsActive(true);

		if (!wheelEventDisabled.current) {
			let increment = e.deltaY > 0 ? 1 : -1;

			let newSelectedIndex = clamp(
				selectedSlideIndex + increment,
				0,
				documents.length - 1
			);

			selectAndAnimateToNewSlideIndex(newSelectedIndex);

			wheelEventDisabled.current = true;
		}
	};

	React.useEffect(() => {
		["mousewheel", "wheel", "touchmove", "DOMMouseScroll"].forEach(
			(eventName) => {
				document.body.addEventListener(eventName, handleBodyWheelEvent);
			}
		);

		return () => {
			["mousewheel", "wheel", "touchmove", "DOMMouseScroll"].forEach(
				(eventName) => {
					document.body.removeEventListener(
						eventName,
						handleBodyWheelEvent
					);
				}
			);
		};
	}, [portfolioIsActive, selectedSlideIndex]);

	React.useEffect(() => {
		client.getAllByType("video").then(setDocuments).catch(console.error);

		window.addEventListener("resize", adjustRootElementMargin);

		return () => {
			window.removeEventListener("resize", adjustRootElementMargin);
		};
	}, []);

	React.useEffect(() => {
		setCarouselState(createFreshCarouselState(documents, 0));
	}, [documents]);

	let adjustRootElementMargin = () => {
		let introSection = document.querySelector(".section--intro");

		if (!introSection) return;

		let introSectionHeight = introSection.getBoundingClientRect().height;
		document.getElementById(
			"root"
		).style.marginTop = `${-introSectionHeight}px`;
	};

	React.useEffect(() => {
		if (!portfolioSectionRef.current) return;

		if (!portfolioIsActive) {
			portfolioSectionRef.current.style.minHeight = window
				.getComputedStyle(portfolioSectionRef.current)
				.getPropertyValue("height");

			return;
		}

		adjustRootElementMargin();

		portfolioSectionRef.current.style.minHeight = `100svh`;
	}, [portfolioIsActive, portfolioSectionRef]);

	let handlePortfolioSectionClicked = () => {
		if (!portfolioIsActive) setPortfolioIsActive(true);
	};

	let handleOverlayClicked = (itemIndex) => {
		document
			.getElementById(`portfolio-item-copy--${itemIndex}`)
			.classList.add("minimised");
	};

	let handleCopyClicked = (itemIndex) => {
		document
			.getElementById(`portfolio-item-copy--${itemIndex}`)
			.classList.remove("minimised");
	};

	let handleNavigationDotClicked = (itemIndex) => {
		setCarouselState(itemIndex);
	};

	console.log({ carouselState });

	if (!carouselState || carouselState.length === 0) return "Loading...";

	return (
		<>
			<section className="section section--intro">
				<div className="intro__copy">
					<h1>We make reels</h1>
					<p>
						We create short-form video content designed to engage
						your audience and elevate your brand on social media.
					</p>
				</div>
			</section>
			<section
				ref={portfolioSectionRef}
				onClick={handlePortfolioSectionClicked}
				className="section section--portfolio"
			>
				<ul className="navigation__wrapper">
					{documents.map((doc, itemIndex) => (
						<li
							className={`navigation__dot ${
								itemIndex === selectedSlideIndex ? "active" : ""
							}`}
							onClick={handleNavigationDotClicked.bind(
								null,
								itemIndex
							)}
						></li>
					))}
				</ul>
				{documents.map((doc, itemIndex) => {
					return (
						<div
							className={
								"portfolio-item__wrapper " +
								carouselState[itemIndex].getClassNames()
							}
						>
							<div className="viewer__wrapper">
								<video autoPlay muted loop>
									<source
										src={doc.data.video_file.url}
										type="video/mp4"
									/>
								</video>
							</div>
							<div
								className="overlay"
								onClick={handleOverlayClicked.bind(
									null,
									itemIndex
								)}
							/>
							<div
								className="copy__wrapper"
								onClick={handleCopyClicked.bind(
									null,
									itemIndex
								)}
							>
								<h2>{doc.data.title}</h2>
								<p
									id={`portfolio-item-copy--${itemIndex}`}
									className="minimised"
								>
									{doc.data.description}
								</p>
							</div>
						</div>
					);
				})}
			</section>
		</>
	);
}

export default App;
