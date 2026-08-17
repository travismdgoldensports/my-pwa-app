importScripts('game-logic.js');

const evCache = new Map();

self.addEventListener('message', event=>{
  const {id,key,input} = event.data || {};
  if(!id || !key || !input) return;
  try{
    let values = evCache.get(key);
    if(!values){
      values = self.HUHELogic.blackjackActionEvs(input);
      evCache.set(key,values);
    }
    self.postMessage({id,key,values});
  }catch(error){
    self.postMessage({id,key,error:error?.message || String(error)});
  }
});
