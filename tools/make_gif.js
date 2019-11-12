const pngFileStream = require('png-file-stream');
const GIFEncoder = require('gifencoder');
const fs = require('fs');
const encoder = new GIFEncoder(2062, 1378);

pngFileStream('source/_drafts/聊聊jvm/vmstack_?.png')
  .pipe(encoder.createWriteStream({ repeat: -1, delay: 500, quality: 60 }))
  .pipe(fs.createWriteStream('myanimated.gif'));