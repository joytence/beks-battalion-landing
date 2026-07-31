"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

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

export function HeroCarousel({ items }: { items: readonly HeroFace[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  function goNext() {
    setActiveIndex((current) => (current + 1) % items.length);
  }

  function goPrev() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
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

  return (
    <div className="hero-carousel" aria-label="Featured artists">
      <div
        className="hero-carousel__stage"
        role="region"
        aria-live="polite"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            setIsAutoPlaying(false);
            goPrev();
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            setIsAutoPlaying(false);
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

      <div className="hero-carousel__controls" aria-label="Carousel controls">
        <button
          type="button"
          className="hero-carousel__control"
          onClick={() => {
            setIsAutoPlaying(false);
            goPrev();
          }}
          aria-label="Show previous artist"
        >
          Prev
        </button>

        <button
          type="button"
          className="hero-carousel__control hero-carousel__control--accent"
          onClick={() => setIsAutoPlaying((playing) => !playing)}
          aria-label={isAutoPlaying ? "Pause carousel autoplay" : "Resume carousel autoplay"}
          aria-pressed={!isAutoPlaying}
        >
          {isAutoPlaying ? "Pause" : "Play"}
        </button>

        <button
          type="button"
          className="hero-carousel__control"
          onClick={() => {
            setIsAutoPlaying(false);
            goNext();
          }}
          aria-label="Show next artist"
        >
          Next
        </button>
      </div>

      <div className="hero-carousel__dots" aria-label="Select featured artist">
        {items.map((artist, index) => (
          <button
            key={artist.name}
            type="button"
            className="hero-carousel__dot"
            data-active={index === activeIndex}
            onClick={() => {
              setIsAutoPlaying(false);
              setActiveIndex(index);
            }}
            aria-label={`Show ${artist.name}`}
            aria-pressed={index === activeIndex}
          />
        ))}
      </div>
    </div>
  );
}
