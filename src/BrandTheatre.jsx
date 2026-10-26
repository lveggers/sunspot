"use client";

import Image from "next/image";
import { illustrations } from "./illustrations.js";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Cloud,
  MapPin,
  Sun,
  Ticket,
} from "lucide-react";
import Modal from "./Modal.jsx";
import "./theatre.css";

const scenes = [
  {
    id: "bench-sun",
    title: "Bænken i solen",
    caption: "En bænk. En øl. Ingen hast.",
    alt: "En skæv papfigur drikker øl på en københavnsk parkbænk under en sol i synlige snore.",
  },
  {
    id: "vestegnen",
    title: "Vestegnen på tur",
    caption: "Hele holdet er ude.",
    alt: "En gruppe udtryksfulde voksne papfigurer i moderne streetwear nyder øl udenfor i København.",
  },
  {
    id: "tiny-sun-patch",
    title: "Den sidste solplet",
    caption: "Der er altid plads til én mere.",
    alt: "Flere voksne klemmer sig komisk ind i en lille trekant af sol på fortovet foran en bar.",
  },
  {
    id: "chasing-sun",
    title: "Efter solen",
    caption: "Lidt længere henne ad gaden.",
    alt: "Langlemmede papfigurer følger en ophængt sol mellem københavnske bygninger og skygger.",
  },
  {
    id: "golden-hour-friends",
    title: "Golden Hour",
    caption: "Et sted at mødes.",
    alt: "Venner samles med øl foran en københavnsk bar i gyldent lys, bygget som et lille papdukketeater.",
  },
];

function SceneGallery({ onExploreMap }) {
  const [active, setActive] = useState(0);
  const tabs = useRef([]);
  const touchStart = useRef(null);
  const id = useId();
  const scene = scenes[active];
  function move(step) {
    setActive((current) => (current + step + scenes.length) % scenes.length);
  }
  function tabKey(event) {
    const next = {
      ArrowRight: (active + 1) % scenes.length,
      ArrowLeft: (active + scenes.length - 1) % scenes.length,
      Home: 0,
      End: scenes.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }
  return (
    <div className="theatre-content" lang="da">
      <div className="theatre-intro">
        <p className="theatre-eyebrow">ET LILLE STYKKE KØBENHAVN</p>
        <h3>Ud i det gode selskab.</h3>
        <p className="theatre-illustration-label">
          Illustrationer · ikke sol- eller vejrdata
        </p>
      </div>
      <div
        className="theatre-tabs"
        role="tablist"
        aria-label="Scener fra København"
        onKeyDown={tabKey}
      >
        {scenes.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={active === index}
            aria-controls={`${id}-stage`}
            tabIndex={active === index ? 0 : -1}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            onClick={() => setActive(index)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <figure
        className="theatre-stage"
        data-scene={scene.id}
        id={`${id}-stage`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${active}`}
        tabIndex={0}
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX;
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const distance = event.changedTouches[0].clientX - touchStart.current;
          touchStart.current = null;
          if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
        }}
      >
        <span
          className="theatre-string theatre-string-left"
          aria-hidden="true"
        />
        <span
          className="theatre-string theatre-string-right"
          aria-hidden="true"
        />
        <Image
          key={scene.id}
          src={illustrations[scene.id]}
          alt={scene.alt}
          placeholder="blur"
          width={1536}
          height={1024}
          sizes="(max-width: 760px) calc(100vw - 52px), 880px"
          loading={active === 0 ? "eager" : "lazy"}
          className="theatre-scene-image"
        />
        <figcaption>
          <span className="theatre-scene-number">
            {String(active + 1).padStart(2, "0")} / 05
          </span>
          <span>{scene.caption}</span>
        </figcaption>
      </figure>
      <div className="theatre-navigation">
        <button
          type="button"
          aria-label="Forrige scene"
          onClick={() => move(-1)}
        >
          <ArrowLeft size={19} />
        </button>
        <span>{scene.title}</span>
        <button type="button" aria-label="Næste scene" onClick={() => move(1)}>
          <ArrowRight size={19} />
        </button>
      </div>
      <section className="theatre-cast" aria-label="SunSpot-figurerne">
        <div className="theatre-cast-heading">
          <h3>Byens soljægere.</h3>
          <span>Originale figurer · København 2026</span>
        </div>
        <Image
          src={illustrations["sunspot-cast"]}
          alt="SunSpots originale voksne papfigurer med skæve proportioner, udtryksfulde ansigter, tekniske jakker, brede jeans og cykelvenlige sko."
          placeholder="blur"
          width={1536}
          height={1024}
          sizes="(max-width: 760px) calc(100vw - 52px), 880px"
          loading="lazy"
        />
      </section>
      <GoldenHourExample />
      {onExploreMap && (
        <button
          className="theatre-map-link"
          type="button"
          onClick={onExploreMap}
        >
          <MapPin size={17} />
          Tilbage til kortet
          <ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}

function ExampleTicket({ startedAt }) {
  const [elapsed, setElapsed] = useState(() => performance.now() - startedAt);
  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(performance.now() - startedAt),
      1000,
    );
    return () => clearInterval(timer);
  }, [startedAt]);
  const seconds = Math.max(0, Math.ceil((3600_000 - elapsed) / 1000));
  return (
    <div className="theatre-example-ticket">
      <span className="theatre-demo-mark">EKSEMPELKUPON · IKKE GYLDIG</span>
      <strong role="timer" aria-label="Tid tilbage på eksempelkuponen">
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </strong>
      <span>
        {seconds
          ? "Simuleret nedtælling. Kan ikke indløses."
          : "Eksemplet er udløbet."}
      </span>
    </div>
  );
}

export function GoldenHourExample({ compact = false }) {
  const [sunny, setSunny] = useState(true);
  const [startedAt, setStartedAt] = useState(null);
  const id = useId();
  return (
    <section
      className={`theatre-example ${compact ? "theatre-example-compact" : ""}`}
      data-demo="true"
      lang="da"
      aria-label="Golden Hour-eksempel"
      aria-describedby={`${id}-source`}
    >
      <p className="theatre-demo-provenance" id={`${id}-source`}>
        EKSEMPEL · simuleret sol, vejr og tilbud
      </p>
      <div className="theatre-example-notification">
        <div className="theatre-example-picture">
          <Image
            src={illustrations["golden-hour-friends"]}
            placeholder="blur"
            width={1536}
            height={1024}
            sizes="(max-width: 760px) 100vw, 350px"
            loading="lazy"
            alt="Illustreret eksempel: venner mødes foran en bar i et dukketeater af pap."
          />
          <span
            className={`theatre-example-weather ${sunny ? "" : "is-cloudy"}`}
          >
            {sunny ? <Sun size={16} /> : <Cloud size={16} />}
            {sunny ? "Simuleret sol nu" : "Simuleret overskyet"}
          </span>
        </div>
        <div className="theatre-example-copy">
          <span className="theatre-eyebrow">GOLDEN HOUR</span>
          <h3>Café Stefanshus</h3>
          <p className="theatre-example-deal">
            <strong>Øl til 10 kr.</strong>
            <span>Tilbud i 60 minutter</span>
          </p>
          <div
            className="theatre-weather-switch"
            role="group"
            aria-label="Simuler eksempellets vejr"
          >
            <button
              type="button"
              aria-pressed={sunny}
              onClick={() => setSunny(true)}
            >
              <Sun size={16} />
              Solskin
            </button>
            <button
              type="button"
              aria-pressed={!sunny}
              onClick={() => setSunny(false)}
            >
              <Cloud size={16} />
              Overskyet
            </button>
          </div>
          {startedAt === null ? (
            <button
              className="theatre-example-action"
              type="button"
              disabled={!sunny}
              onClick={() => setStartedAt(performance.now())}
            >
              <Ticket size={17} />
              Prøv eksempelkuponen
              <ArrowRight size={17} />
            </button>
          ) : (
            <ExampleTicket startedAt={startedAt} />
          )}
          {!sunny && startedAt === null && (
            <p className="theatre-demo-note" role="status">
              Eksemplet kan kun startes i simuleret solskin.
            </p>
          )}
          {startedAt !== null && (
            <button
              className="theatre-example-reset"
              type="button"
              onClick={() => setStartedAt(null)}
            >
              Nulstil eksempel
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function BrandTheatre({ compact = false, onExploreMap }) {
  const [open, setOpen] = useState(false);
  const explore = onExploreMap
    ? () => {
        setOpen(false);
        onExploreMap();
      }
    : undefined;
  if (!compact)
    return (
      <section className="brand-theatre" aria-label="SunSpot dukketeater">
        <SceneGallery onExploreMap={onExploreMap} />
      </section>
    );
  return (
    <div className="brand-theatre theatre-compact" lang="da">
      <button
        className="theatre-launch"
        type="button"
        onClick={() => setOpen(true)}
      >
        <Image
          src={illustrations["sunspot-cast"]}
          placeholder="blur"
          width={1536}
          height={1024}
          sizes="96px"
          loading="lazy"
          alt=""
        />
        <span>Mød SunSpot-figurerne</span>
        <ArrowRight size={17} />
      </button>
      {open && (
        <Modal
          title="SunSpot dukketeater"
          onClose={() => setOpen(false)}
          className="theatre-dialog"
        >
          <SceneGallery onExploreMap={explore} />
        </Modal>
      )}
    </div>
  );
}
