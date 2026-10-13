// Execute the actual Cocos-emitted modules and helpers, not a second transpilation.
const fs=require('node:fs'),vm=require('node:vm');
module.exports=function loadBuilt(cc,platformGlobals={}){
 const modules=new Map(),instances=new Map([['cc',cc]]);
 const System={register(name,deps,declare){
  if(typeof name!=='string'){const wrapper=deps(()=>{},{});wrapper.execute();return;}
  modules.set(name,{deps,declare});
 }};
 const context=vm.createContext({System,console,...platformGlobals});
 for(const file of ['build/wechatgame/src/chunks/bundle.js','build/wechatgame/assets/main/index.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 return function load(name){
  if(instances.has(name))return instances.get(name);
  const {deps,declare}=modules.get(name),exports={};instances.set(name,exports);
  const declaration=declare((key,value)=>{if(typeof key==='object')Object.assign(exports,key);else exports[key]=value;return value;},{id:name});
  deps.forEach((dep,i)=>declaration.setters?.[i]?.(load(dep.startsWith('.')?new URL(dep,name).href:dep)));
  declaration.execute();return exports;
 };
};
