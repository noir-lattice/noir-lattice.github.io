const pngFileStream = require('png-file-stream');
const GIFEncoder = require('gifencoder');
const fs = require('fs');

const { getArg, mustHava } = require('./argv');
mustHava(['--origin', '--target', '--height', '--width']);

const encoder = new GIFEncoder(Number(getArg('--width')), Number(getArg('--height')));

console.log(getArg('--origin'))
pngFileStream(getArg('--origin'))
  .pipe(encoder.createWriteStream({ repeat: -1, delay: Number(getArg('--delay') || 500), quality: 100 }))
  .pipe(fs.createWriteStream(getArg('--target')));