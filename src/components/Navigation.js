export default ({ documents }) => (
	<ul className="navigation__wrapper">
		{documents.map((doc, itemIndex) => (
			<li className={`navigation__dot`}></li>
		))}
	</ul>
);
