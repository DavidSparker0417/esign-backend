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

const authController = require("../controllers/auth.controller");
const db = require("../models");
const User = db.user;

const profileMapper = (user, username) => ({
  username: user.username,
  email: user.email,
  wallet: user.wallet,
  photo: user.photo,
  following: username
    ? user?.followedBy.some(following => following.username == username)
    : false,
});

exports.getProfile = async (req, res) => {
  const usernamePayload = req.param?.username;
  const usernameAuth = req.user?.username;
  try {
    const profile = await User.findOne({
      where: { username: usernamePayload },
      include: {
        model: User, as: "followedBy"
      },
    });
    return res.status(200).send(profileMapper(profile, usernameAuth));
  } catch (err) {
    return res.status(422).send({ message: err.message });
  }
};

exports.followUser = async (req, res) => {
  const usernamePayload = req.param?.username;
  const usernameAuth = req.user?.username;

  try {
    const { id } = await authController.findUserIdByUsername(usernameAuth);
    const profile = await User.findOne({
      where: {
        username: usernamePayload,
      },
      include: {
        model: User, as: "followedBy",
      }
    });

    // add follower to user
    profile.AddFollowedBy(id);
    return res.status(200).send(profileMapper(profile, usernameAuth));
  } catch (err) {
    return res.status(422).send({ message: err.message });
  }
};

exports.unfollowUser = async (req, res) => {
  const usernamePayload = req.param?.username;
  const usernameAuth = req.user?.username;

  try {
    const { id } = await authController.findUserIdByUsername(usernameAuth);
    const profile = await User.findOne({
      where: {
        username: usernamePayload,
      },
      include: {
        model: User, as: "followedBy",
      }
    });

    profile.RemoveFollowedBy(id);
    return res.status(200).send(profileMapper(profile, usernameAuth));
  } catch (err) {
    return res.status(422).send({ message: err.message });
  }
};
