const path = require('path');
const rootPath = path.normalize(`${__dirname}/../../`);



module.exports = {
  db: process.env.DATABASE,
  rootPath,
  port: process.env.PORT,
  secret: process.env.SECRET
}