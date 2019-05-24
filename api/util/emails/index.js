const signature = 'Thank you for using Keen Pages<br/><strong><small>Swole Engineer</small></strong>';
const notificationSetting = `<br><small>btw, you can edit how you receive these notifications in your Account settings.</small>`;
module.exports = {
  welcome: user => {
    const { profile: { first_name: name }} = user
    return ({
      subject: 'Welcome to Keen Pages',
      html: `Hi ${name || 'friend'}, thank you for joining Keen Pages, the quickest way to find the book(s) that have taught others what you want to learn. I hope you find it to be a useful resource.
      <br /><br />
      Feel free to add the books you've read and the topics they've helped you learn. This is all that's needed for Keen Pages to work.
      <br/><br />
      If there are no books for a topic you'd like to learn, feel free to ask a question. The site's users will then suggest a book that covers that topic.
      <br /><br />
      BTW, that's you too. You are now a site user, with the special privilege of suggesting books you've read to others looking to learn the topics you have.
      <br /><br/>
      ${signature}${notificationSetting}`
    })
  },
  resetPassword: {},
  pwResetSuccess: {},

  addBook: (book, user) => {}
}
