/**
 **************************************************************
 * The Fans Together Website Backend - v1.0.0
 **************************************************************
 *
 * Product Page:
 * Copyright 2022 @TFTTeam (https://www.tft-dev-team.com)
 *
 * Coded by Telecrypto@OKI,DavidSparker
 *
 **************************************************************
 */
const controller = require("../controllers/auth.controller");

module.exports = function (app) {
  var cors = require("cors");
  app.use(function (req, res, next) {
    const corsWhitelist = [
      "https://thefanstogether.io",
      "https://tft-web-david.web.app",
      "https://thefanstogether.web.app/",
      "http://localhost:3000"
    ];
    if (corsWhitelist.indexOf(req.headers.origin) !== -1)
      res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Access-Control-Allow-Credentials", true);
    res.header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.post("/api/auth/social", controller.socialLogin);
};
