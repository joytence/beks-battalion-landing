import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { CookieConsent } from "./CookieConsent";
import "./globals.css";

const googleTagManagerId = "GTM-NRZ7WG9H";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.joystageproductions.com"),
  title: "Beks Battalion",
  description: "Beks Battalion live comedy event landing page for tickets, lineup, and sponsors.",
  openGraph: {
    title: "Beks Battalion",
    description: "Beks Battalion live comedy event landing page for tickets, lineup, and sponsors.",
    url: "https://www.joystageproductions.com",
    siteName: "Joy Stage Productions LLC",
    images: [
      {
        url: "/assets/hero-preview-metadata.jpg",
        width: 1200,
        height: 630,
        alt: "Beks Battalion hero preview poster",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beks Battalion",
    description: "Beks Battalion live comedy event landing page for tickets, lineup, and sponsors.",
    images: ["/assets/hero-preview-metadata.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script id="google-tag-manager" strategy="beforeInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${googleTagManagerId}');`}
        </Script>
      </head>
      <body className={`${spaceGrotesk.variable} ${bebasNeue.variable}`}>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
