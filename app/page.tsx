import { HeroCarousel } from "./HeroCarousel";
import { HeroCountdown } from "./HeroCountdown";
import { SiteFooter } from "./SiteFooter";
import { SponsorLogoFooter } from "./SponsorLogoFooter";
import { TopbarActions } from "./TopbarActions";
import { heroFaces } from "@/lib/performers";
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
  { href: "/performers", label: "Special Performers", tone: "gold" },
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

export default async function Page() {
  const unavailableSeatLabels = isTicketingDatabaseConfigured()
    ? await getUnavailableSeatLabels()
    : new Set<string>();
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

          <TopbarActions items={topbarCtas} />
        </div>

        <div className="marquee" aria-label="Event marquee">
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
          <div className="hero__copy">
            <h1 className="hero__title">
              <span className="hero__title-hook">One Night of Laughs, Music, and Energy</span>
              <span className="hero__title-primary">Beks Battalion</span>
              <span className="hero__title-secondary">The Laff Control Project</span>
            </h1>
          </div>

          <HeroCountdown targetIso={eventDetails.dateIso} title="Until The Show" />

          <div className="hero__eventline">
            <div className="hero__eventline-script">Live!</div>
            <div className="hero__eventline-title">IN SAN DIEGO</div>
            <div className="hero__eventline-date">SEP 13, 2026 | 5PM to 9PM</div>
            <div className="hero__eventline-venue">@ Otay Ranch High School, Chula Vista.</div>
          </div>

          <div className="hero__visual">
            <img
              className="hero__logo-overlay"
              src="/assets/joy-stage-logo-gold.png"
              alt="Joy Stage Productions LLC"
            />
            <HeroCarousel items={heroFaces} />
      <div className="hero__cta-stack" id="tickets">
        <div className="tickets-cta-card tickets-cta-card--hero">
          <h2>Don&apos;t miss a night of laughs.</h2>
          <div className="tickets-cta-card__counter" aria-label={`Only ${svipAvailableCount} SVIP tickets left`}>
            <span className="tickets-cta-card__counter-kicker">SVIP Tickets Almost Sold Out</span>
            <strong>{svipAvailableCount}</strong>
            <span>left</span>
          </div>
                <p>
                  Beks Battalion is coming to San Diego for one night only. Pick your seats before your
                  preferred section sells out.
                </p>
                <a className="cta cta--hot tickets-cta-card__button" href="/tickets">Buy Your Tickets Now!</a>
        <p className="tickets-cta-card__note tickets-cta-card__note--price">Tickets start from $100</p>
      </div>

      <p className="hero__opening-copy">
        Our main show will be opened by 6 local artist to include our very own Producer - Joy Tence
      </p>
      <a className="cta cta--outline-pink hero__performers-cta" href="/performers">
        See All Opening Acts
      </a>
    </div>
            <img
              className="hero__logo-secondary"
              src="/assets/stage-nova-production-transparent.png"
              alt="StageNova Entertainment Production"
            />
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
