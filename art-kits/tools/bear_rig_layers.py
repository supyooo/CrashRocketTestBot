import sys,json
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
S=sys.argv[1]
body=Image.open(S+'/cheer.png').convert('RGBA');W,H=body.size
heads=json.load(open(S+'/heads.json'))
B=np.asarray(body).astype(np.float32)
def poly(pts,blur=0):
    m=Image.new('L',(W,H),0);ImageDraw.Draw(m).polygon(pts,fill=255)
    if blur:m=m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m).astype(np.float32)/255
# the fitted hype head's alpha, in body coordinates
hh=Image.open(S+'/head-hype.png');HA=np.zeros((H,W),np.float32);a=np.asarray(hh.getchannel('A')).astype(np.float32)/255
x,y=heads['hype']['x'],heads['hype']['y'];HA[y:y+a.shape[0],x:x+a.shape[1]]=a
SEAM=[(152,226),(140,250),(124,272),(104,290)]            # shoulder seam, collar to armpit
ARM=[(0,0),(108,0),(108,95),(104,120),(116,150),(134,190)]+SEAM+[(60,285),(15,210),(0,160)]
arm_core=poly(ARM,1.2)
shift=lambda pts,dx,dy:[(px+dx,py+dy) for px,py in pts]
ARM_EXT=[(0,0),(108,0),(108,95),(104,120),(116,150),(134,190)]+shift(SEAM,20,14)+[(60,300),(15,210),(0,160)]
arm_ext=poly(ARM_EXT,2.5)
headm=(HA>.5).astype(np.float32)
# arm layer: its polygon, never the head's pixels
rgb=B[...,:3];r,g,b=rgb[...,0],rgb[...,1],rgb[...,2];yy,xx=np.mgrid[0:H,0:W]
cream0=(r>165)&(g>135)&(b>95)&(r-b<125)&(np.abs(r-g)<70)&(yy>185)&(xx>120)
A=B.copy();A[...,3]*=arm_ext*(1-np.clip(HA*1.5,0,1))*(1-cream0)
Image.fromarray(A.astype(np.uint8),'RGBA').save(S+'/L_arm.png')
# body layer: everything but the arm (keeps a shoulder cap 7 px into the sleeve) and the head
arm_cut=poly(shift(ARM[:6],0,0)+shift(SEAM,-7,-5)+[(60,285),(15,210),(0,160)],1.2)
cream=(r>165)&(g>135)&(b>95)&(r-b<125)&(np.abs(r-g)<70)        # the fur collar in front of the cheeks
yy,xx=np.mgrid[0:H,0:W]
keep_collar=cream&(((xx<232)&(xx>140)&(yy>198))|((xx>244)&(xx<312)&(yy>220)))
teal=(r<95)&(g>r+8)&(yy>214)
zone=poly([(108,0),(407,0),(407,215),(332,215),(312,232),(262,246),(238,248),(214,242),(168,224),(152,226),(134,190),(116,150),(104,120),(108,95)])>.5
erase=(zone&~keep_collar&~teal).astype(np.float32)
erase=np.asarray(Image.fromarray((erase*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1))).astype(np.float32)/255
Bd=B.copy();Bd[...,3]*=(1-arm_cut)*(1-erase)
# neck stub behind the head: dark fur, so a moved head never opens a hole above the collar
# only where every head covers it, whatever the face
HM=np.ones((H,W),np.float32)
for n in heads:
    hi=np.asarray(Image.open(f'{S}/head-{n}.png').getchannel('A')).astype(np.float32)/255;t=np.zeros((H,W),np.float32);t[heads[n]['y']:heads[n]['y']+hi.shape[0],heads[n]['x']:heads[n]['x']+hi.shape[1]]=hi;HM=np.minimum(HM,t)
stub=np.asarray(Image.fromarray((HM*255).astype(np.uint8)).filter(ImageFilter.MinFilter(13)).filter(ImageFilter.GaussianBlur(2))).astype(np.float32)/255*(yy>150)
sa=stub*(Bd[...,3]<40)*(B[...,3]>40)
col=np.array([86,40,16],np.float32)+((yy-150)/100)[...,None]*np.array([40,20,8],np.float32)
for c in range(3):Bd[...,c]=np.where(sa>0,col[...,c],Bd[...,c])
Bd[...,3]=np.maximum(Bd[...,3],sa*255)
Bd[...,3]=np.where((xx<152)&(yy<224),0,Bd[...,3])   # a stroke of the arm cut left of the head
Image.fromarray(np.clip(Bd,0,255).astype(np.uint8),'RGBA').save(S+'/L_body.png')
# exploded preview
sh=Image.new('RGB',(W*3+40,H),'#5a4a7a')
for i,f in enumerate(['L_arm','L_body']):
    im=Image.open(f'{S}/{f}.png');sh.paste(im,(i*(W+20),0),im)
h=Image.open(S+'/head-hype.png');sh.paste(h,(2*(W+20)+x,y),h)
sh.save(S+'/layers.png')
