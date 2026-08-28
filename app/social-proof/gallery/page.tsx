import type { Metadata } from "next";
import { SocialProofGalleryClient } from "./SocialProofGalleryClient";
import { soldOutShowMoments } from "@/lib/social-proof";

export const metadata: Metadata = {
  title: "Sold-Out Show Gallery | Joy Stage Productions",
  description: "Full-page photo gallery of Beks Battalion sold-out show excitement.",
};

type GalleryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SocialProofGalleryPage({ searchParams }: GalleryPageProps) {
  const params = (await searchParams) || {};
  const rawSlide = typeof params.slide === "string" ? Number.parseInt(params.slide, 10) : 0;
  const initialIndex =
    Number.isFinite(rawSlide) && rawSlide >= 0 && rawSlide < soldOutShowMoments.length
      ? rawSlide
      : 0;

  return <SocialProofGalleryClient initialIndex={initialIndex} items={soldOutShowMoments} />;
}
