# Word Card Layout & Contrast Fix - CRITICAL

## Problem Analysis (from img_11.png)

### Current Layout (WRONG):
```
┌─────────────────────────────────┐
│ Weak ▼  April                   │  ← Level button takes up space, word cramped
├─────────────────────────────────┤
│ Noun  A1  (invisible POS)       │  ← POS barely visible
│ апрель (very dim translation)   │  ← Translation text is faint
│ The fourth month... (faint)     │  ← Definition text is faint
└─────────────────────────────────┘
```

### Required Layout (CORRECT):
```
┌─────────────────────────────────┐
│ April                           │  ← Bold, prominent word term
│ Noun · A1                       │  ← POS and level inline, clear
│ апрель                          │  ← BRIGHT translation
│ The fourth month...             │  ← Clear definition
│ More ▼                          │  ← Expandable details
└─────────────────────────────────┘
```

## Issues to Fix

1. **Level dropdown too prominent** - Should be tiny badge inline, not full button
2. **Word term not prominent** - Should be large (1rem), bold (700)
3. **POS (Noun, Verb) invisible** - Currently very small, low contrast
4. **Translation too dim** - Should be bright/bold, easy to read
5. **Definition text faint** - Currently #94a3b8, should be #64748b or darker
6. **Light theme contrast terrible** - All text colors too light
7. **Card layout horizontal** - Level + word on same line (WRONG!)

## CSS Fix Strategy

### Step 1: Fix Card Header Layout
```css
.word-card-header {
  display: flex;
  flex-direction: column;  /* Stack vertically, not horizontally */
  gap: 4px;
  margin-bottom: 4px;
}

.word-card-title-row {
  display: flex;
  flex-direction: column;  /* Word above level */
  gap: 2px;
  align-items: stretch;
}
```

### Step 2: Hide Level Dropdown, Show as Inline Badge
```css
.word-card-level-wrap {
  order: 2;  /* Move to bottom */
  align-self: flex-start;
  flex-shrink: 0;
}

.level-badge-btn {
  /* Hide dropdown styling */
  background: #e0e7ff;
  color: #4f46e5;
  border: none;
  padding: 2px 8px;
  font-size: 0.72rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: default;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: auto;
  min-width: 36px;
  height: 24px;
}

.level-badge-btn svg {
  display: none;  /* Hide dropdown chevron */
}
```

### Step 3: Make Word Term Prominent
```css
.word-card .word-term {
  order: 1;  /* Appears first */
  font-size: 1rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.3;
  flex: 1;
}

:root[color-scheme="dark"] .word-card .word-term {
  color: #f8fafc;
}
```

### Step 4: Add POS Badge Below Word Term
```css
/* Create a new row for POS + Level */
.word-card-badges-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  margin-top: 2px;
  margin-bottom: 4px;
}

.word-card-pos-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  background: #e0e7ff;
  color: #4f46e5;
  border-radius: 6px;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}

:root[color-scheme="dark"] .word-card-pos-badge {
  background: #312e81;
  color: #c7d2fe;
}
```

### Step 5: Improve Translation Contrast
```css
.word-card .word-translation {
  font-size: 0.92rem;
  font-weight: 600;  /* Make bold */
  color: #1e293b;  /* Much darker */
  margin-top: 4px;
  line-height: 1.3;
}

:root[color-scheme="dark"] .word-card .word-translation {
  color: #f1f5f9;  /* Much brighter in dark mode */
  font-weight: 600;
}
```

### Step 6: Improve Definition & Example Contrast
```css
.word-card .word-definition-line,
.word-card .word-preview-line,
.word-card .word-preview-text {
  font-size: 0.82rem;
  color: #475569;  /* Darker from #64748b */
  line-height: 1.4;
}

:root[color-scheme="dark"] .word-card .word-definition-line,
:root[color-scheme="dark"] .word-card .word-preview-line,
:root[color-scheme="dark"] .word-card .word-preview-text {
  color: #cbd5e1;  /* Brighter in dark mode */
}
```

## Implementation Details

### File: frontend/src/styles/words.css

1. **Update .word-card-header**
   - Change: flex-direction to column
   - Change: gap to 2-4px
   - Remove: justify-content space-between

2. **Update .word-card-title-row**
   - Change: flex-direction to column
   - Change: gap to 2px
   - Remove: align-items flex-start (use stretch for full width)

3. **Update .word-card-level-wrap**
   - Add: order: 2
   - Add: align-self: flex-start

4. **Update .level-badge-btn**
   - Add: background: #e0e7ff
   - Add: color: #4f46e5
   - Add: border: none
   - Add: padding: 2px 8px
   - Add: font-size: 0.72rem
   - Add: cursor: default
   - Add: pointer-events: none
   - Add: width: auto
   - Add: height: 24px
   - Add: min-width: 36px
   - Hide: svg (display: none)

5. **Update .word-card .word-term**
   - Change: font-size to 1rem
   - Change: font-weight to 700
   - Change: color to #0f172a
   - Add: order: 1

6. **Update .word-card .word-translation**
   - Change: font-weight to 600 (from 500)
   - Change: color to #1e293b (from #64748b)
   - Change: font-size to 0.92rem
   - Add: dark mode color: #f1f5f9

7. **Update definition/example text**
   - Change: color to #475569 (from #64748b)
   - Add: dark mode color: #cbd5e1

## Testing Checklist

- [ ] Word term is large (1rem), bold (700), black text
- [ ] "Weak/Okay/Good/Strong" level is small badge (24px height) below word term
- [ ] Level badge does NOT have dropdown chevron or click behavior
- [ ] POS (Noun, Verb, etc.) is visible inline with level
- [ ] Translation is bright and readable (#1e293b in light mode)
- [ ] Definition text is darker (#475569, not #94a3b8)
- [ ] Cards show 6-8 words per screen
- [ ] Light theme has good contrast (WCAG AA)
- [ ] Dark mode all colors readable
- [ ] Mobile (375px) layout is clean and compact

## Expected Result

Cards should look like:
```
April                          (large, bold, black)
Noun · Weak                    (small badges, inline)
апрель                         (bright, readable)
The fourth month of the year   (darker gray, readable)
Example: The calendar...       (visible, readable)
More ▼                         (collapsible)
```

No red/colored left borders. No prominent dropdowns. Word term is the hero. All text is readable. Light theme has proper contrast.

