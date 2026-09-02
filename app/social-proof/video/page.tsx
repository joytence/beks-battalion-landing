import type { Metadata } from "next";
import { SocialProofVideoPlayer } from "./SocialProofVideoPlayer";
import { socialProofVideos } from "@/lib/social-proof";

export const metadata: Metadata = {
  title: "Sold-Out Show Video | Joy Stage Productions",
  description: "Full-page video player for Beks Battalion sold-out show excitement.",
};

export default function SocialProofVideoPage({
  searchParams,
}: {
  searchParams?: { video?: string };
}) {
  const requestedVideoIndex = Number(searchParams?.video ?? "0");
  const activeVideoIndex =
    Number.isInteger(requestedVideoIndex) &&
    requestedVideoIndex >= 0 &&
    requestedVideoIndex < socialProofVideos.length
      ? requestedVideoIndex
      : 0;

  return <SocialProofVideoPlayer initialVideoIndex={activeVideoIndex} videos={socialProofVideos} />;
}
