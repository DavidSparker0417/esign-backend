const {signPdfByPdfSigner, signPdfByTron} = require("../utilities/pdf");

exports.create = async (req, res) => {
  const { pdfBuffer, signData } = req.body;
  try {
    // const signedB64 = await signPdfByTron(pdfBuffer);
    const signedB64 = await signPdfByPdfSigner(pdfBuffer, signData);
    console.log("[DOC SIGN] complete. response buffer = ", signedB64.slice(0, 20));
    res.send(signedB64);
  } catch (e) {
    console.log("[DOC SIGN] error : ", e);
    res.status(403).send({ message: e.message });
  }
};
