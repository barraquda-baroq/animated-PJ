// dev-only showcase scenes for the props library (pv/engine/lib/props.js)
(function () {
  const PV = window.PV, L = PV.lib, W = PV.W, H = PV.H;
  function table(ctx, top, bot) { ctx.fillStyle = PV.linGrad(ctx, 0, 0, 0, H, [[0, top], [1, bot]]); ctx.fillRect(0, 0, W, H); }
  PV.shot('dev_props_1', { draw(ctx, t) {
    table(ctx, '#e9dcc8', '#cdb89a');
    L.bento(ctx, { x: 520, y: 330, s: 1.0, view: 'angle', tone: 'warm', light: -2.6 });
    L.bento(ctx, { x: 1420, y: 330, s: 1.0, view: 'top', tone: 'warm', light: -2.6 });
    L.bento(ctx, { x: 520, y: 830, s: 0.9, view: 'angle', burnt: true, tone: 'day', light: -2.6 });
    L.bento(ctx, { x: 1420, y: 830, s: 0.9, view: 'top', burnt: true, tone: 'day', light: -2.6 });
  } });
  PV.shot('dev_props_z', { draw(ctx, t) {
    table(ctx, '#e9dcc8', '#cdb89a');
    L.bento(ctx, { x: 960, y: 560, s: 2.0, view: 'angle', tone: 'warm', light: -2.6 });
  } });
})();
