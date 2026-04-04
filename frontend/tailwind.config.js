/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        script: ['"Alex Brush"', 'cursive'],
      },
      colors: {
        app: {
          bg:      "#0B132B",  // Midnight Blue — page background
          surface: "#1C2541",  // Stormy Blue-Gray — cards, panels
          raised:  "#243256",  // slightly raised elements, inputs
          border:  "#2d3a5a",  // default border
          border2: "#3d4a6a",  // stronger border
        },
        coven: {
          ember:    "#FF6A2A",  // primary button/accent
          flame:    "#FFB347",  // hover state
          candle:   "#FFD8A8",  // soft accent
          amber:    "#CC5500",  // burnt amber — input text
          gold:     "#E6C79C",  // headings, logo
          spelgold: "#F4E3B2",  // subtle text glow
          lavender: "#A78BFA",  // links, secondary accent, genre dropdown
          amethyst: "#6D4AFF",  // active / selected
          dragon:   "#3A86B5",  // cool blue accent
          silver:   "#C9D6DF",  // light secondary text
          mystic:   "#fa6bff",  // bright pink-purple — coven title accent
        },
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.8)" },
          "50%":      { opacity: "1",   transform: "scale(1.2)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-6px)" },
        },
      },
      animation: {
        twinkle:        "twinkle 2s ease-in-out infinite",
        "twinkle-slow": "twinkle 3.5s ease-in-out infinite",
        "twinkle-fast": "twinkle 1.2s ease-in-out infinite",
        float:          "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
