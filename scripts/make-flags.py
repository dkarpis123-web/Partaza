"""Small language flags for the language menu (3x of 24x16)."""
from PIL import Image, ImageDraw
W, H = 72, 48
def stripes(name, colors):
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im); h = H / len(colors)
    for i, c in enumerate(colors): d.rectangle([0, round(i*h), W, round((i+1)*h)], fill=c)
    im.save(f'assets/flags/{name}.png')
stripes('lt', ['#FDB913', '#006A44', '#C1272D'])
stripes('et', ['#0072CE', '#000000', '#FFFFFF'])
stripes('pl', ['#FFFFFF', '#DC143C'])
stripes('de', ['#000000', '#DD0000', '#FFCE00'])
stripes('ru', ['#FFFFFF', '#0039A6', '#D52B1E'])
# France: vertical blue, white, red
im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
for i, c in enumerate(['#002654', '#FFFFFF', '#CE1126']): d.rectangle([round(i*W/3), 0, round((i+1)*W/3), H], fill=c)
im.save('assets/flags/fr.png')
# Spain: red, yellow (double), red - without the coat of arms, which is unreadable at this size
im = Image.new('RGB', (W, H), '#AA151B'); d = ImageDraw.Draw(im); d.rectangle([0, H//4, W, H*3//4 - 1], fill='#F1BF00'); im.save('assets/flags/es.png')
# Latvia: carmine, white, carmine in 2:1:2
im = Image.new('RGB', (W, H), '#9E3039'); d = ImageDraw.Draw(im); d.rectangle([0, round(H*2/5), W, round(H*3/5)-1], fill='#FFFFFF'); im.save('assets/flags/lv.png')
# United Kingdom, drawn large and scaled down for smooth edges
S = 10; w, h = W*S, H*S
im = Image.new('RGB', (w, h), '#012169'); d = ImageDraw.Draw(im)
d.line([(0, 0), (w, h)], fill='#FFFFFF', width=int(h*0.2)); d.line([(0, h), (w, 0)], fill='#FFFFFF', width=int(h*0.2))
d.line([(0, 0), (w, h)], fill='#C8102E', width=int(h*0.067)); d.line([(0, h), (w, 0)], fill='#C8102E', width=int(h*0.067))
d.rectangle([w/2-h*0.167, 0, w/2+h*0.167, h], fill='#FFFFFF'); d.rectangle([0, h/2-h*0.167, w, h/2+h*0.167], fill='#FFFFFF')
d.rectangle([w/2-h*0.1, 0, w/2+h*0.1, h], fill='#C8102E'); d.rectangle([0, h/2-h*0.1, w, h/2+h*0.1], fill='#C8102E')
im.resize((W, H), Image.LANCZOS).save('assets/flags/en.png')
