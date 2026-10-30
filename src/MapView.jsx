import { useLanguage } from "./Language.jsx";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { mapColors } from "./theme.js";
import { Plus, Minus, LocateFixed, Layers, Info } from "lucide-react";
import { groupMapMarkers } from "./mapMarkers.js";
import { atHour } from "./lib.js";
import * as SunCalc from "suncalc";
import BuildingShadowLayer from "./BuildingShadowLayer.js";
import { parkFocusLayer, fitParkView } from "./ParkFocusLayer.js";
import { fitPlacesView } from "./VenueFocusLayer.js";
import { places as allPlaces } from "./places.js";
export default function MapView({
  pending = false,
  category = "all",
  viewReset = 0,
  places,
  events = [],
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
  const { t, locale } = useLanguage();
  const touchgrass = category === "park";
  const venueFocus = category === "bar" || category === "restaurant";
  const container = useRef(null),
    map = useRef(null),
    layer = useRef(null);
  const shadowLayer = useRef(null);
  const seatLayer = useRef(null);
  const markers = useRef(new Map());
  const lastPlaces = useRef([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [zones, setZones] = useState(true),
    [tileError, setTileError] = useState(false);
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
    layer.current = L.layerGroup().addTo(m);
    seatLayer.current = L.layerGroup().addTo(m);
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      m.remove();
      registry.clear();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const m = map.current;
    const registry = markers.current;
    if (!pending) lastPlaces.current = places;
    const update = () => {
      const zoom = m.getZoom();
      const bounds = m.getBounds().pad(0.04);
      const items = editing
        ? []
        : groupMapMarkers(
            [
              ...(pending ? lastPlaces.current : places).map((p) => {
                const point = results[p.id]?.point;
                return point
                  ? {
                      ...p,
                      lat: point[1],
                      lng: point[0],
                    }
                  : p;
              }),
              ...events,
            ],
            {
              project: (p) => m.project([p.lat, p.lng], zoom),
              zoom,
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
          record = {
            marker,
            button,
            emoji,
            name,
            item: p,
          };
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
        const signature = `${locale}|${p.name}|${p.emoji}|${active}|${compact}|${results[p.id]?.state}|${p.members?.length}`;
        if (signature !== record.signature) {
          record.button.className = `place-pin ${p.members ? "cluster-pin" : ""} ${p.category === "event" ? "event-pin" : ""} ${active ? "active" : ""} ${results[p.id]?.state === "sun" ? "sunny" : ""} ${compact && !p.members ? "compact" : ""}`;
          record.button.setAttribute(
            "aria-label",
            p.members
              ? t("Zooma in: {0}", [t(p.name)])
              : t("Visa {0}", [p.name]),
          );
          record.button.title = p.members
            ? t("{0} · tryck för att zooma", [t(p.name)])
            : p.name;
          record.button.dataset.id = p.id;
          record.emoji.textContent = p.emoji;
          record.name.textContent = p.members ? p.members.length : p.name;
          record.marker.setZIndexOffset(
            active ? 1000 : p.category === "event" ? 800 : 0,
          );
          record.signature = signature;
        }
        record.button.hidden = pending && p.category !== "event";
        const current = record.marker.getLatLng();
        if (current.lat !== p.lat || current.lng !== p.lng)
          record.marker.setLatLng([p.lat, p.lng]);
      }
    };
    update();
    m.on("moveend zoomend resize", update);
    return () => m.off("moveend zoomend resize", update);
  }, [
    places,
    events,
    selected,
    results,
    onSelect,
    editing,
    pending,
    locale,
    t,
  ]);
  useEffect(() => {
    if (selected?.greenSpace && touchgrass && map.current) {
      fitParkView(map.current, selected.id);
      return;
    }
    if (
      selected &&
      map.current &&
      !map.current.getBounds().pad(-0.1).contains([selected.lat, selected.lng])
    )
      map.current.panTo([selected.lat, selected.lng]);
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
        .bindTooltip(t("Beräkningspunkt / din sittplats"))
        .addTo(seatLayer.current);
    }
    if (!editing) return;
    const m = map.current;
    container.current.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
    m.setView(point ? [point[1], point[0]] : [selected.lat, selected.lng], 18);
    const choose = (e) => onPointChange([e.latlng.lng, e.latlng.lat]);
    m.on("click", choose);
    m.getContainer().style.cursor = "crosshair";
    return () => {
      m.off("click", choose);
      m.getContainer().style.cursor = "";
    };
  }, [point, editing, selected, onPointChange, touchgrass, t]);
  useEffect(() => {
    if (!buildings || !zones || !map.current) return;
    const shadows = new BuildingShadowLayer(
      buildings,
      atHour(date, hour),
    ).addTo(map.current);
    shadowLayer.current = shadows;
    return () => {
      shadows.remove();
      shadowLayer.current = null;
    };
    // Time changes update the existing layer, preserving its projection cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildings, zones]);
  useEffect(() => {
    shadowLayer.current?.setInstant(atHour(date, hour));
  }, [date, hour]);
  useEffect(() => {
    if (!touchgrass || !map.current) return;
    const focus = parkFocusLayer(map.current, selected?.id, onSelect).addTo(
      map.current,
    );
    return () => focus.remove();
  }, [touchgrass, selected?.id, onSelect]);
  useEffect(() => {
    if (!touchgrass || !map.current) return;
    const m = map.current;
    const fit = () => fitParkView(m);
    const frame = requestAnimationFrame(() => {
      m.invalidateSize();
      fit();
    });
    m.on("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      m.off("resize", fit);
    };
  }, [touchgrass]);
  useEffect(() => {
    if (!venueFocus || !map.current) return;
    const m = map.current;
    const fit = () =>
      fitPlacesView(
        m,
        allPlaces.filter((p) => p.category === category),
      );
    const frame = requestAnimationFrame(() => {
      m.invalidateSize();
      fit();
    });
    m.on("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      m.off("resize", fit);
    };
  }, [category, venueFocus]);
  useEffect(() => {
    if (viewReset && map.current) fitPlacesView(map.current, allPlaces);
  }, [viewReset]);
  const altitude = SunCalc.getPosition(
    atHour(date, hour),
    55.6865,
    12.581,
  ).altitude;
  return (
    <section
      className={`map-shell ${editing ? "editing" : ""} ${touchgrass ? "touchgrass" : ""} ${venueFocus ? `venue-focus ${category}` : ""}`}
      data-category={category}
      aria-label={t("Karta över platser i Köpenhamn")}
    >
      <div ref={container} className="map" />
      <button
        className="map-tools-toggle"
        aria-label={t("Kartverktyg")}
        aria-expanded={toolsOpen}
        onClick={() => setToolsOpen((v) => !v)}
      >
        <Layers size={19} />
      </button>
      <div className={`map-tools ${toolsOpen ? "is-open" : ""}`}>
        <div className="map-controls">
          <button
            onClick={() => map.current?.zoomIn()}
            aria-label={t("Zooma in")}
          >
            <Plus size={19} />
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            aria-label={t("Zooma ut")}
          >
            <Minus size={19} />
          </button>
          <button
            onClick={() =>
              touchgrass
                ? map.current && fitParkView(map.current)
                : map.current &&
                  fitPlacesView(
                    map.current,
                    allPlaces.filter(
                      (p) => category === "all" || p.category === category,
                    ),
                  )
            }
            aria-label={t("Visa hela området")}
          >
            <LocateFixed size={19} />
          </button>
        </div>
        <div className="map-layer-controls">
          <button
            className={zones ? "on" : ""}
            onClick={() => setZones(!zones)}
            aria-label={t("Byggnadsskuggor")}
            aria-pressed={zones}
          >
            <Layers size={17} />
            {t(" Skuggor")}
          </button>
          <button
            aria-label={t("Om kartan")}
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((open) => !open)}
          >
            <Info size={17} />
          </button>
        </div>
      </div>
      {zones && (legendOpen || dataError) && (
        <div className="zone-note shadow-legend" role="status">
          {dataError ? (
            <>
              <strong>{t("Skuggdata kunde inte laddas.")}</strong>
              <button onClick={onRetry}>{t("Försök igen")}</button>
            </>
          ) : !buildings ? (
            <strong>{t("Laddar byggnader…")}</strong>
          ) : (
            <>
              <strong>
                <i className="shadow-swatch" />
                {altitude <= 0
                  ? t("Solen är under horisonten")
                  : altitude < 5
                    ? t("Solen är för låg för skuggmodellen")
                    : t("Mörkt = beräknad byggnadsskugga")}
              </strong>
              {touchgrass && (
                <span>
                  <i className="park-swatch" />
                  {t("Grönt = markerad parkyta")}
                </span>
              )}
              <span>{t("Höjder delvis uppskattade · träd ingår inte")}</span>
              {altitude > 0 && (
                <span>
                  <i className="coverage-swatch" />
                  {t("Streckat = utanför modellens täckning")}
                </span>
              )}
              <span>{t("Ändra dag och tid för att följa skuggorna.")}</span>
            </>
          )}
        </div>
      )}
      {editing && (
        <div className="seat-prompt" role="status">
          {t(
            "Tryck på din sittplats utomhus, nära stället. Blå punkt används i beräkningen.",
          )}
          {seatError && <p>{t(seatError)}</p>}
          <div>
            <button
              onClick={() => {
                const p = map.current.getCenter();
                onPointChange([p.lng, p.lat]);
              }}
            >
              {t("Använd kartans mittpunkt")}
            </button>
            <button onClick={onCancelEdit}>{t("Avbryt punktval")}</button>
          </div>
        </div>
      )}
      {tileError && (
        <div className="map-error" role="status">
          {t("Kartbilder kunde inte laddas. Platserna finns i listan.")}
        </div>
      )}
      {children}
    </section>
  );
}
