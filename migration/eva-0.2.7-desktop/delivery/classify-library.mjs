// Unchanged shipped library classification, including artifact import and Drive preview.
import {extension as WP,classifyLocalPreview} from "./classify.mjs";
const Upr=new Map([[`csv`,`csv`],[`docx`,`docx`],[`ipynb`,`ipynb`],[`pdf`,`pdf`],[`pptx`,`pptx`],[`tex`,`tex`],[`tsv`,`tsv`],[`xlsm`,`xlsx`],[`xlsx`,`xlsx`]]);
function KP(e){let t=WP(e);return t==null?null:Upr.get(t)??null}
const t=KP,r=e=>classifyLocalPreview(e)==="markdown",a=e=>WP(e)==="pdf",o=WP;
const h=/^external-gdrive:file:([A-Za-z0-9_-]+)$/u;
const g=new Map([[`application/vnd.google-apps.document`,`document`],[`application/vnd.google-apps.presentation`,`presentation`],[`application/vnd.google-apps.spreadsheet`,`spreadsheets`],[`application/vnd.openxmlformats-officedocument.presentationml.presentation`,`presentation`],[`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,`spreadsheets`],[`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,`document`]]);
const _=new Set([`c`,`conf`,`cpp`,`css`,`go`,`h`,`hpp`,`java`,`js`,`json`,`jsonl`,`jsx`,`log`,`py`,`rb`,`rs`,`sh`,`ts`,`tsx`,`txt`,`xml`,`yaml`,`yml`]);
const v=new Set([`application/javascript`,`application/json`,`application/ld+json`,`application/x-javascript`,`application/x-ndjson`,`application/xml`,`application/yaml`,`application/yml`,`text/javascript`]);
const y=new Map([[`application/x-ipynb+json`,`ipynb`],[`application/vnd.ms-excel.sheet.macroenabled.12`,`xlsx`],[`application/vnd.openxmlformats-officedocument.presentationml.presentation`,`pptx`],[`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,`xlsx`],[`application/vnd.openxmlformats-officedocument.wordprocessingml.document`,`docx`],[`text/csv`,`csv`],[`text/tab-separated-values`,`tsv`]]);
function s(e){if(e.library_artifact_type===`deep_research_report`)return`deep-research`;if(l(e))return`image`;if(u(e))return`pdf`;if(f(e)!=null)return`artifact`;if(d(e))return`markdown`;let t=o(e.file_name);return t===`html`||t===`htm`||m(e)===`text/html`?`html`:p(e)?`text`:`unsupported`}
function c({fileId:e,mimeType:t,sourceUrl:n}){let r=h.exec(e)?.[1],i=t?.split(`;`)[0]?.trim().toLowerCase(),a=i==null?void 0:g.get(i);if(r==null||a==null)return null;let o=`https://docs.google.com/${a}/d/${r}/preview`;if(n==null)return o;if(!URL.canParse(n))return null;let s=new URL(n),c=s.searchParams.get(`resourcekey`);return c==null?o:s.origin!==`https://docs.google.com`&&s.origin!==`https://drive.google.com`?null:`${o}?${new URLSearchParams({resourcekey:c})}`}
function l(e){let t=m(e);return e.library_file_category===`image`||t?.startsWith(`image/`)===!0}
function u(e){let t=m(e);return e.library_file_category===`pdf`||t===`application/pdf`||a(e.file_name)}
function d(e){return r(e.file_name)||m(e)===`text/markdown`}
function f(e){let n=m(e);if(n!=null){let e=y.get(n);if(e!=null)return e}let r=(e.file_extension==null?null:t(`file.${e.file_extension}`))??t(e.file_name);switch(r){case`csv`:case`docx`:case`ipynb`:case`pptx`:case`tsv`:case`xlsx`:return r;case`pdf`:case`tex`:case null:return null}}
function p(e){let t=m(e);if(e.library_file_category===`text`||t?.startsWith(`text/`)===!0||t!=null&&v.has(t))return!0;let n=o(e.file_name);return n!=null&&_.has(n)}
function m(e){return e.mime_type?.split(`;`)[0]?.trim().toLowerCase()||null}
export {s as classifyLibraryPreview,c as drivePreviewURL,f as artifactImportKind};
