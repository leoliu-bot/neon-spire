/** Small original Web Audio score: warm pads, pentatonic neon arpeggios and arcade foley. */
export function createAudio(){
 let context=null,master=null,music=null,muted=false,nextStep=0,beat=0,currentMode='IDLE',lastHit=-10,lastKill=-10,lastCoin=-10,disposed=false;
 const sources=new Set();let noiseBuffer=null;
 const midi=n=>440*Math.pow(2,(n-69)/12);
 function voice(freq,start,duration,gain=.05,type='sine',endFreq=null,destination=master){
  if(!context||!destination||sources.size>64)return;const oscillator=context.createOscillator(),envelope=context.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(Math.max(20,freq),start);if(endFreq)oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),start+duration*.85);
  envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+.006);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(envelope);envelope.connect(destination);oscillator.start(start);oscillator.stop(start+duration+.025);sources.add(oscillator);oscillator.onended=()=>{sources.delete(oscillator);oscillator.disconnect();envelope.disconnect();};
 }
 function noise(start,duration,gain=.035,cutoff=2000){if(!context||sources.size>64)return;const source=context.createBufferSource(),filter=context.createBiquadFilter(),env=context.createGain();source.buffer=noiseBuffer;filter.type='highpass';filter.frequency.value=cutoff;env.gain.setValueAtTime(Math.max(.0002,gain),start);env.gain.exponentialRampToValueAtTime(.0001,start+duration);source.connect(filter);filter.connect(env);env.connect(master);source.start(start);source.stop(start+duration);sources.add(source);source.onended=()=>{sources.delete(source);source.disconnect();filter.disconnect();env.disconnect();};}
 function chord(notes,start,duration,gain=.024){for(let i=0;i<notes.length;i++)voice(midi(notes[i]),start+i*.025,duration,gain,'triangle');}
 async function unlock(){
  if(disposed)return;try{if(!context){const AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContext)return;context=new AudioContext();master=context.createGain();master.gain.value=muted?0:.55;const limiter=context.createDynamicsCompressor();limiter.threshold.value=-16;limiter.knee.value=12;limiter.ratio.value=6;master.connect(limiter);limiter.connect(context.destination);music=context.createGain();music.gain.value=.42;music.connect(master);noiseBuffer=context.createBuffer(1,context.sampleRate,context.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.6;nextStep=context.currentTime+.08;}if(context.state==='suspended')await context.resume();}catch{/* No audio device is a supported silent mode. */}
 }
 function setMuted(value){muted=Boolean(value);if(context&&master)master.gain.setTargetAtTime(muted?0:.55,context.currentTime,.045);}
 function play(name){
  if(!context||context.state!=='running'||muted||disposed)return;const t=context.currentTime;
  switch(name){
   case 'ui':case 'click':case 'select':voice(640,t,.08,.045,'sine',980);break;
   case 'navigate':voice(370,t,.13,.045,'triangle',740);voice(1110,t+.045,.13,.014);break;
   case 'door':voice(130,t,.3,.045,'triangle',240);noise(t,.16,.018,1700);break;
   case 'launch':chord([45,52,57,64],t,.7,.029);voice(90,t,.65,.045,'sine',460);noise(t+.08,.4,.027,650);break;
   case 'elevator':voice(88,t,1.4,.043,'sine',176);voice(176,t+.05,1.2,.018,'triangle',352);break;
   case 'arrive':chord([57,64,69,76],t,.65,.037);noise(t,.12,.022,2800);break;
   case 'result':case 'win':chord([57,60,64,69],t,1.05,.034);[69,72,76,81].forEach((n,i)=>voice(midi(n),t+.12+i*.12,.5,.035,'triangle'));break;
   case 'coin':case 'insert':if(t-lastCoin<.055)return;lastCoin=t;voice(1250,t,.08,.046,'sine',840);voice(1910,t+.04,.12,.025);break;
   case 'collect':case 'reward':voice(880,t,.12,.035,'triangle');voice(1320,t+.065,.18,.025);break;
   case 'upgrade':[57,64,69,73,76,81].forEach((n,i)=>voice(midi(n),t+i*.07,.36,.033,'triangle'));noise(t+.32,.2,.018,2400);break;
   case 'hit':if(t-lastHit<.12)return;lastHit=t;voice(160,t,.18,.065,'triangle',48);noise(t,.15,.055,250);break;
   case 'kill':if(t-lastKill<.08)return;lastKill=t;voice(320,t,.11,.023,'triangle',80);noise(t,.09,.022,1600);break;
   case 'ultimate':voice(66,t,.75,.095,'sine',38);voice(380,t,.65,.04,'sawtooth',65);noise(t,.5,.065,600);chord([57,64,69,76],t+.08,.8,.026);break;
   case 'wave':voice(440,t,.18,.027,'triangle');voice(440,t+.24,.18,.027,'triangle');voice(660,t+.48,.3,.026,'triangle');break;
   case 'shot':case 'shot-rifle':voice(880,t,.05,.012,'triangle',270);break;
   case 'shot-rocket':voice(105,t,.24,.060,'sawtooth',43);noise(t,.18,.035,380);voice(370,t,.20,.024,'triangle',92);break;
   case 'shot-gatling':voice(570,t,.035,.012,'square',240);noise(t,.025,.008,2400);break;
   case 'rocket-explosion':voice(64,t,.33,.070,'sine',26);noise(t,.26,.055,340);voice(180,t,.13,.022,'triangle',48);break;
   case 'error':case 'lose':voice(220,t,.17,.04,'triangle',110);voice(164,t+.15,.23,.03,'triangle',82);break;
   default:break;
  }
 }
 function update(dt,mode='IDLE'){
  if(!context||context.state!=='running'||disposed)return;currentMode=mode;const t=context.currentTime;if(nextStep<t-.5)nextStep=t+.03;
  if(muted){nextStep=t+.1;return;}
  const fighting=currentMode==='BATTLE',travel=['TRAVEL'].includes(currentMode),tempo=fighting?112:travel?94:80,step=60/tempo/2;
  // Schedule a bounded short lookahead; frame stalls cannot create an audio backlog.
  let count=0;while(nextStep<t+.075&&count++<3){
   const bar=Math.floor(beat/16)%4,roots=[45,41,48,43],root=roots[bar],melody=[12,19,22,24,19,15,22,19];
   if(beat%2===0||fighting)voice(midi(root+melody[beat%8]),nextStep,.3,fighting?.019:.014,'sine',null,music);
   if(beat%8===0){voice(midi(root),nextStep,step*7.8,.038,'triangle',null,music);voice(midi(root+7),nextStep+.018,step*7.4,.014,'sine',null,music);voice(midi(root+15),nextStep+.035,step*7.2,.011,'sine',null,music);}
   if(fighting&&beat%4===0)voice(85,nextStep,.18,.042,'sine',37,music);
   if((fighting||travel)&&beat%2===1)voice(1700,nextStep,.035,.008,'triangle',700,music);
   nextStep+=step;beat++;
  }
 }
 function dispose(){disposed=true;for(const source of sources)try{source.stop();}catch{}sources.clear();context?.close?.();context=null;}
 return{unlock,setMuted,get muted(){return muted;},play,update,dispose};
}
