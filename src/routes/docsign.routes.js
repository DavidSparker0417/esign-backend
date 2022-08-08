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
  app.post("/api/doc-sign/deliver", controller.deliver);
  app.post("/api/doc-sign/payloads", controller.resp_payloads);
  app.post("/api/doc-sign/sign", controller.sign);
  app.post("/api/doc-sign/auth", controller.auth);
  app.post("/api/doc-sign/verify", controller.verify);
  app.post("/api/doc-sign/adopt", controller.adopt);
  app.get("/api/doc-sign/download", controller.download);
}