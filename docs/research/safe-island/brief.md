# Source brief and verification

Source: https://yubao-595.github.io/safe-island/
Inspection date: 2026-10-12 (Asia/Shanghai)

## Routes and ownership

| Source | Local | Files |
| --- | --- | --- |
| `/safe-island/` | `/` (dev alias `/safe-island/`) | `index.html`, `src/styles.css`, `src/scene.js`, `src/audio.js`, `src/main.js` |

One fixed viewport scene; no scroll sections or additional page navigation.

## Visual rules

- Perspective forest: camera (0, 5.2, 13), target (0, 1.4, -8), portrait FOV 64°, landscape 54°.
- Fog #c8e6a8, density 0.030; grass ground #6ba24a; layered cone trees, procedural animal meshes.
- Grass: 5,200 instances on mobile, 11,000 desktop; vertex shader wind. Pollen, dust, dandelions and god rays animate continuously.
- Pre-entry: dark radial veil and glass CTA. CTA center: desktop 58% height, mobile 56%.
- Entry: press shrink then spring; after 720ms CTA removed and UI revealed; lights and audio fade in.
- Masthead: serif 56px cap desktop, left 36/top 56; mobile 44px cap, left 24/top 36. Original spacing and light font weights retained.
- Breathing: center x=50%, y=52%, 200px desktop/170px mobile/150px below 380px; 4s inhale, 6s exhale.
- Player: bottom center glass pill; mobile bottom 44px, maximum 84vw (92vw below 380px); desktop bottom 24px.
- Breakpoints: 768px, 380px, short landscape height 480px.

## Asset provenance

| Source | Local |
| --- | --- |
| `/safe-island/forest-stream.mp3` | `public/sites/safe-island/forest-stream.mp3` (MP3, 48kHz stereo, 64kbps) |
| three@0.160.0 CDN | npm `three@0.160.0` |
| gsap@3.12.5 CDN | npm `gsap@3.12.5` |
| Google Fonts CSS | original Google Fonts URL retained |
| Inline hand-authored HTML, CSS, scene/audio/interaction JS | split into local editable files |

No image or video background. Textures are generated with Canvas. Trees and animals use actual geometry.

## Browser checks

- Original and local inspected at 390×844 and 1440×900.
- Entry transitions to masthead, breathing orb, player; entry button cannot be submitted twice.
- Actual local MP3 decoded (readyState=4), played after entry, paused (audio.paused=true), resumed through player.
- Player status and accessible Play/Pause names update correctly.
- No horizontal overflow at 390×844.
- Local browser error/warning log empty in checked states.
- Same typography, overlay positioning and atmosphere; procedural object placements differ between loads, as on source.

Screenshots: `source-mobile-entered.jpg`, `source-desktop-entry.jpg`, `source-desktop-entered.jpg`, `local-mobile-entry.jpg`, `local-mobile-entered.jpg`, `local-mobile-paused.jpg`, `local-desktop-entry.jpg`, `local-desktop-entered.jpg`.

Limitations: Google Fonts remains external; gyroscope permissions and hidden legacy controls were not exercised. Build's bundle-size advisory reflects the Three.js renderer.
