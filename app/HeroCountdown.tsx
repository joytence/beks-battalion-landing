"use client";

import { useEffect, useState } from "react";

type CountdownParts = {
  days: number;
  hours: number;
  totalMs: number;
};

function getCountdownParts(targetIso: string): CountdownParts {
  const targetMs = new Date(targetIso).getTime();
  const nowMs = Date.now();
  const totalMs = Math.max(targetMs - nowMs, 0);

  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);

  return { days, hours, totalMs };
}

export function HeroCountdown({
  targetIso,
}: {
  targetIso: string;
}) {
  const [countdown, setCountdown] = useState<CountdownParts | null>(null);

  useEffect(() => {
    const update = () => setCountdown(getCountdownParts(targetIso));

    update();
    const timer = window.setInterval(update, 1000);

    return () => window.clearInterval(timer);
  }, [targetIso]);

  if (!countdown) {
    return null;
  }

  const showtime = countdown.totalMs <= 0;
  const lead = showtime
    ? "Showtime Is Here!"
    : `${countdown.days} Day${countdown.days === 1 ? "" : "s"}`;

  return (
    <div className="topbar__countdown" aria-live="polite">
      <div className="topbar__countdown-lead">
        {lead}
        {!showtime ? (
          <span className="topbar__countdown-hours">
            {" "}
            {countdown.hours} Hour{countdown.hours === 1 ? "" : "s"}
          </span>
        ) : null}
        {!showtime ? " Left" : null}
      </div>
    </div>
  );
}
