import { HeroCarousel } from "./HeroCarousel";
import { HeroCountdown } from "./HeroCountdown";
import { SiteFooter } from "./SiteFooter";
import { SocialProofVideo } from "./SocialProofVideo";
import { SponsorLogoFooter } from "./SponsorLogoFooter";
import { TopbarActions } from "./TopbarActions";
import { homepagePerformers } from "@/lib/performers";
import { socialProofVideos, soldOutShowMoments } from "@/lib/social-proof";
import { getUnavailableSeatLabels, isTicketingDatabaseConfigured } from "@/lib/ticketing-store";
import { eventDetails, getTicketSeatChart } from "@/lib/ticketing";

export const dynamic = "force-dynamic";

const marqueeItems = [
  "Beks Battalion",
  "Coming to San Diego",
  "September 13, 2026",
  "@ OTAY RANCH HIGH SCHOOL THEATER",
  "Laugh and Enjoy",
];

const topbarCtas = [
  { href: "/tickets", label: "Buy Tickets", tone: "hot" },
  { href: "/sponsors", label: "Sponsor Info", tone: "gold" },
] as const;

function SectionTag({ children }: { children: string }) {
  return (
    <div className="section-tag">
      <span />
      {children}
    </div>
  );
}

function EventMarquee() {
  return (
    <div className="marquee hero__marquee" aria-label="Event marquee">
      <div className="marquee__track">
        <div className="marquee__row">
          {marqueeItems.map((item) => (
            <span key={item} className="marquee__item">
              <span>{item}</span>
              <span className="marquee__dot" />
            </span>
          ))}
        </div>
        <div className="marquee__row" aria-hidden="true">
          {marqueeItems.map((item) => (
            <span key={`${item}-repeat`} className="marquee__item">
              <span>{item}</span>
              <span className="marquee__dot" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

async function getHomepageUnavailableSeatLabels() {
  if (!isTicketingDatabaseConfigured()) {
    return new Set<string>();
  }

  try {
    return await getUnavailableSeatLabels();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Ticket database is unavailable for local preview; rendering homepage without live seat holds.",
        error,
      );
      return new Set<string>();
    }

    throw error;
  }
}

export default async function Page() {
  const unavailableSeatLabels = await getHomepageUnavailableSeatLabels();
  const seatChart = getTicketSeatChart({ blockedSeatLabels: unavailableSeatLabels });
  const svipSeats = seatChart.blocks.flatMap((block) =>
    block.rows.flatMap((row) => row.seats.filter((seat) => seat.tierId === "svip")),
  );
  const svipAvailableCount = svipSeats.filter((seat) => seat.status === "available").length;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar__inner">
          <a className="brand" href="#hero" aria-label="Beks Battalion home">
            <div className="brand__mark">
              <img src="/assets/joy-stage-logo-gold.png" alt="" />
            </div>
            <div className="brand__copy">
              <div className="brand__title">Joy Stage Productions LLC</div>
              <div className="brand__subtitle">We plan. We produce. You shine.</div>
            </div>
          </a>

          <HeroCountdown targetIso={eventDetails.dateIso} />

          <TopbarActions items={topbarCtas} />
        </div>
      </header>

      <section className="page page--hero" id="hero">
        <video
          className="hero__background-video"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        >
          <source src="/assets/hero-background.mp4" type="video/mp4" />
        </video>

        <div className="page__inner hero">
          <div className="hero__eventline">
            <div className="hero__eventline-show">
              <img
                className="hero__eventline-logo"
                src="/assets/beks-battalion-headline-logo.png"
                alt=""
                aria-hidden="true"
              />
              <span>Beks Battalion</span>
            </div>
            <div className="hero__eventline-script">LIVE!</div>
            <div className="hero__eventline-title">IN SAN DIEGO</div>
            <div className="hero__eventline-date">SEP 13, 2026 | 5PM to 9PM</div>
            <div className="hero__eventline-venue">@ Otay Ranch High School, Chula Vista.</div>
          </div>

          <div className="hero__visual">
            <HeroCarousel
              items={homepagePerformers}
              ariaLabel="Beks Battalion and Joy Stage performers"
              dotAriaLabel="Select performer"
            />
            <div className="hero__cta-stack" id="tickets">
              <div className="tickets-cta-card tickets-cta-card--hero">
                <h2>Don&apos;t miss a night of laughs.</h2>
                <div
                  className="tickets-cta-card__counter"
                  aria-label={`Only ${svipAvailableCount} SVIP tickets left`}
                >
                  <span className="tickets-cta-card__counter-kicker">
                    SVIP Tickets Almost Sold Out
                  </span>
                  <strong>{svipAvailableCount}</strong>
                  <span>left</span>
                </div>
                <p>
                  Beks Battalion is coming to San Diego for one night only. Pick your seats before
                  your preferred section sells out.
                </p>
                <a className="cta cta--hot tickets-cta-card__button" href="/tickets">
                  Buy Your Tickets Now!
                </a>
                <p className="tickets-cta-card__note tickets-cta-card__note--price">
                  Tickets start from $100
                </p>
              </div>
            </div>

            <EventMarquee />

            <section
              className="social-proof"
              id="social-proof"
              aria-label="Event video and sold-out show excitement"
            >
              <article className="social-proof-card social-proof-card--video">
                <div className="social-proof-card__header">
                  <span>Canada and Australia Sold Out Show</span>
                  <strong>Next Stop USA</strong>
                </div>
                <SocialProofVideo
                  videos={socialProofVideos}
                  fullPageHref="/social-proof/video"
                />
              </article>

              <article className="social-proof-card social-proof-card--carousel">
                <div className="social-proof-card__header">
                  <span>Sold-Out Show Moments</span>
                  <strong>Experience Live</strong>
                </div>
                <HeroCarousel
                  items={soldOutShowMoments}
                  ariaLabel="Sold-out show moments"
                  dotAriaLabel="Select sold-out show moment"
                  openOnDoubleClick={true}
                  fullPageHref="/social-proof/gallery"
                />
                <p className="social-proof-card__note">
                  Real show moments from audiences who showed up, laughed, and filled the room.
                </p>
                <p className="social-proof-card__hint">
                  Double-click the active image to see the full slideshow.
                </p>
              </article>
            </section>

          </div>
        </div>
      </section>

      <section className="page page--sponsor-footer" id="sponsors">
        <div className="page__inner sponsors sponsor-teaser">
          <SponsorLogoFooter />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
