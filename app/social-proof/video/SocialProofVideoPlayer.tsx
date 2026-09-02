"use client";

import { useState } from "react";

type SocialProofVideoItem = {
  description: string;
  poster: string;
  src: string;
  title: string;
};

export function SocialProofVideoPlayer({
  initialVideoIndex,
  videos,
}: {
  initialVideoIndex: number;
  videos: readonly [SocialProofVideoItem, ...SocialProofVideoItem[]];
}) {
  const [activeIndex, setActiveIndex] = useState(initialVideoIndex);
  const activeVideo = videos[activeIndex] ?? videos[0];

  function selectVideo(index: number) {
    setActiveIndex(index);
    window.history.replaceState(null, "", `/social-proof/video?video=${index}`);
  }

  function showNextVideo() {
    selectVideo((activeIndex + 1) % videos.length);
  }

  return (
    <main className="media-page media-page--video">
      <div className="media-page__topbar">
        <a className="media-page__back" href="/#social-proof">
          Back to The Excitement
        </a>
        <span className="media-page__counter">
          {activeIndex + 1} / {videos.length}
        </span>
      </div>

      <section className="media-page__video-stage" aria-label={activeVideo.title}>
        <video
          key={activeVideo.src}
          controls
          autoPlay
          playsInline
          poster={activeVideo.poster}
          onEnded={showNextVideo}
        >
          <source src={activeVideo.src} type="video/mp4" />
        </video>
      </section>

      <nav className="media-page__video-list" aria-label="Video library">
        {videos.map((video, index) => (
          <button
            key={video.src}
            type="button"
            className="media-page__video-link"
            data-active={index === activeIndex}
            onClick={() => selectVideo(index)}
          >
            {video.title}
          </button>
        ))}
      </nav>
    </main>
  );
}
