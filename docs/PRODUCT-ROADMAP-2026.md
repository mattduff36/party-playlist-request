# Product Roadmap & Monetization — 2026

**Product:** Party Playlist — multi-tenant DJ request system. Guests search Spotify tracks; DJs approve/reject; approved songs go to Spotify queue/playlist; a venue display shows now-playing and QR.

**Why it exists:** Close the gap between “what the crowd wants” and “what the DJ plays” without chaos — PIN-gated guest UX, DJ control, live display.

---

## Near-term product improvements (post redesign)

| Idea | Value | Effort |
|------|-------|--------|
| Guest toast confirmation on submit | Clear feedback without relying on console/Pusher alone | Low |
| Soften Spotify polling further + search cache | Stay within API limits as tenants grow | Medium |
| Redis-backed guest rate limits in production | Fair multi-instance protection | Medium |
| Split display/request mega-pages | Maintainability + hydrate cost | Medium |
| DJ analytics (requests/hour, top artists, approval rate) | Sticky for professional DJs | Medium |
| Sentry / error monitoring | Faster production diagnosis | Low |

---

## Feature suggestions

### 1. Pay-to-jump the queue (recommended flagship monetization)

**Concept:** Guests pay a small amount (Stripe Checkout / Payment Element + Apple Pay / Google Pay wallets) to move an approved (or pending) request toward the top of the DJ’s queue.

**Product rules (suggested):**

- DJ toggle: enable/disable boosts per event; set price and max boosts per guest/hour.
- Boost does not bypass DJ approval unless DJ opts into “auto-approve boosted”.
- Fair-use: cap stack of paid jumps; show “Boosted” badge on admin + display.
- Platform take-rate (e.g. 15–30%) + Stripe fees; remainder to DJ Connect account (Stripe Connect Express).

**Why it fits:** Aligns with nightlife tipping culture; optional for guests; high willingness-to-pay at peak moments.

**Out of scope for current code phase** — design only until a dedicated Stripe initiative.

### 2. Tip jar / request tipping

Lightweight alternative to queue jumps: tip the DJ after requesting or when a song plays. Lower conflict with “fair queue” than jumps; good for weddings/venues that dislike pay-to-skip.

### 3. DJ subscription tiers (SaaS)

| Tier | Example limits |
|------|----------------|
| Free / Invite | 1 event, basic display moods |
| Pro | Multi-event history, custom domain, analytics, higher request caps |
| Venue | Multi-DJ seats, white-label display, invoicing |

Fits current invitation-only registration — open self-serve when billing exists.

### 4. Guest reactions & song wars

Quick upvote / reaction on pending or queued tracks so the DJ sees crowd heat without payments. Can later combine with boosts (“boosted + 12 votes”).

### 5. QR table tents & short links

Printable kits + branded short URLs (`partyplaylist.app/j/abc`) for venues. Upsell physical/PDF packs.

### 6. Event packs & white-label

One-night licenses for wedding planners; venue-branded guest pages (logo, mood locked to Venue).

### 7. Offline / standby polish

Richer pre-show modes: countdown, playlist teaser, “doors open” messaging — increases display value before live.

---

## Monetization models

1. **Take-rate on boosts / tips** — usage-based, aligns with successful party nights.  
2. **SaaS subscriptions for DJs** — predictable MRR.  
3. **Venue / agency white-label** — higher ACV, longer sales cycle.  
4. **Event packs** — one-off purchases for planners.  
5. **Hardware + software** — optional tablet/TV setup guides or partner kits (later).

**Recommended sequence:**

1. Finish reliability (Spotify limits, rate limits, monitoring).  
2. Open registration behind Pro waitlist.  
3. Ship **pay-to-jump** with Stripe Connect + DJ opt-in.  
4. Add analytics + Pro subscription.  
5. Pursue venue white-label once Pro retention is proven.

---

## Success metrics to track

- Events live per week  
- Requests per live hour  
- Approval latency  
- Spotify 429 rate  
- Boost conversion (when shipped)  
- DJ 7-day retention after first live event

---

## Explicit non-goals (this initiative)

- No Stripe / Apple Pay implementation in the redesign phase  
- No schema migration to 4-table JSONB in this pass (see older improvement docs)
