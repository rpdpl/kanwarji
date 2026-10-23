const app = require("./src/app");
const env = require("./src/config/env");

const PORT = env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("\n=== ADMIN SETUP ===");
  console.log("To create your first admin user, make a POST request to:");
  console.log(`http://your-server:${PORT}/api/create-admin`);
  console.log("==================\n");
});
