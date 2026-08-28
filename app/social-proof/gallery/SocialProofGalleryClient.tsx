"use client";

import { useEffect, useState } from "react";

type GalleryItem = {
  image: string;
  name: string;
  role: string;
};

export function SocialProofGalleryClient({
  initialIndex,
  items,
}: {
  initialIndex: number;
  items: readonly GalleryItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeItem = items[activeIndex];

  function showNext() {
    setActiveIndex((current) => (current + 1) % items.length);
  }

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        showPrevious();
      }

      if (event.key === "ArrowRight") {
        showNext();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items.length]);

  return (
    <main className="media-page media-page--gallery">
      <div className="media-page__topbar">
        <a className="media-page__back" href="/#social-proof">
          Back to The Excitement
        </a>
        <div className="media-page__counter">
          {activeIndex + 1} / {items.length}
        </div>
      </div>

      <section className="media-page__stage" aria-label="Full page photo slideshow">
        <button
          type="button"
          className="media-page__nav media-page__nav--previous"
          onClick={showPrevious}
          aria-label="Previous photo"
        >
          Prev
        </button>
        <figure className="media-page__figure">
          <img src={activeItem.image} alt={`${activeItem.role}: ${activeItem.name}`} />
          <figcaption>
            <span>{activeItem.role}</span>
            <strong>{activeItem.name}</strong>
          </figcaption>
        </figure>
        <button
          type="button"
          className="media-page__nav media-page__nav--next"
          onClick={showNext}
          aria-label="Next photo"
        >
          Next
        </button>
      </section>

      <div className="media-page__thumbs" aria-label="Select photo">
        {items.map((item, index) => (
          <button
            key={item.image}
            type="button"
            className="media-page__thumb"
            data-active={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            aria-label={`Show ${item.name}`}
            aria-pressed={index === activeIndex}
          >
            <img src={item.image} alt="" />
          </button>
        ))}
      </div>
    </main>
  );
}
