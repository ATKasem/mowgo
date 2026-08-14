import json, sys

path = sys.argv[1]
ids = set(sys.argv[2:])
with open(path) as f:
    data = json.load(f)
for m in data['messages']:
    if m['id'] in ids:
        print(f"===== {m['id']} | {m['timestamp']} =====")
        print(m['content'])
        print()
