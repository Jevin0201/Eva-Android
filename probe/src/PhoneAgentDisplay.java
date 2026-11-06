package ai.eva.android.probe;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.media.Image;
import android.media.ImageReader;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.DisplayMetrics;
import java.io.IOException;

/** User-selected phone execution surface. Never falls back to the main screen on failure. */
final class PhoneAgentDisplay {
 static volatile PhoneAgentDisplay active;
 private static final Object lifecycleLock = new Object();
 private static final java.util.concurrent.ExecutorService lifecycle = java.util.concurrent.Executors.newSingleThreadExecutor();
 private static long ticket, lastRestore;
 private static boolean restoring;
 private static volatile String recoveryReason = "";
 static boolean desired(Context context) { return context.getSharedPreferences("eva-phone",0).getBoolean("backgroundDisplayEnabled",false); }
 static void setEnabled(Context context, boolean enabled) throws IOException {
  synchronized(PhoneTools.class){
   if (!PhoneTools.owner.isEmpty()) throw new IOException("请先停止正在执行的手机任务");
   boolean changed=desired(context)!=enabled;
   if (!context.getSharedPreferences("eva-phone",0).edit().putBoolean("backgroundDisplayEnabled",enabled).commit()) throw new IOException("后台屏选择保存失败");
   if(changed)PhoneAccessibility.generation++;
   if (!enabled) { stop(); recoveryReason=""; return; }
  }
  restore(context);
 }
 static void disable(Context context) {
  context.getSharedPreferences("eva-phone",0).edit().putBoolean("backgroundDisplayEnabled",false).commit();
  stop(); recoveryReason="";
 }
 static boolean connected(Context context, PhoneAgentDisplay value) {
  if(value==null)return false;
  android.hardware.display.DisplayManager manager=(android.hardware.display.DisplayManager)context.getSystemService(Context.DISPLAY_SERVICE);
  return PhoneShell.binder!=null&&PhoneShell.binder.isBinderAlive()&&manager.getDisplay(value.id)!=null;
 }
 static String status(Context context) {
  if(!desired(context))return "后台屏未选择";
  PhoneAgentDisplay value=active;
  if(connected(context,value))return "后台屏已运行 · 屏幕 "+value.id;
  return "后台屏已保持开启选择 · "+(recoveryReason.isEmpty()?"等待恢复":recoveryReason);
 }
 static void restore(Context context) {
  final Context application=context.getApplicationContext();
  if(!desired(application))return;
  if(connected(application,active))return;
  if(active!=null)stop();
  if(!PhoneAccessibility.armed||PhoneAccessibility.live==null){recoveryReason="等待手机控制与无障碍连接";return;}
  if(!PhoneShell.authorized()){recoveryReason="等待 Shizuku 启动与授权";return;}
  if(!PhoneTools.owner.isEmpty()){recoveryReason="等待当前手机任务结束后恢复";return;}
  final long token,epoch=PhoneAccessibility.generation;
  synchronized(lifecycleLock){
   long now=SystemClock.elapsedRealtime();
   if(restoring||now-lastRestore<3000)return;
   restoring=true;lastRestore=now;token=ticket;recoveryReason="正在恢复后台屏";
  }
  lifecycle.execute(()->{try{create(application,token,epoch);}catch(Exception error){if(desired(application))recoveryReason="恢复失败 · "+error.getMessage();}finally{synchronized(lifecycleLock){restoring=false;}}});
 }
 private static void create(Context context,long token,long epoch) throws Exception {
  synchronized(lifecycleLock){if(token!=ticket||!desired(context)||active!=null)return;}
  if(Build.VERSION.SDK_INT<34)throw new IOException("独立焦点后台屏需要 Android 14 或更新版本");
  if(!PhoneAccessibility.armed||PhoneAccessibility.live==null)throw new IOException("等待手机控制与无障碍连接");
  if(((android.app.KeyguardManager)context.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked())throw new IOException("等待手机解锁");
  if(epoch!=PhoneAccessibility.generation||!PhoneTools.owner.isEmpty())return;
  PhoneAgentDisplay created=new PhoneAgentDisplay(context);
  boolean publish=false;
  synchronized(PhoneTools.class){synchronized(lifecycleLock){
   if(token==ticket&&desired(context)&&epoch==PhoneAccessibility.generation&&PhoneAccessibility.armed&&PhoneAccessibility.live!=null&&PhoneTools.owner.isEmpty()){
    // Publishing occurs only without a phone owner. Keep the session generation stable so
    // a foreground-service start queued before this recovery does not cancel itself.
    active=created;publish=true;recoveryReason="";
   }
  }}
  if(!publish){created.close();return;}
  PhoneAccessibility service=PhoneAccessibility.live;
  if(service!=null)new Handler(service.getMainLooper()).post(()->{
   service.clearNodes();service.foregroundPackage="";service.foregroundWindow=-1;service.windowRevision++;
  });
 }
 final ImageReader reader;
 final HandlerThread thread = new HandlerThread("eva-agent-frames");
 final int width = 1080, height = 1920;
 volatile int id = -1;
 private Bitmap frame, pixels;
 private long frameAt, requiredAfter;
 private boolean closed, pending;
 private Handler frames;

 private PhoneAgentDisplay(Context context) throws Exception {
  reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
  thread.start();
  try {
   id = PhoneShell.createDisplay(context, reader.getSurface(), width, height, 420);
   if (id <= 0) throw new IOException("系统未返回有效后台屏");
   frames=new Handler(thread.getLooper());
   reader.setOnImageAvailableListener(source -> scheduleFrame(), frames);
  } catch (Exception error) { close(); throw error; }
 }

 static void start(Context context) throws Exception {
  if(android.os.Looper.myLooper()==android.os.Looper.getMainLooper())throw new IOException("后台屏创建需要后台线程");
  if(!desired(context))context.getSharedPreferences("eva-phone",0).edit().putBoolean("backgroundDisplayEnabled",true).commit();
  final long token,epoch=PhoneAccessibility.generation;
  synchronized(lifecycleLock){token=ticket;}
  lifecycle.submit(()->{create(context,token,epoch);return null;}).get(20,java.util.concurrent.TimeUnit.SECONDS);
  if(!connected(context,active))throw new IOException("后台屏等待恢复，请检查控制权限");
 }
 static int displayId() { PhoneAgentDisplay value = active; return value == null ? 0 : value.id; }
 static void stop() {
  PhoneAgentPreview.hide();
  final PhoneAgentDisplay value;
  synchronized(lifecycleLock){ticket++;value=active;active=null;}
  if(value!=null)lifecycle.execute(value::close);
 }
 static DisplayMetrics metrics(Context context) {
  DisplayMetrics metrics = new DisplayMetrics();
  android.view.Display display = ((android.hardware.display.DisplayManager)context.getSystemService(Context.DISPLAY_SERVICE)).getDisplay(displayId());
  if (display != null) display.getRealMetrics(metrics);
  else metrics.setTo(context.getResources().getDisplayMetrics());
  return metrics;
 }
 synchronized void launching() { requiredAfter = SystemClock.uptimeMillis(); }
 private synchronized void scheduleFrame() {
  if (closed || pending) return;
  pending = true;
  frames.postDelayed(() -> {
   synchronized (this) { pending = false; }
   readFrame();
  }, Math.max(0, frameAt + 100 - SystemClock.uptimeMillis()));
 }
 static void guard(Context context) throws IOException {
  PhoneAgentDisplay value = active;
  if (value == null) {if(desired(context)){restore(context);throw new IOException(status(context));}return;}
  android.hardware.display.DisplayManager manager = (android.hardware.display.DisplayManager)context.getSystemService(Context.DISPLAY_SERVICE);
  if (PhoneShell.binder == null || !PhoneShell.binder.isBinderAlive() || manager.getDisplay(value.id) == null)
   {stop();restore(context);throw new IOException("后台屏连接已断开，等待恢复；"+status(context));}
 }
 private void readFrame() {
  long acquiredAt=SystemClock.uptimeMillis();
  try (Image image = reader.acquireLatestImage()) {
   if (image == null) return;
   synchronized (this) {
    if (closed) return;
    long now = acquiredAt;
    Image.Plane plane = image.getPlanes()[0];
    int strideWidth = plane.getRowStride() / plane.getPixelStride();
    if (pixels == null || pixels.getWidth() != strideWidth) {
     if (pixels != null) pixels.recycle();
     pixels = Bitmap.createBitmap(strideWidth, height, Bitmap.Config.ARGB_8888);
    }
    pixels.copyPixelsFromBuffer(plane.getBuffer());
    if (frame == null) frame = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
    new android.graphics.Canvas(frame).drawBitmap(pixels, 0, 0, null);
    frameAt = now;
   }
  } catch (IllegalStateException ignored) { /* Reader closed during cancellation. */ }
 }
 synchronized Bitmap previewBitmap(int shortSide) throws IOException {
  if (closed || frame == null || frameAt <= requiredAfter) throw new IOException("等待后台屏画面");
  float scale = Math.min(1f, (float)Math.max(120, Math.min(480, shortSide)) / Math.min(frame.getWidth(), frame.getHeight()));
  Bitmap preview = Bitmap.createScaledBitmap(frame, Math.round(frame.getWidth()*scale), Math.round(frame.getHeight()*scale), true);
  return preview == frame ? frame.copy(Bitmap.Config.ARGB_8888,false) : preview;
 }
 synchronized Bitmap bitmap() throws IOException {
  if (closed || frame == null || frameAt <= requiredAfter) throw new IOException("后台屏尚无当前页面的新画面，请稍后重新观察");
  return frame.copy(Bitmap.Config.ARGB_8888, false);
 }
 void close() {
  synchronized (this) {
   if (closed) return;
   closed = true;
   if (frame != null) frame.recycle();
   frame = null;
   if (pixels != null) pixels.recycle();
   pixels = null;
  }
  PhoneShell.releaseDisplay();
  new Handler(thread.getLooper()).post(reader::close);
  thread.quitSafely();
 }
}
