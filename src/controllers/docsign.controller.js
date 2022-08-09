const db = require("../models");
const {signPdfByPdfSigner, signPdfByTron, pdfEmbedId} = require("../utilities/pdf");
const { sendEmail, Email } = require("../utils/email");
const { jwtGenerateToken, jwtDecodeToken } = require("../utils/jwt");
const { utilGenerateID } = require("../utilities/hash");
const { table } = require("console");
const PDFDocument = require("pdfkit-table");
const { currentTime } = require("../utils/time");
const { onDeliver, onRespPayload, onAuth, onVerify, onAdopt, onSign, onDownload } = require("../utilities/docSign");
let auditPdfDoc;

const User = db.user;
let payload;
let coordinates;
let auditTrail = {
  certificateOfCompletion: 
  {
    headers: [ "Certificate Of Completion", "" ],
    rows: [],
  },
  folderOriginator: {
    headers: [ "Folder Originator", "" ],
    rows: [],
  },
  recordTracking: {
    headers: [ "Record Tracking", "", "Time Stamps" ],
    rows: [],
  },
  folderSummary: {
    headers: [ "Folder Summary of Events", "Status", "Time Stamps" ],
    rows: [],
  },
};
let gPdfBuffer;
let agent;
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
    when: currentTime(),
    who: who,
    behavior: behavior,
  }
  // auditTrail.auditLog.push(log);
  const mail = new Email();
  // await mail.send({to: agent, subject: "ESign Event", body: `${who} : ${behavior}`});
}

async function onSingleFolderDeliver(pld) {
  coordinates = JSON.parse(Buffer.from(pld.coordinateFile, "base64").toString());
  const _signers = pld.recipients.signers;
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
    const sid = i + 1;
    const signerKey = `signer${sid}Log`;
    auditTrail[signerKey] = {
      headers: [ 
        {label:`Signer ${sid} Log`}, 
        {
          label:"", 
          renderer: (value, indexColumn, indexRow, row, rectRow, rectCell) => { 
            if (typeof value === 'string')
            {
              return value;
            }
            const {x, y, width, height} = rectCell;
            auditPdfDoc.image(value.image, x, y, {height: height});
            // auditPdfDoc.text();
            return "";
          }
        },
        {label:"Time Stamps"} 
      ],
      rows: [],
    };
    auditTrail[signerKey].rows.push(["Name", s.name, ""]);
    auditTrail[signerKey].rows.push(["Email", s.email, ""]);
    auditTrail[signerKey].rows.push(["Cell", `Signer ${sid} phone`, ""]);
    auditTrail[signerKey].rows.push(["Signed using mobile", `{device Type}`, ""]);
    auditTrail[signerKey].rows.push(["Signed by link sent to", s.email, ""]);
  });
  
  agent = pld?.agentInfo?.AgentEmail;
  const pdfBuffer = Buffer.from(pld.documents[0].documentBase64, "base64");
  const {resultPdf, hash} = await pdfEmbedId(pdfBuffer);
  gPdfBuffer = resultPdf;
  
  let initialCount = 0;
  let sigCount = 0;
  let certPages = 0;
  let exsitsCerts = new Array(coordinates.pdfLength).fill(false);
  coordinates?.allSigners?.map((cs, i) => {
    cs.pages.map((p, pageNumber) => {
      if (p?.initialCoordinates) initialCount += p.initialCoordinates.length;
      if (p?.signatureCoordinates) {
        certPages ++;
        sigCount += p.signatureCoordinates.length;
        exsitsCerts[pageNumber] = true;
      } 
    });
  });
  auditTrail.certificateOfCompletion.rows.push(["folderId", hash]);
  auditTrail.certificateOfCompletion.rows.push(["subject", pld?.emailSubject]);
  auditTrail.certificateOfCompletion.rows.push(["Source", "Folder"]);
  auditTrail.certificateOfCompletion.rows.push(["Document Pages", coordinates.pdfLength]);
  auditTrail.certificateOfCompletion.rows.push(["Signatures", sigCount]);
  auditTrail.certificateOfCompletion.rows.push(["Initials", initialCount]);
  auditTrail.certificateOfCompletion.rows.push(["Certificate Pages", certPages]);
  auditTrail.certificateOfCompletion.rows.push(["Folder Stamping", "Enabled"]);
  auditTrail.certificateOfCompletion.rows.push(["AutoNav", "Enabled"]);
  
  auditTrail.folderOriginator.rows.push(["staus", "Complete"]);
  auditTrail.folderOriginator.rows.push(["{OriginatorAddressline1}", ""]);
  auditTrail.folderOriginator.rows.push(["{OriginatorAddressline2}", ""]);
  auditTrail.folderOriginator.rows.push(["52.124.34.134", ""]);
  auditTrail.folderOriginator.rows.push(["{OriginatorName}", ""]);
  auditTrail.folderOriginator.rows.push(["{OriginatorEmail}", ""]);

  auditTrail.recordTracking.rows.push(["Status", "Original", currentTime()]);
  auditTrail.recordTracking.rows.push(["Document Holder", "", ""]);
  auditTrail.recordTracking.rows.push(["Location: Self Custody", "", ""]);

  const curTime = currentTime();
  auditTrail.folderSummary.rows.push(["FolderSent", "Hashed/encrypted", curTime]);
  auditTrail.folderSummary.rows.push(["Certified Delivered", "Security Check Passed", curTime]);
  auditTrail.folderSummary.rows.push(["Signing Complete", "Security Check Passed", curTime]);
  auditTrail.folderSummary.rows.push(["Completed", "Security Check Passed", curTime]);
  await addEvent("ESIGN Team", "document delivered");
}

exports.deliver = async (req, res) => {
  payload = JSON.parse(req.body?.payload);
  if (!payload)
    res.status(403).send({message: "Thre is no payload in your request!"});
  // onSingleFolderDeliver(payload);
  try {
    await onDeliver(payload);
  } catch(e) {
    return res.status(403).send({message: "Error occured on delivering!"});
  }
  res.send({message: "OK"});
}

exports.resp_payloads = async (req, res) => {
  const {token} = req.body;
  const dtk = jwtDecodeToken(token);
  if (dtk == undefined)
    return res.status(403).send({message: "Invalid token!"});
  let id;
  if (typeof dtk == "object")
  {
    id = dtk.id;
    const pl = await onRespPayload(dtk.folder, dtk.id);
    if (pl === null)
      return res.status(403).send({message: "Invalid token!"});
    if (typeof pl === "string")
    {
      return res.status(401).send({message: pl});
    }
    return res.send(pl);
  }
  
  id = dtk;
  const signer = signers[id];
  console.log("id = ", id, signer);
  if (signer.verified === true) {
    addEvent(signer.email, "viewed contract");
    return res.send({payload, coordinates, id: signer.id});
  }
  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  auditTrail[signerKey].rows.push(["Viewed", "", curTime]);

  return res.status(401).send({message: "Unauthorized"});
}

exports.auth = async(req, res) => {
  const {token, contact} = req.body;
  const dtk = jwtDecodeToken(token);
  if (dtk == undefined)
    return res.status(403).send({message: "Invalid token!"});
  let id;
  if (typeof dtk == "object")
  {
    id = dtk.id;
    const code = await onAuth(dtk.folder, dtk.id);
    if (code === null)
      return res.status(403).send({message: "Invalid token!"});
    const mail = new Email();
    await mail.send({to: contact.addr, subject: "Verification code", body: `Your verification code: ${code}`})
    return res.send({message: "Verification code has been sent. Please make sure it in your inbox."});  
  }
  else 
    id = dtk;
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
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const dtk = jwtDecodeToken(token);
  if (dtk == undefined)
    return res.status(403).send({message: "Invalid token!"});

  let id;
  if (typeof dtk == "object")
  {
    id = dtk.id;
    const ret = await onVerify(dtk.folder, dtk.id, ip, code);
    if (typeof ret === "string")
      return res.status(403).send({message: ret});
    return res.send({message: "Success"});
  }
  
  id = dtk;
  if (code !== signers[id].code)
    return res.status(421).send({message: "Invalid verification code!"});
  signers[id].verified = true;
  signers[id].ipAddr = ip;

  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  auditTrail[signerKey].rows.push(["Authentication Level", "Email", curTime]);
  auditTrail[signerKey].rows.push(["Using IP Address", ip, ""]);
  auditTrail[signerKey].rows.push(["Signed by link sent to", signers[id].email, ""]);
  addEvent(signers[id].email, `successfully verified(${ip})`);
  return res.send({message: "Success"});
}

exports.adopt = async(req, res) => {
  const {token} = req.body;
  const dtk = jwtDecodeToken(token);
  if (dtk == undefined)
    return res.status(403).send({message: "Invalid token!"});

  let id;
  if (typeof dtk == "object")
  {
    id = dtk.id;
    const ret = await onAdopt(dtk.folder, dtk.id, utilGenerateID(token));
    if (typeof ret === "string")
      return res.status(403).send({message: ret});
    return res.send({message: "Success"});
  }
  
  id = dtk;
  console.log(`${signers[id].name} accepted ERSD.`);
  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  auditTrail[signerKey].rows.push(["ERSD", "Accepted", curTime]);
  auditTrail[signerKey].rows.push(["ERSD ID", utilGenerateID(token), curTime]);
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
  const drawData = JSON.parse(drInfo);

  const dtk = jwtDecodeToken(token);
  if (dtk == undefined)
    return res.status(403).send({message: "Invalid token!"});

  let id;
  if (typeof dtk == "object")
  {
    id = dtk.id;
    const ret = await onSign(dtk.folder, dtk.id, drawData, req.get("host"), req?.device);
    if (typeof ret === "string")
      return res.status(403).send({message: ret});
    return res.send(ret);
  }
  
  id = dtk;
  gPdfBuffer = await signPdfByPdfSigner(gPdfBuffer, drawData);
  const resPdf = Buffer.from(gPdfBuffer).toString("base64");
  console.log(`[${signers[id].email}] is signing ...`);
  addEvent(signers[id].email, "signed");
  signers[id].signed = true;

  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  
  auditTrail[signerKey].rows.push([
    "Image Of Signature", 
    {
      image: drawData.sig.mark,
      id: utilGenerateID(drawData.sig.mark)
    },
    ""
  ]);
  auditTrail[signerKey].rows.push([
    "", 
    utilGenerateID(drawData.sig.mark),
    ""
  ]);
  auditTrail[signerKey].rows.push([
    "Image Of Initial", 
    {
      image: drawData.initial.mark,
      id: utilGenerateID(drawData.initial.mark)
    },
    ""
  ]);
  auditTrail[signerKey].rows.push([
    "", 
    utilGenerateID(drawData.initial.mark),
    ""
  ]);
  auditTrail[signerKey].rows.push(["Signed", "", curTime]);
  
  if (isAllsigned() === true) {
    console.log("++++++++++++++ All signers finished to sign! +++++++++");
    const host = req.get("host");
    for(let i = 0; i < signers.length; i ++) {
      const s = signers[i];
      const mail = new Email();
      const token = jwtGenerateToken(i);
      const link = "https://" 
        + host 
        + `/api/doc-sign/download?token=${token}`;
      console.log(link);
      // await mail.send({to: s.email, subject: "All are signed!", body: `Please download result from ${link}`});
    }
  }
  res.send({auditTrail, signedPdf: resPdf});
}

exports.download = async(req, res) => {
  const reqToken = req.query.token;
  
  const dtk = jwtDecodeToken(reqToken);
  if (dtk == undefined)
    return res.status(403).send({message: "Invalid token!"});

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-disposition': 'attachment; filename=sign-result.zip'
  });
  
  let auditPdf;
  let signedPdfBuffer;
  if (typeof dtk == "object")
  {
    const ret = await onDownload(dtk.folder, dtk.id);
    if (typeof ret === "string")
      return res.status(403).send({message: ret});
    
      auditPdf = ret.auditPdf;
    signedPdfBuffer = ret.signedPdf;
  } else {
    const id = dtk;
    console.log(`${signers[id].name} downloading result ...`);
    const signerKey = `signer${id+1}Log`;
    auditTrail[signerKey].rows.push(["Sent", "", currentTime()]);
    auditPdf = await makeAuditTrailPdf();
    signedPdfBuffer = gPdfBuffer;
  }
  var Archiver = require('archiver');
  var zip = Archiver('zip');
  // Send the file to the page output.
  zip.pipe(res);
  zip.append(Buffer.from(signedPdfBuffer), { name: 'signed.pdf' })
      .append(Buffer.from(auditPdf), { name: 'audit-trail.pdf' })
      .finalize();
}

// async function makeAuditTrailPdf() {
//   const stream = require("../utilities/stream");
//   auditPdfDoc = new PDFDocument({ margin: 30});
//   let writeStream = new stream.WritableBufferStream();
  
//   auditPdfDoc.pipe(writeStream);
//   await auditPdfDoc.table(auditTrail.certificateOfCompletion);
//   await auditPdfDoc.table(auditTrail.folderOriginator);
//   await auditPdfDoc.table(auditTrail.recordTracking);
//   await auditPdfDoc.table(auditTrail.folderSummary);
  
//   for(let i=0; i < signers.length; i ++) {
//     if (i % 2 == 0)
//       await auditPdfDoc.addPage();
//     const id = i + 1;
//     const signerKey = `signer${id}Log`;
//     console.log(signerKey);
//     await auditPdfDoc.table(auditTrail[signerKey]);
//   }
//   await auditPdfDoc.image(testImage);
//   auditPdfDoc.end();
//   writeStream.on("finish", () => {
//     console.log("::: write stream.on ::: ", writeStream.toBuffer());
//   });
//   return writeStream.toBuffer();
// }
