const crypto = require("crypto");

function utilGenerateID(data) {
  const hash = crypto.createHash("md5").update(data).digest("hex");
  return hash;
}

module.exports = {
  utilGenerateID
}