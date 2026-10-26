import Image from "next/image";
import { illustrations } from "./illustrations.js";
import "./characters.css";

export const characters = [
  { id: "cyclist", name: "Cyklisten" },
  { id: "puffer", name: "Den røde puffer" },
  { id: "stripes", name: "Striberne" },
  { id: "football", name: "Fodboldtrøjen" },
  { id: "green-jacket", name: "Den grønne jakke" },
  { id: "blue-coat", name: "Den blå frakke" },
  { id: "blue-shirt", name: "Den blå skjorte" },
  { id: "curls", name: "De jordbærblonde krøller" },
  { id: "turtleneck", name: "Den sorte rullekrave" },
];

export const categoryCharacters = {
  park: "blue-coat",
  bar: "football",
  restaurant: "stripes",
};

export default function Character({ character, className = "", sizes = "600px" }) {
  const index = characters.findIndex(({ id }) => id === character);
  return (
    <span
      className={`cast-character ${className}`}
      data-character={character}
      data-character-index={index}
      aria-hidden="true"
    >
      <Image
        src={illustrations["sunspot-complete-cast"]}
        alt=""
        placeholder="blur"
        sizes={sizes}
        style={{
          transform: `translate(-${(index % 3) * (100 / 3)}%, -${Math.floor(index / 3) * (100 / 3)}%)`,
        }}
      />
    </span>
  );
}
