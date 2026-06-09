// Renders assets/icon-src/icon.svg -> assets/icon.png (128x128).
// Dev-only: requires the @resvg/resvg-js devDependency. Run: node assets/icon-src/render.js
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const svg = fs.readFileSync(path.join(__dirname, "icon.svg"), "utf8");
const png = new Resvg(svg, { fitTo: { mode: "width", value: 128 } })
  .render()
  .asPng();
fs.writeFileSync(path.join(__dirname, "..", "icon.png"), png);
console.log("wrote assets/icon.png (128x128)");
