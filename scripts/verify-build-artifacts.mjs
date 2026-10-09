import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const asar=require("../desktop/node_modules/@electron/asar");
const archive="desktop/release-workspace/win-unpacked/resources/app.asar";
const files=asar.listPackage(archive);
const main=asar.extractFile(archive,"main.js").toString();
const preload=asar.extractFile(archive,"preload.js").toString();
const html=await readFile("client/dist/index.html","utf8");
const asset=html.split('src="').find(value=>value.startsWith("/assets/index-"))?.split('"')[0];
console.log(JSON.stringify({
  offlineBundled:files.some(path=>path.endsWith("offline.html")),
  loginEntry:main.includes('APP_URL + "/app"'),
  desktopBridge:preload.includes("isDesktop: true"),
  initialJsBytes:asset?(await stat("client/dist"+asset)).size:null,
  installerBytes:(await stat("desktop/release-workspace/Kaikei-Setup.exe")).size,
},null,2));
