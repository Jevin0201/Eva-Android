// Owned transport boundary. Validation, payload construction, retry and pagination
// come from retained official functions. The host supplies its authenticated client.
import {bindOriginalComponent as bindMcp} from './original-hosted-service.mjs';
import {bindOriginalComponent as bindArchive} from './original-archive-service.mjs';
import {bindOriginalComponent as bindMarketplace} from './original-marketplace-service.mjs';

export function createPluginAddServices(transport){
 for(const key of ['safeGet','safePost','headersForAccount'])if(typeof transport[key]!=='function')throw new TypeError('Missing authenticated plugin transport: '+key);
 const boundary={P:transport,K:transport.headersForAccount,R:transport.HttpError,
  G:class PluginConfigurationError extends Error{constructor(code){super(code);this.code=code}},
  // Error decoding is source-bound to the caller's original schema library.
  ...transport.originalErrorSchemaBindings};
 const mcp=bindMcp(boundary);
 const archive=bindArchive({o:transport,u:transport.HttpError,
  n:async()=>{if(typeof transport.uploadChatGptFileBytes!=='function')throw Error('Authenticated archive byte upload is unavailable');return {uploadChatGptFileBytes:transport.uploadChatGptFileBytes}},
  __vite__mapDeps:()=>[],s:{getInstance:()=>transport},c:transport.downloadBlob,r:transport.surfaceHeaderName});
 const market=bindMarketplace();
 return {
  validateTarget:mcp.qe,validateIcon:mcp.Ye,validateArchive:archive.d,
  normalizeMarketplace:market.t,addMarketplace:market.n,
  listTunnels:mcp.Je,discoverOAuth:mcp.Qe,hasOAuthClient:mcp.it,
  initialOAuthSettings:mcp.$e,oauthClientMode:mcp.et,
  tokenAuthMethods:mcp.tt,tokenAuthMethod:mcp.nt,oauthRedirects:mcp.at,
  createMcp:mcp.Xe,
  uploadArchive:archive.h,replaceArchive:archive.m,
  findCreatedPlugin:archive.p,isRefreshableFromSource:archive.f,
  downloadArchive:archive._,
  // Ze needs the pinned schema bindings, deliberately never guessed.
  classifyMcpError:transport.originalErrorSchemaBindings?mcp.Ze:undefined
 };
}
