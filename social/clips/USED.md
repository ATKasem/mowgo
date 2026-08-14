# MowGo Reel Clip Usage Log (no-reuse enforcement)

HARD RULE (Blasian, 2026-08-05): Never use the same footage twice. Minimum 100 posts between any reuse; nothing remotely similar — a different crop/window of the same source video counts as reuse. Check this file BEFORE every build. Append after every post.

## BURNED — duplicates/near-dups removed in 2026-08-06 review (Claude Code + visual audit). DO NOT re-add, even to a fresh library.

| Pexels ID | Reason |
|-----------|--------|
| 10470707, 10470710, 10470713, 10470722, 10470803 | Same meadow brushcutter shoot as 10470705 (multi-cam / series) |
| 9477577, 9477578, 9477580, 4503127 | Same trimmer edging session as 9477579 (same creator series) |
| 12215819, 12215821 | Same brick-house yard shoot as 12215822 |
| 12694116, 12694267 | Same riding-mower slope shoot as 12694118 |
| 37733805 | Near-dup of 31248623 (same electric mower, same framing) |
| 8094033 | Same take as 8094032 (two crops of one shot) |
| 5176975 | Same series as 5176974 + POV near-dup of 4823979 |
| 3750304 | Wide-garden near-dup of 35281467 |
| 856176 | Grass closeup near-dup of 855857 |
| 37955528 | JUNK — not lawn footage (hair close-up) |

## Used reels

| Date | Reel file | Source | Source ID/URL | Notes |
|------|-----------|--------|---------------|-------|
| 2026-08-05 | reel-mower-gatecode.mp4 | Mixkit | 49476 (assets.mixkit.co/videos/49476/49476-720.mp4) | Approved sample #1 (push mower, residential) |
| 2026-08-05 | reel-mower-pause.mp4 | Mixkit | 49476 (SAME CLIP as above — DIFFERENT WINDOW) | ⚠️ VIOLATION caught by Blasian. Same source reused. Forbidden pattern — never again. |
| 2026-08-05 | reel-electric-spring.mp4 | Pexels | 31290564 (pexels.com/video/lawn-mowing-with-electric-mower-in-spring-31290564/) | Approved sample #3 (4K electric mower, cinematic) |
| 2026-08-05 | reel-sample-gatecode.mp4 | none (text card animation) | n/a | Card-only reel, no footage consumed |
| 2026-08-07 | reel-fri-drive.mp4 | Pexels | 12694118 (pexels.com/download/video/12694118/) | Fri Efficiency: 2 hours a day driving. Native vertical 1080x1920, window scale=920:1636, @mowgoapp watermark. Media ID 18123407305751820 |

## Notes
- First Pexels-powered cron run: Fri 2026-08-07 18:00 UTC (job d832decd1cdd).
- Mixkit 49476 is BURNED (used twice). Do not use again until 100+ posts pass.
- Local reserve clips: pex-12694118.mp4 (vertical golf riding mower) — USED 2026-08-07 (reel-fri-drive.mp4). pex-31290564.mp4 (burned source) — FILE DELETED 2026-08-06 (disk cleanup); burn decision preserved here, do NOT re-download it.
