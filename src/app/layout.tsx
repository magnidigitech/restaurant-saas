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
    default: "Resto Bird (@getrestobird) | Restaurant Management Software & Operating System",
    template: "%s | Resto Bird (@getrestobird)",
  },
  description:
    "Resto Bird (@getrestobird / getrestobird.com) is the unified restaurant management software & operating system. POS integrations (Toast, Square, Clover), sub-second KDS, recipe inventory depletion, shift scheduling, automated payroll & menu engineering analytics.",
  applicationName: "Resto Bird",
  keywords: [
    "getrestobird",
    "@getrestobird",
    "Resto Bird",
    "RestoBird",
    "restobird.com",
    "get restobird",
    "getrestobird gmail",
    "getrestobird phone",
    "restaurant management software",
    "restaurant POS software",
    "kitchen display system",
    "restaurant inventory software",
    "recipe costing software",
    "restaurant scheduling software",
    "restaurant payroll software",
    "unified restaurant operating system",
  ],
  authors: [{ name: "Resto Bird Inc.", url: "https://restobird.com" }],
  creator: "@getrestobird",
  publisher: "Resto Bird Inc.",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://restobird.com"
  ),
  alternates: {
    canonical: "https://restobird.com",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },

  openGraph: {
    title: "Resto Bird (@getrestobird) | Restaurant Management Software & Operating System",
    description:
      "Resto Bird (@getrestobird) is the unified restaurant operating system. Front-of-house POS integrations (Toast, Square, Clover), sub-second KDS, gram-level recipe depletion & automated payroll.",
    url: "https://restobird.com",
    siteName: "Resto Bird - @getrestobird",
    images: [
      {
        url: "/resto-bird-logo.png",
        width: 1200,
        height: 630,
        alt: "Resto Bird (@getrestobird) - Unified Restaurant Management Software",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Resto Bird (@getrestobird) | Restaurant Management Software",
    description:
      "Unified restaurant operating system by Resto Bird (@getrestobird). Connect POS, sub-second KDS, recipe inventory depletion & automated payroll.",
    images: ["/resto-bird-logo.png"],
    creator: "@getrestobird",
    site: "@getrestobird",
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
      "@id": "https://restobird.com/#software",
      "name": "Resto Bird",
      "alternateName": ["RestoBird", "getrestobird", "@getrestobird", "Resto Bird OS"],
      "applicationCategory": "BusinessApplication, RestaurantManagementSoftware",
      "operatingSystem": "Web, iOS, Android, POS Tablets",
      "headline": "Restaurant Management Software & Unified Operating System",
      "description":
        "Resto Bird (@getrestobird) is the unified restaurant operating system connecting Toast, Square, and Clover POS with sub-second kitchen display routing, gram-level recipe depletion, shift scheduling, and automated payroll.",
      "url": "https://restobird.com",
      "logo": "https://restobird.com/resto-bird-logo.png",
      "sameAs": [
        "https://www.facebook.com/getrestobird",
        "https://www.instagram.com/getrestobird/",
        "https://x.com/getrestobird",
        "https://in.pinterest.com/getrestobird/",
        "https://www.producthunt.com/@getrestobird"
      ],
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
      "publisher": {
        "@type": "Organization",
        "@id": "https://restobird.com/#organization"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://restobird.com/#organization",
      "name": "Resto Bird",
      "legalName": "Resto Bird Inc.",
      "alternateName": ["getrestobird", "@getrestobird", "RestoBird"],
      "url": "https://restobird.com",
      "logo": "https://restobird.com/resto-bird-logo.png",
      "image": "https://restobird.com/resto-bird-flaticon.png",
      "slogan": "See your restaurant differently",
      "email": "getrestobird@gmail.com",
      "telephone": "+1-818-497-4588",
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "telephone": "+1-818-497-4588",
          "email": "getrestobird@gmail.com",
          "contactType": "customer service",
          "contactOption": "TollFree",
          "availableLanguage": ["English", "Spanish", "Hindi"]
        }
      ],
      "sameAs": [
        "https://www.facebook.com/getrestobird",
        "https://www.instagram.com/getrestobird/",
        "https://x.com/getrestobird",
        "https://in.pinterest.com/getrestobird/",
        "https://www.producthunt.com/@getrestobird"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://restobird.com/#website",
      "name": "Resto Bird",
      "alternateName": ["getrestobird", "getrestobird.com", "@getrestobird"],
      "url": "https://restobird.com",
      "description": "Resto Bird (@getrestobird) Official Website - Restaurant Management Software for POS & Operations",
      "publisher": {
        "@type": "Organization",
        "@id": "https://restobird.com/#organization"
      }
    },
    {
      "@type": "Brand",
      "@id": "https://restobird.com/#brand",
      "name": "Resto Bird",
      "alternateName": ["getrestobird", "@getrestobird", "RestoBird"],
      "url": "https://restobird.com",
      "logo": "https://restobird.com/resto-bird-logo.png",
      "sameAs": [
        "https://www.facebook.com/getrestobird",
        "https://www.instagram.com/getrestobird/",
        "https://x.com/getrestobird",
        "https://in.pinterest.com/getrestobird/",
        "https://www.producthunt.com/@getrestobird"
      ]
    }
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

