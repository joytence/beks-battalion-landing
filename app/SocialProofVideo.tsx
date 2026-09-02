"use client";

import { useState } from "react";

type SocialProofVideoItem = {
  description: string;
  poster: string;
  src: string;
  title: string;
};

export function SocialProofVideo({
  fullPageHref,
  videos,
}: {
  fullPageHref: string;
  videos: readonly [SocialProofVideoItem, ...SocialProofVideoItem[]];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeVideo = videos[activeIndex] ?? videos[0];
  const playerHref = `${fullPageHref}?video=${activeIndex}`;

  function showNextVideo() {
    setActiveIndex((currentIndex) => (currentIndex + 1) % videos.length);
  }

  return (
    <div className="social-proof-video-library">
      <div
        className="social-proof-video-shell"
        onDoubleClick={() => {
          window.location.href = playerHref;
        }}
      >
        <video
          key={activeVideo.src}
          className="social-proof-video"
          muted
          autoPlay
          playsInline
          controls
          onEnded={showNextVideo}
          preload="metadata"
          poster={activeVideo.poster}
          aria-label={`${activeVideo.title}. Double-click to open the full-screen player.`}
        >
          <source src={activeVideo.src} type="video/mp4" />
        </video>
        <a className="social-proof-video-button" href={playerHref}>
          View Full Screen
        </a>
      </div>

      <div className="social-proof-video-list" aria-label="Video library">
        {videos.map((item, index) => (
          <button
            key={item.src}
            type="button"
            className="social-proof-video-list__item"
            data-active={index === activeIndex}
            onClick={() => setActiveIndex(index)}
          >
            <span />
            <strong>{item.title}</strong>
            <small>{item.description}</small>
          </button>
        ))}
      </div>

      <div className="social-proof-media-hint">Double-click video for full-screen player</div>
    </div>
  );
}
