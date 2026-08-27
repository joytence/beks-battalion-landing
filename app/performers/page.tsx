import { HeroCarousel } from "../HeroCarousel";
import { SiteFooter } from "../SiteFooter";
import { SponsorLogoFooter } from "../SponsorLogoFooter";
import { TopbarActions } from "../TopbarActions";
import { specialPerformers } from "@/lib/performers";

const performerNav = [
  { href: "/", label: "Back Home", tone: "ghost" },
  { href: "/tickets", label: "Buy Tickets", tone: "hot" },
  { href: "/sponsors", label: "Sponsor Info", tone: "gold" },
] as const;

export default function PerformersPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar__inner">
          <a className="brand" href="/" aria-label="Beks Battalion home">
            <div className="brand__mark">
              <img src="/assets/joy-stage-logo-gold.png" alt="" />
            </div>
            <div className="brand__copy">
              <div className="brand__title">Joy Stage Productions LLC</div>
              <div className="brand__subtitle">We plan. We produce. You shine.</div>
            </div>
          </a>

          <TopbarActions items={performerNav} />
        </div>
      </header>

      <section className="page page--lineup page--performers page--sponsor-footer">
        <video
          className="hero__background-video performers-page__background-video"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        >
          <source src="/assets/hero-background.mp4" type="video/mp4" />
        </video>

        <div className="page__inner lineup performers-page">
          <div className="lineup__intro performers-page__intro">
            <h1 className="section-title">Special Performers</h1>
            <a className="cta cta--hot performers-page__primary-cta" href="/tickets">
              Buy Your Tickets
            </a>
          </div>

          <div className="performers-page__carousel">
            <HeroCarousel items={specialPerformers} />
          </div>

          <SponsorLogoFooter />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
