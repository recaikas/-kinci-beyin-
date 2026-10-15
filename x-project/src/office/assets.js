// Original generated art; exact source crops are normalized to the game's 32px floor grid.
import { FURNITURE, SKU } from '../systems/office.js';
const FRAMES = {
  desk:[34,99,352,210], chair:[426,66,179,250], plant:[649,17,270,294], shelf:[968,6,255,304],
  sofa:[20,394,376,226], tea:[414,356,216,273], coffee:[687,335,247,294], fan:[1000,313,197,317],
  ac:[23,697,344,213], toilet:[431,647,174,290], sink:[681,672,221,257], equipment:[918,622,330,307],
  crt:[23,956,302,247], home:[334,956,286,256], modern:[661,961,266,246], board:[954,959,275,220],
};
const HEIGHTS = { desk:39,chair:43,plant:60,shelf:66,sofa:42,tea:49,coffee:52,fan:65,ac:35,toilet:48,sink:45,equipment:56 };
function texture(scene,key,w,h,draw) {
  if(scene.textures.exists(key)) return scene.textures.get(key);
  const t=scene.textures.createCanvas(key,w,h); t.context.imageSmoothingEnabled=false; draw(t.context); t.refresh(); return t;
}
function sprite(g, source, frame, x,y,w,h) { g.drawImage(source,...frame,x,y,w,h); }
export function makeFurnitureTextures(scene) {
  const source=scene.textures.get('studio-furniture').getSourceImage();
  for(const type of Object.keys(FURNITURE)) for(let rot=0;rot<4;rot++) {
    const vert=rot%2 && FURNITURE[type].w>1, w=vert?32:FURNITURE[type].w*32, h=(vert?64:HEIGHTS[type])+8;
    texture(scene,`${type}-${rot}`,w,h,(g)=>{
      const targetW=w-2, targetH=Math.min(h-6,targetW*FRAMES[type][3]/FRAMES[type][2]);
      g.fillStyle='#263d3020';g.beginPath();g.ellipse(w/2,h-4,w/2-2,3,0,0,Math.PI*2);g.fill();
      if(rot===2||rot===3){g.translate(w,0);g.scale(-1,1);}
      sprite(g,source,FRAMES[type],1,h-5-targetH,targetW,targetH);
    });
  }
  texture(scene,'noticeboard',48,40,(g)=>sprite(g,source,FRAMES.board,0,0,48,40));
}
export function computerTexture(scene,sku) {
  const pc=SKU[sku]; if(!pc) return null;const key=`computer-${sku}`;
  texture(scene,key,36,33,(g)=>sprite(g,scene.textures.get('studio-furniture').getSourceImage(),FRAMES[pc.generation>=3?'modern':pc.generation>=1?'home':'crt'],0,0,36,33));
  return key;
}
export function characterTexture(scene,person) {
  const row=person.founder?0:person.spec==='gfx'?1:person.spec==='ses'?3:person.spec==='tek'?2:person.id%3+1;
  const frames=[[[138,17,128,274],[416,17,129,274],[699,17,129,274],[978,18,131,273]],[[126,326,155,276],[408,328,157,271],[689,328,155,274],[974,328,152,271]],[[143,622,128,292],[411,622,142,290],[705,622,129,292],[975,625,143,288]],[[119,936,168,281],[402,936,165,279],[679,936,169,281],[967,936,165,281]]][row];
  const key=`studio-worker-${row}`;
  if(!scene.textures.exists(key)) {
    const source=scene.textures.get('studio-characters').getSourceImage();
    const t=texture(scene,key,32*4,48,(g)=>{for(let f=0;f<4;f++){const r=frames[f],height=46,width=Math.round(r[2]/r[3]*height);sprite(g,source,r,f*32+(32-width)/2,48-height,width,height);}});
    for(let f=0;f<4;f++)t.add(f,0,f*32,0,32,48);
  }
  return key;
}
