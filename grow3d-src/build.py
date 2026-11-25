import base64,glob,os,subprocess,sys,json
mode=sys.argv[1] if len(sys.argv)>1 else 'dev'
subprocess.run(['npx','esbuild','src/main.js','--bundle','--format=iife','--minify','--target=es2020,safari15,chrome90','--outfile=game.js','--log-level=warning'],check=True,cwd='/tmp/g3')
t=open('/tmp/g3/template.html').read(); js=open('/tmp/g3/game.js').read().replace('</script','<\\/script')
if mode=='dist':
    A={}
    for f in sorted(glob.glob('/tmp/g3/assets/*/*.glb')):
        A[os.path.relpath(f,'/tmp/g3/assets')]=base64.b64encode(open(f,'rb').read()).decode()
    t=t.replace('<!--ASSETS-->','<script>window.ASSETS='+json.dumps(A)+';</script>')
    out='/tmp/g3/dist.html'
elif mode=='web':
    t=t.replace('<!--ASSETS-->','<script>window.ASSET_BASE="grow-assets/";</script>'); out='/tmp/g3/web.html'
else:
    t=t.replace('<!--ASSETS-->',''); out='/tmp/g3/index.html'
open(out,'w').write(t.replace('/*GAME*/',js)); print(out, os.path.getsize(out)//1024,'KB')
