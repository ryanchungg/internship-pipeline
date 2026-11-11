import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
const [root, output] = process.argv.slice(2);
const read = (file) => readFileSync(join(root,file),'utf8');
const assets = {"/":read("ui/index.html"),"/style.css":read("ui/style.css"),"/app.js":read("ui/app.js")};
writeFileSync(output, 'const assets = '+JSON.stringify(assets)+';\n'+read('worker/index.js'));
