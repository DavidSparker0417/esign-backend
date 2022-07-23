const db = require("../models");
const {signPdfByPdfSigner, signPdfByTron} = require("../utilities/pdf");
const { sendEmail } = require("../utils/email");
const User = db.user;
let payload;
let coordinates;
let auditTrail = {};
let pdfBuffer;
// const dapp_url = "http://192.168.103.18:3000";
const dapp_url = "https://esign-dapp.netlify.app";

exports.create = async (req, res) => {
  const { pdfBuffer, signData } = req.body;

  // get user info from req
  const userId = req.userId;
  let name, email;

  try {
    const user = await User.findByPk(userId);
    name = user.username;
    email = user.email;
    console.log(`[ESIGN-SERVICE] user = ${name}, email = ${email}`);
  } catch(e) {
    console.log("[error] ", e.message);
  }

  try {
    // const signedB64 = await signPdfByTron(pdfBuffer);
    const signedB64 = await signPdfByPdfSigner(pdfBuffer, signData, name, email);
    console.log("[DOC SIGN] complete. response buffer = ", signedB64.slice(0, 20));
    res.send(signedB64);
  } catch (e) {
    console.log("[DOC SIGN] error : ", e);
    res.status(403).send({ message: e.message });
  }
};

exports.deliver = async (req, res) => {
  payload = JSON.parse(req.body.payload);
  coordinates = JSON.parse(req.body.coordinates);
  const signers = payload.recipients.signers;
  signers.map(async (s, i) => {
    console.log(`[${s.recipientId}] : ${s.email}`);
    const link = `${dapp_url}/app/doc-sign/?id=${s.recipientId}`;
    console.log(s.email, link);
    await sendEmail(s.email, "Esign Document", link);
  });
  auditTrail.name = payload.documents[0].name;
  auditTrail.auditLog = [];
  pdfBuffer = Buffer.from(payload.documents[0].documentBase64, "base64");
  res.send({message: "OK"});
}

exports.resp_payloads = async (req, res) => {
  res.send({payload, coordinates});
}

exports.sign = async(req, res) => {
  const {who, behavior, drInfo} = req.body;
  console.log("++++++++++++ :: ", who, behavior);
  const log = {
    signer: who,
    behavior,
    date: (new Date()).toISOString().split('T')[0],
  }
  const drawData = JSON.parse(drInfo);
  const signedPdf = await signPdfByPdfSigner(pdfBuffer, who, drawData);
  auditTrail.auditLog.push(log);
  res.send({auditTrail, signedPdf});
}