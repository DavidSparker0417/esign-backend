
const { default: axios } = require("axios");
const db = require("../models");
const { twitterOAuth } = require("../utils/oauth-promise");
const { getGoogleProfile } = require("../utils/thirdparty");
const ROLES = db.ROLES;
const User = db.user;

checkDupUserOrEmailOrWallet = async (req, res, next) => {
  const { type } = req.query;
  let user;
  try {
    console.log(`[DAVID] signup check :: type=${type} data = `, req.body.data)
    switch(type) {
      case "esign":
        const {username, email, password} = req.body.data;
        if (!username || !email || !password) {
          res.status(400).send({message: "Invalid registeration requests!"});
          return;
        }
        user = await User.findOne({
          where: {
            social: type,
            username: username,
            email: email
          }
        });
        break;
      case "wallet":
        const {wallet} = req.body.data;
        if (!wallet) {
          res.status(400).send({message: "Invalid wallet address!"});
          return;
        }
        user = await User.findOne({
          where: {
            // social: type,
            wallet: wallet
          }
        });
        break;
      case "google":
        const {token} = req.body.data;
        if (!token) {
          res.status(400).send({message: "Invalid google account token!"});
          return;
        }
        const profile = await getGoogleProfile(token);
        user = await User.findOne({
          where: {
            social: type,
            email: profile.email,
            username: profile.name
          }
        });
        req.body.data = {
          username: profile.name,
          email: profile.email,
          photo: profile.photo,
        };
        break;
      case "twitter":
        const {name, photo} = req.body.data;
        if (!name) {
          res.status(400).send({message: "Twitter account name cannot be null"});
          return;
        }
        user = await User.findOne({
          where: {
            social: type,
            username: name
          }
        });
        req.body.data = {
          username: name,
          photo: photo,
        };
        break;
      default:
        res.status(400).send({message: `Unknonw register type! (${type})`});
        return;
    }

    if (user) {
      res.status(400).send({message: "This account is already registered!"});
      return;
    }
    next();
  } catch (err) {
    console.log("checkDupUserOrEmailOrWallet", err);
    res.status(400).send({message: err.message});
    return;
  }
}

checkRolesExisted = (req, res, next) => {
  const roles = req.body.data.roles;
  if (roles) {
    for (let i = 0; i < roles.length; i++) {
      if (!ROLES.includes(roles[i])) {
        res.status(400).send({
          message: "Failed! Role does not exist = " + roles[i]
        });
        return;
      }
    }
  }

  next();
};

const verifyUser = {
  checkDupUserOrEmailOrWallet,
  checkRolesExisted
};

module.exports = verifyUser;
