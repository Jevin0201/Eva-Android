"""Compile the production URL normalizer and exercise real address input cases."""
from pathlib import Path
import subprocess,tempfile,os
root=Path(__file__).resolve().parents[1]
jdk=root/'downloads/jdk/jdk-17.0.21+9/Contents/Home/bin'
base=root/'artifacts/desktop-browser-20261108';base.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='address-check-',dir=base) as folder:
 p=Path(folder);source=p/'AddressCheck.java'
 source.write_text('''package ai.eva.android.probe;
public class AddressCheck {public static void main(String[] args){
String[][] cases={{"http://example.com/a","http://example.com/a"},{" example.com/a ","https://example.com/a"},{"HTTPS://example.com/a","HTTPS://example.com/a"},{"localhost:8080/a","http://localhost:8080/a"},{"192.168.1.2:8080","http://192.168.1.2:8080"},{"//example.com/a","https://example.com/a"},{"http://[::1]:8080/a","http://[::1]:8080/a"},{"about:blank","about:blank"},{"https://例子.测试/课程","https://xn--fsqu00a.xn--0zwm56d/%E8%AF%BE%E7%A8%8B"},{"https://example.com/a b","https://example.com/a%20b"}};
for(String[] c:cases){String actual=BrowserAddress.normalize(c[0]);if(!actual.equals(c[1]))throw new AssertionError(c[0]+" -> "+actual);}
for(String bad:new String[]{"","https://","http://example.com:99999","javascript:alert(1)","https://user:pass@example.com","http://example.com/\\ninvalid"}){boolean rejected=false;try{BrowserAddress.normalize(bad);}catch(IllegalArgumentException expected){rejected=true;}if(!rejected)throw new AssertionError(bad);}
System.out.println("PASS 10 valid addresses and 6 invalid addresses");}}
''')
 subprocess.run([str(jdk/'javac'),'-encoding','UTF-8','--release','8','-d',folder,str(root/'probe/src/BrowserAddress.java'),str(source)],check=True)
 subprocess.run([str(jdk/'java'),'-cp',folder,'ai.eva.android.probe.AddressCheck'],check=True)
