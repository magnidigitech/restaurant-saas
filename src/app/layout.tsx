import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/core/theme/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#FAFAFA",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Restaurant Management Software for POS & Operations | Resto Bird",
    template: "%s | Resto Bird",
  },
  description:
    "Unified restaurant management software and POS operating system. Real-time table floor management, sub-second kitchen display, recipe inventory depletion, and automated payroll.",
  applicationName: "Resto Bird",
  keywords: [
    "restaurant management software",
    "restaurant POS software",
    "kitchen display system",
    "restaurant inventory software",
    "recipe costing software",
    "restaurant scheduling software",
    "restaurant payroll software",
    "Resto Bird",
  ],
  authors: [{ name: "Resto Bird" }],
  creator: "Resto Bird",
  publisher: "Resto Bird",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://restobird.com"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Restaurant Management Software for POS & Operations | Resto Bird",
    description:
      "Unified restaurant management software and POS operating system with real-time floor management, sub-second KDS, and recipe depletion.",
    url: "/",
    siteName: "Resto Bird",
    images: [
      {
        url: "/resto-bird-logo.png",
        width: 1200,
        height: 630,
        alt: "Resto Bird - Restaurant Management Software",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Restaurant Management Software for POS & Operations | Resto Bird",
    description:
      "Unified restaurant management software with sub-second KDS, recipe depletion, shift scheduling, and automated payroll.",
    images: ["/resto-bird-logo.png"],
    creator: "@restobird",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/resto-bird-flaticon.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/resto-bird-flaticon.png",
    apple: "/resto-bird-flaticon.png",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Resto Bird",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web, iOS, Android",
      "headline": "Restaurant Management Software for POS & Operations",
      "description":
        "Unified restaurant management software providing real-time POS, sub-second kitchen display routing, recipe inventory depletion, staff scheduling, and payroll.",
      "url": "https://restobird.com",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "49",
        "highPrice": "199",
        "offerCount": "3",
        "priceSpecification": {
          "@type": "UnitPriceSpecification",
          "price": "49",
          "priceCurrency": "USD",
          "unitText": "MONTH",
          "name": "Single Outlet Core Operations",
        },
      },
    },
    {
      "@type": "Organization",
      "name": "Resto Bird",
      "url": "https://restobird.com",
      "logo": "https://restobird.com/resto-bird-logo.png",
      "image": "https://restobird.com/resto-bird-flaticon.png",
      "slogan": "See your restaurant differently",
    },
    {
      "@type": "WebSite",
      "name": "Resto Bird",
      "url": "https://restobird.com",
      "description": "Restaurant Management Software for POS & Operations",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/resto-bird-flaticon.png?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/resto-bird-flaticon.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/resto-bird-flaticon.png?v=2" />
        <link rel="shortcut icon" href="/favicon.ico?v=2" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
