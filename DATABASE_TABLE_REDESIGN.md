# Database Table Redesign - Professional Data Grid

## Goal
Transform the database tables from basic HTML tables into a modern, professional data grid that looks and behaves like real database tools (Airtable, Notion, Supabase).

## Design Principles

### 1. **Visual Hierarchy**
- Clear header row with column types
- Alternating row colors for scannability  
- Hover states that feel interactive
- Cell borders that don't overwhelm

### 2. **Data Grid Feel**
- Monospace fonts for data values
- Column resizing (visual indicators)
- Row selection states
- Inline editing feel (even if not fully implemented yet)

### 3. **Professional Polish**
- Smooth transitions on all interactions
- Loading skeletons that match final layout
- Empty states that guide users
- Contextual actions on hover

### 4. **Database-Specific UX**
- Column type indicators (icons + colors)
- Reference/relation badges
- Boolean checkmarks
- Date formatting
- Number alignment (right-aligned)
- Text truncation with tooltips

## Key Features

### Table Overview Cards (Existing - Minor Enhancements)
- ✅ Keep current card grid layout
- ✅ Add row count badge
- ✅ Add "last updated" timestamp
- ✅ Show primary key field
- ✅ Better hover animation

### Data Grid (Main Redesign)

#### Header Row
- Sticky header when scrolling
- Column type icon + label
- Sort indicator (up/down arrow)
- Column menu dropdown (future: hide/reorder)
- Resize handle on column borders

#### Data Rows
- Zebra striping (subtle alternating colors)
- Hover state highlights entire row
- Selected row has accent border
- Cell focus states
- Row actions appear on hover (right side)

#### Cell Rendering by Type
- **string**: Left-aligned, truncated with tooltip
- **number**: Right-aligned, monospace, formatted
- **date**: Icon + formatted date
- **boolean**: Checkmark/X icon (not text)
- **options**: Colored badge/pill
- **objectReference**: Linked badge with arrow icon
- **file**: File icon + name
- **long-string**: Truncated with "Show more" link

#### Actions
- Row-level actions (edit/delete) on hover
- Bulk actions toolbar (appears when rows selected)
- Quick add row button (floating at bottom)

## Color System

### Column Type Colors (Subtle backgrounds)
```typescript
{
  string: "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300",
  number: "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300",
  date: "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300",
  boolean: "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300",
  options: "bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300",
  file: "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300",
  "long-string": "bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300",
  objectReference: "bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300",
}
```

### Row States
- Default: `bg-background`
- Hover: `bg-muted/30`
- Selected: `bg-accent/20 border-l-2 border-primary`
- Zebra stripe: `bg-muted/10`

## Layout Structure

### Table Container
```
┌─────────────────────────────────────────────────────────┐
│ Table Header (name, count, actions)                     │
├─────────────────────────────────────────────────────────┤
│ Filter Bar (field selector, value input, sort)          │
├─────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────┐  │
│ │ DATA GRID (sticky header, scrollable body)        │  │
│ │ ╔═══════╤═══════╤═══════╤═══════╤═══════╤───┐    │  │
│ │ ║ Col 1 │ Col 2 │ Col 3 │ Col 4 │ Col 5 │ ⚙ │    │  │
│ │ ╟───────┼───────┼───────┼───────┼───────┼───┤    │  │
│ │ ║ val   │ val   │ val   │ val   │ val   │   │    │  │
│ │ ║ val   │ val   │ val   │ val   │ val   │ 👁│    │  │
│ │ ║ val   │ val   │ val   │ val   │ val   │   │    │  │
│ │ └───────┴───────┴───────┴───────┴───────┴───┘    │  │
│ └───────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│ Pagination (page 1 of 5, prev/next)                     │
└─────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Grid Styling ✅ (To Implement)
1. Redesign table element with proper borders
2. Sticky header with better styling
3. Zebra striping on rows
4. Hover states for rows
5. Column type indicators in header
6. Improved cell padding and spacing

### Phase 2: Cell Type Renderers ✅ (To Implement)
1. Boolean checkmark component
2. Date formatter with icon
3. Number formatter (right-aligned)
4. Reference badge with link icon
5. Options badge with colors
6. File preview component
7. Truncated text with tooltip

### Phase 3: Interactions ✅ (To Implement)
1. Row hover shows action buttons
2. Click row to select (highlight)
3. Keyboard navigation (arrow keys)
4. Quick row actions (copy, duplicate)

### Phase 4: Advanced Features (Future)
1. Column reordering (drag handles)
2. Column resizing (drag borders)
3. Inline cell editing
4. Bulk selection and actions
5. Export to CSV/JSON
6. Virtual scrolling for 1000+ rows

## Component Breakdown

### `<DatabaseTable>` (Main Container)
- Handles data fetching
- Manages pagination
- Coordinates filters

### `<DataGrid>` (New Component)
- Table structure
- Sticky headers
- Row rendering
- Virtualization wrapper

### `<DataGridHeader>` (New Component)
- Column headers
- Sort indicators
- Type badges
- Resize handles

### `<DataGridRow>` (New Component)
- Row container
- Hover state
- Selection state
- Action menu

### `<DataGridCell>` (New Component)
- Type-based rendering
- Truncation logic
- Tooltip wrapper
- Click handlers

### Cell Type Components (New)
- `<BooleanCell>` - Checkmark/X
- `<DateCell>` - Icon + formatted
- `<NumberCell>` - Right-aligned
- `<ReferenceCell>` - Badge with arrow
- `<OptionsCell>` - Colored pill
- `<FileCell>` - Icon + name
- `<TextCell>` - Truncated with tooltip

## Responsive Behavior

### Desktop (1200px+)
- Full table with all columns
- Inline filters
- Sticky header on scroll

### Tablet (768px - 1199px)
- Horizontal scroll for table
- Collapsible filter panel
- Some columns hidden by default

### Mobile (< 768px)
- Card view instead of table
- Swipe actions for edit/delete
- Simplified filter (dropdown)

## Accessibility

- ✅ Keyboard navigation (Tab, Arrow keys)
- ✅ Screen reader labels for actions
- ✅ Focus indicators on all interactive elements
- ✅ ARIA labels for data grid role
- ✅ Sort announcements
- ✅ Loading states announced

## Performance

- Virtualize rows for large datasets (1000+ rows)
- Paginate at 50 rows per page (vs current 20)
- Lazy load cell content (images, files)
- Debounce filter inputs
- Memoize cell renderers

---

**Status**: Design complete, ready for implementation
**Priority**: High (improves perceived professionalism)
**Complexity**: Medium (mainly CSS + component refactoring)
**Time Estimate**: 2-3 hours for Phase 1 + 2
