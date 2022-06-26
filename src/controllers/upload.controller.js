/**
 **************************************************************
 * The Fans Together Website Backend - v1.0.0
 **************************************************************
 *
 * Product Page:
 * Copyright 2022 @TFTTeam (https://www.tft-dev-team.com)
 *
 * Coded by DavidSparker
 *
 **************************************************************
 */

const path = require("path");
const fs = require("fs");
const formidable = require("formidable");

const STATIC_PATH = "/public";
const STATIC_UPLOAD_PATH = "/upload/images/";
const UPLOAD_PATH = process.cwd() + STATIC_PATH + STATIC_UPLOAD_PATH;

exports.uploadImage = (req, res) => {
  const form = new formidable.IncomingForm();
  form.parse(req, async function (err, fields, files) {
    const tmpFilePath = files.file.filepath;
    const fileName =
      files.file.newFilename + path.extname(files.file.originalFilename);
    const dstFilePath = UPLOAD_PATH + fileName;
    try {
      if (!fs.existsSync(UPLOAD_PATH)) {
        console.log("[DAVID](froala) making directory for image upload ", UPLOAD_PATH);
        fs.mkdirSync(UPLOAD_PATH, { recursive: true });
      }
      console.log("[DAVID](froala) destination path =", dstFilePath);
      const linkUrl =
        req.protocol +
        "://" +
        req.get("host") +
        STATIC_UPLOAD_PATH +
        fileName;
      console.log("[DAVID](froala) Copying tmp file to dest ... ", tmpFilePath, dstFilePath);
      fs.copyFile(tmpFilePath, dstFilePath, (err) => {
        if (err) {
          console.log(`[DAVID](froala) image uploaded copying failed`, err);
          res.status(500).send("Failed to upload image... err=", err);
        } else {
          console.log(`[DAVID] image uploaded at ${linkUrl}`);
          res.send({ link: linkUrl });
        }
      });
    } catch (e) {
      console.log("[DAVID](froala) uploadImage error. err = ", e);
      res.send({ message: e.message });
    }
  });
};
