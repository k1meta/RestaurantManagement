```markdown
# Design System Specification: High-Performance Hospitality

## 1. Overview & Creative North Star
**Creative North Star: The Kinetic Editorial**

In the high-pressure environment of a commercial kitchen or a bustling dining room, UI cannot just be "functional"—it must be authoritative. This design system moves away from the "app-like" clutter of rounded buttons and thin lines, pivoting instead toward a **Kinetic Editorial** aesthetic. 

We treat the screen like a high-end, real-time broadsheet. We use bold, asymmetrical typography to command attention and high-contrast tonal layering to define space. By removing traditional borders and relying on "The No-Line Rule," we create a seamless digital workspace that feels like an extension of the restaurant’s physical architecture. It is sturdy, high-contrast, and surgically precise.

---

## 2. Colors & Surface Architecture

The palette is anchored in deep charcoals and crisp whites, providing a high-contrast foundation that remains legible under harsh kitchen heat-lamps or dimmed dining room lights.

### Core Palette
*   **Primary (Action):** `#000000` (The Absolute Black) – Used for high-impact navigation and primary touchpoints.
*   **Secondary (Success):** `#1b6d24` – Reserved for "Order Ready" or "Payment Complete" states.
*   **Tertiary (Alert):** `#ffdbca` (Container) with `#773200` (On-Tertiary) – A sophisticated "Alert Orange" for pending tickets or urgent inventory needs.
*   **Neutral Foundation:** `surface` (`#fcf9f8`) and `on-surface` (`#1c1b1b`).

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content.
Structural boundaries must be defined solely through background color shifts. For example, a ticket list (`surface-container-low`) sits directly on the main dashboard (`surface`), creating a clear but borderless distinction. 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tokens to create "nested" depth:
1.  **Base Layer:** `surface` (`#fcf9f8`)
2.  **Sectioning:** `surface-container-low` (`#f6f3f2`)
3.  **Interactive Elements:** `surface-container-highest` (`#e5e2e1`)
4.  **Active/Focus States:** `primary-fixed` (`#e5e2e1`)

### The "Glass & Signature Texture" Rule
To add professional polish, use **Glassmorphism** for floating elements like "New Order" notifications. Apply `surface-container-lowest` at 80% opacity with a `20px` backdrop blur. For main CTAs, use a subtle gradient transitioning from `primary` (`#000000`) to `primary-container` (`#1c1b1b`) to provide a "tactile" depth that flat black cannot achieve.

---

## 3. Typography: The Editorial Voice

We utilize a dual-typeface system to balance character with extreme legibility.

*   **Display & Headlines (Space Grotesk):** This font brings a technical, brutalist edge. Its wide apertures and monospaced-adjacent feel make it perfect for table numbers (`headline-lg`) and order totals (`display-sm`).
*   **Body & Labels (Work Sans):** A high-performance sans-serif designed for screen legibility. Used for modifiers, guest notes, and system metadata.

**Hierarchy Tip:** Use `headline-sm` (1.5rem) for active kitchen tickets. The bold weight of Space Grotesk ensures that a chef can read a "Medium-Rare" modifier from six feet away.

---

## 4. Elevation & Depth

We avoid traditional drop shadows in favor of **Tonal Layering**.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural lift.
*   **Ambient Shadows:** If an element must float (e.g., a modal), use a diffused shadow: `0px 20px 40px rgba(28, 27, 27, 0.06)`. The shadow color is a tint of `on-surface`, not a generic grey.
*   **The Ghost Border:** For accessibility in high-glare environments, use a `1px` border of `outline-variant` (`#c4c7c7`) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` (`#000000`) with `on-primary` text. Border-radius: `DEFAULT` (`0.25rem`) for a sturdy, architectural look.
*   **Secondary:** `secondary-container` (`#a0f399`) for positive actions (e.g., "Serve").
*   **Tertiary:** Ghost style—no background, `on-surface` text with a `label-md` weight.

### Input Fields
*   **Construction:** Use `surface-container-high` as the background. No bottom line.
*   **States:** On focus, shift background to `surface-container-highest`. Use `primary` for the cursor/caret.

### Cards & Lists (The Ticket System)
*   **Constraint:** Forbid divider lines.
*   **Execution:** Use `spacing-4` (`0.9rem`) of vertical white space to separate list items. Use a `surface-container-low` block to group related items (e.g., all drinks in an order).
*   **Status Indicators:** Use a thick vertical bar (4px) on the left edge of a card using `secondary` (Success) or `tertiary` (Alert) to indicate status instantly.

### Kitchen Display System (KDS) Chips
*   **Action Chips:** High-contrast `surface-container-highest` with `space-grotesk` bold text. These must look like physical buttons that can be "slapped" on a tablet.

---

## 6. Do’s and Don’ts

### Do
*   **DO** use `spacing-8` and `spacing-10` to create "Editorial Breathing Room" around critical data points.
*   **DO** use `secondary` (`#1b6d24`) exclusively for completed tasks.
*   **DO** stack typography (e.g., a `label-sm` category header directly above a `headline-md` value) to create clear information clusters.

### Don’t
*   **DON'T** use 1px solid borders to create a grid. Use the background tokens.
*   **DON'T** use rounded corners larger than `lg` (`0.5rem`). This system is built on "sturdy" geometry, not "soft" consumerism.
*   **DON'T** use standard "Grey" for disabled states. Use `outline-variant` with 30% opacity to maintain the tonal harmony of the system.
*   **DON'T** use shadows on every card. Reserve elevation only for elements that temporarily interrupt the workflow (modals, popovers).

---

## 7. Spacing & Grid

This system relies on a strict **Power-of-Two** influenced scale but tailored for touch-targets.
*   **Standard Touch Target:** Minimum `spacing-12` (`2.75rem`) for any interactive element.
*   **Gutter System:** Use `spacing-5` (`1.1rem`) as the default gap between ticket columns to prevent visual bleed in fast-paced environments.```