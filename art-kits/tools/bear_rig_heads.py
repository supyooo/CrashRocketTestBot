import sys,json;sys.path.insert(0,'art-kits/tools')
from bear_kit import remove_white,holes,trim,islands,fit_head,scale
from PIL import Image
import numpy as np
S=sys.argv[1]
body=Image.open(S+'/cheer.png')
hs=Image.open('art-kits/bear/src/bear-heads.png');cut=remove_white(hs)
heads=[cut.crop(b) for b in islands(cut)];print('heads',[h.size for h in heads])
out={}
for n,hd in zip(['calm','hype','scared','win'],heads):
    hd,_=trim(hd,2)
    sc,k,dx,dy=fit_head(body,hd,(112,8,335,235))
    h2=scale(hd,k);h2.save(f'{S}/head-{n}.png');out[n]=dict(x=dx,y=dy,w=h2.width,h=h2.height,score=round(float(sc),1));print(n,out[n])
json.dump(out,open(S+'/heads.json','w'))
# preview: body with each head pasted
sh=Image.new('RGB',(407*4,600),'#5a4a7a')
for i,n in enumerate(out):
    c=Image.new('RGBA',(407,600),(0,0,0,0));c.paste(body,(0,0),body);h=Image.open(f'{S}/head-{n}.png');c.paste(h,(out[n]['x'],out[n]['y']),h);sh.paste(c,(i*407,0),c)
sh.save(S+'/heads_fit.png')
