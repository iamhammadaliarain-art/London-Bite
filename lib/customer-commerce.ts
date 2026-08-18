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
  catalogSource: "London Bite official printed menu · August 2026",
} as const;

const menuImage = (slug: string) => `/menu/${slug}.webp`;

const item = (
  slug: string,
  name: string,
  category: string,
  description: string,
  price: number,
  imageSlug = slug,
  badge?: string,
  popular = false,
): CustomerProduct => ({ id: slug, slug, name, category, description, price, image: menuImage(imageSlug), badge, popular });

const sized = (
  imageSlug: string,
  name: string,
  category: string,
  description: string,
  prices: readonly (readonly [string, number])[],
  options: { badge?: string; popular?: boolean } = {},
) => prices.map(([size, price], index) => item(
  `${imageSlug}-${size.toLowerCase().replaceAll(" ", "-")}`,
  `${name} · ${size}`,
  category,
  description,
  price,
  imageSlug,
  size,
  Boolean(options.popular && index === 0),
));

const classicPizzaSizes = [["Small", 649], ["Medium", 1050], ["Large", 1550], ["Family", 2050]] as const;
const specialPizzaSizes = [["Small", 699], ["Medium", 1190], ["Large", 1729], ["Family", 2229]] as const;
const premiumPizzaSizes = [["Medium", 1450], ["Large", 2050], ["Family", 2650]] as const;

export const customerProducts: CustomerProduct[] = [
  item("quarter-broast", "Quarter Broast", "Broast", "Crispy pressure-fried chicken served with golden fries, soft buns and signature red sauce.", 799, "quarter-broast", "Quarter", true),
  item("half-broast", "Half Broast", "Broast", "Half chicken in a craggy seasoned coating with fries, soft buns and signature red sauce.", 1499, "half-broast", "Half"),
  item("full-broast", "Full Broast", "Broast", "A full sharing portion of juicy crispy chicken with fries, soft buns and signature red sauce.", 2699, "full-broast", "Full"),

  item("peri-peri-wings-5pc", "Peri Peri Wings · 5 pcs", "Peri Peri", "Chicken wings coated in a tangy chilli, garlic and citrus peri peri glaze.", 550, "peri-peri-wings-5pc", "5 pcs", true),
  item("peri-peri-wings-10pc", "Peri Peri Wings · 10 pcs", "Peri Peri", "Ten chicken wings coated in a tangy chilli, garlic and citrus peri peri glaze.", 999, "peri-peri-wings-10pc", "10 pcs"),
  item("peri-peri-strips-5pc", "Peri Peri Strips · 5 pcs", "Peri Peri", "Five tender chicken strips seasoned with smoky peri peri chilli, garlic and herbs.", 499, "peri-peri-strips", "5 pcs"),

  item("peri-peri-burger", "Peri Peri Burger", "Premium Burgers", "Grilled peri peri chicken, lettuce, tomato and creamy chilli sauce in a toasted sesame bun.", 599, "peri-peri-burger", "Spicy", true),
  item("pizza-burger", "Pizza Burger", "Premium Burgers", "Crispy chicken layered with mozzarella, pizza sauce, olives and herbs in a toasted bun.", 549, "pizza-burger", "Fusion"),
  item("mighty-burger", "Mighty Burger", "Premium Burgers", "A tall crispy chicken stack with cheddar, lettuce, tomato, onion and house sauce.", 699, "mighty-burger", "Loaded"),
  item("beef-burger-single", "Beef Burger · Single Patty", "Premium Burgers", "Chargrilled beef patty with cheddar, lettuce, tomato, onion and burger sauce.", 799, "beef-burger-single", "Single"),
  item("beef-burger-double", "Beef Burger · Double Patty", "Premium Burgers", "Two chargrilled beef patties with cheddar, lettuce, tomato, onion and burger sauce.", 1099, "beef-burger-double", "Double"),
  item("zinger-burger", "Zinger Burger", "Classic Burgers", "Crispy marinated chicken fillet with lettuce and creamy mayonnaise in a sesame bun.", 399, "zinger-burger", "Classic", true),
  item("mexican-fillet-burger", "Mexican Fillet Burger", "Classic Burgers", "Crispy chicken fillet with jalapeño-style heat, lettuce, tomato and spicy cheese sauce.", 449, "mexican-fillet-burger", "Spicy"),
  item("chicken-patty-burger", "Chicken Patty Burger", "Classic Burgers", "Seasoned chicken patty with lettuce, tomato and mayonnaise in a toasted sesame bun.", 350, "chicken-patty-burger", "Single"),
  item("double-patty-burger", "Double Patty Burger", "Classic Burgers", "Two crispy chicken patties with cheese, lettuce and creamy sauce.", 650, "double-patty-burger", "Double"),
  item("lebanese-kebab-burger", "Lebanese Kebab Burger", "Classic Burgers", "Spiced kebab patty with cabbage, onion, tomato, herbs and garlic sauce.", 399, "lebanese-kebab-burger", "Kebab"),
  item("zinger-spicy-burger", "Zinger Spicy Burger", "Classic Burgers", "Crispy chicken fillet with lettuce and a bold red chilli sauce.", 449, "zinger-spicy-burger", "Hot"),

  ...sized("tikka-pizza", "Tikka Pizza", "Classic Pizza", "Mozzarella pizza topped with smoky chicken tikka, onion, capsicum, tomato and olives.", classicPizzaSizes, { popular: true }),
  ...sized("fajita-pizza", "Fajita Pizza", "Classic Pizza", "Mozzarella pizza with fajita-spiced chicken, onion, capsicum and olives.", classicPizzaSizes),
  ...sized("supreme-pizza", "Supreme Pizza", "Classic Pizza", "Loaded mozzarella pizza with chicken, capsicum, onion, tomato, olives and herbs.", classicPizzaSizes),
  ...sized("veggie-lover-pizza", "Veggie Lover Pizza", "Classic Pizza", "Mozzarella pizza with mushrooms, sweetcorn, capsicum, onion, tomato and olives.", classicPizzaSizes),
  ...sized("mughlai-pizza", "Mughlai Pizza", "Classic Pizza", "Creamy Mughlai chicken pizza with mozzarella, onion, capsicum and aromatic spices.", classicPizzaSizes),

  ...sized("malai-boti-pizza", "Malai Boti Pizza", "Special Pizza", "Creamy malai chicken boti, mozzarella, onion, capsicum and herbs.", specialPizzaSizes, { popular: true }),
  ...sized("creamy-pizza", "Creamy Pizza", "Special Pizza", "Chicken and mozzarella on a creamy white base finished with a savoury sauce drizzle.", specialPizzaSizes),
  ...sized("afghani-pizza", "Afghani Pizza", "Special Pizza", "Afghani-style creamy chicken, mozzarella, onion and a garlic sauce swirl.", specialPizzaSizes),
  ...sized("kebab-pizza", "Kebab Pizza", "Special Pizza", "Spiced kebab pieces, mozzarella, onion, capsicum and creamy garlic sauce.", specialPizzaSizes),

  ...sized("crown-crust-pizza", "Crown Crust Pizza", "Premium Pizza", "A crown-shaped stuffed crust surrounding chicken, mozzarella, capsicum, tomato and olives.", premiumPizzaSizes, { popular: true }),
  ...sized("kebab-crust-pizza", "Kebab Crust Pizza", "Premium Pizza", "Kebab-filled crust with mozzarella, chicken, capsicum, onion, tomato and olives.", premiumPizzaSizes),
  ...sized("cheese-crust-pizza", "Cheese Crust Pizza", "Premium Pizza", "Cheese-stuffed crust with rich tomato sauce, mozzarella and savoury chicken toppings.", premiumPizzaSizes),
  ...sized("super-supreme-pizza", "Super Supreme Pizza", "Premium Pizza", "A fully loaded mozzarella pizza with chicken, mushrooms, capsicum, onion, tomato and olives.", premiumPizzaSizes),
  item("london-bite-special-pizza-large", "London Bite Special Pizza · Large", "Signature Pizza", "The house signature pizza with mozzarella, chicken, mushrooms, capsicum, tomato, jalapeño and olives.", 2399, "london-bite-special-pizza", "Large", true),
  item("london-bite-special-pizza-family", "London Bite Special Pizza · Family", "Signature Pizza", "A family-size house signature pizza with mozzarella, chicken, mushrooms, capsicum, tomato, jalapeño and olives.", 2799, "london-bite-special-pizza", "Family"),

  item("zingeratha", "Zingeratha", "Wraps", "Crispy zinger chicken, lettuce and creamy sauce wrapped in a flaky paratha.", 349, "zingeratha", "Classic"),
  item("spicy-zingeratha", "Spicy Zingeratha", "Wraps", "Crispy zinger chicken, lettuce and spicy chilli sauce in a flaky paratha.", 399, "spicy-zingeratha", "Spicy"),
  item("loaded-wrap", "Loaded Wrap", "Wraps", "A loaded tortilla wrap with seasoned chicken, fries, lettuce, onion and creamy sauce.", 590, "loaded-wrap", "Loaded", true),
  item("bbq-wrap", "BBQ Wrap", "Wraps", "Smoky barbecue chicken, lettuce, onion and creamy sauce in a toasted tortilla.", 649, "bbq-wrap", "BBQ"),
  item("peri-peri-grill-wrap", "Peri Peri Grill Wrap", "Wraps", "Grilled peri peri chicken, crunchy vegetables and chilli-garlic sauce in a toasted tortilla.", 749, "peri-peri-grill-wrap", "Grilled"),
  item("junior-bite", "The Junior Bite", "Kids Meal", "Chicken patty burger with four chicken nuggets, small fries and a small juice.", 649, "junior-bite", "Kids"),

  item("salsa-wings-5pc", "Salsa Wings · 5 pcs", "Sidekicks", "Five chicken wings tossed in a bright tomato, chilli and herb salsa glaze.", 450, "salsa-wings", "5 pcs"),
  item("salsa-wings-10pc", "Salsa Wings · 10 pcs", "Sidekicks", "Ten chicken wings tossed in a bright tomato, chilli and herb salsa glaze.", 700, "salsa-wings", "10 pcs"),
  item("crispy-wings-5pc", "Crispy Wings · 5 pcs", "Sidekicks", "Five seasoned chicken wings in a crunchy golden coating.", 350, "crispy-wings", "5 pcs"),
  item("crispy-wings-10pc", "Crispy Wings · 10 pcs", "Sidekicks", "Ten seasoned chicken wings in a crunchy golden coating.", 600, "crispy-wings", "10 pcs"),
  item("chicken-nuggets-5pc", "Chicken Nuggets · 5 pcs", "Sidekicks", "Five bite-size breaded chicken nuggets, fried until golden.", 300, "chicken-nuggets", "5 pcs"),
  item("chicken-nuggets-10pc", "Chicken Nuggets · 10 pcs", "Sidekicks", "Ten bite-size breaded chicken nuggets, fried until golden.", 580, "chicken-nuggets", "10 pcs"),
  item("injected-nuggets-5pc", "Injected Nuggets · 5 pcs", "Sidekicks", "Five crisp chicken nuggets with a molten cheese-filled centre.", 499, "injected-nuggets", "5 pcs"),
  item("injected-nuggets-10pc", "Injected Nuggets · 10 pcs", "Sidekicks", "Ten crisp chicken nuggets with a molten cheese-filled centre.", 999, "injected-nuggets", "10 pcs"),
  item("kabab-bites-4pc", "Kabab Bites · 4 pcs", "Sidekicks", "Four juicy spiced chicken kebab bites with herbs and chilli.", 599, "kabab-bites", "4 pcs"),
  item("love-bites-10pc", "Love Bites · 10 pcs", "Sidekicks", "Ten heart-shaped chicken and cheese bites in a crisp golden coating.", 399, "love-bites", "10 pcs"),
  item("chicken-strips-4pc", "Chicken Strips · 4 pcs", "Sidekicks", "Four tender chicken breast strips in a crunchy seasoned coating.", 399, "chicken-strips", "4 pcs"),
  item("spring-roll", "Spring Roll", "Sidekicks", "Crisp fried rolls filled with seasoned vegetables and chicken-style savoury filling.", 699, "spring-roll"),
  item("italian-pasta", "Italian Pasta", "Sidekicks", "Penne pasta in a tomato and herb sauce with chicken, capsicum and melted cheese.", 699, "italian-pasta"),

  item("classic-fries-medium", "Classic Fries · Medium", "Fries", "Medium portion of crisp golden salted fries.", 250, "classic-fries", "Medium"),
  item("classic-fries-large", "Classic Fries · Large", "Fries", "Large portion of crisp golden salted fries.", 350, "classic-fries", "Large"),
  item("london-masala-fries", "London Masala Fries", "Fries", "Golden fries tossed in London Bite's warm chilli, cumin and savoury masala seasoning.", 350, "london-masala-fries"),
  item("cheesy-fries", "Cheesy Fries", "Fries", "Crisp fries covered with warm creamy cheese sauce.", 449, "cheesy-fries"),
  item("loaded-fries", "Loaded Fries", "Fries", "Fries loaded with seasoned chicken, cheese sauce, jalapeño, onion and house sauce.", 699, "loaded-fries", "Loaded", true),

  item("peri-peri-sauce", "Peri Peri Sauce", "Sauces", "Tangy chilli, garlic, citrus and herb peri peri dipping sauce.", 100, "peri-peri-sauce"),
  item("special-sauce", "Special Sauce", "Sauces", "Creamy house dip made with mayonnaise, ketchup, mustard and chopped pickle.", 100, "special-sauce"),
  item("garlic-mayo", "Garlic Mayo", "Sauces", "Smooth mayonnaise blended with roasted garlic and light seasoning.", 100, "garlic-mayo"),
  item("tango-sauce", "Tango Sauce", "Sauces", "Sweet-spicy citrus sauce with a bright tangy finish.", 100, "tango-sauce"),
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
