const db = require("../models");
const {signPdfByPdfSigner, signPdfByTron} = require("../utilities/pdf");
const { sendEmail } = require("../utils/email");
const User = db.user;

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
  const payload = JSON.parse(req.body.payload);
  const coordinates = JSON.parse(req.body.coordinates);
  console.log(payload.recipients);
  const signers = payload.recipients.signers;
  signers.map((s, i) => {
    console.log(`[${s.recipientId}] : ${s.email}`);
  });
  const email = "MaximGoriki88@gmail.com";
  const link = "http://localhost:3000/app/doc-sign/?id=4";
  await sendEmail(email, "Esign Document", link);
  res.send({message: "OK"});
}