import Image from "next/image";
import { illustrations } from "./illustrations.js";
import { characterPoses } from "./characterPoses.js";
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

// Cutout row bounds include the top row's shoes; update if that sheet is replaced.
const cutoutRows = [0, 544, 1024, 1536];

export default function Character({ character, className = "", sizes = "600px", paper = false, pose }) {
  const variant = !paper && characterPoses[pose];
  if (variant) return (
    <span className={`cast-character cast-pose ${className}`} data-character={character} data-pose={pose} aria-hidden="true">
      <Image src={variant} alt="" placeholder="blur" sizes={sizes} />
    </span>
  );
  const index = characters.findIndex(({ id }) => id === character);
  const column = index % 3;
  const row = Math.floor(index / 3);
  return (
    <span
      className={`cast-character ${className}`}
      data-character={character}
      data-character-index={index}
      aria-hidden="true"
    >
      <Image
        src={illustrations[paper ? "sunspot-complete-cast" : "sunspot-cutout-cast"]}
        alt=""
        placeholder="blur"
        sizes={sizes}
        style={{
          transform: `translate(-${column * (100 / 3)}%, -${row * (100 / 3)}%)${paper ? "" : " scale(0.88)"}`,
          transformOrigin: `${((column + 0.5) * 100) / 3}% ${((row + 0.5) * 100) / 3}%`,
          clipPath: paper ? undefined : `inset(${cutoutRows[row] / 1536 * 100}% ${(2 - column) * 100 / 3}% ${(1 - cutoutRows[row + 1] / 1536) * 100}% ${column * 100 / 3}%)`,
        }}
      />
    </span>
  );
}
