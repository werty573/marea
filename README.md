# MAREA: Bottled from the deep (+ Soda)

Two concept sites built by **Portside Digital** to show off award-level web animation:

- **MAREA** (`index.html`): a fictional Caribbean niche fragrance house.
- **Soda** (`soda/index.html`): a fictional diet soda with a photoreal 3D can.

It comes with a 22 s 9:16 Instagram Reel ad generated from both sites.

> MAREA is fictional. The "Reserve" and "Concept site" links go to Portside Digital on WhatsApp (868-259-1409).

## Open the site

The whole site is one file, `index.html`, plus `assets/`. All libraries load from CDNs. Serve it locally (double-clicking works too, but browsers block the HDRI on `file://`, so the glass falls back to a simpler procedural studio):

```bash
node scripts/serve.mjs
```

Then open http://localhost:5173.

What's inside:
- **Preloader → hero reveal**: a 000→100 counter, then a circular mask opens out of the bottle while the MAREA letters rise through masks. The bottle surfaces with a settling spin and the pearl swarm bursts outward.
- **Realistic bottle, rendered live** (Three.js, physically based): thick glass with real refraction, dispersion and clearcoat. It's lit by a studio HDRI and bends both the background and the giant MAREA title behind it. The liquid is see-through and tinted, refracts what's behind it, and sloshes on a damped spring driven by the bottle's spin and tilt. It has a champagne-metal collar, a nacre pearl stopper (iridescence + sheen) and a screen-printed label. The bottle tilts toward the cursor on a spring.
- **Physics swarm**: real-material pearls and frosted sea-glass shards orbit the bottle, get pushed away by the cursor (harder when you move fast) and spring back. 4,000+ plankton particles drift upward and part around the pointer.
- **Background shader**: deep-water gradient, caustics, god rays, cursor ripples, and a liquid colour flood that spreads from wherever you click.
- **Scent switch** (N°01 / N°02 / N°03): colour flood, 720° spin with real motion blur (driven by spin velocity), and the swarm implodes into the bottle then explodes back out. The liquid and label swap at the peak of the spin.
- **Scroll story** (GSAP ScrollTrigger + Lenis): a pinned manifesto with words lighting up on scroll; pinned notes where the bottle turns a full revolution; a horizontal collection with 3D-tilt cards; a zoom-through the word DEEP; parallax stats and marquees; a depth meter that counts down to 1,200 m.
- **Polish**: custom spring cursor that stretches with speed, magnetic buttons, film grain, vignette, a light sweep, and chromatic aberration.
- **Respects `prefers-reduced-motion`** (simple fades, no pinning or spin), caps pixel ratio and particle counts on phones, and is fully responsive.

Check it with Playwright (console errors plus screenshots at 1440×900 and 390×844):

```bash
npm install
npx playwright install chromium
node scripts/check.mjs shots
```

## Soda (`soda/`)

The soda site is a full-screen hero (no scroll), live at `/soda/`:
- **Photoreal can**, modelled in code: a lathe-turned aluminium body with neck, rolled rim, recessed lid, pull tab and domed base. The printed wrap, metal/roughness map and cold-can **condensation** (thousands of droplets turned into a normal map, plus a wet clearcoat mask) are all drawn in code.
- **Cherries and blueberries** with real materials (clearcoat skin, dusty bloom sheen) and leaves. The berries in front sit above the copy and the can sits behind it. They drift, get pushed away by the cursor and spring back.
- **Flavour switch**: an animated radial-gradient flood (registered `@property` colours), a 720° spin with velocity motion blur, and the wrap swaps at the peak. The berries implode, swap cherry ↔ blueberry, then explode to new positions.
- The **flavour cards** use live renders of the same can, and the rising bubbles are frame-exact.
- `?cam=macro` gives a product close-up; `?flavor=blue` starts on Zero Lime.
- Check it: `node scripts/check-soda.mjs shots`.

## The ad

`ad/ad.mp4` is 1080×1920, 30 fps, H.264 + AAC, 22 s. `ad/ad-silent.mp4` is the same video without audio.

It's modelled on the structure of [this reel](https://www.instagram.com/reel/DdAgrCAO4km/): a rejection DM over a boring site, then a hard cut on the drop to the flex, with the caption held across every shot. The analysis is in `reference/reel-analysis.md` and the beat map is in `reference/beats.json`. The reel's song is only 8.1 s, so the intro (0–3.556 s) is time-stretched with Rubber Band to 5.126 s, keeping the pitch and repeating nothing, to give the DM about 5 s. Then the drop phrase (3.556–6.023 s) loops five times. Every seam sits just before an onset, and every cut is within one frame of its hit.

| Time | Shot |
|---|---|
| 0.00 | Template site + "only for big brands" DM |
| 5.17 (drop) | MAREA reveal, letterboxed; caption "Your loss lil bro" |
| 6.70 | MAREA → N°02 |
| 7.60 (drop) | The real MAREA site scrolling on a phone |
| 10.07 (drop) | Cursor scatters the swarm |
| 11.60 | Notes: "Night-blooming cereus" |
| 12.53 (drop) | The real soda site: entrance + cursor |
| 14.07 | Can macro, condensation |
| 15.00 (drop) | Soda flavour switch → blueberries |
| 17.47 (drop) | Zoom through "DEEP" |
| 19.00 | Push-in, switch to N°03 Ember |
| 19.97 (2nd drop) | Ember burst; 20.43 blue can macro |
| 20.90 | Portside Digital end card; tagline 21.33, WhatsApp 21.50 |

### Ads 2–5: website showcases

These show the websites working, not just products. Every shot is a real site in a phone or browser frame, recorded live with a visible cursor (desktop) or tap ring (phone), with a chip naming the feature. They use MAREA, Soda, and the five demo sites on GitHub Pages: Tamarind Table, Gloss Lab, Leeward House, Pulse Yard and Gilded Hour.

| File | Reference | Length | Idea |
|---|---|---|---|
| `ad/ad2.mp4` | [reel 2](https://www.instagram.com/reel/Db9_b7kp1jt/) and its song | 16.8 s | **Wireframe → real.** A pencil wireframe of the site (phone and desktop, notes, user flow, style) builds word by word with the spoken line. On the drop it comes alive on a real phone, then one feature per hit: cursor-reactive 3D, one-click restyle, before/after reveal, live booking calendar (dates → total), class timetable, reservations, a product configurator, and a grid of every site on mobile. |
| `ad/ad3.mp4` | [reel 3](https://www.instagram.com/reel/DcKe2sfIsiG/) and its song | 18.3 s | **Down the grate.** The original "what is bro filming 💀" intro is kept untouched. In the dark, our own code streams past while the page "loads" to 100%, then a hidden room lined with live websites (like the reel's card shop) appears, with a whip pan along the wall. Then each site in action: scroll story, hover gallery, quote builder, validated lead form, pinned menu, tap-to-restyle, configurator, and a pull-back to the whole wall. |
| `ad/ad4.mp4` | [reel 4](https://www.instagram.com/reel/Dd1EWJOSXWM/) and its song | 14.5 s | **Move your thumb to the beat.** The reference's own thumb intro, untouched, then 14 swipes (alternating left/right exactly like the reference) through the sites full screen on a phone (mobile browser bar, feature tags), each landing on a beat, ending on the Portside card. |
| `ad/ad5.mp4` | [reel 5](https://www.instagram.com/reel/DdXH5zMsLtI/) and its audio | 37.4 s | **Close the app, open the site.** The original near-miss Reel and swipe out through the iOS app switcher are kept. Safari is flicked away to reveal a MAREA card that opens full screen. Then ~20 live shots of all seven sites on the reference's cuts, a flicker roll through every site, the wall of websites, and the Portside card. |

Both loop one post-drop phrase of their song once (seams just before onsets). The analyses are in `reference/reel2/analysis.md` and `reference/reel3/analysis.md`.

The ad is a mode of the site: open `index.html?ad=1` to see the 1080×1920 layout. To re-record it:

```bash
yt-dlp -o "reference/reel.%(ext)s" "https://www.instagram.com/reel/DdAgrCAO4km/"
yt-dlp -o "reference/reel2/reel.%(ext)s" "https://www.instagram.com/reel/Db9_b7kp1jt/"
yt-dlp -o "reference/reel3/reel.%(ext)s" "https://www.instagram.com/reel/DcKe2sfIsiG/"
yt-dlp -o "reference/reel4/reel.%(ext)s" "https://www.instagram.com/reel/Dd1EWJOSXWM/"
yt-dlp -o "reference/reel5/reel.%(ext)s" "https://www.instagram.com/reel/DdXH5zMsLtI/"
node ad/record.mjs      # ad 1 → ad/ad.mp4
node ad/record.mjs 2    # ad 2 → ad/ad2.mp4
node ad/record.mjs 3    # ad 3 → ad/ad3.mp4
node ad/record.mjs 4    # ad 4 → ad/ad4.mp4
node ad/record.mjs 5    # ad 5 → ad/ad5.mp4
node ad/record.mjs 3 --reuse   # keep already-recorded site clips while tweaking
```

Ads 2 and 3 record the five demo sites from their live GitHub Pages URLs.

How the recorder works:

- **Base video:** it renders the base timeline frame by frame at exactly `t = i / 30` (fixed-step physics and a GSAP timeline that seeks to each frame).
- **Live clips:** it records the live-site clips with Playwright's fake clock (1/30 s per frame) and splices them into the base timeline's slots, then lays the caption over them.
- **Soundtrack:** it builds the soundtrack from the reel's audio (`ad/music.m4a`, AAC 192k, sample-accurate loop of the drop phrase with 4 ms seam fades) and muxes both from t = 0. Use `node ad/record.mjs --frames` to render frames only.

## Credits

- Libraries: [Three.js](https://threejs.org) r170, [GSAP](https://gsap.com) 3.13 (ScrollTrigger, SplitText, CustomEase), [Lenis](https://lenis.darkroom.engineering).
- Fonts: Bodoni Moda, Inter Tight and JetBrains Mono (Google Fonts, SIL OFL).
- Studio lighting: [studio_small_09](https://polyhaven.com/a/studio_small_09) HDRI by Poly Haven (CC0), in `assets/studio.hdr`.
- The bottle, pearls, sea glass, label and every effect are modelled in code; there are no stock images or 3D models.
- Ad soundtracks and ad 3's opening footage come from the reference Instagram reels above. It belongs to its rights holders and is used here only for the ad. Check the licence before running it as a paid ad.
- Design and build: Portside Digital.
