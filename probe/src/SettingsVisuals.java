package ai.eva.android.probe;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.drawable.RippleDrawable;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.*;

/** Settings-only appearance. Does not replace controls, listeners, values or input flags. */
final class SettingsVisuals {
 static int ink(Context c){return EvaUi.dark(c)?0xffeceee6:0xff292b27;}
 static int soft(Context c){return EvaUi.dark(c)?0xff2d3229:0xfff5f6f2;}
 static void button(Button b){
  Context c=b.getContext();String title=b.getText().toString();
  boolean primary=title.equals("保存")||title.equals("保存任务")||title.equals("确认发送")||title.equals("导出会话备份");
  int fg=primary?(EvaUi.dark(c)?0xff20231f:0xffffffff):ink(c),bg=primary?ink(c):soft(c);
  if(title.startsWith("删除"))fg=EvaUi.dark(c)?0xffe3a59c:0xffac5147;
  b.setTextColor(new ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{EvaUi.dark(c)?0xff777e70:0xffa6aaa0,fg}));
  b.setAllCaps(false);b.setStateListAnimator(null);b.setElevation(0);b.setTextSize(14);
  b.setMinHeight(EvaUi.dp(c,48));b.setMinimumHeight(EvaUi.dp(c,48));b.setPadding(EvaUi.dp(c,16),EvaUi.dp(c,12),EvaUi.dp(c,16),EvaUi.dp(c,12));
  GradientDrawable shape=EvaUi.surface(c,bg,13);
  b.setBackground(new RippleDrawable(ColorStateList.valueOf(EvaUi.dark(c)?0x224f6240:0x22677658),shape,null));
 }
 static void watchInputs(View root){
  java.util.Set<View> styled=java.util.Collections.newSetFromMap(new java.util.WeakHashMap<View,Boolean>());
  root.getViewTreeObserver().addOnGlobalLayoutListener(()->inputs(root,styled));
 }
 private static void inputs(View v,java.util.Set<View> styled){
  if(v instanceof android.webkit.WebView)return;
  if(v instanceof EditText&&styled.add(v)){
   EditText e=(EditText)v;Context c=e.getContext();e.setTextColor(ink(c));e.setHintTextColor(EvaUi.dark(c)?0xffa1a697:0xff898c83);
   GradientDrawable shape=EvaUi.surface(c,soft(c),12);shape.setStroke(EvaUi.dp(c,1),EvaUi.dark(c)?0xff373d31:0xffeceee7);
   e.setBackground(shape);e.setPadding(EvaUi.dp(c,12),EvaUi.dp(c,12),EvaUi.dp(c,12),EvaUi.dp(c,12));e.setMinimumHeight(EvaUi.dp(c,48));
  }
  if(v instanceof ViewGroup){ViewGroup group=(ViewGroup)v;for(int i=0;i<group.getChildCount();i++)inputs(group.getChildAt(i),styled);}
 }
}
