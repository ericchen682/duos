// Generates simple black-outline line-art PNGs (white background) plus a
// manifest so the app is testable before the user adds their own art.
// Run with: node scripts/generate-pages.mjs
import { PNG } from "pngjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "coloring-pages");

const WIDTH = 1000;
const HEIGHT = 750;
const LINE = 22; // ~ (0,0,0) black; used as fill barrier by the app

function createCanvas() {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  // White, fully opaque background.
  png.data.fill(255);
  return png;
}

function setPx(png, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const idx = (WIDTH * y + x) << 2;
  png.data[idx] = 0;
  png.data[idx + 1] = 0;
  png.data[idx + 2] = 0;
  png.data[idx + 3] = 255;
}

function stamp(png, x, y, r) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) setPx(png, x + dx, y + dy);
    }
  }
}

function line(png, x0, y0, x1, y1, thickness = 3) {
  const r = Math.max(0, Math.floor(thickness / 2));
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    stamp(png, x0, y0, r);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function polyline(png, pts, thickness = 3, close = false) {
  for (let i = 0; i < pts.length - 1; i++) {
    line(png, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], thickness);
  }
  if (close && pts.length > 1) {
    const a = pts[pts.length - 1];
    const b = pts[0];
    line(png, a[0], a[1], b[0], b[1], thickness);
  }
}

function ellipse(png, cx, cy, rx, ry, thickness = 3, start = 0, end = Math.PI * 2) {
  const steps = Math.max(64, Math.floor((rx + ry) * 1.5));
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const t = start + ((end - start) * i) / steps;
    const x = cx + Math.cos(t) * rx;
    const y = cy + Math.sin(t) * ry;
    if (prev) line(png, prev[0], prev[1], x, y, thickness);
    prev = [x, y];
  }
}

function circle(png, cx, cy, r, thickness = 3) {
  ellipse(png, cx, cy, r, r, thickness);
}

function save(png, name) {
  const buf = PNG.sync.write(png);
  writeFileSync(join(OUT_DIR, name), buf);
}

// --- Page 1: Cozy House -----------------------------------------------------
function house() {
  const png = createCanvas();
  const t = 4;
  line(png, 60, 620, 940, 620, t); // ground
  polyline(png, [[250, 620], [250, 380], [650, 380], [650, 620]], t); // walls
  polyline(png, [[210, 380], [450, 220], [690, 380]], t); // roof
  polyline(png, [[560, 300], [560, 220], [610, 220], [610, 335]], t); // chimney
  // door
  polyline(png, [[400, 620], [400, 470], [500, 470], [500, 620]], t);
  circle(png, 485, 545, 8, 3);
  // windows
  polyline(png, [[300, 430], [370, 430], [370, 500], [300, 500]], t, true);
  line(png, 335, 430, 335, 500, t);
  line(png, 300, 465, 370, 465, t);
  polyline(png, [[530, 430], [600, 430], [600, 500], [530, 500]], t, true);
  line(png, 565, 430, 565, 500, t);
  line(png, 530, 465, 600, 465, t);
  // sun
  circle(png, 830, 160, 60, t);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    line(
      png,
      830 + Math.cos(a) * 75,
      160 + Math.sin(a) * 75,
      830 + Math.cos(a) * 100,
      160 + Math.sin(a) * 100,
      3
    );
  }
  // clouds
  ellipse(png, 200, 180, 55, 30, t);
  ellipse(png, 260, 180, 45, 25, t);
  save(png, "house.png");
}

// --- Page 2: Flower ---------------------------------------------------------
function flower() {
  const png = createCanvas();
  const t = 4;
  const cx = 500;
  const cy = 300;
  circle(png, cx, cy, 70, t); // center
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ellipse(png, cx + Math.cos(a) * 135, cy + Math.sin(a) * 135, 70, 45, t, 0, Math.PI * 2);
  }
  // stem
  line(png, cx, cy + 205, cx, 660, 5);
  // leaves
  ellipse(png, cx - 90, 500, 90, 40, t);
  ellipse(png, cx + 95, 560, 95, 42, t);
  // pot
  polyline(png, [[410, 660], [590, 660], [560, 720], [440, 720]], t, true);
  line(png, 400, 660, 600, 660, t);
  save(png, "flower.png");
}

// --- Page 3: Fish -----------------------------------------------------------
function fish() {
  const png = createCanvas();
  const t = 4;
  const cx = 470;
  const cy = 380;
  ellipse(png, cx, cy, 230, 150, t); // body
  polyline(png, [[cx + 210, cy], [cx + 360, cy - 130], [cx + 360, cy + 130]], t, true); // tail
  ellipse(png, cx - 120, cy - 60, 30, 30, t); // eye
  stamp(png, cx - 120, cy - 60, 8); // pupil
  ellipse(png, cx + 20, cy - 150, 90, 55, t, Math.PI, Math.PI * 2); // top fin
  ellipse(png, cx + 20, cy + 150, 90, 55, t, 0, Math.PI); // bottom fin
  // gill
  ellipse(png, cx - 70, cy, 60, 90, t, -Math.PI / 2.2, Math.PI / 2.2);
  // scales-ish arcs
  for (let i = 0; i < 3; i++) {
    ellipse(png, cx + 40 + i * 70, cy, 40, 90, t, Math.PI / 2, (3 * Math.PI) / 2);
  }
  // bubbles
  circle(png, cx - 260, cy - 120, 22, 3);
  circle(png, cx - 300, cy - 190, 15, 3);
  circle(png, cx - 320, cy - 250, 10, 3);
  // water lines
  for (let i = 0; i < 3; i++) {
    const y = 660 + i * 22;
    polyline(
      png,
      [
        [80, y],
        [240, y - 18],
        [400, y],
        [560, y - 18],
        [720, y],
        [880, y - 18],
      ],
      3
    );
  }
  save(png, "fish.png");
}

mkdirSync(OUT_DIR, { recursive: true });
house();
flower();
fish();

const manifest = {
  pages: [
    { id: "house", title: "Cozy House", src: "/coloring-pages/house.png", width: WIDTH, height: HEIGHT },
    { id: "flower", title: "Flower", src: "/coloring-pages/flower.png", width: WIDTH, height: HEIGHT },
    { id: "fish", title: "Happy Fish", src: "/coloring-pages/fish.png", width: WIDTH, height: HEIGHT },
  ],
};
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`Generated ${manifest.pages.length} pages + manifest in ${OUT_DIR}`);
void LINE;
