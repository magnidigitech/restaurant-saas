import { Metadata } from "next";
import AboutClient from "@/components/about/AboutClient";

export const metadata: Metadata = {
  title: "About RestoBird | Restaurant Technology Company",
  description: "Learn about RestoBird's mission to make restaurant operations simpler, connected, and easier to control.",
  openGraph: {
    title: "About RestoBird | Restaurant Technology Company",
    description: "Learn about RestoBird's mission.",
    url: "https://restobird.com/about",
  },
};

export default function AboutPage() {
  return <AboutClient />;
}
