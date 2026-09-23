const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const DEG=180/Math.PI,ART_ASPECT=2/3;
const sourceToBody=([x,y])=>({x:(x/1024-.14)/.75-.5,y:((1-y/1536)-.043)/.75-.5});
// Measured centers of the exposed straight barrel on each 1024×1536 sprite.
// Nominal pose names are artist targets; measured angles deliberately retain their actual values.
export const OPERATOR_AIM_POSES=Object.freeze([
 {angle:30,barrelRootPx:[808,321],muzzlePx:[899,261]},
 {angle:45,barrelRootPx:[820,156],muzzlePx:[931,49]},
 {angle:60,barrelRootPx:[739,137],muzzlePx:[815,29]},
 {angle:75,barrelRootPx:[673,159],muzzlePx:[712,25]},
].map(p=>Object.freeze({...p,root:Object.freeze(sourceToBody(p.barrelRootPx)),tip:Object.freeze(sourceToBody(p.muzzlePx)),measuredAngle:Math.atan2(p.barrelRootPx[1]-p.muzzlePx[1],p.muzzlePx[0]-p.barrelRootPx[0])*DEG})));
const LEGACY_POSE={angle:30,measuredAngle:22.33,root:{x:868/1024-.5,y:.5-137/1536},tip:{x:980/1024-.5,y:.5-91/1536}};
export const SQUAD_ART_DEFS=Object.freeze({
 ember:Object.freeze({id:'ember',kind:'rocket',root:Object.freeze(sourceToBody([789,337])),tip:Object.freeze(sourceToBody([948,252])),color:0xedb075,recoil:1.8,mask:{u0:.47,u1:.63,v0:.60,v1:.82}}),
 volt:Object.freeze({id:'volt',kind:'gatling',root:Object.freeze(sourceToBody([725,444])),tip:Object.freeze(sourceToBody([940,316])),color:0x8ccbe8,recoil:.58,mask:{u0:.49,u1:.65,v0:.46,v1:.70}}),
});

/** A deterministic layered response, driven by real shots rather than a looping body bob. */
export function createOperatorMotion(){
 let lastShot=0,impulses=[],exposure=0,aimLift=0;
 let current={exposure:0,gun:0,hips:0,hair:0,breath:0,aimLift:0,reloadMix:0,insertMix:0,reloadStage:'ready'};
 return{
  update(dt,time,state={}){
   dt=Math.max(0,Math.min(Number.isFinite(dt)?dt:0,1));
   const serial=state.shots??0;
   if(serial<lastShot)impulses=[];
   if(serial>lastShot)impulses.push(0);
   lastShot=serial;impulses=impulses.map(age=>age+dt).filter(age=>age<1.1);
   const sum=fn=>impulses.reduce((n,age)=>n+fn(age),0),limit=n=>Math.max(-1.4,Math.min(1.4,n));
   exposure+=(Number(!!state.exposed)-exposure)*(1-Math.exp(-dt*12));
   const aimTarget=Math.max(-.065,Math.min(.07,((state.aimY??3)-3)*.018));
   aimLift+=(aimTarget-aimLift)*(1-Math.exp(-dt*14));
   const p=Math.max(0,Math.min(1,state.reloadProgress??0)),reloading=!!state.reloading;
   const reloadMix=reloading?smooth(0,.12,p)*(1-smooth(.82,1,p)):0;
   const insertMix=smooth(.39,.58,p);
   const reloadStage=!reloading?'ready':p<.16?'lower':p<.43?'remove':p<.68?'insert':p<.86?'rack':'raise';
   current={exposure,aimLift,gun:limit(sum(a=>Math.exp(-a*20)*(1-Math.exp(-a*120)))),
    hips:limit(sum(a=>Math.exp(-a*9)*Math.sin(a*24))),hair:limit(sum(a=>Math.exp(-a*5)*Math.sin(a*13))),
    breath:Math.sin(time*1.6)*.0017,reloadMix,insertMix,reloadStage,reloadProgress:p};
   return Object.freeze({...current});
  },getState:()=>Object.freeze({...current})
 };
}

/** UV-space skinning keeps boots planted, carries recoil through shoulder/waist, and settles the ponytail later. */
export function deformOperatorPoint(x,y,motion,aim=null){
 const u=x+.5,v=y+.5,m=motion;
 const upper=smooth(.56,.8,v),weapon=smooth(.43,.64,u)*smooth(.71,.88,v);
 const pivotX=.50,pivotY=.78,angle=(m.aimLift??0)*upper-(m.gun??0)*.029*upper;
 const cs=Math.cos(angle),sn=Math.sin(angle),dx=u-pivotX,dy=v-pivotY;
 let nx=pivotX+dx*cs-dy*sn,ny=pivotY+dx*sn+dy*cs;
 nx-=(m.gun??0)*(.021*upper+.012*weapon);ny+=(m.gun??0)*.008*weapon;
 const hip=Math.exp(-(((v-.585)/.115)**2))*smooth(.12,.35,u)*(1-smooth(.72,.9,u));
 nx+=(m.hips??0)*.017*hip;ny+=(m.hips??0)*.007*hip;
 nx+=(u-.48)*(m.hips??0)*.012*hip;
 const hair=(1-smooth(.35,.49,u))*smooth(.57,.7,v)*(1-smooth(.88,.98,v));
 nx+=(m.hair??0)*.026*hair;ny-=(m.hair??0)*.007*hair;
 ny+=(m.breath??0)*smooth(.12,.7,v);
 // A subtle wrist pull and bolt-rack impulse connect the two painted magazine key poses.
 const hand=smooth(.54,.68,u)*(1-smooth(.79,.94,u))*smooth(.6,.75,v)*(1-smooth(.88,.96,v));
 const rack=(m.reloadStage==='rack'?Math.sin((m.reloadProgress-.68)/.18*Math.PI):0)*(m.reloadMix??0);
 nx-=rack*.022*hand;ny-=rack*.008*hand;
 nx-=.5;ny-=.5;
 if(aim){
  // Only the arm/weapon region rotates. Full weight includes both measured barrel anchors.
  const mask=aim.mask||{u0:.48,u1:.64,v0:.63,v1:.83};
  const weight=smooth(mask.u0,mask.u1,u)*smooth(mask.v0,mask.v1,v);
  const px=(nx-aim.pivot.x)*ART_ASPECT,py=ny-aim.pivot.y;
  const along=px*aim.axis.x+py*aim.axis.y,across=-px*aim.axis.y+py*aim.axis.x;
  const targetX=(along*aim.lengthScale)*aim.direction.x-across*aim.direction.y;
  const targetY=(along*aim.lengthScale)*aim.direction.y+across*aim.direction.x;
  nx+=(aim.pivot.x+targetX/ART_ASPECT-nx)*weight;ny+=(aim.pivot.y+targetY-ny)*weight;
 }
 return{x:nx,y:ny};
}

/** An original frontal, over-the-shoulder ruined-city firing range. */
export function createBattleScene(T, group) {
 const root=new T.Group();root.name='ruined-city-cover-scene';group.add(root);
 const materials=[],geometries=[],textures=[];
 const mat=(color,metalness=.1,roughness=.8)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness});materials.push(m);return m;};
 const basic=(color,opacity=1)=>{const m=new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1});materials.push(m);return m;};
 const geo=g=>{geometries.push(g);return g;},box=geo(new T.BoxGeometry(1,1,1)),sphere=geo(new T.SphereGeometry(1,12,8)),cylinder=geo(new T.CylinderGeometry(1,1,1,10)),plane=geo(new T.PlaneGeometry(1,1));
 const concrete=mat(0x696c63),edge=mat(0x343f3e),rust=mat(0x704e3d,.65),sand=mat(0x8b8270),black=mat(0x151e25,.4),gunmetal=mat(0x36484d,.7),skin=mat(0xddac97),hair=mat(0xe2e4e3),suit=mat(0x293745,.35),trim=mat(0x8e4441,.45),cyan=basic(0x8cced3),white=basic(0xd8dbc9),glass=basic(0x4a6d73,.65),haze=basic(0x9caaa0,.15);
 function mesh(g,m,p,x=0,y=0,z=0,sx=1,sy=sx,sz=sx){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);p.add(o);return o;}
 function block(p,m,x,y,z,w,h,d){return mesh(box,m,p,x,y,z,w,h,d);}
 function poly(p,m,coords,z){const vertices=[];for(let i=1;i<coords.length-1;i++)vertices.push(coords[0][0],coords[0][1],z,coords[i][0],coords[i][1],z,coords[i+1][0],coords[i+1][1],z);const g=geo(new T.BufferGeometry());g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return mesh(g,m,p);}
 // Painted, chipped surfaces keep the foreground cover readable against the city artwork.
 function wornSurface(kind){
  if(typeof document==='undefined')return mat(kind==='concrete'?0x77796b:kind==='fabric'?0x9b9479:0x736356,.35);
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
  let seed=kind==='metal'?13:kind==='fabric'?31:47;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  ctx.fillStyle=kind==='metal'?'#746759':kind==='fabric'?'#aaa185':'#939486';ctx.fillRect(0,0,512,256);
  for(let i=0;i<6000;i++){
   const x=random()*512,y=random()*256,v=random(),size=kind==='fabric'?1:1+random()*3;
   ctx.fillStyle=v>.52?`rgba(220,218,197,${.025+random()*.13})`:`rgba(19,28,26,${.025+random()*.2})`;
   ctx.fillRect(x,y,size,size*.65);
  }
  for(let i=0;i<40;i++){
   const x=random()*512,y=random()*256,r=8+random()*46,g=ctx.createRadialGradient(x,y,0,x,y,r);
   g.addColorStop(0,kind==='metal'?'rgba(65,32,17,.3)':'rgba(39,46,37,.17)');g.addColorStop(1,'rgba(30,35,29,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  if(kind==='metal'){
   ctx.lineWidth=3;ctx.strokeStyle='#353b37';ctx.strokeRect(8,8,496,240);ctx.lineWidth=1;ctx.strokeStyle='#c2b496';ctx.strokeRect(11,11,490,234);
   for(let i=0;i<95;i++){
    const x=random()*512,y=random()*256,l=3+random()*26;ctx.strokeStyle=i%3?'rgba(35,41,38,.7)':'rgba(215,204,171,.65)';ctx.lineWidth=1+random()*2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+l,y+random()*8-4);ctx.stroke();
   }
   for(const x of[22,256,490])for(const y of[22,234]){
    ctx.fillStyle='#262e2a';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c1b89d';ctx.beginPath();ctx.arc(x-1,y-1,2,0,Math.PI*2);ctx.fill();
   }
   const shade=ctx.createLinearGradient(0,0,0,256);shade.addColorStop(0,'rgba(238,229,202,.18)');shade.addColorStop(.3,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(11,20,19,.35)');ctx.fillStyle=shade;ctx.fillRect(0,0,512,256);
  }else if(kind==='concrete'){
   for(let i=0;i<13;i++){
    let x=random()*512,y=random()*256;ctx.strokeStyle='rgba(35,43,37,.48)';ctx.lineWidth=.7+random()*1.5;ctx.beginPath();ctx.moveTo(x,y);for(let j=0;j<4;j++){x+=random()*25-8;y+=random()*22-2;ctx.lineTo(x,y);}ctx.stroke();
   }
   for(let i=0;i<20;i++){const x=random()*512;ctx.fillStyle='rgba(31,43,36,.08)';ctx.fillRect(x,random()*40,2+random()*9,80+random()*170);}
   ctx.fillStyle='rgba(229,224,194,.38)';ctx.fillRect(0,0,512,5);ctx.fillStyle='rgba(30,42,37,.38)';ctx.fillRect(0,236,512,20);
  }else{
   ctx.lineWidth=1;ctx.strokeStyle='rgba(49,48,36,.2)';for(let x=0;x<512;x+=5){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}for(let y=0;y<256;y+=5){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
   ctx.setLineDash([4,4]);ctx.lineWidth=2;ctx.strokeStyle='#5c5d49';ctx.strokeRect(10,10,492,236);ctx.setLineDash([]);
  }
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;textures.push(map);
  const m=new T.MeshStandardMaterial({map,color:0xffffff,roughness:kind==='metal'?.84:1,metalness:kind==='metal'?.25:0,bumpMap:map,bumpScale:kind==='concrete'?.075:.035});materials.push(m);return m;
 }
 const wornMetal=wornSurface('metal'),wornConcrete=wornSurface('concrete'),wornFabric=wornSurface('fabric');
 const city=new T.Group();root.add(city);
 mesh(plane,basic(0x8caaa8),city,0,2,-9,15,24,1);
 const distant=mat(0x667b78),window=basic(0x536762),ground=mat(0x4b544c),road=mat(0x323e3c);
 // Skyline and fractured concrete facades converge around a distant avenue.
 for(let i=0;i<22;i++){
  const x=-7+i*.68,h=2.5+((i*7)%13)*.33,y=5.1+h/2,z=-7+(i%3)*.2;
  block(city,distant,x,y,z,.62,h,.3);
  if(i%3!==0)for(let j=0;j<Math.floor(h/.5);j++)block(city,window,x,y-h/2+.25+j*.49,z+.17,.37,.16,.015);
 }
 poly(city,ground,[[-7,-8],[7,-8],[7,2.5],[.4,4.6],[-.4,4.6],[-7,2.5]],-6.7);
 poly(city,road,[[-4.7,-7.5],[4.7,-7.5],[.5,4.6],[-.5,4.6]],-6.55);
 for(let j=0;j<7;j++){const y=-4.5+j*1.25,w=.08+(6-j)*.035;block(city,sand,0,y,-6.45,w,.52,.01);}
 for(const s of[-1,1]){
  const building=new T.Group();city.add(building);
  block(building,concrete,s*5.8,4.2,-4.8,3.3,7.1,.7);
  for(let f=0;f<5;f++){
   block(building,edge,s*5.8,1.2+f*1.4,-4.34,3.5,.2,.5);
   for(let w=0;w<3;w++){const x=s*(4.65+w*.85);block(building,black,x,1.9+f*1.4,-4.4,.57,.89,.03);if((w+f)%3===0)block(building,glass,x,1.93+f*1.4,-4.37,.52,.81,.02);}
  }
  block(city,edge,s*4.3,3.7,-4.15,.2,6,.15);
  for(let j=0;j<6;j++){const rubble=block(city,j%2?concrete:rust,s*(3.3+j*.55),-.7+(j%3)*.35,-2.5,1.1,.6,.55);rubble.rotation.z=s*(j*.4);}
  const wall=block(city,concrete,s*3.6,.85,-3,2.6,1.2,.4);wall.rotation.z=s*.055;
  for(let j=0;j<4;j++){const grass=block(city,mat(j%2?0x394b39:0x59694d),s*(3.6+j*.33),.7+j*.2,-2.85,.12,1.1,.12);grass.rotation.z=s*(.3+j*.17);}
  for(let j=0;j<3;j++)block(city,sand,s*2.4,.95+j*.13,-2.2,.64,.22,.4);
 }
 for(let i=0;i<18;i++){const o=block(city,i%2?edge:concrete,-5.5+(i*1.37)%11,-2.5+(i*.79)%4,-2,.13+(i%3)*.08,.09,.09);o.rotation.z=i;}
 const mist=mesh(plane,haze,city,0,5,-3.4,13,4,1);
 // Foreground cover is geometry in front of the operative, not painted UI.
 const cover=new T.Group();cover.name='foreground-car-and-barricade';cover.position.y=.85;root.add(cover);
 const hood=block(cover,wornMetal,-4,-2.9,5.1,4.6,1.65,1);hood.rotation.z=.09;
 block(cover,black,-3.95,-2.01,5.45,4.7,.16,.4).rotation.z=.09;
 for(let i=0;i<7;i++)block(cover,edge,-5.75+i*.5,-2.13+i*.045,5.62,.28,.045,.025);
 block(cover,edge,-5.4,-2.9,5.65,.85,1.2,.08).rotation.z=-.12;
 for(const x of[-5.1,-3]){const wheel=mesh(cylinder,black,cover,x,-3.72,5,.49,.22,.49);wheel.rotation.x=Math.PI/2;}
 block(cover,wornConcrete,4.14,-3,5.2,4.8,1.5,1.1);
 block(cover,wornConcrete,4.1,-2.2,5.25,4.9,.2,1.2);
 for(let i=0;i<5;i++)block(cover,black,2.4+i*.81,-3.13,5.79,.36,.6,.02).rotation.z=-.36;
 for(const p of[[2.5,-2.01],[3.55,-1.97],[4.6,-1.99],[5.55,-1.97],[3,-1.69],[4.05,-1.68],[5.1,-1.72]]){const sack=mesh(sphere,wornFabric,cover,p[0],p[1],5.3,.63,.2,.42);sack.rotation.z=.04;}
 block(cover,gunmetal,4.2,-2.82,5.86,.73,.29,.02);block(cover,cyan,4.2,-2.82,5.89,.58,.025,.01);
 // The operative's own waist-high cover occludes the sprite's lower body.
 // Keeping it in front of the character makes crouch/rise an actual depth cue.
 block(cover,gunmetal,-.6,-3.2,5.3,3.7,1.7,.75);
 block(cover,wornMetal,-.6,-4.9,5.29,3.7,1.8,.7);
 block(cover,edge,-.6,-2.37,5.39,3.85,.16,.92).rotation.z=-.015;
 block(cover,wornMetal,-.68,-3.18,5.7,2.92,1.27,.07);
 for(const x of[-1.88,.49])block(cover,black,x,-3.17,5.77,.1,1.28,.035);
 block(cover,wornConcrete,.59,-2.54,5.4,.88,.38,.82).rotation.z=-.12;
 block(cover,black,-.78,-3.05,5.76,1.48,.48,.025);
 for(let i=0;i<7;i++)block(cover,edge,-1.35+i*.19,-3.05,5.79,.07,.34,.025);
 block(cover,cyan,.22,-2.81,5.79,.27,.04,.025);
 // Bumper, welded patches and bolts break the clean box silhouettes.
 block(cover,gunmetal,-4,-3.48,5.72,4.55,.13,.14).rotation.z=.09;
 block(cover,wornMetal,-5.11,-2.93,5.76,.74,.61,.045).rotation.z=-.12;
 block(cover,wornMetal,-2.62,-2.64,5.76,.52,.42,.045).rotation.z=.07;
 for(const x of[-1.83,.46])for(const y of[-2.67,-3.68])mesh(sphere,sand,cover,x,y,5.81,.045,.045,.018);
 const damageScars=new T.Group();cover.add(damageScars);
 for(let i=0;i<12;i++){const scar=block(damageScars,black,2.1+(i*.73)%4,-2.65-(i*.31)%.8,5.81,.11,.045,.01);scar.rotation.z=i;}
 damageScars.visible=false;
 function operator(parent,x,y,z,scale=1){
  const character=new T.Group();character.position.set(x,y,z);character.scale.setScalar(scale);parent.add(character);
  const rig=new T.Group();character.add(rig);
  // White-haired adult tactical operative seen from behind, facing the target field.
  mesh(sphere,suit,rig,0,.7,0,.55,.8,.28);block(rig,black,0,.82,.24,.71,.66,.18);block(rig,trim,0,.49,.36,.5,.13,.05);
  mesh(sphere,skin,rig,0,1.87,0,.34,.43,.29);mesh(sphere,hair,rig,0,2,.13,.39,.42,.27);
  for(let i=0;i<7;i++){const lock=mesh(sphere,hair,rig,-.3+i*.1,1.6-(i%2)*.13,.3,.087,.43,.07);lock.rotation.z=(i-3)*.035;}
  block(rig,black,0,2.13,.04,.73,.13,.35);block(rig,trim,0,2.14,.23,.28,.14,.06);
  for(const s of[-1,1]){mesh(sphere,suit,rig,s*.31,-.43,0,.24,.58,.24);mesh(sphere,black,rig,s*.33,-1.08,.06,.21,.31,.25);mesh(sphere,black,rig,s*.34,-1.36,-.02,.24,.15,.4);const arm=mesh(sphere,suit,rig,s*.59,1.11,-.08,.19,.49,.2);arm.rotation.z=s*.47;mesh(sphere,black,rig,s*.72,.95,-.12,.17,.23,.2);block(rig,trim,s*.38,1.22,.22,.1,.49,.05);}
  const weapon=new T.Group();weapon.position.set(.7,1.28,-.2);rig.add(weapon);block(weapon,gunmetal,0,.12,0,.17,.68,.2);block(weapon,black,0,.58,-.04,.1,.5,.14);block(weapon,black,.12,.24,.04,.17,.32,.12);block(weapon,cyan,0,.34,.115,.055,.04,.015);weapon.rotation.z=-.24;
  return{character,rig,weapon};
 }
 const hero=new T.Group();hero.name='white-haired-cover-operative';hero.position.set(0,-3.05,4);group.add(hero);
 const operative=operator(hero,-.85,.1,0,1.25);hero.userData.body=operative.rig;hero.userData.arm=operative.weapon;hero.userData.keep=true;
 // There are no decorative teammates: each visible operative belongs to the actual squad.
 let squadIds=['spark'],activeOperatorId='spark';const squadSlots=new Map([['spark',{x:-.62,y:0,scale:1,slot:'center'}]]);
 const rosterRigs=new Map();let sparkState={};
 let backgroundArtwork=null,operatorArtwork=null,currentAimX=0,currentAimY=3,disposed=false;
 let reloadRemoveTexture=null,reloadInsertTexture=null;
 const aimTextures=new Map();let aimSkin=null,aimDiagnostic=null;
 const motion=createOperatorMotion();let motionState=motion.getState();
 // The raised rifles extend above the original body crop. UVs stay in canonical body space.
 const skinGeometry=geo(new T.PlaneGeometry(1.32,1.38,64,88).translate(.06,.19,0));
 for(let i=0;i<skinGeometry.attributes.position.count;i++)skinGeometry.attributes.uv.setXY(i,skinGeometry.attributes.position.getX(i)+.5,skinGeometry.attributes.position.getY(i)+.5);
 const restPositions=new Float32Array(skinGeometry.attributes.position.array),muzzlePoint=new T.Vector3();
 const reloadUniforms={uReloadRemove:{value:null},uReloadInsert:{value:null},uReloadMix:{value:0},uInsertMix:{value:0},uAimMap:{value:null},uAimReady:{value:0}};
 function skinArtwork(){
  const position=skinGeometry.attributes.position;
  for(let i=0;i<position.count;i++){
   const point=deformOperatorPoint(restPositions[i*3],restPositions[i*3+1],motionState,aimSkin);
   position.setXY(i,point.x,point.y);
  }
  position.needsUpdate=true;
 }
 function poseSparkAim(aimX=currentAimX,aimY=currentAimY,firing=false){
  currentAimX=Number.isFinite(aimX)?aimX:currentAimX;
  currentAimY=Number.isFinite(aimY)?aimY:currentAimY;
  if(operatorArtwork){
   const slot=squadSlots.get('spark')||{x:-.62,y:0,scale:1};
   const side=currentAimX<slot.x?-1:1;
   operatorArtwork.scale.set(8.2*ART_ASPECT*slot.scale*side,8.2*slot.scale,1);
   operatorArtwork.rotation.z=0;
   operatorArtwork.position.x=slot.x+currentAimX*.018;
   operatorArtwork.visible=squadIds.includes('spark');
   operatorArtwork.updateMatrix();hero.updateMatrix();
   const localTarget=new T.Vector3(currentAimX,currentAimY,0).applyMatrix4(hero.matrix.clone().invert()).applyMatrix4(operatorArtwork.matrix.clone().invert());
   const shoulder=deformOperatorPoint(.08,.30,motionState);
   const nominal=Math.atan2(localTarget.y-shoulder.y,Math.max(.0001,(localTarget.x-shoulder.x)*ART_ASPECT))*DEG;
   const ready=aimTextures.size===4;
   const pose=ready?OPERATOR_AIM_POSES.reduce((best,p)=>Math.abs(p.angle-nominal)<Math.abs(best.angle-nominal)?p:best):LEGACY_POSE;
   reloadUniforms.uAimMap.value=aimTextures.get(pose.angle)||operatorArtwork.material.map;
   reloadUniforms.uAimReady.value=Number(ready);
   // Project the shoulder onto the measured barrel axis. Rotating about that point
   // keeps the drawn bore, muzzle flash and tracer on one line, even between key poses.
   const root=deformOperatorPoint(pose.root.x,pose.root.y,motionState),rawTip=deformOperatorPoint(pose.tip.x,pose.tip.y,motionState);
   const axis=new T.Vector2((rawTip.x-root.x)*ART_ASPECT,rawTip.y-root.y).normalize();
   const projection=(shoulder.x-root.x)*ART_ASPECT*axis.x+(shoulder.y-root.y)*axis.y;
   const pivot={x:root.x+axis.x*projection/ART_ASPECT,y:root.y+axis.y*projection};
   const offset=new T.Vector2((localTarget.x-pivot.x)*ART_ASPECT,localTarget.y-pivot.y);
   const distance=offset.length(),direction=distance>.00001?offset.clone().normalize():axis.clone();
   const tipDistance=(rawTip.x-pivot.x)*ART_ASPECT*axis.x+(rawTip.y-pivot.y)*axis.y;
   const lengthScale=Math.min(1,Math.max(.025,(distance-.015)/Math.max(.01,tipDistance)));
   aimSkin={pivot,axis,direction,lengthScale};
   // Reload artwork retains its authored magazine/hand positions; no live shots occur here.
   const loading=firing?0:motionState.reloadMix;
   if(loading>0){
    const blended=axis.clone().multiplyScalar(loading).addScaledVector(direction,1-loading).normalize();
    aimSkin={pivot,axis,direction:blended,lengthScale:1+(lengthScale-1)*(1-loading)};
   }
   if(firing)reloadUniforms.uReloadMix.value=0;
   skinArtwork();
   const tip=deformOperatorPoint(pose.tip.x,pose.tip.y,motionState,aimSkin);
   const barrelRoot=deformOperatorPoint(pose.root.x,pose.root.y,motionState,aimSkin);
   muzzlePoint.set(tip.x,tip.y,0).applyMatrix4(operatorArtwork.matrix).applyMatrix4(hero.matrix);
   const worldRoot=new T.Vector3(barrelRoot.x,barrelRoot.y,0).applyMatrix4(operatorArtwork.matrix).applyMatrix4(hero.matrix);
   const barrel=new T.Vector2(muzzlePoint.x-worldRoot.x,muzzlePoint.y-worldRoot.y).normalize(),target=new T.Vector2(currentAimX-worldRoot.x,currentAimY-worldRoot.y).normalize();
   const error=Math.abs(Math.atan2(barrel.x*target.y-barrel.y*target.x,barrel.dot(target)))*DEG;
   aimDiagnostic={poseAngle:pose.angle,side,aimAngle:nominal,barrelAngle:Math.atan2(barrel.y,Math.abs(barrel.x))*DEG,barrelErrorDegrees:error,
    muzzle:{x:muzzlePoint.x,y:muzzlePoint.y},barrelRoot:{x:worldRoot.x,y:worldRoot.y},target:{x:currentAimX,y:currentAimY},lengthScale,
    poseAssetsReady:ready,availablePoses:[...aimTextures.keys()].sort((a,b)=>a-b)};
  }else{
   operative.character.updateMatrixWorld(true);operative.weapon.updateWorldMatrix(true,false);
   muzzlePoint.set(0,.84,0);operative.weapon.localToWorld(muzzlePoint);group.worldToLocal(muzzlePoint);
  }
  if(activeOperatorId==='spark'){hero.userData.muzzleLocal??=new T.Vector3();hero.userData.muzzleLocal.copy(muzzlePoint);}
  return muzzlePoint;
 }
 function keyedSquadMaterial(texture){
  const m=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,toneMapped:false});materials.push(m);
  m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   #ifdef USE_MAP
    vec2 uv=vMapUv*.75+vec2(.14,.043);vec4 art=texture2D(map,uv);
    float key=max(0.0,min(art.r,art.b)-art.g);art.a*=1.0-smoothstep(.04,.42,key);
    art.a*=step(0.0,uv.x)*step(0.0,uv.y)*step(uv.x,1.0)*step(uv.y,1.0);
    art.rb-=vec2(key*.85);art.rgb=max(vec3(0.0),art.rgb);diffuseColor*=art;
   #endif
  `);};m.customProgramCacheKey=()=> 'squad-operator-key-v5';return m;
 }
 function makeSquadRig(id,texture){
  const existing=rosterRigs.get(id);if(existing){existing.mesh.material.map=texture;existing.mesh.material.needsUpdate=true;existing.assetReady=true;return existing;}
  const def=SQUAD_ART_DEFS[id],geometry=geo(skinGeometry.clone());geometry.attributes.position.array.set(restPositions);
  const art=mesh(geometry,keyedSquadMaterial(texture),hero,-.62,2,.43,8.2*ART_ASPECT,8.2,1);art.name=`operator-artwork-${id}`;art.visible=false;
  const attachment=new T.Group();attachment.name=`operator-reload-${id}`;hero.add(attachment);attachment.visible=false;
  const metal=mat(id==='ember'?0x68462e:0x293f54,.75,.4),accent=basic(def.color),brass=mat(0xceb17d,.8,.35);
  if(id==='ember'){
   const body=mesh(cylinder,metal,attachment,0,0,0,.14,.78,.14);body.rotation.z=-Math.PI/2;
   const nose=mesh(geo(new T.ConeGeometry(.145,.28,12)),accent,attachment,.5,0,0);nose.rotation.z=-Math.PI/2;
   for(const sign of[-1,1])block(attachment,brass,-.36,sign*.17,0,.16,.19,.035);
   block(attachment,accent,-.07,0,.15,.28,.045,.01);
  }else{
   const drum=mesh(cylinder,metal,attachment,0,0,0,.37,.26,.37);drum.rotation.x=Math.PI/2;
   mesh(geo(new T.TorusGeometry(.3,.026,5,28)),accent,attachment,0,0,.16);
   for(let i=0;i<5;i++)block(attachment,brass,.22+i*.08,.28-i*.08,.17,.16,.055,.045);
  }
  const rotor=new T.Group();rotor.name=`operator-mechanism-${id}`;hero.add(rotor);rotor.visible=false;
  if(id==='volt')for(let i=0;i<6;i++){const theta=i*Math.PI/3;mesh(sphere,accent,rotor,Math.cos(theta)*.095,Math.sin(theta)*.15,0,.024,.037,.01);}
  const rig={id,def,mesh:art,geometry,controller:createOperatorMotion(),motion:{},state:{},aimSkin:null,diagnostic:null,muzzle:new T.Vector3(),assetReady:true,attachment,rotor,spin:0};
  rosterRigs.set(id,rig);setSquad(squadIds,activeOperatorId);return rig;
 }
 function placeSquad(){
  const supports=squadIds.filter(id=>id!==activeOperatorId);squadSlots.clear();
  if(activeOperatorId)squadSlots.set(activeOperatorId,{x:-.62,y:0,scale:1,slot:'center'});
  supports.forEach((id,i)=>squadSlots.set(id,{x:i===0?-4.3:3.7,y:-.18,scale:.76,slot:i===0?'left':'right'}));
  if(operatorArtwork){operatorArtwork.visible=squadIds.includes('spark');const slot=squadSlots.get('spark');if(slot)operatorArtwork.position.y=2+(-1.05+motionState.exposure*1.09)*slot.scale+slot.y;}
  operative.character.visible=!operatorArtwork&&squadIds.includes('spark');
  for(const [id,rig]of rosterRigs){const slot=squadSlots.get(id);rig.mesh.visible=!!slot&&rig.assetReady;if(!slot){rig.attachment.visible=rig.rotor.visible=false;continue;}
   rig.mesh.scale.set(8.2*ART_ASPECT*slot.scale,8.2*slot.scale,1);rig.mesh.position.set(slot.x,2+(-1.05+(rig.motion.exposure||0)*1.09)*slot.scale+slot.y,.43);
  }
 }
 function setSquad(raw,selected=activeOperatorId){
  const next=Array.isArray(raw)?[...new Set(raw.map(item=>typeof item==='string'?item:item?.id).filter(id=>id==='spark'||SQUAD_ART_DEFS[id]))].slice(0,3):squadIds;
  squadIds=next;activeOperatorId=next.includes(selected)?selected:next[0]||null;placeSquad();
  return activeOperatorId;
 }
 function setActiveOperator(id){if(!squadIds.includes(id))return false;activeOperatorId=id;placeSquad();
  if(operatorArtwork&&squadIds.includes('spark'))poseSparkAim(currentAimX,currentAimY);
  for(const rig of rosterRigs.values())if(squadIds.includes(rig.id))poseSquadAim(rig,currentAimX,currentAimY,false);
  return true;
 }
 function poseSquadAim(rig,x,y,firing=false){
  const slot=squadSlots.get(rig.id);if(!slot)return null;
  const art=rig.mesh,m=rig.motion,def=rig.def,side=x<slot.x?-1:1;
  art.scale.set(8.2*ART_ASPECT*slot.scale*side,8.2*slot.scale,1);art.rotation.z=0;art.position.x=slot.x+x*.018;art.updateMatrix();hero.updateMatrix();
  const targetLocal=new T.Vector3(x,y,0).applyMatrix4(hero.matrix.clone().invert()).applyMatrix4(art.matrix.clone().invert());
  const shoulder=deformOperatorPoint(.08,rig.id==='volt'?.20:.30,m),base=deformOperatorPoint(def.root.x,def.root.y,m),tip=deformOperatorPoint(def.tip.x,def.tip.y,m);
  const axis=new T.Vector2((tip.x-base.x)*ART_ASPECT,tip.y-base.y).normalize(),projection=(shoulder.x-base.x)*ART_ASPECT*axis.x+(shoulder.y-base.y)*axis.y;
  const pivot={x:base.x+axis.x*projection/ART_ASPECT,y:base.y+axis.y*projection};
  const delta=new T.Vector2((targetLocal.x-pivot.x)*ART_ASPECT,targetLocal.y-pivot.y),distance=delta.length(),direction=distance>.00001?delta.clone().normalize():axis.clone();
  const length=(tip.x-pivot.x)*ART_ASPECT*axis.x+(tip.y-pivot.y)*axis.y,lengthScale=Math.min(1,Math.max(.025,(distance-.018)/Math.max(.01,length)));
  const loading=firing?0:(m.reloadMix||0),reloadDirection=new T.Vector2(Math.cos(.12),Math.sin(.12));
  const aimDirection=direction.clone().multiplyScalar(1-loading).addScaledVector(reloadDirection,loading).normalize();
  rig.aimSkin={pivot,axis,direction:aimDirection,lengthScale:1+(lengthScale-1)*(1-loading),mask:def.mask};
  const positions=rig.geometry.attributes.position;for(let i=0;i<positions.count;i++){const p=deformOperatorPoint(restPositions[i*3],restPositions[i*3+1],m,rig.aimSkin);positions.setXY(i,p.x,p.y);}positions.needsUpdate=true;
  const point=p=>{const v=deformOperatorPoint(p.x,p.y,m,rig.aimSkin);return new T.Vector3(v.x,v.y,0).applyMatrix4(art.matrix).applyMatrix4(hero.matrix);};
  const worldBase=point(def.root);rig.muzzle.copy(point(def.tip));
  const bore=new T.Vector2(rig.muzzle.x-worldBase.x,rig.muzzle.y-worldBase.y).normalize(),toward=new T.Vector2(x-worldBase.x,y-worldBase.y).normalize();
  const error=Math.abs(Math.atan2(bore.x*toward.y-bore.y*toward.x,bore.dot(toward)))*DEG;
  rig.attachment.visible=!!rig.state.reloading&&squadIds.includes(rig.id);
  if(rig.attachment.visible){
   const p=m.reloadProgress||0,feed=smooth(.15,.62,p),travel=(1-feed)*(rig.id==='ember'?.85:.6);
   const receiver=point(sourceToBody(rig.id==='ember'?[410,481]:[760,650]));
   rig.attachment.position.set(receiver.x-hero.position.x-bore.x*travel,receiver.y-hero.position.y-Math.sin(p*Math.PI)*.18,1.82);
   rig.attachment.rotation.z=Math.atan2(bore.y,bore.x);rig.attachment.scale.setScalar(slot.scale*(rig.id==='ember'?.8:.72));
  }
  rig.rotor.visible=rig.id==='volt'&&!!rig.state.exposed&&!rig.state.reloading;
  rig.rotor.position.set(rig.muzzle.x-hero.position.x,rig.muzzle.y-hero.position.y,1.88);rig.rotor.rotation.z=rig.spin;rig.rotor.scale.setScalar(slot.scale);
  rig.diagnostic={id:rig.id,kind:def.kind,slot:slot.slot,side,assetReady:rig.assetReady,poseAngle:Math.atan2(axis.y,axis.x)*DEG,aimAngle:Math.atan2(direction.y,direction.x)*DEG,barrelAngle:Math.atan2(bore.y,Math.abs(bore.x))*DEG,
   barrelErrorDegrees:loading>.02?null:error,muzzle:{x:rig.muzzle.x,y:rig.muzzle.y},barrelRoot:{x:worldBase.x,y:worldBase.y},target:{x,y},lengthScale,reloadAttachmentVisible:rig.attachment.visible,rotorActive:rig.rotor.visible};
  if(activeOperatorId===rig.id){hero.userData.muzzleLocal??=new T.Vector3();hero.userData.muzzleLocal.copy(rig.muzzle);}
  return rig.muzzle;
 }
 function resolveMuzzle(x=currentAimX,y=currentAimY,firing=false,id=activeOperatorId){
  currentAimX=Number.isFinite(x)?x:currentAimX;currentAimY=Number.isFinite(y)?y:currentAimY;
  if(!squadIds.includes(id))return null;
  if(id==='spark')return poseSparkAim(x,y,firing);
  const rig=rosterRigs.get(id);return rig?poseSquadAim(rig,x,y,firing):null;
 }
 hero.userData.resolveMuzzle=resolveMuzzle;hero.userData.setSquad=setSquad;hero.userData.setActiveOperator=setActiveOperator;
 function keyedMaterial(texture){
  const m=new T.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.025,depthWrite:false,toneMapped:false});materials.push(m);
  reloadUniforms.uReloadRemove.value=reloadRemoveTexture||texture;reloadUniforms.uReloadInsert.value=reloadInsertTexture||texture;
  m.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,reloadUniforms);
   shader.fragmentShader=`uniform sampler2D uReloadRemove;\nuniform sampler2D uReloadInsert;\nuniform sampler2D uAimMap;\nuniform float uAimReady;\nuniform float uReloadMix;\nuniform float uInsertMix;\nvec4 operatorKey(vec4 c){float key=max(0.0,min(c.r,c.b)-c.g);c.a*=1.0-smoothstep(.04,.42,key);c.rb-=vec2(key*.85);c.rgb=max(c.rgb,vec3(0.0));return c;}\nfloat inSheet(vec2 uv){return step(0.0,uv.x)*step(0.0,uv.y)*step(uv.x,1.0)*step(uv.y,1.0);}\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
     vec4 ready=operatorKey(texture2D(map,vMapUv));
     ready.a*=inSheet(vMapUv);
     vec2 posedUv=vMapUv*.75+vec2(.14,.043);
     vec4 posed=operatorKey(texture2D(uAimMap,posedUv));posed.a*=inSheet(posedUv);
     ready=mix(ready,posed,uAimReady);
     vec4 remove=operatorKey(texture2D(uReloadRemove,vMapUv));
     vec4 insert=operatorKey(texture2D(uReloadInsert,vMapUv));
     remove.a*=inSheet(vMapUv);insert.a*=inSheet(vMapUv);
     vec4 loading=mix(vec4(remove.rgb*remove.a,remove.a),vec4(insert.rgb*insert.a,insert.a),uInsertMix);
     float upper=smoothstep(.54,.63,vMapUv.y);
     vec4 composite=mix(vec4(ready.rgb*ready.a,ready.a),loading,uReloadMix*upper);
     diffuseColor*=vec4(composite.rgb/max(.0001,composite.a),composite.a);
    #endif
   `);
  };
  reloadUniforms.uAimMap.value=texture;
  m.customProgramCacheKey=()=> 'operator-eight-direction-reload-v4';return m;
 }
 // Vite inlines both art files into the offline build; the Node tests inject texture stubs.
 if(typeof document!=='undefined'){
  const loader=new T.TextureLoader();
  const load=(url,assign)=>loader.load(url,texture=>{if(disposed){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;textures.push(texture);assign(texture);});
  load(new URL('./assets/operator-reload-remove-v3.png',import.meta.url).href,texture=>{reloadRemoveTexture=texture;reloadUniforms.uReloadRemove.value=texture;});
  load(new URL('./assets/operator-reload-insert-v3.png',import.meta.url).href,texture=>{reloadInsertTexture=texture;reloadUniforms.uReloadInsert.value=texture;});
  load(new URL('./assets/operator-aim-30-v4.png',import.meta.url).href,texture=>aimTextures.set(30,texture));
  load(new URL('./assets/operator-aim-45-v4.png',import.meta.url).href,texture=>aimTextures.set(45,texture));
  load(new URL('./assets/operator-aim-60-v4.png',import.meta.url).href,texture=>aimTextures.set(60,texture));
  load(new URL('./assets/operator-aim-75-v4.png',import.meta.url).href,texture=>aimTextures.set(75,texture));
  load(new URL('./assets/operator-ember-v5.png',import.meta.url).href,texture=>makeSquadRig('ember',texture));
  load(new URL('./assets/operator-volt-v5.png',import.meta.url).href,texture=>makeSquadRig('volt',texture));
 }
 function setArtwork({backgroundTexture,operatorTexture,aimTextures:injectedPoses,operatorTextures}={}){
  if(injectedPoses)for(const p of OPERATOR_AIM_POSES){const texture=injectedPoses[p.angle];if(texture)aimTextures.set(p.angle,texture);}
  if(operatorTextures)for(const id of ['ember','volt'])if(operatorTextures[id])makeSquadRig(id,operatorTextures[id]);
  if(backgroundTexture){
   if(backgroundArtwork){backgroundArtwork.removeFromParent();backgroundArtwork.material.dispose();}
   const m=new T.MeshBasicMaterial({map:backgroundTexture,color:0xffffff,toneMapped:false});materials.push(m);
   backgroundArtwork=mesh(plane,m,root,0,1.8,-8.7,13.3,22.3,1);city.visible=false;
  }
  if(operatorTexture){
   if(operatorArtwork){operatorArtwork.removeFromParent();operatorArtwork.material.dispose();}
   const aspect=(operatorTexture.image?.width||1024)/(operatorTexture.image?.height||1536),h=8.2;
   const m=keyedMaterial(operatorTexture);
   operatorArtwork=mesh(skinGeometry,m,hero,-.62,2,.4,h*aspect,h,1);operatorArtwork.name='operator-artwork';operative.character.visible=false;placeSquad();skinArtwork();poseSparkAim();
  }
 }
 function update(dt,time,state={}){
  const members=Array.isArray(state.squad)?state.squad:null;
  if(members)setSquad(members,state.activeOperatorId||activeOperatorId);
  sparkState=members?members.find(member=>member.id==='spark')||{}:state;
  motionState=motion.update(dt,time,{...sparkState,aimX:state.aimX,aimY:state.aimY,shots:sparkState.shots??(members?0:hero.userData.shotSerial??0),exposed:sparkState.exposed??(members?false:hero.userData.exposed??false)});
  const y=-1.05+motionState.exposure*1.09+motionState.breath*3;
  operative.character.position.y=.1+y;operative.weapon.rotation.z=-.24-(state.aimX??0)*.03;
  operative.rig.rotation.z=motionState.hips*.022;operative.weapon.position.y=1.28-motionState.gun*.14;
  if(operatorArtwork){
   const slot=squadSlots.get('spark')||{scale:1,y:0};operatorArtwork.position.y=2+y*slot.scale+slot.y;
  }
  reloadUniforms.uReloadMix.value=(reloadRemoveTexture&&reloadInsertTexture)?motionState.reloadMix:0;
  reloadUniforms.uInsertMix.value=motionState.insertMix;
  currentAimX=state.aimX??hero.userData.aimX??0;currentAimY=state.aimY??hero.userData.aimY??3;
  if(squadIds.includes('spark'))poseSparkAim(currentAimX,currentAimY);hero.userData.coverBlend=motionState.exposure;
  for(const [id,rig]of rosterRigs){
   const member=members?.find(item=>item.id===id)||{};rig.state=member;
   const pose=rig.controller.update(dt,time,{...member,aimX:currentAimX,aimY:currentAimY});
   rig.motion={...pose,gun:pose.gun*rig.def.recoil,hips:pose.hips*Math.sqrt(rig.def.recoil),hair:pose.hair*(id==='ember'?.5:1.15)};
   rig.spin+=dt*(member.exposed&&!member.reloading?42:3);
   const slot=squadSlots.get(id);if(!slot)continue;
   rig.mesh.position.y=2+(-1.05+pose.exposure*1.09+pose.breath*3)*slot.scale+slot.y;
   poseSquadAim(rig,currentAimX,currentAimY);
  }
  hero.userData.motion=getMotionState();
  damageScars.visible=(state.coverHp??120)<(state.maxCoverHp??120)*.65;
  mist.material.opacity=.13+Math.sin(time*.2)*.025;
 }
 function dispose(){disposed=true;delete hero.userData.resolveMuzzle;delete hero.userData.setSquad;delete hero.userData.setActiveOperator;root.removeFromParent();hero.removeFromParent();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();for(const t of textures)t.dispose();}
 function getMotionState(){
  const operators=squadIds.map(id=>id==='spark'?Object.freeze({...motionState,...aimDiagnostic,id,kind:'rifle',slot:squadSlots.get(id)?.slot,assetReady:!!operatorArtwork}):Object.freeze({...rosterRigs.get(id)?.motion,...rosterRigs.get(id)?.diagnostic,id,slot:squadSlots.get(id)?.slot,assetReady:!!rosterRigs.get(id)?.assetReady}));
  const controlled=operators.find(item=>item.id===activeOperatorId)||{};
  return Object.freeze({...controlled,activeOperatorId,operators:Object.freeze(operators),squadAssetsReady:operators.every(item=>item.assetReady),reloadArtworkReady:!!(reloadRemoveTexture&&reloadInsertTexture)});
 }
 return{hero,root,cover,update,setArtwork,getMotionState,dispose};
}
