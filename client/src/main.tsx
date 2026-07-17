import { createRoot } from "react-dom/client";
import { Route, Router, Switch } from "wouter";

import { normalizeRouterBase } from "./lib/routerBase";
import VisualRadar from "./pages/VisualRadar";
import VisualRadarArchive from "./pages/VisualRadarArchive";
import VisualRadarIssue from "./pages/VisualRadarIssue";
import "./visual-radar.css";

const routerBase = normalizeRouterBase(import.meta.env.BASE_URL);

createRoot(document.getElementById("root")!).render(
  <Router base={routerBase}>
    <Switch>
      <Route path="/" component={VisualRadar} />
      <Route path="/issues" component={VisualRadarArchive} />
      <Route path="/issues/:issueId" component={VisualRadarIssue} />
      <Route path="*">
        <main>
          <h1>404</h1>
        </main>
      </Route>
    </Switch>
  </Router>
);
