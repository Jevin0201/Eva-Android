const fs=require('fs'),path=require('path');
const {chromium}=require('playwright-core');
function launchOptions(){const candidates=[process.env.EVA_TEST_BROWSER,process.env.PROGRAMFILES&&path.join(process.env.PROGRAMFILES,'Google/Chrome/Application/chrome.exe'),process.env['PROGRAMFILES(X86)']&&path.join(process.env['PROGRAMFILES(X86)'],'Microsoft/Edge/Application/msedge.exe'),'/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);const executablePath=candidates.find(p=>fs.existsSync(p));if(!executablePath)throw Error('Set EVA_TEST_BROWSER to your Chrome/Edge executable');return {executablePath,headless:true}}
module.exports={chromium,launchOptions};
