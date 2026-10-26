# SunSpot — Copenhagen paper theatre

A practical map with a handmade, slightly absurd cast of Copenhagen adults. The illustrations carry the humor; the interface stays quiet and useful.

The cast now lives throughout the app. The three new characters welcome visitors in the finder; the blue coat, football shirt and stripes lead the park, bar and food choices and their place cards. Other figures accompany search results, empty states, invitations and RSVP choices. Golden Hour uses the puffer as its entrance and recurring characters alongside offer and voucher artwork.

`src/Character.jsx` supplies every figure from the approved atlas, including the full gallery. A shared registry keeps names and cell positions aligned. All these character images are decorative: labels, real weather and opening data, offer terms and native controls carry the information. The figures do not intercept clicks. The compact mobile finder keeps the search button visible and leaves at least 35% of the initial viewport available to the map. Expanded choices scroll within the finder.

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

The original six-person cast is joined by three portrait-inspired caricatures in `sunspot-friends-trio.png`: a broad man with a round face, very small nose and short brown beard in a blue striped shirt, a shorter, slightly fuller strawberry-blonde curly-haired woman in a white T-shirt and wide light jeans, and an angular dark-haired man with light stubble in a black turtleneck. These three were drawn afresh from the original private person photos, using only `sunspot-cast.png` as the style reference; previous trio drawings and the previous gallery's bottom row were excluded. Reference photos are never copied into the repository.

Flat paper colors, uneven brown-black contours, tilted heads, awkward body axes and oversized hands and shoes keep the trio within the original cast's graphic style. Paper grain alone does not establish a style match: avoid neat symmetric cartoon anatomy as well as modeled skin, portrait lighting and polished digital faces. Each new character looks toward the viewer, with a closed mouth and a restrained, wry expression. The blue-shirt character folds his arms; the curly-haired character rests one hand on her hip; the black-turtleneck character has a long, angular face, longer nose and hands behind his back. Their silhouettes and poses stay distinct, with slightly slimmer bodies on the two left characters. All characters retain heavy eyelids with medium, clearly visible pupils, between large irises and tiny dots.

All eight PNG assets are in `public/illustrations`, including the complete 1024×1536 nine-person cast sheet `sunspot-complete-cast.png`. Its equal three-by-three cells supply nine individually labelled cards in one gallery, with two columns on mobile and three on desktop. The artwork has no drawn separators; the UI supplies exact cell borders. Keep each entire figure and both shoes inside its cell with clear padding. Visually assess the artwork against the original six before integration; browser checks verify column counts, atlas proportions and cell positions, but cannot judge the drawing style. Static imports give the artwork content-hashed URLs and native blur previews. Images are served through Next.js optimization at responsive sizes; scenes load individually when opened. Full-size source artwork is not downloaded as an initial bundle.

## Interaction and data honesty

The mobile screen starts with the map visible and a compact paper sheet. The user can find a spot immediately or expand the place/time controls. The five-scene theatre and character lineup open in a dismissible, keyboard-accessible gallery.

Map information uses the existing building-shadow calculations and MET Norway forecasts. Unknown, cloudy or missing conditions retain their actual status. Illustrations are explicitly labeled as illustrations, not weather evidence.

The Golden Hour prototype notification shows Café Stefanshus, a beer for 10 DKK, a 60-minute duration and simulated sunshine. Its label reads **“EKSEMPEL · simuleret sol, vejr og tilbud”**. Sun/cloud controls and the countdown are isolated from real offer claims; the example ticket is marked **“IKKE GYLDIG”** and cannot be redeemed. Real partner offers and server-verified coupons remain a separate flow.

Buttons in the new theatre layer are at least 44 pixels high, image dimensions prevent layout jumps, and decorative motion respects reduced-motion settings.
