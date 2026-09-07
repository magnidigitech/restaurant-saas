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
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Resto Bird | See Your Restaurant Differently",
    template: "%s | Resto Bird",
  },
  description:
    "See your restaurant differently. Resto Bird is the intelligent restaurant operating system providing real-time bird's-eye visibility across dining room, kitchen line, and inventory operations.",
  applicationName: "Resto Bird",
  keywords: [
    "Resto Bird",
    "See your restaurant differently",
    "restaurant management system",
    "restaurant operating intelligence",
    "kitchen display system",
    "restaurant POS",
    "inventory depletion",
    "recipe costing",
    "multi-outlet restaurant software",
    "restaurant ERP",
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
    title: "Resto Bird | See Your Restaurant Differently",
    description:
      "See your restaurant differently. Real-time operating intelligence and unified bird's-eye visibility across floor, kitchen, and inventory.",
    url: "/",
    siteName: "Resto Bird",
    images: [
      {
        url: "/resto-bird-logo.png",
        width: 1200,
        height: 630,
        alt: "Resto Bird - See Your Restaurant Differently",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Resto Bird | See Your Restaurant Differently",
    description:
      "See your restaurant differently. Unified restaurant operating system with bird's-eye intelligence across floor, kitchen, and inventory.",
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
      "headline": "See Your Restaurant Differently",
      "description":
        "The intelligent restaurant operating system that gives you a complete bird's-eye view across kitchen, inventory, and floor operations.",
      "url": "https://restobird.com",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
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
      "description": "See your restaurant differently with Resto Bird",
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
