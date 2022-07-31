const nodemailer = require("nodemailer");
const EmailTemplate = require("email-templates");
const path = require("path");
const mailSettings = {
  service: "gmail",
  auth: {
    user: "DavidSparker0417@gmail.com",
    pass: "apawxyotyerpxwxt",
  },
};
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
      template: "esign-doc",
      message: {
        from: "ESIGN Team <no-reply@esign.com>",
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

class Email {
  constructor(from, settings) {
      this.settings = settings || mailSettings;
      this.options = {
          from: from || "ESIGN Team <no-reply@esign.com>",
          to: '',
          subject: '',
          text: '',
          html: ''
      };
  }
  send({to, subject, body}) {
      if(nodemailer && this.options) {
          let self = this;
          const transporter = nodemailer.createTransport(self.settings);

          self.options.to = to;
          self.options.subject = subject;
          self.options.text = body;

          if(transporter !== null) {
              return new Promise((resolve, reject) => {
                  transporter.sendMail(self.options, (error, info) => {
                      if(error) {
                          reject(Error('Failed'));
                      } else {
                          resolve('OK');
                      }
                  });
              });
          }
      }
  }
}
module.exports = { sendEmail, pwdResetEmailTemplate, Email };
