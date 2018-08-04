const fs = require('fs');
const path = require('path');

const readConfig = () => {
  const rawConfig = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
  return JSON.parse(rawConfig);
};

module.exports.readConfig = readConfig;

module.exports.writeConfig = (config) => {
  fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config), 'utf8');
};

module.exports.checkAuth = () => {
  return !!readConfig().access_token;
};

