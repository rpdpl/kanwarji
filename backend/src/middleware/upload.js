const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

const tempUploadDir = path.join(os.tmpdir(), "uploads", "products");
const uploadDir =
  process.env.NODE_ENV === "production" || process.env.RENDER
    ? tempUploadDir
    : "uploads/products";
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    console.error("Failed to create upload directory:", uploadDir, e);
  }
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileName =
      "product-" + uniqueSuffix + path.extname(file.originalname);
    cb(null, fileName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image or video files are allowed!"), false);
    }
  },
});

module.exports = { upload, uploadDir };
