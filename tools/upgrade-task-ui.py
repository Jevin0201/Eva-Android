from pathlib import Path
p=Path('runtime/task_runner.py');s=p.read_text(encoding='utf-8-sig').replace('cancel_file=None):','cancel_file=None, on_event=None):');s=s.replace("f.flush()\n        def snapshot", "f.flush()\n            if on_event is not None:\n                on_event(dict(seq=sequence, taskId=task_id, type=kind, **fields))\n        def snapshot");p.write_text(s,encoding='utf8')
p=Path('runtime/eva-command.py');p.write_text('''import codecs,base64,json,os,sys
from task_runner import TaskRunner
os.environ['PATH']='/usr/bin:/bin:/usr/sbin:/sbin'
decoders={s:codecs.getincrementaldecoder('utf8')(errors='replace') for s in ('stdout','stderr')}
def update(event):
 if event['type']=='output':
  stream=event['stream']
  text=decoders[stream].decode(base64.b64decode(event['base64']))
  print(json.dumps({'type':'output','stream':stream,'text':text},ensure_ascii=False),flush=True)
 else:
  print(json.dumps(event,ensure_ascii=False),flush=True)
r=TaskRunner('/root/eva-tasks')
result=r.run(['/bin/sh','-c',sys.argv[1]],'/root/eva-workspace',timeout=120,cancel_file=sys.argv[2],on_event=update)
for stream,decoder in decoders.items():
 tail=decoder.decode(b'',final=True)
 if tail: print(json.dumps({'type':'output','stream':stream,'text':tail},ensure_ascii=False),flush=True)
print(json.dumps({'type':'result',**result},ensure_ascii=False),flush=True)
sys.exit(0 if result['state']=='succeeded' else 1)
''',encoding='utf8')
p=Path('probe/src/LocalToolsActivity.java');s=p.read_text(encoding='utf-8-sig');s=s.replace('    TextView output;', '    TextView output, taskState;')
s=s.replace('command.setText("python3 --version; node --version; git --version")','command.setText(getPreferences(0).getString("command","python3 --version; node --version; git --version"))')
s=s.replace('body.addView(bar);','bar.addView(button("历史",()->showHistory()));body.addView(bar);taskState=new TextView(this);taskState.setText("就绪");taskState.setTextSize(12);body.addView(taskState);')
s=s.replace('scroll.addView(output);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));','try{File previous=new File(getFilesDir(),"last-command.txt");if(previous.isFile())output.setText(new String(Files.readAllBytes(previous.toPath()),"UTF-8"));}catch(Exception ignored){}scroll.addView(output);body.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));')
s=s.replace('running=true;output.setText("执行中…");','running=true;output.setText("");taskState.setText("正在启动任务");getPreferences(0).edit().putString("command",text).apply();')
a=s.index('Process p=pb.start();');b=s.index('        }catch(Exception e)',a)
s=s[:a]+'''Process p=pb.start();StringBuilder result=new StringBuilder();String finalState="unknown";
            try(BufferedReader reader=new BufferedReader(new InputStreamReader(p.getInputStream(),"UTF-8"))){String line;while((line=reader.readLine())!=null){
                try{org.json.JSONObject event=new org.json.JSONObject(line);String type=event.optString("type");
                    if(type.equals("output")){String chunk=event.optString("text");int remaining=150000-result.length();if(remaining>0)result.append(chunk.substring(0,Math.min(remaining,chunk.length())));String update=result.toString();runOnUiThread(()->output.setText(update));}
                    else if(type.equals("started")){String taskId=event.optString("taskId");runOnUiThread(()->taskState.setText("执行中 · "+taskId.substring(0,8)));}
                    else if(type.equals("result")){finalState=event.optString("state");String status=finalState+" · 退出码 "+event.optInt("exitCode");runOnUiThread(()->taskState.setText(status));}
                }catch(org.json.JSONException malformed){result.append(line).append('\\n');}
            }}
            int code=p.waitFor();String done=result+"\\n状态："+finalState+" · 执行器退出码："+code;
            File temp=new File(getFilesDir(),"last-command.tmp");Files.write(temp.toPath(),done.getBytes("UTF-8"));Files.move(temp.toPath(),new File(getFilesDir(),"last-command.txt").toPath(),StandardCopyOption.REPLACE_EXISTING);runOnUiThread(()->output.setText(done));
''' +s[b:]
pos=s.index('    void files()')
s=s[:pos]+'''    void showHistory(){if(running)return;File folder=new File(getFilesDir(),"alpine/root/eva-tasks");File[] tasks=folder.listFiles();if(tasks==null)return;java.util.Arrays.sort(tasks,(a,b)->Long.compare(b.lastModified(),a.lastModified()));java.util.ArrayList<String> labels=new java.util.ArrayList<>();java.util.ArrayList<File> selected=new java.util.ArrayList<>();for(File task:tasks){try{org.json.JSONObject state=new org.json.JSONObject(new String(Files.readAllBytes(new File(task,"state.json").toPath()),"UTF-8"));labels.add(state.optString("state")+" · "+state.optJSONArray("argv").optString(2));selected.add(task);}catch(Exception ignored){}}new AlertDialog.Builder(this).setTitle("本机任务历史").setItems(labels.toArray(new String[0]),(dialog,n)->{try{StringBuilder text=new StringBuilder();java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();for(String line:Files.readAllLines(new File(selected.get(n),"events.jsonl").toPath())){org.json.JSONObject e=new org.json.JSONObject(line);if(e.optString("type").equals("output")&&bytes.size()<150000)bytes.write(android.util.Base64.decode(e.getString("base64"),android.util.Base64.DEFAULT));}text.append(bytes.toString("UTF-8"));output.setText(text);taskState.setText(labels.get(n));}catch(Exception e){output.setText(e.toString());}}).setNegativeButton("关闭",null).show();}
''' +s[pos:];p.write_text(s,encoding='utf8')
