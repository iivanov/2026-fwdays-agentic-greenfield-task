---
name: Sophisticated Newsroom
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#45464d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00174b'
  on-tertiary-container: '#497cff'
  error: '#DC2626'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  success: '#059669'
  warning: '#D97706'
  border-muted: '#E2E8F0'
  ink-dark: '#020617'
typography:
  headline-xl:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-xl-mobile:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is built on the "Sophisticated Newsroom" aesthetic, bridging the gap between traditional broadsheet authority and modern digital efficiency. It targets professionals who require high-density information without the cognitive load of typical "ad-heavy" news sites. 

The personality is **authoritative, precise, and editorial**. The UI evokes a sense of trust through structured layouts and deliberate typography. We utilize a **Modern Corporate** style with a focus on:
- **High-Contrast Editorial Typography:** Utilizing serif headers to anchor the eye and sans-serif body text for high-speed scanning.
- **Data Density Management:** Leveraging generous whitespace and clear structural borders to organize complex AI-generated digests and multi-source flows.
- **Utilitarian Elegance:** Subtle shadows and crisp lines that suggest a physical "printed" quality translated into a digital medium.

## Colors

The palette is rooted in a "Trustworthy Navy" and "Slate Gray" foundation to establish a professional atmosphere. 

- **Primary (#0F172A):** A deep navy used for core brand elements, navigation, and primary headings. It provides the "anchor" for the layout.
- **Secondary (#334155):** A cool slate used for subheadings, metadata, and supporting UI elements.
- **Tertiary/Action (#2563EB):** A vibrant blue reserved exclusively for high-priority calls to action (CTAs), active states, and interactive flow controls.
- **Neutral (#F8FAFC):** A crisp, near-white background that ensures maximum readability and a clean "canvas" feel.

**Status Colors:**
- **Success:** Forest green for healthy flow runs.
- **Warning:** Amber for paused sources or exhausted quotas.
- **Error:** Crimson for delivery failures or authentication issues.

## Typography

This system employs a tripartite typography strategy to balance editorial flair with technical precision.

1.  **Headlines (Source Serif 4):** Chosen for its classic newsprint heritage. It commands attention and lends an air of verified truth to AI-generated summaries.
2.  **Body (Inter):** A systematic, highly legible sans-serif designed for screens. It handles long-form digests and densified dashboards with ease.
3.  **Labels & Metadata (JetBrains Mono):** Used for technical metadata (source URLs, timestamps, delivery channel IDs). The monospaced nature emphasizes the "processed" and "systematic" aspect of the AI-powered engine.

**Scaling Rules:**
On mobile devices, `headline-xl` should downscale to `headline-xl-mobile` to maintain layout integrity while preserving the high-contrast aesthetic.

## Layout & Spacing

The design system utilizes a **Fixed Grid** model for desktop to maintain the feel of a structured newspaper column, transitioning to a **Fluid Grid** for mobile devices.

- **Grid System:** A 12-column grid on desktop (max-width 1280px) with 24px gutters. Content is typically grouped into 8-column primary news feeds and 4-column "Flow Controls" or "Source Health" sidebars.
- **Rhythm:** An 8px base unit drives all padding and margins. Vertical rhythm is strictly enforced to ensure that even with high data density, the UI feels organized.
- **Mobile Adaptivity:** At the 768px breakpoint, the layout collapses into a single-column stack. Margins reduce to 16px to maximize horizontal space for text.
- **White Space:** Generous "safe zones" (stack-lg) are used between distinct content sections (e.g., separating the Morning Digest from the Flow Management panel) to prevent cognitive overload.

## Elevation & Depth

To maintain a "Professional/Modern" feel, the system avoids heavy drop shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Surface Levels:** 
    - Level 0 (Background): #F8FAFC
    - Level 1 (Cards/Containers): #FFFFFF with a 1px border (#E2E8F0).
    - Level 2 (Modals/Popovers): #FFFFFF with a subtle "Ambient Shadow" (0px 4px 20px rgba(15, 23, 42, 0.08)).
- **Depth Cues:** Depth is primarily communicated through the layering of white cards against the light-gray neutral background. 
- **Borders:** Every container uses a crisp 1px border. This reinforces the "grid-like" structure of a newsroom and helps define boundaries without needing aggressive shadows.

## Shapes

The shape language is **Soft (0.25rem)**. This subtle rounding provides a modern touch while maintaining a serious, professional profile. 

- **Primary Elements:** Buttons and Input fields use a 4px corner radius.
- **Large Containers:** Dashboard cards and digest wrappers use `rounded-lg` (8px).
- **Status Indicators:** "Flow Health" pips or delivery channel icons may use 100% rounding (circles) to differentiate them from functional UI components.

## Components

- **Buttons:** 
    - *Primary:* Solid Navy (#0F172A) with white text. High contrast, sharp focus.
    - *Action:* Solid Blue (#2563EB) for "Run Flow Now" or "Add Source."
- **Digest Cards:** High-contrast white backgrounds with a subtle border. Headline (Serif) at the top, followed by a JetBrains Mono "Source" tag, then the Inter body text.
- **Source Health Chips:** Utilize status colors (Success/Warning/Error) as a subtle background tint with dark text. 
- **Input Fields:** Minimalist design with a 1px slate-gray border. Focus states use the action-blue border and a zero-blur glow.
- **Delivery Channel Icons:** Icons for Telegram, Slack, Webhook, and Email should be encased in a subtle light-gray circular background to standardize their visual footprint within the Flow Configuration panel.
- **Feedback Toggles:** Thumbs up/down buttons use low-opacity gray backgrounds that shift to primary navy/blue when active.
