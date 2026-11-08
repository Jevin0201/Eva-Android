'use strict';
async function connect(register,isClosed=()=>false,{delay=ms=>new Promise(r=>setTimeout(r,ms)),attempts=4}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  if(isClosed())throw Error('标签页已关闭');
  try{return await register();}catch(error){if(isClosed()||attempt===attempts-1)throw error;await delay(100*2**attempt);}
 }
}
module.exports={connect};
