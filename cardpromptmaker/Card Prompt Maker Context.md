## Tech Stack Requirements

- Next.js 14+ with App Router
- React with functional components and hooks
- Tailwind CSS for styling
- Framer Motion for animations
- Vercel-optimized build

Assets: 

prompts text.txt
images folder
daisyfeatures.txt

### Game States

Implement three game states:

- **Selecting**: Users can select/deselect cards (max 3)
- **Revealed**: Selected cards show content, clickable for expansion
- **Reset**: "Again" button returns to initial state

### Card Behavior

Each card should:

- Show identical back when face-down (gradient design)
- Highlight with glowing border when selected
- Flip simultaneously with other selected cards on reveal
- Display one of four content types randomly:
    - **Image**: Full card image, no text
    - **Text Prompt**: Centered text from prompts text.txt
    - **Feature**: Labeled feature from daisyfeatures.txt

### User Interactions

- **Desktop**: Hover effects on cards
- **All devices**: Tap/click to select (max 3 cards)
- **Visual feedback**: Selected cards get glowing border
- **Button states**:
    - "Choose 3" (disabled) → "Choose 2" → "Choose 1" → "Reveal" (active)
    - After reveal: "Again" (resets everything)


## Expanded View Modal

once revealed, a modal should pop up show the three selected pieces together for the user to get inspired by. 

## Styling Requirements

- Mobile-first responsive design
- Dark mode support using Tailwind classes
- Smooth animations (0.6s card flips)
- Gradient backgrounds for face-down cards
- Clean, minimal aesthetic
- Proper z-index layering for modal

## Animation Specifications

Using Framer Motion:

- Card hover: scale(1.05)
- Card tap: scale(0.95)
- Card flip: rotateY 180deg, duration 0.6s
- Modal: opacity fade + scale animation
- All selected cards flip simultaneously