// Figma Plugin API 전용. 목업 편집 재현을 위한 도우미이며 앱에 로드하지 않는다.
const created = [];
const vars = {};
const variableIds = { canvas:'6:5',surface:'6:6',ink:'6:7',muted:'6:8',line:'6:9',action:'6:10',brand:'6:11',tint:'6:12',soft:'6:13',green:'6:14',greenSoft:'6:15',blue:'6:16',blueSoft:'6:17',purple:'6:18',purpleSoft:'6:19',amber:'6:20',amberSoft:'6:21' };
for (const [k,id] of Object.entries(variableIds)) vars[k] = await figma.variables.getVariableByIdAsync('VariableID:'+id);
await Promise.all(['Regular','Medium','Bold'].map(style=>figma.loadFontAsync({family:'Noto Sans KR',style})));
await figma.loadFontAsync({family:'Inter',style:'Regular'});
const spaceVars={}; for(const [n,id]of Object.entries({4:22,8:23,12:24,16:25,20:26,24:27,32:28})) spaceVars[n]=await figma.variables.getVariableByIdAsync('VariableID:6:'+id);
const styles = { Display:'S:99c08d75a93ee6e7a43a0826a9e9cf178576592b,',Section:'S:9ad7dc9334b14e01bf2bb4e9269c14be68c0eff0,',Title:'S:01497efd954cbde2cf396ebffbfe31c87943de79,',Body:'S:24013e89931ce4a99f3142049c4b7f96d8d49e16,',Label:'S:4c6589591bc72a54a107eea91004f267316fb886,',Caption:'S:22af8b46e3ba43af56892a45ccedc7fd9cacee16,' };
function track(n) { created.push(n.id); return n; }
function paint(key) { return figma.variables.setBoundVariableForPaint({type:'SOLID',color:{r:0,g:0,b:0}},'color',vars[key]); }
function F(name,w,{axis='VERTICAL',fill=null,pad=0,gap=0,h=0,r=0}={}) {
  const f=track(figma.createAutoLayout(axis)); f.name=name; f.resize(w, h||1);
  f.primaryAxisSizingMode=axis==='HORIZONTAL'?'FIXED':h?'FIXED':'AUTO'; f.counterAxisSizingMode=axis==='HORIZONTAL'?(h?'FIXED':'AUTO'):'FIXED';
  f.paddingLeft=f.paddingRight=f.paddingTop=f.paddingBottom=pad; f.itemSpacing=gap;
  f.fills=fill?[paint(fill)]:[]; f.cornerRadius=r; f.clipsContent=false;
  if(spaceVars[gap]) f.setBoundVariable('itemSpacing', spaceVars[gap]);
  return f;
}
async function T(parent,name,content,w,role='Body',color='ink') {
  const t=track(figma.createText()); t.name=name;
  await t.setTextStyleIdAsync(styles[role]); t.characters=content;
  t.fills=[paint(color)]; parent.appendChild(t); t.resize(w,1); t.textAutoResize='HEIGHT'; return t;
}
function R(parent,name,w,h,fill,r=0) { const n=track(figma.createRectangle()); n.name=name; n.resize(w,h); n.fills=[paint(fill)];n.cornerRadius=r;parent.appendChild(n);return n; }
function grow(parent) { const f=F('Flexible space',1,{h:1});parent.appendChild(f);f.layoutSizingHorizontal='FILL';return f; }
function abs(parent,node,x,y) { parent.appendChild(node);node.layoutPositioning='ABSOLUTE';node.x=x;node.y=y;return node; }
const paths={search:'<circle cx="10.8" cy="10.8" r="6.5"/><path d="m16 16 4.5 4.5"/>',pin:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',heart:'<path d="M20.5 4.6a5.4 5.4 0 0 0-7.6 0L12 5.5l-.9-.9a5.4 5.4 0 0 0-7.6 7.6L12 21l8.5-8.8a5.4 5.4 0 0 0 0-7.6Z"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m7.5 12 3 3 6-6"/>',chat:'<path d="M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.6-5A9 9 0 1 1 21 11Z"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',chevron:'<path d="m7 9 5 5 5-5"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/>',map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16M15 5v16"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'};
function icon(parent,name,size=20,key='muted') {const hex={muted:'#667085',ink:'#18212F',action:'#CB461E',surface:'#FFFFFF'}[key]||'#667085';const n=track(figma.createNodeFromSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${hex}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.pin}</svg>`));n.name='Icon/'+name;n.resize(size,size);parent.appendChild(n);created.push(...n.findAll().map(c=>c.id));return n;}
async function chip(parent,label,key='soft',ink='muted',w=88) {const c=F('Badge/'+label,w,{axis:'HORIZONTAL',fill:key,pad:8,h:30,r:6});c.paddingTop=c.paddingBottom=4;c.counterAxisAlignItems='CENTER';parent.appendChild(c);await T(c,'Badge label',label,w-16,'Caption',ink);return c;}
async function fontReady(node){const fonts=new Map();for(const n of node.findAllWithCriteria({types:['TEXT']})){for(const s of n.getStyledTextSegments(['fontName']))fonts.set(s.fontName.family+'|'+s.fontName.style,s.fontName);}await Promise.all([...fonts.values()].map(f=>figma.loadFontAsync(f)));}
async function button(parent,label,w,type,masters) {
  const comp=await figma.getNodeByIdAsync(masters[type]);const n=track(comp.createInstance());await fontReady(n);parent.appendChild(n);n.resize(w,44);
  const t=n.findOne(x=>x.type==='TEXT');if(t){await t.setTextStyleIdAsync(styles.Label);t.characters=label;t.fills=[paint(type==='primary'?'surface':type==='ghost'?'action':'ink')];}
  created.push(...n.findAll().map(c=>c.id));return n;
}
async function search(parent,w,searchId,value='메뉴나 식당을 검색해보세요') {
  const comp=await figma.getNodeByIdAsync(searchId);const n=track(comp.createInstance());await fontReady(n);parent.appendChild(n);n.resize(w,48);
  const t=n.findOne(x=>x.type==='TEXT');if(t){await t.setTextStyleIdAsync(styles.Label);t.characters=value;t.fills=[paint('muted')];}
  created.push(...n.findAll().map(c=>c.id));return n;
}
