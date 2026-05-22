export type Route = "convert" | "entities" | "history";

const VALID: ReadonlySet<Route> = new Set(["convert", "entities", "history"]);

export function currentRoute(): Route {
  const raw = window.location.hash.replace(/^#/, "").split("/")[0] ?? "";
  return VALID.has(raw as Route) ? (raw as Route) : "convert";
}

export function navigate(route: Route, sub?: string): void {
  const path = sub ? `${route}/${sub}` : route;
  if (window.location.hash !== `#${path}`) {
    window.location.hash = path;
  }
}

export function onRouteChange(handler: (r: Route) => void): () => void {
  const fn = () => handler(currentRoute());
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
}
