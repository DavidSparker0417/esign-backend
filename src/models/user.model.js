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

module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define("users", {
    username: {
      type: Sequelize.STRING
    },
    email: {
      type: Sequelize.STRING
    },
    wallet: {
      type: Sequelize.STRING
    },
    password: {
      type: Sequelize.STRING
    },
    photo: {
      type: Sequelize.TEXT
    },
    social : {
      type: Sequelize.STRING
    }
  });

  return User;
};
