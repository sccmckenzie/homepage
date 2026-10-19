// Runs ocotillo.js against a recording canvas and writes the finished frame as SVG.
// Usage: node ocotillo-export.js > ocotillo.svg
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || require("path").join(__dirname, "ocotillo.js"), "utf8");
let d = "", out = [];
const f = v => (+v.toFixed(2)).toString();
const ctx = {
  setTransform() {}, clearRect() { out = []; }, beginPath() { d = ""; },
  moveTo(x, y) { d += `M${f(x)},${f(y)}`; },
  lineTo(x, y) { d += `L${f(x)},${f(y)}`; },
  arc(x, y, r) { d += `M${f(x - r)},${f(y)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0`; },
  closePath() { d += "Z"; },
  fill() { out.push({ d, fill: true }); },
  stroke() { out.push({ d, w: this.lineWidth }); },
};
const canvas = { style: {}, clientWidth: 200, width: 0, height: 0, setAttribute() {}, getContext: () => ctx };
global.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: true }) };  // reduced motion: draw finished plant
global.document = {
  querySelector: () => ({ className: "logo", getAttribute: () => "Ocotillo", replaceWith() {} }),
  createElement: () => canvas,
};
global.getComputedStyle = () => ({ color: "#000" });
global.ResizeObserver = class { observe() {} };
eval(src);
const lines = out.map(p => p.fill
  ? `  <path d="${p.d}" fill="#000"/>`
  : `  <path d="${p.d}" fill="none" stroke="#000" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"/>`);
process.stdout.write(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 200 200">\n  <title>Ocotillo</title>\n${lines.join("\n")}\n</svg>\n`);
