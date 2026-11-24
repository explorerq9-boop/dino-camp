import json,struct,io,sys,glob
from PIL import Image
def shrink(path,out,maxs=512):
    b=open(path,'rb').read(); l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l]); o=20+l
    bl=struct.unpack('<I',b[o:o+4])[0]; bin_=b[o+8:o+8+bl]
    views=j['bufferViews']; imgv={im['bufferView']:im for im in j.get('images',[]) if 'bufferView' in im}
    chunks=[]; newviews=[]; off=0
    for i,v in enumerate(views):
        data=bin_[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        if i in imgv:
            im=Image.open(io.BytesIO(data)); im.thumbnail((maxs,maxs)); bio=io.BytesIO()
            if im.mode in('RGBA','LA','P'): im.save(bio,'PNG',optimize=True); imgv[i]['mimeType']='image/png'
            else: im.convert('RGB').save(bio,'JPEG',quality=82); imgv[i]['mimeType']='image/jpeg'
            data=bio.getvalue()
        while off%4: chunks.append(b'\0'); off+=1
        nv=dict(v); nv['byteOffset']=off; nv['byteLength']=len(data); newviews.append(nv); chunks.append(data); off+=len(data)
    while off%4: chunks.append(b'\0'); off+=1
    j['bufferViews']=newviews; j['buffers'][0]['byteLength']=off
    js=json.dumps(j).encode(); js+=b' '*((4-len(js)%4)%4); binb=b''.join(chunks)
    out_b=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(binb))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(binb),0x004E4942)+binb
    open(out,'wb').write(out_b)
for f in glob.glob('assets_src/mega/*.glb'):
    shrink(f,f.replace('assets_src','assets'))
