function getArg(key) {
  const i = process.argv.indexOf(key);
  return i >= 0 ? process.argv[i + 1] : null;
}

function mustHava(requriedArgv, moreArgv) {
  if (process.argv.indexOf('--help') >= 0) {
    console.log(`
      必须的参数有：
        ${requriedArgv.join(", ")}
      ${moreArgv ? `
      备选的参数要：
        ${moreArgv.join(", ")}
      ` : ''}
    `);
  };
  
  requriedArgv.forEach(arg => {
    if (!process.argv.includes(arg)) {
      throw new Error(`Lost basic arg '${arg}'`);
    }
  });
}

module.exports = { getArg, mustHava }