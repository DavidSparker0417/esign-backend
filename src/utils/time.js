function currentTime() {
  var moment = require('moment-timezone');
  return moment().tz("America/New_York").format("MM/DD/YYYY HH:mm:ss");
}

module.exports ={
  currentTime
}
