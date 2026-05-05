# Implementation Guide: Mobile UI/UX Modernization for Lexora 2026

## Overview
Complete implementation guide for modernizing Lexora's mobile experience across all pages and components. This guide provides exact CSS, component structure changes, and file modifications needed to achieve 2026 mobile design standards.

---

## Part 1: Mobile Breakpoint & Global Styling Strategy

### Mobile-First Breakpoints
```
Mobile: 0px - 479px (primary focus - all improvements)
Tablet: 480px - 767px (responsive adjustments)
Desktop: 768px+ (existing desktop optimizations)
```

### Global CSS Additions (src/styles/global.css or main.css)

```css
/* Mobile-First Spacing System */
@media (max-width: 479px) {
  :root {
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 20px;
    --spacing-2xl: 24px;
    
    /* Mobile Font Sizes */
    --font-size-body: 14px;
    --font-size-small: 12px;
    --font-size-xs: 11px;
    --line-height-body: 1.5;
    --line-height-tight: 1.3;
    
    /* Mobile Touch Targets */
    --touch-target: 44px;
    --touch-target-large: 48px;
  }
}

@media (min-width: 480px) and (max-width: 767px) {
  :root {
    --spacing-xs: 6px;
    --spacing-sm: 12px;
    --spacing-md: 16px;
    --spacing-lg: 20px;
    --spacing-xl: 24px;
    --spacing-2xl: 32px;
    
    --font-size-body: 15px;
    --font-size-small: 13px;
    --font-size-xs: 12px;
  }
}

/* Mobile-Optimized Focus & Touch */
@media (hover: none) and (pointer: coarse) {
  /* Touch device - remove hover states */
  button:hover,
  a:hover,
  .ripple-btn:hover {
    background-color: inherit; /* Keep original bg */
  }
  
  /* Active/pressed state on touch */
  button:active,
  .ripple-btn:active {
    opacity: 0.8;
    transform: scale(0.98);
  }
}

/* Keyboard-only focus */
@media (hover: hover) {
  *:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

/* Reduce animations on mobile for performance */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Mobile scrolling performance */
@media (max-width: 479px) {
  .scrollable-area {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }
}
```

---

## Part 2: Word Cards & List Layout Refinements

### File: src/styles/study.css (or word-card.css)

```css
/* MOBILE: Compact Card Design */
@media (max-width: 479px) {
  .word-card {
    padding: 12px;
    margin-bottom: 8px;
    border-top: none;
    border-left: 3px solid #6366f1; /* Accent instead of top border */
    border-radius: 6px;
  }
  
  .word-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  /* Knowledge Level Badge - Left Side */
  .word-card-level {
    display: inline-block;
    padding: 2px 6px;
    background: #e0e7ff;
    color: #4338ca;
    font-size: 11px;
    font-weight: 600;
    border-radius: 3px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  /* Word Term */
  .word-card-term {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 2px;
    flex: 1;
    word-break: break-word;
  }
  
  /* Part of Speech Badges - Inline */
  .word-card-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 8px;
  }
  
  .word-card-badge {
    display: inline-block;
    padding: 2px 6px;
    background: #dbeafe;
    color: #1e40af;
    font-size: 10px;
    font-weight: 500;
    border-radius: 3px;
  }
  
  /* Translation - First Only */
  .word-card-translation {
    font-size: 12px;
    color: #666;
    margin-bottom: 6px;
  }
  
  .word-card-translation-link {
    color: #6366f1;
    cursor: pointer;
    font-weight: 500;
  }
  
  /* Definition/Example - Collapsed by Default */
  .word-card-content {
    display: none;
  }
  
  .word-card-content.is-expanded {
    display: block;
    padding-top: 8px;
    border-top: 1px solid #e5e7eb;
  }
  
  .word-card-definition {
    font-size: 12px;
    color: #666;
    line-height: 1.4;
    margin-bottom: 6px;
  }
  
  .word-card-example {
    font-size: 11px;
    color: #999;
    font-style: italic;
    padding: 6px;
    background: #f9f9f9;
    border-left: 2px solid #6366f1;
    margin-top: 4px;
  }
  
  /* More/Details Toggle */
  .word-card-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #6366f1;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 0;
    background: none;
    border: none;
  }
  
  .word-card-toggle::after {
    content: '▼';
    transition: transform 200ms ease;
  }
  
  .word-card-toggle.is-expanded::after {
    transform: rotate(180deg);
  }
  
  /* Word Card Container Gap */
  .word-cards-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 12px;
  }
}

/* TABLET & UP: Revert to wider layout */
@media (min-width: 480px) {
  .word-card {
    padding: 16px;
    margin-bottom: 12px;
    border-top: 3px solid #ef4444;
    border-left: none;
  }
  
  .word-card-content {
    display: block;
  }
  
  .word-cards-container {
    padding: 0 16px;
    gap: 12px;
  }
}
```

### Component Change: StudyPage.tsx

React component modifications for collapsible sections:

```tsx
// Add to StudyPage or create WordCard.tsx component
function WordCard({word, onLoadMore}: {word: Word, onLoadMore?: () => void}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const translations = word.translation_entries || []
  const firstTranslation = translations[0] || ''
  const hasMoreTranslations = translations.length > 1
  
  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }
  
  return (
    <div className="word-card" role="article" aria-expanded={isExpanded}>
      <div className="word-card-header">
        <span className="word-card-level">{word.cefr_level || 'N/A'}</span>
        <span className="word-card-term">{word.term}</span>
      </div>
      
      {word.part_of_speech && (
        <div className="word-card-badges">
          <span className="word-card-badge">{word.part_of_speech}</span>
          {word.countability && (
            <span className="word-card-badge">{word.countability}</span>
          )}
        </div>
      )}
      
      {firstTranslation && (
        <div className="word-card-translation">
          {firstTranslation}
          {hasMoreTranslations && (
            <button 
              className="word-card-translation-link"
              onClick={() => setIsExpanded(true)}
            >
              {` +${translations.length - 1} more`}
            </button>
          )}
        </div>
      )}
      
      <div className={`word-card-content ${isExpanded ? 'is-expanded' : ''}`}>
        {word.definition && (
          <div className="word-card-definition">{word.definition}</div>
        )}
        
        {word.example_entries && word.example_entries.length > 0 && (
          <div className="word-card-example">
            Example: {word.example_entries[0]}
          </div>
        )}
      </div>
      
      <button
        className={`word-card-toggle ${isExpanded ? 'is-expanded' : ''}`}
        onClick={handleToggle}
        aria-label={isExpanded ? 'Hide details' : 'Show details'}
      >
        Details
      </button>
    </div>
  )
}
```

---

## Part 3: Header & Toolbar Mobile Optimization

### File: src/styles/toolbar.css (New or extend existing)

```css
/* MOBILE: Toolbar Optimization */
@media (max-width: 479px) {
  .toolbar-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--surface);
    border-bottom: 1px solid #e5e7eb;
    height: auto;
  }
  
  /* Responsive Breadcrumb */
  .breadcrumb {
    display: none; /* Hide full breadcrumb on mobile */
  }
  
  .breadcrumb-current {
    display: block;
    font-size: 13px;
    color: var(--text-secondary);
    padding: 8px 12px;
    background: var(--surface-secondary);
    border-radius: 4px;
  }
  
  /* Search Icon Button */
  .toolbar-search-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text);
    font-size: 18px;
  }
  
  .toolbar-search-btn:active {
    background: rgba(99, 102, 241, 0.1);
    border-radius: 6px;
  }
  
  /* Search Input - Slides In Below Toolbar */
  .toolbar-search-input {
    display: none;
    width: 100%;
    padding: 0 12px;
    margin-bottom: 8px;
  }
  
  .toolbar-search-input.is-active {
    display: block;
    animation: slide-down 200ms ease-out;
  }
  
  /* Filter Button with Badge */
  .toolbar-filter-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text);
    font-size: 18px;
    position: relative;
  }
  
  .toolbar-filter-btn:active {
    background: rgba(99, 102, 241, 0.1);
    border-radius: 6px;
  }
  
  /* Active Filter Badge */
  .toolbar-filter-btn::after {
    content: '';
    display: none;
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
  }
  
  .toolbar-filter-btn.is-active::after {
    display: block;
  }
  
  /* Sort Dropdown */
  .toolbar-sort-select {
    height: 44px;
    padding: 0 12px;
    font-size: 13px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
    flex: 1;
    min-width: 120px;
  }
  
  .toolbar-sort-select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
  
  /* Animations */
  @keyframes slide-down {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

/* TABLET & UP: Show full toolbar */
@media (min-width: 480px) {
  .toolbar-container {
    padding: 12px 16px;
    gap: 12px;
  }
  
  .breadcrumb {
    display: block;
  }
  
  .breadcrumb-current {
    display: none;
  }
  
  .toolbar-search-input {
    display: flex;
    width: 200px;
  }
}
```

### Breadcrumb Responsive Component: src/shared/components/Breadcrumb.tsx

```tsx
export function Breadcrumb({items}: {items: BreadcrumbItem[]}) {
  const isMobile = window.innerWidth < 480
  
  if (isMobile && items.length > 0) {
    // Show only current page on mobile
    const current = items[items.length - 1]
    return (
      <div className="breadcrumb-current">
        {current.label}
      </div>
    )
  }
  
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, idx) => (
        <Fragment key={idx}>
          {idx > 0 && <span className="breadcrumb-divider">/</span>}
          {item.isActive ? (
            <span className="breadcrumb-current">{item.label}</span>
          ) : (
            <button
              className="breadcrumb-link"
              onClick={item.onClick}
            >
              {item.label}
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
```

### Toolbar Component Updates: src/features/study/components/StudyToolbar.tsx

```tsx
export function StudyToolbar({onFilterClick, onSearchChange}: Props) {
  const [showSearch, setShowSearch] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [activeFilters, setActiveFilters] = useState(false)
  
  const handleSearchToggle = () => {
    setShowSearch(!showSearch)
    if (showSearch) setSearchValue('')
  }
  
  const handleSearchChange = (value: string) => {
    setSearchValue(value)
    onSearchChange?.(value)
  }
  
  return (
    <>
      <div className="toolbar-container">
        <button
          className="toolbar-search-btn"
          onClick={handleSearchToggle}
          aria-label="Toggle search"
          aria-expanded={showSearch}
        >
          🔍
        </button>
        
        <button
          className={`toolbar-filter-btn ${activeFilters ? 'is-active' : ''}`}
          onClick={() => {
            onFilterClick?.()
            setActiveFilters(true)
          }}
          aria-label="Open filters"
          aria-expanded={activeFilters}
        />
        
        <select
          className="toolbar-sort-select"
          defaultValue="level"
          aria-label="Sort words by"
        >
          <option value="level">Level ↑</option>
          <option value="recent">Recent</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>
      
      {showSearch && (
        <div className="toolbar-search-input is-active">
          <input
            type="text"
            className="search-field"
            placeholder="Search words..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
          <button
            className="search-close"
            onClick={handleSearchToggle}
            aria-label="Close search"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
```

---

## Part 4: Add Word Modal Mobile Refinements

### File: src/styles/quick-add.css (Mobile sections)

```css
/* MOBILE: Add Word Modal */
@media (max-width: 479px) {
  .quick-add-overlay {
    background: rgba(0, 0, 0, 0.4);
  }
  
  .quick-add-sheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
    height: auto;
    max-height: 90vh;
    border-radius: 16px 16px 0 0;
    padding: 0;
    margin: 0;
    animation: sheet-slide-up-mobile 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
    display: flex;
    flex-direction: column;
  }
  
  .quick-add-header {
    padding: 16px 12px;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }
  
  .quick-add-title {
    font-size: 16px;
    font-weight: 600;
  }
  
  .quick-add-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    -webkit-overflow-scrolling: touch;
  }
  
  .quick-add-field {
    margin-bottom: 12px;
  }
  
  /* Input Fields - Larger Touch Targets */
  .quick-add-input,
  .input-field {
    height: 44px;
    font-size: 16px; /* Prevents zoom on iOS */
    padding: 12px;
  }
  
  .input-label {
    font-size: 12px;
  }
  
  /* Term + Enrich Row */
  .quick-add-term-row {
    display: flex;
    gap: 8px;
  }
  
  .quick-add-input-group {
    flex: 1;
  }
  
  .quick-add-enrich-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    flex-shrink: 0;
  }
  
  /* Topic Row */
  .quick-add-topic-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .quick-add-select {
    flex: 1;
    height: 44px;
    padding: 0 12px;
  }
  
  .quick-add-new-topic-btn,
  .quick-add-translate-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    flex-shrink: 0;
  }
  
  /* Footer */
  .quick-add-footer {
    padding: 12px;
    gap: 8px;
    flex-shrink: 0;
    border-top: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
  }
  
  .quick-add-footer button {
    width: 100%;
    height: 44px;
    font-size: 14px;
  }
  
  .quick-add-cancel,
  .quick-add-save {
    flex: 1;
  }
  
  /* Enrich Preview Section */
  .enrich-preview {
    padding: 12px;
    background: #f0f4ff;
    border-radius: 8px;
    margin-bottom: 12px;
    border: 1px solid #dbeafe;
  }
  
  .enrich-preview-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }
  
  .enrich-chip {
    padding: 4px 8px;
    font-size: 11px;
    background: #e0e7ff;
    border-radius: 3px;
    color: #4338ca;
  }
  
  .enrich-preview-row {
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #dbeafe;
  }
  
  .enrich-preview-row:last-child {
    margin-bottom: 0;
    border-bottom: none;
  }
  
  .enrich-preview-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: #6366f1;
    margin-bottom: 4px;
  }
  
  .enrich-preview-value {
    display: block;
    font-size: 13px;
    color: var(--text);
    line-height: 1.4;
  }
  
  .enrich-preview-list {
    margin: 0;
    padding-left: 16px;
    font-size: 13px;
    color: var(--text);
    line-height: 1.4;
  }
  
  .enrich-preview-list li {
    margin-bottom: 4px;
  }
  
  /* Animations */
  @keyframes sheet-slide-up-mobile {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
}

/* TABLET & UP: Desktop modal behavior */
@media (min-width: 480px) {
  .quick-add-sheet {
    position: fixed;
    right: 0;
    bottom: 0;
    top: 0;
    width: 420px;
    height: 100vh;
    border-radius: 0;
    animation: sheet-slide-in 300ms ease-out;
  }
  
  .quick-add-footer {
    flex-direction: row;
  }
  
  .quick-add-footer button {
    width: auto;
    height: auto;
    flex: 1;
  }
}
```

---

## Part 5: Sidebar Mobile Behavior

### File: src/styles/sidebar.css (Mobile sections)

```css
/* MOBILE: Sidebar Drawer Behavior */
@media (max-width: 479px) {
  .sidebar-container {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 80%;
    max-width: 320px;
    height: 100vh;
    background: var(--surface);
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 300ms ease-out;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .sidebar-container.is-open {
    transform: translateX(0);
  }
  
  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999;
  }
  
  /* Sidebar Header with Close Button */
  .sidebar-header {
    padding: 12px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .sidebar-close-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    color: var(--text);
  }
  
  /* Search Topics Input */
  .sidebar-search {
    padding: 8px 12px;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .sidebar-search input {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    font-size: 13px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
  }
  
  /* Topics List */
  .sidebar-topics {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
    -webkit-overflow-scrolling: touch;
  }
  
  /* Topic Item */
  .sidebar-topic {
    padding: 12px;
    border-bottom: 1px solid #f3f4f6;
  }
  
  .sidebar-topic-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    margin-bottom: 4px;
  }
  
  .sidebar-topic-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    flex: 1;
  }
  
  .sidebar-topic-count {
    font-size: 11px;
    color: var(--text-secondary);
    margin-left: 4px;
  }
  
  .sidebar-topic-toggle {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: transform 200ms;
  }
  
  .sidebar-topic-toggle.is-expanded {
    transform: rotate(180deg);
  }
  
  /* Topic Progress Bar */
  .sidebar-topic-progress {
    height: 3px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 4px;
  }
  
  .sidebar-topic-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #a78bfa);
    border-radius: 2px;
  }
  
  /* Subtopics (Accordion Style) */
  .sidebar-subtopics {
    display: none;
    max-height: 0;
    overflow: hidden;
  }
  
  .sidebar-subtopics.is-expanded {
    display: block;
    max-height: 400px;
    animation: expand-accordion 200ms ease-out;
  }
  
  .sidebar-subtopic {
    padding: 8px 12px 8px 28px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }
  
  .sidebar-subtopic:hover {
    background: var(--surface-secondary);
  }
  
  /* Footer Buttons */
  .sidebar-footer {
    padding: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    flex-direction: row;
    gap: 8px;
  }
  
  .sidebar-footer-btn {
    flex: 1;
    height: 48px;
    padding: 0;
    background: none;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 10px;
    color: var(--text);
    transition: all 200ms;
  }
  
  .sidebar-footer-btn:active {
    background: var(--surface-secondary);
  }
  
  .sidebar-footer-icon {
    font-size: 20px;
  }
  
  .sidebar-footer-label {
    font-size: 10px;
    color: var(--text-secondary);
  }
  
  /* Animation */
  @keyframes expand-accordion {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 400px;
    }
  }
  
  /* Swipe to close gesture support */
  .sidebar-container {
    touch-action: pan-y;
  }
}

/* TABLET & UP: Full sidebar */
@media (min-width: 480px) {
  .sidebar-container {
    position: static;
    width: 100%;
    max-width: none;
    height: auto;
    transform: none;
    transition: none;
    box-shadow: none;
  }
  
  .sidebar-overlay {
    display: none;
  }
  
  .sidebar-search {
    display: none;
  }
  
  .sidebar-close-btn {
    display: none;
  }
  
  .sidebar-footer {
    display: none;
  }
}
```

### AppLayout.tsx Changes for Mobile Sidebar

```tsx
export function AppLayout({children}: {children: React.ReactNode}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 479px)')
  
  useEffect(() => {
    if (!isMobile) setSidebarOpen(false)
  }, [isMobile])
  
  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [useLocation().pathname])
  
  return (
    <div className="app-layout">
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <nav className={`sidebar-container ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <span>Topics</span>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        {/* Rest of sidebar content */}
      </nav>
      
      <main className="main-content">
        {/* Header with menu button for mobile */}
        {isMobile && (
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Toggle sidebar"
          >
            ≡
          </button>
        )}
        {children}
      </main>
    </div>
  )
}
```

---

## Part 6: Filter Modal Mobile Optimization

### File: src/styles/filter-modal.css (Mobile sections)

```css
/* MOBILE: Bottom Sheet Filter Modal */
@media (max-width: 479px) {
  .filter-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 900;
  }
  
  .filter-modal {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
    height: 90vh;
    border-radius: 16px 16px 0 0;
    background: var(--surface);
    z-index: 901;
    display: flex;
    flex-direction: column;
    animation: modal-slide-up 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .filter-modal-header {
    padding: 16px 12px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  
  .filter-modal-title {
    font-size: 16px;
    font-weight: 600;
  }
  
  .filter-modal-close {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
  }
  
  /* Applied Filters Summary */
  .filter-applied-summary {
    padding: 12px;
    background: #f0f4ff;
    border-bottom: 1px solid #dbeafe;
    font-size: 12px;
    color: #4338ca;
  }
  
  /* Scrollable Content */
  .filter-modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    -webkit-overflow-scrolling: touch;
  }
  
  /* Filter Sections */
  .filter-section {
    margin-bottom: 12px;
  }
  
  .filter-section-header {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  
  /* Chips */
  .filter-chip {
    display: inline-block;
    padding: 8px 12px;
    margin: 4px 4px 4px 0;
    background: var(--surface-secondary);
    border: 1px solid #d1d5db;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
    transition: all 200ms;
  }
  
  .filter-chip:active {
    transform: scale(0.98);
  }
  
  .filter-chip.is-active {
    background: #6366f1;
    color: white;
    border-color: #6366f1;
  }
  
  /* Footer */
  .filter-modal-footer {
    padding: 12px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  
  .filter-modal-footer button {
    flex: 1;
    height: 44px;
    font-size: 14px;
  }
  
  /* Animation */
  @keyframes modal-slide-up {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
}

/* TABLET & UP: Center modal */
@media (min-width: 480px) {
  .filter-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    right: auto;
    bottom: auto;
    width: 400px;
    height: auto;
    max-height: 80vh;
    transform: translate(-50%, -50%);
    border-radius: 12px;
    animation: modal-pop-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  .filter-modal-footer {
    flex-direction: row;
  }
}
```

---

## Part 7: Pagination & Page Controls

### File: src/styles/pagination.css

```css
/* MOBILE: Pagination Controls */
@media (max-width: 479px) {
  .pagination-container {
    position: fixed;
    bottom: 60px; /* Above FAB */
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--surface);
    border-radius: 20px;
    padding: 8px 12px;
    border: 1px solid #d1d5db;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 10;
  }
  
  .pagination-prev,
  .pagination-next {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
    color: var(--text);
    border-radius: 4px;
    transition: background 200ms;
  }
  
  .pagination-prev:active,
  .pagination-next:active {
    background: var(--surface-secondary);
  }
  
  .pagination-prev:disabled,
  .pagination-next:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pagination-info {
    font-size: 12px;
    color: var(--text);
    min-width: 40px;
    text-align: center;
    font-weight: 500;
  }
  
  .pagination-select {
    height: 32px;
    padding: 0 8px;
    font-size: 11px;
    background: var(--surface-secondary);
    border: 1px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
    color: var(--text);
  }
}

/* TABLET & UP: Inline pagination */
@media (min-width: 480px) {
  .pagination-container {
    position: static;
    transform: none;
    margin-top: 16px;
  }
}
```

---

## Part 8: Global Mobile Utility Classes

### File: src/styles/mobile-utils.css

```css
/* Utility Classes for Mobile */

/* Hide on Mobile */
@media (max-width: 479px) {
  .hide-mobile {
    display: none !important;
  }
  
  .text-truncate-mobile {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Ensure touch targets are at least 44px */
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Prevent double tap zoom on buttons */
  .no-double-tap-zoom {
    touch-action: manipulation;
  }
  
  /* Mobile-safe input */
  input[type="text"],
  input[type="email"],
  input[type="search"],
  select,
  textarea {
    font-size: 16px; /* Prevents iOS zoom on focus */
    border-radius: 6px;
  }
  
  /* Full-width mobile buttons */
  .mobile-full-width {
    width: 100%;
  }
}

/* Show only on Mobile */
@media (max-width: 479px) {
  .show-mobile {
    display: block;
  }
}

/* Hide on Mobile, Show on Tablet+ */
@media (min-width: 480px) {
  .hide-mobile {
    display: block !important;
  }
  
  .show-mobile {
    display: none;
  }
}
```

---

## Part 9: Dark Mode Mobile Support

### File: src/styles/mobile-dark-mode.css

```css
/* Mobile Dark Mode Overrides */
@media (max-width: 479px) {
  :root[color-scheme="dark"] {
    --surface: #1f2937;
    --surface-secondary: #374151;
    --text: #f3f4f6;
    --text-secondary: #d1d5db;
  }
  
  :root[color-scheme="dark"] .word-card {
    background: #2d3748;
    border-left-color: #6366f1;
  }
  
  :root[color-scheme="dark"] .word-card-level {
    background: #312e81;
    color: #a5f3fc;
  }
  
  :root[color-scheme="dark"] .enrich-preview {
    background: #312e81;
    border-color: #3f3b9a;
  }
  
  :root[color-scheme="dark"] .filter-chip {
    background: #374151;
    border-color: #4b5563;
    color: #f3f4f6;
  }
  
  :root[color-scheme="dark"] .filter-chip.is-active {
    background: #6366f1;
    border-color: #6366f1;
  }
  
  :root[color-scheme="dark"] .sidebar-container {
    background: #1f2937;
  }
  
  :root[color-scheme="dark"] .quick-add-sheet {
    background: #1f2937;
  }
  
  :root[color-scheme="dark"] input,
  :root[color-scheme="dark"] select {
    background: #374151;
    color: #f3f4f6;
    border-color: #4b5563;
  }
  
  :root[color-scheme="dark"] input::placeholder {
    color: #9ca3af;
  }
}
```

---

## Part 10: Mobile-Specific Component: useMediaQuery Hook

### File: src/hooks/useMediaQuery.ts

```typescript
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  
  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    
    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [matches])
  
  return matches
}

// Usage:
// const isMobile = useMediaQuery('(max-width: 479px)')
```

---

## Part 11: Implementation Checklist

### Phase 1: Critical Mobile Foundation (Week 1)
- [ ] Global mobile CSS variables and spacing system added
- [ ] Word card layout refactored (compact design, left border, collapsible content)
- [ ] Toolbar mobile optimization (search toggles, filter badge, responsive breadcrumb)
- [ ] Input fields updated for mobile (44px height, 16px font to prevent iOS zoom)
- [ ] Touch target audit completed (all buttons ≥44px)

### Phase 2: Core Interactions (Week 2)
- [ ] Add Word modal repositioned (bottom sheet on mobile, right sidebar on desktop)
- [ ] Modal buttons stacked vertically on mobile
- [ ] Sidebar drawer behavior implemented (slide from left, close button, swipe gesture)
- [ ] Filter modal as bottom sheet with scrollable content
- [ ] Search input inline behavior (slides below toolbar when toggled)

### Phase 3: Polish & Refinement (Week 3)
- [ ] Pagination controls repositioned above FAB
- [ ] Dark mode contrast verified on all mobile components
- [ ] Animations optimized (150ms duration for snappier feel)
- [ ] Breadcrumb truncation tested on small screens
- [ ] Sidebar accordion collapse working (only one topic expanded at a time)

### Phase 4: Accessibility & Performance (Week 4)
- [ ] Screen reader testing on mobile devices
- [ ] Focus-visible states verified with keyboard navigation
- [ ] Slow device animation performance tested (prefers-reduced-motion)
- [ ] Touch event handling verified (no touch hover states)
- [ ] Final responsive testing: 320px, 375px, 414px, 768px viewports

---

## Part 12: Testing Procedure for Mobile Engineer

### Before Implementation Start
1. Read this entire guide
2. Review MOBILE_UI_2026_IMPLEMENTATION_PROMPT.md
3. Compare existing mobile screenshots with 2026 targets

### During Implementation
1. Make CSS changes incrementally (one section at a time)
2. Test on real mobile device or DevTools device emulation
3. Verify no regressions on desktop (768px+)
4. Check dark mode for each change

### Final Validation (All viewports: 320px, 375px, 414px, 768px)

**Word Cards Layout:**
- [ ] Red border top removed, 3px left indigo border visible
- [ ] 6-8 words visible per screen without scrolling
- [ ] Badges inline and readable
- [ ] "More" section collapsed by default
- [ ] Knowledge level badge on left side
- [ ] Touch areas clearly defined

**Toolbar:**
- [ ] Breadcrumb shows only current page name on mobile
- [ ] Search icon toggles inline search input below toolbar
- [ ] Filter button shows red dot when filters applied
- [ ] Sort dropdown full width and clickable
- [ ] Toolbar doesn't wrap to multiple rows

**Add Word Modal:**
- [ ] Slides from bottom (not right) on mobile
- [ ] Full width with 12px margins
- [ ] Inputs are 44px tall
- [ ] Enrich button full height, right-aligned
- [ ] Footer buttons stack vertically
- [ ] Scrollable content without keyboard covering it

**Sidebar:**
- [ ] Slides from left on mobile
- [ ] Close button (X) visible and functional
- [ ] Overlay dismissable
- [ ] Topics can search/filter
- [ ] Only one topic expanded at a time (accordion)
- [ ] Footer buttons visible with labels

**Filter Modal:**
- [ ] Bottom sheet on mobile (90% height)
- [ ] Chips are 36px tall for easy tapping
- [ ] Active filters shown in summary
- [ ] Scrollable if content exceeds height

**Pagination:**
- [ ] Fixed above FAB, centered
- [ ] "1 / 3" display is readable (14px+)
- [ ] Prev/Next arrows 44px clickable
- [ ] "20 / page" dropdown functional

**Dark Mode:**
- [ ] WCAG AA contrast on all text
- [ ] No washed-out colors
- [ ] Badges visible in dark mode
- [ ] Modals readable (not too dark)

**Accessibility:**
- [ ] Tab navigation works logically
- [ ] Screen reader announces all buttons/sections
- [ ] Focus-visible outlines visible
- [ ] Error messages readable and announced
- [ ] Keyboard can open/close all modals

**Performance:**
- [ ] Animations smooth (no jank)
- [ ] Modal transitions fluid
- [ ] Sidebar slide smooth
- [ ] Pagination controls responsive
- [ ] No layout shift during interactions

---

## Part 13: File Summary & Dependencies

### Files to Create/Modify:

**New Files:**
- `src/styles/mobile-utils.css` — Mobile utility classes
- `src/styles/mobile-dark-mode.css` — Dark mode mobile overrides
- `src/hooks/useMediaQuery.ts` — Media query hook

**Modified Files:**
- `src/styles/study.css` — Add word card mobile styles
- `src/styles/toolbar.css` — Create or extend toolbar mobile styles
- `src/styles/quick-add.css` — Add mobile bottom sheet styles
- `src/styles/sidebar.css` — Add drawer behavior styles
- `src/styles/filter-modal.css` — Add bottom sheet styles
- `src/styles/pagination.css` — Add mobile positioning
- `src/app/layout/AppLayout.tsx` — Add sidebar drawer logic
- `src/features/study/components/StudyToolbar.tsx` — Add search toggle, responsive layout
- `src/shared/components/Breadcrumb.tsx` — Add mobile truncation
- `src/styles/global.css` or `main.css` — Add global mobile variables

**Component Changes (Add to existing files):**
- Add `WordCard` component or extract from existing (collapsible content)
- Add `useMediaQuery` hook usage in layout components

### CSS Import Order (in main.css or index.css):
```css
@import './styles/global.css';
@import './styles/study.css';
@import './styles/toolbar.css';
@import './styles/quick-add.css';
@import './styles/sidebar.css';
@import './styles/filter-modal.css';
@import './styles/pagination.css';
@import './styles/mobile-utils.css';
@import './styles/mobile-dark-mode.css';
```

---

## Success Criteria Summary

✅ **Layout:** All pages usable on 375px without horizontal scroll
✅ **Touch:** All buttons ≥44x44px minimum touch target
✅ **Content:** 6-8 words visible per screen on typical phone
✅ **Interaction:** Max 1-2 taps for any action (search, filter, add)
✅ **Modal UX:** No keyboard covering inputs, scrollable if needed
✅ **Sidebar:** Dismissable, searchable, accordion collapse
✅ **Theme:** Dark & light modes with WCAG AA contrast
✅ **Performance:** Smooth 60fps animations on mid-range phones
✅ **Accessibility:** Full keyboard + screen reader support
✅ **Responsive:** Working correctly at 320px, 375px, 414px, 768px breakpoints
