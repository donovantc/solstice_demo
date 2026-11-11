/*
 * The Solstice Paradox — interactive, dependency-free globe.
 * Canvas 2D raycasts a textured sphere; no WebGL, CDN or third-party JS required.
 * Astronomical lighting follows subsolar latitude (declination) and longitude
 * (true solar noon / equation of time) for the selected date and GMT clock time.
 */
(()=>{'use strict';
  const byId=id=>document.getElementById(id);
  const wrap=byId('globe-wrap');
  const clock=byId('clock-slider');
  const status=byId('globe-status');
  const error=byId('globe-error');
  const canvas=document.createElement('canvas');
  canvas.id='earth-canvas';
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Rotatable globe showing the changing day and night boundary over Earth. London is marked in orange.');
  canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  wrap.prepend(canvas);
  const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:false});
  if(!ctx){status.textContent='Your browser does not support canvas rendering';error.style.display='block';return;}

  const RAD=Math.PI/180, TAU=2*Math.PI, londonLat=51.5074*RAD, londonLon=-0.1278*RAD;
  const london=[Math.cos(londonLat)*Math.sin(londonLon),Math.sin(londonLat),Math.cos(londonLat)*Math.cos(londonLon)];
  let index=32,solar=null,minute=720,spinning=false;
  let yaw=.05,pitch=.64,zoom=1;
  let width=0,height=0,framePending=false,previousFrame=0;
  let dragging=false,lastX=0,lastY=0,loaded=false;
  let texture=null,tw=0,th=0;
  const fallback=document.createElement('canvas');fallback.width=512;fallback.height=256;
  const fallbackCtx=fallback.getContext('2d',{willReadFrequently:true});
  fallbackCtx.fillStyle='#205d8d';fallbackCtx.fillRect(0,0,512,256);
  const continents=[[[.04,.18],[.14,.14],[.23,.19],[.24,.29],[.20,.36],[.18,.49],[.11,.48],[.08,.35]],[[.17,.47],[.25,.51],[.28,.66],[.23,.87],[.20,.96],[.17,.82]],[[.47,.20],[.52,.14],[.58,.18],[.59,.31],[.56,.39],[.58,.50],[.54,.73],[.49,.78],[.44,.55],[.42,.39]],[[.56,.17],[.70,.13],[.83,.17],[.91,.29],[.84,.40],[.73,.43],[.70,.53],[.62,.37]],[[.75,.64],[.84,.61],[.89,.77],[.80,.83]]];
  continents.forEach(poly=>{fallbackCtx.beginPath();poly.forEach(([x,y],i)=>i?fallbackCtx.lineTo(x*512,y*256):fallbackCtx.moveTo(x*512,y*256));fallbackCtx.closePath();fallbackCtx.fillStyle='#628d76';fallbackCtx.fill()});
  let fallbackPixels=fallbackCtx.getImageData(0,0,512,256);
  let sourcePixels=fallbackPixels;
  tw=512;th=256;

  function useImage(img){
    try{
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const c2=c.getContext('2d',{willReadFrequently:true});c2.drawImage(img,0,0);
      sourcePixels=c2.getImageData(0,0,c.width,c.height);tw=c.width;th=c.height;
      loaded=true;status.textContent='Drag to rotate · Scroll or pinch to zoom';requestDraw();
    }catch(e){status.textContent='Interactive Earth ready · Simplified map';requestDraw();}
  }
  const img=new Image();img.onload=()=>useImage(img);
  img.onerror=()=>{status.textContent='Interactive Earth ready · Simplified map';requestDraw();};
  img.src=window.__EARTH_TEXTURE_URL || './earth-texture.webp';

  function dateAngle(i){
    const date=new Date(Date.UTC(2026,10,11+i));
    const year=date.getUTCFullYear();
    const doy=1+Math.floor((Date.UTC(year,date.getUTCMonth(),date.getUTCDate())-Date.UTC(year,0,1))/86400000);
    const days=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
    const g=TAU/days*(doy-1);
    return .006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  }
  function solarVector(){
    const decl=dateAngle(index);
    const solarNoon=solar?.noon??720;
    // Noon reaches Greenwich at solarNoon GMT. Each minute corresponds to 0.25° longitude.
    const longitude=(solarNoon-minute)*RAD/4;
    return [Math.cos(decl)*Math.sin(longitude),Math.sin(decl),Math.cos(decl)*Math.cos(longitude)];
  }
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function worldToView(v,cy,sy,cp,sp){
    const x=cy*v[0]+sy*v[2],z=-sy*v[0]+cy*v[2];
    return [x,cp*v[1]-sp*z,sp*v[1]+cp*z];
  }
  function isDay(sun){return london[0]*sun[0]+london[1]*sun[1]+london[2]*sun[2]>-0.01454}
  function fmt(m){const minutes=Math.round(m)%1440;return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')}
  const pixelStars=Array.from({length:85},(_,i)=>{
    const a=(i*127.7+.33)%997/997,b=(i*63.1+.71)%991/991;
    return [a,b,.4+(i*17%7)/10]
  });
  function draw(){
    if(!width||!height)return;
    const w=width,h=height,cx=w*.5,cy=h*.49;
    const r=Math.min(w*.39,h*.445)*zoom;
    const sun=solarVector();
    const sy=Math.sin(yaw),cY=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
    const sky=ctx.createLinearGradient(0,0,w,h);sky.addColorStop(0,'#09162c');sky.addColorStop(1,'#172c4c');
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    for(const [xs,ys,s] of pixelStars){const x=xs*w,y=ys*h;if(Math.hypot(x-cx,y-cy)<r+15)continue;ctx.globalAlpha=.4+s*.45;ctx.fillStyle='#c8dcff';ctx.fillRect(x,y,Math.max(.8,s),Math.max(.8,s))}ctx.globalAlpha=1;
    // Atmosphere glow behind the sphere.
    const glow=ctx.createRadialGradient(cx,cy,r*.85,cx,cy,r*1.24);
    glow.addColorStop(0,'rgba(78,170,245,0)');glow.addColorStop(.5,'rgba(83,159,244,.28)');glow.addColorStop(1,'rgba(48,106,195,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(cx,cy,r*1.26,0,TAU);ctx.fill();

    const d=Math.max(2,Math.round(2*r)),left=Math.round(cx-r),top=Math.round(cy-r),buffer=ctx.createImageData(d,d),target=buffer.data;
    const tex=sourcePixels.data;
    // One camera ray per visible canvas pixel. Reverse the globe's yaw/pitch to sample lat/lon.
    for(let py=0;py<d;py++){
      const vy=-(top+py+.5-cy)/r;
      for(let px=0;px<d;px++){
        const vx=(left+px+.5-cx)/r;
        const mag2=vx*vx+vy*vy;if(mag2>1)continue;
        const vz=Math.sqrt(Math.max(0,1-mag2));
        const xr=vx,yr=cp*vy+sp*vz,zr=-sp*vy+cp*vz;
        const ex=cY*xr-sy*zr,ey=yr,ez=sy*xr+cY*zr;
        const lon=Math.atan2(ex,ez),lat=Math.asin(clamp(ey,-1,1));
        let u=Math.floor((lon/TAU+.5)*tw),v=Math.floor((.5-lat/Math.PI)*th);
        u=((u%tw)+tw)%tw;v=clamp(v,0,th-1);
        const texIndex=(v*tw+u)*4,p=(py*d+px)*4;
        const dot=ex*sun[0]+ey*sun[1]+ez*sun[2];
        const daylight=clamp((dot+.025)*7,0,1);
        let light=.13+.87*daylight*(.28+.72*Math.max(0,dot));
        // Soft bright limb in twilight and subtle blue night-side haze.
        const twilight=clamp((dot+.09)/.15,0,1)*(1-clamp((dot-.015)/.09,0,1));
        const limb=Math.pow(vz,.34);
        const rim=clamp((.28-vz)/.28,0,1);
        target[p]=clamp(tex[texIndex]*light*limb+twilight*25+rim*15,0,255);
        target[p+1]=clamp(tex[texIndex+1]*light*limb+twilight*9+rim*38,0,255);
        target[p+2]=clamp(tex[texIndex+2]*light*limb+rim*72,0,255);
        target[p+3]=clamp((1-mag2)*r*1.8,0,1)*255;
      }
    }
    // putImageData ignores compositing; use offscreen canvas to retain antialiased edges.
    if(!draw.imageCanvas || draw.imageCanvas.width!==d){draw.imageCanvas=document.createElement('canvas');draw.imageCanvas.width=d;draw.imageCanvas.height=d;draw.imageCtx=draw.imageCanvas.getContext('2d')}
    draw.imageCtx.putImageData(buffer,0,0);
    ctx.drawImage(draw.imageCanvas,left,top);
    ctx.save();ctx.strokeStyle='rgba(143,205,255,.39)';ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.stroke();ctx.restore();
    const l=worldToView(london,cY,sy,cp,sp);
    if(l[2]>.015){
      const lx=cx+l[0]*r,ly=cy-l[1]*r;
      ctx.beginPath();ctx.arc(lx,ly,11,0,TAU);ctx.fillStyle='rgba(250,176,95,.2)';ctx.fill();
      ctx.beginPath();ctx.arc(lx,ly,4.5,0,TAU);ctx.fillStyle='#ffbf7f';ctx.fill();
      ctx.strokeStyle='#ffe1be';ctx.lineWidth=1.5;ctx.stroke();
      ctx.font='600 13px system-ui, sans-serif';ctx.textBaseline='middle';
      const labelX=lx+14,labelY=ly-13,twid=ctx.measureText('London').width;
      ctx.fillStyle='rgba(5,17,35,.8)';ctx.beginPath();ctx.roundRect(labelX-5,labelY-11,twid+11,23,6);ctx.fill();
      ctx.fillStyle='#ffdcaf';ctx.fillText('London',labelX,labelY);
    }
    // Subtle description of the solar ray direction projected onto camera plane.
    const dir=worldToView(sun,cY,sy,cp,sp);
    const dx=dir[0],dy=-dir[1];
    const angle=Math.atan2(dy,dx);const arrowX=cx+Math.cos(angle)*Math.min(r+32,w*.46),arrowY=cy+Math.sin(angle)*Math.min(r+32,h*.47);
    ctx.save();ctx.fillStyle='#ffcf8e';ctx.shadowColor='#e9a957';ctx.shadowBlur=14;ctx.beginPath();ctx.arc(arrowX,arrowY,5,0,TAU);ctx.fill();ctx.restore();
    byId('clock-label').textContent=fmt(minute);
    const daylight=isDay(sun);
    byId('light-state').innerHTML=daylight?'☀️ <strong>London is in daylight</strong>':'🌙 <strong>London is in darkness</strong>';
    clock.value=Math.round(minute/5)*5;
    const start=solar?.rise??480,end=solar?.set??960;
    byId('daylight-window').style.left=`${start/1440*100}%`;
    byId('daylight-window').style.width=`${(end-start)/1440*100}%`;
    byId('daylight-cursor').style.left=`${minute/1440*100}%`;
    byId('daylight-window-label').textContent=`Daylight ${fmt(start)}–${fmt(end)} GMT`;
    for(const [name,hit] of [['phase-sunset',index===window.turning?.minSet],['phase-solstice',index===window.turning?.minLen],['phase-sunrise',index===window.turning?.maxRise]])byId(name).classList.toggle('active',Boolean(hit));
  }
  function requestDraw(){if(!framePending){framePending=true;requestAnimationFrame(()=>{framePending=false;draw()})}}
  function resize(){const box=wrap.getBoundingClientRect();const scale=Math.min(devicePixelRatio||1,1.1);width=Math.max(280,Math.round(box.width*scale));height=Math.max(290,Math.round(box.height*scale));canvas.width=width;canvas.height=height;requestDraw()}
  if(window.ResizeObserver){new ResizeObserver(resize).observe(wrap)}else{window.addEventListener('resize',resize)}
  resize();
  const pointers=new Map();let pinchDistance=0;
  canvas.addEventListener('pointerdown',e=>{
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    lastX=e.clientX;lastY=e.clientY;dragging=true;canvas.style.cursor='grabbing';canvas.setPointerCapture(e.pointerId);
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinchDistance=Math.hypot(b.x-a.x,b.y-a.y)}
  });
  canvas.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    const prev=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){
      const [a,b]=[...pointers.values()],distance=Math.hypot(b.x-a.x,b.y-a.y);
      if(pinchDistance>0)zoom=clamp(zoom*distance/pinchDistance,.7,1.24);
      pinchDistance=distance;
    }else{
      yaw+=(e.clientX-prev.x)*.008;
      pitch=clamp(pitch-(e.clientY-prev.y)*.008,-1.25,1.25);
    }
    requestDraw();
  });
  function dragEnd(e){pointers.delete(e.pointerId);pinchDistance=0;dragging=pointers.size>0;canvas.style.cursor=dragging?'grabbing':'grab'}
  canvas.addEventListener('pointerup',dragEnd);canvas.addEventListener('pointercancel',dragEnd);
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom-e.deltaY*.001,0.7,1.24);requestDraw()},{passive:false});
  byId('reset-camera').onclick=()=>{yaw=.05;pitch=.64;zoom=1;requestDraw()};
  clock.oninput=e=>{minute=+e.target.value;requestDraw()};
  for(const [id,key] of [['dawn','rise'],['midday','noon'],['dusk','set']])byId(id).onclick=()=>{if(solar){minute=clamp(Math.round(solar[key]/5)*5,0,1440);requestDraw()}};
  byId('animate-day').onclick=()=>{spinning=!spinning;byId('animate-day').textContent=spinning?'Ⅱ Pause day':'▶ Animate day';if(spinning){previousFrame=performance.now();requestAnimationFrame(tick)}};
  function tick(now){if(!spinning)return;minute=(minute+Math.min(.12,(now-previousFrame)/1000)*65)%1440;previousFrame=now;requestDraw();requestAnimationFrame(tick)}
  window.addEventListener('solstice-date',e=>{index=e.detail.index;solar=e.detail.solar;window.turning=e.detail;requestDraw()});
  // The main page emits its initial date event before this deferred script runs.
  index=+byId('slider').value;byId('slider').dispatchEvent(new Event('input',{bubbles:true}));
  status.textContent='Drag to rotate · Scroll to zoom';
  window.addEventListener('error',e=>{if(e.filename?.endsWith('/earth.js')){status.textContent='Globe rendering encountered an error';error.style.display='block'}});
})();
