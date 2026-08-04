import socket, struct, random

def dns_query(ns, domain, qtype):
    qname = b''.join(bytes([len(l)]) + l.encode() for l in domain.split('.')) + b'\x00'
    tid = random.randint(0, 65535)
    pkt = struct.pack('>HHHHHH', tid, 0x0100, 1, 0, 0, 0) + qname + struct.pack('>HH', qtype, 1)
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(5)
    s.sendto(pkt, (ns, 53))
    try:
        resp, _ = s.recvfrom(4096)
    except socket.timeout:
        return None
    flags = struct.unpack('>H', resp[2:4])[0]
    rcode = flags & 0xF
    ancount = struct.unpack('>H', resp[6:8])[0]
    return {'rcode': rcode, 'ancount': ancount}

for ns in ['arvind.ns.cloudflare.com', 'deb.ns.cloudflare.com']:
    for qtype, name in [(6, 'SOA'), (1, 'A'), (28, 'AAAA')]:
        r = dns_query(ns, 'mowgo.app', qtype)
        print(ns, name, r)
