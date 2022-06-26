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

const db = require("../models");
const config = require("../config/auth.config");
const uploadImage = require("../utils/uploadImage");

const User = db.user;
const Role = db.role;

const Op = db.Sequelize.Op;
const accountsDir = "./public/upload/accounts/";

var jwt = require("jsonwebtoken");
var bcrypt = require("bcryptjs");
const {
  getGoogleProfile,
  twitterGetOAuthToken,
  twitterGetAccessToken,
} = require("../utils/thirdparty");
const { twitterOAuth } = require("../utils/oauth-promise");
const { sendEmail } = require("../utils/email");
const { decodeToken } = require("../middleware/authJwt");

const generateToken = (user, expires) => {
  return jwt.sign({ id: user.id }, config.secret, {
    expiresIn: expires || 86400, // 24 hours
  });
};

const getUserRoles = async (user) => {
  var authorities = [];
  console.log("getUserRoles: user:::", user);
  var roles = await user.getRoles();
  for (let i = 0; i < roles.length; i++) {
    authorities.push(roles[i].name);
  }
  return authorities;
};

const getUser = async (user) => ({
  username: user.username,
  email: user.email,
  wallet: user.wallet,
  photo: user.photo,
  type: user.social,
  roles: await getUserRoles(user),
  accessToken: generateToken(user),
});

exports.signup = async (req, res) => {
  const { username, email, photo, wallet, password, roles } = req.body.data;
  const { type } = req.query;
  // Save User to Database
  console.log("[DAVID] signup:: reqData = ", req.body);
  try {
    const user = await User.create({
      username: username,
      email: email,
      wallet: wallet,
      photo: photo || "",
      password: password ? bcrypt.hashSync(password, 8) : null,
      social: type,
    });

    if (roles) {
      const rolesInfo = await Role.findAll({
        where: {
          name: { [Op.or]: roles.map((role) => role.toLowerCase()) },
        },
      });
      await user.setRoles(rolesInfo);
    } else {
      await user.setRoles([1]);
    }

    return res.status(200).send(await getUser(user));
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
};

exports.signin = async (req, res) => {
  const { type } = req.query;
  let user;
  try {
    console.log("[DAVID] ++++++++ SIGN IN ++++++ :: reqest data", req.body);
    switch (type) {
      case "esign": // login with tft orgnization
        const { username, email, password } = req.body.data;
        // check username & email
        if (!username && !email) {
          return res.status(400).send({
            message:
              "Invalid esign registration information! Both username and email are empty!",
          });
        }
        // check password is null
        if (!password) {
          return res.status(400).send({
            message: "Password could not be null!",
          });
        }
        // find corresponding user
        user = await User.findOne({
          where: email
            ? { email: email, social: type }
            : { username: username, social: type },
        });
        // check if password correct
        if (user && !bcrypt.compareSync(password, user.password)) {
          return res.status(400).send({
            message: "Password incorrect!",
          });
        }
        break;

      case "wallet": // login with wallet
        const { wallet } = req.body.data;
        if (!wallet) {
          return res.status(400).send({
            message:
              "Invalid wallet registration information! Wallet address is empty!",
          });
        }
        user = await User.findOne({
          where: {
            wallet: wallet,
            // social: type,
          },
        });
        break;

      case "google": // login with google
        const { token } = req.body.data;
        if (!token) {
          return res.status(400).send({
            message: "Invalid gootle registration information! Token is empty!",
          });
        }
        const profile = await getGoogleProfile(token);
        user = await User.findOne({
          where: {
            social: type,
            email: profile.email,
          },
        });
        break;
      case "twitter":
        const { name } = req.body.data;
        if (!name)
          return res
            .status(400)
            .send({ message: "Twitter account name should not be null." });
        user = await User.findOne({
          where: {
            social: type,
            username: name,
          },
        });
        break;
      default:
        return res
          .status(400)
          .send({ message: `Invalid login type!(${type})` });
    }
    if (!user) {
      return res.status(404).send({ message: "User does not exist." });
    }
    return res.status(200).send(await getUser(user));
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { type, username, email, wallet, curPassword, newPassword, photo } =
    req.body;
  const userId = req.userId;
  console.log(`[DAVID] updateUser :: userId=${userId} , reqData = `, req.body);

  try {
    const user = await User.findByPk(userId);

    if (!user)
      return res.status(400).send({
        message: "User not found",
      });

    if (email && user.email !== email) {
      const result = await User.findOne({
        where: { email: email, social: type },
      });
      if (result) {
        return res.status(400).send({
          message: "Email address already in use",
        });
      }
    }

    if (wallet && user.wallet !== wallet) {
      const result = await User.findOne({
        where: { wallet: wallet/*, social: type*/ },
      });
      if (result) {
        return res.status(400).send({
          message: "Wallet address already in use",
        });
      }
    }

    console.log("curPassword2", curPassword, user.password, newPassword);
    let photoUrl = undefined;
    if (photo && photo.indexOf("base64") !== -1) {
      photoUrl =
        req.protocol +
        "://" +
        req.get("host") +
        uploadImage(accountsDir, username + ".img", photo);
    } else {
      photoUrl = photo;
    }

    if (!newPassword) {
      const result = await User.update(
        { username, email, wallet, photo: photoUrl },
        {
          where: { id: userId },
          returning: true,
          plain: true,
        }
      );

      return res.status(200).send(await getUser(result[1]));
    } else {
      console.log("curPassword", curPassword, user.password, newPassword);

      var passwordIsValid = !user.password
        ? !curPassword
        : bcrypt.compareSync(curPassword ? curPassword : "", user.password);

      if (!passwordIsValid) {
        return res.status(401).send({
          accessToken: null,
          message: "Current password is not correct!",
        });
      }

      const result = await User.update(
        {
          username,
          email,
          wallet,
          photo: photoUrl,
          password: newPassword ? bcrypt.hashSync(newPassword, 8) : null,
        },
        {
          where: { id: userId },
          returning: true,
          plain: true,
        }
      );
      return res.status(200).send(await getUser(result[1]));
    }
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
};

exports.updateWithWallet = async (req, res) => {
  const { username, email, wallet, curPassword, newPassword, photo } = req.body;

  if (!wallet) {
    return res
      .status(400)
      .send({ message: "Wallet address must not be null or empty" });
  }

  try {
    const user = await User.findOne({ where: { wallet: wallet } });

    if (!user)
      return res.status(400).send({
        message: "User not found",
      });

    if (username && user.username !== username) {
      const result = await User.findOne({ where: { username: username } });
      if (result) {
        return res.status(400).send({
          message: "Username already in use",
        });
      }
    }

    if (email && user.email !== email) {
      const result = await User.findOne({ where: { email: email } });
      if (result) {
        return res.status(400).send({
          message: "Email address already in use",
        });
      }
    }

    console.log("newPassword:::", newPassword);
    if (!newPassword) {
      let photoUrl = undefined;
      console.log("photo", photo);
      if (photo && photo.indexOf("base64") !== -1) {
        photoUrl =
          req.protocol +
          "://" +
          req.get("host") +
          uploadImage(accountsDir, username + ".img", photo);
      } else {
        photoUrl = photo;
      }

      const result = await User.update(
        { email, wallet, photo: photoUrl },
        {
          where: { username: username },
          returning: true,
          plain: true,
        }
      );

      return res.status(200).send(await getUser(result[1]));
    } else {
      console.log("curPassword", curPassword, user.password, newPassword);
      var passwordIsValid = !user.password
        ? !curPassword
        : bcrypt.compareSync(curPassword ? curPassword : "", user.password);

      if (!passwordIsValid) {
        return res.status(401).send({
          accessToken: null,
          message: "Current password is not correct!",
        });
      }

      const result = await User.update(
        {
          username,
          email,
          photo,
          password: newPassword ? bcrypt.hashSync(newPassword, 8) : null,
        },
        {
          where: { wallet: wallet },
          returning: true,
          plain: true,
        }
      );
      return res.status(200).send(await getUser(result[1]));
    }
  } catch (err) {
    return res.status(500).send({ message: err.message });
  }
};

exports.findUserIdByUsername = async (username) =>
  await User.findOne({
    where: { username: username },
    attributes: ["id"],
  });

exports.findUserByUsername = async (username) =>
  await User.findOne({
    where: { username: username },
    attributes: ["id", "username", "photo"],
    include: {
      model: User,
      as: "followedBy",
      attributes: ["username"],
    },
  });

exports.checkUser = async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).send({ message: "Invalid User!" });
  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(401).send({ message: "User not exists!" });
    return res.send({ message: "Success" });
  } catch (err) {
    return res.status(401).send({ message: err.message });
  }
};

let tokens = {};
exports.socialLogin = async (req, res) => {
  const { type, step } = req.query;
  console.log(`[DAVID] socialLogin :: ${type} : ${step}`);
  const cookieName = type;
  try {
    switch (type) {
      case "twitter":
        const { subpath } = req.body;
        const clientUrl = req.headers.origin + subpath;
        console.log(`[DAVID] TWITTER LOGIN :: clientUrl = ${clientUrl}`);
        const oauth = twitterOAuth(clientUrl);
        if (step == 1) {
          // step 1
          const { oauth_token, oauth_token_secret } =
            await oauth.getOAuthRequestToken();
          res.cookie(cookieName, oauth_token, {
            maxAge: 15 * 60 * 1000, // 15 minutes
            secure: true,
            sameSite: "none",
            httpOnly: false,
          });
          console.log(`[DAVID] oauth_token = `, oauth_token);
          tokens[oauth_token] = oauth_token_secret;
          return res.send({ oauth_token });
        } else if (step == 3) {
          const { oauth_token: req_oauth_token, oauth_verifier } = req.body;
          console.log(
            `[DAVID] requsted token=${req_oauth_token}, verifier=${oauth_verifier}`
          );
          console.log("[DAVID] REQUEST COOKIES = ", req.cookies);
          const oauth_token = req.cookies[cookieName];
          if (!oauth_token || oauth_token !== req_oauth_token)
            return res
              .status(401)
              .send({ message: "Failed authenticating on twitter!" });
          console.log(
            `[DAVID] token stored in cookie =${oauth_token}, requested token=${req_oauth_token}`
          );
          const oauth_token_secret = tokens[oauth_token].oauth_token_secret;

          const { oauth_access_token, oauth_access_token_secret } =
            await oauth.getOAuthAccessToken(
              oauth_token,
              oauth_token_secret,
              oauth_verifier
            );
          // get profile info
          const response = await oauth.getProtectedResource(
            "https://api.twitter.com/1.1/account/verify_credentials.json",
            "GET",
            oauth_access_token,
            oauth_access_token_secret
          );
          const profile = JSON.parse(response.data);
          return res.send({
            name: profile.name,
            photo: profile.profile_image_url_https,
          });
        }
        break;
      default:
        return res
          .status(401)
          .send({ message: `Unknown social type (${type})` });
    }
  } catch (e) {
    let message = e.message;
    console.log("[DAVID] Error login with social... err = ", e);
    if (e.code == "ETIMEDOUT") message = "Error! Timed out.";
    return res.status(401).send({ message });
  }
};

let pwdrRequestedEmail = {};
exports.passwordReset = async (req, res) => {
  const { email, password } = req.body;
  const { token } = req.query;
  console.log(
    `[DAVID] passwordReset :: email= ${email}, token= ${token}, password=${password}`
  );

  try {
    if (token) {
      // reset password
      const userId = decodeToken(token);
      if (!userId) return res.status(401).send({ message: "Invalid token!" });

      const user = await User.findByPk(userId);
      if (!user)
        return res
          .status(401)
          .send({ message: `Cannot find user for this token(${token})` });
      console.log(
        `[DAVID] passwordReset :: pwdrRequestedEmail = `,
        pwdrRequestedEmail
      );
      console.log(
        `[DAVID] passwordReset :: stored email = ${pwdrRequestedEmail[userId]}, dbEmail=${user.email}`
      );
      if (user.email !== pwdrRequestedEmail[userId])
        return res
          .status(401)
          .send({ message: `Token doesn't match with requested email` });

      console.log(`[DAVID] Updating password(${password})...`);
      await User.update(
        { password: bcrypt.hashSync(password, 8) },
        {
          where: {
            id: userId,
          },
        }
      );
      res.send({ type: "password-reset" });
    } else {
      // send email to reset password
      const user = await User.findOne({
        where: {
          email: email,
        },
        attributes: ["id"],
      });

      if (!user)
        return res
          .status(401)
          .send({ message: `There is no record of the email ${email}.` });
      const token = generateToken(user, 10 * 60);
      console.log("[DAVID] user token = ", token);
      pwdrRequestedEmail[user.id] = email;
      const clientUrl = req.headers.origin + `/password-reset?token=${token}`;
      const emailSent = await sendEmail(
        email,
        "The Fans Together (TFT)",
        clientUrl
      );
      if (!emailSent)
        return res.status(401).send({ message: "Failed to send email!" });
      return res.send({
        type: "mail-sent",
        data: email,
      });
    }
  } catch (e) {
    console.log(`[DAVID] Failed to reset password! err = `, e);
    return res
      .status(401)
      .send({ message: "Something went wrong reseting password" });
  }
};
