import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Resto Bird - Restaurant Management Software & Operating System",
    short_name: "Resto Bird",
    description:
      "Unified restaurant operating system with POS integrations, sub-second KDS, gram-level recipe depletion, shift scheduling, and automated payroll.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#0F172A",
    icons: [
      {
        src: "/resto-bird-flaticon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/resto-bird-flaticon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
