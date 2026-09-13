import type { Metadata } from "next";
import { SiteFooter } from "../SiteFooter";
import { eventDetails } from "@/lib/ticketing";
import { venueDirections } from "@/lib/venue-directions";
import styles from "./directions.module.css";

export const metadata: Metadata = {
  title: "Directions and Parking | Beks Battalion",
  description: "Guest directions and parking arrival details for Beks Battalion at Otay Ranch High School.",
};

export default function DirectionsPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <a className={styles.backLink} href="/">
          Back to event
        </a>
        <p className={styles.eyebrow}>Guest arrival guide</p>
        <h1>Find the venue without the guesswork.</h1>
        <p className={styles.lead}>
          {eventDetails.name} is at <strong>Otay Ranch High School</strong>. Use your preferred map
          app for live navigation, then follow the freeway-specific parking instructions below.
        </p>

        <div className={styles.mapActions}>
          <a href={venueDirections.googleMapsUrl} target="_blank" rel="noreferrer" className={styles.googleButton}>
            Open in Google Maps
          </a>
          <a href={venueDirections.appleMapsUrl} target="_blank" rel="noreferrer" className={styles.appleButton}>
            Open in Apple Maps
          </a>
          <a href={venueDirections.parkingGuidePath} download className={styles.downloadButton}>
            Download Parking Map
          </a>
        </div>
      </section>

      <section className={styles.parkingGuide} aria-labelledby="parking-map-title">
        <div className={styles.parkingGuideHeader}>
          <div>
            <p className={styles.eyebrow}>The Pasea Theater</p>
            <h2 id="parking-map-title">Parking and theater walk map</h2>
          </div>
          <a href={venueDirections.parkingGuidePath} download className={styles.mapDownloadLink}>
            Download this map
          </a>
        </div>
        <img
          src={venueDirections.parkingGuidePath}
          alt="The Pasea Theater parking guide showing the Olympic Parkway entrance, main parking, street parking, and walking route to the theater."
        />
        <p>
          Enter from Olympic Parkway. The map highlights the main parking area, first-come
          first-served street parking, and the walking route to The Pasea theater.
        </p>
      </section>

      <section className={styles.routeGrid} aria-label="Venue directions">
        {venueDirections.turnInstructions.map((route) => (
          <article className={styles.routeCard} key={route.freeway}>
            <span className={styles.routeBadge}>{route.freeway}</span>
            <p>{route.instruction}</p>
          </article>
        ))}
      </section>

      <section className={styles.destinationCard}>
        <div>
          <p className={styles.eyebrow}>Destination</p>
          <h2>Otay Ranch High School</h2>
          <p>{venueDirections.address}</p>
          <p className={styles.eventTime}>{eventDetails.dateLabel}</p>
        </div>
        <div className={styles.pin} aria-hidden="true">
          <span />
        </div>
      </section>

      <p className={styles.note}>
        The map buttons use your current location for turn-by-turn directions. Please allow extra
        time for parking and walking to the theater.
      </p>
      <SiteFooter />
    </main>
  );
}
