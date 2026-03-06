/** @type {import('tailwindcss').Config} */
module.exports = {
  // Extend the shared config from packages/ui which includes the NativeWind preset
  // and the project-wide design tokens.
  presets: [require("../../packages/ui/tailwind.config")],
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    // Include UI package native components so their class names are in the build.
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}",
  ],
};
