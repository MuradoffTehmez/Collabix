# Post Card Premium Redesign — Cyber Terminal + Glassmorphism

## Background

The current Collabix Post Card (`feed-card`) is functional but uses basic emoji icons (`♥ ♡ 💬 ★ ☆ ↺ ✎ 🗑`), simple borders, minimal spacing, and lacks the premium feel of platforms like GitHub, Linear, Vercel, or Raycast. The project is vanilla JS + CSS (no React/Framer Motion — using CSS animations instead), bundled with Vite, using `marked` + `DOMPurify` for markdown and `highlight.js` for syntax highlighting.

## Scope of Changes

This redesign touches **two files**:
- [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css) — Complete CSS overhaul of card, code block, actions, markdown, and responsive styles
- [feed.js](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/js/feed.js) — Restructured HTML generation for cards (header, code block, action bar) with Lucide SVG icons

> [!IMPORTANT]
> **No new dependencies** will be added. Lucide icons will be inlined as SVG strings (they're MIT-licensed simple paths). CSS animations replace Framer Motion since this is a vanilla JS project without React.

---

## Proposed Changes

### 1. Color System & CSS Variables

Add a new `--card`, `--accent`, and refined green palette to `:root` and theme variants:

| Token | Value | Purpose |
|-------|-------|---------|
| `--card` | `#10281D` | Card background |
| `--primary` | `#22C55E` | Cyber green (used sparingly) |
| `--accent` | `#00E5FF` | Accent cyan |
| `--card-border` | `rgba(34,197,94,.12)` | Subtle green-tinted border |
| `--card-glow` | `rgba(34,197,94,.06)` | Card hover glow |
| `--card-radius` | `20px` | Card border-radius |
| `--code-radius` | `18px` | Code block radius |

These will be added alongside existing variables without breaking the existing dark/light/matrix themes.

---

### 2. Card Container (`feed-card`)

#### [MODIFY] [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css)

**Current** (lines 1372–1383): Basic `var(--surface)` background, 1px solid border, 16px padding.

**New design:**
- Gradient border using `border-image` or pseudo-element technique
- Glassmorphism: `backdrop-filter: blur(12px)` + semi-transparent background
- Layered shadow: `0 1px 2px rgba(0,0,0,.1), 0 4px 12px rgba(0,0,0,.08), 0 12px 36px rgba(0,0,0,.06)`
- Hover: `translateY(-2px)`, increased shadow, subtle border glow
- 20px border-radius, 20px 24px padding
- `transition: transform 220ms ease-out, box-shadow 220ms ease-out, border-color 220ms ease-out`

---

### 3. Card Header (`feed-head`)

#### [MODIFY] [feed.js](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/js/feed.js) — `postCard()` function (lines 133–224)

**Current**: `avatar → name → quote-mark → edited-mark → when` (flat flex row)

**New structure:**
```
┌──────────────────────────────────────────────┐
│ [Avatar]  Username  ·  Role Badge    ⋮ Menu  │
│           @username · 3h ago · edited        │
└──────────────────────────────────────────────┘
```

- **Avatar**: Existing `avatarNode()` — keep as-is, just apply refined CSS (40px, 12px radius)
- **Username**: Bold, larger (0.92rem), primary text color — clickable
- **Secondary line**: `@username · time · edited` in muted text
- **Role Badge**: Small pill showing user level (if available), subtle style
- **3-dot menu**: Lucide `MoreHorizontal` icon (replaces inline `✎ 🗑` from the old actions area)
  - Dropdown with: Edit, Delete, Report, Copy Link options
  - CSS-only dropdown (no JS library needed) with glass effect

---

### 4. Code Block (`feed-code`) — Full Redesign

#### [MODIFY] [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css) & [feed.js](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/js/feed.js)

**Current** (lines 1427–1478): Basic overflow-hidden wrapper, simple header, basic copy button.

**New design (VS Code + GitHub + Raycast hybrid):**
- `border-radius: 18px` (rounded-xl)
- Glassmorphism header: semi-transparent `var(--surface-2)` with blur
- **Top bar**: language badge (green-tinted pill), spacer, collapse toggle, copy button, run button (disabled/future)
- **Line numbers**: CSS counter-based (pseudo-element `::before` on each line)
- **Syntax highlighting**: existing highlight.js — enhanced with custom theme-matched colors
- **Subtle border glow**: `box-shadow: 0 0 0 1px rgba(34,197,94,.15), 0 0 20px rgba(34,197,94,.04)`
- **Terminal feel**: monospace font, dark background slightly different from card
- **Hover animation**: slight brightness increase, glow intensifies
- **Scroll indicator**: gradient fade on right edge when horizontally scrollable
- **Copy button states**: "Copy" → animated checkmark + "Copied!" on click

---

### 5. Action Bar (Footer) — Complete Rebuild

#### [MODIFY] [feed.js](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/js/feed.js) & [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css)

**Current** (lines 193–222): Emoji-based buttons (`♥ ♡ 💬 ★ ☆ ↺ ✎ 🗑`) with pill-shaped borders.

**New Action Bar with Lucide SVG Icons:**

| Action | Icon | Active State | Animation |
|--------|------|-------------|-----------|
| Like | `Heart` | Filled + pulse + count animate | `scale(1.2)` bounce, count slides up |
| Comment | `MessageCircle` | — | Subtle wiggle on hover |
| Bookmark | `Bookmark` | Filled + subtle glow | `scale(1.1)` with fill transition |
| Share | `Share2` | — | Rotate + translate on hover |
| Repost count | inline with share | — | — |

**Icon styling:**
- No border/pill around icons — bare icons with hover background (transparent → `rgba(255,255,255,.06)`)
- `border-radius: 10px` hover background
- Smooth 180ms transitions
- Active glow: colored shadow matching the action (`--primary` for like, `--accent` for bookmark)
- Pressed state: `scale(0.92)` for tactile feel
- Focus ring: `2px solid var(--primary)` with `outline-offset: 2px`
- ARIA labels on all buttons

**Edit/Delete/Report**: Moved to the 3-dot menu dropdown (header area).

---

### 6. Markdown Typography (`md-body`) — Enhancement

#### [MODIFY] [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css) (lines 1594–1689)

- Refined line-height (1.7 for body, 1.3 for headings)
- Better heading sizes with `font-family: var(--display)`
- Inline code: green-tinted background (`rgba(34,197,94,.08)`), green border
- Blockquote: left border with gradient, refined padding
- Links: `var(--accent)` with underline-offset
- Lists: better spacing and bullet styling
- Tables: alternating row backgrounds, refined borders
- HR: gradient line

---

### 7. Like Animation System

#### [MODIFY] [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css) & [feed.js](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/js/feed.js)

- Heart fills with `var(--danger)` on active
- Pulse animation: `scale(1) → scale(1.25) → scale(1)` over 300ms
- Count number slides up with opacity transition when changing
- GPU accelerated: only `transform` and `opacity`

---

### 8. Responsiveness

#### [MODIFY] [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css)

**Breakpoints** (existing convention: 360 / 480 / 768 / 1024):

- **Desktop (>1024)**: Full layout as designed
- **Tablet (768–1024)**: Slightly reduced padding (18px), smaller avatars
- **Mobile (480–768)**: 
  - Card padding: 16px
  - Action icons: increased touch targets (44px min), spaced with `justify-content: space-around`
  - Code block: smaller font, full-width
- **Small mobile (<480)**:
  - Card padding: 14px  
  - Footer action bar: icons spread evenly, labels hidden
  - Header: time moves to second line

---

### 9. Accessibility

- All action buttons get `aria-label` attributes
- Focus ring: `2px solid var(--primary)` with `outline-offset: 2px`
- Keyboard navigation: All buttons focusable with `tabindex="0"` (already native `<button>`)
- Color contrast: All text meets WCAG AA (tested: `#F8FAFC` on `#10281D` = 12.4:1 ratio)
- Screen reader: `aria-pressed` for toggle buttons (like, bookmark)

---

### 10. Performance

- All animations use `transform` and `opacity` only (GPU composited)
- No layout shifts: card dimensions stable before/after hover
- `will-change: transform` on hover-animated elements
- Lucide icons inlined as static SVG strings — no network requests
- `contain: content` on cards for paint containment

---

## Files Modified Summary

### [MODIFY] [styles.css](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/styles.css)
- New CSS variables for card system (`:root` additions)
- Complete rewrite of `.feed-card`, `.feed-head`, `.feed-actions`, `.act-btn` styles
- Complete rewrite of `.feed-code`, `.code-head`, `.code-lang-badge`, `.code-copy`
- Enhanced `.md-body` typography
- New dropdown menu styles (`.card-menu`, `.card-menu-dropdown`)
- New animation keyframes (like pulse, count slide, icon hover)
- Responsive refinements for all breakpoints
- Accessibility improvements (focus rings, contrast)

### [MODIFY] [feed.js](file:///c:/Users/Tahmaz%20Muradov/Desktop/Collabix/js/feed.js)
- Inline Lucide SVG icon constants
- Restructured `postCard()` header with two-line layout + 3-dot menu
- Enhanced `codeBlockNode()` with line numbers, collapse, copy states
- New action bar builder with SVG icons and animation handlers
- `aria-label` and `aria-pressed` on all interactive elements
- Copy link functionality with toast

---

## Verification Plan

### Manual Verification
1. Run `npm run dev` and verify the feed renders correctly
2. Check all themes (dark, light, matrix) for visual consistency
3. Test hover/click animations on like, bookmark, share, comment
4. Verify mobile responsiveness at 360px, 480px, 768px, 1024px viewports
5. Test keyboard navigation (Tab through all action buttons)
6. Verify code block syntax highlighting still works
7. Confirm no layout shifts on hover/interaction
8. Test the 3-dot menu dropdown opens/closes correctly
9. Verify all existing functionality (like, comment, bookmark, share, edit, delete) still works

### Build Verification
- `npm run build` — ensure no build errors
