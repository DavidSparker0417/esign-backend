const db = require("../models");
const {signPdfByPdfSigner, signPdfByTron} = require("../utilities/pdf");
const { sendEmail, Email } = require("../utils/email");
const { jwtGenerateToken, jwtDecodeToken } = require("../utils/jwt");
const User = db.user;
let payload;
let coordinates;
let auditTrail = {};
let pdfBuffer;
let agent;
// const dapp_url = "http://192.168.103.18:3000";
const dapp_url = "https://esign-dapp.netlify.app";
let signers = [];

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

const addEvent = async(who, behavior) => {
  const log = {
    when: (new Date()).toISOString().split('T')[0],
    who: who,
    behavior: behavior,
  }
  auditTrail.auditLog.push(log);
  const mail = new Email();
  await mail.send({to: agent, subject: "ESign Event", body: `${who} : ${behavior}`});
}

exports.deliver = async (req, res) => {
  payload = JSON.parse(req.body.payload);
  coordinates = JSON.parse(Buffer.from(payload.coordinateFile, "base64").toString());
  const _signers = payload.recipients.signers;
  signers = new Array(_signers.length);
  _signers.map(async (s, i) => {
    console.log(`[${i}] : ${s.email}`);
    const token = jwtGenerateToken(i);
    const link = `${dapp_url}/app/doc-sign/?token=${token}`;
    console.log(s.email, link);
    await sendEmail(s.email, "Esign Document", link);
    signers[i] = {
        email: s.email,
        id: i,
        verified: false,
      };
  });
  console.log(signers);
  agent = payload?.agentInfo?.AgentEmail;
  auditTrail.name = payload.documents[0].name;
  auditTrail.auditLog = [];
  pdfBuffer = Buffer.from(payload.documents[0].documentBase64, "base64");
  addEvent("ESIGN Team", "document delivered");
  res.send({message: "OK"});
}

exports.resp_payloads = async (req, res) => {
  const {token} = req.body;
  const id = jwtDecodeToken(token);
  if (id == undefined)
    return res.status(403).send({message: "Invalid token!"});
  const signer = signers[id];
  console.log("id = ", id, signer);
  if (signer.verified === true) {
    addEvent(signer.email, "viewed contract");
    return res.send({payload, coordinates, id: signer.id});
  }
  
  return res.status(401).send({message: "Unauthorized"});
}

exports.auth = async(req, res) => {
  const {token, contact} = req.body;
  const id = jwtDecodeToken(token);
  console.log(`Generating code ... token = ${token}contactInfo = `, contact);
  if (id == undefined)
    return res.status(403).send({message: "Invalid token!"});
  let code = "";
  for(let n = 0; n < 6; n ++) {
    const rnd = Math.floor(Math.random()*10);
    code = code + rnd.toString();
  }
  console.log("Generated verification code : ", code);
  signers[id].code = code;
  const mail = new Email();
  await mail.send({to: contact.addr, subject: "Verification code", body: `Your verification code: ${code}`})
  return res.send({message: "Verification code has been sent. Please make sure it in your inbox."});
}

exports.verify = async(req, res) => {
  const {token, code} = req.body;
  const id = jwtDecodeToken(token);
  if (id == undefined)
    return res.status(403).send({message: "Invalid token!"});
  if (code !== signers[id].code)
    return res.status(421).send({message: "Invalid verification code!"});
  signers[id].verified = true;
  addEvent(signers[id].email, "successfully authenticated");
  return res.send({message: "Success"});
}

exports.sign = async(req, res) => {
  const {who, behavior, drInfo} = req.body;
  console.log("++++++++++++ :: ", who, behavior);
  const drawData = JSON.parse(drInfo);
  const signedPdf = await signPdfByPdfSigner(pdfBuffer, who, drawData);
  
  addEvent(who, "signed");
  res.send({auditTrail, signedPdf});
}