/**
 **************************************************************
 * The Fans Together Website Backend - v1.0.0
 **************************************************************
 *
 * Product Page:
 * Copyright 2022 @TFTTeam (https://www.tft-dev-team.com)
 *
 * Coded by DavidSparker, Telecrypto@OKI
 *
 **************************************************************
 */

const fs = require("fs");

const uploadImage = (dir, filename, image) => {
  if (!image)
    return undefined;

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let buff = Buffer.from(image.split("base64,")[1], "base64");
  let imagePath = dir + filename;
  fs.writeFile(imagePath, buff, function (err) {
    if (err) {
      console.log("[DAVID] upload article face error! err = ", err);
      return undefined;
    }
  });
  imagePath = imagePath.split("public")[1];
  console.log(imagePath);
  return imagePath/* + "?m=" + new Date().getTime()*/;
};

module.exports = uploadImage;
