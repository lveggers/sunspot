import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { mapColors } from "./theme.js";
import { Plus, Minus, LocateFixed, Layers, Info } from "lucide-react";
import { groupMapMarkers, sunFocusPoints } from "./mapMarkers.js";
import { atHour } from "./lib.js";
import { useLanguage } from "./Language.jsx";

import * as SunCalc from "suncalc";
import { hasParkArea, fitParkView } from "./ParkFocusLayer.js";
import { fitPlacesView } from "./VenueFocusLayer.js";
import "./map-sun-focus.css";

export default function MapView({
  pending = false,
  weatherState = "unknown",
  categories = ["park", "bar", "restaurant"],
  focusResults = false,
  fitResultsToken = 0,
  viewReset = 0,
  places,
  focusPlaces = places,
  selected,
  onSelect,
  date,
  hour,
  results,
  buildings,
  dataError,
  onRetry,
  point,
  onPointChange,
  editing,
  onCancelEdit,
  seatError,
  children,
}) {
  const { language, t, errorText } = useLanguage();
  const touchgrass =
    focusResults &&
    categories.length === 1 &&
    categories[0] === "park" &&
    places.every(hasParkArea);
  const venueFocus = focusResults && !touchgrass;
  const container = useRef(null),
    map = useRef(null),
    layer = useRef(null);
  const colorPane = useRef(null);
  const seatLayer = useRef(null);
  const markers = useRef(new Map());
  const lastPlaces = useRef([]);
  const fittedRequest = useRef({ fitResultsToken, viewReset });
  const [toolsOpen, setToolsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [tileError, setTileError] = useState(false);
  const instant = atHour(date, hour);
  const altitude = SunCalc.getPosition(instant, 55.6865, 12.581).altitude;
  const daylight = altitude > 0;
  useEffect(() => {
    const m = L.map(container.current, {
      zoomControl: false,
      scrollWheelZoom: true,
      minZoom: 11,
      maxZoom: 18,
    }).setView([55.683, 12.581], 14);
    map.current = m;
    const registry = markers.current;

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    })
      .on("tileerror", () => setTileError(true))
      .addTo(m);
    const pane = m.createPane("sunFocusColor");
    pane.classList.add("sun-focus-color-pane");
    pane.style.pointerEvents = "none";
    pane.style.visibility = "hidden";
    pane.style.clipPath = "inset(0 100% 100% 0)";
    pane.dataset.activeCount = "0";
    colorPane.current = pane;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      pane: "sunFocusColor",
      maxZoom: 19,
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    seatLayer.current = L.layerGroup().addTo(m);
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      m.remove();
      registry.clear();
      map.current = null;
      colorPane.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    const registry = markers.current;
    const sunny = new Set(sunFocusPoints(focusPlaces, results, { pending, weatherState, daylight }).map((p) => p.id));
    if (!pending) lastPlaces.current = places;
    const update = () => {
      const zoom = m.getZoom();
      const bounds = m.getBounds().pad(0.04);
      const items = editing
        ? []
        : groupMapMarkers(
            (pending ? lastPlaces.current : places).map((p) => {
              const point = results[p.id]?.point;
              return point ? { ...p, lat: point[1], lng: point[0] } : p;
            }),
            {
              project: (p) => m.project([p.lat, p.lng], zoom),
              zoom,
              language,
              selectedId: selected?.id,
              bounds: {
                south: bounds.getSouth(),
                north: bounds.getNorth(),
                west: bounds.getWest(),
                east: bounds.getEast(),
              },
            },
          );
      const wanted = new Set(items.map((p) => p.markerId));
      for (const [id, record] of registry) {
        if (!wanted.has(id)) {
          layer.current.removeLayer(record.marker);
          registry.delete(id);
        }
      }
      for (const p of items) {
        const active = selected?.id === p.id;
        const confirmedSun = p.members ? p.members.some((member) => sunny.has(member.id)) : sunny.has(p.id);
        const compact = !active && zoom < 16;
        let record = registry.get(p.markerId);
        if (!record) {
          const button = document.createElement("button");
          const emoji = document.createElement("span"),
            name = document.createElement("b");
          button.append(emoji, name);
          const marker = L.marker([p.lat, p.lng], {
            keyboard: false,
            icon: L.divIcon({
              className: "place-pin-wrap",
              html: button,
              iconSize: [42, 42],
              iconAnchor: [21, 42],
            }),
          }).addTo(layer.current);
          record = { marker, button, emoji, name, item: p };
          marker.on("click", () => {
            const item = record.item;
            if (item.members) {
              m.fitBounds(
                item.members.map((v) => [v.lat, v.lng]),
                {
                  maxZoom: Math.min(17, m.getZoom() + 2),
                  padding: [70, 150],
                  animate: !window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches,
                },
              );
            } else onSelect(item);
          });
          registry.set(p.markerId, record);
        }
        record.item = p;
        const signature = `${language}|${p.name}|${p.emoji}|${active}|${compact}|${confirmedSun}|${p.members?.length}`;
        if (signature !== record.signature) {
          record.button.className = `place-pin ${p.members ? "cluster-pin" : ""} ${active ? "active" : ""} ${confirmedSun ? "sunny" : ""} ${compact && !p.members ? "compact" : ""}`;
          record.button.setAttribute(
            "aria-label",
            t(p.members ? "map.groupZoom" : "map.showPlace", { name: p.name }),
          );
          record.button.title = p.members
            ? t("map.groupHint", { name: p.name })
            : p.name;
          record.button.dataset.id = p.id;
          record.emoji.textContent = p.emoji;
          record.name.textContent = p.members ? p.members.length : p.name;
          record.marker.setZIndexOffset(active ? 1000 : 0);
          record.signature = signature;
        }
        record.button.hidden = pending;
        const current = record.marker.getLatLng();
        if (current.lat !== p.lat || current.lng !== p.lng)
          record.marker.setLatLng([p.lat, p.lng]);
      }
    };
    update();
    m.on("moveend zoomend resize", update);
    return () => m.off("moveend zoomend resize", update);
  }, [places, focusPlaces, selected, results, onSelect, editing, pending, weatherState, daylight, language, t]);
  useEffect(() => {
    if (selected?.greenSpace && touchgrass && map.current) {
      fitParkView(map.current, places, selected.id);
      return;
    }
    if (
      selected &&
      map.current &&
      !map.current.getBounds().pad(-0.1).contains([selected.lat, selected.lng])
    )
      map.current.panTo([selected.lat, selected.lng]);
    // Selecting a place changes the view; updated result batches do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, touchgrass]);
  useEffect(() => {
    if (!map.current) return;
    seatLayer.current.clearLayers();
    if (point && !touchgrass) {
      const colors = mapColors();
      L.circleMarker([point[1], point[0]], {
        radius: 7,
        color: colors.surface,
        weight: 3,
        fillColor: colors.blue,
        fillOpacity: 1,
      })
        .bindTooltip(t("map.seatTooltip"))
        .addTo(seatLayer.current);
    }
  }, [point, touchgrass, t]);
  useEffect(() => {
    if (!map.current || !editing) return;
    const m = map.current;
    container.current.scrollIntoView({ block: "center", behavior: "smooth" });
    m.setView(point ? [point[1], point[0]] : [selected.lat, selected.lng], 18);
    const choose = (e) => onPointChange([e.latlng.lng, e.latlng.lat]);
    m.on("click", choose);
    m.getContainer().style.cursor = "crosshair";
    return () => {
      m.off("click", choose);
      m.getContainer().style.cursor = "";
    };
  }, [point, editing, selected, onPointChange, touchgrass]);
  useEffect(() => {
    if (!map.current || !colorPane.current) return;
    const m = map.current;
    const pane = colorPane.current;
    const points = sunFocusPoints(focusPlaces, results, { pending, weatherState, daylight });
    const update = () => {
      // Screen-space windows reveal place context, not measured sunlight boundaries.
      const radius = 54;
      pane.style.width = `${m.getSize().x}px`;
      pane.style.height = `${m.getSize().y}px`;
      const path = points.map(({ lat, lng }) => {
        const p = m.latLngToLayerPoint([lat, lng]);
        return `M${p.x - radius},${p.y}a${radius},${radius} 0 1,0 ${radius * 2},0a${radius},${radius} 0 1,0 ${-radius * 2},0Z`;
      }).join(" ");
      pane.style.clipPath = path ? `path('${path}')` : "inset(0 100% 100% 0)";
      pane.style.visibility = points.length ? "" : "hidden";
      pane.dataset.activeCount = String(points.length);
      pane.dataset.weatherState = weatherState;
      pane.dataset.zoom = String(m.getZoom());
    };
    const hide = () => { pane.style.visibility = "hidden"; };
    update();
    m.on("moveend zoomend resize viewreset", update);
    m.on("zoomstart", hide);
    return () => {
      m.off("moveend zoomend resize viewreset", update);
      m.off("zoomstart", hide);
    };
  }, [focusPlaces, results, pending, weatherState, daylight]);
  useEffect(() => {
    if (!map.current || pending) return;
    const previous = fittedRequest.current;
    if (
      previous.fitResultsToken === fitResultsToken &&
      previous.viewReset === viewReset
    )
      return;
    fittedRequest.current = { fitResultsToken, viewReset };
    if (touchgrass) fitParkView(map.current, places);
    else fitPlacesView(map.current, places);
  }, [fitResultsToken, viewReset, pending, places, touchgrass]);
  return (
    <section
      className={`map-shell ${editing ? "editing" : ""} ${touchgrass ? "touchgrass" : ""} ${venueFocus ? "venue-focus" : ""}`}
      data-categories={categories.join(" ")}
      data-instant={instant.toISOString()}
      data-daylight={daylight}
      aria-label={t("map.region")}
    >
      <div ref={container} className="map sun-focus-map" data-sun-focus-enabled={!pending && weatherState === "sun" && daylight} />
      <button
        className="map-tools-toggle"
        aria-label={t("map.tools")}
        aria-expanded={toolsOpen}
        onClick={() => setToolsOpen((v) => !v)}
      >
        <Layers size={19} />
      </button>
      <div className={`map-tools ${toolsOpen ? "is-open" : ""}`}>
        <div className="map-controls">
          <button onClick={() => map.current?.zoomIn()} aria-label={t("map.zoomIn")}>
            <Plus size={19} />
          </button>
          <button onClick={() => map.current?.zoomOut()} aria-label={t("map.zoomOut")}>
            <Minus size={19} />
          </button>
          <button
            onClick={() =>
              touchgrass
                ? map.current && fitParkView(map.current, places)
                : map.current && fitPlacesView(map.current, places)
            }
            aria-label={t("map.showArea")}
          >
            <LocateFixed size={19} />
          </button>
        </div>
        <div className="map-layer-controls">
          <button
            aria-label={t("map.about")}
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((open) => !open)}
          >
            <Info size={17} />
          </button>
        </div>
      </div>
      {(legendOpen || dataError) && (
        <div className="zone-note shadow-legend" role="status">
          {dataError ? (
            <>
              <strong>{t("map.dataFailed")}</strong>
              <button onClick={onRetry}>{t("common.retry")}</button>
            </>
          ) : !buildings ? (
            <strong>{t("map.buildingsLoading")}</strong>
          ) : (
            <>
              <strong>
                <i className="sun-focus-swatch" />
                {altitude <= 0
                  ? t("map.sunBelow")
                  : altitude < 5
                    ? t("map.sunLow")
                    : t("map.sunFocusTitle")}
              </strong>
              <span>{t("map.sunFocusConditions")}</span>
              <span>{t("map.sunFocusContext")}</span>
              <span>{t("map.heightsNote")}</span>
              <span>{t("map.changeTime")}</span>
            </>
          )}
        </div>
      )}
      {editing && (
        <div className="seat-prompt" role="status">
          {t("map.chooseSeat")}
          {seatError && <p>{errorText(seatError)}</p>}
          <div>
            <button
              onClick={() => {
                const p = map.current.getCenter();
                onPointChange([p.lng, p.lat]);
              }}
            >
              {t("map.useCentre")}
            </button>
            <button onClick={onCancelEdit}>{t("map.cancelPoint")}</button>
          </div>
        </div>
      )}
      {tileError && (
        <div className="map-error" role="status">
          {t("map.tilesFailed")}
        </div>
      )}
      {children}
    </section>
  );
}
