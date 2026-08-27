import { InquiryAction } from "../InquiryAction";
import { SiteFooter } from "../SiteFooter";
import { SponsorLogoFooter } from "../SponsorLogoFooter";
import { TopbarActions } from "../TopbarActions";
import { sponsorPackages } from "@/lib/sponsors";

const sponsorNav = [
  { href: "/", label: "Back Home", tone: "gold" },
  { href: "/tickets", label: "Buy Tickets", tone: "hot" },
  { href: "/performers", label: "Special Performers", tone: "gold" },
] as const;

export default function SponsorsPage() {
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

          <TopbarActions items={sponsorNav} />
        </div>
      </header>

      <section className="page page--sponsors-page page--sponsor-footer" id="hero">
        <video
          className="hero__background-video sponsors-page__background-video"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        >
          <source src="/assets/hero-background.mp4" type="video/mp4" />
        </video>

        <div className="page__inner sponsors sponsors-page">
          <div className="sponsors-page__intro">
            <h1 className="section-title">Partner With The Show</h1>
            <p>
              Put your business in front of the Beks Battalion San Diego audience with sponsor
              packages built for visibility, community support, and event-day recognition.
            </p>
          </div>

          <div className="sponsor-grid">
            {sponsorPackages.map((sponsor) => (
              <article
                key={sponsor.tier}
                className={`card sponsor-card ${sponsor.featured ? "sponsor-card--featured" : ""}`}
                tabIndex={0}
              >
                <div className="sponsor-card__tier">{sponsor.tier}</div>
                <h2>{sponsor.title}</h2>
                <div className="value">{sponsor.price}</div>
                <ul>
                  {sponsor.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <InquiryAction
                  className="cta cta--ghost sponsor-card__apply"
                  itemName={sponsor.tier}
                  kind="sponsor"
                  label="Ask About This Package"
                />
              </article>
            ))}
          </div>

          <SponsorLogoFooter packageLinkPlacement="afterSponsorCopy" />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
