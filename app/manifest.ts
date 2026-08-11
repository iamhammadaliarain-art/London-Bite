import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/order",
    name: "London Bite",
    short_name: "London Bite",
    description: "Order London Bite favourites for delivery or pickup and track the order journey.",
    start_url: "/order?view=home&utm_source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#f4f7fb",
    theme_color: "#07182f",
    orientation: "portrait-primary",
    categories: ["food", "shopping", "lifestyle"],
    shortcuts: [
      { name: "Start an order", short_name: "Order", description: "Open the London Bite menu", url: "/order?view=menu&utm_source=pwa_shortcut" },
      { name: "Track order", short_name: "Track", description: "Check your live order status", url: "/order?view=track&utm_source=pwa_shortcut" },
      { name: "Reorder", short_name: "Reorder", description: "Open your saved order history", url: "/order?view=history&utm_source=pwa_shortcut" },
    ],
    icons: [
      { src: "/brand/london-bite-logo.png", sizes: "any", type: "image/png", purpose: "any" },
      { src: "/brand/london-bite-logo.png", sizes: "any", type: "image/png", purpose: "maskable" },
    ],
  };
}
