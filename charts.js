const NS = 'http://www.w3.org/2000/svg';
const bindings = new WeakMap();
const svgElement = (name, attrs, text) => {
  const e=document.createElementNS(NS,name);Object.entries(attrs||{}).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;return e;
};
function initialize(svg) {
  const wrapper=svg.parentElement;wrapper.style.position='relative';
  const tooltip=document.createElement('div');tooltip.className='chart-tooltip';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');wrapper.append(tooltip);
  const binding={data:[],tooltip,svg,geometry:null};bindings.set(svg,binding);
  function hover(event) {
    const {geometry:g,data}=binding;if(!g||!data.length)return;
    const rect=svg.getBoundingClientRect();const px=(event.clientX-rect.left)*g.width/rect.width;
    const t=Math.max(0,Math.min(1,(px-g.left)/(g.right-g.left))),xValue=g.xMin+t*(g.xMax-g.xMin);
    let index=data.findIndex(d=>d.x>=xValue);if(index<0)index=data.length-1;
    const next=data[index],previous=data[Math.max(0,index-1)];
    const ratio=next.x===previous.x?0:(xValue-previous.x)/(next.x-previous.x);
    const value=previous.y+(next.y-previous.y)*ratio;
    const guide=svg.querySelector('[data-hover-guide]');guide.setAttribute('x1',g.left+t*(g.right-g.left));guide.setAttribute('x2',g.left+t*(g.right-g.left));guide.style.display='';
    tooltip.textContent=`${binding.timeLabel(xValue)} · ${value.toFixed(binding.decimals)} ${binding.unit}`;tooltip.hidden=false;
    tooltip.style.left=Math.max(0,Math.min(rect.width-160,event.clientX-rect.left))+'px';
  }
  svg.addEventListener('pointermove',hover);svg.addEventListener('pointerdown',hover);
  svg.addEventListener('pointerleave',()=>{tooltip.hidden=true;const guide=svg.querySelector('[data-hover-guide]');if(guide)guide.style.display='none';});
  new ResizeObserver(()=>{if(binding.options)draw(binding,binding.options);}).observe(svg);
  return binding;
}
export function updateLineChart(svg, options) {
  if(!svg)return;const binding=bindings.get(svg)||initialize(svg);binding.options=options;draw(binding,options);
}
function draw(binding, options) {
  const {svg}=binding,{values,key,timeKey,unit,decimals=1,color='var(--brand)',simulation=false}=options;
  const width=Math.round(svg.getBoundingClientRect().width)||600,height=simulation?210:150;
  if(width<80)return;
  const compact=width<430,left=compact?58:65,right=width-12,top=16,bottom=height-34;
  const data=values.filter(v=>Number.isFinite(v[key])).map(v=>({x:v[timeKey],y:v[key]}));
  let yMin=Math.min(0,...data.map(v=>v.y)),yMax=Math.max(1,...data.map(v=>v.y));
  const pad=(yMax-yMin)*.1;yMin-=pad;yMax+=pad;
  const xMin=data[0]?.x||0,xMax=data.at(-1)?.x||1;
  const xScale=x=>left+(x-xMin)/Math.max(xMax-xMin,1)*(right-left),yScale=y=>bottom-(y-yMin)/(yMax-yMin)*(bottom-top);
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.height=height+'px';svg.replaceChildren();
  binding.data=data;binding.unit=unit;binding.decimals=decimals;
  binding.timeLabel=simulation?(x=>`${x.toFixed(1)} s`):(x=>new Date(x).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}));
  binding.geometry={width,left,right,top,bottom,xMin,xMax};
  for(let i=0;i<3;i++) {
    const y=top+(bottom-top)*i/2,value=yMax-(yMax-yMin)*i/2;
    svg.append(svgElement('line',{x1:left,y1:y,x2:right,y2:y,stroke:'var(--line)','stroke-width':1}));
    const text=data.length?(Math.abs(value)>=1000?(value/1000).toFixed(1)+'k':value.toFixed(decimals)):'—';
    svg.append(svgElement('text',{x:left-9,y:y+4,'text-anchor':'end',class:'chart-axis-text'},text));
  }
  svg.append(svgElement('text',{x:5,y:height-8,class:'chart-axis-text'},unit));
  svg.append(svgElement('text',{x:right,y:height-6,'text-anchor':'end',class:'chart-axis-text'},simulation?'Simulated time (s)':'Record time'));
  if(data.length) {
    const d=data.map((p,i)=>(i?'L':'M')+xScale(p.x).toFixed(1)+' '+yScale(p.y).toFixed(1)).join(' ');
    svg.append(svgElement('path',{d:d+` L ${xScale(data.at(-1).x)} ${bottom} L ${left} ${bottom} Z`,fill:color,opacity:.06}));
    svg.append(svgElement('path',{d,fill:'none',stroke:color,'stroke-width':1.8,'stroke-linejoin':'round','data-series':key}));
    svg.append(svgElement('circle',{cx:xScale(data.at(-1).x),cy:yScale(data.at(-1).y),r:3,fill:color}));
    svg.append(svgElement('text',{x:left,y:height-18,class:'chart-axis-text'},simulation?xMin.toFixed(0):binding.timeLabel(xMin)));
    if(data.length>1)svg.append(svgElement('text',{x:right,y:height-18,'text-anchor':'end',class:'chart-axis-text'},simulation?xMax.toFixed(0):binding.timeLabel(xMax)));
  }
  svg.append(svgElement('line',{'data-hover-guide':'',x1:left,x2:left,y1:top,y2:bottom,stroke:'var(--ink-soft)','stroke-dasharray':'3 3',style:'display:none'}));
}
