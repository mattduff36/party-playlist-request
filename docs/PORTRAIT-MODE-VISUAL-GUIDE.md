# Portrait Mode Visual Guide
**Visual reference for the portrait mode switching behavior**

---

## 📺 Layout States

### State 1: No Message (Landscape/Horizontal)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EVENT TITLE                                  │
├───────────────────────────┬─────────────────────────────────────────┤
│                           │                                         │
│  ┌────────┐  Track Name   │         🎶 UP NEXT                      │
│  │ Album  │  Artist       │                                         │
│  │  Art   │  Album        │    1. Song Name - Artist                │
│  └────────┘               │    2. Song Name - Artist                │
│    🎵 NOW PLAYING         │    3. Song Name - Artist                │
│                           │    4. Song Name - Artist                │
├───────────────────────────┤    5. Song Name - Artist                │
│  ┌────────┐  Scan QR or:  │    6. Song Name - Artist                │
│  │   QR   │  visit URL    │    7. Song Name - Artist                │
│  │  Code  │  PIN: 1234    │    8. Song Name - Artist                │
│  └────────┘               │    9. Song Name - Artist                │
│                           │   10. Song Name - Artist                │
└───────────────────────────┴─────────────────────────────────────────┘
```

**Grid Layout:**
- Now Playing: 2 columns wide (landscape orientation)
- QR Code: 2 columns wide (landscape orientation)
- Up Next: 4 columns wide

---

### State 2: Message Visible (Portrait/Vertical)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT TITLE                                          │
├─────────────────┬───────────────────────┬───────────────────────────────────┤
│                 │                       │                                   │
│   ┌────────┐   │                       │   📢 NOTICE BOARD                  │
│   │ Album  │   │   🎶 UP NEXT          │                                   │
│   │  Art   │   │                       │   John has requested               │
│   └────────┘   │  1. Song - Artist     │                                   │
│   Track Name   │  2. Song - Artist     │   "Sweet Caroline"                 │
│   Artist       │  3. Song - Artist     │   by Neil Diamond                  │
│   Album        │  4. Song - Artist     │                                   │
│ 🎵 NOW PLAYING │  5. Song - Artist     │   Added to the                     │
├─────────────────┤  6. Song - Artist     │   Party Playlist! 🎉               │
│   ┌────────┐   │  7. Song - Artist     │                                   │
│   │   QR   │   │  8. Song - Artist     │                                   │
│   │  Code  │   │  9. Song - Artist     │                                   │
│   └────────┘   │ 10. Song - Artist     │                                   │
│ Request now!   │                       │                                   │
└─────────────────┴───────────────────────┴───────────────────────────────────┘
```

**Grid Layout:**
- Now Playing: 2 columns wide (portrait orientation - FORCED)
- QR Code: 2 columns wide (portrait orientation - FORCED)
- Up Next: 4 columns wide (compressed)
- Notice Board: 2 columns wide (slides in from right)

---

## 🔄 Transition Flow

### Step 1: Message Arrives (Pusher Event)
```
isMessageVisible: false → true
finalUseHorizontalLayout: true → false (FORCED)
```

### Step 2: Grid Animates
- Grid columns change: `1fr 1fr 1fr 1fr` → `0.5fr 0.5fr 1fr 1fr 0.5fr 0.5fr`
- Duration: 1 second (ease-in-out)
- Notice board slides in from right

### Step 3: Layout Changes
- Now Playing switches: Landscape → Portrait
- QR Code switches: Landscape → Portrait
- Content re-flows vertically

### Step 4: Message Displays
- Duration: 10 seconds (configurable)
- Layout remains stable

### Step 5: Message Clears
```
isMessageVisible: true → false
finalUseHorizontalLayout: false → true (ResizeObserver determines)
```

### Step 6: Return to Original
- Grid columns animate back
- Notice board slides out
- Now Playing and QR Code switch back to landscape

---

## 🎨 CSS Transitions

### Grid Container
```css
transition: 
  grid-template-columns 1s ease-in-out,
  grid-template-rows 1s ease-in-out,
  margin-right 1s ease-in-out
```

### Notice Board
```css
/* Phase 1: Expand horizontally (300ms) */
width: 0 → 100%

/* Phase 2: Fade in text (400ms) */
opacity: 0 → 1

/* Phase 3: Expand vertically (300ms) */
height: 0 → auto
```

---

## 📱 Responsive Behavior

### TV/Large Display (Default)
- ResizeObserver monitors Now Playing dimensions
- Automatically switches between landscape/portrait based on space
- Notice board forces portrait mode

### Tablet
- Typically uses portrait mode by default
- Notice board further compresses layout

### Mobile
- Always uses portrait mode
- Notice board may overlap or scroll

---

## 🧪 Testing Checklist

- [ ] Display starts in landscape mode (wide screen, no message)
- [ ] Approve a request with "Show Requests when Approved" enabled
- [ ] Notice board slides in from right (smooth animation)
- [ ] Now Playing switches to portrait (image top, text bottom)
- [ ] QR Code switches to portrait (QR top, text bottom)
- [ ] Message displays for 10 seconds
- [ ] Message slides out (smooth animation)
- [ ] Now Playing switches back to landscape
- [ ] QR Code switches back to landscape
- [ ] No content cut off or overflow at any stage
- [ ] Transitions are smooth and professional

---

## 🎯 Key Benefits

1. **Automatic Adaptation:** Layout responds intelligently to notice board presence
2. **Content Preservation:** All information remains visible and readable
3. **Smooth UX:** Professional transitions without jarring jumps
4. **Space Optimization:** Maximizes use of available space in both states
5. **Maintainable:** Single computed value controls the entire behavior

---

## 💡 Implementation Detail

The key insight is using a **computed value** rather than modifying the ResizeObserver logic:

```typescript
// ❌ Complex: Modify ResizeObserver to account for message state
// ✅ Simple: Override the final layout value when message is visible

const finalUseHorizontalLayout = isMessageVisible ? false : useHorizontalLayout;
```

This approach:
- Doesn't interfere with existing ResizeObserver logic
- Maintains smooth transitions
- Easy to understand and maintain
- Works across all device types
- No side effects or race conditions

