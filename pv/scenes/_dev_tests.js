// dev-only test scenes for the atmos library
(function(){
const PV=window.PV, L=PV.lib, W=PV.W, H=PV.H;
PV.shot('dev_sky', { draw(ctx,t){
  L.sky(ctx,[[0,'#5d9be0'],[0.55,'#a9d1f2'],[1,'#fde9d6']]);
  L.glow(ctx,1500,180,520,'#fff3d6',0.9);
  L.clouds(ctx,t,{seed:3,count:7,y0:120,y1:520,minW:380,maxW:980,speed:8,colors:{lit:'#ffffff',mid:'#eef3fb',shadow:'#9fb0d6',rim:'#fff7e6'}});
  L.haze(ctx,t,{seed:4,y0:80,y1:300,alpha:0.25});
  L.godRays(ctx,t,{x:1500,y:120,angle:2.2,spread:0.7,count:9,length:1500,width:140,alpha:0.18});
  L.petals(ctx,t,{seed:5,count:45,size:13});
  L.dust(ctx,t,{seed:6,count:90});
  L.flare(ctx,1500,180,0.8);
}});
PV.shot('dev_storm', { draw(ctx,t){
  L.sky(ctx,[[0,'#0a0f1e'],[0.6,'#1c2740'],[1,'#2b3550']]);
  L.clouds(ctx,t,{seed:9,count:8,y0:-80,y1:300,minW:700,maxW:1400,speed:30,alpha:0.9,colors:{lit:'#5a6b8f',mid:'#3a4766',shadow:'#151c30'}});
  const segs=L.lightningPath(77,1100,-20,980,620,0.35,7); const fl=Math.max(0,1-Math.abs(t-1.0)*6)+Math.max(0,1-Math.abs(t-1.25)*8)*0.7;
  if(fl>0){ctx.fillStyle=PV.rgba('#dfe8ff',0.35*fl);ctx.fillRect(0,0,W,H);} L.lightning(ctx,segs,fl);
  L.bridge(ctx,{x0:-100,x1:2100,y:720,towerH:320,color:'#0d1222',lw:6,cables:11});
  ctx.fillStyle='#060912';ctx.fillRect(0,722,W,H-722);
  L.rain(ctx,t,{seed:2,count:900,angle:0.32,speed:2600,len:110,alpha:0.45});
  L.splashes(ctx,t,{y0:900,y1:1080,count:80});
}});
PV.shot('dev_sea', { draw(ctx,t){
  L.sky(ctx,[[0,'#3f8ee0'],[0.7,'#9fd0f5'],[1,'#e8f6ff']],0,560);
  L.clouds(ctx,t,{seed:12,count:5,y0:180,y1:420,minW:500,maxW:1100,speed:4,colors:{lit:'#ffffff',mid:'#f1f6fd',shadow:'#a9bfe0',rim:'#ffffff'}});
  L.sea(ctx,t,{horizonY:560,sunX:1150});
  L.bridge(ctx,{x0:150,x1:1200,y:545,towerH:110,color:'#f7f9fc',lw:3});
  L.noteStorm(ctx,t,{count:0});
}});
PV.shot('dev_notes', { draw(ctx,t){
  L.sky(ctx,[[0,'#0b0d14'],[1,'#1a2233']]);
  L.noteStorm(ctx,t,{seed:4,count:320,cx:960,cy:520,radius:900,speed:1.1,size:18});
}});
})();
