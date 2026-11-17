// figma-helpers.js 뒤에서 실행하는 목업 전용 구성. 서비스 코드와 분리한다.
const page=await figma.getNodeByIdAsync('6:2'); await figma.setCurrentPageAsync(page);
const masters={primary:'9:302',secondary:'9:307',ghost:'9:312'};
const logoMaster=await figma.getNodeByIdAsync('9:324');
const samples=[
 {name:'마라왕 명지점',category:'중식 · 마라탕',walk:'도보 3분 · 180m',level:'Lv.3 일반',key:'amber',soft:'amberSoft',desc:'혼자 주문하기 편한 1인 메뉴.\n피크 시간을 피하면 더 여유로워요.'},
 {name:'롯데리아 명지대학점',category:'패스트푸드 · 햄버거',walk:'도보 2분 · 101m',level:'Lv.1 입문',key:'green',soft:'greenSoft',desc:'키오스크로 편하게 주문하고,\n창가 자리에서 가볍게 한 끼.'},
 {name:'동대문엽기떡볶이 명지대점',category:'분식 · 떡볶이',walk:'도보 2분 · 99m',level:'Lv.4 도전',key:'purple',soft:'purpleSoft',desc:'양이 넉넉한 매운 떡볶이.\n혼자라면 1인 포장을 추천해요.'}
];
async function place(parent,compact,item,selected=false){
 const comp=await figma.getNodeByIdAsync(compact?'9:359':'9:339');const n=track(comp.createInstance());await fontReady(n);parent.appendChild(n);
 for(const [name,value]of [['Place name',item.name],['Category',item.category],['Walking distance',item.walk],['Badge label',item.level],['Solo dining description',item.desc]]){const t=n.findOne(x=>x.type==='TEXT'&&x.name===name);if(t)t.characters=value;}
 const pill=n.findOne(x=>x.type==='FRAME'&&x.name.startsWith('Badge/'));if(pill)pill.fills=[paint(item.soft)];const label=n.findOne(x=>x.type==='TEXT'&&x.name==='Badge label');if(label)label.fills=[paint(item.key)];
 if(selected){n.fills=[paint('tint')];n.strokes=[paint('action')];}
 created.push(...n.findAll().map(x=>x.id));return n;
}
async function header(root,w,mobile=false){
 const h=F('Header · one account entry',w,{axis:'HORIZONTAL',fill:'surface',pad:mobile?20:24,gap:16,h:mobile?64:72});h.paddingTop=h.paddingBottom=12;h.counterAxisAlignItems='CENTER';root.appendChild(h);
 const brand=F('Brand',mobile?148:160,{axis:'HORIZONTAL',gap:8,h:40});brand.counterAxisAlignItems='CENTER';h.appendChild(brand);const logo=track(logoMaster.createInstance());brand.appendChild(logo);created.push(...logo.findAll().map(n=>n.id));
 const bt=F('Brand text',104,{gap:0});brand.appendChild(bt);await T(bt,'Brand name','혼밥지도',104,'Title');
 if(!mobile)await T(h,'Campus','명지대 인문캠퍼스',220,'Label','muted');grow(h);
 if(mobile){const avatar=F('Account menu · 44px',44,{axis:'HORIZONTAL',fill:'tint',h:44,r:22});avatar.primaryAxisAlignItems='CENTER';avatar.counterAxisAlignItems='CENTER';h.appendChild(avatar);await T(avatar,'Initial','민',18,'Label','action');}
 else await button(h,'민준  ⌄',112,'secondary',masters);return h;
}
async function categories(parent,w,mobile=false){
 const row=F('Menu categories',w,{axis:'HORIZONTAL',gap:mobile?8:12,h:44});row.counterAxisAlignItems='CENTER';parent.appendChild(row);
 for(const [i,label]of (mobile?['전체','국밥','마라탕','돈까스']:['전체','국밥','라멘·우동','돈까스','햄버거','마라탕','김밥·도시락']).entries())await chip(row,label,i===0?'tint':'surface',i===0?'action':'muted',mobile?78:100);
}
async function levelFilters(parent,w){const row=F('Difficulty filters',w,{axis:'HORIZONTAL',gap:8,h:36});row.counterAxisAlignItems='CENTER';parent.appendChild(row);for(const [i,label]of ['전체','Lv.1','Lv.2','Lv.3','Lv.4','Lv.5'].entries())await chip(row,label,i===0?'ink':'surface',i===0?'surface':'muted',i===0?54:51);}
function geom(parent,name,x,y,w,h,key,r=0,angle=0){const n=R(parent,name,w,h,key,r);n.layoutPositioning='ABSOLUTE';n.x=x;n.y=y;n.rotation=angle;return n;}
async function pin(parent,x,y,label,level,key,selected=false){
 const p=F('Map pin/'+label,174,{axis:'HORIZONTAL',fill:selected?'action':'surface',pad:8,gap:8,h:44,r:22});p.counterAxisAlignItems='CENTER';p.strokes=[paint(selected?'action':'line')];abs(parent,p,x,y);
 const dot=F('Level badge',26,{axis:'HORIZONTAL',fill:selected?'surface':key,h:26,r:13});dot.primaryAxisAlignItems='CENTER';dot.counterAxisAlignItems='CENTER';p.appendChild(dot);await T(dot,'Level',String(level),10,'Caption',selected?'action':'surface');await T(p,'Place label',label,116,'Label',selected?'surface':'ink');return p;
}
async function vectorMap(parent,w,h,mobile=false){
 const m=F('Map · schematic vector example',w,{fill:'canvas',h});m.clipsContent=true;parent.appendChild(m);
 const sx=w/970,sy=h/888;
 for(const [x,y,bw,bh,k]of [[30,40,210,160,'soft'],[320,30,270,150,'soft'],[650,35,270,170,'greenSoft'],[30,300,170,210,'soft'],[310,290,240,200,'blueSoft'],[650,325,250,200,'soft'],[70,650,220,200,'greenSoft'],[390,640,190,200,'soft'],[700,680,190,170,'soft']])geom(m,'Neighborhood block',x*sx,y*sy,bw*sx,bh*sy,k,18);
 for(const y of [225,555])geom(m,'Street horizontal',-80,y*sy,w+180,28*sy,'surface',0,-8);
 for(const x of [260,600])geom(m,'Street vertical',x*sx,-60,28*sx,h+150,'surface',0,-11);
 const campus=F('Campus landmark',mobile?166:240,{fill:'blueSoft',pad:12,gap:4,r:12});abs(m,campus,340*sx,340*sy);await T(campus,'Campus title',mobile?'명지대학교':'명지대학교 인문캠퍼스',mobile?142:216,'Label','blue');await T(campus,'Campus label','거북골로 · 인문캠퍼스',mobile?142:216,'Caption','blue');
 await pin(m,350*sx,250*sy,'마라왕 명지점',3,'amber',true);await pin(m,620*sx,470*sy,'롯데리아',1,'green');await pin(m,130*sx,560*sy,'엽기떡볶이',4,'purple');
 if(!mobile){const note=F('Map disclaimer',300,{fill:'surface',pad:8,r:8});abs(m,note,24,h-42);await T(note,'Disclaimer','지도 배경은 목업용 벡터 예시입니다',284,'Caption','muted');}
 return m;
}
async function details(parent,w,mobile=false){
 const d=F('Selected place · detail',w,{fill:'surface',pad:20,gap:8,r:mobile?20:12});d.strokes=[paint('line')];
 if(mobile){const handle=F('Sheet handle row',w-40,{axis:'HORIZONTAL',h:8});handle.primaryAxisAlignItems='CENTER';d.appendChild(handle);R(handle,'Drag handle',36,4,'line',2);}
 const heading=F('Selected place heading',w-40,{axis:'HORIZONTAL',gap:8});heading.counterAxisAlignItems='CENTER';d.appendChild(heading);await T(heading,'Place name','마라왕 명지점',w-92,'Title');const close=F('Close · 44px',44,{axis:'HORIZONTAL',h:44});close.primaryAxisAlignItems='CENTER';close.counterAxisAlignItems='CENTER';heading.appendChild(close);icon(close,'close',20);
 await T(d,'Category and distance','중식 · 마라탕   ·   도보 3분 · 180m',w-40,'Label','muted');await chip(d,'Lv.3 일반','amberSoft','amber',90);await T(d,'Description','혼자 주문하기 편한 1인 메뉴.\n피크 시간을 피하면 더 여유로워요.',w-40,'Body');
 await T(d,'Address','서울 서대문구 거북골로 14',w-40,'Label','muted');
 const actions=F('Selected place actions',w-40,{axis:'HORIZONTAL',gap:8});d.appendChild(actions);await button(actions,'리뷰 작성',Math.round((w-48)*.42),'secondary',masters);await button(actions,'다녀왔어요',Math.round((w-48)*.58),'primary',masters);
 const links=F('External map links',w-40,{axis:'HORIZONTAL',gap:8});d.appendChild(links);await button(links,'카카오맵 ↗',Math.floor((w-48)/2),'ghost',masters);await button(links,'네이버 지도 ↗',Math.floor((w-48)/2),'ghost',masters);return d;
}
// A: existing list flow, with hierarchy decided before styling.
const a=F('A · 목록 중심 / PC',1360,{fill:'canvas',h:1040});page.appendChild(a);a.x=200;a.y=200;a.clipsContent=true;await header(a,1360);
const ac=F('Main content',1360,{pad:40,gap:24});a.appendChild(ac);ac.paddingLeft=ac.paddingRight=128;
await T(ac,'Page title','오늘은 어디서 혼밥할까요?',1104,'Section');
const sr=F('Search and random',1104,{axis:'HORIZONTAL',gap:12});ac.appendChild(sr);await search(sr,768,'9:318');await button(sr,'식당 찾기',136,'primary',masters);await button(sr,'랜덤 추천',136,'secondary',masters);
await categories(ac,1104);
const toolbar=F('Results toolbar',1104,{axis:'HORIZONTAL',gap:12,h:44});toolbar.counterAxisAlignItems='CENTER';ac.appendChild(toolbar);await T(toolbar,'Result count','가까운 식당 129곳',700,'Title');grow(toolbar);await button(toolbar,'난이도 전체 ⌄',160,'secondary',masters);await button(toolbar,'지도로 보기',136,'ghost',masters);
for(let row=0;row<2;row++){const grid=F('Result row '+(row+1),1104,{axis:'HORIZONTAL',gap:24});ac.appendChild(grid);for(let col=0;col<3;col++)await place(grid,false,samples[(row+col)%3]);}
// B: map-first desktop with a compact results sidebar.
const b=F('B · 지도 중심 / PC',1360,{fill:'surface',h:1040});page.appendChild(b);b.x=1640;b.y=200;b.clipsContent=true;await header(b,1360);
const body=F('Search sidebar and map',1360,{axis:'HORIZONTAL',h:968});b.appendChild(body);
const sidebar=F('Search results sidebar',390,{fill:'surface',pad:20,gap:16,h:968});body.appendChild(sidebar);await search(sidebar,350,'9:318','혼밥');await levelFilters(sidebar,350);await T(sidebar,'Results title','가까운 식당 129곳',350,'Title');
for(let i=0;i<3;i++)await place(sidebar,true,samples[i],i===0);
const map=await vectorMap(body,970,968);const control=F('Map controls',340,{axis:'HORIZONTAL',gap:8});abs(map,control,24,20);await button(control,'명지대 ⌄',136,'secondary',masters);await button(control,'전체보기',112,'secondary',masters);
const selected=await details(map,350);abs(map,selected,596,968-selected.height-24);
// Mobile list and map/detail share the same components.
const ml=F('Mobile · 목록',390,{fill:'surface',h:900});page.appendChild(ml);ml.x=200;ml.y=1340;ml.clipsContent=true;await header(ml,390,true);
const mc=F('Mobile content',390,{fill:'surface',pad:20,gap:16});ml.appendChild(mc);await T(mc,'Location','명지대 인문캠퍼스 주변',350,'Label','muted');await search(mc,350,'9:318');await categories(mc,350,true);await T(mc,'Results title','가까운 식당 129곳',350,'Title');await place(mc,true,samples[0],true);await place(mc,true,samples[1]);await place(mc,true,samples[2]);
const float=F('Map view shortcut',154,{axis:'HORIZONTAL',fill:'ink',pad:12,gap:8,h:48,r:24});float.counterAxisAlignItems='CENTER';float.primaryAxisAlignItems='CENTER';abs(ml,float,118,832);icon(float,'map',20,'surface');await T(float,'Shortcut label','지도로 보기',92,'Label','surface');
const mm=F('Mobile · 지도 상세',390,{fill:'canvas',h:900});page.appendChild(mm);mm.x=670;mm.y=1340;mm.clipsContent=true;await header(mm,390,true);const mMap=await vectorMap(mm,390,836,true);
const ms=F('Floating search',350,{fill:'surface',r:12});abs(mMap,ms,20,16);await search(ms,350,'9:318','혼밥');const sheet=await details(mMap,390,true);abs(mMap,sheet,0,836-sheet.height);
// Caption frames make the alternatives understandable without a chat transcript.
const notes=F('Design comparison notes',1360,{fill:'surface',pad:32,gap:16});page.appendChild(notes);notes.x=1140;notes.y=1340;
await T(notes,'Decision title','A와 B, 무엇이 다른가요?',1296,'Section');await T(notes,'A description','A · 기존 탐색 흐름을 유지합니다. 식당 카드가 먼저 보이고, 필요할 때 지도로 전환합니다.',1296,'Body');await T(notes,'B description','B · 지도와 목록을 함께 봅니다. 가까운 식당을 비교할 때 유리하지만 PC 레이아웃 변경이 필요합니다.',1296,'Body');await T(notes,'Common constraints','두 안 모두 기존 검색·찜·학교 인증·리뷰·체크인·성장 기록을 유지합니다. 자세한 작업은 선택한 식당 상세에 모읍니다.',1296,'Body','muted');await T(notes,'Mockup limits','식당명은 기존 데이터 참고, 거리·레벨·설명은 화면 비교용 예시입니다. 사진·별점·영업 상태·가격은 추가하지 않았습니다.',1296,'Caption','muted');await T(notes,'Map note','지도는 편집 가능한 벡터 예시이며 지리적 정확성이나 새로운 지도 기능을 의미하지 않습니다.',1296,'Caption','muted');
return {createdNodeIds:[...new Set(created)],screens:{a:a.id,b:b.id,mobileList:ml.id,mobileMap:mm.id,notes:notes.id},bounds:[a,b,ml,mm].map(n=>({id:n.id,w:n.width,h:n.height})),sheetHeight:sheet.height};
