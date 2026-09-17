import L from "leaflet";

export function fitPlacesView(map, places) {
  if (!places.length) return;
  const mobile = map.getSize().x < 700;
  map.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lng])), {
    paddingTopLeft: mobile ? [35, 150] : [55, 140],
    paddingBottomRight: mobile ? [85, 210] : [400, 210],
    maxZoom: 16,
    animate: false,
  });
}
