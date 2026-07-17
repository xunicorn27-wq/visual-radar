import { createRoot } from "react-dom/client";
import { Route, Switch } from "wouter";

import VisualRadar from "./pages/VisualRadar";
import VisualRadarArchive from "./pages/VisualRadarArchive";
import VisualRadarIssue from "./pages/VisualRadarIssue";
import "./visual-radar.css";

createRoot(document.getElementById("root")!).render(
  <Switch>
    <Route path="/" component={VisualRadar} />
    <Route path="/issues" component={VisualRadarArchive} />
    <Route path="/issues/:issueId" component={VisualRadarIssue} />
  </Switch>
);
