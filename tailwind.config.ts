import type { Config } from 'tailwindcss';

/**
 * BrandVault Tailwind config.
 *
 * Tailwind is layered ALONGSIDE the existing CSS Modules (see CLAUDE.md):
 *   - Existing components keep their .module.css — do not migrate them.
 *   - All NEW components use these Tailwind utilities.
 *   - Never mix the two approaches within a single component.
 *
 * Preflight (Tailwind's global base reset) is disabled on purpose: the
 * existing CSS-Module components rely on browser defaults and there is no
 * global stylesheet, so a global reset would visually regress them. Tailwind
 * therefore emits only the utilities we actually use. New components handle
 * their own box-sizing / margin reset locally.
 *
 * Colour tokens below are extracted from the existing CSS Modules and
 * lib/utils.ts (BADGE_COLORS, getStatusStyle, getDaysBadgeStyle) so new
 * Tailwind components stay visually consistent with the current dashboard.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Bree's identity accent (indigo) — used only for Bree UI (toggle,
        // panel header, response marks) so she reads consistently with Slack.
        bree: '#4F46E5',
        'bree-hover': '#4338CA',
        // Platform-admin (operator) chrome — its own deep navy/blue-black so
        // founder/operator tooling reads as distinct from product UI. Chosen to
        // NOT collide with the Bree indigo above, and not to be a stock slate.
        admin: '#101C3A',
        // Warm-grey neutrals (the Notion-style base used across the dashboard)
        ink: {
          DEFAULT: '#37352f', // primary text
          muted: '#9b9a97',   // secondary / meta text
          subtle: '#c4c4c0',  // disabled / faint text
        },
        surface: {
          DEFAULT: '#ffffff', // cards, panels
          subtle: '#fbfbfa',
          muted: '#f7f6f5',
          sunken: '#f0efec',  // insets, hover fills
        },
        line: {
          DEFAULT: '#e8e5e0', // default borders / dividers
          strong: '#d3d1cb',
        },
        // Brand accent (also BADGE_COLORS[0])
        brand: {
          DEFAULT: '#2e6b8a',
        },
        // Status semantics — mirrors getStatusStyle() in lib/utils.ts
        status: {
          registered: '#0f7b6c',
          pending: '#f2994a',
          published: '#2e6b8a',
          expired: '#eb5757',
        },
        // Deadline urgency — mirrors getDaysBadgeStyle() thresholds
        urgency: {
          critical: '#eb5757', // <= 90 days
          warning: '#f2994a',  // <= 180 days
          ok: '#0f7b6c',       // <= 365 days
        },
        // Trademark-family badge palette — mirrors BADGE_COLORS in lib/utils.ts
        badge: {
          1: '#2e6b8a',
          2: '#6940a5',
          3: '#0f7b6c',
          4: '#c4823f',
          5: '#8b5e3c',
          6: '#5a7d5a',
          7: '#b85450',
          8: '#4a6fa5',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
