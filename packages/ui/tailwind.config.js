/** @type {import('tailwindcss').Config} */
module.exports = {
  // Content paths cover this package's components AND the mobile app that consumes them.
  // The mobile app's own tailwind.config.js extends this preset, so Metro only needs
  // to scan its own source; we list the UI package's source here for completeness.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "../../apps/mobile/app/**/*.{js,jsx,ts,tsx}",
    "../../apps/mobile/components/**/*.{js,jsx,ts,tsx}",
  ],
  // NativeWind v4 preset — adds RN-compatible CSS-in-JS support on top of Tailwind v3.
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
