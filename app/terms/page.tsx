import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and Conditions | Joy Stage Productions",
  description:
    "Terms and conditions for Joy Stage Productions ticket purchases, event communications, and SMS updates.",
};

export default function TermsPage() {
  return (
    <main className="privacy-page">
      <section className="privacy-card">
        <a className="privacy-card__back" href="/">
          Back to Event Page
        </a>
        <p className="section-kicker">
          <span />
          Terms And Conditions
        </p>
        <h1>Joy Stage Productions Terms And Conditions</h1>
        <p className="privacy-card__updated">Last updated: July 21, 2026</p>

        <div className="privacy-section">
          <h2>Use Of This Site</h2>
          <p>
            This website is operated by Joy Stage Productions LLC for event information, ticket
            purchases, sponsor inquiries, and related customer support. By using this site or
            purchasing tickets through it, you agree to these Terms and Conditions.
          </p>
        </div>

        <div className="privacy-section">
          <h2>Ticket Orders</h2>
          <p>
            Ticket availability is limited and subject to change until payment is successfully
            completed. Seat assignments, ticket tiers, prices, taxes, and processing charges shown
            during checkout control the final order. Joy Stage Productions may cancel, correct, or
            refuse an order if payment is not completed, fraudulent activity is suspected, or a
            technical issue causes an incorrect inventory or pricing display.
          </p>
        </div>

        <div className="privacy-section">
          <h2>Event Changes</h2>
          <p>
            Event dates, times, seating arrangements, talent lineups, and venue operations may
            change. Joy Stage Productions reserves the right to update event details when necessary.
            If an event is postponed, moved, or materially changed, any available customer remedies
            will be handled according to the applicable ticket policy for that event.
          </p>
        </div>

        <div className="privacy-section">
          <h2>Customer Information</h2>
          <p>
            You agree to provide accurate contact, payment, and ticket delivery information when
            placing an order or requesting support. Joy Stage Productions is not responsible for
            missed communications or ticket delivery issues caused by incorrect email addresses,
            phone numbers, or other customer-provided information.
          </p>
        </div>

        <div className="privacy-section">
          <h2>SMS Ticket And Support Messages</h2>
          <p>
            If you provide your mobile number and request or agree to receive ticket-related text
            messages, Joy Stage Productions may send low-volume SMS messages related to your ticket
            order or support request. These messages may include ticket confirmations, secure ticket
            links, resend requests, order support follow-up, or event reminders connected to an
            existing ticket order.
          </p>
          <p>
            Message frequency varies by order activity and support needs. Message and data rates may
            apply. Consent to receive SMS messages is not a condition of purchase. To stop receiving
            text messages, reply STOP. For assistance, reply HELP or contact{" "}
            <a href="mailto:joy.tence@joystageproductions.com">
              joy.tence@joystageproductions.com
            </a>
            .
          </p>
        </div>

        <div className="privacy-section">
          <h2>Refunds And Order Issues</h2>
          <p>
            Refunds, cancellations, ticket corrections, and seat-release decisions are handled at
            the discretion of Joy Stage Productions and any event-specific policies in effect at the
            time of purchase. If you believe your order contains an error, contact Joy Stage
            Productions as soon as possible so the issue can be reviewed.
          </p>
        </div>

        <div className="privacy-section">
          <h2>Privacy</h2>
          <p>
            Your use of this site is also subject to the Joy Stage Productions{" "}
            <a href="/privacy">Privacy Policy</a>, which explains how information is collected,
            used, and stored.
          </p>
        </div>

        <div className="privacy-section">
          <h2>Contact</h2>
          <p>
            Questions about these Terms and Conditions may be sent to Joy Stage Productions at{" "}
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
