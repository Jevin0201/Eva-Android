// Lazy local integration; opening Customize must not load the original UI at startup.
(()=>{
 let loading,host,target,epoch=0;
 const fail=error=>toast(error?.message||String(error),7000);
 async function draft(prompt){
  if(state.pendingSend||state.loadingThread)throw Error('当前消息正在处理，请稍后再创建插件');
  const cwd=state.thread?(state.thread.projectless?null:state.thread.cwd):state.cwd;
  startNewThread(cwd,{ephemeral:false});
  if(state.activeThreadId||state.pendingSend)throw Error('无法准备新聊天');
  els.input.value=prompt;state.composerMentions=[];renderComposer();autosize();globalThis.composerDrafts?.save();els.input.focus();
 }
 function recorder(){return {activeProject:null,availablePlugins:customizePlugins().map(plugin=>({plugin,marketplaceName:plugin.marketplace.name,displayName:customizeName(plugin)}))};}
 async function load(){
  if(host)return host;
  if(!loading)loading=(async()=>{
   await Promise.all([
    new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='native-plugin-add/host-adapter.css';link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('插件运行环境样式加载失败'));};document.head.append(link);}),
    new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href='native-plugin-add/controls.css';link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('插件控件样式加载失败'));};document.head.append(link);}),
    new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='native-plugin-add/bundle.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('插件控件加载失败'));};document.head.append(script);})]);
   host=EvaNativePluginAdd.createPluginAddHost({onError:fail,openExternal:value=>api.openExternal(typeof value==='string'?value:value.url||value.href),
    refresh:refreshCustomizationAfterMutation,
    addMarketplace:params=>api.localPluginAuthoring('addMarketplace',params),
    importArchive:file=>api.importPluginFile(file),createMcp:params=>api.localPluginAuthoring('createMcp',params),onMcpCreated:async result=>{await refreshCustomizationAfterMutation();toast(result.requiresAuthorization?'MCP 已保存到本地设置，仍需在 MCP 设置中完成服务器授权。':'MCP 已保存到本地设置。');if(result.reloadError)fail(new Error(result.reloadError));},
    recorder,openRecorder:draft,
    enablePlugin:async id=>{await api.call('config/value/write',{keyPath:'plugins.'+JSON.stringify(id)+'.enabled',value:true,mergeStrategy:'replace'});await refreshCustomizationAfterMutation();},
    installRecorder:async({plugin})=>{const params={pluginName:plugin.name,...(plugin.marketplace.path?{marketplacePath:plugin.marketplace.path}:{remoteMarketplaceName:plugin.marketplace.name})};await api.call('plugin/install',params);await refreshCustomizationAfterMutation();},
    createPlugin:async()=>{const creator=customizePlugins().find(p=>p.name==='plugin-creator'&&p.installed&&p.enabled);if(creator){await openPluginChat(creator,'帮我创建一个可在 Eva 本地安装的插件。');return;}await draft('帮我创建一个可在 Eva 本地安装的插件。先确认我需要连接的工具与功能，使用当前配置的模型完成插件目录和清单。');}
   });return host;
  })().catch(error=>{loading=null;throw error;});
  return loading;
 }
 globalThis.EvaPluginAddHost={mount(button){if(!button)return;const current=++epoch;
  // Replace the legacy button, so the original button is never nested inside it.
  const anchor=document.createElement('span');anchor.className='eva-native-plugin-add';anchor.dataset.pluginAddAnchor='';button.replaceWith(anchor);target=anchor;
  load().then(value=>{if(current===epoch&&target?.isConnected)value.mount(target);}).catch(fail);
 },detach(){epoch++;target=null;host?.detach();}};
})();
