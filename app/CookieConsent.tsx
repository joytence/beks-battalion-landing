"use client";

import { useEffect, useState } from "react";

const consentStorageKey = "joy-stage-tracking-consent";
const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2036904920238359";

type ConsentChoice = "accepted" | "declined";
type FbqFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  loaded?: boolean;
  push?: (...args: unknown[]) => void;
  queue?: unknown[];
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFunction;
    _fbq?: Window["fbq"];
  }
}

function getStoredConsent(): ConsentChoice | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(consentStorageKey);
  return stored === "accepted" || stored === "declined" ? stored : null;
}

function loadMetaPixel() {
  if (typeof window === "undefined" || window.fbq) {
    return;
  }

  const fbq: FbqFunction = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }

    fbq.queue?.push(args);
  };

  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const firstScript = document.getElementsByTagName("script")[0];
  firstScript?.parentNode?.insertBefore(script, firstScript);

  window.fbq("init", metaPixelId);
  window.fbq("track", "PageView");
}

export function hasTrackingConsent() {
  return getStoredConsent() === "accepted";
}

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentChoice | null>(null);
  const [isReady, setIsReady] = useState(false);
  const shouldShowBanner = isReady && consent === null;

  useEffect(() => {
    const stored = getStoredConsent();
    setConsent(stored);
    setIsReady(true);

    if (stored === "accepted") {
      loadMetaPixel();
    }
  }, []);

  function chooseConsent(choice: ConsentChoice) {
    window.localStorage.setItem(consentStorageKey, choice);
    setConsent(choice);

    if (choice === "accepted") {
      loadMetaPixel();
    }
  }

  if (!isReady) {
    return null;
  }

  return (
    <>
      {shouldShowBanner ? (
        <aside
          aria-label="Cookie and tracking consent"
          className="cookie-consent"
        >
          <div className="cookie-consent__content">
            <p className="cookie-consent__eyebrow">Privacy Choices</p>
            <h2>Help Us Measure Event Interest</h2>
            <p>
              We use cookies and Meta tracking to understand visits and inquiry
              performance. You can accept tracking or continue with essential
              site features only.
            </p>
          </div>
          <div className="cookie-consent__actions">
            <a className="cookie-consent__link" href="/privacy">
              Privacy Policy
            </a>
            <button
              className="cookie-consent__button cookie-consent__button--ghost"
              type="button"
              onClick={() => chooseConsent("declined")}
            >
              Essential Only
            </button>
            <button
              className="cookie-consent__button cookie-consent__button--gold"
              type="button"
              onClick={() => chooseConsent("accepted")}
            >
              Accept Tracking
            </button>
          </div>
        </aside>
      ) : null}

      {consent !== null ? (
        <button
          className="privacy-choice-button"
          type="button"
          onClick={() => {
            window.localStorage.removeItem(consentStorageKey);
            setConsent(null);
          }}
        >
          Privacy Choices
        </button>
      ) : null}
    </>
  );
}
