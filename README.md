# MAREA: Bottled from the deep

A concept site for a fictional Caribbean niche fragrance house, built by **Portside Digital** to show off award-level web animation. It comes with a 9:16 Instagram Reel ad generated from the site itself.

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

## The ad

`ad/ad.mp4` is 1080×1920, 30 fps, H.264 + AAC, 15.5 s. `ad/ad-silent.mp4` is the same video without audio.

It's modelled on the structure of [this reel](https://www.instagram.com/reel/DdAgrCAO4km/): a rejection DM over boring footage, then a hard cut on the drop to the flex, with a caption that stays on screen. The analysis is in `reference/reel-analysis.md` and the beat map is in `reference/beats.json`. The reel's song is only 8.1 s, so the drop phrase (3.556–6.023 s, cut just before each drop transient) is looped three more times. Every repeat opens on a drop hit.

| Time | Shot |
|---|---|
| 0.00–3.60 | Bland template site with a "sorry, only big brands" DM |
| 3.60 (drop) | Hard cut to MAREA, letterboxed; caption "Your loss lil bro" |
| 5.13 | Scent switch → N°02, colour swaps on the 5.43 hit |
| 6.03 (drop) | Wide angle, a cursor scatters the swarm |
| 7.57 | Notes: "Night-blooming cereus" |
| 8.50 (drop) | The collection slides across |
| 10.03 | Scent switch → N°03 Ember |
| 10.97 (drop) | Zoom through "DEEP" |
| 12.50 | Push-in, fast switch back to N°01 |
| 13.47 (2nd drop) | Wide burst |
| 14.37 | End card; credit on 14.83, WhatsApp CTA on 14.97 |

The ad is a mode of the site: open `index.html?ad=1` to see the 1080×1920 layout. To re-record it:

```bash
yt-dlp -o "reference/reel.%(ext)s" "https://www.instagram.com/reel/DdAgrCAO4km/"
node ad/record.mjs
```

The recorder renders each frame `i` at exactly `t = i / 30` (fixed-step physics, a GSAP timeline that seeks to each frame), so every cut lands on its beat. It then builds the soundtrack from the reel's audio (`ad/music.m4a`, AAC 192k, sample-accurate loop of the drop phrase with 4 ms seam fades) and muxes both from t = 0. Use `node ad/record.mjs --frames` to render frames only.

## Credits

- Libraries: [Three.js](https://threejs.org) r170, [GSAP](https://gsap.com) 3.13 (ScrollTrigger, SplitText, CustomEase), [Lenis](https://lenis.darkroom.engineering).
- Fonts: Bodoni Moda, Inter Tight and JetBrains Mono (Google Fonts, SIL OFL).
- Studio lighting: [studio_small_09](https://polyhaven.com/a/studio_small_09) HDRI by Poly Haven (CC0), in `assets/studio.hdr`.
- The bottle, pearls, sea glass, label and every effect are modelled in code; there are no stock images or 3D models.
- Ad soundtrack: the audio of the reference Instagram reel above. It belongs to its rights holders and is used here only for the ad. Check the licence before running it as a paid ad.
- Design and build: Portside Digital.
