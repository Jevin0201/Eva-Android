package ai.eva.android.probe;

import android.content.Context;
import android.media.*;
import com.k2fsa.sherpa.onnx.*;
import java.util.Arrays;

/** One owner thread for recorder and both native models; no recording is persisted. */
final class VoiceAudio implements Runnable {
 interface Listener {void ready();void wake(int ticket);void partial(int ticket,String text,float level,int remaining);void result(int ticket,String text,boolean confirmed,boolean endpointComplete);void error(String message);}
 final Context context;final Listener listener;
 volatile boolean stopped,manual,reset,finishRequested,enabled=true;volatile int revision;Thread thread;volatile AudioRecord recorder;
 VoiceAudio(Context c,Listener l){context=c;listener=l;}
 void start(){thread=new Thread(this,"eva-voice-audio");thread.start();}
 void stop(){stopped=true;AudioRecord r=recorder;if(r!=null)try{r.stop();}catch(Exception ignored){}}
 void listen(){revision++;reset=true;finishRequested=false;manual=true;enabled=true;}
 void finish(){finishRequested=true;}
 void standby(){revision++;manual=false;finishRequested=false;reset=true;enabled=true;}
 void pause(){revision++;enabled=false;manual=false;finishRequested=false;reset=true;}
 static KeywordSpotter kws(Context c){
  OnlineTransducerModelConfig t=new OnlineTransducerModelConfig();
  t.setEncoder(VoiceModels.path(c,"kws/encoder.int8.onnx"));t.setDecoder(VoiceModels.path(c,"kws/decoder.onnx"));t.setJoiner(VoiceModels.path(c,"kws/joiner.int8.onnx"));
  OnlineModelConfig m=new OnlineModelConfig();m.setTransducer(t);m.setTokens(VoiceModels.path(c,"kws/tokens.txt"));m.setModelType("zipformer2");m.setNumThreads(1);
  KeywordSpotterConfig k=new KeywordSpotterConfig();k.setModelConfig(m);k.setKeywordsFile(VoiceModels.path(c,"kws/keywords.txt"));k.setKeywordsScore(1.5f);k.setKeywordsThreshold(0.30f);k.setNumTrailingBlanks(1);
  return new KeywordSpotter(null,k);
 }
 static OnlineRecognizer recognizer(Context c){
  OnlineZipformer2CtcModelConfig t=new OnlineZipformer2CtcModelConfig();t.setModel(VoiceModels.path(c,"asr/model.int8.onnx"));
  OnlineModelConfig m=new OnlineModelConfig();m.setZipformer2Ctc(t);m.setTokens(VoiceModels.path(c,"asr/tokens.txt"));m.setNumThreads(2);
  OnlineRecognizerConfig r=new OnlineRecognizerConfig();r.setModelConfig(m);r.setEnableEndpoint(true);
  EndpointConfig ep=new EndpointConfig();ep.setRule1(new EndpointRule(false,3.0f,0));ep.setRule2(new EndpointRule(true,1.2f,0));ep.setRule3(new EndpointRule(false,0,120));r.setEndpointConfig(ep);
  return new OnlineRecognizer(null,r);
 }
 public void run(){
  KeywordSpotter kws=null;OnlineRecognizer asr=null;OnlineStream ks=null,as=null;AudioRecord audio=null;
  try{
   kws=kws(context);asr=recognizer(context);ks=kws.createStream("");
   int size=Math.max(6400,AudioRecord.getMinBufferSize(16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT));
   audio=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,16000,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,size);
   if(audio.getState()!=AudioRecord.STATE_INITIALIZED)throw new Exception("麦克风初始化失败");
   recorder=audio;if(stopped)return;audio.startRecording();listener.ready();
   // Four seconds includes a slowly spoken wake phrase plus decoder latency.
   float[] history=new float[64000];int historySize=0,historyPos=0;short[] pcm=new short[1600];boolean listening=false,stripWake=false;int samples=0,ticket=0,silenced=0,quietAt=-1,lastTextAt=0;boolean meaningful=false;String last="";
   while(!stopped){
    int n=audio.read(pcm,0,pcm.length);if(stopped)break;if(n<=0)throw new Exception("麦克风已中断，请重新开启语音模式");
    if(android.os.Build.VERSION.SDK_INT>=29){AudioRecordingConfiguration cfg=audio.getActiveRecordingConfiguration();silenced=cfg!=null&&cfg.isClientSilenced()?silenced+1:0;if(silenced>=10)throw new Exception("麦克风被系统静音或其他应用占用，请结束通话后重新开启");}
    if(reset){reset=false;listening=false;if(as!=null){as.release();as=null;}kws.reset(ks);historySize=0;historyPos=0;}
    if(!enabled)continue;
    float[] f=new float[n];double sum=0;for(int i=0;i<n;i++){f[i]=pcm[i]/32768f;sum+=f[i]*f[i];}
    boolean force=manual;manual=false;
    if(!listening){
     for(float v:f){history[historyPos]=v;historyPos=(historyPos+1)%history.length;historySize=Math.min(historySize+1,history.length);}
     ks.acceptWaveform(f,16000);boolean hit=false;
     while(kws.isReady(ks)){kws.decode(ks);if(!kws.getResult(ks).getKeyword().isEmpty()){hit=true;break;}}
     if(!force&&!hit)continue;
     kws.reset(ks);as=asr.createStream("");samples=0;quietAt=-1;lastTextAt=0;meaningful=false;last="";listening=true;stripWake=!force;ticket=revision;
     if(!force){float[] pre=new float[historySize];for(int i=0;i<pre.length;i++)pre[i]=history[(historyPos-historySize+i+history.length)%history.length];as.acceptWaveform(pre,16000);}
     else as.acceptWaveform(f,16000);
     listener.wake(ticket);
    }else{as.acceptWaveform(f,16000);samples+=n;}
    while(asr.isReady(as))asr.decode(as);
    String text=asr.getResult(as).getText().trim();if(stripWake)text=VoiceText.command(text);
    VoiceCommandPolicy.Kind kind=VoiceCommandPolicy.classify(text);
    // The wake phrase is not an instruction. Drain it at its own endpoint and
    // keep the microphone open while the person thinks of what to say.
    if(!meaningful&&kind==VoiceCommandPolicy.Kind.EMPTY&&asr.isEndpoint(as)){
     asr.reset(as);stripWake=false;text="";last="";quietAt=-1;
    }
    if(!text.equals(last)){lastTextAt=samples;quietAt=-1;}last=text;
    if(kind!=VoiceCommandPolicy.Kind.EMPTY)meaningful=true;
    int patience=VoiceCommandPolicy.silenceMillis(context.getSharedPreferences("eva-voice",0).getInt("silenceMs",3000));
    boolean endpoint=asr.isEndpoint(as);
    if(endpoint&&kind==VoiceCommandPolicy.Kind.READY){if(quietAt<0)quietAt=samples;}else quietAt=-1;
    int extra=16000*(patience-1200)/1000;
    int remaining=quietAt<0?0:Math.max(1,(extra-(samples-quietAt)+15999)/16000);
    listener.partial(ticket,text,(float)Math.min(1,Math.sqrt(sum/n)*12),remaining);
    boolean explicit=finishRequested||(VoiceCommandPolicy.explicitFinish(text)&&kind!=VoiceCommandPolicy.Kind.INCOMPLETE&&kind!=VoiceCommandPolicy.Kind.EMPTY);
    boolean complete=samples>12800&&quietAt>=0&&samples-quietAt>=extra;
    boolean incompletePause=meaningful&&kind!=VoiceCommandPolicy.Kind.READY&&samples-lastTextAt>=16000*12;
    if(explicit||complete||kind==VoiceCommandPolicy.Kind.CANCEL||incompletePause||samples>=16000*60||(!meaningful&&samples>=16000*20)){
     as.inputFinished();while(asr.isReady(as))asr.decode(as);
     text=asr.getResult(as).getText().trim();if(stripWake)text=VoiceText.command(text);
     as.release();as=null;listening=false;enabled=false;finishRequested=false;historySize=0;historyPos=0;
     listener.result(ticket,VoiceCommandPolicy.withoutFinish(text),explicit,complete);
    }
   }
  }catch(Throwable e){if(!stopped)listener.error("语音引擎不可用："+(e.getMessage()==null?e.getClass().getSimpleName():e.getMessage()));}
  finally{recorder=null;if(audio!=null){try{audio.stop();}catch(Exception ignored){}audio.release();}if(as!=null)as.release();if(ks!=null)ks.release();if(asr!=null)asr.release();if(kws!=null)kws.release();}
 }
}
