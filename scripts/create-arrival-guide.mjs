import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const output = resolve("public/assets/beks-battalion-arrival-guide.pdf");
const commands = [];

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function fill(color) {
  commands.push(`${color.join(" ")} rg`);
}

function stroke(color) {
  commands.push(`${color.join(" ")} RG`);
}

function rectangle(x, y, width, height, color) {
  fill(color);
  commands.push(`${x} ${y} ${width} ${height} re f`);
}

function outlinedRectangle(x, y, width, height, color) {
  stroke(color);
  commands.push(`${x} ${y} ${width} ${height} re S`);
}

function text(value, x, y, size, font = "F1", color = [1, 1, 1]) {
  fill(color);
  commands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
}

function wrappedText(value, x, y, width, size, font = "F1", color = [1, 1, 1], leading = size + 5) {
  const estimatedCharacterWidth = size * (font === "F2" ? 0.56 : 0.5);
  const charactersPerLine = Math.max(18, Math.floor(width / estimatedCharacterWidth));
  const words = value.split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const candidate = `${line} ${word}`.trim();
    if (candidate.length > charactersPerLine && line) {
      text(line, x, currentY, size, font, color);
      currentY -= leading;
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) {
    text(line, x, currentY, size, font, color);
  }
}

rectangle(0, 0, 612, 792, [0.027, 0.024, 0.02]);
rectangle(408, 585, 204, 207, [0.95, 0.47, 0.08]);
rectangle(0, 0, 182, 132, [0.62, 0.16, 0.06]);
text("JOY STAGE PRODUCTIONS | GUEST ARRIVAL GUIDE", 54, 722, 10, "F2", [1, 0.81, 0.35]);
text("BEKS BATTALION", 54, 666, 35, "F2");
text("LIVE IN SAN DIEGO", 54, 636, 19, "F2", [1, 0.81, 0.35]);
text("Sunday, September 13, 2026 | 4:00 PM - 7:30 PM", 54, 608, 12, "F1", [0.97, 0.94, 0.9]);

rectangle(54, 495, 504, 88, [0.09, 0.07, 0.05]);
outlinedRectangle(54, 495, 504, 88, [0.66, 0.47, 0.15]);
text("MAP DESTINATION", 76, 558, 9, "F2", [1, 0.81, 0.35]);
text("Otay Ranch High School", 76, 532, 17, "F2");
text("1250 Olympic Parkway, Chula Vista, CA 91913", 76, 511, 12, "F1", [0.97, 0.94, 0.9]);

text("ARRIVING BY CAR", 54, 456, 11, "F2", [1, 0.81, 0.35]);
for (const [x, title, body, accent] of [
  [54, "FROM SR-125", "Exit onto Olympic Parkway, then make a LEFT into the Otay Ranch High School parking area.", [1, 0.81, 0.35]],
  [320, "FROM I-805", "Exit onto Olympic Parkway, then make a RIGHT into the Otay Ranch High School parking area.", [1, 0.61, 0.3]],
]) {
  rectangle(x, 294, 238, 136, [0.09, 0.07, 0.05]);
  outlinedRectangle(x, 294, 238, 136, [0.43, 0.32, 0.14]);
  rectangle(x + 18, 392, 92, 21, accent);
  text(title, x + 29, 399, 8, "F2", [0.09, 0.06, 0.03]);
  wrappedText(body, x + 18, 365, 202, 12, "F2", [0.97, 0.94, 0.9], 17);
}

rectangle(54, 202, 504, 72, [0.09, 0.07, 0.05]);
outlinedRectangle(54, 202, 504, 72, [0.43, 0.32, 0.14]);
text("USE LIVE NAVIGATION", 76, 246, 10, "F2", [1, 0.81, 0.35]);
text("Open your ticket email or visit joystageproductions.com/directions for Google Maps and Apple Maps.", 76, 224, 11, "F1", [0.97, 0.94, 0.9]);
text("Please allow extra time for parking and walking to the theater.", 143, 102, 9, "F1", [0.84, 0.8, 0.72]);
text("Joy Stage Productions | joystageproductions.com", 172, 84, 9, "F1", [0.84, 0.8, 0.72]);

const stream = commands.join("\n");
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (let index = 0; index < objects.length; index += 1) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
}
const xrefOffset = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f\n`;
for (const offset of offsets.slice(1)) {
  pdf += `${String(offset).padStart(10, "0")} 00000 n\n`;
}
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, pdf, "binary");
