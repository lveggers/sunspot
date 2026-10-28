import { Cloud, CloudRain, Moon, Sun } from "lucide-react";
import Character from "./Character.jsx";
import "./character-experience.css";

const weatherProps = { cloud: Cloud, rain: CloudRain, moon: Moon, sun: Sun };

export default function CharacterScene({ moment, className = "", sizes = "180px" }) {
  if (!moment?.character) return null;
  const Prop = weatherProps[moment.weather];
  return (
    <span className={`character-scene ${moment.weather ? `scene-${moment.weather}` : ""} ${className}`} data-moment={moment.id} aria-hidden="true">
      {Prop && <Prop className="character-weather-prop" strokeWidth={1.4} />}
      <Character character={moment.character} pose={moment.pose} sizes={sizes} />
    </span>
  );
}
