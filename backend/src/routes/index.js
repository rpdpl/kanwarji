module.exports = function registerRoutes(app) {
  require("./payments")(app);
  require("./cart")(app);
  require("./addresses")(app);
  require("./auth")(app);
  require("./admin")(app);
  require("./items")(app);
  require("./orders")(app);
  require("./misc")(app);
  require("./shiprocket")(app);
};
