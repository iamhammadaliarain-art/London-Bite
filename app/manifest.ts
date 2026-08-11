import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "London Bite",
    short_name: "London Bite",
    description: "Order London Bite favourites for delivery or pickup and track the order journey.",
    start_url: "/order?view=home",
    display: "standalone",
    background_color: "#f4f6f3",
    theme_color: "#07182f",
    orientation: "portrait",
    icons: [
      { src: "/brand/london-bite-logo.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/brand/london-bite-logo.png", sizes: "any", type: "image/png", purpose: "maskable" },
    ],
  };
}
