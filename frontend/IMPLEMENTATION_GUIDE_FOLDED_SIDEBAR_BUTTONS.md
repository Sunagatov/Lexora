# Folded Sidebar Button Refinement: Modern Interactive State & Tooltips

## Overview
Modernize the folded sidebar buttons with proper spacing, clear hover/active states, tooltips, better icons, and improved visual hierarchy for 2026 design standards.

## Current Issues
1. Buttons too cramped, hard to tap
2. No visual feedback on hover/active states
3. Icons too small, low contrast
4. No tooltips explaining button purpose
5. Bottom action buttons unclear
6. Missing visual hierarchy distinction
7. Poor accessibility (no aria-labels)

---

## Files to Modify
1. `frontend/src/app/layout/AppLayout.tsx` — Sidebar button structure + state
2. `frontend/src/styles/sidebar.css` — Button styling, hover/active states, animations
3. `frontend/src/shared/components/SidebarButton.tsx` — NEW component for consistent button pattern
4. `frontend/src/shared/components/Tooltip.tsx` — NEW component for button tooltips

---

## 1. New Tooltip Component (Shared)

### Create: `frontend/src/shared/components/Tooltip.tsx`

```typescript
import { useState } from 'react'

type Props = {
  content: string
  position?: 'right' | 'top' | 'bottom'
  delay?: number
  children: React.ReactNode
}

export function Tooltip({ content, position = 'right', delay = 300, children }: Props) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  function handleMouseEnter() {
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  function handleMouseLeave() {
    if (timeoutId) clearTimeout(timeoutId)
    setIsVisible(false)
  }

  return (
    <div className="tooltip-wrapper" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {isVisible && (
        <div className={`tooltip tooltip-${position}`} role="tooltip">
          {content}
        </div>
      )}
    </div>
  )
}
```

---

## 2. New SidebarButton Component (Shared)

### Create: `frontend/src/shared/components/SidebarButton.tsx`

```typescript
type Props = {
  icon: React.ReactNode
  label: string
  tooltip: string
  isActive?: boolean
  variant?: 'primary' | 'action'
  onClick?: () => void
  ariaLabel?: string
}

export function SidebarButton({
  icon,
  label,
  tooltip,
  isActive = false,
  variant = 'primary',
  onClick,
  ariaLabel,
}: Props) {
  return (
    <button
      type="button"
      className={`sidebar-button sidebar-button-${variant}${isActive ? ' is-active' : ''}`}
      onClick={onClick}
      aria-label={ariaLabel || tooltip}
      title={tooltip}
    >
      <span className="sidebar-button-icon">{icon}</span>
      <span className="sidebar-button-label">{label}</span>
      <span className="sidebar-button-tooltip">{tooltip}</span>
    </button>
  )
}
```

---

## 3. Sidebar Button Styling (sidebar.css)

Add these comprehensive button styles:

### 3.1 Button Container & Base Styles

```css
/* Sidebar button group container */
.sidebar-buttons-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 4px;
}

/* Individual button */
.sidebar-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  font-size: 0;  /* Hide label text when folded */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  /* Ensure minimum touch target */
  min-width: 44px;
  min-height: 44px;
}

.sidebar-button:hover {
  background: rgba(99, 102, 241, 0.1);
  color: var(--accent);
  transform: translateX(2px);
}

.sidebar-button:active {
  transform: scale(0.96);
}

.sidebar-button.is-active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.08) 100%);
  color: var(--accent);
  border-left: 3px solid var(--accent);
  padding-left: 1px;
}

.sidebar-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
```

### 3.2 Icon Styling

```css
.sidebar-button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 1.2rem;
  line-height: 1;
  transition: transform 0.2s ease;
}

.sidebar-button:hover .sidebar-button-icon {
  transform: scale(1.15);
}

.sidebar-button.is-active .sidebar-button-icon {
  filter: brightness(1.2);
}
```

### 3.3 Tooltip Styles

```css
/* Tooltip on hover (appears to the right) */
.sidebar-button-tooltip {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%) translateX(8px);
  margin-left: 0;
  padding: 8px 12px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 500;
  white-space: nowrap;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
}

.sidebar-button:hover .sidebar-button-tooltip {
  opacity: 1;
  transform: translateY(-50%) translateX(12px);
  pointer-events: auto;
}

/* Dark mode tooltip */
:root[color-scheme="dark"] .sidebar-button-tooltip {
  background: var(--surface-3);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
```

### 3.4 Variant: Primary Buttons (Navigation/Index)

```css
.sidebar-button-primary {
  /* Base primary style (already in .sidebar-button) */
}

.sidebar-button-primary:hover {
  background: rgba(99, 102, 241, 0.12);
}

.sidebar-button-primary.is-active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(79, 70, 229, 0.1) 100%);
  color: var(--accent);
  box-shadow: inset 0 0 8px rgba(99, 102, 241, 0.2);
}
```

### 3.5 Variant: Action Buttons (Bottom Actions)

```css
.sidebar-button-action {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}

.sidebar-button-action:first-of-type {
  margin-top: 12px;
  padding-top: 12px;
}

.sidebar-button-action:hover {
  background: rgba(99, 102, 241, 0.15);
  color: var(--accent);
}

.sidebar-button-action.is-active {
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
```

### 3.6 Mobile: Folded Sidebar Expanded View

```css
/* When sidebar is expanded/unfolded on mobile */
@media (max-width: 640px) {
  .sidebar-is-expanded .sidebar-button {
    width: 100%;
    justify-content: flex-start;
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    gap: 12px;
  }

  .sidebar-is-expanded .sidebar-button-icon {
    width: 20px;
    height: 20px;
    font-size: 1.3rem;
    flex-shrink: 0;
  }

  .sidebar-is-expanded .sidebar-button-label {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text);
  }

  .sidebar-is-expanded .sidebar-button-tooltip {
    display: none;
  }
}
```

### 3.7 Animation: Button Entry

```css
@keyframes sidebar-button-slide-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.sidebar-button {
  animation: sidebar-button-slide-in 0.3s ease-out backwards;
}

.sidebar-button:nth-child(1) { animation-delay: 0.05s; }
.sidebar-button:nth-child(2) { animation-delay: 0.1s; }
.sidebar-button:nth-child(3) { animation-delay: 0.15s; }
.sidebar-button:nth-child(4) { animation-delay: 0.2s; }
.sidebar-button:nth-child(5) { animation-delay: 0.25s; }
/* ... continue for more buttons */
```

---

## 4. AppLayout.tsx Integration

### Change 4.1: Import Components

```typescript
import { SidebarButton } from '@/shared/components/SidebarButton'
import { Tooltip } from '@/shared/components/Tooltip'
```

### Change 4.2: Update Sidebar Navigation Buttons

Replace the current alphabet/index buttons with structured button group:

```typescript
{/* Navigation/Index Buttons */}
<div className="sidebar-buttons-group">
  {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((letter) => (
    <SidebarButton
      key={letter}
      icon={letter}
      label={letter}
      tooltip={`Jump to words starting with ${letter}`}
      isActive={activeLetterFilter === letter}
      onClick={() => setActiveLetterFilter(letter)}
      ariaLabel={`Filter by letter ${letter}`}
    />
  ))}
</div>

{/* Action Buttons at Bottom */}
<div className="sidebar-buttons-group">
  <SidebarButton
    icon="📊"
    label="Stats"
    tooltip="View vocabulary statistics"
    isActive={currentPage === 'stats'}
    variant="action"
    onClick={() => navigate(routes.stats)}
    ariaLabel="Go to Statistics"
  />
  <SidebarButton
    icon="📥"
    label="Import"
    tooltip="Import words from file"
    variant="action"
    onClick={() => setShowImportDialog(true)}
    ariaLabel="Import words"
  />
  <SidebarButton
    icon="📤"
    label="Export"
    tooltip="Export your vocabulary"
    variant="action"
    onClick={() => setShowExportDialog(true)}
    ariaLabel="Export words"
  />
</div>
```

---

## 5. Icon Recommendations

### Navigation Buttons (Alphabet)
- **Current:** Single letter (A, B, C, etc.)
- **Recommendation:** Keep single letter, but ensure font is:
  - Bold weight (font-weight: 600–700)
  - Monospace for uniformity (font-family: 'Menlo', monospace)
  - Size: 16px (adequate for folded sidebar)

### Action Button Icons
Replace vague icons with clearer emojis or SVG:

| Button | Current | New Icon | Tooltip |
|--------|---------|----------|---------|
| Stats | 📊 | 📈 or 📊 | "View vocabulary statistics" |
| Import | ? | 📥 | "Import words from file" |
| Export | ? | 📤 | "Export your vocabulary" |
| Settings | ? | ⚙️ | "App settings" |
| Theme | 🌙 | 🌙/☀️ | "Toggle dark/light mode" |
| Help | ? | ❓ | "Help & documentation" |

---

## 6. Implementation Checklist

### Step 1: Create New Components
- [ ] Create `frontend/src/shared/components/Tooltip.tsx`
- [ ] Create `frontend/src/shared/components/SidebarButton.tsx`

### Step 2: Update Sidebar CSS
- [ ] Add all `.sidebar-button-*` classes to `frontend/src/styles/sidebar.css`
- [ ] Add `.sidebar-buttons-group` container class
- [ ] Add animations: `@keyframes sidebar-button-slide-in`
- [ ] Add tooltip styling and animations

### Step 3: Update AppLayout.tsx
- [ ] Import new Tooltip and SidebarButton components
- [ ] Replace alphabet/index buttons with SidebarButton loop
- [ ] Replace bottom action buttons with SidebarButton components
- [ ] Wire up state for active button tracking (activeLetterFilter, currentPage)

### Step 4: Icons & Accessibility
- [ ] Ensure alphabet buttons use bold monospace font
- [ ] Update action button icons to be clear and descriptive
- [ ] Add aria-labels to all buttons
- [ ] Test keyboard navigation (Tab through buttons)
- [ ] Test screen reader (VoiceOver, NVDA)

### Step 5: Validation Testing

#### 5.1 Folded Sidebar State (Desktop)
- [ ] Button spacing: 4px gaps, 44x44px button size
- [ ] Hover state: background color change, icon scale up, tooltip appears to right
- [ ] Active state: left border accent, gradient background, highlight icon
- [ ] Tooltip appears after 300ms on hover, disappears on mouse leave
- [ ] Icon visibility: Clear, readable, distinct
- [ ] Touch target: Each button at least 44x44px (WCAG 2.5.5)

#### 5.2 Light Mode
- [ ] Button background transparent by default
- [ ] Hover: light blue/indigo background (rgba(99, 102, 241, 0.1))
- [ ] Active: gradient background, blue border, accent text color
- [ ] Tooltip: light background with dark text, subtle border

#### 5.3 Dark Mode
- [ ] Button background dark/transparent
- [ ] Hover: slightly lighter background, maintaining contrast
- [ ] Active: gradient visible in dark mode
- [ ] Tooltip: dark background with light text, visible border

#### 5.4 Mobile (Unfolded Sidebar)
- [ ] When sidebar expands on mobile, buttons become full-width
- [ ] Label text appears next to icon
- [ ] Tooltips hidden (not needed when labels visible)
- [ ] Button padding increases to 12px 16px
- [ ] Spacing between buttons: 8px

#### 5.5 Animation
- [ ] Buttons slide in from left on page load (staggered)
- [ ] Hover animations smooth (0.2s cubic-bezier)
- [ ] Click animation (scale 0.96) responsive and snappy
- [ ] No animation jank or flicker

#### 5.6 Accessibility
- [ ] All buttons have aria-label
- [ ] Keyboard focus visible (2px outline)
- [ ] Tab order logical (top to bottom, actions at end)
- [ ] Screen reader announces button purpose and state
- [ ] title attribute fallback for tooltips

#### 5.7 Edge Cases
- [ ] Rapid hover on multiple buttons → tooltips work correctly
- [ ] Active state persists across navigation
- [ ] Button state updates when page changes
- [ ] No layout shift when tooltip appears
- [ ] Tooltip doesn't overflow viewport on right edge (consider left position for rightmost buttons)

---

## 7. Expected Results

### Before
```
[B] [cramped]
[C] [no hover feedback]
[H] [icons unclear]
[M] [no tooltips]
…
[📊] [Stats unclear]
[?] [Export icon vague]
```

### After (Folded)
```
[A]  ← hover: blue bg, "Jump to words starting with A", icon scales
[B]  ← icon clearer, 44x44px touch target
[C]
...
────────── (divider)
[📊]  ← hover: "View vocabulary statistics"
[📥]  ← hover: "Import words from file"
[📤]  ← hover: "Export your vocabulary"
```

**Key Improvements:**
✓ Clear visual feedback (hover + active states)
✓ Tooltips explain button purpose
✓ Better spacing (44x44px buttons, 4px gap)
✓ Proper color hierarchy (primary nav vs action buttons)
✓ Accessibility first (aria-labels, focus visible, WCAG 2.5.5)
✓ Smooth animations (slide-in, hover, click)
✓ Dark mode support
✓ Mobile-friendly (expands to full-width with labels)

---

## 8. Optional Enhancements (Phase 2)

### 8.1 Search Functionality
Add search in folded sidebar to jump to words by letter:
```typescript
<input
  className="sidebar-search-input"
  placeholder="Letter…"
  maxLength={1}
  onChange={(e) => setActiveLetterFilter(e.target.value.toUpperCase())}
/>
```

### 8.2 Vertical Scroll in Alphabet
If alphabet becomes long, add scroll:
```css
.sidebar-buttons-group {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  /* Custom scrollbar styling */
}
```

### 8.3 Letter Grouping
Group alphabet into vowels/consonants:
```typescript
{/* Vowels */}
<div className="sidebar-buttons-subgroup">
  {['A', 'E', 'I', 'O', 'U'].map(…)}
</div>
{/* Consonants */}
<div className="sidebar-buttons-subgroup">
  {['B', 'C', 'D', …].map(…)}
</div>
```

---

## 9. Implementation Order
1. Create Tooltip component
2. Create SidebarButton component
3. Add sidebar.css button styling
4. Update AppLayout.tsx with new button structure
5. Test all interactions (hover, active, tooltip)
6. Validate on light/dark modes
7. Test mobile responsiveness
8. Accessibility audit (keyboard, screen reader)
9. Performance check (no layout shift, smooth animations)

Estimated time: 2–3 hours including testing and refinement.
