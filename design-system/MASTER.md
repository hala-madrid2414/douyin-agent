# Personal Travel Assistant Agent Full-Stack Project - Design System

Built on Ant Design X and the RICH Design Paradigm (Role, Intention, Conversation, Hybrid UI), dedicated to creating a simple, modern, refreshing, and friendly travel intelligent assistant experience.

## 1. Color System
- **Primary Color**: Cyan-blue travel theme color
  - `@primary-color`: `#0891B2` (Cyan-600) - Used for primary buttons, active states, and brand communication.
  - `@primary-color-hover`: `#22D3EE` (Cyan-400) - Used for hover states.
  - `@primary-color-active`: `#0E7490` (Cyan-700) - Used for click/active states.
- **Secondary Colors**: 
  - `@success-color`: `#10B981` (Emerald-500) - Used for success states and completed itineraries.
  - `@warning-color`: `#F59E0B` (Amber-500) - Used for warnings and travel tips.
  - `@error-color`: `#EF4444` (Red-500) - Used for error prompts and blocking information.
- **Neutral Colors**:
  - `@text-primary`: `#0F172A` (Slate-900) - Headings and main text.
  - `@text-secondary`: `#475569` (Slate-600) - Secondary text, timestamps.
  - `@text-tertiary`: `#94A3B8` (Slate-400) - Placeholders, minor secondary text.
  - `@border-color`: `#E2E8F0` (Slate-200) - Dividers, borders.
  - `@bg-layout`: `#F8FAFC` (Slate-50) - Overall page background (e.g., left conversation list).
  - `@bg-container`: `#FFFFFF` - Chat area and card backgrounds.
- **Message Colors**:
  - **User Message**: Background `@primary-color` (`#0891B2`), Text `#FFFFFF`.
  - **AI Message (Agent)**: Background `#F1F5F9` (Slate-100), Text `#0F172A`.

## 2. Typography System
- **Font Family**: Prioritize system sans-serif fonts.
  - `font-family: 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;`
- **Sizes & Line Height**:
  - **H1 Heading**: `24px`, Line Height `1.4`, Weight `600` (For large module titles, e.g., "My Itinerary")
  - **H2 Heading**: `20px`, Line Height `1.4`, Weight `600` (For sidebar headers)
  - **H3 Heading**: `16px`, Line Height `1.5`, Weight `500` (For card titles)
  - **Body Text**: `14px`, Line Height `1.6`, Weight `400` (For main chat conversation)
  - **Caption**: `12px`, Line Height `1.5`, Weight `400` (For timestamps, small tips)
- **Conversation Layout Specs**:
  - Line height within chat bubbles remains `1.6`, paragraph spacing `8px`, ensuring comfortable reading of long texts.
  - Quoted content uses a left vertical line + indent style, with lighter color.

## 3. Spacing System
Adopts a 4px/8px multiple grid system.
- **Micro Spacing**: `4px` (e.g., spacing between icon and text)
- **Small Spacing (Inner Component)**: `8px` (e.g., list items, padding inside tags)
- **Base Spacing**: `16px` (e.g., padding inside bubbles, padding inside input boxes)
- **Medium Spacing (Block)**: `24px` (e.g., vertical spacing between bubbles, card margins)
- **Large Spacing (Layout)**: `32px` / `48px` (e.g., spacing between different content blocks)
- **AI Chat Layout**:
  - Left conversation list width: `280px` (Responsive collapse)
  - Chat area max-width: `800px` (Center aligned, ensuring reading sightline doesn't shift)
  - Bottom input area height: Adaptive, base height `60px`, max not exceeding `200px`.

## 4. Component Specs
- **Chat Bubbles**:
  - Border Radius: `12px` (Single-side convergence, e.g., top-left corner of left AI bubble set to `4px` to indicate conversation direction).
  - Shadow: Use no shadow or very light shadow `0 2px 8px rgba(0,0,0,0.04)` on light backgrounds.
- **Input Area**:
  - Adopts Ant Design X `Sender` component style.
  - Border Radius `24px`, with light gray border, border turns primary color on Hover.
  - Internally includes: Additional toolbar (image upload, location, voice), input area, send button (primary color rounded).
- **Buttons**:
  - Border Radius `8px`.
  - Primary Button: Solid blue.
  - Default/Ghost Button: White/transparent background, light gray border, darkens on Hover.
- **Loading State**:
  - AI Thinking: Use classic three-dot blinking animation (AntX style) or skeleton screen.
- **Cards**:
  - Border Radius `12px`, Border `1px solid #E2E8F0`, slight float on hover (`translateY(-2px)`) and shadow `box-shadow: 0 4px 12px rgba(0,0,0,0.08)`.
- **Timeline**:
  - Used for itinerary planning. Nodes use theme color, connecting lines use `@border-color`, supports expand/collapse of daily itinerary.

## 5. Light/Dark Mode
- **Dominant Mode**: Light Mode is primary, emphasizing the lightweight and refreshing feel of travel.
- **Dark Mode Compatibility**:
  - Background: `#0F172A` (Slate-900)
  - Card/Bubble Color: `#1E293B` (Slate-800)
  - Main Text Color: `#F8FAFC` (Slate-50)
  - Border: `#334155` (Slate-700)
  - Images/Cards need 10% brightness reduction (filter processing) in dark mode.

## 6. Interaction Specs
- **SSE Streaming Output**:
  - Text appears word by word using a typewriter effect.
  - Markdown rendering must support real-time parsing without noticeable layout jumping.
- **Loading & Feedback**:
  - After clicking any button or sending a message, immediately clear the input box and add a "Thinking..." placeholder in the message stream, delay response < 200ms.
- **Hover & Transitions**:
  - All interactive elements must have `cursor: pointer`.
  - Transition animation: `transition: all 0.2s ease-in-out`.
- **RICH Paradigm Implementation**:
  - **Role**: Clearly define the AI's tour guide role, friendly tone.
  - **Intention**: Support quick Tag prompts (e.g., "Recommend routes", "Check weather") during user input.
  - **Conversation**: Support contextually coherent interruption and regeneration.

## 7. Generative UI Specs / Hybrid UI
Based on Ant Design X's Hybrid UI concept, when AI returns specific structured travel data, it renders directly as interactive frontend components:
- **Itinerary Planning Component**:
  - Renders as a visual Timeline or Map Card.
  - Supports clicking "Modify this day's itinerary" or "Add to my favorites" directly on the card.
- **Hotel/Attraction Recommendation Component**:
  - Renders as horizontally scrolling Carousel Cards.
  - Includes: Header image, name, rating, price, "Book" button.
- **Travel Tips Component (Tips/Weather)**:
  - Renders as a lightweight Alert or Widget.
  - Includes icon (e.g., weather icon, warning icon) and short text, placed next to relevant conversation or itinerary.

---
> This specification is the global Source of Truth for this project. All UI component encapsulation, Tailwind/CSS variable configuration, and Ant Design Theme Provider during development must adhere to this.

## 8. Pre-Delivery Checklist
- [ ] Icon Specs: Do not use Emojis as UI icons, uniformly use SVG (Heroicons/Lucide recommended)
- [ ] Interaction States: All clickable elements must include `cursor-pointer`
- [ ] Visual Feedback: Hover states should have smooth transition animations (`transition-all duration-200`) and not cause layout jitter
- [ ] Accessibility: Text contrast in light mode must meet at least 4.5:1, keyboard focus visible
- [ ] Responsive: Adapts to 375px (Mobile), 768px (Tablet), 1024px, 1440px (Desktop)
- [ ] Hybrid Interface: Ensure seamless context transition when rendering component library, no abrupt jumping feeling