const pngFileStream = require('png-file-stream');
const GIFEncoder = require('gifencoder');
const fs = require('fs');

const { getArg, mustHava } = require('./argv');
mustHava(['--origin', '--target', '--height', '--width'], ['--transparent', '--delay', '--quality', '--repeat']);

const encoder = new GIFEncoder(Number(getArg('--width')), Number(getArg('--height')));
encoder.setTransparent(getArg('--transparent') || '#ffffff00')

pngFileStream(getArg('--origin'))
  .pipe(encoder.createWriteStream({ repeat: Number(getArg('--repeat') || 0), delay: Number(getArg('--delay') || 500), quality: Number(getArg('--quality') || 100) }))
  .pipe(fs.createWriteStream(getArg('--target')));