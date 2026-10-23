console.log("!!! SERVER STARTUP DEBUG MARKET !!!");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const env = require("./config/env");
require("../services/email");
require("../services/instamojo");

const app = express();

const invoicesDir = path.join(__dirname, "..", "invoices");
if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Authorization"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/placeholder.svg", (req, res) => {
  const isThumb = req.query.thumb === "1" || req.query.thumb === "true";
  const size = isThumb ? 64 : 256;
  const bg = "#e5e7eb";
  const fg = "#9ca3af";
  const text = isThumb ? "" : "No Image";
  const fontSize = Math.floor(size * 0.16);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <g fill="none" stroke="${fg}" stroke-width="2">
    <rect x="${size * 0.15}" y="${size * 0.2}" width="${size * 0.7}" height="${size * 0.6}" rx="${size * 0.04}"/>
    <circle cx="${size * 0.4}" cy="${size * 0.42}" r="${size * 0.08}"/>
    <path d="M ${size * 0.3} ${size * 0.6} L ${size * 0.45} ${size * 0.48} L ${size * 0.6} ${size * 0.62} L ${size * 0.7} ${size * 0.54}" />
  </g>
  ${
    text
      ? `<text x="50%" y="85%" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="${fontSize}" fill="${fg}">${text}</text>`
      : ""
  }
</svg>`;
  res.set("Cache-Control", "public, max-age=86400, immutable");
  res.type("image/svg+xml").send(svg);
});

mongoose
  .connect(env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Mongo connected"))
  .catch((err) => console.log("Error:", err));

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected successfully");
});

require("./models");
app.use("/uploads", express.static("uploads"));
require("./routes")(app);

module.exports = app;
