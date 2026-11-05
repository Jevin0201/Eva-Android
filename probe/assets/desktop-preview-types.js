var EvaDesktopPreviewTypes = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // migration/eva-0.2.7-desktop/delivery/entry.mjs
  var entry_exports = {};
  __export(entry_exports, {
    artifactImportKind: () => f,
    classifyLibraryPreview: () => s,
    classifyLocalPreview: () => IWa,
    drivePreviewURL: () => c,
    extension: () => WP,
    imageMode: () => bpr
  });

  // migration/eva-0.2.7-desktop/delivery/classify.mjs
  var Cpr = /* @__PURE__ */ new Set([`avif`, `bmp`, `gif`, `ico`, `jpeg`, `jpg`, `png`, `tif`, `tiff`, `webp`]);
  var wpr = /* @__PURE__ */ new Set([`markdown`, `md`, `mdown`, `mdx`, `mkd`]);
  var GWa = /* @__PURE__ */ new Set([`tif`, `tiff`]);
  var WWa = /* @__PURE__ */ new Set([`aac`, `flac`, `m4a`, `mp3`, `mp4a`, `oga`, `ogg`, `opus`, `wav`]);
  var iat = /\.html?$/i;
  function qit(e) {
    return iat.test(e);
  }
  var Vn = qit;
  function WP(e) {
    let t2 = e.toLowerCase(), n = Math.max(t2.lastIndexOf(`/`), t2.lastIndexOf(`\\`)), r2 = n >= 0 ? t2.slice(n + 1) : t2, i = r2.lastIndexOf(`.`);
    return i > 0 && i < r2.length - 1 ? r2.slice(i + 1) : null;
  }
  function bpr(e) {
    let t2 = WP(e);
    return t2 == null ? `none` : t2 === `svg` ? `toggle` : Cpr.has(t2) ? `always` : `none`;
  }
  function xpr(e) {
    return WP(e) === `pdf`;
  }
  function Spr(e) {
    let t2 = WP(e);
    return t2 != null && wpr.has(t2);
  }
  function zWa(e, t2) {
    let n = WP(e)?.replace(/ \(\d+\)$/u, ``);
    return (t2 == null || t2 === `image`) && n != null && GWa.has(n);
  }
  function VWa(e) {
    let t2 = WP(e);
    return t2 != null && WWa.has(t2);
  }
  function HWa(e) {
    let t2 = WP(e);
    return t2 === `mp4` || t2 === `ogv` || t2 === `webm`;
  }
  function IWa(e, t2) {
    let n = zWa(e, t2);
    return t2 === `image` && !n ? `image` : t2 === `pdf` ? `pdf` : (t2 == null || t2 === `audio`) && VWa(e) ? `audio` : (t2 == null || t2 === `video`) && HWa(e) ? `video` : t2 != null && t2 !== `text` ? null : t2 == null && !n && bpr(e) !== `none` ? `image` : Spr(e) ? `markdown` : Vn(e) ? `html` : t2 == null && xpr(e) ? `pdf` : null;
  }

  // migration/eva-0.2.7-desktop/delivery/classify-library.mjs
  var Upr = /* @__PURE__ */ new Map([[`csv`, `csv`], [`docx`, `docx`], [`ipynb`, `ipynb`], [`pdf`, `pdf`], [`pptx`, `pptx`], [`tex`, `tex`], [`tsv`, `tsv`], [`xlsm`, `xlsx`], [`xlsx`, `xlsx`]]);
  function KP(e) {
    let t2 = WP(e);
    return t2 == null ? null : Upr.get(t2) ?? null;
  }
  var t = KP;
  var r = (e) => IWa(e) === "markdown";
  var a = (e) => WP(e) === "pdf";
  var o = WP;
  var h = /^external-gdrive:file:([A-Za-z0-9_-]+)$/u;
  var g = /* @__PURE__ */ new Map([[`application/vnd.google-apps.document`, `document`], [`application/vnd.google-apps.presentation`, `presentation`], [`application/vnd.google-apps.spreadsheet`, `spreadsheets`], [`application/vnd.openxmlformats-officedocument.presentationml.presentation`, `presentation`], [`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `spreadsheets`], [`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `document`]]);
  var _ = /* @__PURE__ */ new Set([`c`, `conf`, `cpp`, `css`, `go`, `h`, `hpp`, `java`, `js`, `json`, `jsonl`, `jsx`, `log`, `py`, `rb`, `rs`, `sh`, `ts`, `tsx`, `txt`, `xml`, `yaml`, `yml`]);
  var v = /* @__PURE__ */ new Set([`application/javascript`, `application/json`, `application/ld+json`, `application/x-javascript`, `application/x-ndjson`, `application/xml`, `application/yaml`, `application/yml`, `text/javascript`]);
  var y = /* @__PURE__ */ new Map([[`application/x-ipynb+json`, `ipynb`], [`application/vnd.ms-excel.sheet.macroenabled.12`, `xlsx`], [`application/vnd.openxmlformats-officedocument.presentationml.presentation`, `pptx`], [`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `xlsx`], [`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `docx`], [`text/csv`, `csv`], [`text/tab-separated-values`, `tsv`]]);
  function s(e) {
    if (e.library_artifact_type === `deep_research_report`) return `deep-research`;
    if (l(e)) return `image`;
    if (u(e)) return `pdf`;
    if (f(e) != null) return `artifact`;
    if (d(e)) return `markdown`;
    let t2 = o(e.file_name);
    return t2 === `html` || t2 === `htm` || m(e) === `text/html` ? `html` : p(e) ? `text` : `unsupported`;
  }
  function c({ fileId: e, mimeType: t2, sourceUrl: n }) {
    let r2 = h.exec(e)?.[1], i = t2?.split(`;`)[0]?.trim().toLowerCase(), a2 = i == null ? void 0 : g.get(i);
    if (r2 == null || a2 == null) return null;
    let o2 = `https://docs.google.com/${a2}/d/${r2}/preview`;
    if (n == null) return o2;
    if (!URL.canParse(n)) return null;
    let s2 = new URL(n), c2 = s2.searchParams.get(`resourcekey`);
    return c2 == null ? o2 : s2.origin !== `https://docs.google.com` && s2.origin !== `https://drive.google.com` ? null : `${o2}?${new URLSearchParams({ resourcekey: c2 })}`;
  }
  function l(e) {
    let t2 = m(e);
    return e.library_file_category === `image` || t2?.startsWith(`image/`) === true;
  }
  function u(e) {
    let t2 = m(e);
    return e.library_file_category === `pdf` || t2 === `application/pdf` || a(e.file_name);
  }
  function d(e) {
    return r(e.file_name) || m(e) === `text/markdown`;
  }
  function f(e) {
    let n = m(e);
    if (n != null) {
      let e2 = y.get(n);
      if (e2 != null) return e2;
    }
    let r2 = (e.file_extension == null ? null : t(`file.${e.file_extension}`)) ?? t(e.file_name);
    switch (r2) {
      case `csv`:
      case `docx`:
      case `ipynb`:
      case `pptx`:
      case `tsv`:
      case `xlsx`:
        return r2;
      case `pdf`:
      case `tex`:
      case null:
        return null;
    }
  }
  function p(e) {
    let t2 = m(e);
    if (e.library_file_category === `text` || t2?.startsWith(`text/`) === true || t2 != null && v.has(t2)) return true;
    let n = o(e.file_name);
    return n != null && _.has(n);
  }
  function m(e) {
    return e.mime_type?.split(`;`)[0]?.trim().toLowerCase() || null;
  }
  return __toCommonJS(entry_exports);
})();
