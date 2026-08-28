import type { Metadata } from "next";
import { socialProofVideo } from "@/lib/social-proof";

export const metadata: Metadata = {
  title: "Sold-Out Show Video | Joy Stage Productions",
  description: "Full-page video player for Beks Battalion sold-out show excitement.",
};

export default function SocialProofVideoPage() {
  return (
    <main className="media-page media-page--video">
      <div className="media-page__topbar">
        <a className="media-page__back" href="/#social-proof">
          Back to The Excitement
        </a>
      </div>

      <section className="media-page__video-stage" aria-label="Full page sold-out show video">
        <video controls autoPlay playsInline poster={socialProofVideo.poster}>
          <source src={socialProofVideo.src} type="video/mp4" />
        </video>
      </section>
    </main>
  );
}
