import React from "react";
import { client } from "./prismic";
import Project from "./components/Project";

function App() {
	let [documents, setDocuments] = React.useState([]);

	React.useEffect(() => {
		client.getAllByType("video").then(setDocuments).catch(console.error);
	}, []);

	React.useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						// Add 'in-view' class when project snaps into view
						entry.target.classList.add("in-view");
					} else {
						// Remove 'in-view' class when project is out of view
						entry.target.classList.remove("in-view");
					}
				});
			},
			{
				threshold: 0.5, // Trigger when 50% of the element is visible
				rootMargin: "0px",
			}
		);

		// Observe all project elements
		const projects = document.querySelectorAll(".project");
		projects.forEach((project) => observer.observe(project));

		// Cleanup observer on component unmount
		return () => observer.disconnect();
	}, [documents]); // Re-run when documents change

	console.log(documents);

	return (
		<main>
			<section className="section section--intro">
				<h1>
					We make <em>stories</em>
				</h1>
				<p>
					Whether it’s a 30-second reel or a full-length film, we make
					stories that engage, inspire, and leave a lasting
					impression.
				</p>
			</section>

			{documents
				? documents.map((doc) => (
						<Project
							key={doc.id}
							title={doc.data.title}
							description={doc.data.description}
							video_file={doc.data.video_file}
							video_orientation={doc.data.video_orientation}
						/>
				  ))
				: "Loading..."}
		</main>
	);
}

export default App;
