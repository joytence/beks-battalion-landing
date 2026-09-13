import { eventDetails, getSiteUrl } from "@/lib/ticketing";

const venueAddress = `${eventDetails.venueAddress.line1}, ${eventDetails.venueAddress.city}, ${eventDetails.venueAddress.state} ${eventDetails.venueAddress.postalCode}`;
const encodedVenueAddress = encodeURIComponent(venueAddress);

export const venueDirections = {
  address: venueAddress,
  appleMapsUrl: `https://maps.apple.com/?daddr=${encodedVenueAddress}&dirflg=d`,
  googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodedVenueAddress}&travelmode=driving`,
  parkingGuidePath: "/assets/pasea-theater-parking-guide.jpg",
  pdfPath: "/assets/beks-battalion-arrival-guide.pdf",
  turnInstructions: [
    {
      freeway: "From SR-125",
      instruction: "Exit onto Olympic Parkway, then make a left into the Otay Ranch High School parking area.",
    },
    {
      freeway: "From I-805",
      instruction: "Exit onto Olympic Parkway, then make a right into the Otay Ranch High School parking area.",
    },
  ],
} as const;

export function getVenueDirectionsPageUrl() {
  return `${getSiteUrl()}/directions`;
}

export function getVenueArrivalGuideUrl() {
  return `${getSiteUrl()}${venueDirections.pdfPath}`;
}

export function getVenueParkingGuideUrl() {
  return `${getSiteUrl()}${venueDirections.parkingGuidePath}`;
}
