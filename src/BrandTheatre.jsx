"use client";

import Image from "next/image";
import { illustrations } from "./illustrations.js";
import Character, { characters } from "./Character.jsx";
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
import { useLanguage } from "./Language.jsx";
import CharacterScene from "./CharacterScene.jsx";
import { formatOfferPrice, selectExampleMoment } from "./offerExperience.js";
import "./theatre.css";
import "./offer-experience.css";

const scenes = [
  {
    id: "bench-sun",
    title: "theatre.scene.bench.title",
    caption: "theatre.scene.bench.caption",
    alt: "theatre.scene.bench.alt",
  },
  {
    id: "vestegnen",
    title: "theatre.scene.vestegnen.title",
    caption: "theatre.scene.vestegnen.caption",
    alt: "theatre.scene.vestegnen.alt",
  },
  {
    id: "tiny-sun-patch",
    title: "theatre.scene.patch.title",
    caption: "theatre.scene.patch.caption",
    alt: "theatre.scene.patch.alt",
  },
  {
    id: "chasing-sun",
    title: "theatre.scene.chase.title",
    caption: "theatre.scene.chase.caption",
    alt: "theatre.scene.chase.alt",
  },
  {
    id: "golden-hour-friends",
    title: "theatre.scene.golden.title",
    caption: "theatre.scene.golden.caption",
    alt: "theatre.scene.golden.alt",
  },
];

function SceneGallery({ onExploreMap }) {
  const { language, t } = useLanguage();
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
    <div className="theatre-content" lang={language}>
      <div className="theatre-intro">
        <p className="theatre-eyebrow">{t("theatre.eyebrow")}</p>
        <h3>{t("theatre.heading")}</h3>
        <p className="theatre-illustration-label">
          {t("theatre.illustration")}
        </p>
      </div>
      <div
        className="theatre-tabs"
        role="tablist"
        aria-label={t("theatre.scenes")}
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
            {t(item.title)}
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
          alt={t(scene.alt)}
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
          <span>{t(scene.caption)}</span>
        </figcaption>
      </figure>
      <div className="theatre-navigation">
        <button
          type="button"
          aria-label={t("theatre.previous")}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={19} />
        </button>
        <span>{t(scene.title)}</span>
        <button type="button" aria-label={t("theatre.next")} onClick={() => move(1)}>
          <ArrowRight size={19} />
        </button>
      </div>
      <section
        className="theatre-cast"
        aria-label={t("theatre.gallery")}
      >
        <div className="theatre-cast-heading">
          <h3>{t("theatre.cast")}</h3>
          <span>{t("theatre.count")}</span>
        </div>
        <div className="theatre-character-grid">
          {characters.map(({ id }) => (
            <figure
              className="theatre-character-card"
              role="img"
              aria-label={t(`theatre.character.${id}`)}
              key={id}
            >
              <Character
                character={id}
                paper
                className="theatre-character-portrait"
                sizes="(max-width: 760px) calc((100vw - 88px) * 1.5), 860px"
              />
              <figcaption>{t(`theatre.character.${id}`)}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <GoldenHourExample />
      {onExploreMap && (
        <button
          className="theatre-map-link"
          type="button"
          onClick={onExploreMap}
        >
          <MapPin size={17} />
          {t("theatre.backMap")}
          <ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}

function ExampleTicket({ startedAt }) {
  const { t } = useLanguage();
  const [elapsed, setElapsed] = useState(() => performance.now() - startedAt);
  useEffect(() => {
    const timer = setInterval(
      () => setElapsed(performance.now() - startedAt),
      1000,
    );
    return () => clearInterval(timer);
  }, [startedAt]);
  const seconds = Math.max(0, Math.ceil((3600_000 - elapsed) / 1000));
  const moment = selectExampleMoment({ started: true, remaining: seconds });
  return (
    <div className="theatre-example-ticket" data-experience={moment.id}>
      <span className="theatre-demo-mark">{t("theatre.exampleTicket")}</span>
      <CharacterScene
        moment={moment}
        className="offer-experience-example-character"
        sizes="80px"
      />
      <strong role="timer" aria-label={t("theatre.remaining")}>
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:
        {String(seconds % 60).padStart(2, "0")}
      </strong>
      <span>{t(`offerExperience.${moment.id}`)}</span>
    </div>
  );
}

export function GoldenHourExample({ compact = false }) {
  const { language, t } = useLanguage();
  const [sunny, setSunny] = useState(true);
  const [startedAt, setStartedAt] = useState(null);
  const id = useId();
  const moment = selectExampleMoment({ sunny });
  return (
    <section
      className={`theatre-example ${compact ? "theatre-example-compact" : ""}`}
      data-demo="true"
      data-experience={startedAt === null ? moment.id : undefined}
      lang={language}
      aria-label={t("theatre.example")}
      aria-describedby={`${id}-source`}
    >
      <p className="theatre-demo-provenance" id={`${id}-source`}>
        {t("theatre.simulated")}
      </p>
      <p className="offer-experience-copy">{t("offerExperience.example.offer")}</p>
      <div
        className={`theatre-example-notification ${startedAt === null ? "" : "has-example-ticket"}`}
      >
        {startedAt === null && (
          <div className="theatre-example-picture">
            <CharacterScene
              moment={moment}
              className="offer-experience-example-character"
              sizes="110px"
            />
            <span
              className={`theatre-example-weather ${sunny ? "" : "is-cloudy"}`}
            >
              {sunny ? <Sun size={16} /> : <Cloud size={16} />}
              {sunny ? t("theatre.simulatedSun") : t("theatre.simulatedCloud")}
            </span>
          </div>
        )}
        <div className="theatre-example-copy">
          <span className="theatre-eyebrow">GOLDEN HOUR</span>
          <h3>Café Stefanshus</h3>
          <p className="theatre-example-deal">
            <strong>
              {t("offerExperience.example.beer", { price: formatOfferPrice(10, language) })}
            </strong>
            <span>{t("theatre.offerDuration")}</span>
          </p>
          <div
            className="theatre-weather-switch"
            role="group"
            aria-label={t("theatre.simulateWeather")}
          >
            <button
              type="button"
              aria-pressed={sunny}
              onClick={() => setSunny(true)}
            >
              <Sun size={16} />
              {t("theatre.sunny")}
            </button>
            <button
              type="button"
              aria-pressed={!sunny}
              onClick={() => setSunny(false)}
            >
              <Cloud size={16} />
              {t("theatre.cloudy")}
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
              {t("theatre.tryExample")}
              <ArrowRight size={17} />
            </button>
          ) : (
            <ExampleTicket startedAt={startedAt} />
          )}
          {!sunny && startedAt === null && (
            <p className="theatre-demo-note" role="status">
              {t("offerExperience.example.blocked")}
            </p>
          )}
          {startedAt !== null && (
            <button
              className="theatre-example-reset"
              type="button"
              onClick={() => setStartedAt(null)}
            >
              {t("theatre.reset")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function BrandTheatre({ compact = false, onExploreMap }) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const explore = onExploreMap
    ? () => {
        setOpen(false);
        onExploreMap();
      }
    : undefined;
  if (!compact)
    return (
      <section className="brand-theatre" aria-label={t("theatre.title")}>
        <SceneGallery onExploreMap={onExploreMap} />
      </section>
    );
  return (
    <div className="brand-theatre theatre-compact" lang={language}>
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
        <span>{t("theatre.launch")}</span>
        <ArrowRight size={17} />
      </button>
      {open && (
        <Modal
          title={t("theatre.title")}
          onClose={() => setOpen(false)}
          className="theatre-dialog"
        >
          <SceneGallery onExploreMap={explore} />
        </Modal>
      )}
    </div>
  );
}
