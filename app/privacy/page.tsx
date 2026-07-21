import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Joy Stage Productions",
  description:
    "Privacy policy for the Beks Battalion event landing page by Joy Stage Productions.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <section className="privacy-card">
        <a className="privacy-card__back" href="/">
          Back to Event Page
        </a>
        <p className="section-kicker">
          <span />
          Privacy Policy
        </p>
        <h1>Joy Stage Productions Privacy Policy</h1>
        <p className="privacy-card__updated">Last updated: July 7, 2026</p>

        <div className="privacy-section">
          <h2>What We Collect</h2>
          <p>
            When you submit a ticket or sponsor inquiry, we collect the details
            you provide, such as your name, email address, phone number, ticket
            quantity, business name, selected package, and message.
          </p>
        </div>

        <div className="privacy-section">
          <h2>How We Use Your Information</h2>
          <ul className="privacy-list">
            <li>To respond to ticket and sponsor inquiries.</li>
            <li>To send event follow-up information you requested.</li>
            <li>To understand interest in the Beks Battalion event.</li>
          </ul>
        </div>

        <div className="privacy-section">
          <h2>Cookies And Meta Tracking</h2>
          <p>
            If you choose to accept tracking, we may use Meta Pixel and Meta
            Conversions API to measure website visits and inquiry activity. This
            can include browser cookies, page visit information, form inquiry
            events, browser or device details, and hashed contact information
            such as email or phone number.
          </p>
          <p>
            If you choose Essential Only, the website will still allow you to
            send inquiries, but we will not intentionally send Meta tracking
            events from your inquiry form.
          </p>
        </div>

        <div className="privacy-section">
          <h2>Your Choices</h2>
          <p>
            You can accept or decline tracking using the privacy banner on this
            site. After making a choice, use the Privacy Choices button to reset
            your selection. You can also clear cookies in your browser settings.
          </p>
          <p>
            For ticket purchase, event communication, and SMS-related rules, see
            the Joy Stage Productions <a href="/terms">Terms and Conditions</a>.
          </p>
        </div>

        <div className="privacy-section">
          <h2>Contact</h2>
          <p>
            For questions about this policy or your information, contact Joy
            Stage Productions at{" "}
            <a href="mailto:joy.tence@joystageproductions.com">
              joy.tence@joystageproductions.com
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
