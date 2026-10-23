const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "server.js");
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const starts = [];
for (let i = 0; i < lines.length; i++) {
  const chunk = lines.slice(i, i + 6).join(" ");
  const m = chunk.match(
    /app\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/
  );
  if (m && lines[i].includes("app." + m[1])) {
    starts.push({ line: i + 1, method: m[1], path: m[2] });
  }
}
starts.forEach((s) =>
  console.log(String(s.line).padStart(4) + " " + s.method.padEnd(6) + " " + s.path)
);
console.log("TOTAL", starts.length);
