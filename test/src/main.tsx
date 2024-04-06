import { FC, createElement } from "react";

import { Application } from "./application";

export const Main: FC = () => (
	<div className="h-screen w-screen bg-slate-900 text-white">
		<Application />
	</div>
);
