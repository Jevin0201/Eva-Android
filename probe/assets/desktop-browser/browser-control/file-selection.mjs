import fs from 'node:fs';
import path from 'node:path';
// REA: official browser-service VB awaits DOM.setFileInputFiles for the captured
// chooser and does not read input.files afterwards. A site's synchronous reset
// must not turn a completed upload command into a false failure.
export async function selectInputFiles(input,files,setFiles){
 const metadata=files.map(file=>({name:path.basename(file),size:fs.statSync(file).size}));
 await setFiles();
 return {files:metadata,selectionConfirmed:true,verification:'file-chooser-command',uploadStatus:'not-verified'};
}
