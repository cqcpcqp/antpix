"""Create a paginated, offline image review and Markdown contact-sheet index."""
import json,argparse,html
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);args=p.parse_args()
source=args.source.resolve();out=source/'review-48x60'
entries=sorted(json.loads((source/'manifest.json').read_text()),key=lambda e:e['level'])
for e in entries:
    assert (out/f"{e['id']}-comparison.jpg").exists(),e['id']
    assert (out/f"{e['id']}-48x60.png").exists(),e['id']
data=json.dumps([dict(level=e['level'],name=e['name'],colors=e['colors'],id=e['id'],file=e['file'],approved=e['approved']) for e in entries],ensure_ascii=False).replace('</','<\\/')
approved_count=sum(e['approved'] for e in entries)
status=f'{len(entries)} 张图片中已验收 {approved_count} 张，待确认 {len(entries)-approved_count} 张。'
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>关卡图片验收</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f6f4eb;color:#243c35;font:16px/1.6 system-ui,sans-serif}header,main,footer{max-width:1400px;margin:auto;padding:24px}header{padding-top:40px}h1{margin:0;font-size:32px}p{color:#596c62}nav{display:flex;gap:12px;align-items:center;flex-wrap:wrap}button,select{font:inherit;border:1px solid #cbd5c9;background:white;color:#243c35;padding:10px 16px;border-radius:10px}button{cursor:pointer}button:disabled{opacity:.35;cursor:default}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}article{background:#fffaf0;border:1px solid #e0e1d2;border-radius:16px;overflow:hidden}h2{font-size:19px;margin:16px 18px 0}.tag{margin:0 18px 14px;font-size:14px;color:#738070}img{display:block;width:100%;height:auto}a{color:#246852}footer{text-align:center}@media(max-width:850px){main{grid-template-columns:1fr}h1{font-size:26px}}</style>
<header><h1>关卡图片验收</h1><p>每张左侧是 AI 原图，右侧是对应色数的 48×60 像素图。点击图片可以放大。__STATUS__</p><p>已确认阶段：1–30 关 10–12 色 · 31–70 关 13–18 色 · 71–100 关 19–24 色。</p><nav><button id="prev">上一组</button><select id="pages" aria-label="选择关卡范围"></select><button id="next">下一组</button><span id="count" aria-live="polite"></span></nav></header><main id="gallery"></main><footer><button id="bottom">下一组</button><p>__FOOTER__</p></footer>
<script>const levels=__DATA__;let page=0;const pages=document.getElementById('pages'),gallery=document.getElementById('gallery');
for(let i=0;i<levels.length;i+=10){const option=document.createElement('option');option.value=i/10;option.textContent=`第 ${levels[i].level}–${levels[Math.min(i+9,levels.length-1)].level} 关`;pages.append(option)}
function render(){pages.value=page;gallery.replaceChildren();for(const level of levels.slice(page*10,page*10+10)){const article=document.createElement('article');const heading=document.createElement('h2');heading.textContent=`第 ${level.level} 关 · ${level.name}`;const tag=document.createElement('p');tag.className='tag';tag.textContent=`48 × 60 · ${level.colors} 色 · ${level.approved?'已验收':'待确认'}`;const link=document.createElement('a');link.href=`${level.id}-comparison.jpg`;link.target='_blank';const img=document.createElement('img');img.src=link.href;img.alt=`第 ${level.level} 关 ${level.name} 原图与像素图对照`;img.loading='lazy';img.width=660;img.height=440;link.append(img);const links=document.createElement('p');links.className='tag';const original=document.createElement('a');original.textContent='原图';original.href='../'+level.file;original.target='_blank';const pixel=document.createElement('a');pixel.textContent='48×60 像素图';pixel.href=level.id+'-48x60.png';pixel.target='_blank';links.append(original,document.createTextNode(' · '),pixel);article.append(heading,tag,link,links);gallery.append(article)}document.getElementById('prev').disabled=page===0;document.getElementById('next').disabled=document.getElementById('bottom').disabled=page===pages.options.length-1;document.getElementById('count').textContent=`第 ${page+1} / ${pages.options.length} 组`;}
function change(delta){page+=delta;render();window.scrollTo({top:0,behavior:'smooth'})}pages.onchange=()=>{page=Number(pages.value);render()};document.getElementById('prev').onclick=()=>change(-1);document.getElementById('next').onclick=document.getElementById('bottom').onclick=()=>change(1);render();</script></html>'''.replace('__DATA__',data).replace('__STATUS__',status).replace('__FOOTER__','本批图片已全部通过用户验收。' if approved_count==len(entries) else '请在聊天中确认待验收图片，或指出需要调整的关卡编号。')
(out/'index.html').write_text(page)
lines=['# 关卡图片验收','', status+'每组左侧为原图，右侧为 48×60 像素图。','',f'[打开分页对照画册]({out}/index.html)','', '已确认色数：第 1–30 关 10–12 色，第 31–70 关 13–18 色，第 71–100 关 19–24 色。','']
for start in range(0,len(entries),10):
    batch=entries[start:start+10];first,last=batch[0]['level'],batch[-1]['level'];image=out/('contact-sheet.jpg' if len(entries)<=10 else f'contact-{first:03d}-{last:03d}.jpg')
    assert image.exists()
    lines += [f'## 第 {first}–{last} 关','',f'![第 {first}–{last} 关原图与像素图]({image})','', '| 关卡 | 题材 | 色数 |','| --- | --- | --- |']
    lines += [f"| {e['level']} | [{e['name']}]({out}/{e['id']}-comparison.jpg) | {e['colors']} |" for e in batch]
    lines += ['']
(out/'README.md').write_text('\n'.join(lines)+'\n')
print(out/'README.md')
