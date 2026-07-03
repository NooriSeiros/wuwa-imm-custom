# Rover Female Eye/Hair Recolor Add-on

This document records the new Rover Female eye/hair recolor add-on created during the IMM Custom work.

Status note: this is a technical history/current-design note, not a final compatibility guarantee. The add-on now has UI-driven per-skin eye/hair choices in IMM Custom, but individual Rover skins can still need targeted texture compatibility fixes.

Current Astral Modulator rule: its hair uses a dedicated `Vivid Red` option generated from diffuse hashes `04192868` and `a01c9b96`. Technical maps `68a6b802` and `2ff23d4c` must never be recolored or replaced.

The actual WWMI mod lives in:

`<WWMI Mods source>\Rover Female\Rover Female - Eye Hair Recolor Addon`

## What was implemented

- A standalone Rover Female add-on mod.
- One combined `mod.ini` for eye and hair recolor.
- Texture resources:
  - `Textures/RoverFemale_CustomEyes.dds`
  - `Textures/RoverFemale_HairFront_DarkBrown.dds`
  - `Textures/RoverFemale_HairBack_DarkBrown.dds`
- `.imm-collision-checklist` for IMM collision awareness.
- Old split prototypes were disabled to avoid FPS loss.

## Why this was needed

The original eye/hair files existed as loose `.dds` files inside:

`Rover Female\aFRover Hair options+`

They had no `mod.ini`, which means they were probably meant to be dragged into another Rover mod. We converted that idea into a standalone add-on so it can be enabled together with skins.

## Performance fix

The first prototype used two separate mods and global texture checks. It worked but caused a large FPS drop.

The current add-on is optimized:

- eye and hair are combined in one mod;
- texture checks are triggered only when Rover Female components render;
- no global `ShaderRegex` scanner is used.

## Corrected diagnosis after user tests

The first compatibility scan was too optimistic. It treated "this skin has the same eye/hair hashes" as "the add-on should work".

The better rule is:

- if a skin has compatible hashes but does not override those textures itself, the add-on works normally;
- if a skin also has its own `TextureOverride` for the same eye/hair texture, there is an override priority fight;
- the add-on must have higher `match_priority` and must remain allowed through the rest of the frame, because the skin may call `CheckTextureOverride` after our component trigger.

Implemented fix:

- all eye/hair texture overrides now use `match_priority = 100`;
- `$rover_texture_pass` is reset in `[Present]` at the end of the frame, instead of immediately after the add-on's own texture check.
- a lightweight eye-only fallback now checks `ps-t8` globally. This is much cheaper than the old all-slots global scanner and helps skins whose visible eye is not covered by their own texture check list.

User-provided examples:

- works: base/current Rover Female;
- works: Rover Female 3.2 Long Range Gold Fix;
- works partially with the generic add-on: Rover Female Lady Arbiter changed hair but missed eyes;
- failed before fix: Astral Modulator Rover;
- failed before fix: Female Rover - Alternative Outfit;
- failed before fix: Rover Female Auspicious Festival Sequence 028.

## Compatibility status from local scan

This section is a scan-based starting point. User tests override this list when a specific skin behaves differently in-game.

Likely works with eye + hair:

- Astral Modulator Rover
- Belly Dancer Rover
- Female Rover - Alternative Outfit
- Rover - Ashen Wings x Qu PGR
- Rover - Ashen Wings x Qu PGR [EDIT]
- Rover Beloved
- Rover F x Kiana Kaslana - Herrscher of Finality
- Rover Female Auspicious Festival Sequence 028
- Rover Female Gold x 5M
- Rover Female Lady Arbiter
- Rover X Lingguang - Aurawalker
- Rover X Lingguang - Aurawalker (1)
- Rover X Lucia - Ashwalker
- Rover X Lucia - Ashwalker [UPDATED 3.2]

Needs a specific compatibility patch:

- Rover F Uniform - Midnight Trail
- Rover Female 3.2 Long Range Gold Fix
- Rover_Perpetual SparkModDemo
- White Rover Girl (2.6 update)

## Technical reason some skins fail

The add-on currently targets the common Rover Female family:

- component trigger: `680c3e35`
- eye hashes: `52c18227`, `8ee0408c`, `8f9e1c00`
- hair hashes: `04192868`, `a01c9b96`, `64f39763`, `b7f20fb3`, `072b55de`, `d946b64f`, `7d4305b1`, `aea47749`

Some skins use a different component family, such as `aa9d9edb`, and different eye texture layouts. Those need their own patch textures instead of blindly reusing the default eye texture.

## Lady Arbiter RabbitFX patch

`Rover Female Lady Arbiter` is a special case. Its visible eye diffuse is routed through RabbitFX:

`Resource\RabbitFX\Diffuse = ref ResourceTexture17`

The generic add-on can win normal texture override priority and still miss this visible RabbitFX path. The current fix avoids touching Cycler gates or slot logic and patches only the texture file used by that RabbitFX resource:

- patched file:
  - `Rover Female\Rover Female Lady Arbiter\Textures\Components-5 t=52c18227.dds`
- backup of the original:
  - `Rover Female\Rover Female Lady Arbiter\Textures\Components-5 t=52c18227.dds.wuwaimmcustom-original`
- replacement source:
  - `Rover Female\Rover Female - Eye Hair Recolor Addon\Textures\RoverFemale_CustomEyes.dds`

To revert the Lady Arbiter patch, copy the `.wuwaimmcustom-original` file back over `Components-5 t=52c18227.dds`.

## Safe use

- The app/mod should not automate F10 or send gameplay keys.
- The user reloads WWMI manually with F10.
- If FPS drops, make sure only `Rover Female - Eye Hair Recolor Addon` is active and the two prototype add-ons remain disabled.

## Next possible step

Create compatibility patches for the skins in the `Needs a specific compatibility patch` list, starting with whichever skin the user cares about most.
