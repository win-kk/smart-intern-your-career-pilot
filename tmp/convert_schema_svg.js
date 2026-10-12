const sharp = require('C:/Users/kwink/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

sharp('D:/04_Downloads/SmartIntern_schema_exact_key_mapping.drawio (1).svg')
  .png({ compressionLevel: 9 })
  .toFile('D:/03_Projects/smart-intern/tmp/SmartIntern_schema_exact_key_mapping.png')
  .then(info => console.log(JSON.stringify(info)))
  .catch(error => { console.error(error); process.exit(1); });
