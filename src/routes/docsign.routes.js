const controller = require("../controllers/docsign.controller");
const { authJwt } = require("../middleware");

module.exports = function(app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.post("/api/doc-sign/create", [authJwt.verifyToken], controller.create);
}