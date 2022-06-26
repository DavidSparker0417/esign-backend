const nodemailer = require("nodemailer");
const EmailTemplate = require("email-templates");
const path = require("path");
const pwdResetEmailTemplate = (email, generatedLink) => {
  return `
  Reset Password
  Someone has just requested a password reset for the following account: ${email}
  If this was a mistake, just ignore this ${email} and nothing will happen.
  To reset your password, visit the following link: ${generatedLink}
  `
}

const sendEmail = async (email, subject, link) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "DavidSparker0417@gmail.com",
        pass: "apawxyotyerpxwxt",
      },
    });

    const templateDir = path.join(process.cwd(), "src", "templates", "email");
    console.log("[DAVID] sendEmail :: templateDir = ", templateDir);
    const emailTmp = new EmailTemplate({
      transport: transporter,
      send: true,
      preview: false,
      views: {
        options: {extension:"ejs"},
        root: templateDir
      },
    });
    await emailTmp.send({
      template: "password-reset",
      message: {
        from: "TFT Team <no-reply@thefanstogether.com>",
        to: email
      },
      locals: {
        email: email,
        link: link
      }
    });
    console.log("email sent sucessfully");
    return true;
  } catch (error) {
    console.log(error, "email not sent");
    return false;
  }
};

module.exports = { sendEmail, pwdResetEmailTemplate };
