# London Bite UI Design System

## Locked visual direction

London Bite uses an **iOS-inspired glassmorphism system** on web and tablet interfaces.

Rules:

- Use the original London Bite logo from `public/brand/london-bite-logo.png`. Do not redraw, recolor or replace it with initials.
- No black/dark background theme. Base surfaces stay bright, clean and premium.
- Use frosted glass for navigation, top bars, cards, drawers and important controls: translucent light surfaces, `backdrop-blur`, thin white borders and soft shadows.
- Glass is a hierarchy tool, not decoration. Keep text contrast high and avoid stacking multiple low-contrast glass layers.
- Use iOS-like geometry: generous 14–30px corner radii, pill status controls, restrained depth and smooth hover/press transitions.
- Preserve London Bite brand accents: navy `#07182f`, blue `#0e4a86`, red `#d71f2b`, green `#167a4c`.
- Functional state colors take priority over brand accents for success, warning and destructive states.
- Mobile/tablet touch targets should be comfortably tappable and layouts must degrade to one column without losing controls.

## Styling stack

Tailwind CSS v4 is the standard styling layer through `@tailwindcss/postcss`. Brand design tokens are defined in `app/globals.css` with `@theme`, which exposes utilities such as `bg-lb-navy`, `text-lb-blue` and `border-lb-red`.
