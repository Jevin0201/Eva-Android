package ai.eva.android.probe;
import android.content.Context;
import android.graphics.*;
import android.graphics.drawable.*;
import android.view.*;
import android.widget.*;

/** Shared native visual tokens and original vector controls. */
public final class EvaUi {
 public static final int INK=0xff262a30,MUTED=0xff858b92,LINE=0xffe7e9ec,SOFT=0xfff5f6f8;
 public static int dp(Context c,int n){return (int)(n*c.getResources().getDisplayMetrics().density+.5f);}
 public static GradientDrawable surface(Context c,int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(c,radius));return d;}
 public static void style(Button b){Context c=b.getContext();b.setAllCaps(false);b.setTextSize(14);b.setTextColor(INK);b.setStateListAnimator(null);b.setElevation(0);b.setMinHeight(dp(c,48));b.setMinimumHeight(dp(c,48));b.setBackground(new RippleDrawable(android.content.res.ColorStateList.valueOf(0xffe4e8ee),surface(c,SOFT,12),null));}
 public static View icon(Context c,String kind,String label,Runnable action){ImageView v=new ImageView(c);v.setImageDrawable(new Glyph(kind));v.setPadding(dp(c,12),dp(c,12),dp(c,12),dp(c,12));v.setLayoutParams(new LinearLayout.LayoutParams(dp(c,44),dp(c,44)));v.setContentDescription(label);v.setBackground(new RippleDrawable(android.content.res.ColorStateList.valueOf(0xffe4e8ee),surface(c,0x00ffffff,14),null));v.setOnClickListener(x->action.run());return v;}
 public static class Glyph extends Drawable {
  final String kind;final Paint p=new Paint(3);public Glyph(String k){kind=k;}
  public void draw(Canvas c){c.save();c.translate(getBounds().left,getBounds().top);c.scale(getBounds().width()/24f,getBounds().height()/24f);p.setColor(INK);p.setStrokeWidth(1.7f);p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);
   if(kind.equals("back")){c.drawLine(15,5,8,12,p);c.drawLine(8,12,15,19,p);}
   else if(kind.equals("search")){c.drawCircle(10,10,6,p);c.drawLine(15,15,21,21,p);}
   else if(kind.equals("history")){c.drawCircle(12,12,9,p);c.drawLine(12,6,12,12,p);c.drawLine(12,12,16,14,p);}
   else if(kind.equals("stop")){c.drawRoundRect(6,6,18,18,2,2,p);}
   else if(kind.equals("refresh")){c.drawArc(4,4,20,20,45,285,false,p);c.drawLine(19,3,19,8,p);c.drawLine(19,8,14,8,p);}
   else if(kind.equals("file")){Path q=new Path();q.moveTo(5,3);q.lineTo(14,3);q.lineTo(20,9);q.lineTo(20,21);q.lineTo(5,21);q.close();c.drawPath(q,p);c.drawLine(9,13,16,13,p);c.drawLine(9,17,16,17,p);}
   else if(kind.equals("menu")){c.drawRoundRect(3,4,21,20,3,3,p);c.drawLine(9,4,9,20,p);}
   else if(kind.equals("plus")){c.drawLine(5,12,19,12,p);c.drawLine(12,5,12,19,p);}
   else if(kind.equals("more")){p.setStyle(Paint.Style.FILL);for(int x:new int[]{5,12,19})c.drawCircle(x,12,1.5f,p);}
   else if(kind.equals("send")){c.drawLine(12,19,12,5,p);c.drawLine(6,11,12,5,p);c.drawLine(12,5,18,11,p);}
   else if(kind.equals("folder")){Path q=new Path();q.moveTo(3,7);q.lineTo(3,19);q.lineTo(21,19);q.lineTo(21,7);q.lineTo(12,7);q.lineTo(10,4);q.lineTo(3,4);q.close();c.drawPath(q,p);}
   else if(kind.equals("web")){c.drawCircle(12,12,9,p);c.drawOval(8,3,16,21,p);c.drawLine(3,12,21,12,p);}
   else if(kind.equals("terminal")){c.drawRoundRect(3,4,21,20,3,3,p);c.drawLine(7,9,10,12,p);c.drawLine(10,12,7,15,p);c.drawLine(13,15,17,15,p);}
   else {c.drawCircle(12,12,4,p);for(int i=0;i<8;i++){c.save();c.rotate(i*45,12,12);c.drawLine(12,3,12,5,p);c.restore();}}
   c.restore();}
  public void setAlpha(int a){p.setAlpha(a);}public void setColorFilter(ColorFilter f){p.setColorFilter(f);}public int getOpacity(){return PixelFormat.TRANSLUCENT;}
 }
}
