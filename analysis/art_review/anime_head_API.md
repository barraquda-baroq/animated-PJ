# anime_head.js — API reference (heads, faces, hair, expressions, busts)

`pv/engine/lib/anime_head.js` extends `PV.anime` (the style kit in `anime.js`) with the anime-style character heads of
『キミの右手のアイロニー』: 先輩 (`senpai`), 彼 (`boy`), 叔母 (`aunt`).
Showcases: `pv/scenes/_dev_anime_head.js` (shots `dev_anime_head_1` … `_8`, plus dev tools `_zoom`, `_perf`, `_dbg`).
Review renders: `analysis/art_review/anime_head/`.

```
cd /home/user/animated-PJ && node tools/build_index.cjs
node render/still.cjs --dev dev_anime_head_1 --dur 6 --times 0,2,4 --out /tmp/x --sheet
```

## 1. How a head is built (2.5D model sheet)

* Every character has a **head volume** defined by model-sheet curves in head units **H** (chin y=0, crown y=−1,
  x to the viewer's right at yaw 0, z toward the viewer): front half-width `w(y)`, face line `zf(y)` (profile without
  nose/lips), side line `zs(y)`, back line `zb(y)`, plus narrow nose / lip bumps, eye sockets and cheekbones.
* Horizontal **slices** of the volume are rotated (pitch about the neck point, then yaw) and projected; their extremes
  give the silhouette. Front, 3/4, profile, lost-profile and back views all come from one model and turn smoothly.
* Features sit on that surface and turn with it. **Eyes** are flat anime shapes drawn in their own foreshortened 2D frame
  (the far eye is squeezed less than real; near |yaw|=1 the eye becomes a wedge with the iris at the front).
  Brows, nose, mouth, blush and tears are drawn on the surface.
* **Hair** = a smooth cap (offset of the skull silhouette above the projected hairline) + clumps (3D centre lines →
  2D ribbons with pointed tips) drawn far-to-near with tapered ink, a root shadow, a cel shadow on the side away from the
  light, a light→tip gradient and a zig-zag **angel ring** that crosses the cap and the clumps. Clumps that lie on the
  scalp have no ink until they leave the head (no "noodle" lines on the head).
* **Light**: every tone comes from `PV.anime.mat(material, light)`. Faces/necks use `PV.anime.faceLight(light)`
  (dark scenes lifted so faces stay readable). Rim light = crisp band on the light-facing **outer** silhouette only
  (a coarse occupancy mask decides which edges face open air; the band replaces the line on the lit side).

## 2. `PV.anime.head(ctx, o)` → anchors

Draws one head in `ctx`'s current transform (camera transforms are fine).

| option | meaning |
|---|---|
| `who` | `'senpai'` \| `'boy'` \| `'aunt'` |
| `x, y` | **neck point** = centre of the neck where it meets the jaw (pivot for pitch/roll). At pitch 0 the chin is `0.12·size` below it and the crown `0.88·size` above it. |
| `size` | head height in px (chin → crown, without hair volume) |
| `yaw` | −1…1. 0 faces the viewer, +1 profile facing screen-right, −1 profile facing screen-left |
| `back` | `true` → back view. With `back`, `yaw` is measured from the back: 0 = straight back, ±0.5 = lost profile (we see the cheek line / lashes beyond the hair), ±1 = profile. So `yaw` + `back` covers a full 360° turn. |
| `pitch` | −0.4…0.4 (+ looks up) |
| `roll` | radians (head tilt; hanging hair keeps falling straight down) |
| `expr` | preset name in `PV.anime.EXPR` (see §4) |
| `eyes` | `{open 0..1.25, look:[x,y] −1..1 (screen), tears 0..1 (0.5 welling, 1 streaming), shine 0..1, smile, focus, sad, wide, squeeze, dull, pupil, closed:'down'\|'up'}` — overrides the preset |
| `mouth` | `{open 0..1, shape:'a'\|'i'\|'u'\|'e'\|'o'\|'smile'\|'flat'\|'frown'\|'shout'}` |
| `talk` | `true` → lip-sync from the real dialogue: `PV.anime.mouth(o.T, who)` (3 mouth drawings on twos). The preset's shape family is kept (flat→e/a, smile→open smile, frown→open frown, shout→shout). |
| `brows` | `{inner, outer}` −1…1 (+ raises), `furrow` 0…1 |
| `blush` | 0…1 (soft cheeks + hatching above 0.28) |
| `hair` | `{style, wind 0..2, windDir (radians, direction the wind blows toward, screen), still: true (no idle sway)}`; styles §5 |
| `light` | `PV.anime.LIGHT` name or a light object (default `'day'`) |
| `rimDir` | radians, from the figure toward the light (screen). Used for the rim and, if `lightDir` is not given, for the cel shadows |
| `lightDir` | radians, key light for cel shadows (default `rimDir`, else −2.25 = upper-left) |
| `rim` | rim strength multiplier (default 1 × the light's `rimA`); `rimW` width multiplier |
| `shade` | width of the face cel shadow in H (default 0.06, backlit 0.035) |
| `faceLift` | 0…1, how much a dark light is lifted on the face (default by light; see §6) |
| `T` | global seconds (blinks, sway, lip-sync, tears). Sway/flutter is quantised on twos. |
| `seed` | blink / sway phase (defaults: senpai 3, boy 7, aunt 13) |
| `line` | ink width multiplier (`PV.anime.inkW(size)` is the base) |
| `alpha` | whole-head opacity (drawn through an offscreen layer, no double alpha) |
| `layer` | `'all'` (default) \| `'back'` \| `'front'` \| `'neck'` (see §3) |
| `neck` | `true` → also draw a neck below the head (for heads without a body). `neckLen` (H, default 0.62), `neckW` (×), `neckLean` (rad; default leans with `bodyYaw`/yaw), `neckFade` |
| `bodyYaw` | yaw of the body (only used for the neck lean) |
| `hat` | truthy → 先輩's wide summer hat (white, navy band, brim shadow on the face) |
| `noBlink` | suppress blinks |

**Returns** (screen px in ctx user space): `{neck, chin, mouth, nose, eyeL, eyeR, crown, earL, earR, size, facing}`.
`eyeL / earL` are the features that are on the screen-left at yaw 0 (the character's **right** eye/ear); they keep that
identity when the head turns. `facing` = cos of the view angle (1 front, 0 profile, −1 back).
`PV.anime.headInfo(o)` returns the same anchors without drawing.

## 3. Layers — how a body uses the head

```
const o = { who, x: neckX, y: neckY, size, yaw, back, pitch, roll, light, rimDir, T, expr, hair };
PV.anime.headBack(ctx, o);             // hair that falls behind the body (先輩's curtain, the boy's nape tips…)
/* draw the torso (and its neck) */
PV.anime.head(ctx, { ...o, layer: 'front' });   // face, cap, bangs, side locks, hat, rim
```

* `headBack` = `head({…o, layer:'back'})`. It contains, per view: the back curtain/ponytail when the face is toward
  the viewer (`facing > 0.3`), side locks that hang behind the body (far side / back view), the boy's nape clumps in
  front views, the bun (updo) when it is behind the neck. In profile and back views the curtain moves to the **front**
  layer (it lies over the back / neck), so bodies never need to special-case views.
* The **neck belongs to the body**. If a body wants the head's neck (same skin tones and jaw shadow), call
  `head({…o, layer:'neck'})` (or `PV.anime.neck(ctx, o)`) after the torso and before collars, then `layer:'front'`.
* `layer:'all'` = back + (neck if `o.neck`) + front, with a single rim pass.
* Dev sheets without bodies use `neck:true`.

## 4. Expressions — `PV.anime.EXPR`

| preset | look | notes |
|---|---|---|
| `neutral` | default | blinks |
| `smile` | lower lids pushed up, open smile, blush | |
| `gentle` | soft half-lidded smile, closed smiling mouth | |
| `closed` | eyes closed serenely (︶), gentle smile | no blink (C10) |
| `teary` | eyes welling (tears 0.55), brows ハの字, small frown | C05 |
| `cry` | squeezed eyes, streaming tears + drops at the jaw, wailing open frown | no blink |
| `shout` | wide eyes, small irises, angry brows + furrow, big open mouth with teeth & tongue | no blink (C28/C30) |
| `surprise` | wide eyes, small pupils, raised brows, small "o" | no blink |
| `sad` | drooping lids, look down, ハの字 brows | |
| `empty` | dull flat iris, **no highlights**, no blink | C33 (V12) |
| `determined` | flattened upper lids, lowered inner brows | C32 (V11) |
| `pain` | squeezed, furrowed, clenched "i" mouth | |
| `sleep` | closed eyes, relaxed | no blink |
| `focus` | sharp, narrowed eyes (彼 "turns sharp when he focuses") | |

Any preset value can be overridden by `o.eyes / o.brows / o.mouth / o.blush`; e.g. C28:
`{expr:'shout', eyes:{tears:1}, hair:{style:'wet'}, light:'storm', talk:true, T}`.
Tears: `eyes.tears` 0…0.5 = welling (water layer with a bright edge, glossy lower lid, extra sparkles, wobbling
highlights on twos); 0.5…1 = streaming (translucent streak with a white glint along the cheek; drops fall from the jaw
when > 0.85). Highlights are on the same screen side in both eyes (`lightDir`).

## 5. Hair styles (`o.hair.style`)

| who | styles |
|---|---|
| 先輩 | `down` (default: see-through bangs parted to her right, long side locks to the chest, curtain to the waist) · `updo` (low chignon, thin face-framing strands, ears visible — competition) · `loose` (updo coming undone: bigger lower bun, wavy strands around the face and neck — night park) · `wet` (flattened, narrow clumps, strands pasted to the cheeks, sharp glints; darker via `mat(…,{wet})` — storm) |
| 彼 | default (messy: pointed bangs over the eyes, side clumps over the ears, jagged back, flicked nape, two cowlicks) · `wet` (flattened) |
| 叔母 | default (centre parting, hair swept back, face-framing strands, low ponytail) |

Wind: `hair.wind` 0…2 bends every clump toward `windDir` progressively from the root (lengths preserved) with flutter;
bangs react at 35–40 %. Without wind the hair breathes slightly (`hair.still:true` turns it off). All on twos.
Eyes are drawn through the bangs (anime convention), brows at 60–80 % over the bangs.

## 6. Light helpers for bodies

* `PV.anime.faceLight(light, lift?)` → the light object used for faces / necks (dark lights lifted: `dark < 0.6` lift 0.78,
  `< 0.7` 0.62, `< 0.9` 0.3, else 0.12; ambient reduced and exposure raised). For matching hands/necks use
  `PV.anime.mat('skin', PV.anime.faceLight(light))`.
* `PV.anime.faceAmb(light, lift?)` → just the ambient part (what anime_body.js currently uses; it does not raise exposure,
  so in storm/night body skin is a little darker than the face — reads as the neck in the jaw's shadow).

## 7. `PV.anime.bust(ctx, o)` → head anchors

Head + neck + shoulders / chest for close-ups (cut by the frame below ~2.3 H). Same options as `head`, plus:

| option | meaning |
|---|---|
| `outfit` | 先輩: `uniform` (blouse, red ribbon), `blazer`, `dress` (navy, round neck, chain necklace, cap sleeves), `dress_cardigan`, `summer` (white sleeveless one-piece + hat), `gown` (pyjamas, right forearm in a cast & sling), `home` (grey knit). 彼: `uniform` (open collar, loosened tie), `blazer`, `tee` (white T + open light-blue shirt), `jacket` (leather jacket, black T), `wet` (soaked shirt; hair `wet`). 叔母: `coat` (turtleneck + long coat) |
| `bodyYaw` | torso yaw (default 0.45 × head yaw) |
| `neckLen` | override the neckline-dependent neck length |

The torso is the same slice construction (shoulders 1.45 H for 先輩, 1.8 H for 彼); garments are surface polygons
(collars, lapels with drop shadows, ribbon / tie, buttons, necklace, cast) with cel shadows. Arms hang at the sides
and are cut by the frame (no arm poses).

## 8. Recommended sizes, LOD, performance

* LOD: `size < 58` px → minimal (one highlight, no crease/ring/split lines); `< 120` → medium; ≥ 120 full detail.
  Readable down to ~40 px (sheet 7); designed to hold up to ~900 px (dev `zoom` shot).
* Ink width = `PV.anime.inkW(size) × line`; hair ink 0.9×, face contour 0.78×, inner lines 0.3–0.6×.
* Measured in headless Chromium (raster flushed, 10 heads averaged, long hair + neck + wind + lip-sync):

| head | ms / head (median, min) — CPU shared with another job, ±20 % noise |
|---|---|
| 先輩 300 px, day | 13.7 (11.6) |
| 先輩 300 px, window backlight (rim) | 16.7 (13.4) |
| 彼 300 px, window | 9.7 (9.3) |
| 先輩 140 px, night | 11.3 (8.2) |
| 先輩 60 px | 4.6 (4.3) |
| 先輩 600 px close-up, window | 20.9 (17.7) |

  Large heads cost more because the long curtain is filled several times; in scenes the body hides most of it.
  Probe: `dev_anime_head_perf` (`?n=10&who=senpai&size=300&light=window`).

## 9. Showcases

1 先輩 turnaround (yaw −1, −0.5, 0, 0.5, 1, back) · 2 彼 turnaround · 3 先輩 expressions (14) · 4 彼 expressions ·
5 lighting (both; day/window/classroom/sunset/night/storm/stage/room_gray/lamp/summer) · 6 animated close-up
(600 px, 3/4, window backlight: blink at t≈2.5 s, V01 lip-sync via `talk` with `T=12.6+t`, wind, tears welling → streaming) ·
7 hair styles down/updo/loose/wet + 叔母 (3/4 + back) + small sizes 40/60/90/140 px · 8 busts in every outfit ·
9 key story cuts with the presets they need (C05 teary+talk window, C10 closed window rim, C17 profile focus + tear in
the updo, C33 empty + flat talk room_gray, C39 boy profile crying + talk lamp, C42 back view with the head turned).
Dev tools: `dev_anime_head_zoom` (900 px faces, `?expr=`), `dev_anime_head_wind` (strong wind, storm, hat),
`dev_anime_head_perf`, `dev_anime_head_dbg` (outlines of silhouette / cap / hairline / clumps by group; `?who=&lost=1`).

## 9b. Known limitations (honest list)

* Busts are simple: square-ish shoulders, no arm poses (`o.arms` not implemented — the body library covers poses),
  garments are flat surface polygons with one cel shadow; the cast/sling is schematic.
* The angel ring is a regular zig-zag band; real 作画 breaks it per clump.
* Long hair seen from the front shows many parallel clump lines on the inside of the curtain (hidden by a body in
  scenes, visible on head-only sheets).
* The far side lock switches from "over the cheek" to "behind the head" at |yaw| ≈ 0.35 (a one-drawing pop).
* Rim light can leave short bright segments on inner clump edges next to gaps (reads as backlit strands).
* 600 px heads cost ~20 ms; faces are deliberately flat (anime), little cheek / nose modelling.
* Faces in storm / night are lifted (`faceLight`); bodies that only use `faceAmb` will be a bit darker than the face.
* Profile: the face is narrow and mostly framed by bangs and side locks; the lips / chin read at ≥ 200 px.


## 10. Exports added to `PV.anime` (no change to anime.js)

`head`, `headBack`, `bust`, `neck`, `headInfo`, `EXPR`, `faceLight`, `faceAmb`; dev-only `_headModel`, `_headDebug`.
