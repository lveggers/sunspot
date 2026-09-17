import { useLanguage } from "./Language.jsx";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import L from "leaflet";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  Share2,
  Sun,
  Ticket,
  ExternalLink,
} from "lucide-react";
import { clock, dateLabel, localDate, weatherAt, weatherText } from "./lib.js";
function EventMap({ event }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  useEffect(() => {
    const map = L.map(ref.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView([event.lat, event.lng], 15);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.circleMarker([event.lat, event.lng], {
      radius: 10,
      color: "#fff",
      weight: 4,
      fillColor: "#567ea9",
      fillOpacity: 1,
    }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      map.remove();
    };
  }, [event.lat, event.lng]);
  return (
    <div
      className="event-mini-map"
      ref={ref}
      role="img"
      aria-label={t("Karta: {0}", [event.venue || event.name])}
    />
  );
}
export default function EventDetails({ event, weather, onClose, stale }) {
  const { t, locale } = useLanguage();
  const ref = useRef(null),
    closeRef = useRef(null);
  const [shareStatus, setShareStatus] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const forecast = weatherAt(weather, event.startsAt);
  const multiDay =
    localDate(new Date(event.startsAt)) !== localDate(new Date(event.endsAt));
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus({
      preventScroll: true,
    });
    const escape = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    const panel = ref.current;
    return () => {
      document.removeEventListener("keydown", escape);
      if (panel?.contains(document.activeElement) && previous?.isConnected)
        previous.focus({
          preventScroll: true,
        });
    };
  }, [onClose]);
  async function share() {
    const url = event.sourceUrl;
    try {
      if (navigator.share)
        await navigator.share({
          title: event.name,
          url,
        });
      else {
        await navigator.clipboard.writeText(url);
        setShareStatus("Eventlänken är kopierad.");
      }
    } catch (error) {
      if (error.name !== "AbortError")
        setShareStatus("Kopiera länken via arrangörens sida längre ner.");
    }
  }
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}&travelmode=walking`;
  return (
    <section
      ref={ref}
      className="event-card event-sheet"
      role="dialog"
      aria-modal="false"
      aria-label={t("Valt event")}
    >
      <div className="event-sheet-toolbar">
        <button
          ref={closeRef}
          className="event-round-button"
          aria-label={t("Stäng event")}
          onClick={onClose}
        >
          <ArrowLeft size={21} />
        </button>
        <span>{event.demo ? "DEMO-EVENT" : t("UPPTÄCK KÖPENHAMN")}</span>
        {event.sourceUrl && (
          <button
            className="event-round-button"
            aria-label={t("Dela event")}
            onClick={share}
          >
            <Share2 size={19} />
          </button>
        )}
      </div>
      <div className="event-sheet-content">
        <div
          className={`event-cover ${!event.imageUrl || imageFailed ? "event-cover-fallback" : ""}`}
        >
          {event.imageUrl && !imageFailed ? (
            <Image
              src={event.imageUrl}
              alt={t("Omslag: {0}", [event.name])}
              width={900}
              height={650}
              unoptimized
              onError={() => setImageFailed(true)}
            />
          ) : (
            <>
              <Sun size={84} strokeWidth={1} />
              <span>{event.tags?.[0] || t("En stund tillsammans")}</span>
            </>
          )}
          <span className="event-cover-label">
            {event.demo
              ? t("Fiktivt exempel")
              : event.tags?.[0] || t("I Köpenhamn")}
          </span>
        </div>
        <div className="event-title-block">
          <h2>{event.name.replace(/ · demo$/, "")}</h2>
          <p className="event-presenter">
            {t("Av ")}
            <strong>{event.organizer || "SunSpot · demo"}</strong>
          </p>
          <div className="event-fact">
            <CalendarDays size={19} />
            <div>
              <strong>
                {dateLabel(event.startsAt, locale)}
                {multiDay ? ` – ${dateLabel(event.endsAt, locale)}` : ""}
              </strong>
              <span>
                <Clock3 size={13} />{" "}
                {event.allDay
                  ? t("Heldag enligt källan")
                  : t("{0}–{1} · Köpenhamnstid", [
                      clock(event.startsAt),
                      clock(event.endsAt),
                    ])}
              </span>
            </div>
          </div>
        </div>
        <div className="event-action-row">
          {event.registrationUrl ? (
            <a
              className="event-register"
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Ticket size={19} />
              {event.soldOut
                ? t("Se arrangörens sida")
                : t("Se event & anmälan")}
              <ArrowUpRight size={18} />
            </a>
          ) : (
            <p className="event-demo-notice">
              {t("Demo-event · inget verkligt evenemang och ingen anmälan.")}
            </p>
          )}
          {!event.demo && (
            <span className="event-price">
              {event.soldOut
                ? t("Slutsålt enligt källan")
                : event.registrationNotOpen
                  ? t("Anmälan har inte öppnat")
                  : t(event.priceLabel) || t("Se pris hos arrangören")}
            </span>
          )}
          <span role="status" className="event-share-status">
            {t(shareStatus)}
          </span>
        </div>
        <section className="event-section">
          <div className="event-section-heading">
            <h3>{t("Plats")}</h3>
            {forecast && (
              <span
                className="event-forecast"
                title={t(weatherText(forecast.symbol))}
              >
                {Math.round(forecast.temperature)}
                {t("° · vid start")}
              </span>
            )}
          </div>
          <strong className="event-venue">
            {event.venue || t("Köpenhamn")}
          </strong>
          {event.address && <p>{event.address}</p>}
          <EventMap event={event} />
          <a
            className="event-directions"
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={16} />
            {t(" Hitta hit ")}
            <ArrowUpRight size={16} />
          </a>
        </section>
        <section className="event-section">
          <h3>{t("Om eventet")}</h3>
          <p className="event-description">{event.description}</p>
          {locale !== "sv" && (
            <p className="fineprint">
              {t("Arrangörens beskrivning visas på originalspråket.")}
            </p>
          )}
          {multiDay && (
            <p className="event-schedule-note">
              {t(
                "Flerdagarsevent — kontrollera dagens öppettider hos arrangören.",
              )}
            </p>
          )}
          {event.scheduleNote && (
            <p className="event-schedule-note">{event.scheduleNote}</p>
          )}
          {!!event.agenda?.length && (
            <>
              <h3>{t("Program")}</h3>
              <ol className="event-agenda">
                {event.agenda.map((item) => (
                  <li key={`${item.time}-${item.title}`}>
                    <time>{item.time}</time>
                    <span>{item.title}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          {!!event.tags?.length && (
            <div className="event-tags">
              {event.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}
        </section>
        {!event.demo && (
          <section className="event-section event-organizer">
            {event.organizerImage ? (
              <Image
                src={event.organizerImage}
                alt=""
                width={44}
                height={44}
                unoptimized
              />
            ) : (
              <span className="event-organizer-avatar">
                {event.organizer?.[0] || "S"}
              </span>
            )}
            <div>
              <small>{t("Arrangör")}</small>
              <strong>{event.organizer}</strong>
            </div>
            {event.organizerUrl && (
              <a
                href={event.organizerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("Besök arrangören")}
              >
                <ArrowUpRight size={20} />
              </a>
            )}
          </section>
        )}
        {event.sourceUrl && (
          <footer className="event-source">
            <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t("Källa: ")}
              {event.source} <ExternalLink size={12} />
            </a>
            <p>
              {event.curated ? t("Manuellt kontrollerat") : t("Hämtat")}{" "}
              {event.checkedAt
                ? dateLabel(event.checkedAt, locale)
                : t("från arrangören")}
              . {stale && !event.curated ? t("Äldre uppgifter visas. ") : ""}
              {t("Kontrollera tider och tillgänglighet hos arrangören.")}
            </p>
          </footer>
        )}
      </div>
    </section>
  );
}
