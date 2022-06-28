
const { authJwt } = require("../middleware");
const controller = require("../controllers/profile.controller");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/:username", [authJwt.verifyToken], controller.getProfile);
  app.post("/api/:username/follow", [authJwt.verifyToken], controller.followUser);
  app.delete("/api/:username/follow", [authJwt.verifyToken], controller.unfollowUser);
};
