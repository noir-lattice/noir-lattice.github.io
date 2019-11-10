function getArg(key) {
  const i = process.argv.indexOf(key);
  return i >= 0 ? process.argv[i + 1] : null;
}

function mustHava(requriedArgv) {
  requriedArgv.forEach(arg => {
    if (!process.argv.includes(arg)) {
      throw new Error(`Lost basic arg '${arg}'`);
    }
  });
}

module.exports = { getArg, mustHava }