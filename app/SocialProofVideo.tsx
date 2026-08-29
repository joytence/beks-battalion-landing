"use client";

export function SocialProofVideo({
  fullPageHref,
  poster,
  src,
}: {
  fullPageHref: string;
  poster: string;
  src: string;
}) {
  return (
    <div
      className="social-proof-video-shell"
      onDoubleClick={() => {
        window.location.href = fullPageHref;
      }}
    >
      <video
        className="social-proof-video"
        muted
        loop
        autoPlay
        playsInline
        controls
        preload="metadata"
        poster={poster}
        aria-label="Sold-out show video. Double-click to open the full-screen player."
      >
        <source src={src} type="video/mp4" />
      </video>
      <a className="social-proof-video-button" href={fullPageHref}>
        View Full Screen
      </a>
      <div className="social-proof-media-hint">Double-click video for full-screen player</div>
    </div>
  );
}
