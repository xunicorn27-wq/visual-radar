import { createRoot } from "react-dom/client";
import { Route, Router, Switch } from "wouter";

import { normalizeRouterBase } from "./lib/routerBase";
import VisualRadar from "./pages/VisualRadar";
import VisualRadarArchive, { VisualRadarSaved } from "./pages/VisualRadarArchive";
import VisualRadarIssue from "./pages/VisualRadarIssue";
import VisualRadarNotFound from "./pages/VisualRadarNotFound";
import "./visual-radar.css";

const routerBase = normalizeRouterBase(import.meta.env.BASE_URL);

createRoot(document.getElementById("root")!).render(
  <Router base={routerBase}>
    <Switch>
      <Route path="/" component={VisualRadar} />
      <Route path="/issues" component={VisualRadarArchive} />
      <Route path="/saved" component={VisualRadarSaved} />
      <Route path="/issues/:issueId" component={VisualRadarIssue} />
      <Route path="*">
        <VisualRadarNotFound />
      </Route>
    </Switch>
  </Router>
);
