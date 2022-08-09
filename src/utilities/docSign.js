const { Email, sendEmail } = require("../utils/email");
const { jwtGenerateToken } = require("../utils/jwt");
const { currentTime } = require("../utils/time");
const { utilGenerateID } = require("./hash");
const { pdfEmbedId, signPdfByPdfSigner } = require("./pdf");

const dapp_url = "https://esign-dapp.netlify.app";
let folders = {};

const addEvent = async(folder, who, behavior) => {
  const log = {
    when: currentTime(),
    who: who,
    behavior: behavior,
  }
  const mail = new Email();
  await mail.send({to: folder.agent, subject: "ESign Event", body: `${who} : ${behavior}`});
}

async function onDeliver(payload) {

  const pdfBuffer = Buffer.from(payload.documents[0].documentBase64, "base64");
  const { resultPdf, hash } = await pdfEmbedId(pdfBuffer);

  let coordinates;
  let auditTrail = {
    certificateOfCompletion: {
      headers: ["Certificate Of Completion", ""],
      rows: [],
    },
    folderOriginator: {
      headers: ["Folder Originator", ""],
      rows: [],
    },
    recordTracking: {
      headers: ["Record Tracking", "", "Time Stamps"],
      rows: [],
    },
    folderSummary: {
      headers: ["Folder Summary of Events", "Status", "Time Stamps"],
      rows: [],
    },
  };

  coordinates = JSON.parse(
    Buffer.from(payload.coordinateFile, "base64").toString()
  );

  const _signers = payload.recipients.signers;
  signers = new Array(_signers.length);
  _signers.map(async (s, i) => {
    console.log(`[${i}] : ${s.email}`);
    const token = jwtGenerateToken({folder: hash, id: i});
    const link = `${dapp_url}/app/doc-sign/?token=${token}`;
    console.log(s.email, link);
    await sendEmail(s.email, "Esign Document", link);
    signers[i] = {
      name: s.name,
      email: s.email,
      id: i,
      verified: false,
    };
    const sid = i + 1;
    const signerKey = `signer${sid}Log`;
    auditTrail[signerKey] = {
      headers: [
        { label: `Signer ${sid} Log` },
        {
          label: "",
          renderer: (value, indexColumn, indexRow, row, rectRow, rectCell) => {
            if (typeof value === "string") {
              return value;
            }
            const { x, y, width, height } = rectCell;
            auditPdfDoc.image(value.image, x, y, { height: height });
            return "";
          },
        },
        { label: "Time Stamps" },
      ],
      rows: [],
    };
    auditTrail[signerKey].rows.push(["Name", s.name, ""]);
    auditTrail[signerKey].rows.push(["Email", s.email, ""]);
    auditTrail[signerKey].rows.push(["Cell", `Signer ${sid} phone`, ""]);
    auditTrail[signerKey].rows.push(["Signed by link sent to", s.email, ""]);
  });

  let initialCount = 0;
  let sigCount = 0;
  let certPages = 0;
  let exsitsCerts = new Array(coordinates.pdfLength).fill(false);
  coordinates?.allSigners?.map((cs, i) => {
    cs.pages.map((p, pageNumber) => {
      if (p?.initialCoordinates) initialCount += p.initialCoordinates.length;
      if (p?.signatureCoordinates) {
        certPages++;
        sigCount += p.signatureCoordinates.length;
        exsitsCerts[pageNumber] = true;
      }
    });
  });
  auditTrail.certificateOfCompletion.rows.push(["folderId", hash]);
  auditTrail.certificateOfCompletion.rows.push([
    "subject",
    payload?.emailSubject,
  ]);
  auditTrail.certificateOfCompletion.rows.push(["Source", "Folder"]);
  auditTrail.certificateOfCompletion.rows.push([
    "Document Pages",
    coordinates.pdfLength,
  ]);
  auditTrail.certificateOfCompletion.rows.push(["Signatures", sigCount]);
  auditTrail.certificateOfCompletion.rows.push(["Initials", initialCount]);
  auditTrail.certificateOfCompletion.rows.push([
    "Certificate Pages",
    certPages,
  ]);
  auditTrail.certificateOfCompletion.rows.push(["Folder Stamping", "Enabled"]);
  auditTrail.certificateOfCompletion.rows.push(["AutoNav", "Enabled"]);

  auditTrail.folderOriginator.rows.push(["staus", "Complete"]);
  auditTrail.folderOriginator.rows.push([payload?.agentInfo?.OriginatorAddressline1, ""]);
  auditTrail.folderOriginator.rows.push([payload?.agentInfo?.OriginatorAddressline2, ""]);
  auditTrail.folderOriginator.rows.push(["52.124.34.134", ""]);
  auditTrail.folderOriginator.rows.push([payload?.agentInfo?.AgentName, ""]);
  auditTrail.folderOriginator.rows.push([payload?.agentInfo?.AgentEmail, ""]);

  auditTrail.recordTracking.rows.push(["Status", "Original", currentTime()]);
  auditTrail.recordTracking.rows.push(["Document Holder", "", ""]);
  auditTrail.recordTracking.rows.push(["Location: Self Custody", "", ""]);

  const curTime = currentTime();
  auditTrail.folderSummary.rows.push([
    "FolderSent",
    "Hashed/encrypted",
    curTime,
  ]);
  auditTrail.folderSummary.rows.push([
    "Certified Delivered",
    "Security Check Passed",
    curTime,
  ]);
  auditTrail.folderSummary.rows.push([
    "Signing Complete",
    "Security Check Passed",
    curTime,
  ]);
  auditTrail.folderSummary.rows.push([
    "Completed",
    "Security Check Passed",
    curTime,
  ]);

  folders[hash] = {
    payload,
    coordinates,
    pdfBuffer: resultPdf,
    auditTrail,
    agent : payload?.agentInfo?.AgentEmail,
    signers
  };
  await addEvent(folders[hash], "ESIGN Team", "document delivered");
}

function getFolderAndSigner(hash, id) {
  const folder = folders[hash];
  if (!folder || !folder?.signers[id])
    return null;
  return {folder, signer: folder.signers[id]};
}
async function onRespPayload(hash, id) {
  const fs = getFolderAndSigner(hash, id);
  if (fs === null)
    return null;
  const {folder, signer} = fs;
  console.log(`Sending payload to ${signer.name} ...`, signer);
  if (signer?.verified === true) {
    await addEvent(folder, signer.name, "viewed contract");
    return {
      payload: folder.payload, 
      coordinates: folder.coordinates, 
      id: signer.id
    };
  }
  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  folders[hash].auditTrail[signerKey].rows.push(["Viewed", "", curTime]);
  return "Unauthorized";
}

async function onAuth(hash, id) {
  const fs = getFolderAndSigner(hash, id);
  if (fs === null)
    return null;
  let code = "";
  for(let n = 0; n < 6; n ++) {
    const rnd = Math.floor(Math.random()*10);
    code = code + rnd.toString();
  }
  console.log(`[${folders[hash].signers[id].name}] Generated verification code : `, code);
  folders[hash].signers[id].code = code;
  return code;
}

async function onVerify(hash, id, ip, code) {
  const fs = getFolderAndSigner(hash, id);
  if (fs === null)
    return "Invalid token!";
  const {folder, signer} = fs;
  
  if (code !== signer.code)
    return "Invalid verification code!";

  folders[hash].signers[id].verified = true;
  folders[hash].signers[id].ipAddr = ip;

  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  folders[hash].auditTrail[signerKey].rows.push(["Authentication Level", "Email", curTime]);
  folders[hash].auditTrail[signerKey].rows.push(["Using IP Address", ip, ""]);
  await addEvent(folder, signer.name, `successfully verified(${ip})`);
  console.log(`[${signer.name}] Successfully veified.`);
  return true;
}

async function onAdopt(hash, id, ersdId) {
  const fs = getFolderAndSigner(hash, id);
  if (fs === null)
    return "Invalid token!";
  const {signer} = fs;
  
  console.log(`${signer.name} accepted ERSD.`);
  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  folders[hash].auditTrail[signerKey].rows.push(["Electronic Records and Signature Disclosure", "Accepted", curTime]);
  folders[hash].auditTrail[signerKey].rows.push(["ERSD ID", ersdId, curTime]);
  return true;
}

function isAllsigned(folder) {
  let i;
  for(i in folder.signers) {
    s = folder.signers[i];
    if (!s.signed)
      return false;
  }
  return true;
}

async function onSign(hash, id, drawData, host, device) {
  const fs = getFolderAndSigner(hash, id);
  if (fs === null)
    return "Invalid token!";
  const {folder, signer} = fs;

  const gPdfBuffer = await signPdfByPdfSigner(folder.pdfBuffer, drawData);
  folders[hash].pdfBuffer = gPdfBuffer;
  const resPdf = Buffer.from(gPdfBuffer).toString("base64");
  console.log(`[${signer.email}] is signing ...`);
  folders[hash].signers[id].signed = true;

  const signerKey = `signer${id+1}Log`;
  const curTime = currentTime();
  folders[hash].auditTrail[signerKey].rows.push([
    "Image Of Signature", 
    {
      image: drawData.sig.mark,
      id: utilGenerateID(drawData.sig.mark)
    },
    ""
  ]);
  folders[hash].auditTrail[signerKey].rows.push([
    "", 
    utilGenerateID(drawData.sig.mark),
    ""
  ]);
  folders[hash].auditTrail[signerKey].rows.push([
    "Image Of Initial", 
    {
      image: drawData.initial.mark,
      id: utilGenerateID(drawData.initial.mark)
    },
    ""
  ]);
  folders[hash].auditTrail[signerKey].rows.push([
    "", 
    utilGenerateID(drawData.initial.mark),
    ""
  ]);
  
  let devType;
  if (!device)
    devType = "unknown";
  else if (device?.type === "desktop")
    devType = "desktop";
  else {
    devType = device.name;
    if (devType == "")
      devType = device.type;
  }
  folders[hash].auditTrail[signerKey].rows.push([
    "Signed using mobile",
    `${devType}`,
    "",
  ]);
  folders[hash].auditTrail[signerKey].rows.push(["Signed", "", curTime]);
  
  if (isAllsigned(folder) === true) {
    console.log("++++++++++++++ All signers finished to sign! +++++++++");
    for(let i = 0; i < folder.signers.length; i ++) {
      const s = folder.signers[i];
      const mail = new Email();
      const token = jwtGenerateToken({folder: hash, id: i, download: true});
      const link = "https://" 
        + host 
        + `/api/doc-sign/download?token=${token}`;
      console.log(link);
      await mail.send({to: s.email, subject: "All are signed!", body: `Please download result from ${link}`});
    }
  }
  await addEvent(folder, signers[id].name, "signed");
  return {auditTrail: folder.auditTrail, signedPdf: resPdf};
}

async function onDownload(hash, id) {
  const fs = getFolderAndSigner(hash, id);
  if (fs === null)
    return "Invalid token!";
  const {folder, signer} = fs;
  console.log(`${signer.name} downloading result ...`);
  const signerKey = `signer${id+1}Log`;
  folders[hash].auditTrail[signerKey].rows.push(["Sent", "", currentTime()]);
  auditPdf = await makeAuditTrailPdf(folder);
  return {auditPdf, signedPdf: folder.pdfBuffer};
}

const makeAuditTrailPdf = (folder)=> new Promise(async(resolve, reject) => {
  const stream = require("../utilities/stream");
  const PDFDocument = require("pdfkit-table");
  auditPdfDoc = new PDFDocument({ margin: 30});
  let writeStream = new stream.WritableBufferStream();
  
  auditPdfDoc.pipe(writeStream);
  await auditPdfDoc.table(folder.auditTrail.certificateOfCompletion);
  await auditPdfDoc.table(folder.auditTrail.folderOriginator);
  await auditPdfDoc.table(folder.auditTrail.recordTracking);
  await auditPdfDoc.table(folder.auditTrail.folderSummary);
  
  for(let i=0; i < folder.signers.length; i ++) {
    if (i % 2 == 0)
      await auditPdfDoc.addPage();
    const id = i + 1;
    const signerKey = `signer${id}Log`;
    await auditPdfDoc.table(folder.auditTrail[signerKey]);
  }
  auditPdfDoc.end();
  writeStream.on("finish", () => resolve(writeStream.toBuffer()));
});


module.exports = {
  onDeliver,
  onRespPayload,
  onAuth,
  onVerify,
  onAdopt,
  onSign,
  onDownload
}