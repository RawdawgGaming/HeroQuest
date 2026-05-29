# Hero Quest

A roguelike arcade dungeon crawler built with Phaser 3 and TypeScript.

## Tech Stack

- **Engine**: Phaser 3.80.1
- **Language**: TypeScript 5.4
- **Build**: Vite 5.4
- **Backend**: Supabase 2.101.1
- **Testing**: Playwright 1.59.1

## Project Structure

```
src/
  data/           Hero classes, weapons, enemies, stages, sidekicks
  entities/       Hero, Enemy, Ghoul, Projectile, Sidekick
  systems/        CharacterProgression, WaveSpawner, LevelSystem, EventBus, StateMachine
  scenes/         StartScreen, HeroSelect, CharacterName, StageSelect, ForestStage, Shop
  ui/             HUD (health, XP, ult bar, skills, gold, wave counter)
  visuals/        Textures, sprites, procedural generation, combat/skill FX, shadows
  environments/   Per-stage and per-biome environment builders
  services/       Supabase integration
admin/            36 utility scripts (sprite processing, screenshots, testing)
public/assets/    Sprite sheets, weapon images, environment art
```

## Hero Classes

| Class | Attack Type | Speed | HP | Power | Defense |
|-------|------------|-------|-----|-------|---------|
| Paladin | Melee | 180 | 120 | 14 | 8 |
| Barbarian | Melee | 190 | 110 | 15 | 4 |
| Templar Knight | Melee | 170 | 130 | 11 | 7 |
| Mage | Melee | 200 | 80 | 14 | 3 |
| Archer | Melee | 220 | 85 | 12 | 4 |
| Necromancer | Projectile | 180 | 90 | 18 | 3 |

## Weapons (10 per class, 60 total)

- **Paladin**: Oak Mace, Spiked Oak Mace, Stone Mace, Spiked Stone Mace, Iron Mace, Spiked Iron Mace, Golden Mace, Spiked Golden Mace, Ruby Mace, Spiked Ruby Mace
- **Barbarian**: Rusty Axe, Broad Axe, Great Axe, Savage Cleaver, Berserker Axe, Wartorn Blade, Titan Hammer, Ravager Axe, Doombringer, World Render
- **Templar Knight**: Training Sword, Knight's Blade, Runed Blade, Silver Falchion, Holy Claymore, Azure Sword, Paladin's Oath, Starforged Sword, Covenant Blade, Aetherblade
- **Mage**: Apprentice Wand, Oak Staff, Arcane Orb, Frost Wand, Fire Staff, Arcane Codex, Phoenix Staff, Chronomancer Orb, Archmage Staff, Reality Weaver
- **Archer**: Short Bow, Hunting Bow, Longbow, Composite Bow, Recurve Bow, Elven Longbow, Thunderstrike Bow, Shadowstring, Hawkeye Bow, World Piercer
- **Necromancer**: Bone Wand, Skull Staff, Cursed Tome, Scythe of Decay, Lich Lord's Crook, Phylactery of the Damned, Bonewalker Ribcage, Soulrender, Death's Embrace, Apex Reliquary

Cost range: 50 - 60,000 gold. Each scales damage, attack speed, range, and class-specific bonuses (lifesteal, rot, crit, etc.).

## Skills & Attributes

Each class has 4 attributes (29-30 total points) and 6 skills (unlocking at levels 5-30).

### Paladin
- **Attributes**: Attack Power (8), Defense (8), Vitality (7), Holy Power (7)
- **Skills**: Smite, Lay on Hands, Consecration, Divine Wrath, Crusader's Charge, Aegis Eternal

### Barbarian
- **Attributes**: Attack Power (8), Attack Speed (7), Ferocity (7), Toughness (7)
- **Skills**: Cleave, Bloodthirst, Whirlwind, Earthshaker, Berserker Rage, Decimate

### Templar Knight
- **Attributes**: Attack Power (7), Defense (7), Magic Power (7), Vitality (8)
- **Skills**: Power Strike, Magic Bolt, Sanctuary, Mystic Slash, Divine Aegis, Templar's Wrath

### Mage
- **Attributes**: Spell Power (8), Cast Speed (7), Spell Range (7), Arcane Effect (7)
- **Skills**: Frostbolt, Arcane Shield, Fireball, Lightning Storm, Time Warp, Meteor Strike

### Archer
- **Attributes**: Attack Power (8), Attack Speed (7), Attack Range (7), Critical Hit (7)
- **Skills**: Multishot, Eagle Eye, Pin Down, Rain of Arrows, Phantom Step, Master's Volley

### Necromancer
- **Attributes**: Attack Power (8), Attack Speed (7), Attack Range (7), Rot Effect (7)
- **Skills**: Life Leech, Summon Ghoul, Rot, Bone Spear Volley, Wraith Form, Soul Apocalypse

## Sidekicks (5 companions)

| Sidekick | Cost | Ability | Cooldown |
|----------|------|---------|----------|
| Mending Pixie | 7000g | Heal (4% max HP) | 4s |
| Frost Sprite | 7000g | Freeze (2s) | 6s |
| Plague Bat | 7000g | Poison DOT (12% max HP) | 5s |
| Battle Wisp | 7000g | Attack (35 dmg fiery bolt) | 2s |
| Guardian Spirit | 7000g | Shield (12% DR, 6 HP/s) | 1s |

Each sidekick levels independently (max 20) with 3 skill trees.

## Stages (49 stages, 10 biomes, 10 bosses)

| Stages | Biome | Boss |
|--------|-------|------|
| 2-8 | Forest | Ironjaw the Bandit King |
| 9-14 | Occupied Wildlands | Ironjaw the Occupation Warlord |
| 15-19 | Stone March | Korrath the Mountain King |
| 20-23 | Fortress Interior | Castellan Dredmor |
| 24-28 | Deep Caverns | Xylothar the Crystal Titan |
| 29-33 | Mirelands | Blightmother Vasska |
| 34-38 | Highland Wilds | Thundrak the Stormborn |
| 39-42 | Ruined Civilization | The Reassembled Colossus |
| 43-46 | Arcane Expanse | Aethon the Leyline Tyrant |
| 47-50 | Dark Sovereign Domain | Malachar the Dark Sovereign |

Stage 1 is the tutorial/forest entrance with a unique handcrafted environment.

## Enemies (60+ types)

- **Forest**: Goblin Scout, Hedge Sprite, Barkhide Boar, Moss Wolf, Bandit Raider, Thorn Slinger, Spore Mushroom, Bandit Captain, Forest Shaman
- **Wildlands**: Foot Soldier, Shield Bearer, Crossbowman, Net Thrower, War Sergeant, Banner Carrier
- **Stone March**: Gravel Runner, Stonebreaker, Cliff Slinger, Boulder Pusher, Pass Warden, War Drummer
- **Fortress**: Castle Guard, Tower Knight, Arrow Turret, Trap Engineer, Jail Overseer, Alarm Bell Warden
- **Caverns**: Cave Bat, Tunnel Burrower, Crystal Spitter, Echo Leech, Crystal Titan, Glowcap Colony
- **Mirelands**: Bog Imp, Mud Hulk, Toad Shaman, Vine Grabber, Swamp Horror, Rot Priest
- **Highlands**: Goat Raider, Frost Ram, Ice Caster, Windcaller, Avalanche Giant, Storm Totem
- **Ruins**: Relic Drone, Stone Sentinel, Rune Cannon, Glyph Trap, Colossus Fragment, Archive Wisp
- **Arcane**: Mana Sprite, Arcane Golem, Rift Caster, Gravity Well, Phase Guardian, Leyline Anchor
- **Dark Domain**: Blackblade Acolyte, Obsidian Knight, Void Archer, Shadow Chain Caster, Royal Executioner, Blood Priest

## Combat System

- **Melee combo**: 3-hit chain (basic, basic, finisher) with input queuing
- **Consecration buff**: Every attack becomes Final Smash for the duration
- **Finisher**: Overhead slam with impact event (camera shake, splash damage, VFX)
- **Projectile**: Necromancer fires bone projectiles with travel distance and decay DOT
- **Defense**: Flat damage reduction from defense stat
- **Lifesteal**: Percentage-based HP recovery on hit (weapon-dependent)

## Wave System

7 encounter zones per stage spaced across the 8000px world:
1. x~600 — Opening (light encounter)
2. x~1600 — Escalation
3. x~2600 — Mid-stage mixed
4. x~3600 — Heavy cluster
5. x~4800 — Breather + ambush
6. x~5800 — Pre-boss pressure
7. x~7000 — Boss arena

Enemies spawn off-screen right with 250ms stagger. Elite waves have boosted stats and custom tints.

## World Dimensions

- **Stage width**: 8000px
- **Stage height**: 720px
- **Walking area**: Y 420-560 (140px tall)
- **Camera zoom**: 1.5x with 50px upward offset
- **Camera**: Follows hero with instant lerp

## Environment System

Three-tier fallback:
1. **Per-stage builder** (`StageEnvironments.ts`) — handcrafted layouts
2. **Per-biome builder** (`BiomeBuilder.ts`) — generic biome templates
3. **Procedural fallback** — generated parallax layers

Parallax depth layers:
- Sky (depth -200, scroll 0.20)
- Far background (depth -160, scroll 0.40)
- Mid background (depth -110, scroll 0.70)
- Play layer (depth -10, scroll 1.00)
- Foreground (depth 800, scroll 0.95)

## Sprite Sheets (Paladin)

| Animation | File | Frame Size | Frames |
|-----------|------|-----------|--------|
| Idle | paladin_idle_main_v1.png | 672x448 | 50 |
| Run | paladin_run_main_v1.png | 288x192 | 22 |
| Attack | paladin_attack_main_v1_converted.png | 1056x544 | 65 |
| Final Smash | paladin_final_smash_v1.png | 1056x544 | 121 |
| Finisher | paladin_overhead_swing_v1.png | 1056x576 | 96 |

## HUD

- Health bar (green) with HP text
- XP bar (blue) with level badge
- Ultimate bar (purple, labeled "ULT")
- Skill icons with radial cooldown overlays
- Gold counter
- Wave counter
- Stage complete notification
- Level-up notification

## Admin Tools

- **Sprite processing**: Frame extraction, sheet normalization, attack/run/finisher rebuilds
- **Conversion**: `convert-attack-sheet.mjs` — converts source sprite sheets to game-compatible 1056x544 format
- **Tracking tools**: `fist-tracker.html`, `angle-editor.html` — browser-based weapon socket editors
- **Screenshots**: Automated Playwright scripts for heroes, enemies, gameplay, stages
- **Testing**: `test-all-classes.mjs`, `test-shop.mjs`, `test-cancel-flow.mjs`

## Running

```bash
npm install
npm run dev        # Start dev server (default port 3003)
npm run build      # Production build
npm run preview    # Preview production build
```
