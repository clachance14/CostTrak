# Project Overview Page - UX Redesign Wireframe

## AI UI Generation Prompt

Create a clean, annotated wireframe (low-fidelity, grayscale) for a construction project management dashboard with the following layout:

### Page Structure (Top to Bottom):

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER BAR                                                      │
│ [←] [Building Icon] Project Name | Job #12345 | [Active Badge] │
│                                    [Import Budget] [Edit]       │
├─────────────────────────────────────────────────────────────────┤
│ KEY METRICS BAR (Horizontal strip - 80px height)               │
│ Contract: $2.1M → $2.3M | Budget Used: 67% ████░░ | Health: ⚠  │
│ (+$200K changes)        | Remaining: $759K       | 2 risks     │
├─────────────────────────────────────────────────────────────────┤
│ NAVIGATION TABS (Prominent, immediately accessible)             │
│ [Purchase Orders*] [Labor Actuals] [Labor Forecast]            │
│ [Change Orders] [Budget vs Actual] [Contract Details]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ TAB CONTENT AREA (Dynamic based on selection)                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────┐   │
│ │ PURCHASE ORDERS TAB (Default View)                      │   │
│ │                                                          │   │
│ │ Summary Cards (3 cards in row):                         │   │
│ │ ┌──────────┐ ┌──────────┐ ┌──────────┐                │   │
│ │ │Total POs │ │This Month│ │Top Vendor│                 │   │
│ │ │$1.4M     │ │$234K     │ │ABC Corp  │                 │   │
│ │ └──────────┘ └──────────┘ └──────────┘                │   │
│ │                                                          │   │
│ │ PO List Table:                                          │   │
│ │ ┌────┬──────────┬────────┬────────┬─────────┐         │   │
│ │ │ PO │ Vendor   │ Date   │ Amount │ Status  │         │   │
│ │ ├────┼──────────┼────────┼────────┼─────────┤         │   │
│ │ │1234│ ABC Corp │ Jan 15 │ $45K   │Approved │         │   │
│ │ │... │ ...      │ ...    │ ...    │ ...     │         │   │
│ │ └────┴──────────┴────────┴────────┴─────────┘         │   │
│ └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ EXPANDABLE DETAILS SECTION (Collapsed by default)              │
│ [▼ Financial Breakdown] (Click to expand)                      │
│                                                                 │
│ When expanded:                                                  │
│ ┌───────────────┬───────────────┬─────────────────┐          │
│ │ Labor Costs   │ Material Costs│ Burn Rate       │          │
│ │ $567K actual  │ $834K committed│ $45K/week      │          │
│ │ $123K forecast│ $166K remaining│ 17 weeks left  │          │
│ └───────────────┴───────────────┴─────────────────┘          │
│                                                                 │
│ [▼ Activity Feed] (Click to expand)                           │
│ • Latest: PO approved 2 hours ago                             │
└─────────────────────────────────────────────────────────────────┘
```

## Design Principles Applied:

### 1. **Visual Hierarchy**
- **Primary**: Key metrics bar (contract, budget, health)
- **Secondary**: Navigation tabs
- **Tertiary**: Tab content
- **Quaternary**: Expandable details

### 2. **Information Architecture**
- **Scannable**: Key metrics visible without scrolling
- **Accessible**: Primary navigation immediately available
- **Progressive**: Details available on-demand
- **Focused**: One primary view at a time

### 3. **Interaction Patterns**
- Tabs for switching contexts
- Expandable sections for additional detail
- Hover states on cards for interactivity
- Clear visual feedback for current tab

### 4. **Color Usage** (in actual implementation)
- Gray: Default state
- Blue: Active/selected
- Green: Positive variance
- Yellow: Warning (70-90% budget)
- Red: Critical (>90% budget)

### 5. **Responsive Breakpoints**
- Desktop: Full layout as shown
- Tablet: Stack financial breakdown cards 2x2
- Mobile: Single column, hamburger menu for tabs

## Key Improvements from Current Design:

1. **-60% reduction in visible cards** (from 9+ to 3-4)
2. **Tabs moved up** saving 400px of scroll
3. **Removed unready features** (Uncommitted Budget, Projections)
4. **Single-line health status** replaces bulky dashboard
5. **Progressive disclosure** for financial details
6. **Clearer visual hierarchy** with deliberate spacing

## Component Specifications:

### Key Metrics Bar
- Height: 80px
- Background: Light gray (#F9FAFB)
- Border: 1px bottom (#E5E7EB)
- Font: 14px metrics, 12px labels
- Visual separator between metrics

### Navigation Tabs
- Height: 48px
- Active tab: Bold, blue underline
- Inactive: Regular weight, gray
- Hover: Light blue background

### Content Cards
- Padding: 20px
- Border: 1px solid #E5E7EB
- Shadow: 0 1px 2px rgba(0,0,0,0.05)
- Hover shadow: 0 4px 6px rgba(0,0,0,0.1)

### Tables
- Row height: 48px
- Alternating row colors
- Hover state: Light blue background
- Sticky header when scrolling

## Interaction States:

1. **Default Load**: Purchase Orders tab active
2. **Tab Switch**: Smooth fade transition (200ms)
3. **Expand Section**: Slide down animation (300ms)
4. **Card Hover**: Subtle shadow increase
5. **Loading**: Skeleton screens for data

## Accessibility Requirements:

- WCAG 2.1 AA compliant
- Keyboard navigation for all interactions
- Focus indicators on interactive elements
- ARIA labels for screen readers
- Minimum touch target: 44x44px

---

This wireframe prioritizes **clarity over density**, making the interface more efficient for project managers who need quick access to critical information without visual overwhelm.