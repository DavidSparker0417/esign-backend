const fs = require("fs");
const { sign } = require("pdf-signer");
const {
  getSignature,
} = require("pdf-signer/dist/signature/digital-signature.service");
const {
  replaceByteRangeInPdf,
} = require("pdf-signer/dist/pdf/node-signpdf/sign");
const signer = require("node-signpdf").default;
const { plainAddPlaceholder } = require("node-signpdf/dist/helpers");
const { PDFDocument, rgb, degrees, StandardFonts } = require("pdf-lib");
const PDFKitDoc = require("pdfkit");
const keyPath = "cert/pdf-signer.p12";
const password = "";

async function pdfEmbedId(pdfBuf) {
  let pdfDoc;
  const crypto = require("crypto");
  var hash = crypto.createHash("md5").update(pdfBuf).digest("hex");
  pdfDoc = await PDFDocument.load(pdfBuf);
  const pages = pdfDoc.getPages();

  for (let i in pages) {
    const curPage = pages[i];
    curPage.drawText(hash, {
      size: 10,
      x: 10,
      y: curPage.getHeight() - 20,
      width: 300,
      height: 50,
    });
  }
  resultPdf = await pdfDoc.save();
  return {resultPdf, hash};
}

async function pdfSign(inbuff) {
  const p12Buffer = fs.readFileSync("cert/pdf-signer.p12");
  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer: inbuff,
    reason: "ESIGN signature",
  });
  const signer = require("node-signpdf").default;
  const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, {
    passphrase: "",
  });
  return signedPdf;
}

async function signPdfByPdfSigner(pdfBuffer, email, drawData) {
  let pdfDoc;
  let curPage;

  pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();
  for (i in pages) {
    curPage = pages[i];
    let png;
    if (drawData.initial.coords[i]) {
      png = await pdfDoc.embedPng(drawData.initial.mark);
      curPage.drawImage(png, {
        x: drawData.initial.coords[i].x,
        y: drawData.initial.coords[i].y,
        width: drawData.initial.coords[i].width,
        height: drawData.initial.coords[i].height,
      });
    }
    if (drawData.sig.coords[i]) {
      png = await pdfDoc.embedPng(drawData.sig.mark);
      curPage.drawImage(png, {
        x: drawData.sig.coords[i].x,
        y: drawData.sig.coords[i].y,
        width: drawData.sig.coords[i].width,
        height: drawData.sig.coords[i].height,
      });
    }
    if (drawData.date.coords[i]) {
      curPage.drawText(drawData.date.mark, {
        size: 16,
        x: drawData.date.coords[i].x,
        y: drawData.date.coords[i].y,
        width: drawData.date.coords[i].width,
        height: drawData.date.coords[i].height,
      });
    }
  }

  let drawnPdf = await pdfDoc.save({ useObjectStreams: false });
  const resultPdf = await pdfSign(Buffer.from(drawnPdf));
  return resultPdf;
}

async function signPdfNodeSigner(pdfB64) {
  // const pdfBuffer = fs.readFileSync("pdfs/test.pdf");
  const pdfBuffer = Buffer.from(pdfB64, "base64");
  const p12Buffer = fs.readFileSync("cert/pdf-signer.p12");

  console.log("[SIGN PDF] pdfBuffer = ", pdfBuffer);
  console.log("[SIGN PDF] certBuffer = ", p12Buffer);

  const pdfWithPlaceholder = plainAddPlaceholder({
    pdfBuffer,
    reason: "i can do it",
  });
  console.log("[SIGN PDF] signing ... ", pdfWithPlaceholder);
  const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, {
    passphrase: "",
  });
  console.log("[DOC-SIGN] SIGNED PDF = ", signedPdf);
  fs.writeFileSync("pdfs/test-signed.pdf", signedPdf);
}

const { PDFNet } = require("@pdftron/pdfnet-node");
async function tronCertifyPdf(pdfBuffer) {
  const doc = await PDFNet.PDFDoc.createFromBuffer(pdfBuffer);
  doc.initSecurityHandler();

  console.log(
    "PDFDoc has " +
      ((await doc.hasSignatures()) ? "signatures" : "no signatures")
  );
  const page1 = await doc.getPage(1);

  // Create a text field that we can lock using the field permissions feature.
  // const annot1 = await PDFNet.TextWidget.create(doc, new PDFNet.Rect(143, 440, 350, 460), 'asdf_test_field');
  // await page1.annotPushBack(annot1);

  /* Create a new signature form field in the PDFDoc. The name argument is optional; leaving it empty causes it to be auto-generated. However, you may need the name for later. Acrobat doesn't show digsigfield in side panel if it's without a widget. Using a Rect with 0 width and 0 height, or setting the NoPrint/Invisible flags makes it invisible. */
  const certification_sig_field = await doc.createDigitalSignatureField(
    "ESIGN-SIG"
  );
  const widgetAnnot =
    await PDFNet.SignatureWidget.createWithDigitalSignatureField(
      doc,
      new PDFNet.Rect(143, 287, 219, 346),
      certification_sig_field
    );
  await page1.annotPushBack(widgetAnnot);

  // (OPTIONAL) Add an appearance to the signature field.
  // const img = await PDFNet.Image.createFromFile(doc, "pdfs/signature.png");
  // await widgetAnnot.createSignatureAppearance(img);

  // Prepare the document locking permission level. It will be applied upon document certification.
  console.log("Adding document permissions.");
  await certification_sig_field.setDocumentPermissions(
    PDFNet.DigitalSignatureField.DocumentPermissions
      .e_annotating_formfilling_signing_allowed
  );

  // Prepare to lock the text field that we created earlier.
  // console.log('Adding field permissions.');
  // var fields_to_lock = ['asdf_test_field'];
  // await certification_sig_field.setFieldPermissions(PDFNet.DigitalSignatureField.FieldPermissions.e_include, fields_to_lock);

  await certification_sig_field.certifyOnNextSave(keyPath, password);

  // (OPTIONAL) Add more information to the signature dictionary.
  await certification_sig_field.setLocation("Vancouver, BC");
  await certification_sig_field.setReason("[ESIGN] Document certification.");
  await certification_sig_field.setContactInfo("esign.cert.com");

  // Save the PDFDoc. Once the method below is called, PDFNet will also sign the document using the information provided.
  await doc.save("pdfs/test-signed.pdf", 0);
  const signedBuffer = await doc.saveMemoryBuffer(
    PDFNet.SDFDoc.SaveOptions.e_incremental
  );
  return signedBuffer;
}

async function tronSignPdf(pdfBuffer) {
  const doc = await PDFNet.PDFDoc.createFromBuffer(pdfBuffer);
  doc.initSecurityHandler();

  // Retrieve the unsigned approval signature field.
  const found_approval_field = await doc.getField("PDFTronApprovalSig");
  let found_approval_signature_digsig_field;
  console.log(
    "[TRON] creating digital signature field .... ",
    found_approval_field
  );
  // if (!found_approval_field)
  found_approval_signature_digsig_field = await doc.createDigitalSignatureField(
    "ESIGN-SIG"
  );
  // else
  //   found_approval_signature_digsig_field = await PDFNet.DigitalSignatureField.createFromField(found_approval_field);

  console.log("[TRON] making signature background image .... ");
  // (OPTIONAL) Add an appearance to the signature field.
  // const img = await PDFNet.Image.createFromFile(doc, "signature.png");
  // const found_approval_signature_widget = await PDFNet.SignatureWidget.createFromObj(await found_approval_field.getSDFObj());
  // await found_approval_signature_widget.createSignatureAppearance(img);

  console.log(
    "[TRON] digital signing .... ",
    found_approval_signature_digsig_field
  );
  // Prepare the signature and signature handler for signing.
  await found_approval_signature_digsig_field.signOnNextSave(
    "cert/pdf-signer.p12",
    ""
  );

  // The actual approval signing will be done during the following incremental save operation.
  await doc.save(
    "pdfs/test-signed.pdf",
    PDFNet.SDFDoc.SaveOptions.e_incremental
  );
  const signedBuffer = await doc.saveMemoryBuffer(
    PDFNet.SDFDoc.SaveOptions.e_incremental
  );
  return signedBuffer;
}

async function signPdfByTron(pdfB64) {
  const pdfBuffer = Buffer.from(pdfB64, "base64");
  const signedBuffer = await PDFNet.runWithCleanup(
    async () => await tronCertifyPdf(pdfBuffer),
    "demo:1656343671820:7a76a7ca0300000000d0ec73c708d709e8e3099aa750473517049254db"
  );
  // console.log("[TRON] Complete signature ", signedData);
  const signedB64 = Buffer.from(signedBuffer).toString("base64");
  console.log("[TRON] Complete signature ", signedB64.slice(0, 20));
  PDFNet.shutdown();
  return signedB64;
}

module.exports = {
  signPdfByPdfSigner,
  signPdfByTron,
  pdfSign,
  pdfEmbedId,
};
