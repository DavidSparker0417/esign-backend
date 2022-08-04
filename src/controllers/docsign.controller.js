const db = require("../models");
const {signPdfByPdfSigner, signPdfByTron, pdfEmbedId} = require("../utilities/pdf");
const { sendEmail, Email } = require("../utils/email");
const { jwtGenerateToken, jwtDecodeToken } = require("../utils/jwt");
const User = db.user;
let payload;
let coordinates;
let auditTrail = {};
let gPdfBuffer;
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
  const moment = require("moment");
  const log = {
    when: moment().format("MM/DD/YYYY HH:mm:ss"),
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
        name: s.name,
        email: s.email,
        id: i,
        verified: false
      };
  });
  // console.log(signers);
  agent = payload?.agentInfo?.AgentEmail;
  const pdfBuffer = Buffer.from(payload.documents[0].documentBase64, "base64");
  const {resultPdf, hash} = await pdfEmbedId(pdfBuffer);
  gPdfBuffer = resultPdf;
  auditTrail.CertificateOfCompletion = {
    folderID: hash,
    subject: payload?.emailSubject,
    docName : payload.documents[0].name,
    docPages: coordinates.pdfLength
  }
  auditTrail.auditLog = [];
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
  console.log(`Generating code ... token = ${token} contactInfo = `, contact);
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
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log(`++++++++++++++++++++++ ${ip} +++++++++++++`); // ip address of the user
  signers[id].verified = true;
  signers[id].ipAddr = ip;
  addEvent(signers[id].email, `successfully verified(${ip})`);
  return res.send({message: "Success"});
}

function isAllsigned() {
  let i;
  for(i in signers) {
    s = signers[i];
    if (!s.signed)
      return false;
  }
  return true;
}

exports.sign = async(req, res) => {
  const {drInfo, token} = req.body;
  
  const id = jwtDecodeToken(token);
  if (id == undefined)
    return res.status(403).send({message: "Invalid token!"});

  const drawData = JSON.parse(drInfo);
  gPdfBuffer = await signPdfByPdfSigner(gPdfBuffer, signers[id].email, drawData);
  const resPdf = Buffer.from(gPdfBuffer).toString("base64");
  console.log(`[${signers[id].email}] is signing ...`);
  addEvent(signers[id].email, "signed");
  signers[id].signed = true;
  if (isAllsigned() === true) {
    console.log("++++++++++++++ All signers finished to sign! +++++++++");
    const host = req.get("host");
    for(let i in signers) {
      const s = signers[i];
      const mail = new Email();
      const token = jwtGenerateToken(i);
      const link = "https://" 
        + host 
        + `/api/doc-sign/download?token=${token}`;
      console.log(link);
      await mail.send({to: s.email, subject: "All are signed!", body: `Please download result from ${link}`});
    }
  }
  res.send({auditTrail, signedPdf: resPdf});
}

exports.download = async(req, res) => {
  const reqToken = req.query.token;
  const id = jwtDecodeToken(token);
  if (id === undefined)
    return res.status(403).send({message: "Invalid request token!"});
  if (!signers[id])
    return res.status(403).send({message: "Invalid id!"});

  console.log(`${signers[id].name} downloading result ...`);
  var Archiver = require('archiver');
  // Tell the browser that this is a zip file.
  res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-disposition': 'attachment; filename=sign-result.zip'
  });

  var zip = Archiver('zip');

  // Send the file to the page output.
  zip.pipe(res);

  const json2html = require("json2html");
  const auditTrailHtml = json2html.render(auditTrail);
  
  var { JSDOM } = require("jsdom");
  var { window } = new JSDOM("");
  const htmlToPdfmake = require("html-to-pdfmake");
  const html = htmlToPdfmake(auditTrailHtml, {window:window, tableAutoSize:true});
  const pdfMake = require("pdfmake/build/pdfmake");
  var pdfFonts = require("pdfmake/build/vfs_fonts");
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
  pdfMake.createPdf({content:html}).getBuffer(
    function(buffer) {
      zip.append(Buffer.from(gPdfBuffer), { name: 'signed.pdf' })
      .append(Buffer.from(buffer), { name: 'audit-trail.pdf' })
      .append(JSON.stringify(auditTrail), { name: 'audit-trail.json' })
      .finalize();
    }
  );
}