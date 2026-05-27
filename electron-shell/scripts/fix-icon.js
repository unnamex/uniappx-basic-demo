const fs = require('fs');
const pngToIco = require('png-to-ico').default;

pngToIco('f:/workProject/avpbc-pop/static/logo.png')
  .then(buf => {
    fs.writeFileSync('f:/workProject/avpbc-pop/electron-shell/icons/icon.ico', buf);
    console.log('Icon successfully converted with transparency preserved!');
  })
  .catch(err => {
    console.error('Failed to convert icon:', err);
  });
