import L from "leaflet";
import FocusVeilLayer from "./FocusVeilLayer.js";
import { mapColors } from "./theme.js";
import { venueAreas } from "./venueAreas.js";

export const hasParkArea = (place) =>
  Boolean(place.greenSpace && venueAreas.parks[place.id]?.length);

const latLngRings = (id) =>
  venueAreas.parks[id].map((polygon) =>
    polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng])),
  );
export function parkBounds(places, id) {
  const parks = places.filter((p) => hasParkArea(p) && (!id || p.id === id));
  return L.latLngBounds(
    parks.flatMap((p) => latLngRings(p.id).flatMap((polygon) => polygon[0])),
  );
}

export function fitParkView(map, places, id) {
  const bounds = parkBounds(places, id);
  if (!bounds.isValid()) return;
  const mobile = map.getSize().x < 700;
  map.fitBounds(bounds, {
    paddingTopLeft: mobile ? [35, 150] : [55, 140],
    paddingBottomRight: mobile ? [40, 210] : [400, 210],
    maxZoom: id ? 16 : 14,
    animate: false,
  });
}

// Put the green fill below shadows, then veil everything outside the parks.
// Outlines sit above both; park interiors retain their original shadow contrast.
export function parkFocusLayer(map, places, selectedId, onSelect) {
  const parks = places.filter(hasParkArea);
  for (const [name, zIndex] of [
    ["parkFill", 330],
    ["parkVeil", 380],
    ["parkOutline", 410],
  ]) {
    const pane = map.getPane(name) || map.createPane(name);
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = name === "parkOutline" ? "auto" : "none";
  }
  const colors = mapColors();
  const group = L.layerGroup();
  new FocusVeilLayer(
    parks.flatMap((p) => venueAreas.parks[p.id]),
    colors.cream,
  ).addTo(group);
  for (const park of parks) {
    const rings = latLngRings(park.id),
      selected = park.id === selectedId;
    L.polygon(rings, {
      pane: "parkFill",
      interactive: false,
      stroke: false,
      fillColor: colors.grass,
      fillOpacity: selected ? 0.32 : 0.23,
      className: "park-focus-fill",
    }).addTo(group);
    L.polygon(rings, {
      pane: "parkOutline",
      color: selected ? colors.ink : colors.blue,
      weight: selected ? 3 : 2,
      fill: true,
      fillOpacity: 0,
      className: "park-focus-outline",
      bubblingMouseEvents: false,
    })
      .on("click", () => onSelect(park))
      .addTo(group);
  }
  return group;
}
