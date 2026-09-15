import { Metadata } from "next";
import PricingClient from "@/components/pricing/PricingClient";

export const metadata: Metadata = {
  title: "RestoBird Pricing | Restaurant Management Software",
  description: "Explore RestoBird transparent pricing plans for single-outlet restaurants, multi-location chains, and franchise networks.",
  openGraph: {
    title: "RestoBird Pricing | Restaurant Management Software",
    description: "Explore RestoBird transparent pricing plans.",
    url: "https://restobird.com/pricing",
  },
};

export default function PricingPage() {
  return <PricingClient />;
}
