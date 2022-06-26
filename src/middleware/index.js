/**
 **************************************************************
 * The Fans Together Website Backend - v1.0.0
 **************************************************************
 * 
 * Product Page: 
 * Copyright 2022 @TFTTeam (https://www.tft-dev-team.com)
 * 
 * Coded by Telecrypto@OKI
 * 
 **************************************************************
 */

const authJwt = require("./authJwt");
const verifyUser = require("./verifyUser");

module.exports = {
  authJwt,
  verifyUser,
};