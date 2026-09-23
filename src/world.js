import {createRooms} from './rooms.js';
import {createMintScene} from './mint-scene.js';
import {createBattleScene} from './battle-scene.js';
import {FLOOR_Y} from './constants.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original miniature arcade architecture. Geometry is batched per material, per scene.
export function createWorld(T){
 const scenes=[new T.Scene(),new T.Scene(),new T.Scene()],shaftScene=new T.Scene();
 scenes.forEach((s,i)=>{s.name=['WorkshopScene','MintScene','BreachScene'][i];});shaftScene.name='PersistentShaftScene';
 const floors=scenes.map((s,i)=>{const g=new T.Group();g.name=['Workshop','Mint','Breach'][i];g.position.y=FLOOR_Y[i];s.add(g);return g;});
 const palette={ink:0x182039,dark:0x0b1424,steel:0x334354,light:0xb6cecc,white:0xe3efe8,amber:0xffb451,gold:0x8d6245,cyan:0x66ffe0,pink:0xff609d,purple:0x695481};
 const mats={};for(const [k,c] of Object.entries(palette))mats[k]=new T.MeshStandardMaterial({color:c,roughness:k==='white'?.27:.4,metalness:['gold','steel','light'].includes(k)?.65:.3});
 for(const k of ['amber','cyan','pink'])mats[k+'Glow']=new T.MeshStandardMaterial({color:palette[k],emissive:palette[k],emissiveIntensity:1.6,roughness:.22,metalness:.15});
 mats.glass=new T.MeshPhysicalMaterial({color:0x72bbbc,transparent:true,opacity:.13,roughness:.1,metalness:.15,depthWrite:false,side:T.DoubleSide});
 mats.pinkGlass=new T.MeshPhysicalMaterial({color:0xeb65b4,transparent:true,opacity:.095,roughness:.1,depthWrite:false,side:T.DoubleSide});
 const boxCache=new Map(),cylCache=new Map();
 function boxGeo(w,h,d,r=.09){const key=[w,h,d,r].join(',');if(!boxCache.has(key))boxCache.set(key,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)));return boxCache.get(key);}
 function mesh(g,geo,mat,x=0,y=0,z=0,rot){const m=new T.Mesh(geo,typeof mat==='string'?mats[mat]:mat);m.position.set(x,y,z);if(rot)m.rotation.set(...rot);m.castShadow=!m.material.transparent;m.receiveShadow=true;g.add(m);return m;}
 function box(g,w,h,d,mat,x=0,y=0,z=0,rot){return mesh(g,boxGeo(w,h,d),mat,x,y,z,rot);}
 function cyl(g,r,h,mat,x=0,y=0,z=0,rot,n=16,rt=r){const key=[r,h,n,rt].join(',');if(!cylCache.has(key))cylCache.set(key,new T.CylinderGeometry(rt,r,h,n));return mesh(g,cylCache.get(key),mat,x,y,z,rot);}
 function ring(g,r,t,mat,x=0,y=0,z=0,rot=[Math.PI/2,0,0],arc=Math.PI*2){return mesh(g,new T.TorusGeometry(r,t,6,64,arc),mat,x,y,z,rot);}
 function label(g,text,sub,color,w,h,x,y,z){const c=document.createElement('canvas');c.width=1024;c.height=256;const a=c.getContext('2d');a.fillStyle='#101b2c';a.fillRect(0,0,1024,256);a.strokeStyle=color;a.lineWidth=8;a.strokeRect(10,10,1004,236);a.fillStyle=color;a.font='900 90px Arial';a.textAlign='left';a.fillText(text,40,120);a.fillStyle='#aebdbe';a.font='32px Arial';a.fillText(sub,43,195);a.fillStyle=color;for(let i=0;i<4;i++)a.fillRect(910+i*20,35,10,40);const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;const mat=new T.MeshBasicMaterial({map:tex,toneMapped:false});return mesh(g,new T.PlaneGeometry(w,h),mat,x,y,z);}
 function batch(g){g.updateMatrixWorld(true);const inv=g.matrixWorld.clone().invert(),buckets=new Map(),old=[];function walk(n){for(const c of [...n.children]){if(c.userData.keep)continue;if(c.isMesh&&!Array.isArray(c.material)){let geo=c.geometry.clone();if(geo.index){const indexed=geo;geo=geo.toNonIndexed();indexed.dispose();}geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inv,c.matrixWorld));const arr=buckets.get(c.material)||[];arr.push(geo);buckets.set(c.material,arr);old.push(c);}else walk(c);}}walk(g);for(const m of old)m.removeFromParent();for(const [mat,arr] of buckets){const merged=mergeGeometries(arr,false);if(merged){const m=new T.Mesh(merged,mat);m.castShadow=!mat.transparent;m.receiveShadow=true;g.add(m);}for(const a of arr)a.dispose();}}
 function lighting(scene,y,tint){scene.add(new T.HemisphereLight(0x9fbed6,0x272033,2.2));const key=new T.DirectionalLight(0xffecd1,3.3);key.position.set(-9,y+17,12);key.target.position.set(0,y,0);scene.add(key,key.target);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:45});key.shadow.bias=-.0006;key.shadow.normalBias=.03;key.shadow.camera.updateProjectionMatrix();const fill=new T.PointLight(tint,60,22,2);fill.position.set(2,y+5,-1);scene.add(fill);const rim=new T.DirectionalLight(tint,1.2);rim.position.set(6,y+8,-10);rim.target.position.set(0,y+2,0);scene.add(rim,rim.target);}
 lighting(scenes[0],0,palette.amber);lighting(scenes[1],12,0x8daea9);lighting(scenes[2],24,palette.cyan);lighting(shaftScene,12,palette.cyan);
 const animated=[];
 function crate(g,x,y,z,color='amber',s=1){box(g,s,s*.85,s,color,x,y+s*.425,z);box(g,s+.035,.12,s+.035,'dark',x,y+.18*s,z);box(g,.12,s*.92,s+.05,'steel',x-.27*s,y+s*.425,z);box(g,.12,s*.92,s+.05,'steel',x+.27*s,y+s*.425,z);box(g,.36,.22,.035,'light',x,y+.55*s,z+s*.51);}
 function robot(){const root=new T.Group(),body=new T.Group();body.userData.keep=true;root.add(body);root.userData.body=body;
  for(const x of [-.31,.31]){box(body,.49,.32,.76,'ink',x,.17,.06);box(body,.34,.45,.35,'white',x,.5,0);box(body,.35,.11,.12,'cyanGlow',x,.19,.44);}
  box(body,.96,.8,.61,'amber',0,1.04,0);box(body,.64,.48,.1,'ink',0,1.1,.355);cyl(body,.15,.07,'cyanGlow',0,1.14,.43,[Math.PI/2,0,0]);box(body,.74,.48,.38,'steel',0,1.13,-.42);box(body,1.16,.96,.81,'white',0,1.93,0);box(body,1.04,.56,.15,'ink',0,1.98,.43);box(body,.78,.34,.085,'dark',0,1.99,.525);for(const x of [-.22,.22])box(body,.22,.07,.04,'cyanGlow',x,2.01,.58);box(body,.15,.09,.1,'amber',0,1.83,.55);
  for(const x of [-.69,.69]){cyl(body,.22,.16,'gold',x,1.88,0,[0,0,Math.PI/2]);box(body,.3,.31,.23,'white',x,1.9,.02);}
  box(body,.08,.42,.08,'steel',-.39,2.53,-.14);mesh(body,new T.SphereGeometry(.1,12,8),'cyanGlow',-.39,2.77,-.14);box(body,.7,.12,.7,'pink',0,1.44,0);box(body,.2,.58,.09,'pink',-.5,1.29,-.29,[0,0,.16]);
  const arm=new T.Group();arm.userData.keep=true;arm.position.set(-.67,1.27,0);body.add(arm);box(arm,.31,.67,.34,'white',0,-.23,0,[0,0,-.12]);box(arm,.38,.29,.4,'ink',.02,-.61,.02);batch(arm);root.userData.arm=arm;
  box(body,.37,.49,.36,'white',.7,1.25,0,[0,0,.18]);box(body,.48,.43,1.06,'ink',.79,.98,.28);box(body,.31,.17,.7,'amber',.79,1.24,.34);cyl(body,.22,.22,'steel',.79,.98,.89,[Math.PI/2,0,0]);cyl(body,.12,.025,'cyanGlow',.79,.98,1.015,[Math.PI/2,0,0]);batch(body);return root;
 }
 const rooms=createRooms(T,floors[0]);
 const mintScene=createMintScene(T,floors[1]);
 const battleScene=createBattleScene(T,floors[2]);
 const hero=new T.Group();hero.visible=false;floors[0].add(hero);
 const heroBattle=battleScene.hero;
 // Persistent fourth scene: actual brass framework, steel cables, glass and a travelling cabin.
 const shaft=new T.Group();shaft.name='BrassSpine';shaftScene.add(shaft);for(const x of [-1.23,1.23])for(const z of [-4.68,-2.89]){box(shaft,.19,31,.19,'gold',x,15.2,z);box(shaft,.045,30.5,.04,'cyanGlow',x+Math.sign(x)*.12,15.2,z);}
 box(shaft,2.38,30.8,.045,'glass',0,15.3,-4.75);for(const x of [-.91,.91])box(shaft,.045,30.6,.06,'light',x,15.15,-4.4);
 for(let y=.4;y<31;y+=2){box(shaft,2.7,.12,.16,'steel',0,y,-4.74);for(const x of [-1.32,1.32])box(shaft,.16,.14,2.07,'steel',x,y,-3.79);}
 const lights=[];for(let i=0;i<3;i++){box(shaft,3.2,.4,2.65,'ink',0,FLOOR_Y[i]-.23,-3.75);const light=cyl(shaft,.2,.12,['amberGlow','pinkGlow','cyanGlow'][i],1.63,FLOOR_Y[i]+.42,-2.93,[Math.PI/2,0,0]);lights.push(light);label(shaft,`0${i+1}`,'DECK', ['#ffd386','#ff9fc4','#8affe2'][i],1.35,.72,0,FLOOR_Y[i]+2.9,-2.75);}
 label(shaft,'SPIRE','VERTICAL TRANSIT','#b8f3e9',2.7,.76,0,31.08,-3.68);batch(shaft);
 const cabin=new T.Group();cabin.name='TransitCabin';cabin.position.set(0,0,-3.75);shaftScene.add(cabin);box(cabin,2.27,.19,1.93,'steel',0,.09,0);box(cabin,2.26,.17,1.9,'ink',0,2.64,0);box(cabin,2.32,.055,1.99,'cyanGlow',0,.22,0);box(cabin,2.26,.055,1.94,'amberGlow',0,2.52,0);for(const x of [-1.04,1.04]){box(cabin,.13,2.55,.14,'gold',x,1.36,-.86);box(cabin,.07,2.3,1.7,'glass',x,1.36,0);}box(cabin,2.08,2.32,.055,'glass',0,1.34,-.88);
 const doors=[];for(const sign of [-1,1]){const door=new T.Group();door.userData.keep=true;cabin.add(door);door.position.set(sign*.51,1.37,.91);box(door,1.0,2.3,.075,'glass');box(door,.07,2.3,.095,'light',-sign*.47,0,0);box(door,.45,.08,.11,'cyanGlow',0,-.37,0);batch(door);doors.push(door);}
 const passenger=robot();passenger.userData.keep=true;passenger.scale.setScalar(.79);passenger.position.set(0,.23,0);cabin.add(passenger);passenger.visible=false;cabin.userData.passenger=passenger;batch(cabin);
 let doorTarget=0,doorAmount=0,activeFloor=0;const hitTargets=[];hero.traverse(o=>{if(o.isMesh)hitTargets.push(o);});
 return {scenes,shaftScene,floors,shaft,cabin,hero,heroBattle,hitTargets,rooms,mintScene,battleScene,
 setCabinY(y){cabin.position.y=Number.isFinite(y)?y:0;},setDoor(open){doorTarget=open?1:0;},setFloor(index){activeFloor=index;},
 update(dt,time,state={}){doorAmount+=(doorTarget-doorAmount)*Math.min(1,dt*12);doors.forEach((d,i)=>d.position.x=(i===0?-1:1)*(.51+doorAmount*.77));
  const mode=String(state.mode||'IDLE').toUpperCase();hero.visible=false;passenger.visible=['ASCEND','ARRIVE','RETURN'].includes(mode);rooms.update(dt,time,state.economy||{},activeFloor===0&&!['TRAVEL','RESULT'].includes(mode));mintScene.update?.(time,state.pusher||{});battleScene.update(dt,time,{...(state.battle||{}),mode,active:mode==='BATTLE'});
  for(const r of [passenger]){r.userData.body.position.y=Math.sin(time*2.7)*.036;r.userData.arm.rotation.z=Math.sin(time*1.1)*.045;}
  for(const a of animated){if(a.kind==='conveyor')a.obj.position.z=.85+((time*.23+a.phase)%1)*2.55;else if(a.kind==='crane')a.obj.rotation.y=Math.sin(time*.78)*.31;else if(a.kind==='portal')a.obj.rotation.z=Math.sin(time*.17)*.05;}
 },
 dispose(){const geos=new Set(),materials=new Set();for(const s of [...scenes,shaftScene])s.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});geos.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose();});}
 };
}

export function createEnemy(T,type='drone'){
 const elite=type==='elite'||type==='boss',g=new T.Group();const shell=new T.MeshStandardMaterial({color:elite?0x655787:0x364969,metalness:.55,roughness:.32});const ink=new T.MeshStandardMaterial({color:0x141d32,metalness:.35,roughness:.4});const glow=new T.MeshStandardMaterial({color:elite?0xff9e55:0xff578f,emissive:elite?0xff9e55:0xff578f,emissiveIntensity:1.6});
 const mesh=(geo,mat,x,y,z)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};mesh(new RoundedBoxGeometry(1.1,.67,.8,2,.15),shell,0,.56,0);mesh(new RoundedBoxGeometry(.84,.25,.12,2,.04),ink,0,.62,.44);mesh(new RoundedBoxGeometry(.59,.085,.08,2,.02),glow,0,.63,.525);for(const s of [-1,1]){const wing=mesh(new T.ConeGeometry(.32,.92,4),shell,s*.72,.49,-.04);wing.rotation.z=s*Math.PI/2;mesh(new T.SphereGeometry(.16,8,6),glow,s*.53,.37,.05);}mesh(new T.CylinderGeometry(.19,.07,.34,8),glow,0,.08,0);if(elite){g.scale.setScalar(1.8);mesh(new T.TorusGeometry(.55,.045,5,24),glow,0,1.04,0).rotation.x=Math.PI/2;}g.userData.glow=glow;return g;
}





