let argv = require('minimist')(process.argv.slice(2));
let Promise = require('bluebird');
let ejs = Promise.promisifyAll(require('ejs'));
let fs = Promise.promisifyAll(require('fs'));
let path = require('path');
let package = {id: argv.id, extension: argv.extension, hash: argv.hash, zipdestinationpath: argv.zipdestinationpath};
let app = {name: argv.appname, version: argv.appversion};
let dependencies = argv.dependency ? (Array.isArray(argv.dependency) ? argv.dependency : [argv.dependency]) : null;

let templatesDir = path.join(__dirname, '..', 'templates');
let targetDir = path.join(__dirname, '..');

if (!fs.existsSync(path.join(targetDir, 'tools'))){
  fs.mkdirSync(path.join(targetDir, 'tools'));
}

renderFile('tools/chocolateyinstall.ps1', package, app);
renderFile('tools/chocolateyuninstall.ps1', package, app);
renderFile('tools/download.ps1', package, app);
renderFile('tools/logger.ps1', package, app);
renderFile('package.nuspec', package, app, dependencies);

function renderFile(fileName, package, app, dependencies) {
  ejs.renderFileAsync(path.join(templatesDir, fileName), {package: package, app: app, dependencies: dependencies})
  .then(function (tpl) {
    fs.writeFileAsync(path.join(targetDir, fileName), tpl)
    .catch(function (error) {
      console.log(error);
    });
  })
  .catch(function (error) {
    console.log(error);
  });
}
