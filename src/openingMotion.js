// The whole paper cutout moves; its atlas crop and painted limbs stay intact.
export function openingMotion(prop = false) {
  return {
    keyframes: [
      { transform: `translateY(${prop ? -160 : -210}px) rotate(${prop ? 4 : -3}deg)`, offset: 0, easing: "cubic-bezier(0.42, 0, 0.8, 1)" },
      { transform: `translateY(${prop ? 3 : 5}px) rotate(${prop ? -1.5 : 1.2}deg)`, offset: 0.68, easing: "ease-out" },
      { transform: `translateY(-2px) rotate(${prop ? 0.7 : -0.6}deg)`, offset: 0.84, easing: "ease-in-out" },
      { transform: "translateY(0) rotate(0deg)", offset: 1 },
    ],
    options: { duration: prop ? 720 : 780, delay: prop ? 90 : 0, fill: "backwards" },
  };
}
