import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Synkra Agency Portal" },
      { name: "description", content: "Manage your Synkra Agency services, billing, and usage." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center bg-[#0a0a0a] text-white">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link to="/" className="underline">
        Go home
      </Link>
    </div>
  );
}

function RootComponent() {
  // Dark mode is the default (see styles.css :root); light mode applies via
  // <html data-theme="light">, matching Client Hub's toggle convention even
  // though this app doesn't have a theme switcher UI yet.
  useEffect(() => {
    try {
      const theme = localStorage.getItem("synkra-theme");
      document.documentElement.setAttribute(
        "data-theme",
        theme === "light" ? "light" : "dark",
      );
    } catch {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  return <Outlet />;
}
