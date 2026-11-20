import { useEffect, useState } from "react";
import { useApi, type Health } from "./api";
import { Builder } from "./pages/Builder";
import { Compare } from "./pages/Compare";
import { Machines } from "./pages/Machines";
import { Parts } from "./pages/Parts";

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || "/build");
  useEffect(() => {
    const on = () => setHash(window.location.hash.slice(1) || "/build");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);
  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")] as const;
}

const NAV = [
  ["/build", "Build"],
  ["/machines", "Machines"],
  ["/parts", "Parts"],
  ["/compare", "Compare"],
] as const;

export function App() {
  const hash = useHash();
  const [theme, toggleTheme] = useTheme();
  const health = useApi<Health>("/api/health");
  const [, page = "build", arg, arg2] = hash.split("/");

  return (
    <>
      <header className="top">
        <a className="brand" href="#/build">
          <span className="brand-mark" aria-hidden="true" />
          Custom PC
        </a>
        <nav aria-label="Main">
          {NAV.map(([href, label]) => (
            <a key={href} href={`#${href}`} aria-current={`/${page}` === href ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <button className="ghost" onClick={toggleTheme}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </header>

      {health.error && (
        <div className="banner fail" role="alert">
          The data could not be loaded. When running locally, start the server with <code>npm run dev</code>.
        </div>
      )}
      {health.data && health.data.problems.length > 0 && (
        <details className="banner warn">
          <summary>
            {health.data.problems.length} data {health.data.problems.length === 1 ? "file was" : "entries were"} skipped
            because of errors
          </summary>
          <ul>
            {health.data.problems.map((p, i) => (
              <li key={i}>
                <code>{p.file}</code> {p.message}
              </li>
            ))}
          </ul>
        </details>
      )}

      <main>
        {page === "parts" ? (
          <Parts type={arg} />
        ) : page === "machines" ? (
          <Machines id={arg} />
        ) : page === "compare" ? (
          <Compare a={arg} b={arg2} />
        ) : (
          <Builder />
        )}
      </main>
    </>
  );
}
