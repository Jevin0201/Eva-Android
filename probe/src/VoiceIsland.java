package ai.eva.android.probe;
import android.content.*;import android.graphics.*;import android.os.*;import android.view.*;

/** Transparent, touch-through camera halo. No transcript panel or invisible touch target. */
final class VoiceIsland {
 final Context context;final WindowManager manager;
 Ring root;WindowManager.LayoutParams params;String state="",message="";boolean attached;
 float cameraRadius;int cameraX,cameraY;boolean detected;
 VoiceIsland(Context c,Runnable cancel,Runnable open,Runnable listen){context=c;manager=c.getSystemService(WindowManager.class);}
 int dp(float v){return Math.round(v*context.getResources().getDisplayMetrics().density);}
 static void captureCamera(Context c,WindowInsets insets){
  if(insets==null||insets.getDisplayCutout()==null)return;WindowManager wm=c.getSystemService(WindowManager.class);Point size=new Point();wm.getDefaultDisplay().getRealSize(size);
  Rect best=null;for(Rect r:insets.getDisplayCutout().getBoundingRects())if(!r.isEmpty()&&r.top<size.y/4&&r.width()<size.x/3&&(best==null||r.top<best.top))best=r;
  if(best==null)return;SharedPreferences p=c.getSharedPreferences("eva-voice",0);
  if(p.getInt("cameraX",-1)==best.centerX()&&p.getInt("cameraY",-1)==best.centerY()&&p.getInt("cameraScreenW",0)==size.x&&p.getInt("cameraScreenH",0)==size.y)return;
  p.edit().putInt("cameraX",best.centerX()).putInt("cameraY",best.centerY()).putInt("cameraWidth",best.width()).putInt("cameraScreenW",size.x).putInt("cameraScreenH",size.y).apply();
 }
 void position(){
  Point size=new Point();manager.getDefaultDisplay().getRealSize(size);
  if(Build.VERSION.SDK_INT>=30)try{captureCamera(context,manager.getMaximumWindowMetrics().getWindowInsets());}catch(Exception ignored){}
  SharedPreferences p=context.getSharedPreferences("eva-voice",0);detected=p.getInt("cameraScreenW",0)==size.x&&p.getInt("cameraScreenH",0)==size.y;
  int bar=context.getResources().getIdentifier("status_bar_height","dimen","android"),barHeight=bar==0?dp(28):context.getResources().getDimensionPixelSize(bar);
  cameraX=(detected?p.getInt("cameraX",size.x/2):size.x/2)+dp(p.getInt("haloOffsetX",0));cameraY=(detected?p.getInt("cameraY",barHeight/2):barHeight/2)+dp(p.getInt("haloOffsetY",0));
  cameraRadius=detected?Math.max(dp(7),Math.min(dp(20),p.getInt("cameraWidth",dp(20))/2f)):dp(10);
  int side=dp(76);params.width=side;params.height=side;cameraX=Math.max(side/2,Math.min(size.x-side/2,cameraX));cameraY=Math.max(dp(12),Math.min(size.y-side/2,cameraY));params.x=cameraX-side/2;params.y=cameraY-side/2;
 }
 void show(String next,String text){
  boolean changed=!state.equals(next);state=next;message=text;
  if(root==null){
   root=new Ring(context);int flags=WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN|WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
   params=new WindowManager.LayoutParams(1,1,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,flags,PixelFormat.TRANSLUCENT);params.gravity=Gravity.TOP|Gravity.LEFT;params.setTitle("Eva 摄像头语音光圈");
   // Stay below Android's obscuring-opacity limit for touch-through overlays.
   params.alpha=.75f;
   if(Build.VERSION.SDK_INT>=30){params.setFitInsetsTypes(0);params.layoutInDisplayCutoutMode=WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;}else params.layoutInDisplayCutoutMode=WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
  }
  position();root.setContentDescription("Eva "+label(next));if(changed)root.began=SystemClock.uptimeMillis();root.running=true;
  if(attached)manager.updateViewLayout(root,params);else{manager.addView(root,params);attached=true;}root.invalidate();
 }
 static String label(String s){switch(s){case "idle":return "等待唤醒";case "listening":return "正在听";case "working":return "正在执行";case "review":return "听写完成，等待发送";case "approval":return "需要确认";case "done":return "已结束";case "loading":return "正在开启";default:return "需要处理";}}
 void level(float level){if(root!=null){root.target=Math.max(0,Math.min(1,level));root.invalidate();}}
 void close(){if(root!=null)root.running=false;if(attached){try{manager.removeViewImmediate(root);}catch(Exception ignored){}attached=false;}}
 class Ring extends View {
  final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);long began=SystemClock.uptimeMillis();float target,energy;boolean running;
  Ring(Context c){super(c);setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);}
  void circle(Canvas c,float x,float y,float r,int color,float width,int alpha){paint.setShader(null);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(dp(width));paint.setColor(color);paint.setAlpha(alpha);c.drawCircle(x,y,r,paint);}
  protected void onDraw(Canvas canvas){
   super.onDraw(canvas);float x=getWidth()/2f,y=getHeight()/2f,t=(SystemClock.uptimeMillis()-began)/1000f;energy+=(target-energy)*.22f;
   boolean listening=state.equals("listening"),idle=state.equals("idle");int color=state.equals("review")||state.equals("approval")?0xffffbd50:state.equals("error")?0xffff697e:state.equals("done")||idle?0xff40edb2:state.equals("working")?0xffb79aff:0xff55deff;
   float breathe=(float)(.5+.5*Math.sin(t*(listening?5:2))),radius=cameraRadius+dp(3)+(listening?dp(1+energy*3)*breathe:dp(.6f)*breathe);
   circle(canvas,x,y,radius,0xff071b29,idle?3.4f:5.5f,idle?150:220);circle(canvas,x,y,radius,color,idle?5:10,idle?25:40);circle(canvas,x,y,radius,color,idle?1.5f:2.7f,idle?180:255);
   if(!idle){
    for(int k=0;k<2;k++){float phase=(t*.75f+k*.5f)%1;float ripple=radius+dp(3)+phase*dp(listening?12+energy*4:8);circle(canvas,x,y,ripple,color,1.3f,(int)((1-phase)*(listening?150:65)));}
    paint.setShader(new SweepGradient(x,y,new int[]{color,Color.WHITE,color,Color.TRANSPARENT,color},null));paint.setAlpha(255);paint.setStrokeWidth(dp(2.2f));paint.setStrokeCap(Paint.Cap.ROUND);
    canvas.save();canvas.rotate(t*(state.equals("working")?145:65),x,y);canvas.drawArc(x-radius,y-radius,x+radius,y+radius,15,115,false,paint);canvas.restore();paint.setShader(null);
    if(listening){paint.setColor(color);paint.setAlpha(190);paint.setStrokeWidth(dp(1.3f));for(int i=0;i<32;i++){double a=Math.PI*2*i/32;float wave=(float)(.5+.5*Math.sin(i*.9+t*7));float r=radius+dp(4),end=r+dp(1+energy*5*wave);canvas.drawLine(x+(float)Math.cos(a)*r,y+(float)Math.sin(a)*r,x+(float)Math.cos(a)*end,y+(float)Math.sin(a)*end,paint);}}
   }
   if(running&&isAttachedToWindow())postInvalidateDelayed(idle?125:33);
  }
 }
}
