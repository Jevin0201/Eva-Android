const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const context = vm.createContext({URL});
vm.runInContext(fs.readFileSync('probe/assets/desktop-preview-types.js','utf8'), context);
const types = context.EvaDesktopPreviewTypes;
for (const [name,kind] of [['photo.AVIF','image'],['file.svg','image'],['doc.markdown','markdown'],['page.htm','html'],['sound.opus','audio'],['clip.webm','video'],['C:\\docs\\file.PDF','pdf'],['notes.ipynb',null],['script.js',null]]) {
 assert.equal(types.classifyLocalPreview(name),kind,name);
}
for (const [name,kind] of [['notes.ipynb','ipynb'],['book.xlsm','xlsx'],['file.pptx','pptx'],['table.tsv','tsv']]) {
 assert.equal(types.artifactImportKind({file_name:name}),kind,name);
}
assert.equal(types.classifyLibraryPreview({file_name:'script.py',mime_type:'text/plain'}),'text');
assert.equal(types.drivePreviewURL({fileId:'external-gdrive:file:abc',mimeType:'application/vnd.google-apps.document'}),'https://docs.google.com/document/d/abc/preview');
assert.equal(types.drivePreviewURL({fileId:'external-gdrive:file:abc',mimeType:'application/vnd.google-apps.document',sourceUrl:'https://evil.example/?resourcekey=x'}),null);
console.log('PASS original desktop classifier local/library/Notebook/Office/media/windows paths and Drive origin checks');
