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

const jwt = require("jsonwebtoken");
const config = require("../config/auth.config");
const db = require("../models");
const User = db.user;

decodeToken = (token) => {
  return jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      return undefined;
    }
    return decoded.id;
  });
}

verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"];
  if (!token) {
    return res.status(403).send({
      message: "No token provided!",
    });
  }

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "Unauthorized!",
        error: err
      });
    }
    req.userId = decoded.id;
    next();
  });
};

verifyUser = (req) => {
  const token = req.headers["x-access-token"];
  let userId;
  if (!token) return undefined;
  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      return undefined;
    }
    userId = decoded.id;
  });
  return userId;
};

isAdmin = (req, res, next) => {
  User.findByPk(req.userId).then((user) => {
    user.getRoles().then((roles) => {
      for (let i = 0; i < roles.length; i++) {
        if (roles[i].name === "admin") {
          next();
          return;
        }
      }

      res.status(403).send({
        message: "Require Admin Role!",
      });
      return;
    });
  });
};

isModerator = (req, res, next) => {
  User.findByPk(req.userId).then((user) => {
    user.getRoles().then((roles) => {
      for (let i = 0; i < roles.length; i++) {
        if (roles[i].name === "moderator") {
          next();
          return;
        }
      }

      res.status(403).send({
        message: "Require Moderator Role!",
      });
    });
  });
};

isModeratorOrAdmin = (req, res, next) => {
  User.findByPk(req.userId).then((user) => {
    user.getRoles().then((roles) => {
      for (let i = 0; i < roles.length; i++) {
        if (roles[i].name === "moderator") {
          next();
          return;
        }

        if (roles[i].name === "admin") {
          next();
          return;
        }
      }

      res.status(403).send({
        message: "Require Moderator or Admin Role!",
      });
    });
  });
};

const authJwt = {
  decodeToken,
  verifyToken,
  verifyUser,
  isAdmin,
  isModerator,
  isModeratorOrAdmin,
};
module.exports = authJwt;
