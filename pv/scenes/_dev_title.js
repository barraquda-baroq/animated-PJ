(function(){const PV=window.PV,L=PV.lib;
PV.shot('dev_title_light',{draw(ctx,t){L.sky(ctx,[[0,'#fffaf0'],[0.5,'#fdf3e3'],[1,'#f6e7d2']]);L.glow(ctx,960,500,900,'#fff8e8',0.8);L.dust(ctx,t,{count:60,color:'#e9c98f',alpha:0.5});}});
PV.shot('dev_title_dark',{draw(ctx,t){L.sky(ctx,[[0,'#0c1022'],[1,'#1b2442']]);L.bokeh(ctx,t,{count:30,alpha:0.25});}});
})();
