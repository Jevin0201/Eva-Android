import pathlib,struct,socket
root=pathlib.Path('artifacts/network-capture');root.mkdir(parents=True,exist_ok=True)
def ip(payload,protocol):return b'\x45\0'+struct.pack('>H',20+len(payload))+b'\0\0\0\0\x40'+bytes([protocol])+b'\0\0'+socket.inet_aton('192.0.2.10')+socket.inet_aton('203.0.113.10')+payload
def tcp(payload,port):return ip(struct.pack('>HHIIHHHH',40000,port,1,1,0x5018,65535,0,0)+payload,6)
name=b'fixture.example';names=b'\0'+struct.pack('>H',len(name))+name;extbody=struct.pack('>H',len(names))+names;ext=b'\0\0'+struct.pack('>H',len(extbody))+extbody;body=b'\3\3'+b'X'*32+b'\0\0\2\x13\1\1\0'+struct.pack('>H',len(ext))+ext;hello=b'\1'+len(body).to_bytes(3,'big')+body;tls=b'\x16\3\1'+struct.pack('>H',len(hello))+hello
dns=struct.pack('>HHHHHH',1,0x100,1,0,0,0)+b'\7fixture\7example\0\0\1\0\1'
frames=[tcp(b'GET /test?private=fixture_secret HTTP/1.1\r\nAuthorization: Bearer fixture_secret\r\n\r\n',80),tcp(tls,443),ip(struct.pack('>HHHH',41000,53,8+len(dns),0)+dns,17)]
header=struct.pack('<IHHIIII',0xa1b2c3d4,2,4,0,0,65535,101);records=b''.join(struct.pack('<IIII',1700000000,0,len(f),len(f))+f for f in frames);(root/'fixture.pcap').write_bytes(header+records);(root/'truncated.pcap').write_bytes(header+records+b'bad');(root/'not-pcap.bin').write_bytes(b'not packet capture')
