import type { CSSProperties } from "react";

import { InquiryAction } from "./InquiryAction";

const marqueeItems = [
  "Beks Battalion",
  "Coming to San Diego",
  "September 13, 2026",
  "@ OTAY RANCH HIGH SCHOOL",
  "Laugh and Enjoy",
];

const topbarCtas = [
  { href: "#lineup", label: "Special Performers", tone: "ghost" },
  { href: "#tickets", label: "Ticket Info", tone: "hot" },
  { href: "#sponsors", label: "Sponsor Info", tone: "ghost" },
];

const schedule = [
  { time: "6:00 PM", desc: "Doors open and guest arrival" },
  { time: "6:45 PM", desc: "Pre-show energy and seating" },
  { time: "7:00 PM", desc: "Beks Battalion live performance" },
  { time: "9:00 PM", desc: "Show close and send-off" },
];

const lineup = [
  {
    name: "Joy Tence",
    role: "Producer/Performer",
    badge: "JT",
    tone: "gold",
    image: "/assets/joy-tence.jpeg",
    position: "center center",
  },
  {
    name: "Lloyd Guilalas",
    role: "MC/Performer",
    badge: "LG",
    tone: "gold",
    image: "/assets/llyod-guilalas.jpg",
    position: "center center",
  },
  {
    name: "Jeane Moss",
    role: "Special Performers",
    badge: "JM",
    tone: "orange",
    image: "/assets/geane-moss.jpg",
    position: "center center",
  },
  {
    name: "Robin Hamby",
    role: "Special Performers",
    badge: "RH",
    tone: "pink",
    image: "/assets/robin-hamby.jpg",
    position: "center center",
  },
] as const;

function TicketStars({ count }: { count: number }) {
  return (
    <div className="ticket-card__stars" aria-label={`${count} star tier`}>
      {Array.from({ length: count }).map((_, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className="ticket-card__star"
        >
          <path d="M12 1.8l2.95 6.08 6.7.98-4.84 4.72 1.14 6.68L12 16.12l-5.95 3.14 1.14-6.68-4.84-4.72 6.7-.98L12 1.8z" />
        </svg>
      ))}
    </div>
  );
}

const ticketTiers = [
  {
    id: "svip",
    name: "SVIP",
    stars: 4,
    price: "150$",
    tone: "gold",
    featured: false,
    perks: ["Front row seating", "Meet and greet access", "Photo opportunity"],
  },
  {
    id: "vip",
    name: "VIP",
    stars: 3,
    price: "125$",
    tone: "orange",
    featured: true,
    perks: [
      "Reserved Mid-House Seating",
      "Great Balance of View & Value",
    ],
  },
  {
    id: "general",
    name: "General Admission",
    stars: 0,
    price: "100$",
    tone: "green",
    featured: false,
    perks: ["Affordable Reserved Seating", "Best Valued Entry"],
  },
];

const sponsors = [
  {
    tier: "Platinum Sponsor",
    title: "Top Visibility",
    price: "$2,500",
    items: [
      "Logo on all promotional materials",
      "10 SVIP guest passes included",
      "Stage recognition during the event",
      "Booth or display space",
      "Social media promotion before and after",
    ],
    featured: false,
  },
  {
    tier: "Gold Sponsor",
    title: "High Impact",
    price: "$1,500",
    items: [
      "Logo on posters and social media",
      "6 SVIP tickets included",
      "Stage recognition",
      "Booth or display space",
      "Preferred sponsor placement",
    ],
    featured: true,
  },
  {
    tier: "Silver Sponsor",
    title: "Community Support",
    price: "$750",
    items: [
      "Logo on selected promotional materials",
      "3 tickets included in the package",
      "Social media shout-out",
      "Supporter recognition",
      "Budget-friendly entry point",
    ],
    featured: false,
  },
];

const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61591769009057",
    icon: "facebook",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/joystageproductions",
    icon: "instagram",
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@joystageproductions",
    icon: "tiktok",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@joystageproductions",
    icon: "youtube",
  },
] as const;

function SectionTag({ children }: { children: string }) {
  return (
    <div className="section-tag">
      <span />
      {children}
    </div>
  );
}

function SocialIcon({ icon }: { icon: (typeof socialLinks)[number]["icon"] }) {
  switch (icon) {
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.25 8.2V6.9c0-.63.42-.78.72-.78h1.83V3.08L14.28 3c-2.8 0-3.44 2.09-3.44 3.43V8.2H8.65v3.12h2.19V21h3.41v-9.68h2.3l.3-3.12h-2.6z" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="4" width="16" height="16" rx="4.6" />
          <circle cx="12" cy="12" r="3.45" />
          <circle cx="16.9" cy="7.15" r="1" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14.35 3c.2 1.62 1.12 3.08 2.52 3.94.82.5 1.76.77 2.73.79v3.24a7.44 7.44 0 0 1-5.14-1.84v5.83a6.02 6.02 0 1 1-5.98-6.02c.38 0 .76.04 1.12.11v3.38a2.74 2.74 0 1 0 1.72 2.53V3h3.03z" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M21.3 7.35a3.02 3.02 0 0 0-2.13-2.14C17.29 4.7 12 4.7 12 4.7s-5.29 0-7.17.51A3.02 3.02 0 0 0 2.7 7.35 31.44 31.44 0 0 0 2.2 12c0 1.56.17 3.1.5 4.65a3.02 3.02 0 0 0 2.13 2.14c1.88.51 7.17.51 7.17.51s5.29 0 7.17-.51a3.02 3.02 0 0 0 2.13-2.14c.33-1.55.5-3.09.5-4.65s-.17-3.1-.5-4.65zM10.05 15.47V8.53L15.9 12l-5.85 3.47z" />
        </svg>
      );
  }
}

export default function Page() {
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

          <nav className="topbar__actions" aria-label="Primary actions">
            {topbarCtas.map((item) => (
              <a key={item.href} className={`cta cta--${item.tone}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
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
        <div className="page__inner hero">
          <div className="hero__eventline">
            <div className="hero__eventline-script">Live!</div>
            <div className="hero__eventline-title">IN SAN DIEGO</div>
            <div className="hero__eventline-date">SEP 13, 2026</div>
            <div className="hero__eventline-venue">@ Otay Ranch High School, Chula Vista.</div>
          </div>

          <div className="hero__copy">
            <h1 className="hero__title">
              <span className="hero__title-primary">Beks Battalion</span>
              <span className="hero__title-credits">
                with Lassy Marquez, Chad Kinis, and MC Muah.
              </span>
              <span className="hero__title-secondary">The Laff Control Project</span>
            </h1>
          </div>
          <div className="hero__logo-stack" aria-label="Joy Stage and StageNova logos">
            <img
              className="hero__logo-overlay"
              src="/assets/joy-stage-logo-gold.png"
              alt="Joy Stage Productions LLC"
            />
            <img
              className="hero__logo-secondary"
              src="/assets/stage-nova-production-transparent.png"
              alt="StageNova Entertainment Production"
            />
          </div>
        </div>
      </section>

      <section className="page page--lineup" id="lineup">
        <div className="page__inner lineup">
          <div className="lineup__intro">
            <SectionTag>Line Up Page</SectionTag>
            <h2 className="section-title">Special Performers</h2>
            <p>
              Featured performers bringing extra personality, presence, and energy to Beks
              Battalion.
            </p>
          </div>

          <div className="lineup-grid">
            {lineup.map((artist) => (
              <article
                key={artist.name}
                className={`card lineup-card lineup-card--photo lineup-card--${artist.tone}`}
                tabIndex={0}
                style={{
                  "--lineup-image": `url(${artist.image})`,
                  "--lineup-position": artist.position,
                } as CSSProperties}
              >
                <div className="lineup-card__badge">{artist.badge}</div>
                <div className="lineup-card__role">{artist.role}</div>
                <h3>{artist.name}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="page page--tickets" id="tickets">
        <div className="page__inner">
          <SectionTag>Ticket Page</SectionTag>
          <div className="tickets">
            <div className="ticket-poster ticket-poster--left">
              <h2 className="ticket-poster__heading">Choose Ticket Options</h2>

              <div className="ticket-poster__tiers">
                {ticketTiers.map((tier) => (
                  <article
                    key={tier.name}
                    className={`ticket-card ticket-card--${tier.tone} ${
                      tier.featured ? "ticket-card--featured" : ""
                    }`}
                    tabIndex={0}
                  >
                    {tier.stars > 0 ? <TicketStars count={tier.stars} /> : null}
                    <h3
                      className={`ticket-card__name ${
                        tier.name === "General Admission" ? "ticket-card__name--long" : ""
                      }`}
                    >
                      {tier.name}
                    </h3>
                    <div className="ticket-card__price">{tier.price}</div>
                    <ul className="ticket-card__perks">
                      {tier.perks.map((perk) => (
                        <li key={perk}>{perk}</li>
                      ))}
                    </ul>
                    <a
                      className="cta cta--ghost ticket-card__buy"
                      href="/tickets"
                    >
                      Buy Now
                    </a>
                  </article>
                ))}
              </div>
            </div>

            <div className="ticket-schedule card">
              <div className="ticket-schedule__header">
                <SectionTag>Event Schedule</SectionTag>
              </div>

              <div className="ticket-schedule__rows">
                {schedule.map((item) => (
                  <div key={item.time} className="ticket-schedule__row">
                    <div className="ticket-schedule__time">{item.time}</div>
                    <div className="ticket-schedule__desc">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page" id="sponsors">
        <div className="page__inner sponsors">
          <div>
            <SectionTag>Sponsors Page</SectionTag>
            <h2 className="section-title">Partner With The Show</h2>
          </div>

          <div className="sponsor-grid">
            {sponsors.map((sponsor) => (
              <article
                key={sponsor.tier}
                className={`card sponsor-card ${sponsor.featured ? "sponsor-card--featured" : ""}`}
                tabIndex={0}
              >
                <div className="sponsor-card__tier">{sponsor.tier}</div>
                <h3>{sponsor.title}</h3>
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
                  label="Apply Now"
                />
              </article>
            ))}
          </div>

          <div className="panel sponsor-cta">
            <div className="sponsor-cta__stack">
              <div className="sponsor-cta__current">To know more about our sponsors click their logos.</div>
              <div className="sponsor-cta__logos" aria-label="Current sponsor logos">
                <img
                  className="sponsor-cta__logo"
                  src="/assets/john-deleon-enterprize.jpg"
                  alt="John De Leon Enterprise"
                />
                <a
                  className="sponsor-cta__logo-link"
                  href="https://www.facebook.com/manilabistro.sd/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open Manila Bistro"
                >
                  <img
                    className="sponsor-cta__logo"
                    src="/assets/manila-bistro-logo.jpg"
                    alt="Manila Bistro"
                  />
                </a>
                <a
                  className="sponsor-cta__logo-link"
                  href="https://www.facebook.com/profile.php?id=100051323666388"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open JPM Lights and Sounds"
                >
                  <img
                    className="sponsor-cta__logo"
                    src="/assets/jpm-lights-and-sounds.jpg"
                    alt="JPM Lights and Sounds"
                  />
                </a>
                <a
                  className="sponsor-cta__logo-link"
                  href="https://www.ashmarieskincare.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open Ashhmarie Skin Care"
                >
                  <img
                    className="sponsor-cta__logo"
                    src="/assets/ashhmarie-logo.webp"
                    alt="Ashhmarie Skin Care"
                  />
                </a>
                <img
                  className="sponsor-cta__logo sponsor-cta__logo--wide"
                  src="/assets/mrs-b-realty-transparent.png"
                  alt="Mrs. B's Realty"
                />
                <img
                  className="sponsor-cta__logo sponsor-cta__logo--luna"
                  src="/assets/luna-band-ph.png"
                  alt="Luna Band PH"
                />
              </div>
            </div>
            <a className="cta cta--hot" href="#hero">
              Back to Top
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer__inner">
          <div>
            <strong className="footer__brand">Joy Stage Productions LLC</strong>
            <div>Event landing page concept for Beks Battalion.</div>
            <a className="footer__privacy" href="/privacy">
              Privacy Policy
            </a>
          </div>

          <div className="footer__social" aria-label="Social links">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                className="social"
                href={social.href}
                aria-label={social.label}
                target="_blank"
                rel="noreferrer"
              >
                <SocialIcon icon={social.icon} />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </main>
  );
}
