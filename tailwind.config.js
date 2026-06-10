/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#0d5c45",
          greenLight: "#2e8b71",
          orange: "#F5A623",
          lightBg: "#f0f7f4",
          darkBg: "#121e1a",
          darkCard: "#1b2e27",
          darkInput: "#233a32",
          darkBorder: "#2c473d",
          darkTextHigh: "#f2f6f4",
          darkTextMed: "#a3bdae",
          darkTextLow: "#7ba08d",
        }
      }
    },
  },
  
  plugins: [],
}