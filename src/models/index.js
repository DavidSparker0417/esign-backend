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

const config = require("../config/db.config");

const Sequelize = require("sequelize");
const sequelize = new Sequelize(
  config.database,
  config.user,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    operatorsAliases: false,
    logging: true,

    pool: {
      max: config.pool.max,
      min: config.pool.min,
      acquire: config.pool.acquire,
      idle: config.pool.idle,
    },
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("./user.model")(sequelize, Sequelize);
db.role = require("./role.model")(sequelize, Sequelize);

/**
 * relationship
 */
 db.role.belongsToMany(db.user, {
  through: "user_roles",
  foreignKey: "roleId",
  otherKey: "userId",
  as: "users",
});

db.user.belongsToMany(db.role, {
  through: "user_roles",
  foreignKey: "userId",
  otherKey: "roleId",
  as: "roles",
});

db.ROLES = ["user", "admin", "moderator"];

module.exports = db;
