# Chrome Web Store Listing — Trackrr Sync

> Last Updated: 2026-09-19

## Store Listing

**Extension Name** [REQUIRED]  
Trackrr Sync - Instagram Helper

**Short Description** [REQUIRED]  
Automatically sync Instagram Reel thumbnails, captions, views, and live likes directly into your Trackrr dashboard.

**Detailed Description** [REQUIRED]  
Trackrr Sync is the companion browser extension for Trackrr that automates metadata fetching for your freelance video production workflow.

FEATURES
• Live Video Sync — Automatically fetch full-resolution thumbnails, dates, captions, views, and live likes for Instagram Reels.
• Zero API Keys Required — Uses your existing active browser session with no developer setup, tokens, or expiration headaches.
• Seamless Dashboard Integration — Links directly with your Trackrr project board to update video cards in real-time.
• Privacy-Focused — Runs locally on your machine and never stores, tracks, or shares your personal credentials.

HOW TO USE
1. Open your Trackrr dashboard.
2. Paste an Instagram Reel URL into any video task or batch item.
3. Trackrr Sync automatically retrieves the high-resolution cover thumbnail, view count, like count, and caption.
4. You can also click the extension icon in your Chrome toolbar anytime to manually test any Reel URL.

PRIVACY & PERMISSIONS
This extension runs entirely locally within your browser. It does not collect personal data, sell user information, or store passwords. Permissions are strictly utilized to read public Instagram reel metadata and communicate with your Trackrr workspace tab.

SUPPORT
Need help or want to report an issue?
GitHub: https://github.com/Akashbenniamin/Trackrr

Version 1.0.0 — Initial release with automated thumbnail, date, views, and likes extraction.

**Category** [REQUIRED]  
Productivity

**Single Purpose** [REQUIRED]  
Extract public Instagram Reel metadata (thumbnails, view counts, like counts, captions) and sync them into the Trackrr video tracking dashboard.

**Primary Language** [REQUIRED]  
English

---

## Graphics & Assets Required by Google

| Asset | Dimensions | Status | Notes |
|-------|-----------|--------|-------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | Located at `trackrr-extension/icons/icon-128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Needed | Screenshot of the Trackrr extension popup or video card showing synced likes/views |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Needed | Screenshot of Trackrr Batchflow showing reels synced with cover images |
| Small Promo Tile [RECOMMENDED] | 440×280 PNG | ⬜ Optional | For promo placement on the Web Store |
| Marquee Promo Tile | 1400×560 PNG | ⬜ Optional | For featured placements |

---

## Permissions Justification (Copy-Paste for Review Form)

| Permission | Type | Justification |
|------------|------|---------------|
| `storage` | permissions | Used to store user preferences and temporary sync session state locally. |
| `*://*.instagram.com/*` | host_permissions | Required to fetch public Reel metadata (cover image, views, likes, caption) using the user's active session. |
| `http://localhost/*`, `http://127.0.0.1/*`, `https://*/*` | host_permissions / content_scripts | Enables the bridge content script to communicate metadata back to the user's Trackrr web app tab. |

---

## Privacy & Data Use Disclosure Form

**Does the extension collect user data?** No  
The extension operates completely client-side. No personal data, browsing history, financial info, or cookies are stored on any external server.

### Data Use Certification:
- [x] Data is NOT sold to third parties.
- [x] Data is NOT used for purposes unrelated to the extension's core functionality.
- [x] Data is NOT used for creditworthiness or lending purposes.

---

## Privacy Policy (Can be published to GitHub or website)

```markdown
# Privacy Policy for Trackrr Sync

Last updated: September 19, 2026

Trackrr Sync ("the Extension") is a companion tool for Trackrr designed to facilitate video metadata retrieval.

1. Information We Do Not Collect
Trackrr Sync does NOT collect, store, transmit, or sell any personal information, browsing history, login credentials, or private communication.

2. How the Extension Works
The Extension operates entirely within your browser on your device. When you trigger a sync for an Instagram Reel, the extension inspects public page metadata (video title, cover thumbnail URL, view count, and like count) and communicates this data strictly to your open Trackrr tab.

3. Third-Party Sharing
No user data is ever sent to third parties or external servers.

4. Contact
For questions regarding this privacy policy, please open an issue at:
https://github.com/Akashbenniamin/Trackrr
```

---

## Distribution

- **Visibility**: **Unlisted** (Recommended: only people who have the direct link can install it) or **Public** (Visible to everyone in Web Store search).
- **Pricing**: Free.
- **Regions**: All regions.

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-19 | Initial companion release for Reel thumbnail, date, view, and like count extraction. | Draft |
