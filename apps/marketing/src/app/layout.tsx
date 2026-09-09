import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthHub — keep the whole story.",
  description:
    "HealthHub is a private health companion for families. Records, medicines, vitals, and grounded AI — in English, Sinhala and Tamil. Crafted in Colombo.",
  other: {
    "theme-color": "#0B1F3A",
  },
  openGraph: {
    type: "website",
    title: "HealthHub — keep the whole story.",
    description:
      "A private, beautifully kept health companion. Records, medicines, vitals, and grounded AI. Built in Sri Lanka.",
    images: "https://healthhub.app/og-image.png",
    url: "https://healthhub.app",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500;1,9..144,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
