import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";
import { HeroCountdown } from "../HeroCountdown";
import { SiteFooter } from "../SiteFooter";
import { TopbarActions } from "../TopbarActions";
import { eventDetails } from "@/lib/ticketing";

export const metadata: Metadata = {
  title: "Contact Us | Joy Stage Productions",
  description: "Get customer support for Beks Battalion tickets, orders, and event questions.",
};

const contactNav = [
  { href: "/", label: "Back Home", tone: "gold" },
  { href: "/tickets", label: "Buy Tickets", tone: "hot" },
] as const;

export default function ContactPage() {
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
          <HeroCountdown targetIso={eventDetails.dateIso} />
          <TopbarActions items={contactNav} />
        </div>
      </header>

      <section className="page page--contact">
        <div className="page__inner contact-page">
          <div className="contact-page__intro">
            <div className="section-tag"><span />Customer Support</div>
            <h1 className="section-title">Need Help? We&apos;re Here.</h1>
            <p>
              Questions about tickets, payment, accessibility, or the event? Send us a message and
              Joy Stage Productions will follow up by email.
            </p>
            <a className="contact-page__email" href="mailto:joy.tence@joystageproductions.com">
              joy.tence@joystageproductions.com
            </a>
          </div>
          <div className="contact-page__card">
            <ContactForm />
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
