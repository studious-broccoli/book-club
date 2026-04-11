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
          bg:      "#0F1226",  // Deep indigo-black — page background
          surface: "#1F223A",  // Dark indigo — cards, panels
          raised:  "#2A2F4A",  // slightly raised elements, inputs
          border:  "#343A5A",  // default border
          border2: "#434A6B",  // stronger border
        },
        coven: {
          ember:    "#D96B3B",  // earthy ember — rare emphasis only
          flame:    "#F4A261",  // warm golden-orange hover
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
