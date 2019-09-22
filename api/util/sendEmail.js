const { addBook, welcome, resetPassword } = require('./emails/');
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const sendToUser = (type, emailRecipient, subject, body) => {
  const from = { name: "Keen Pages", email: "hello@keenpages.com" };
  const msSubject = subject || type.subject;
  const msHtml = body || type.html;
  return new Promise((resolve, reject) => {
    const msg = {
      to: emailRecipient,
      from,
      subject: msSubject,
      html: msHtml,
      templateId: 'e2ce25c8-8ed9-409c-9551-0fbcc8efef0c'
    };
    sgMail.send(msg, (err, result) => err ? reject(err) : resolve(result));
  });
};

const getTo = user => ({
  name: `${user.profile.fName} ${user.profile.lName}`,
  email: user.email
});

module.exports = { 
  bookAdded: (data) => sendToUser(addBook(data.book, data.user), data.user.email),
  resetPass: (token, user) => sendToUser(resetPassword(token), { name: `${user.profile.first_name} ${user.profile.last_name}`, email: user.email }),
  register: (user) => sendToUser(welcome(user), user.email)
}
