"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type HeroFace = {
  name: string;
  role: string;
  tone: "gold" | "orange" | "pink";
  image: string;
  position: string;
  logo?: string;
  logoAlt?: string;
};

function getCarouselOffset(index: number, activeIndex: number, length: number) {
  let offset = index - activeIndex;

  if (offset > length / 2) {
    offset -= length;
  }

  if (offset < -length / 2) {
    offset += length;
  }

  return offset;
}

export function HeroCarousel({
  items,
  ariaLabel = "Featured artists",
  dotAriaLabel = "Select featured artist",
  openOnDoubleClick = false,
  fullPageHref,
  lightboxAriaLabel = "Image slideshow",
}: {
  items: readonly HeroFace[];
  ariaLabel?: string;
  dotAriaLabel?: string;
  openOnDoubleClick?: boolean;
  fullPageHref?: string;
  lightboxAriaLabel?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const pointerStartX = useRef<number | null>(null);
  const resumeTimerId = useRef<number | null>(null);

  function goNext() {
    setActiveIndex((current) => (current + 1) % items.length);
  }

  function goPrev() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
  }

  function pauseBriefly() {
    setIsAutoPlaying(false);

    if (resumeTimerId.current !== null) {
      window.clearTimeout(resumeTimerId.current);
    }

    resumeTimerId.current = window.setTimeout(() => {
      setIsAutoPlaying(true);
      resumeTimerId.current = null;
    }, 2000);
  }

  function openLightbox(index: number) {
    if (!openOnDoubleClick) {
      return;
    }

    pauseBriefly();

    if (fullPageHref) {
      window.location.href = `${fullPageHref}?slide=${index}`;
      return;
    }

    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function showLightboxNext() {
    setLightboxIndex((current) => (current === null ? current : (current + 1) % items.length));
  }

  function showLightboxPrevious() {
    setLightboxIndex((current) =>
      current === null ? current : (current - 1 + items.length) % items.length,
    );
  }

  useEffect(() => {
    if (!isAutoPlaying) {
      return;
    }

    const intervalId = window.setInterval(() => {
      goNext();
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [isAutoPlaying, items.length]);

  useEffect(() => {
    return () => {
      if (resumeTimerId.current !== null) {
        window.clearTimeout(resumeTimerId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeLightbox();
      }

      if (event.key === "ArrowLeft") {
        showLightboxPrevious();
      }

      if (event.key === "ArrowRight") {
        showLightboxNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, items.length]);

  const lightboxItem = lightboxIndex === null ? null : items[lightboxIndex];

  return (
    <div
      className={`hero-carousel ${openOnDoubleClick ? "hero-carousel--lightbox-enabled" : ""}`}
      aria-label={ariaLabel}
    >
      <div
        className="hero-carousel__stage"
        role="region"
        aria-live="polite"
        tabIndex={0}
        onPointerDown={(event) => {
          pointerStartX.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerStartX.current === null) {
            return;
          }

          const swipeDistance = event.clientX - pointerStartX.current;
          pointerStartX.current = null;

          if (Math.abs(swipeDistance) < 36) {
            return;
          }

          pauseBriefly();

          if (swipeDistance > 0) {
            goPrev();
          } else {
            goNext();
          }
        }}
        onPointerCancel={() => {
          pointerStartX.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            pauseBriefly();
            goPrev();
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            pauseBriefly();
            goNext();
          }

          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            setIsAutoPlaying((playing) => !playing);
          }
        }}
      >
        {items.map((artist, index) => {
          const offset = getCarouselOffset(index, activeIndex, items.length);
          const isVisible = Math.abs(offset) <= 1;

          return (
            <article
              key={artist.name}
              className={`hero-slide hero-slide--${artist.tone}`}
              data-offset={offset}
              data-active={index === activeIndex}
              aria-hidden={!isVisible}
              onDoubleClick={() => {
                if (index === activeIndex) {
                  openLightbox(index);
                }
              }}
              style={
                {
                  "--hero-face-image": `url(${artist.image})`,
                  "--hero-face-position": artist.position,
                } as CSSProperties
              }
            >
              {artist.logo ? (
                <img
                  className="hero-slide__corner-logo"
                  src={artist.logo}
                  alt={artist.logoAlt ?? `${artist.role} logo`}
                />
              ) : null}
              <div className="hero-slide__meta">
                <div className="hero-slide__role">{artist.role}</div>
                <div className="hero-slide__name">{artist.name}</div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hero-carousel__dots" aria-label={dotAriaLabel}>
        {items.map((artist, index) => (
          <button
            key={artist.name}
            type="button"
            className="hero-carousel__dot"
            data-active={index === activeIndex}
            onClick={() => {
              pauseBriefly();
              setActiveIndex(index);
            }}
            aria-label={`Show ${artist.name}`}
            aria-pressed={index === activeIndex}
          />
        ))}
      </div>

      {openOnDoubleClick && lightboxItem ? (
        <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={lightboxAriaLabel}>
          <button
            type="button"
            className="media-lightbox__close"
            onClick={closeLightbox}
            aria-label="Close slideshow"
          >
            Close
          </button>
          <button
            type="button"
            className="media-lightbox__nav media-lightbox__nav--previous"
            onClick={showLightboxPrevious}
            aria-label="Previous image"
          >
            Prev
          </button>
          <figure className="media-lightbox__figure">
            <img src={lightboxItem.image} alt={`${lightboxItem.role}: ${lightboxItem.name}`} />
            <figcaption>
              <span>{lightboxItem.role}</span>
              <strong>{lightboxItem.name}</strong>
            </figcaption>
          </figure>
          <button
            type="button"
            className="media-lightbox__nav media-lightbox__nav--next"
            onClick={showLightboxNext}
            aria-label="Next image"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
