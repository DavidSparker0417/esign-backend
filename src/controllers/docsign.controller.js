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
  payload = JSON.parse(req.body.payload);
  // onSingleFolderDeliver(payload);
  await onDeliver(payload);
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
    const ret = await onSign(dtk.folder, dtk.id, drawData, req.get("host"), req?.device?.type);
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

const makeAuditTrailPdf = ()=> new Promise(async(resolve, reject) => {
  const stream = require("../utilities/stream");
  auditPdfDoc = new PDFDocument({ margin: 30});
  let writeStream = new stream.WritableBufferStream();
  
  auditPdfDoc.pipe(writeStream);
  await auditPdfDoc.table(auditTrail.certificateOfCompletion);
  await auditPdfDoc.table(auditTrail.folderOriginator);
  await auditPdfDoc.table(auditTrail.recordTracking);
  await auditPdfDoc.table(auditTrail.folderSummary);
  
  for(let i=0; i < signers.length; i ++) {
    if (i % 2 == 0)
      await auditPdfDoc.addPage();
    const id = i + 1;
    const signerKey = `signer${id}Log`;
    console.log(signerKey);
    await auditPdfDoc.table(auditTrail[signerKey]);
  }
  auditPdfDoc.end();
  writeStream.on("finish", () => resolve(writeStream.toBuffer()));
});

exports.testPdfTable = async() => {
  // return;
  const fs = require("fs");
  // const PDFDocument = require("pdfkit-table");
  
  // init document
  console.log("++++++++++++ testing make pdf table ++++++++++");
  let doc = new PDFDocument({ margin: 30, size: 'A4' });
  doc.pipe(fs.createWriteStream("./document.pdf"));
  const tables = [
    {
      headers: [ 
        {
          label:"CertificateOfCompletion", 
          property: "title",
          renderer: null,
        }, 
        {
          label:"", 
          property: "content",
          renderer: (value, indexColumn, indexRow, row, rectRow, rectCell) => { 
            if (typeof value === 'string')
            {
              return value;
            }
            return value.desc;
          }
        } 
      ],
      rows: [
        ["Source", "Folder"],
        ["test", {title: "folder", desc: "description"}],
        ["", ""],
      ],
      options: {
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
          const r = row[indexColumn];
          if (typeof r !== "string")
          {
            console.log(r);
            console.log(rectRow);
            rectRow.height = 60;
          }
        },
        minRowHeight: 10
      }
    },
    {
      headers: [ "Folder Originator", "" ],
      rows: [
        [ "Staus", "Complete"],
        [ "{OriginatorAddressline1}", ""],
        [ "{OriginatorAddressline2}", ""],
        [ "52.124.34.134", ""],
        [ "{OriginatorName}", ""],
        [ "{OriginatorEmail}", ""],
      ],
    }
  ];
  for(let i = 0; i < tables.length; i++)
  {
    await doc.table(tables[i], tables[i].options || {});
  }
  await doc.image(testImage);
  doc.end();
}

const testImage = "data:image/png;base64,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";