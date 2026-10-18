import math, random, sys

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 7
random.seed(SEED)

BASE = (100.0, 186.0)
STEMS = 15            # main canes from the base
W0, W1 = 4.2, 0.1     # width at base, width at tips
SEG = 7.0             # segment length
BRANCH_P = 0.25        # chance a cane forks
WOBBLE, ASKEW = 0.04, 0.7   # angle jitter near base vs. near tips

stems = []  # list of (points, widths)

def grow(x, y, ang, length, w_start, depth):
    n = max(3, round(length / SEG))
    pts, ws = [(x, y)], [w_start]
    forks = []
    for i in range(1, n + 1):
        t = i / n
        ang += random.gauss(0, WOBBLE + ASKEW * t ** 3)
        x += math.sin(ang) * SEG
        y -= math.cos(ang) * SEG
        pts.append((x, y))
        ws.append(w_start + (W1 - w_start) * t)
        if depth < 2 and 0.3 < t < 0.75 and not forks and random.random() < BRANCH_P / (n * 0.45):
            forks.append((x, y, ang, length * (1 - t), ws[-1], depth))
    stems.append((pts, ws))
    for fx, fy, fa, rem, fw, d in forks:
        for side in random.sample([-1, 1], k=random.choice([1, 2])):
            grow(fx, fy, fa + side * random.uniform(0.3, 0.65),
                 rem * random.uniform(0.8, 1.15), fw, d + 1)

for k in range(STEMS):
    spread = (k / (STEMS - 1) - 0.5) * 2          # -1 .. 1
    ang = spread * 0.7 + random.gauss(0, 0.06)
    length = random.uniform(165, 215) * (1 - 0.3 * abs(spread))
    bx = BASE[0] + random.uniform(-4, 4)
    grow(bx, BASE[1], ang, length, W0 * random.uniform(0.8, 1.05), 0)

# fit everything inside the canvas, scaling about the base
xs = [p[0] for s, _ in stems for p in s]; ys = [p[1] for s, _ in stems for p in s]
M = 6
sc = min(1, (BASE[1] - M) / (BASE[1] - min(ys)),
         (BASE[0] - M) / max(1e-9, BASE[0] - min(xs)),
         (200 - M - BASE[0]) / max(1e-9, max(xs) - BASE[0]))
fit = lambda p: (BASE[0] + (p[0] - BASE[0]) * sc, BASE[1] + (p[1] - BASE[1]) * sc)

def outline(pts, ws):
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        dirs = []
        if i > 0: dirs.append((x - pts[i-1][0], y - pts[i-1][1]))
        if i < len(pts) - 1: dirs.append((pts[i+1][0] - x, pts[i+1][1] - y))
        dx = sum(d[0] / math.hypot(*d) for d in dirs)
        dy = sum(d[1] / math.hypot(*d) for d in dirs)
        n = math.hypot(dx, dy) or 1
        hw = ws[i] * sc ** 0.5 / 2
        left.append((x - dy / n * hw, y + dx / n * hw))
        right.append((x + dy / n * hw, y - dx / n * hw))
    return left + [pts[-1]] + right[::-1]

f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
print('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">')
print('  <title>Ocotillo</title>')
print('  <g fill="#000" stroke="#000" stroke-width="0.5" stroke-linejoin="round">')
for pts, ws in stems:
    d = outline([fit(p) for p in pts], ws)
    print('    <path d="M' + " L".join(f"{f(a)},{f(b)}" for a, b in d) + 'Z"/>')
print('  </g>')
print('</svg>')
print(f"stems={len(stems)} scale={sc:.2f}", file=sys.stderr)
