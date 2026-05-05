# Mobile UI CSS Fixes - Critical Visual Issues

## Critical Issues Found in Screenshots

### 🔴 ISSUE 1: RED LEFT BORDER ON WORD CARDS (img_6, img_10)
**Problem:** Cards have harsh red left border - looks like error state
**Solution:** Remove red border entirely OR replace with subtle 2px indigo accent

```css
/* FILE: frontend/src/styles/words.css */

.word-card,
.card {
  /* REMOVE or CHANGE THIS: */
  /* border-left: 3px solid #6366f1; */
  
  /* ADD THIS INSTEAD: */
  border: none;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Optional: Subtle left accent (2px, very light) */
.word-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e0e7ff;
  border-radius: 12px 0 0 12px;
}
```

---

### 🔴 ISSUE 2: CARDS TOO TALL - EXCESSIVE PADDING & SPACING (img_6, img_10)
**Problem:** Cards waste too much vertical space, only showing 3-4 words per screen instead of 6-8
**Solution:** Reduce padding, margins, and internal spacing aggressively

```css
/* FILE: frontend/src/styles/words.css */

/* CURRENT PROBLEM - REMOVE OR OVERRIDE: */
.card {
  padding: 16px;  /* TOO MUCH */
  margin-bottom: 12px;  /* TOO MUCH */
}

/* FIX: Aggressive reduction */
.card {
  padding: 10px 12px;  /* Reduced from 16px */
  margin-bottom: 6px;   /* Reduced from 12px */
  gap: 4px;            /* Reduce internal gaps */
}

/* Word card specific */
.word-card {
  padding: 10px 12px;
  gap: 4px;
}

/* Card header area */
.card-header,
.word-card-header {
  gap: 4px;
  margin-bottom: 4px;
}

/* Card body content */
.card-body,
.word-card-body {
  gap: 2px;
  line-height: 1.35;  /* Tighter line height */
}

/* Reduce spacing between sections inside card */
.card > * + * {
  margin-top: 6px;
}
```

---

### 🔴 ISSUE 3: "MORE" SECTIONS EXPANDED BY DEFAULT (img_6)
**Problem:** "More" details are showing expanded - should be collapsed by default on mobile
**Solution:** Hide details sections, show only toggle

```css
/* FILE: frontend/src/styles/words.css (NEW) */

/* Collapsible "More" section */
.word-card-details,
.card-details,
.word-card-more {
  display: none;  /* Hidden by default */
  margin-top: 6px;
}

.word-card-details.is-expanded,
.card-details.is-expanded,
.word-card-more.is-expanded {
  display: block;
}

/* "More" toggle button */
.word-card-toggle,
.card-toggle,
.more-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #6366f1;
  font-size: 0.78rem;
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
}

.word-card-toggle:hover {
  opacity: 0.8;
}

/* Chevron icon rotation */
.more-toggle svg {
  transition: transform 0.2s ease;
  transform: rotate(0deg);
}

.more-toggle.is-expanded svg {
  transform: rotate(180deg);
}

/* Example: Definition section collapsed */
.word-card-definition {
  display: none;
}

.word-card-definition.is-expanded {
  display: block;
  padding-top: 4px;
  margin-top: 4px;
  border-top: 1px solid rgba(99, 102, 241, 0.1);
  font-size: 0.85rem;
  color: #64748b;
  line-height: 1.4;
}
```

---

### 🔴 ISSUE 4: KNOWLEDGE LEVEL BADGE POSITIONING (img_6)
**Problem:** "Weak" dropdown on left is large and takes space
**Solution:** Make it a small left-side badge, not a clickable dropdown

```css
/* FILE: frontend/src/styles/words.css */

/* Level indicator - should be SMALL badge on left */
.word-level-badge,
.knowledge-level-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 24px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

/* Level colors */
.word-level-weak {
  background: #fecaca;
  color: #7f1d1d;
}

.word-level-okay {
  background: #bfdbfe;
  color: #1e3a8a;
}

.word-level-good {
  background: #ddd6fe;
  color: #4c1d95;
}

.word-level-strong {
  background: #a7f3d0;
  color: #065f46;
}

.word-level-mastered {
  background: #e2e8f0;
  color: #1e293b;
}

/* Remove dropdown styling from level */
.word-level-dropdown,
.level-dropdown-trigger {
  background: none;
  border: none;
  padding: 0;
  min-width: auto;
  height: auto;
  cursor: default;
  pointer-events: none;
}

.word-level-dropdown::after,
.level-dropdown-icon {
  display: none;
}
```

---

### 🔴 ISSUE 5: TOPIC/POS BADGES CRAMPED (img_6)
**Problem:** Badges are stacked awkwardly, hard to read
**Solution:** Display 2-3 inline, hide rest in "Details" section

```css
/* FILE: frontend/src/styles/words.css */

.word-card-badges,
.card-badges,
.badge-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 4px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  background: #e0e7ff;
  color: #4338ca;
}

.badge.is-hidden {
  display: none;
}

/* Show only first 2 badges inline */
.badge:nth-child(n+3) {
  display: none;
}

.badge:nth-child(n+3).is-expanded {
  display: inline-flex;
}

/* "See more badges" link */
.badge-show-more {
  font-size: 0.72rem;
  color: #6366f1;
  cursor: pointer;
  padding: 0 4px;
  font-weight: 500;
}
```

---

### 🔴 ISSUE 6: TOOLBAR DROPDOWN OVERLAPPING (img_7)
**Problem:** Level dropdown menu is overlapping card content
**Solution:** Ensure dropdown has proper z-index and closes when clicking card

```css
/* FILE: frontend/src/styles/toolbar.css */

.level-dropdown-menu,
.toolbar-dropdown-menu,
.dropdown-menu {
  position: absolute;
  z-index: 50;  /* INCREASE from 30 */
  top: calc(100% + 4px);
  left: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  max-width: 240px;
  max-height: 300px;
  overflow-y: auto;
  padding: 6px;
}

.dropdown-menu-open {
  pointer-events: auto;
  visibility: visible;
  opacity: 1;
  transition: opacity 0.15s ease;
}

.dropdown-menu-closed {
  pointer-events: none;
  visibility: hidden;
  opacity: 0;
}

/* Add semi-transparent backdrop when dropdown is open */
.toolbar-overlay,
.dropdown-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 49;
  background: rgba(0, 0, 0, 0.1);
}

.toolbar-overlay.is-open {
  display: block;
}

@media (max-width: 860px) {
  .level-dropdown-menu,
  .dropdown-menu {
    position: fixed;
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    border-radius: 16px 16px 0 0;
    max-height: 50vh;
    box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.15);
  }
}
```

---

### 🔴 ISSUE 7: ADD WORD MODAL STYLING (img_9)
**Problem:** Modal has visible blue border/outline, looks unfinished
**Solution:** Clean up input styling, remove unwanted borders

```css
/* FILE: frontend/src/styles/quick-add.css */

/* Input group wrapper */
.input-group,
.quick-add-input-group {
  position: relative;
  border: none;
  border-bottom: 1.5px solid #e2e8f0;
  background: transparent;
  padding-bottom: 6px;
  transition: border-color 0.2s ease;
}

.input-group:focus-within {
  border-bottom-color: #6366f1;
}

:root[color-scheme="dark"] .input-group {
  border-bottom-color: #334155;
}

:root[color-scheme="dark"] .input-group:focus-within {
  border-bottom-color: #818cf8;
}

/* Input field - floating label pattern */
.input-field,
.quick-add-input {
  width: 100%;
  border: none;
  background: transparent;
  padding: 12px 0 4px 0;
  font-size: 16px;  /* 16px to prevent iOS zoom */
  font-weight: 500;
  color: var(--text);
  outline: none;
  -webkit-appearance: none;
  -webkit-autocomplete: off;
  font-family: inherit;
}

.input-field::placeholder {
  color: transparent;
}

/* Label - floating pattern */
.input-label,
.quick-add-label {
  position: absolute;
  top: 12px;
  left: 0;
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-3);
  pointer-events: none;
  transition: all 0.2s ease;
  transform-origin: left top;
}

.input-field:focus ~ .input-label,
.input-field:not(:placeholder-shown) ~ .input-label {
  top: -6px;
  font-size: 0.72rem;
  color: #6366f1;
  font-weight: 600;
}

/* NO blue border/outline */
.input-field:focus {
  outline: none;
  box-shadow: none;
}

.input-group:focus-within {
  box-shadow: none;
}
```

---

### 🔴 ISSUE 8: CARD BORDER RADIUS - TOO SHARP (img_10)
**Problem:** Cards have sharp or missing border radius
**Solution:** Apply consistent 12px border radius

```css
/* FILE: frontend/src/styles/words.css */

.word-card,
.card {
  border-radius: 12px;
  overflow: hidden;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
  transition: all 0.2s ease;
}

@media (max-width: 480px) {
  .card {
    border-radius: 10px;
  }
}
```

---

### 🔴 ISSUE 9: TEXT COLOR IN CARDS - POOR CONTRAST (img_6, img_10)
**Problem:** Some text (definition, examples) is too light/faded
**Solution:** Improve contrast for readability

```css
/* FILE: frontend/src/styles/words.css */

/* Definition text */
.word-definition,
.definition-text {
  font-size: 0.85rem;
  color: #475569;  /* Darker gray */
  line-height: 1.4;
  margin-top: 4px;
}

:root[color-scheme="dark"] .word-definition {
  color: #cbd5e1;
}

/* Example text */
.word-example,
.example-text {
  font-size: 0.82rem;
  color: #64748b;
  line-height: 1.35;
  margin-top: 2px;
  padding-left: 4px;
  border-left: 2px solid #e0e7ff;
}

:root[color-scheme="dark"] .word-example {
  color: #a1adc6;
  border-left-color: #334155;
}

/* Label text (POS, etc) */
.card-label,
.badge-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

:root[color-scheme="dark"] .card-label {
  color: #e2e8f0;
}
```

---

### 🔴 ISSUE 10: WORD TERM TYPOGRAPHY (img_6)
**Problem:** Word title size is unclear
**Solution:** Make word term bold and prominent

```css
/* FILE: frontend/src/styles/words.css */

.word-term,
.card-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin: 0;
  line-height: 1.3;
}

@media (max-width: 480px) {
  .word-term,
  .card-title {
    font-size: 0.95rem;
  }
}
```

---

## Summary of CSS Changes Required

### Files to Modify:
1. **frontend/src/styles/words.css** - Word card styling (MAIN FILE)
2. **frontend/src/styles/quick-add.css** - Modal input styling
3. **frontend/src/styles/toolbar.css** - Dropdown z-index and positioning
4. **frontend/src/styles/mobile.css** - Mobile-specific adjustments

### Key Changes:
- ✅ Remove red left border from cards
- ✅ Reduce padding: 16px → 10-12px
- ✅ Reduce gaps: 12px → 4-6px
- ✅ Collapse "More" sections by default
- ✅ Convert level dropdown to badge
- ✅ Show 2-3 badges inline only
- ✅ Fix dropdown z-index and backdrop
- ✅ Clean up input styling (no blue border)
- ✅ Improve text contrast
- ✅ Add 12px border-radius to cards
- ✅ Compact all internal spacing

### Target Result:
- 6-8 words visible per screen on 375px viewport
- Cards look clean and modern (light shadow, rounded corners)
- Touch-friendly spacing (44px+ targets)
- Collapsed details by default (expandable)
- No harsh red borders
- Better typography hierarchy

