"use client";

import { useLayoutEffect, useRef } from "react";
import { Cloud, CloudRain, Moon, Sun } from "lucide-react";
import Character from "./Character.jsx";
import { openingMotion } from "./openingMotion.js";
import "./opening-theatre.css";

const weatherProps = { cloud: Cloud, rain: CloudRain, moon: Moon, sun: Sun };
const stringEnds = {
  "beer-seated": [[43, 47], [69, 49], [31, 56], [83, 73]],
  "cocktail-seated": [[40, 45], [66, 45], [25, 57], [78, 70]],
  "cloud-angry": [[40, 44], [62, 45], [45, 62], [67, 58]],
};

function Strings({ ends, weather = false }) {
  return (
    <svg className="opening-strings" viewBox={weather ? "0 0 100 100" : "0 0 100 150"} aria-hidden="true">
      {ends.map(([x, y], index) => <line key={index} x1={x} y1="-250" x2={x} y2={y} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

export default function OpeningTheatre({ scene, animate = true }) {
  const stageRef = useRef(null);
  const previousRef = useRef(null);
  const runRef = useRef(null);
  const { id, character, pose, weather } = scene || {};

  useLayoutEffect(() => {
    const stage = stageRef.current;
    let disposed = false;
    const dependencies = [animate, id, character, pose, weather];
    const previousRun = runRef.current;
    const sameRun = previousRun && dependencies.every((value, index) => Object.is(value, previousRun.dependencies[index]));
    if (!sameRun) previousRun?.animations.forEach((animation) => animation.cancel());
    const run = sameRun ? previousRun : { dependencies, animations: [], cleanupPending: false };
    run.cleanupPending = false;
    runRef.current = run;
    const cancel = () => run.animations.forEach((animation) => animation.cancel());
    const covered = () => {
      const dialog = document.querySelector("dialog[open]");
      return dialog && !dialog.contains(stage);
    };
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => { if (preference.matches) cancel(); };
    const onVisibility = () => { if (document.hidden) cancel(); };
    const onModal = () => { if (covered()) cancel(); };
    const observer = animate && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) cancel(); })
      : null;
    observer?.observe(stage);
    if (animate) {
      preference.addEventListener("change", onPreference);
      document.addEventListener("visibilitychange", onVisibility);
      document.addEventListener("sunspot:modalchange", onModal);
    }

    queueMicrotask(() => {
      if (disposed) return;
      const previous = previousRef.current;
      const changed = !previous || previous.id !== id || previous.character !== character || previous.pose !== pose || previous.weather !== weather;
      // Pending data hides the scene without resetting its last entrance identity.
      if (character) previousRef.current = { id, character, pose, weather };
      if (!animate || !character || !changed || preference.matches || document.hidden || covered()) return;
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth || (stage.checkVisibility && !stage.checkVisibility({ visibilityProperty: true }))) return;
      for (const [selector, prop] of [[".opening-puppet", false], [".opening-weather-prop", true]]) {
        const target = stage.querySelector(selector);
        if (!target?.animate) continue;
        const motion = openingMotion(prop);
        run.animations.push(target.animate(motion.keyframes, motion.options));
      }
    });

    return () => {
      disposed = true;
      // Reuse native handles across React's development cleanup/setup probe.
      run.cleanupPending = true;
      queueMicrotask(() => { if (run.cleanupPending) cancel(); });
      observer?.disconnect();
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("sunspot:modalchange", onModal);
    };
  }, [animate, id, character, pose, weather]);

  const Prop = weatherProps[weather];
  return (
    <div ref={stageRef} className={`opening-theatre ${weather ? `opening-${weather}` : ""}`} data-scene={id} aria-hidden="true">
      {character && <>
        {Prop && <span className="opening-weather-prop">
          <Strings weather ends={[[31, 30], [69, 30]]} />
          <Prop className="opening-weather-icon" strokeWidth={1.4} />
        </span>}
        <span className="opening-puppet">
          <Strings ends={stringEnds[pose] || [[35, 48], [65, 48], [26, 85], [74, 85]]} />
          <Character character={character} pose={pose} sizes={pose ? "120px" : "360px"} />
        </span>
      </>}
    </div>
  );
}
