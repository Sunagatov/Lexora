# Mobile UI/UX Modernization for Lexora 2026

## Overview
The mobile experience needs refinement across multiple pages to match the 2026 design standards. Focus areas: compact card layouts, improved touch targets, optimized toolbar/header, reduced visual clutter, and better spacing hierarchy.

---

## 1. WORD CARDS & LIST LAYOUT (Study Page, All Words Page)

### Current Issues
- Red border-top on cards is harsh and takes attention
- Knowledge level dropdown on right creates awkward mobile flow
- Cards take excessive vertical space, limiting visible words
- "More" sections auto-expanded, pushing content down
- Badges cramped and hard to read

### Improvements

#### a) Compact Card Design
- Remove red border-top; use subtle left accent border (3px, #6366f1) instead
- Reduce padding to 12px (from 16px) on mobile
- Reduce gap between cards to 8px
- Knowledge level indicator moves to left side as small badge (B1, A2 style)
- Keep part-of-speech, translations inline but wrap if needed

#### b) Collapsible "More" Sections
- Default to collapsed on mobile (show chevron ▼)
- Only show when user clicks "More"
- Save collapsed state in localStorage per page

#### c) Badge Optimization
- Display only 2-3 most important badges inline
- Hide less critical ones behind "Details" expandable
- Use dot separators instead of separate badges for metadata
- Reduce badge padding to fit better

#### d) Translation Display
- Show only first translation inline
- "See more" link if multiple translations exist

---

## 2. HEADER & TOOLBAR (Mobile-Optimized)

### Current Issues
- Breadcrumb truncates on small screens
- Search is icon-only, low discoverability
- Filter button activation state unclear
- Toolbar becomes crowded on smallest screens

### Improvements

#### a) Responsive Breadcrumb
- On <480px: Show only current page name, not full path
- On 480px+: Show "Home > Topic > Subtopic"
- Use single arrow divider "/" instead of icons
- Truncate parent names with ellipsis if needed

#### b) Optimized Toolbar
- On mobile: Search icon, Filter button, Sort dropdown in single row
- Search icon → tap opens search input field below toolbar (inline, not popover)
- Filter button shows badge (red dot or count) when filters active
- Remove standalone "reset" button; add "Clear filters" option inside filter modal
- Use icons only, with touch-friendly 44px hitbox

#### c) Search Field (Mobile)
- When search icon tapped, appears as full-width input below toolbar
- Closes when user taps elsewhere or clicks X
- Placeholder: "Search words..."

---

## 3. ADD WORD MODAL (Already Modernized - Mobile Specifics)

### Additional Mobile Considerations
- Modal slides from bottom (not right) on mobile
- Full width with 12px margins on each side
- Header: "Add Word" title + close X button (no subtitle on <480px)
- Scrollable content area with max-height: calc(100vh - 120px)
- Floating label pattern works on mobile but needs larger touch area for inputs (at least 44px height)
- Enrich button positioned right of input, full height to match input (not smaller)
- Enriched content section: Each field shows as full-width blocks with clear dividers
- Footer buttons: Stack vertically on mobile (full width each) with 8px gap
- Confirmation feedback (toast) centered bottom with 12px margin from bottom

### Enriched Content on Mobile
- Badges: Show all on mobile (better vertical space available)
- Definition: Full width, larger text (14px)
- Examples: Show as gray box with left border, readable on small screen
- Translations/Synonyms: Show as comma-separated or bullet list (readable)
- Long content: Truncate with "Show more" link if >3 lines

---

## 4. SIDEBAR ON MOBILE

### Current Issues
- Takes full screen when opened, covers content
- Topics list very long, requires scrolling
- Footer buttons (Stats, Trash, Export, Import) have no labels, unclear on mobile
- No way to quickly collapse/dismiss

### Improvements

#### a) Sidebar Behavior
- Overlay with semi-transparent backdrop (click to close)
- Slide in from left, taking ~80% width on mobile (keep right edge visible for swipe-to-close)
- Add close button (X) in top-right of sidebar header
- Add quick-close gesture: swipe left closes sidebar

#### b) Topics List
- Add search/filter input at top: "Search topics"
- Show expanded topic with sub-items inline (no second drawer)
- Collapse other topics when one is expanded (accordion style) on mobile to save space
- Show word count next to topic name: "Time & Calendar (47)"
- Progress bar under topic name showing completion %

#### c) Footer Buttons (Mobile)
- If sidebar open: Show as button row in sidebar footer with labels below icons
  * Icons: 24px, labels: 12px gray text below
  * Full width buttons, stacked horizontally
  * Touch target: 48px height total
- If sidebar closed: FAB (+) button visible for adding words (already exists)
- Separators between button groups

---

## 5. FILTER MODAL (Mobile Optimization)

### Current Issues
- Too much content, may overflow on small screens
- Chips could be larger for better touch targets
- Horizontal scrolling needed on some chip groups

### Improvements

#### a) Modal Layout
- Appears as bottom sheet (not center modal) on mobile
- Takes 90% of viewport height, scrollable
- Header: "Filters" title, close X button, "Clear all" link
- Sections: Stacked vertically (not grid)

#### b) Chip Sizing
- Increase chip height to 36px (from 32px)
- Padding: 8px 12px (mobile-friendly touch target)
- Font: 13px (readable on small screen)
- Each chip group: Full width, horizontal scroll if needed
- Active chip: Strong highlight (filled background, white text)

#### c) Section Organization
- Collapsible sections with headers (Knowledge level, Part of Speech, etc.)
- Default: First section expanded, others collapsed
- "Applied filters" summary at top showing active selections
- "Reset filters" button in footer of modal

---

## 6. PAGINATION & PAGE CONTROLS

### Current Issues
- Pagination controls are small on mobile
- "20 / page" dropdown hard to tap

### Improvements
- Move pagination to fixed footer above FAB or in toolbar area
- Page display: "1 / 3" (larger, 14px font)
- Prev/Next arrows: 44px touch targets
- "20 / page" dropdown: Shows as "20 words per page" with arrow, expands to options when tapped
- Align pagination to center of screen

---

## 7. VISUAL HIERARCHY & SPACING

### General Mobile Improvements
- Reduce all top/bottom padding on sections from 16px to 12px
- Reduce all left/right padding from 16px to 12px
- Use 8px baseline for gaps instead of 16px
- Increase font sizes slightly on mobile for readability:
  * Card titles: 15px (from 14px)
  * Card metadata: 12px (from 11px)
  * Badge labels: 11px (from 10px)
- Increase line-height for better readability: 1.5 for body text

### Focus & Touch Targets
- All interactive elements: minimum 44x44px touch target
- Use :focus-visible for keyboard navigation on mobile
- Hover states: Subtle background change (don't require hover on touch)

---

## 8. ANIMATIONS & TRANSITIONS (Mobile-Optimized)

- Reduce animation duration on mobile: 150ms (from 300ms) for snappier feel
- Disable complex animations on slow devices (check prefers-reduced-motion)
- Sheet slide-in: 200ms cubic-bezier(0.34, 1.56, 0.64, 1)
- Modal fade: 150ms linear

---

## 9. THEME CONSISTENCY (Light & Dark Modes)

- Ensure contrast ratios meet WCAG AA on all text
- Dark mode: Use consistent surface colors across all modals
- Light mode: Ensure cards don't wash out with white background
- Test on both iPhone (light) and dark mode screenshots

---

## 10. TESTING CHECKLIST FOR MOBILE ENGINEER

### Layout & Responsiveness
- [ ] Smallest phone viewport: 320px width (edge case, may need horizontal scroll gracefully)
- [ ] Common phone: 375px width (iPhone SE)
- [ ] Larger phone: 414px width (iPhone 12)
- [ ] Tablet portrait: 768px width

### Touch & Interaction
- [ ] Tap all buttons/links - are they ≥44px touch targets?
- [ ] Search, filter, sort workflow on mobile - is it intuitive?
- [ ] Add word flow - is text input visible without keyboard pushing it off screen?
- [ ] Filter modal - can you apply/clear filters easily?
- [ ] Sidebar - can you close it easily (close button + back gesture)?
- [ ] Page doesn't require horizontal scroll except filter chips

### Readability & Visibility
- [ ] Text is readable at arm's length (14px+ for body text)
- [ ] Card information fits without truncation where possible
- [ ] Word cards don't take excessive vertical space
- [ ] Progress indicators are visible and clear

### Accessibility
- [ ] Keyboard focus visible when navigating with tab
- [ ] Screen reader announces buttons, labels, state changes
- [ ] All form inputs have associated labels
- [ ] Error messages are announced and visible

### Dark Mode
- [ ] All elements have proper contrast
- [ ] No washed-out text or colors
- [ ] Badges and icons visible in dark mode

### Light Mode
- [ ] No washed-out text or colors
- [ ] Cards have sufficient separation from background
- [ ] Good visual hierarchy without relying on shadows alone

### Performance
- [ ] Animations are smooth (60fps)
- [ ] Modal transitions don't lag
- [ ] Filter chips scroll smoothly
- [ ] Sidebar slide animation is fluid

---

## Implementation Priority

1. **Phase 1 (Critical):** Word cards layout, toolbar optimization, touch targets
2. **Phase 2 (Important):** Add word modal, sidebar mobile behavior, breadcrumb responsiveness
3. **Phase 3 (Polish):** Filter modal, pagination, animations, spacing adjustments
4. **Phase 4 (Refinement):** Theme consistency, accessibility audit, performance tuning

---

## Success Criteria

✅ All mobile pages are fully usable on 375px viewport without horizontal scroll (except chips)
✅ All interactive elements meet 44x44px minimum touch target
✅ Cards display 6-8 words per screen on common phone (375px, landscape is OK)
✅ Filter, sort, search workflows are 1-2 taps max on mobile
✅ Add word modal doesn't require scrolling to see form fields
✅ Sidebar can be dismissed with close button or swipe gesture
✅ All text is readable without magnification (14px+ minimum)
✅ Dark and light modes have proper contrast (WCAG AA)
✅ Animations are smooth and don't stutter on mid-range phones
