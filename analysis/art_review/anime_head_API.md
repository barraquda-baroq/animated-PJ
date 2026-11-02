# anime_head.js — API reference (heads, faces, hair, expressions, busts)

`pv/engine/lib/anime_head.js` extends `PV.anime` (the style kit in `anime.js`) with the anime-style character heads of
『キミの右手のアイロニー』: 先輩 (`senpai`), 彼 (`boy`), 叔母 (`aunt`).
Showcases: `pv/scenes/_dev_anime_head.js` (shots `dev_anime_head_1` … `_8`, **`_9` = the close-up reel** (the six big emotional close-ups of the
trailer at full size, real timing and light — see §9), `_cuts` (key cuts on one sheet), `_model`, `_profile`, plus dev tools `_zoom`, `_wind`,
`_perf`, `_dbg`; every sheet also exists as `<id>_raw` = without bloom / grain / vignette, to check the drawn colours).
Review renders: `analysis/art_review/anime_head/` (builder) and `analysis/art_review/anime_head_review/` (作画監督 review: `r0` before → `final`;
second review of the close-ups: `reel_before` → `reel_final`).
Critique and fix log: `analysis/art_review/anime_head_critique.md`. Character design (authoritative): `analysis/character_design_from_text.md`.

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
  (near |yaw|=1 the eye becomes a wedge with the iris at the front, set back from the nose-bridge line). The upper lid is
  thin at the inner corner and thickens over the outer half into one **lash wedge** (先輩: + 3 thin lash points curling out,
  fused at the base) ending in a pointed **tail** past the outer corner (先輩 out and slightly up, 彼 out and down, 叔母 an
  eyeliner flick). The iris is dark under the lid, saturated in the middle, with a soft lighter crescent in its lower half
  (+ fine radial streaks on big close-ups); the iris keeps its colour under ambient light (only 20 % of the face's ambient).
  Brows, nose, mouth, blush and tears are drawn on the surface.
* **Anime 3/4 conventions** (not a real projection): a cheekbone fullness on the side-front of the model (`cheek`) makes the
  far cheek contour pass outside the far eye; far-side features (eye, brow, blush, tear path) are pulled toward the nose
  line (`farX`, up to 20 % at 3/4) and the far eye is clamped inside the far contour with a margin; the far side locks
  hang **behind** the face in 3/4 so the far cheek reads against the hair. In 3/4 the near face-framing locks fall a little
  outside and behind the near cheek (the cheek-to-jaw contour shows); toward profile they swing back beside the cheek so they
  never cover the eye / profile line.
* **Hair** = a cap (offset of the skull silhouette above the projected hairline, outline weight following the light) +
  clumps (3D centre lines → 2D ribbons) drawn far-to-near. Clumps have a gentle S-curve (`sc`), tips turned in
  (`tipIn`), a bulge, varied widths and lengths. Each group gets one thick silhouette ink (`drawBacking`); lines between
  overlapping clumps are thin. Cel shadow on the side away from the light, a root shadow on bangs, a light→tip gradient.
  The **angel ring** is broken: irregular pieces on the cap, and a separate short band with uneven teeth on each clump.
  Clumps that lie on the scalp have no ink until they leave the head.
* **Light**: every tone comes from `PV.anime.mat(material, light)`. Faces/necks use `PV.anime.faceLight(light)`
  (dark scenes lifted, saturation partly restored, so faces stay readable and not grey). **Rim light** = one continuous
  crisp band inside the union silhouette on the light side: a low-res mask of the union minus the union shifted away
  from the light, composited (clipped to the layer's own shapes) in device pixels — it thins naturally where the contour
  turns away from the light and follows camera transforms.

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
| `eyes` | `{open 0..1.25, look:[x,y] −1..1 (screen), tears 0..1 (0.5 welling, 1 streaming), shine 0..1, smile, focus, sad, wide, squeeze, dull, pupil, closed:'down'\|'up', hlK (highlight size ×), undereye 0..1, dimShine}` — overrides the preset. `{shine:0.5, dull:1, dimShine:true}` = the dependent phase's single dull grey glint |
| `undereye` | 0…1: dark circles under the eyes (the silent days; `COLORS.undereye`). The `empty` preset uses 0.45 |
| `mouth` | `{open 0..1, shape:'a'\|'i'\|'u'\|'e'\|'o'\|'smile'\|'flat'\|'frown'\|'shout', asym −1..1, tremble 0..1}`. `asym`: one corner lifts (a half-smile; + = the character's left corner = screen-right at yaw 0) — 彼's easy half-smile in C06 is `{asym:-0.7}`. `tremble`: the lips quiver on twos (the voice breaking, C39). In 3/4 the half of the mouth toward the near cheek is drawn shorter, so wide (talking / shouting) mouths stay under the nose |
| `talk` | `true` → lip-sync from the real dialogue: `PV.anime.mouth(o.T, who)` (3 mouth drawings on twos). The preset's shape family is kept (flat→e/a, smile→open smile, frown→open frown, shout→shout). |
| `brows` | `{inner, outer}` −1…1 (+ raises), `furrow` 0…1 |
| `blush` | 0…1 (soft cheeks + hatching above 0.28) |
| `hair` | `{style, wind 0..2, windDir (radians, direction the wind blows toward, screen), still: true (no idle sway)}`; styles §5 |
| `light` | `PV.anime.LIGHT` name or a light object (default `'day'`) |
| `rimDir` | radians, from the figure toward the light (screen). Used for the rim and, if `lightDir` is not given, for the cel shadows |
| `lightDir` | radians, key light for cel shadows (default `rimDir`, else −2.25 = upper-left) |
| `rim` | rim strength multiplier (default 1 × the light's `rimA`); `rimW` width multiplier (C42's golden backlight uses 2); `rimRes` mask-resolution multiplier (default 1; >1 crisper, slower) |
| `shade` | width of the face cel shadow in H (default 0.06, backlit 0.035). It is the silhouette minus itself shifted toward `lightDir` by `shade`: **side light** 0.08–0.15 (a crescent on the far cheek); **light from behind** (sunset / window behind the face) 0.55–0.65 with `lightDir` pointing at the light — the face sits in its (warm-lavender) shade with a lit sliver on the light side, as in a backlit anime close-up. Avoid 0.2–0.45: the boundary then crosses the middle of the face |
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
  `head({…o, layer:'neck'})` (or `PV.anime.neck(ctx, o)`) **before** the torso / garment (the garment then covers the base
  of the neck), then collars, then `layer:'front'` (this is what `bust` does).
* The head's neck: slim (先輩 half-width 0.071 H, 彼 0.088 H, 叔母 0.073 H), slightly waisted, 1.3× deeper in profile,
  leaning ~17° forward in profile, the back line starting under the skull (higher than the throat). `neckLen` (H, default
  0.40) = how far below the neck point it reaches. On head-only sheets (`neck:true`) the base flares into the trapezius and
  dissolves (`neckFlare:false` turns it off; `neckFade:true` = ink fade only, no flare, as busts use).
* `layer:'all'` = back + (neck if `o.neck`) + front, with a single rim pass.
* Dev sheets without bodies use `neck:true`.

## 4. Expressions — `PV.anime.EXPR`

| preset | look | notes |
|---|---|---|
| `neutral` | 先輩: lid just touching the iris; 彼: half-lidded (top third of the iris hidden); 叔母: heavy lid | blinks |
| `smile` | lower lids pushed up, open smile showing a little of the upper teeth, bigger highlights, blush. 彼: crescent eyes (目が三日月) | |
| `gentle` | soft eyes, closed smiling mouth (先輩's everyday 控えめな微笑み) | |
| `closed` | eyes closed serenely (︶, lashes down), gentle smile | no blink (C10 / C42) |
| `teary` | welling: a thin glossy layer (tinted by the iris glow, not white) along the lower lid, its surface = three short trembling bright strokes following the lid, wet lower rim, trembling + extra sparkles, the rims redden; ハの字 brows; lips parted | C05 |
| `cry` | squeezed eyes, strong ハの字 + furrow, streaming tears + drops at the jaw, wailing mouth with upper teeth, the nose tip reddens | no blink |
| `shout` | the **crying shout** (C28 V08, C30 V09): brows knitted with the inner ends pulled UP + deep furrow (not the angry V), eyes open and wet with the lower lids pushed up a little, a wide open mouth whose corners are pulled down (arched top, broad flat lower edge, upper teeth, a short lower-lip line), cheeks and nose flushed. Add `eyes:{tears:1}` for streaming tears | no blink (C28/C30) |
| `surprise` | wide eyes, small pupils, raised brows, small "o" | no blink |
| `sad` | drooping lids, look down, ハの字 brows | |
| `empty` | flat dark iris disc (no glow, soft pupil edge), **no highlights**, dark circles (`undereye` 0.45) | no blink; C33 (V12) |
| `determined` | flattened upper lids, lowered inner brows + furrow. 彼: the whole iris shows, one clear highlight (L1216) | C32 (V11) |
| `pain` | squeezed, furrowed, clenched "i" mouth | |
| `sleep` | closed eyes, relaxed | no blink (C35) |
| `focus` | sharp narrowed eyes, lowered inner brows + furrow (先輩's 張り詰めた演奏の顔 with `brows:{furrow:0.7}`) | |

Per-character takes live in `CHAR_EXPR` (彼: `determined`, `smile`, `shout`, `surprise`, `empty` — his eyes never lose
their light, that is her sign; 叔母: `neutral`, `focus`/`determined` = the probing gaze with the whole iris).
Any preset value can be overridden by `o.eyes / o.brows / o.mouth / o.blush / o.undereye`; e.g. C28:
`{expr:'shout', eyes:{tears:1}, hair:{style:'wet'}, light:'storm', talk:true, T}`; C16 (stage fright, focus lost):
`{expr:'neutral', eyes:{shine:0.22, dull:0.38, hlK:0.8, look:[0.42,0.14], open:0.88}}` (smaller, dimmer highlights — `shine` also
scales their size — a flatter iris, both eyes parallel off to one side) then, at his cough, the head turns a little and
`{shine:1, dull:0, hlK:1.15}` with `blush:0.32` (see the reel, C16).
Tears: `eyes.tears` 0…0.5 = welling; 0.5…1 = streaming: a translucent film of water (the skin shows through) from near the
inner corner down the cheek — a crisp white edge on the light side, a faint dark edge on the other, small glints — and drops
falling from the jaw when > 0.85 (design sheet: 目頭寄りから頬へ「透明の轍」). Highlights are on the same screen side in both eyes (`lightDir`).
Highlights follow the design sheet: 先輩 two (big oval on the light side + small dot), 彼 one small + a thin reflected
light under the iris (never empty), 叔母 one small.

## 5. Hair styles (`o.hair.style`)

| who | styles |
|---|---|
| 先輩 | `down` (default: see-through bangs — 6 leaf-shaped clumps of varied width that overlap through the middle (the forehead shows in narrow wedges between the tips) + 2 at the temples + 2 wisps, parted to her right half an eye from the centre, brow length; face-framing locks curving in along the cheek and out over the collarbones to the chest; a clump from behind each ear falling forward over the shoulder; a curtain of 9 clumps of varied width/length to the waist, converging slightly) · `updo` (low chignon at the nape, short soft wisps at the temples ending at the cheekbone, ears visible — competition) · `loose` (the chignon half come undone: lower bun, soft loose strands at the face and neck — night park) · `wet` (flattened narrow clumps, strands pasted to the cheeks, sharp glints, darker via `mat(…,{wet})` — storm) |
| 彼 | default (messy, little shine: uneven pointed bangs to the upper lids flowing to his left, thin clumps over the eyes; side clumps on the skull covering the top half of the ears; jagged back; nape flicks touching the collar; crown spikes) · `wet` (flattened) |
| 叔母 | default (collarbone-length hair from a centre parting swept back into a low tie at the nape, short loose strands at the temples) |

Wind: `hair.wind` 0…2 bends every clump toward `windDir` progressively from the root (lengths preserved) with flutter;
bangs react at 35–40 %. Without wind the hair breathes slightly (`hair.still:true` turns it off). All on twos.
Eyes are drawn through the bangs (anime convention; fully opaque on small heads), brows at 60–80 % over the bangs.

## 6. Light helpers for bodies

* `PV.anime.faceLight(light, lift?)` → the light object used for faces / necks (dark lights lifted: `dark < 0.6` lift 0.84,
  `< 0.7` 0.7, `< 0.9` 0.45, else 0.12; ambient reduced, exposure raised, saturation restored). In dark scenes the light's own
  hue is re-saturated so it stays in the skin (a storm face is pale blue-lavender, never mid-grey). Under a **warm backlight**
  (window, sunset, lamp: warm light with rimA > 0.55) the shadow colour leans to a rose-lavender — the shaded side of a face is
  lit by the sky / room, so it is not a muddy orange-brown. For matching hands/necks use
  `PV.anime.mat('skin', PV.anime.faceLight(light))` (anime_body.js does: skin and, with a smaller lift, clothes).
* `PV.anime.faceAmb(light, lift?)` → just the ambient part (same default lifts as `faceLight`; it does not raise exposure).

## 7. `PV.anime.bust(ctx, o)` → head anchors

Head + neck + shoulders / chest for close-ups (cut by the frame below ~2.3 H). Same options as `head`, plus:

| option | meaning |
|---|---|
| `outfit` | 先輩: `uniform` (blouse, red ribbon), `blazer`, `dress` (navy, modest round neck, thin silver chain with a small drop, cap sleeves), `dress_cardigan` (+ ecru cardigan), `summer` (white one-piece, small round neck, short sleeves + straw hat), `gown` (pale-blue pyjamas, right forearm in a cast & sling), `home` (loose grey knit with a wide neck). 彼: `uniform` (open collar, loosened deep-green tie), `blazer`, `tee` (white T + open light-blue shirt), `jacket` (leather jacket, black T), `wet` (soaked shirt; hair `wet`). 叔母: `coat` (black rib-knit high neck + long charcoal coat) |
| `bodyYaw` | torso yaw (default 0.45 × head yaw) |
| `neckLen` | override the neckline-dependent neck length |

The torso is the same slice construction (shoulders 1.45 H for 先輩, 1.8 H for 彼), starting at the base of the neck with a
trapezius slope; the head's neck is drawn first (it flares into the trapezius at its base, so no column of neck stands between
the jaw and the collar) and the garment covers its base. Garments are surface polygons
(collars, lapels with drop shadows, ribbon / tie, buttons, necklace, cast) with cel shadows. Arms hang at the sides
and are cut by the frame (no arm poses).

## 8. Recommended sizes, LOD, performance

* LOD: `size < 58` px → minimal; `< 120` → medium; ≥ 120 full detail. Below ~110 px the narrow eyes (彼, 叔母) open a
  little, eyes under ~16 px wide get a solid dark iris + bigger highlight and a heavier lid line, and eyes through the bangs
  become opaque — faces stay readable at 40–60 px heads (figures 250–450 px tall). Designed to hold up to ~900 px.
* Ink width = `PV.anime.inkW(size) × line`; hair silhouette ink 0.9× (one thick backing per group), lines between
  clumps 0.42× of that, face contour 0.78×, inner lines 0.3–0.6×.
* Measured in headless Chromium (raster flushed, 10 heads, long hair + neck + wind + lip-sync; p25 of 14 frames; the CPU
  is shared with another agent, ±15 % noise):

| head | ms / head |
|---|---|
| 先輩 300 px, day | 12.2–14 |
| 先輩 300 px, window backlight (rim) | 15.9–17.7 (rim:0 → 12.1) |
| 彼 300 px, window | 12.5–13.4 |
| 先輩 140 px, night | 10.6 |
| 先輩 60 px | 5.9–7.4 |
| 叔母 300 px, day | 5.9 |
| 先輩 600 px close-up, window | 26 |

  (second review, after the close-up work: theatrical eyes, lash wedge, tears, see-through pass only where a lock really
  crosses an eye / a brow, rim keep-mask moved into the small buffer, lash details skipped on eyes < 14 px. An interleaved
  A/B against the first-review version on the same machine gave the same numbers within the noise of the shared CPU.) The backlit long-haired head is ~1.3 ms over the 15 ms budget (the rim
  costs ~4 ms: two union fills in a reduced mask + one composite); `rim:0` or a smaller `rimRes` trims it. Probe: `dev_anime_head_perf` (`?n=10&who=senpai&size=300&light=window&rim=1`).

## 9. Showcases

1 先輩 turnaround (yaw −1, −0.5, 0, 0.5, 1, back) · 2 彼 turnaround · 3 先輩 expressions (14) · 4 彼 expressions ·
5 lighting (busts of both; day/window/classroom/sunset/night/storm/stage/room_gray/lamp/summer) · 6 animated close-up
(600 px, 3/4, window backlight: blink at t≈2.5 s, V01 lip-sync via `talk` with `T=12.6+t`, wind, tears welling → streaming) ·
7 hair styles down/updo/loose/wet + 叔母 (3/4 + back) + small sizes 40/60/90/140 px · 8 busts in every outfit ·
**9 the close-up reel**: the six big emotional close-ups of the trailer one after another, full frame, at the film's own
timing (reel t 0–25.9 s → global T inside each cut, so blinks, tears and the real lip-sync run as in the film), with their
light, a stand-in background (PV.lib) and the subtitle drawn where the film puts it; film post (bloom / grain / vignette).
C05 0–3.9 (先輩 teary 3/4, V01, window backlight, him blurred by the window) · C06 3.9–7.4 (彼 deadpan → half-smile `asym`, V02,
backlit) · C16 7.4–10.9 (white world, updo; unfocused eyes → his cough at 51.4: the head turns, the light and a blush return) ·
C28 10.9–15.9 (storm: she turns, wet hair blown across, streaming tears, the crying shout V08 at 99.0, lightning at 102.7) ·
C39 15.9–22.9 (彼's profile in the dark room: face in shade, a warm rim along the profile line, tears, V17 with `tremble` where
the voice breaks) · C42 22.9–25.9 (sunset backlight `shade:0.64`, `rimW:2`; she turns to him and smiles at 167.7).
`?cut=C28` plays one cut from its start. Check frames: `--dur 26 --times 0.5,1.75,4.1,5.46,8.3,10.5,11.15,13.2,15.11,17.55,20.85,24.7`.
`cuts` (was `_9`): key story cuts on one sheet (C05, C10, C17, C33, C39, C42 busts) ·
`model` model sheet: front / 3/4 (0.3) / strong 3/4 (0.55) / profile at 320 px (`?who=senpai|boy|aunt&expr=&light=`) ·
`profile` three 520 px profiles (先輩 down, 先輩 updo, 彼; `?expr=`).
Dev tools: `dev_anime_head_zoom` (900 px faces, `?expr=`), `dev_anime_head_wind` (strong wind, storm, hat),
`dev_anime_head_perf`, `dev_anime_head_dbg` (outlines of silhouette / cap / hairline / clumps by group; `?who=&lost=1`);
`<any head sheet>_raw` = the same sheet without post effects.

**Scene notes from the close-up review** (how the reel stages them; the scene work decides):
* Close-ups in very bright frames (C05 window, C16 white world): the film's default bloom lifts the thin dark lines of the
  eyes; `S.post = {bloom: 0.15–0.2}` on those shots keeps the eyes crisp.
* Backlight from behind: `shade` 0.55–0.65 + `lightDir` toward the light (+ `rimW` 1.5–2 for a golden rim). Side light: `shade` ≤ 0.15.
* A crying profile in the dark (C39): `lightDir` toward the window behind, `shade:0.5`, `rimDir` toward the lamp in front → the
  profile line glows warm.
* Wet hair in the storm reads best blown sideways by the wind (`hair:{style:'wet', wind:0.8–1.2}`), not hanging as a curtain.

## 9b. Known limitations (honest list)

* Busts are simple: boxy shoulders, no arm poses (`o.arms` not implemented — the body library covers poses),
  garments are flat surface polygons with one cel shadow; the cast/sling is schematic. Use the body library for anything
  below the collarbones.
* The far side lock switches from "over the cheek" to "behind the face" at |yaw| ≈ 0.2 (a one-drawing switch, as in
  hand-drawn in-betweens).
* The side of the head in profile shows the scalp-lying back clumps as faint diagonal flow bands; the back of the head in a
  pure back view is a smooth dome with a broken ring (anime-like, but plain).
* The bangs are wider overlapping leaves now (gaps only as narrow wedges between the tips); at 900 px in a strict front view
  the clumps still hang fairly straight.
* 3/4 face shape: the lower face still reads a little long; at a strong 3/4 (yaw ≈ 0.55) the far cheek still bulges and the
  chin juts a little.
* Long hair still reads somewhat as parallel clumps ("wig"); the wet style on a head-only sheet can still look like a dark
  curtain (behind a body and in wind it reads as wet hair).
* The rim mask is computed at reduced resolution and upscaled: the band is slightly soft rather than razor-crisp on
  600 px close-ups.
* Faces are deliberately flat (anime): little cheek / nose modelling; a nose = tip line + small shadow (+ bridge line in 3/4).
* Faces in storm / night are lifted (`faceLight`); bodies that only use `faceAmb` will be a bit darker than the face.
* The head's neck was widened in the second review (先輩 0.071 → 0.09, 彼 0.088 → 0.114, 叔母 0.073 → 0.086 H half-width);
  figures from anime_body.js draw it through `PV.anime.neck`, so their collars should be checked against it.

## 10. Exports added to `PV.anime`

`head`, `headBack`, `bust`, `neck`, `headInfo`, `EXPR`, `faceLight`, `faceAmb`; dev-only `_headModel`, `_headDebug`.
`anime.js` itself: only the data of `analysis/character_design_from_text.md` §7 (DESIGN_PATCH) was added after `A.COLORS`
(iris_senpai plum-brown, ecru cardigan, deep-green tie, new materials incl. `undereye`, `necklace`, `tee_black`), no function changed.
The second review (close-ups) did not touch `anime.js`; it added only head options (`mouth.asym`, `mouth.tremble`) and changed
the look inside `anime_head.js` (eyes, tears, shout, brows over bangs, bangs, ring, updo wisps, necks, `faceLight` / `faceAmb`).
