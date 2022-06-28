const { verifyUser, authJwt } = require("../middleware");
const controller = require("../controllers/auth.controller");
const { pwdResetEmailTemplate } = require("../utils/email");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/auth/check", authJwt.verifyToken, controller.checkUser);
  app.post(
    "/api/auth/signup",
    [verifyUser.checkDupUserOrEmailOrWallet, verifyUser.checkRolesExisted],
    controller.signup
  );
  app.post("/api/auth/signin", controller.signin);
  app.put("/api/auth/updateuser", [authJwt.verifyToken], controller.updateUser);
  app.put("/api/auth/updatewithwallet", controller.updateWithWallet);
  app.post("/api/auth/password-reset", controller.passwordReset);
  app.get("/api/test", (req, res) => {
    return res.send(pwdResetEmailTemplate("DavidSparker0417@gmail.com", "http://localhost:3000/password-reset?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NTMsImlhdCI6MTY1Mzk4NjcwOSwiZXhwIjoxNjUzOTg3MzA5fQ.y9XbQrulK5uO5gTHYrU9su2bXP7IzaKwRzubgoQ8_4c"));
  });
};
