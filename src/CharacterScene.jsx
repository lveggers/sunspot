"use client";

import { useLayoutEffect, useRef } from "react";
import { Cloud, CloudRain, Moon, Sun } from "lucide-react";
import Character from "./Character.jsx";
import { characterMotion } from "./characterMotion.js";
import "./character-experience.css";

const weatherProps = { cloud: Cloud, rain: CloudRain, moon: Moon, sun: Sun };

export default function CharacterScene({ moment, className = "", sizes = "180px", animate = false, confirmation, companion }) {
  const sceneRef = useRef(null);
  const previousRef = useRef(null);
  const runRef = useRef(null);
  const { id, character, pose, weather } = moment || {};

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    let disposed = false;
    const dependencies = [animate, id, character, pose, weather, confirmation];
    const previousRun = runRef.current;
    const sameRun = previousRun && dependencies.every((value, index) => Object.is(value, previousRun.dependencies[index]));
    if (!sameRun) previousRun?.animation?.cancel();
    const run = sameRun ? previousRun : { dependencies, animation: null, cleanupPending: false };
    run.cleanupPending = false;
    runRef.current = run;
    const cancel = () => run.animation?.cancel();
    const obscuredByModal = () => {
      const dialog = document.querySelector("dialog[open]");
      return dialog && !dialog.contains(scene);
    };
    const onModalChange = () => { if (obscuredByModal()) cancel(); };
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => { if (motionPreference.matches) cancel(); };
    const onVisibility = () => { if (document.hidden) cancel(); };
    const observer = animate && scene && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) cancel(); })
      : null;
    observer?.observe(scene);
    if (animate) {
      motionPreference.addEventListener("change", onPreference);
      document.addEventListener("visibilitychange", onVisibility);
      document.addEventListener("sunspot:modalchange", onModalChange);
    }

    // Coalesce synchronous renders before consuming the event.
    queueMicrotask(() => {
      if (disposed) return;
      const previous = previousRef.current;
      const changed = !previous || previous.id !== id || previous.character !== character || previous.pose !== pose || previous.weather !== weather;
      const confirmed = confirmation != null && confirmation !== previous?.confirmation;
      previousRef.current = { id, character, pose, weather, confirmation };
      if (!animate || !scene || !character || (!changed && !confirmed) || motionPreference.matches || document.hidden || obscuredByModal()) return;
      const rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= window.innerHeight || rect.left >= window.innerWidth || (scene.checkVisibility && !scene.checkVisibility({ visibilityProperty: true }))) return;
      const motion = characterMotion({ id, weather, initial: !previous, confirmed });
      const target = scene.querySelector(motion?.target === "weather" ? ".character-weather-prop" : ".character-motion-group");
      if (motion && target?.animate) run.animation = target.animate(motion.keyframes, motion.options);
    });

    return () => {
      disposed = true;
      // React's development cleanup/setup probe reuses the running handle.
      // A real unmount cancels before the next frame; changed inputs cancel above.
      run.cleanupPending = true;
      queueMicrotask(() => { if (run.cleanupPending) cancel(); });
      observer?.disconnect();
      motionPreference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("sunspot:modalchange", onModalChange);
    };
  }, [animate, id, character, pose, weather, confirmation]);

  if (!character) return null;
  const Prop = weatherProps[weather];
  return (
    <span ref={sceneRef} className={`character-scene ${weather ? `scene-${weather}` : ""} ${companion ? "scene-companions" : ""} ${className}`} data-moment={id} aria-hidden="true">
      {Prop && <Prop className="character-weather-prop" strokeWidth={1.4} />}
      <span className="character-motion-group">
        <Character character={character} pose={pose} sizes={sizes} />
        {companion && <Character character={companion} sizes={sizes} />}
      </span>
    </span>
  );
}
