"use client";

import { useEffect, useState } from "react";

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

function getCountdownParts(targetIso: string): CountdownParts {
  const targetMs = new Date(targetIso).getTime();
  const nowMs = Date.now();
  const totalMs = Math.max(targetMs - nowMs, 0);

  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, totalMs };
}

function formatUnit(value: number) {
  return value.toString().padStart(2, "0");
}

export function HeroCountdown({
  targetIso,
  title = "Until The Show",
}: {
  targetIso: string;
  title?: string;
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
    : `Only ${countdown.days} Day${countdown.days === 1 ? "" : "s"} Left ${title}!`;

  return (
    <div className="hero__countdown" aria-live="polite">
      <div className="hero__countdown-kicker">Countdown</div>
      <div className="hero__countdown-lead">{lead}</div>
      <div className="hero__countdown-grid">
        <div className="hero__countdown-unit">
          <strong>{formatUnit(countdown.days)}</strong>
          <span>Days</span>
        </div>
        <div className="hero__countdown-unit">
          <strong>{formatUnit(countdown.hours)}</strong>
          <span>Hours</span>
        </div>
        <div className="hero__countdown-unit">
          <strong>{formatUnit(countdown.minutes)}</strong>
          <span>Minutes</span>
        </div>
        <div className="hero__countdown-unit">
          <strong>{formatUnit(countdown.seconds)}</strong>
          <span>Seconds</span>
        </div>
      </div>
    </div>
  );
}
