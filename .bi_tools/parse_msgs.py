import json, sys

path = sys.argv[1] if len(sys.argv) > 1 else '/tmp/hermes-results/call_00_y7SsMc0mhh5wDDOG20qO7674.txt'
with open(path) as f:
    data = json.load(f)
msgs = data['messages']
print(f"TOTAL: {len(msgs)} messages | count field: {data.get('count')}")
for m in msgs:
    ts = m['timestamp']
    auth = m['author']['username']
    bot = m['author'].get('bot', False)
    content = m['content'].replace('\n', ' | ')[:250]
    print(f"{m['id']} | {ts} | {'BOT' if bot else 'HUMAN'} {auth} | {content}")
