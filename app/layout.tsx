import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
});

const metaPixelId = process.env.META_PIXEL_ID || "2036904920238359";

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
        <Script id="meta-pixel" strategy="beforeInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      </head>
      <body className={`${spaceGrotesk.variable} ${bebasNeue.variable}`}>
        <noscript>
          <img
            alt=""
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
