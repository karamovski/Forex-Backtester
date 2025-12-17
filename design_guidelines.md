# Forex Signal Backtesting Software - Design Guidelines

## Design Approach
**Selected Approach**: Design System (Material Design + Carbon Design influences)
**Justification**: This is a data-intensive desktop productivity tool requiring clear information hierarchy, efficient workflows, and professional presentation. Material Design's component patterns combined with Carbon's data-visualization principles provide the optimal foundation.

## Core Design Elements

### Typography
- **Primary Font**: Inter (Google Fonts) - excellent readability for data-dense interfaces
- **Monospace Font**: JetBrains Mono - for displaying tick data, signals, and numerical values
- **Hierarchy**:
  - H1 (Section Headers): text-2xl, font-semibold
  - H2 (Panel Titles): text-lg, font-medium
  - H3 (Subsections): text-base, font-medium
  - Body: text-sm, font-normal
  - Labels: text-xs, font-medium, uppercase tracking-wide
  - Data/Numbers: text-sm md:text-base, monospace

### Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, and 8 for consistency (p-4, gap-6, mb-8, etc.)

**Desktop Layout Structure**:
- Sidebar navigation (w-64): Configuration sections, settings access
- Main content area (flex-1): Active configuration panel or results dashboard
- Max container width: max-w-7xl for forms, full-width for data tables/charts
- Panel cards: Rounded corners (rounded-lg), elevated appearance (shadow-md)

### Component Library

**Navigation & Structure**:
- Left sidebar with collapsible sections: Data Setup, Signal Configuration, Strategy Settings, Risk Management, Backtesting, Results
- Active section indicator with subtle emphasis
- Breadcrumb navigation for multi-step workflows

**Core UI Elements**:

**File & Data Input Section**:
- File browser button with selected path display
- Text area for tick data format (2-line input with syntax highlighting suggestion)
- Drag-and-drop zone for signal text file upload
- Format configuration with example preview panel

**Configuration Panels** (All using card-based layout with p-6 spacing):
- **Signal Format Builder**: Input field with format string, live example preview below
- **Strategy Settings**: 
  - Radio button groups for SL movement rules
  - Checkbox lists for TP handling (single/multiple, partials)
  - Number inputs for pip values with inline labels
- **Risk Management**: 
  - Toggle between risk modes (%, fixed lot, rule-based)
  - Conditional inputs that appear based on selection
  - Balance input with currency symbol prefix

**Form Components**:
- Text inputs: h-10, px-4, border, rounded-md, focus ring
- Number inputs: Same as text with increment/decrement controls
- Select dropdowns: h-10, native styling enhanced
- Radio buttons: Custom styled with labels, grouped in grid-cols-2 or grid-cols-3
- Checkboxes: Custom styled, clear hit targets (min-h-5 min-w-5)
- File inputs: Custom button + filename display
- Timezone selector: Searchable dropdown

**Data Display**:
- **Results Dashboard**: 
  - KPI cards in grid-cols-2 lg:grid-cols-4 showing key metrics (End Balance, Max Drawdown, Win Rate, Total Trades)
  - Each KPI card: Large number (text-3xl, monospace), label below (text-xs, uppercase)
- **Equity Growth Chart**: Full-width chart container (h-96), integrated charting library
- **Trade Breakdown Table**: 
  - Sticky header row
  - Alternating row styling for readability
  - Monospace for numerical columns (entry, exit, P/L)
  - Sortable columns with indicators

**Buttons**:
- Primary (Run Backtest): px-6, py-3, rounded-md, font-medium, prominent placement
- Secondary (Load/Clear): px-4, py-2, rounded-md
- Icon buttons for file actions: w-8 h-8, rounded-md

**Status & Feedback**:
- Progress indicator during backtesting with percentage and current file
- Toast notifications for errors/success
- Inline validation messages below form fields
- Empty state illustrations for results before first run

### Animations
**Minimal, Purposeful Motion**:
- Panel transitions: 200ms ease slide-in when switching sections
- Form validation: Subtle shake on error (300ms)
- Progress bar: Smooth fill animation
- NO scroll animations, parallax, or decorative effects

## Layout Specifications

**Desktop Window (Minimum 1280x720)**:
```
[Sidebar: 256px] [Main Content: flex-1]
│                │
│ - Data Setup   │ [Active Panel Content]
│ - Signals      │ - Card-based sections with p-6
│ - Strategy     │ - Form groups with gap-6
│ - Risk         │ - 2-column layouts where appropriate
│ - Backtest     │   (grid-cols-2 for related inputs)
│ - Results      │ - Full-width for tables/charts
│                │
```

**Information Density**: Utilize space efficiently with grouped related inputs, clear section dividers (border-t with my-6), and compact but readable form layouts.

## Images
**No decorative images required** - This is a functional desktop application. All visual interest comes from data visualization (charts), clear typography hierarchy, and well-structured forms.