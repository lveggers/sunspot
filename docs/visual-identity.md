# SunSpot — Copenhagen paper theatre

A practical map with a handmade, slightly absurd cast of Copenhagen adults. The illustrations carry the humor; the interface stays quiet and useful.

## Design tokens

| Token | Color | Use |
| --- | --- | --- |
| Cream | `#F3EDDF` | Warm paper backgrounds |
| Paper | `#FFFDF5` | Controls and cards |
| Pine | `#293C31` | Text and fine outlines |
| Dusty green | `#496C57` | Actions and selected states |
| Sage | `#9AAA87` | Park and landscape accents |
| Gold | `#E8B94D` | Sunlight and the main action |
| Clay | `#C98E73` | Secondary warm accents |
| Blue grey | `#CED9D6` | Sky and waterfront context |

Fraunces is the editorial display face, with DM Sans for controls and data. Paper grain, slight asymmetry and soft offset shadows replace glossy gradients and heavy comic outlines. Colors are defined once in `src/styles.css`; the brand layout and map-first sheet live in `src/identity.css`.

## Cast and scenery

Six original adult puppets use contrasting lanky and squat proportions, half-lidded eyes, expressive noses, imperfect teeth, visible suspension strings and uninterrupted paper clothing. No visible joint rivets, brads or decorative fasteners are used. Pupils share a coherent gaze while the heavy eyelids retain the dry expression. Practical jackets, wide denim, football shirts, scarves, cycling details and everyday bags place them in contemporary Copenhagen.

The supplied cartoon references informed proportion and expression; their actual characters were not copied. Wardrobe research includes original photography from [Copenhagen in August 2026](https://www.vogue.com/slideshow/copenhagen-fashion-week-street-style-spring-2027) and [AW26 street style](https://www.voguescandinavia.com/articles/the-best-street-style-copenhagen-fashion-week-fall-winter-2026).

The five scenes are:

1. A beer on a sunlit park bench by the waterfront.
2. A cheeky Vestegnen group on a day out.
3. Adults squeezing into a tiny patch of sunlight outside a bar.
4. Friends chasing the sun between Copenhagen buildings.
5. A gathering outside a bar during Golden Hour.

The original six-person cast is joined by three portrait-inspired caricatures in `sunspot-friends-trio.png`: a smiling man in a blue striped shirt, a strawberry-blonde curly-haired woman in a white T-shirt and a dark-haired man in a black turtleneck. Their uneven smiles, pronounced noses and imperfect faces keep them humorous rather than polished. All characters retain heavy eyelids with medium, clearly visible pupils, between large irises and tiny dots.

All seven PNG assets are in `public/illustrations`. Static imports give them content-hashed URLs and native blur previews. They are served through Next.js image optimization at responsive sizes; scenes load individually when opened. Full-size source artwork is not downloaded as an initial bundle.

## Interaction and data honesty

The mobile screen starts with the map visible and a compact paper sheet. The user can find a spot immediately or expand the place/time controls. The five-scene theatre and character lineup open in a dismissible, keyboard-accessible gallery.

Map information uses the existing building-shadow calculations and MET Norway forecasts. Unknown, cloudy or missing conditions retain their actual status. Illustrations are explicitly labeled as illustrations, not weather evidence.

The Golden Hour prototype notification shows Café Stefanshus, a beer for 10 DKK, a 60-minute duration and simulated sunshine. Its label reads **“EKSEMPEL · simuleret sol, vejr og tilbud”**. Sun/cloud controls and the countdown are isolated from real offer claims; the example ticket is marked **“IKKE GYLDIG”** and cannot be redeemed. Real partner offers and server-verified coupons remain a separate flow.

Buttons in the new theatre layer are at least 44 pixels high, image dimensions prevent layout jumps, and decorative motion respects reduced-motion settings.
