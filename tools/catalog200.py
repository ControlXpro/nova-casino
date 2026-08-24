"""Generate the 200-game instant catalogue.

Writes two artefacts from one source of truth:
  js/games/catalog200.js  - game descriptors + per-game engine config
  tools/prompts200.json   - the Higgsfield art prompt for each game id

Keeping both in one generator means a game can never end up with art that
belongs to a different theme, which is what happens when the prompt list and
the descriptor list drift apart.
"""
import json
import pathlib

# ── palette ────────────────────────────────────────────────────────────
GOLD, ORANGE, RED, PINK, PURPLE, BLUE, CYAN, GREEN, LIME, ICE = (
    "#ffc531", "#ff7a45", "#ff4d6a", "#ff7ad1", "#8b5cf6",
    "#4b8cff", "#3ad8ff", "#2ee06a", "#a3e635", "#7fe3ff",
)

# ── engines ────────────────────────────────────────────────────────────
# Each entry: (engine key, category, motif, one-line art style suffix)
ENGINES = {
    "aim":     ("instant", "pitch",  "dynamic sports action shot, floodlit, dramatic depth of field"),
    "picks":   ("instant", "grid",   "row of closed containers on a lit surface, treasure-hunt mood"),
    "path":    ("instant", "diag",   "side-on view of a hazardous crossing receding into the distance"),
    "pump":    ("instant", "shine",  "single object swelling under pressure, tension in the air"),
    "race":    ("instant", "rays",   "racers mid-sprint down a track, motion blur, finish line ahead"),
    "duel":    ("instant", "rays",   "two opponents locked head to head, sparks flying, arena lighting"),
    "shuffle": ("instant", "dots",   "three identical containers on a table, one hides a prize"),
    "match3":  ("instant", "grid",   "nine-cell reveal panel, three matching symbols glowing"),
    "wires":   ("instant", "grid",   "tangle of coloured wires over a ticking device, close up"),
    "spots":   ("lottery", "dots",   "grid of glowing numbered spots, draw balls tumbling"),
    "streak":  ("instant", "rise",   "an ascending indicator climbing past markers, higher or lower"),
    "wheelx":  ("instant", "wheel",  "ornate segmented prize wheel head-on, pointer at the top"),
    "dig":     ("instant", "grid",   "grid of unturned tiles over buried treasure, one tile lifted"),
    "ladder":  ("instant", "bricks", "a ladder of prize rungs climbing upward into light"),
    "catch":   ("instant", "rise",   "objects falling through the air toward waiting baskets"),
    "safe":    ("instant", "grid",   "heavy combination dial on a locked strongbox, dramatic light"),
    "burst":   ("instant", "dots",   "cluster of fragile spheres, one bursting into sparks"),
    "draw":    ("instant", "shine",  "a single prize being drawn out in a beam of light"),
    "trail":   ("instant", "dots",   "a winding board-game trail of numbered tiles seen from above"),
    "fuse":    ("instant", "stars",  "a burning fuse racing toward a payload, countdown tension"),
}

# ── the 200 games ──────────────────────────────────────────────────────
# (id, display name, accent, emblem, art subject, [in-game nouns])
CAT = {

"aim": [
 ("ice-breakaway","Ice Breakaway",ICE,"🏒","a hockey player firing a slapshot at a masked goalie in a packed ice arena",["Top Shelf","Glove Side","Five Hole","Blocker","Short Side","Far Corner"]),
 ("buzzer-beater","Buzzer Beater",ORANGE,"🏀","a basketball player launching a fadeaway jumper at the hoop as the clock expires",["Swish","Bank Left","Bank Right","Rim In","Top Arc","Corner Three"]),
 ("golden-arrow","Golden Arrow",GREEN,"🏹","an archer loosing a glowing arrow at a distant painted target in a forest clearing",["Gold Ring","Red Ring","Blue Ring","High Left","High Right","Dead Centre"]),
 ("bullseye-alley","Bullseye Alley",RED,"🎯","a dart in flight toward a dartboard in a smoky wood-panelled pub",["Bullseye","Treble 20","Double Top","Treble 19","Outer Bull","Double 16"]),
 ("pirate-cannonade","Pirate Cannonade",ORANGE,"💣","a pirate cannon firing across the water at an enemy galleon at sunset",["Bow","Mainmast","Stern","Waterline","Crow's Nest","Powder Deck"]),
 ("office-hoops","Office Hoops",BLUE,"🗑️","a crumpled paper ball arcing toward a waste basket across a sunlit office",["Clean Drop","Off The Wall","Rim Roll","High Arc","Low Line","Bank Shot"]),
 ("coconut-shy","Coconut Shy",LIME,"🥥","a fairground coconut shy stall with coconuts on posts and striped canvas",["Left Post","Centre Post","Right Post","Back Row","High Post","Corner Post"]),
 ("carnival-rings","Carnival Ring Toss",PINK,"💍","a ring toss booth at night with rows of glass bottles under fairy lights",["Front Bottle","Tall Neck","Green Glass","Back Row","Gold Bottle","Corner Peg"]),
 ("castle-siege","Castle Siege",GOLD,"🏰","a trebuchet hurling a flaming boulder at a stone castle gate at dusk",["Gatehouse","East Tower","West Tower","Battlements","Keep","Drawbridge"]),
 ("dunk-tank","Dunk Tank",CYAN,"🎪","a carnival dunk tank with a target lever and a soaked clown above the water",["Red Target","Blue Target","Bullseye","Upper Lever","Lower Lever","Side Plate"]),
],

"picks": [
 ("dragons-chests","Dragon's Chests",RED,"🐉","five ornate treasure chests glowing in a dragon's cavern hoard",["Chest"]),
 ("mystery-boxes","Mystery Boxes",PURPLE,"📦","a row of sealed neon-lit mystery boxes in a dark gameshow studio",["Box"]),
 ("locker-loot","Locker Room Loot",BLUE,"🔑","a row of steel gym lockers, one door ajar spilling golden light",["Locker"]),
 ("golden-egg-hunt","Golden Egg Hunt",GOLD,"🥚","golden eggs nestled in a straw-lined nest in warm morning light",["Egg"]),
 ("oyster-beds","Oyster Beds",CYAN,"🦪","open oysters on the seabed revealing luminous pearls in blue water",["Oyster"]),
 ("pinata-party","Piñata Party",PINK,"🪅","colourful piñatas hanging at a festive night party spilling sweets",["Piñata"]),
 ("vault-row","Vault Row",GREEN,"🔐","a row of small numbered deposit safes in a marble bank vault",["Safe"]),
 ("apothecary-jars","Apothecary Jars",LIME,"⚗️","glowing potion jars on the shelf of a candlelit alchemist's shop",["Jar"]),
 ("cargo-drop","Cargo Drop",ORANGE,"🪂","supply crates parachuting down onto a moonlit airfield",["Crate"]),
 ("pharaohs-urns","Pharaoh's Urns",GOLD,"⚱️","canopic urns lined along a torchlit Egyptian tomb wall",["Urn"]),
],

"path": [
 ("chicken-highway","Chicken Highway",GOLD,"🐔","a determined chicken crossing a busy multi-lane highway at dusk",["Lane"]),
 ("river-crossing","River Crossing",GREEN,"🐸","a frog leaping between floating logs across a fast green river",["Log"]),
 ("lava-bridge","Lava Bridge",ORANGE,"🌋","crumbling stone slabs spanning a river of molten lava in a cavern",["Slab"]),
 ("ice-floe-run","Ice Floe Run",ICE,"🧊","drifting ice floes across arctic water under the northern lights",["Floe"]),
 ("jungle-vines","Jungle Vines",LIME,"🌿","hanging vines strung across a misty jungle ravine at dawn",["Vine"]),
 ("rooftop-run","Rooftop Run",BLUE,"🏙️","a runner leaping between neon city rooftops at night",["Roof"]),
 ("subway-dash","Subway Dash",RED,"🚇","a figure sprinting across live subway tracks in a lit tunnel",["Track"]),
 ("canyon-planks","Canyon Planks",ORANGE,"🪵","narrow wooden planks bridging a deep red desert canyon",["Plank"]),
 ("swamp-stones","Swamp Stones",GREEN,"🐊","stepping stones through a misty alligator swamp at twilight",["Stone"]),
 ("asteroid-hop","Asteroid Hop",PURPLE,"☄️","an astronaut leaping between drifting asteroids in deep space",["Rock"]),
],

"pump": [
 ("balloon-rise","Balloon Rise",RED,"🎈","a single red balloon inflating against a bright blue sky",["Balloon"]),
 ("bubble-trouble","Bubble Trouble",CYAN,"🫧","a giant soap bubble swelling and shimmering in sunlight",["Bubble"]),
 ("tyre-pressure","Tyre Pressure",BLUE,"🛞","a racing tyre inflating on a pit-lane jack under garage lights",["Tyre"]),
 ("blowfish-bloat","Blowfish Bloat",GOLD,"🐡","a pufferfish inflating among coral in clear tropical water",["Pufferfish"]),
 ("volcano-pressure","Volcano Pressure",ORANGE,"🌋","a volcano swelling with pressure, glowing cracks spreading up its cone",["Volcano"]),
 ("soda-shake","Soda Shake",PINK,"🥤","a fizzy soda bottle shaken to bursting, foam straining at the cap",["Bottle"]),
 ("rising-dough","Rising Dough",GOLD,"🥖","bread dough rising over the rim of a bowl in a warm rustic bakery",["Dough"]),
 ("gas-gauge","Gas Gauge",LIME,"⛽","an industrial pressure gauge needle climbing into the red zone",["Gauge"]),
 ("steam-boiler","Steam Boiler",ORANGE,"🚂","a riveted steam boiler venting jets of white steam under pressure",["Boiler"]),
 ("reactor-core","Reactor Core",GREEN,"☢️","a glowing reactor core brightening behind reinforced glass",["Core"]),
],

"race": [
 ("derby-day","Derby Day",GREEN,"🐎","thoroughbred racehorses thundering down the home straight",["Comet","Bramble","Kingpin","Odette","Ravenna","Sundial"]),
 ("greyhound-sprint","Greyhound Sprint",BLUE,"🐕","greyhounds sprinting around a floodlit night track",["Blaze","Whisper","Rocket","Ash","Nimbus","Dart"]),
 ("turtle-trot","Turtle Trot",LIME,"🐢","cartoon-real sea turtles racing along a sunlit beach lane",["Shelly","Tank","Pebble","Coral","Boulder","Drift"]),
 ("desert-caravan","Desert Caravan",GOLD,"🐪","racing camels kicking up sand across golden dunes",["Zafir","Layla","Samir","Dune","Mirage","Khamsin"]),
 ("drone-circuit","Drone Circuit",CYAN,"🚁","FPV racing drones streaking through a neon-lit obstacle circuit",["Vortex","Photon","Nyx","Quark","Strobe","Halo"]),
 ("grand-prix-dash","Grand Prix Dash",RED,"🏎️","formula racing cars battling into a corner with sparks flying",["Scarlet","Onyx","Azure","Verde","Ivory","Cobalt"]),
 ("husky-sled","Husky Sled Race",ICE,"🛷","husky sled teams racing across a frozen tundra at blue hour",["Frost","Yukon","Storm","Birch","Aurora","Tundra"]),
 ("regatta-run","Regatta Run",BLUE,"⛵","racing yachts heeled over rounding a marker buoy in choppy sea",["Windward","Solstice","Kestrel","Meridian","Halyard","Spindrift"]),
 ("snail-derby","Snail Derby",PINK,"🐌","comically determined snails racing along a dewy garden track",["Turbo","Slime","Doris","Gastro","Zippy","Escar"]),
 ("rocket-rally","Rocket Rally",PURPLE,"🚀","small rockets racing through an asteroid corridor toward a ring gate",["Ion","Pulsar","Nova","Vega","Quasar","Zenith"]),
],

"duel": [
 ("arm-wrestle","Arm Wrestle",ORANGE,"💪","two arm wrestlers straining across a bar table under a hanging lamp",["Red Corner","Blue Corner"]),
 ("sumo-clash","Sumo Clash",RED,"🤼","two sumo wrestlers colliding in a sand ring under paper lanterns",["East","West"]),
 ("tug-of-war","Tug of War",LIME,"🪢","two teams straining on a rope across a muddy field",["Green Team","Gold Team"]),
 ("ringside-bout","Ringside Bout",GOLD,"🥊","two boxers trading punches under harsh ring lights",["Champion","Challenger"]),
 ("robot-rumble","Robot Rumble",CYAN,"🤖","two battle robots clashing in a sparking arena cage",["Unit A","Unit B"]),
 ("joust-royale","Joust Royale",BLUE,"🐴","two armoured knights charging with lances in a tournament field",["Blue Lance","Red Lance"]),
 ("shark-standoff","Shark Standoff",ICE,"🦈","two sharks circling each other over a sunlit reef",["Tiger","Hammer"]),
 ("dragon-duel","Dragon Duel",PURPLE,"🐲","two dragons breathing fire at each other above storm clouds",["Ember","Frost"]),
 ("mech-arena","Mech Arena",GREEN,"🦾","two towering mechs locked in combat in a neon industrial arena",["Titan","Vulcan"]),
 ("colosseum-clash","Colosseum Clash",GOLD,"⚔️","two gladiators duelling on the sand of a packed Roman colosseum",["Murmillo","Retiarius"]),
],

"shuffle": [
 ("beach-shells","Beach Shells",CYAN,"🐚","three large sea shells on wet sand, one hiding a glowing pearl",["Shell"]),
 ("street-cups","Street Cups",RED,"🥤","three cups on a street hustler's folding table at night",["Cup"]),
 ("magicians-hats","Magician's Hats",PURPLE,"🎩","three top hats on a velvet stage under a spotlight",["Hat"]),
 ("alchemy-pots","Alchemy Pots",LIME,"🫙","three bubbling clay pots on an alchemist's bench",["Pot"]),
 ("helmet-hustle","Helmet Hustle",BLUE,"🪖","three steel helmets upturned on a field drum",["Helmet"]),
 ("tavern-barrels","Tavern Barrels",ORANGE,"🛢️","three oak barrels in a candlelit tavern cellar",["Barrel"]),
 ("masquerade-shuffle","Masquerade",PINK,"🎭","three ornate venetian masks face-down on a velvet table",["Mask"]),
 ("lantern-shuffle","Lantern Shuffle",GOLD,"🏮","three paper lanterns glowing on a night market stall",["Lantern"]),
 ("island-coconuts","Island Coconuts",LIME,"🥥","three coconut halves on a palm-shaded beach table",["Coconut"]),
 ("crypt-skulls","Crypt Skulls",GREEN,"💀","three carved skulls on a stone crypt ledge lit by green torchlight",["Skull"]),
],

"match3": [
 ("gold-rush-match","Gold Rush Match",GOLD,"⛏️","gold nuggets and pans on a prospector's claim by a mountain stream"),
 ("gem-triple","Gem Triple",PURPLE,"💎","three matching cut gemstones glowing on black velvet"),
 ("fruit-trio","Fruit Trio",RED,"🍒","glossy cherries lemons and plums on a bright retro panel"),
 ("triple-sevens","Triple Sevens",GOLD,"7️⃣","three blazing red sevens on a chrome slot panel"),
 ("lucky-horseshoe","Lucky Horseshoe",ORANGE,"🍀","a golden horseshoe on weathered barn wood with clover"),
 ("clover-match","Clover Match",GREEN,"☘️","four leaf clovers glistening with dew in emerald grass"),
 ("moon-match","Moon Match",BLUE,"🌙","crescent moons and stars on deep indigo night sky"),
 ("neon-triple","Neon Triple",PINK,"🌆","glowing neon symbols on a rain-slick city wall at night"),
 ("candy-triple","Candy Triple",PINK,"🍬","bright wrapped sweets and lollipops on pastel pink"),
 ("skull-match","Skull Match",LIME,"☠️","sugar skulls painted with marigolds on a day-of-the-dead altar"),
],

"wires": [
 ("defuse-squad","Defuse Squad",RED,"🧨","a bomb disposal technician's hands over a wire bundle, timer counting"),
 ("fuse-box","Fuse Box",GOLD,"🔌","an old fuse box open with tangled wires and arcing sparks"),
 ("circuit-breaker","Circuit Breaker",CYAN,"⚡","an industrial breaker panel with cables and warning lamps"),
 ("alarm-override","Alarm Override",ORANGE,"🚨","a security alarm panel with a red strobe and exposed wiring"),
 ("reactor-shutdown","Reactor Shutdown",GREEN,"☣️","a control panel deep in a reactor, wires under emergency lighting"),
 ("vault-wires","Vault Wires",PURPLE,"🔓","a hacked bank vault door with wiring pulled from the keypad"),
 ("drone-disarm","Drone Disarm",BLUE,"🛸","an opened drone chassis showing coloured wiring on a workbench"),
 ("torpedo-disarm","Torpedo Disarm",ICE,"🐋","a torpedo casing opened underwater showing wiring, divers nearby"),
 ("satellite-override","Satellite Override",PURPLE,"🛰️","an open satellite panel in orbit with Earth glowing behind"),
 ("android-shutdown","Android Shutdown",LIME,"🤖","an android's open chest cavity revealing glowing filament wires"),
],

"spots": [
 ("star-chart","Star Chart",BLUE,"⭐","a brass celestial chart with glowing star positions"),
 ("lucky-numbers","Lucky Numbers",GOLD,"🔢","numbered lottery balls tumbling in a glass draw machine"),
 ("bingo-blitz","Bingo Blitz",PINK,"🎱","a bingo hall card and dabber with numbered balls"),
 ("rune-draw","Rune Draw",PURPLE,"🪄","carved stone runes glowing on a dark wooden table"),
 ("zodiac-spots","Zodiac Spots",GOLD,"♌","a gilded zodiac wheel with constellations against night sky"),
 ("tarot-numbers","Tarot Numbers",RED,"🔮","numbered tarot cards fanned on a candlelit velvet cloth"),
 ("deep-sea-draw","Deep Sea Draw",CYAN,"🌊","bioluminescent orbs rising through deep ocean water"),
 ("galaxy-draw",  "Galaxy Draw",PURPLE,"🌌","a spiral galaxy with numbered points of light"),
 ("garden-draw","Garden Draw",LIME,"🌻","sunflowers and seed pods arranged in a bright cottage garden"),
 ("temple-draw","Temple Draw",ORANGE,"🛕","numbered stone tablets on the steps of a jungle temple"),
],

"streak": [
 ("card-climb","Card Climb",RED,"🂡","playing cards ascending in a glowing staircase"),
 ("dice-climb","Dice Climb",CYAN,"🎲","dice stacked into a climbing tower on a felt table"),
 ("number-ladder","Number Ladder",GOLD,"🔺","glowing numerals rising up a dark ladder of light"),
 ("gem-ladder","Gem Ladder",PURPLE,"💠","gemstones set into ascending steps of a crystal stair"),
 ("temperature-run","Temperature Run",ORANGE,"🌡️","a thermometer's mercury climbing past marked gradations"),
 ("altimeter-run","Altimeter Run",BLUE,"🛩️","an aircraft altimeter dial winding upward above the clouds"),
 ("bull-run","Bull Run",GREEN,"📈","a rising green candlestick chart on a trading floor screen"),
 ("speedometer-run","Speedometer Run",RED,"🏁","a car speedometer needle sweeping toward the redline"),
 ("decibel-run","Decibel Run",PINK,"🔊","a concert VU meter climbing into the red at a packed show"),
 ("power-meter-run","Power Meter Run",LIME,"🔋","a glowing power gauge charging toward full"),
],

"wheelx": [
 ("neon-wheel","Neon Wheel",PINK,"🎡","a neon-tubed prize wheel glowing in a dark arcade"),
 ("golden-wheel","Golden Wheel",GOLD,"🏵️","an ornate gilded fortune wheel in a marble hall"),
 ("pirate-wheel","Pirate Wheel",ORANGE,"🏴‍☠️","a ship's wheel repurposed as a prize wheel on a pirate deck"),
 ("circus-wheel","Circus Wheel",RED,"🎪","a striped carnival wheel under big-top lights"),
 ("cosmic-wheel","Cosmic Wheel",PURPLE,"🪐","a wheel of planets and stars turning in deep space"),
 ("jungle-wheel","Jungle Wheel",LIME,"🌴","a wooden tribal prize wheel in a torchlit jungle clearing"),
 ("frost-wheel","Frost Wheel",ICE,"❄️","a wheel carved from blue ice glittering in an arctic cave"),
 ("dragon-wheel","Dragon Wheel",RED,"🐉","a wheel ringed with dragon scales and fire"),
 ("vegas-wheel","Vegas Wheel",GOLD,"🎰","a glittering casino prize wheel on the Vegas strip at night"),
 ("candy-wheel","Candy Wheel",PINK,"🍭","a wheel made of swirled candy and lollipops on pastel pink"),
],

"dig": [
 ("gold-mine-dig","Gold Mine Dig",GOLD,"⛏️","a mine shaft face with gold veins and a pickaxe embedded"),
 ("gem-quarry","Gem Quarry",PURPLE,"💜","an open quarry wall studded with raw amethyst crystals"),
 ("buried-treasure","Buried Treasure",ORANGE,"🏝️","a treasure chest half unearthed from beach sand with a shovel"),
 ("tomb-dig","Tomb Raider Dig",GOLD,"🏺","an archaeologist brushing sand from a golden sarcophagus"),
 ("glacier-dig","Glacier Dig",ICE,"🧊","an ice wall being chipped away revealing something frozen inside"),
 ("moon-mining","Moon Mining",BLUE,"🌕","a lunar mining rig on grey regolith with Earth on the horizon"),
 ("garden-plot","Garden Plot",LIME,"🥕","a vegetable garden plot with fresh-turned soil and a trowel"),
 ("sandcastle-dig","Sandcastle Dig",GOLD,"🏖️","a beach dig around a sandcastle with a bucket and spade"),
 ("volcano-dig","Volcano Dig",RED,"🌋","obsidian rock face being broken open near a lava flow"),
 ("lost-ruins-dig","Lost Ruins Dig",GREEN,"🗿","vine-covered stone ruins being excavated in a jungle"),
],

"ladder": [
 ("money-ladder","Money Ladder",GREEN,"💵","stacks of cash forming ascending steps under a spotlight"),
 ("temple-steps","Temple Steps",ORANGE,"🛕","steep stone temple steps climbing into golden mist"),
 ("skyscraper-climb","Skyscraper Climb",BLUE,"🏢","a window cleaner's rig climbing a mirrored skyscraper"),
 ("summit-climb","Summit Climb",ICE,"🏔️","a climber ascending a snowy ridge toward a sunlit summit"),
 ("beanstalk-climb","Beanstalk Climb",LIME,"🌱","a giant beanstalk winding up through the clouds"),
 ("lighthouse-climb","Lighthouse Climb",GOLD,"🗼","a spiral staircase inside a lighthouse rising to the lamp"),
 ("pyramid-ascent","Pyramid Ascent",GOLD,"🔺","great stone blocks stepping up the side of a desert pyramid"),
 ("treehouse-climb","Treehouse Climb",GREEN,"🌳","rope ladder rungs climbing a huge forest tree to a treehouse"),
 ("launch-ladder","Launch Ladder",PURPLE,"🚀","a rocket gantry ladder climbing beside a rocket at night"),
 ("rank-ladder","Rank Ladder",RED,"🎖️","military rank insignia mounted in an ascending row"),
],

"catch": [
 ("apple-catch","Apple Catch",RED,"🍎","red apples falling from a tree toward waiting baskets"),
 ("coin-drop-catch","Coin Drop Catch",GOLD,"🪙","gold coins raining down toward open leather pouches"),
 ("star-catch","Star Catch",BLUE,"🌟","falling stars streaking down toward a net held to the sky"),
 ("egg-catch","Egg Catch",GOLD,"🥚","eggs tumbling from a henhouse shelf toward straw baskets"),
 ("meteor-catch","Meteor Catch",ORANGE,"☄️","meteors burning down through the atmosphere toward collectors"),
 ("fish-catch","Fish Catch",CYAN,"🐟","salmon leaping and falling toward waiting nets in a river"),
 ("snowflake-catch","Snowflake Catch",ICE,"❄️","large snowflakes drifting down toward upturned glass jars"),
 ("gem-catch","Gem Catch",PURPLE,"💎","gemstones tumbling from a cavern ceiling toward stone bowls"),
 ("bomb-dodge","Bomb Dodge",LIME,"💣","cartoon bombs and gold falling together toward three chutes"),
 ("golden-rain","Golden Rain",GOLD,"🌧️","a shower of gold droplets falling toward gilded basins"),
],

"safe": [
 ("bank-vault-crack","Bank Vault Crack",GREEN,"🏦","a huge bank vault dial and door under fluorescent light"),
 ("casino-safe","Casino Safe",RED,"🎰","a casino counting-room safe surrounded by chip racks"),
 ("museum-heist","Museum Heist",PURPLE,"🖼️","a display case lock in a darkened museum lit by torch beam"),
 ("pirate-lockbox","Pirate Lockbox",ORANGE,"🗝️","an iron-banded pirate lockbox with a rusted combination lock"),
 ("server-vault","Server Vault",CYAN,"💻","a holographic combination lock floating in a server room"),
 ("tomb-seal","Tomb Seal",GOLD,"🪬","a carved stone disc sealing a pharaoh's tomb door"),
 ("diamond-vault","Diamond Vault",ICE,"💠","a diamond exchange vault door with glittering security glass"),
 ("train-car-safe","Train Car Safe",ORANGE,"🚂","a strongbox bolted inside a moving steam-train mail car"),
 ("yacht-safe","Yacht Safe",BLUE,"🛥️","a hidden wall safe in a luxury yacht stateroom"),
 ("lunar-vault","Lunar Vault",PURPLE,"🌘","an airlock-style vault door on a lunar base corridor"),
],

"burst": [
 ("bubble-burst","Bubble Burst",CYAN,"🫧","a cluster of soap bubbles, one bursting into droplets"),
 ("balloon-pop","Balloon Pop",RED,"🎈","a wall of party balloons with one bursting into confetti"),
 ("firework-burst","Firework Burst",GOLD,"🎆","fireworks exploding in golden chrysanthemums over a bay"),
 ("seed-pods","Seed Pods",LIME,"🌾","ripe seed pods splitting open and scattering seeds"),
 ("orb-burst","Orb Burst",PURPLE,"🔮","glowing magical orbs suspended, one shattering into sparks"),
 ("lantern-burst","Lantern Burst",ORANGE,"🏮","sky lanterns rising at night, one flaring brightly"),
 ("egg-burst","Egg Burst",PINK,"🐣","decorated eggs cracking open in bright spring light"),
 ("star-burst","Star Burst",BLUE,"✨","a star going supernova in a field of distant stars"),
 ("gem-burst","Gem Burst",PURPLE,"💎","a large crystal shattering into glittering shards"),
 ("bomb-burst","Bomb Burst",RED,"💥","comic-style bombs, one detonating in a cloud of smoke"),
],

"draw": [
 ("legendary-chest","Legendary Chest Draw",GOLD,"🎁","a legendary chest bursting open in a beam of golden light"),
 ("rare-card-pull","Rare Card Pull",PURPLE,"🃏","a holographic rare trading card being pulled from a pack"),
 ("gemstone-draw","Gemstone Draw",CYAN,"💍","a jeweller's tray of graded gemstones under a loupe lamp"),
 ("relic-draw","Relic Draw",ORANGE,"🏺","an ancient relic lifted from a stone pedestal in torchlight"),
 ("capsule-machine","Capsule Machine",PINK,"🎰","a gumball capsule machine full of coloured prize capsules"),
 ("scroll-draw","Scroll Draw",GOLD,"📜","sealed scrolls in a wizard's rack, one glowing brightly"),
 ("loot-crate","Loot Crate",GREEN,"📦","a military loot crate cracked open with light pouring out"),
 ("gacha-sphere","Gacha Sphere",BLUE,"🔵","a glowing gacha sphere splitting open to reveal a prize"),
 ("booster-pack","Booster Pack",RED,"🎴","a foil booster pack tearing open with cards fanning out"),
 ("summon-circle","Summon Circle",PURPLE,"🪄","a glowing arcane summoning circle on a stone floor"),
],

"trail": [
 ("fortune-trail","Fortune Trail",GOLD,"🎲","a winding board-game trail of golden tiles seen from above"),
 ("island-trail","Island Trail",CYAN,"🏝️","a stepping trail of islands across turquoise sea from above"),
 ("serpent-trail","Serpent Trail",GREEN,"🐍","a board trail with painted snakes and ladders across it"),
 ("castle-trail","Castle Trail",BLUE,"🏰","a cobbled trail winding up to a castle gate, seen from above"),
 ("star-trail","Star Trail",PURPLE,"🌠","a trail of glowing waypoints across a starfield"),
 ("forest-trail","Forest Trail",LIME,"🌲","a woodland path of stone markers through autumn forest"),
 ("desert-trail","Desert Trail",ORANGE,"🐫","a caravan trail of markers across rippled desert dunes"),
 ("neon-city-trail","Neon City Trail",PINK,"🌃","a glowing grid trail across a neon city map at night"),
 ("reef-trail","Reef Trail",ICE,"🐠","a trail of coral markers across a bright tropical reef"),
 ("frost-trail","Frost Trail",ICE,"⛄","a trail of ice markers across a frozen lake at blue hour"),
],

"fuse": [
 ("dynamite-fuse","Dynamite Fuse",RED,"🧨","a lit fuse sparking toward a bundle of dynamite"),
 ("candle-burn","Candle Burn",GOLD,"🕯️","a tall candle burning down in a dark stone room"),
 ("countdown-timer","Countdown Timer",CYAN,"⏱️","a digital countdown timer glowing in a dark control room"),
 ("hourglass-run","Hourglass Run",ORANGE,"⏳","an ornate hourglass with sand running out on a desk"),
 ("core-meltdown","Core Meltdown",LIME,"☢️","a reactor core overheating behind warning-striped glass"),
 ("launch-countdown","Launch Countdown",PURPLE,"🚀","a rocket on the pad venting vapour during final countdown"),
 ("vault-timer","Vault Timer",GREEN,"🕰️","a brass time-lock mechanism on a bank vault door"),
 ("bank-alarm","Bank Alarm",BLUE,"🔔","a bank alarm bell mid-ring in a marble lobby"),
 ("lava-timer","Lava Timer",ORANGE,"🌋","lava rising steadily up a stone shaft toward a ledge"),
 ("storm-timer","Storm Timer",ICE,"⛈️","a storm front rolling in fast across open plains"),
],
}

STYLE = ("premium online casino game key art, cinematic lighting, rich saturated "
         "colour, highly detailed 3d render, dramatic rim light, centred subject, "
         "clean uncluttered background, no text, no words, no lettering, no logos, "
         "no watermark, no user interface")


def build():
    games, prompts = [], {}
    for eng, rows in CAT.items():
        cat, motif, style_hint = ENGINES[eng]
        for row in rows:
            gid, name, accent, emblem, subject = row[0], row[1], row[2], row[3], row[4]
            words = row[5] if len(row) > 5 else None
            games.append({
                "id": gid, "name": name, "eng": eng, "cat": cat,
                "accent": accent, "emblem": emblem, "motif": motif,
                **({"words": words} if words else {}),
            })
            prompts[gid] = f"{subject}, {style_hint}, {STYLE}"
    return games, prompts


def main():
    games, prompts = build()
    ids = [g["id"] for g in games]
    assert len(ids) == len(set(ids)), "duplicate game id"
    print(f"{len(games)} games across {len(CAT)} engines")

    root = pathlib.Path(__file__).resolve().parent.parent
    (root / "tools" / "prompts200.json").write_text(
        json.dumps(prompts, indent=1, ensure_ascii=False), encoding="utf-8")

    lines = [
        "/* 200 instant games — generated by tools/catalog200.py, do not hand-edit.",
        "   Each entry names the engine that mounts it plus its own palette, emblem",
        "   and in-game vocabulary, so no two variants of an engine feel alike. */",
        "export const CATALOG200 = [",
    ]
    for g in games:
        w = ("," + json.dumps(g["words"], ensure_ascii=False)) if "words" in g else ""
        lines.append(
            f'  {{ id: {json.dumps(g["id"])}, name: {json.dumps(g["name"])},'
            f' eng: {json.dumps(g["eng"])}, cat: {json.dumps(g["cat"])},'
            f' accent: {json.dumps(g["accent"])}, emblem: {json.dumps(g["emblem"])},'
            f' motif: {json.dumps(g["motif"])}'
            + (f', words: {json.dumps(g["words"], ensure_ascii=False)}' if "words" in g else "")
            + " },")
    lines.append("];")
    (root / "js" / "games" / "catalog200.js").write_text(
        "\n".join(lines) + "\n", encoding="utf-8")
    print("wrote js/games/catalog200.js and tools/prompts200.json")


if __name__ == "__main__":
    main()
