# Dev helper: generate + validate the authored Typemon overworld maps as ASCII.
# Prints the exact row strings to embed in src/domain/overworld.js.
import sys

def build_outdoor():
    W, H = 24, 18
    g = [['.' for _ in range(W)] for _ in range(H)]
    def setc(r, c, ch): g[r][c] = ch
    def rect(r0, c0, r1, c1, ch):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1): g[r][c] = ch
    for c in range(W): setc(0, c, '#'); setc(H - 1, c, '#')
    for r in range(H): setc(r, 0, '#'); setc(r, W - 1, '#')
    rect(2, 3, 3, 4, 'H')            # house walls
    setc(4, 3, 'D')                  # door
    rect(1, 11, 3, 15, ',')          # tall grass A (near)
    rect(7, 16, 9, 19, '~')          # water pond
    rect(12, 4, 14, 8, ';')          # tall grass B (far)
    for (r, c) in [(4, 20), (10, 7), (15, 17), (6, 20)]: setc(r, c, 'o')
    rect(6, 1, 7, 2, '#')            # tree clump
    rect(15, 20, 16, 22, '#')        # tree clump
    for r in range(5, 11): setc(r, 3, '-')       # path down from start
    for c in range(4, 21): setc(10, c, '-')      # bottom path
    for r in range(11, 16): setc(r, 20, '-')     # path down to cave
    for c in range(4, 13): setc(5, c, '-')       # branch right from start
    setc(4, 12, '-')                             # front of grass A
    setc(16, 20, 'C')                            # cave entrance
    return g, W, H

def build_cave():
    W, H = 16, 11
    g = [['-' for _ in range(W)] for _ in range(H)]
    def setc(r, c, ch): g[r][c] = ch
    def rect(r0, c0, r1, c1, ch):
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1): g[r][c] = ch
    for c in range(W): setc(0, c, '#'); setc(H - 1, c, '#')
    for r in range(H): setc(r, 0, '#'); setc(r, W - 1, '#')
    rect(4, 7, 5, 10, '~')           # underground pool
    for (r, c) in [(2, 4), (6, 8), (8, 6), (3, 12)]: setc(r, c, 'o')
    setc(8, 2, 'X')                  # cave mouth (exit back to route)
    setc(2, 12, 'B')                 # boss
    return g, W, H

def check(g, W, H, name):
    assert all(len(r) == W for r in g), name + " not rectangular"
    for r in range(H):
        for c in range(W):
            if r in (0, H - 1) or c in (0, W - 1):
                assert g[r][c] == '#', name + " border leak at %d,%d" % (r, c)
    return ''.join(''.join(r) for r in g)

out, W, H = build_outdoor()
cave, CW, CH = build_cave()
fo = check(out, W, H, "outdoor")
fc = check(cave, CW, CH, "cave")
for need in [',', ';', '~', 'o', 'C', 'D', 'H']:
    assert need in fo, "outdoor missing " + need
for need in ['~', 'o', 'X', 'B']:
    assert need in fc, "cave missing " + need
assert out[5][3] == '-'
# BFS reachability from spawn (5,3) over walkable tiles
def walk(ch): return ch not in {'#', '~', 'o', 'H', 'D', 'C'}
def bfs(g, W, H, s):
    seen = {s}; q = [s]
    while q:
        r, c = q.pop()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < H and 0 <= nc < W and (nr, nc) not in seen and walk(g[nr][nc]):
                seen.add((nr, nc)); q.append((nr, nc))
    return seen
ro = bfs(out, W, H, (5, 3))
assert (1, 12) in ro, "grass A not reachable"
assert (12, 5) in ro, "grass B not reachable"
assert (15, 20) in ro, "cave front not reachable"
rc = bfs(cave, CW, CH, (8, 2))
assert (3, 11) in rc, "boss area not reachable in cave"
print("=== OUTDOOR", W, "x", H, "===")
for row in out: print('  "' + ''.join(row) + '",')
print("=== CAVE", CW, "x", CH, "===")
for row in cave: print('  "' + ''.join(row) + '",')
print("ALL CHECKS OK")
