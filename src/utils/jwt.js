const jwt = require("jsonwebtoken");
const secret = "david@2022";

const jwtGenerateToken = (id, expires) => {
  return jwt.sign({ id }, secret, {
    expiresIn: expires || 86400, // 24 hours
  });
}

const jwtDecodeToken = (token) => {
  return jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return undefined;
    }
    return decoded.id;
  });
}

module.exports = {jwtGenerateToken, jwtDecodeToken}