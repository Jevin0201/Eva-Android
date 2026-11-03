package ai.eva.android.probe;
import android.app.*;import android.content.*;import android.os.*;import android.provider.Settings;import com.k2fsa.sherpa.onnx.*;import java.io.*;import java.util.*;

/** On-device checks. Only gallery and agent modes explicitly submit tasks; acoustic diagnostics never do. */
public final class VoiceCheck extends BrowserWindowCheck {
 Bundle args;
 static float[] fixture(File file)throws Exception{
  byte[] raw=java.nio.file.Files.readAllBytes(file.toPath());int offset=12,len=0;
  while(offset+8<=raw.length){String tag=new String(raw,offset,4,"US-ASCII");int size=(raw[offset+4]&255)|((raw[offset+5]&255)<<8)|((raw[offset+6]&255)<<16)|((raw[offset+7]&255)<<24);offset+=8;if(tag.equals("data")){len=size;break;}if(size<0||offset+size>raw.length)throw new Exception("Invalid WAV chunk");offset+=size+(size%2);}
  if(len<=0||offset+len>raw.length)throw new Exception("Invalid fixture WAV");float[] samples=new float[len/2+48000];for(int i=0;i<len/2;i++)samples[i]=(short)((raw[offset+i*2]&255)|(raw[offset+i*2+1]<<8))/32768f;return samples;
 }
 public void onCreate(Bundle b){args=b;start();}
 public void onStart(){Bundle out=new Bundle();int code=0;KeywordSpotter kws=null;OnlineRecognizer asr=null;OnlineStream ks=null,as=null;
  try{
   Context c=getTargetContext();String mode=args==null?"models":args.getString("mode","models");
   if(mode.equals("guards")){
    String[][] cases={{"你好艾瓦","EMPTY"},{"你好Eva","EMPTY"},{"嗯那个","EMPTY"},{"我想让你","INCOMPLETE"},{"帮我打开","INCOMPLETE"},{"打开相册然后","INCOMPLETE"},{"打开相册我还没说完","INCOMPLETE"},{"打开相册","READY"},{"今天天气怎么样","READY"},{"明天的安排","UNCERTAIN"},{"取消","CANCEL"}};
    for(String[] item:cases)if(!VoiceCommandPolicy.classify(item[0]).name().equals(item[1]))throw new Exception("Policy mismatch: "+item[0]);
    if(VoiceCommandPolicy.explicitFinish("我还没说完了")||!VoiceCommandPolicy.explicitFinish("打开相册，说完了"))throw new Exception("Finish marker mismatch");
    VoiceActivity a=(VoiceActivity)startActivitySync(new Intent(c,VoiceActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));runOnMainSync(()->a.start(false));long until=SystemClock.elapsedRealtime()+30000;while(SystemClock.elapsedRealtime()<until&&(VoiceService.live==null||!VoiceService.live.ready))Thread.sleep(200);
    if(VoiceService.live==null||!VoiceService.live.ready)throw new Exception("Service unavailable");
    runOnMainSync(()->{VoiceService s=VoiceService.live;s.audio.pause();a.refreshState();if(!a.wakeSwitch.isChecked())throw new AssertionError("Switch does not reflect service");for(int i=0;i<4;i++)if(!a.permissionBadges[i].getText().toString().equals(a.permissionGranted[i]?"✓":"？"))throw new AssertionError("Permission badge mismatch");s.textResult("你好艾瓦",false,true);if(VoiceAgent.busy||s.state.equals("working"))throw new AssertionError("Wake submitted");s.ui.removeCallbacks(s.returnToIdle);s.textResult("帮我打开",false,true);if(!s.state.equals("review")||VoiceAgent.busy)throw new AssertionError("Incomplete submitted");s.textResult("打开相册",false,false);if(!s.state.equals("review")||VoiceAgent.busy)throw new AssertionError("Duration limit submitted");s.textResult("明天的安排",false,true);if(!s.state.equals("review")||VoiceAgent.busy)throw new AssertionError("Uncertain submitted");});
    runOnMainSync(()->{android.content.SharedPreferences p=c.getSharedPreferences("eva-voice",0);boolean before=p.getBoolean("autoSend",true);try{p.edit().putBoolean("autoSend",false).commit();VoiceService.live.textResult("打开相册",true,true);if(!VoiceService.live.state.equals("review")||VoiceAgent.busy)throw new AssertionError("Manual review preference bypassed");}finally{p.edit().putBoolean("autoSend",before).commit();}});
    runOnMainSync(()->a.stopVoice());Thread.sleep(700);runOnMainSync(()->{a.refreshState();if(a.wakeSwitch.isChecked())throw new AssertionError("Switch remains on");});
    out.putString("result","PASS 11 phrase guards, explicit finish, no wake/incomplete/uncertain/timeout submission, actual service switches and permission badges");
   }else if(mode.equals("gallery")){
    VoiceActivity a=(VoiceActivity)startActivitySync(new Intent(c,VoiceActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));runOnMainSync(()->a.start(true));long until=SystemClock.elapsedRealtime()+30000;while(SystemClock.elapsedRealtime()<until&&(VoiceService.live==null||!VoiceService.live.state.equals("listening")))Thread.sleep(200);
    if(VoiceService.live==null||!VoiceService.live.state.equals("listening"))throw new Exception("Microphone did not start");Thread.sleep(1000);
    android.media.MediaPlayer player=new android.media.MediaPlayer();try{player.setDataSource(new File(c.getFilesDir(),"voice-command.wav").getAbsolutePath());player.prepare();player.start();Thread.sleep(player.getDuration()+500L);}finally{player.release();}
    String opened="";until=SystemClock.elapsedRealtime()+120000;while(SystemClock.elapsedRealtime()<until){PhoneAccessibility service=PhoneAccessibility.live;if(service!=null){android.view.accessibility.AccessibilityNodeInfo root=service.getRootInActiveWindow();if(root!=null){String pkg=String.valueOf(root.getPackageName());root.recycle();if(pkg.equals("com.miui.gallery")||pkg.equals("com.google.android.apps.photos"))opened=pkg;}}if(!opened.isEmpty()&&!VoiceAgent.busy)break;Thread.sleep(100);}
    out.putString("recognized",VoiceService.live==null?"":VoiceService.live.transcript);out.putString("openedPackage",opened);out.putString("thread",VoiceAgent.thread);
    if(opened.isEmpty()||VoiceAgent.thread.isEmpty()||VoiceAgent.busy)throw new Exception("Gallery execution not verified");
    out.putString("result","PASS microphone instruction to cloud agent, observed gallery foreground package; no photo contents read by test");
   }else if(mode.equals("delayed")||mode.equals("fragments")){
    VoiceActivity a=(VoiceActivity)startActivitySync(new Intent(c,VoiceActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));runOnMainSync(()->a.start(mode.equals("fragments")));long until=SystemClock.elapsedRealtime()+30000;while(SystemClock.elapsedRealtime()<until&&(VoiceService.live==null||!VoiceService.live.ready))Thread.sleep(200);
    if(VoiceService.live==null||!VoiceService.live.ready)throw new Exception("Service unavailable");runOnMainSync(()->VoiceService.live.diagnosticOnly=true);Thread.sleep(1000);
    android.media.MediaPlayer player=null;if(!mode.equals("fragments")){player=new android.media.MediaPlayer();try{player.setDataSource(new File(c.getFilesDir(),"voice-wake.wav").getAbsolutePath());player.prepare();player.start();Thread.sleep(player.getDuration()+500L);}finally{player.release();}}
    until=SystemClock.elapsedRealtime()+5000;while(VoiceService.live.wakeCount==0&&SystemClock.elapsedRealtime()<until)Thread.sleep(100);
    if(VoiceService.live.wakeCount==0)throw new Exception("Wake not detected");Thread.sleep(5000);
    if(!VoiceService.live.state.equals("listening")||VoiceService.live.diagnosticTranscript!=null||VoiceAgent.busy)throw new Exception("Wake-only did not wait: "+VoiceService.live.state+" / "+VoiceService.live.diagnosticTranscript);
    out.putString("afterFiveSeconds","still listening, no task submitted");
    if(mode.equals("fragments")){
     player=new android.media.MediaPlayer();try{player.setDataSource(new File(c.getFilesDir(),"voice-fragment.wav").getAbsolutePath());player.prepare();player.start();Thread.sleep(player.getDuration()+5000L);}finally{player.release();}
     if(!VoiceService.live.state.equals("listening")||VoiceService.live.diagnosticTranscript!=null||VoiceAgent.busy)throw new Exception("Incomplete phrase did not wait");out.putString("incompleteHeard",VoiceService.live.transcript);
    }
    player=new android.media.MediaPlayer();try{player.setDataSource(new File(c.getFilesDir(),"voice-command.wav").getAbsolutePath());player.prepare();player.start();until=SystemClock.elapsedRealtime()+18000;while(VoiceService.live.diagnosticTranscript==null&&SystemClock.elapsedRealtime()<until)Thread.sleep(200);}finally{player.release();}
    String heard=VoiceService.live.diagnosticTranscript;out.putString("transcript",heard);String expected=mode.equals("fragments")?"我想让你打开相册":"打开相册";if(!expected.equals(VoiceCommandPolicy.compact(heard)))throw new Exception("Delayed command mismatch: "+heard);
    out.putString("result",mode.equals("fragments")?"PASS direct microphone, incomplete phrase, five-second thinking pause, continued instruction; no submission":"PASS acoustic wake, five-second thinking pause, delayed command recognized; diagnostics never submit to agent");
   }else if(mode.equals("variants")){
    kws=VoiceAudio.kws(c);File[] files=new File(c.getFilesDir(),"voice-variants").listFiles((d,n)->n.endsWith(".wav"));if(files==null||files.length!=15)throw new Exception("Expected 15 voice fixtures");Arrays.sort(files);
    int positive=0,negative=0;StringBuilder details=new StringBuilder();
    for(File file:files){ks=kws.createStream("");boolean hit=false;float[] samples=fixture(file);for(int i=0;i<samples.length;i+=1600){ks.acceptWaveform(Arrays.copyOfRange(samples,i,Math.min(i+1600,samples.length)),16000);while(kws.isReady(ks)){kws.decode(ks);if(!kws.getResult(ks).getKeyword().isEmpty()){hit=true;kws.reset(ks);}}}ks.release();ks=null;boolean expected=file.getName().startsWith("yes-");details.append(file.getName()).append('=').append(hit).append(';');if(hit==expected){if(expected)positive++;else negative++;}}
    out.putString("details",details.toString());out.putInt("positivePassed",positive);out.putInt("negativePassed",negative);if(positive!=10||negative!=5)throw new Exception("Variant regression mismatch");out.putString("result","PASS 10 synthetic alias/rate fixtures and 5 unrelated phrases; not a population false-wake-rate measurement");
   }else if(mode.equals("ui")){
    ShellActivity shell=(ShellActivity)startActivitySync(new Intent(c,ShellActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));await(shell,"typeof importVoiceThreads==='function'");
    js(shell,"importVoiceThreads();true");await(shell,"data.chats.some(c=>c.voice&&c.kernelThread?.id)");
    js(shell,"openPhoneTask(data.chats.find(c=>c.voice).kernelThread.id);true");await(shell,"active()?.voice&&route==='chat'");
    js(shell,"settingsGo('settings');true");await(shell,"!!document.querySelector('[data-action=voice]')");
    out.putString("result","PASS native voice thread appears in history, opens as a chat, settings voice entry is reachable");
   }else if(mode.equals("agent")){
    VoiceAgent.submit(c,"请仅回复：语音测试成功。不要调用任何工具。");long deadline=SystemClock.elapsedRealtime()+90000;
    while(VoiceAgent.busy&&SystemClock.elapsedRealtime()<deadline)Thread.sleep(300);
    if(VoiceAgent.busy)throw new Exception("Agent timeout; inspect voice conversation, do not resend");
    if(VoiceAgent.thread.isEmpty())throw new Exception("No voice thread created");
    org.json.JSONObject reply=KernelHost.forThread(c,VoiceAgent.thread).nativeRequest("thread/read",new org.json.JSONObject().put("threadId",VoiceAgent.thread).put("includeTurns",true));
    org.json.JSONArray turns=reply.getJSONObject("thread").getJSONArray("turns");if(turns.length()==0||!turns.getJSONObject(turns.length()-1).optString("status").equals("completed"))throw new Exception("Voice turn did not complete");
    boolean answered=false;org.json.JSONArray items=turns.getJSONObject(turns.length()-1).getJSONArray("items");for(int n=0;n<items.length();n++){org.json.JSONObject item=items.getJSONObject(n);if(item.optString("type").equals("agentMessage")&&item.optString("text").contains("语音测试成功"))answered=true;}
    if(!answered)throw new Exception("Expected agent response missing");out.putString("result","PASS voice submission to configured cloud agent and completed persisted history");
   }else if(mode.equals("service")||mode.equals("acoustic")){
    VoiceActivity a=(VoiceActivity)startActivitySync(new Intent(c,VoiceActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
    runOnMainSync(()->a.start(false));long deadline=SystemClock.elapsedRealtime()+30000;
    while(SystemClock.elapsedRealtime()<deadline&&(VoiceService.live==null||!VoiceService.live.ready))Thread.sleep(200);
    if(VoiceService.live==null||!VoiceService.live.ready)throw new Exception("Voice service did not become ready: "+VoiceService.status);
    if(mode.equals("acoustic")){
     runOnMainSync(()->VoiceService.live.diagnosticOnly=true);
     android.media.MediaPlayer player=new android.media.MediaPlayer();try{player.setDataSource(new File(c.getFilesDir(),"voice-fixture.wav").getAbsolutePath());player.prepare();player.start();deadline=SystemClock.elapsedRealtime()+18000;while(VoiceService.live!=null&&VoiceService.live.diagnosticTranscript==null&&SystemClock.elapsedRealtime()<deadline)Thread.sleep(200);}finally{player.release();}
     String text=VoiceService.live==null?null:VoiceService.live.diagnosticTranscript;out.putString("acousticTranscript",text);
     if(text==null||!text.equals("打开相册"))throw new Exception("Speaker-to-microphone wake/ASR did not produce expected command");
    }
    runOnMainSync(()->{VoiceService s=VoiceService.live;if(s==null||!s.island.attached)throw new AssertionError("No overlay");s.audio.pause();s.display("listening","真机界面检查 · 不会提交任何指令");});
    runOnMainSync(()->a.startActivity(new Intent(Settings.ACTION_SETTINGS)));
    Thread.sleep(1200);getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,new FileOutputStream(new File(c.getFilesDir(),"voice-island-check.png")));
    runOnMainSync(()->c.stopService(new Intent(c,VoiceService.class)));Thread.sleep(1200);
    if(VoiceService.live!=null)throw new Exception("Service did not stop");out.putString("result",mode.equals("acoustic")?"PASS device speaker-to-microphone wake, transcription, cross-app overlay and stop; no agent submission":"PASS microphone foreground startup, native models ready, cross-app overlay visible, explicit stop");
   }else{
    long start=SystemClock.elapsedRealtime();kws=VoiceAudio.kws(c);asr=VoiceAudio.recognizer(c);ks=kws.createStream("");as=asr.createStream("");out.putLong("modelLoadMs",SystemClock.elapsedRealtime()-start);
    byte[] raw=java.nio.file.Files.readAllBytes(new File(c.getFilesDir(),"voice-fixture.wav").toPath());
    int offset=12,len=0;while(offset+8<=raw.length){String tag=new String(raw,offset,4,"US-ASCII");int size=(raw[offset+4]&255)|((raw[offset+5]&255)<<8)|((raw[offset+6]&255)<<16)|((raw[offset+7]&255)<<24);offset+=8;if(tag.equals("data")){len=size;break;}offset+=size+(size%2);}
    if(len<=0||offset+len>raw.length)throw new Exception("Invalid fixture WAV");
    float[] samples=new float[len/2+48000];for(int i=0;i<len/2;i++)samples[i]=(short)((raw[offset+i*2]&255)|(raw[offset+i*2+1]<<8))/32768f;
    String keyword="";start=SystemClock.elapsedRealtime();
    for(int i=0;i<samples.length;i+=1600){float[] block=Arrays.copyOfRange(samples,i,Math.min(i+1600,samples.length));ks.acceptWaveform(block,16000);as.acceptWaveform(block,16000);while(kws.isReady(ks)){kws.decode(ks);String hit=kws.getResult(ks).getKeyword();if(!hit.isEmpty()){keyword=hit;kws.reset(ks);}}while(asr.isReady(as))asr.decode(as);}
    as.inputFinished();while(asr.isReady(as))asr.decode(as);String text=asr.getResult(as).getText();
    out.putString("keyword",keyword);out.putString("transcript",text);out.putLong("decodeMs",SystemClock.elapsedRealtime()-start);
    if(keyword.isEmpty())throw new Exception("Synthetic fixture did not trigger wake word");if(!VoiceText.command(text).equals("打开相册"))throw new Exception("Fixture transcript or wake-prefix removal mismatch");
    out.putString("result","PASS synthetic Chinese wake word and streaming transcription; not a human acoustic accuracy test");
   }
  }catch(Throwable e){code=1;out.putString("error",e.toString());}
  finally{if(VoiceService.live!=null)runOnMainSync(()->getTargetContext().stopService(new Intent(getTargetContext(),VoiceService.class)));if(as!=null)as.release();if(ks!=null)ks.release();if(asr!=null)asr.release();if(kws!=null)kws.release();}
  finish(code,out);
 }
}
