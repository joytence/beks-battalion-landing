"use client";

import { useEffect, useState } from "react";

type TopbarAction = {
  href: string;
  label: string;
  tone: "ghost" | "hot";
};

export function TopbarActions({ items }: { items: readonly TopbarAction[] }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const ticketAction =
    items.find((item) => item.href === "#tickets") ??
    items.find((item) => item.label.toLowerCase().includes("ticket")) ??
    items[0];
  const mobileMenuItems = items.filter((item) => item.href !== ticketAction.href);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 700) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <nav className="topbar__actions" aria-label="Primary actions">
      <div className="topbar__desktop-links">
        {items.map((item) => (
          <a key={item.href} className={`cta cta--${item.tone}`} href={item.href}>
            {item.label}
          </a>
        ))}
      </div>

      <div className="topbar__mobile-actions">
        <a className={`cta cta--${ticketAction.tone}`} href={ticketAction.href}>
          {ticketAction.label}
        </a>

        <div className="topbar__mobile-menu">
          <button
            type="button"
            className="topbar__menu-toggle"
            aria-expanded={isMenuOpen}
            aria-controls="topbar-mobile-panel"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span className="topbar__menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          {isMenuOpen ? (
            <div id="topbar-mobile-panel" className="topbar__menu-panel">
              {mobileMenuItems.map((item) => (
                <a
                  key={item.href}
                  className={`cta cta--${item.tone}`}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
