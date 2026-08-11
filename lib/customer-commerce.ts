export type FulfilmentMode = "delivery" | "pickup";
export type CustomerView = "home" | "menu" | "cart" | "checkout" | "confirmation" | "track" | "history" | "account";

export type CustomerProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  badge?: string;
  image: string;
  popular?: boolean;
};

export const londonBiteFacts = {
  name: "London Bite",
  tagline: "Every Bite is a London Story",
  area: "Commercial Area, Faisal Block, SA Gardens Phase 2",
  whatsappLabel: "+92 308 4809377",
  whatsappUrl: "https://wa.me/923084809377",
  instagramUrl: "https://www.instagram.com/londonbiteofficial/",
  googleBusinessUrl: "https://share.google/T3mX6OuyZGvbx3al6",
  catalogSource: "Existing London-Bite repository catalog seed",
} as const;

const gallery = {
  hero: "https://framerusercontent.com/images/Mpi1SJftXEd6dCco3YrAdP5lPSI.png?height=1024&width=1536",
  square: "https://framerusercontent.com/images/zWGcC9OQe50mdAA9GFb4dDehQ.png?height=1024&width=1024",
  wide: "https://framerusercontent.com/images/7hHaPgCVN6K8xFJ1CiYvWJBL0lk.png?height=1024&width=1536",
  wideTwo: "https://framerusercontent.com/images/4l2aBJRxrod9MzTtKlzvrWZxk.png?height=1024&width=1536",
  wideThree: "https://framerusercontent.com/images/2qrd7mgW022iN2qcCdKkbihSrI.png?height=1024&width=1536",
} as const;

export const customerProducts: CustomerProduct[] = [
  { id: "fillet", slug: "fillet-burger", name: "Fillet Burger", category: "Burgers", description: "Crispy chicken fillet, fresh crunch and London Bite house flavour.", price: 399, badge: "Classic", image: gallery.square, popular: true },
  { id: "peri", slug: "peri-peri-burger", name: "Peri Peri Burger", category: "Burgers", description: "A bold peri peri chicken burger with a warm, spicy finish.", price: 699, badge: "Spicy", image: gallery.hero, popular: true },
  { id: "tower", slug: "tower-burger", name: "Tower Burger", category: "Burgers", description: "A stacked signature burger built for a bigger appetite.", price: 899, badge: "Signature", image: gallery.wide, popular: true },
  { id: "pizza-classic", slug: "classic-pizza", name: "Classic Pizza", category: "Pizza", description: "A comfort-first pizza with a familiar London Bite finish.", price: 599, image: gallery.wideTwo },
  { id: "pizza-premium", slug: "premium-pizza", name: "Premium Pizza", category: "Pizza", description: "A richer pizza build for sharing, with premium toppings and cheese.", price: 1449, badge: "Share", image: gallery.wideThree, popular: true },
  { id: "broast", slug: "quarter-broast", name: "Quarter Broast", category: "Fried", description: "Crunchy fried chicken with a juicy centre and savoury seasoning.", price: 799, image: gallery.square },
  { id: "paratha", slug: "pizza-paratha", name: "Pizza Paratha", category: "Sides", description: "A quick, crispy fusion bite for snack cravings.", price: 550, image: gallery.wide },
  { id: "wings", slug: "wings-10-pcs", name: "Wings 10 pcs", category: "Sides", description: "Ten wings made for sharing or turning into a full meal.", price: 699, badge: "10 pcs", image: gallery.wideTwo },
];

export const customerCategories = ["All", ...Array.from(new Set(customerProducts.map((item) => item.category)))] as const;

export const popularProducts = customerProducts.filter((item) => item.popular);

export const money = (value: number) => `Rs ${Math.round(value).toLocaleString("en-PK")}`;

export const analyticsEventNames = [
  "landing_view",
  "order_app_opened",
  "menu_view",
  "search_used",
  "product_view",
  "add_to_cart",
  "cart_view",
  "checkout_started",
  "fulfilment_changed",
  "order_preview_created",
  "tracking_view",
  "reorder_clicked",
  "support_opened",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];
