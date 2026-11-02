package ai.eva.android.probe;
import android.app.*;
import android.os.Bundle;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.*;
import android.widget.*;
import org.json.*;

/** Native mobile adaptation of Eva desktop's conversation structure. */
public class EvaActivity extends Activity {
    LinearLayout page, messages, drawer, history;
    android.app.Dialog drawerDialog;
    EditText input;
    TextView heading;
    JSONArray chats;
    int active=-1;
    final int ink=Color.rgb(26,28,31), muted=Color.rgb(110,115,120), border=Color.rgb(231,231,232);
    int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
    GradientDrawable shape(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));d.setStroke(dp(1),border);return d;}
    TextView label(String text,int size){TextView v=new TextView(this);v.setText(text);v.setTextSize(size);v.setTextColor(ink);return v;}
    Button button(String text,Runnable action){Button b=new Button(this);b.setText(text);b.setTextSize(13);b.setTextColor(ink);b.setAllCaps(false);b.setStateListAnimator(null);b.setElevation(0);b.setMinWidth(0);b.setMinimumWidth(0);b.setBackground(shape(Color.WHITE,10));EvaUi.style(b);b.setOnClickListener(v->action.run());return b;}
    void notice(String title,String body){new AlertDialog.Builder(this).setTitle(title).setMessage(body).setPositiveButton("知道了",null).show();}
    void save(){try{if(active>=0&&active<chats.length())chats.getJSONObject(active).put("draft",input.getText().toString());}catch(Exception ignored){}getPreferences(0).edit().putString("chats",chats.toString()).putInt("active",active).putString("draft",active<0?input.getText().toString():getPreferences(0).getString("draft","")).apply();}
    public void onCreate(Bundle state){super.onCreate(state);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        try{chats=new JSONArray(getPreferences(0).getString("chats","[]"));}catch(Exception e){chats=new JSONArray();}
        active=getPreferences(0).getInt("active",-1);
        page=new LinearLayout(this);page.setOrientation(1);page.setBackgroundColor(Color.WHITE);
        page.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        setContentView(page);
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(12),dp(8),dp(12),dp(8));
        top.addView(EvaUi.icon(this,"menu","打开会话侧栏",()->toggleDrawer()));
        heading=label("新聊天",17);heading.setTypeface(null,Typeface.BOLD);heading.setPadding(dp(14),0,0,0);top.addView(heading,new LinearLayout.LayoutParams(0,dp(48),1));heading.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(EvaUi.icon(this,"plus","新聊天",()->newChat()));top.addView(EvaUi.icon(this,"more","设置",()->openSettings()));page.addView(top);
        drawer=new LinearLayout(this);drawer.setOrientation(1);drawer.setPadding(dp(16),dp(12),dp(16),dp(12));drawer.setBackgroundColor(Color.rgb(248,252,253));
        TextView brand=label("Eva",23);brand.setTypeface(null,Typeface.BOLD);drawer.addView(brand);drawer.addView(button("新聊天",()->newChat()));drawer.addView(button("设置",()->openSettings()));
        TextView recent=label("最近会话",12);recent.setTextColor(muted);recent.setPadding(0,dp(16),0,dp(8));drawer.addView(recent);
        ScrollView hs=new ScrollView(this);history=new LinearLayout(this);history.setOrientation(1);hs.addView(history);drawer.addView(hs,new LinearLayout.LayoutParams(-1,0,1));drawer.setVisibility(View.GONE);
        ScrollView scroll=new ScrollView(this);scroll.setFillViewport(true);messages=new LinearLayout(this);messages.setOrientation(1);messages.setPadding(dp(20),dp(24),dp(20),dp(24));scroll.addView(messages);page.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout dock=new LinearLayout(this);dock.setOrientation(1);dock.setPadding(dp(14),dp(6),dp(14),dp(12));
        LinearLayout composer=new LinearLayout(this);composer.setOrientation(1);composer.setPadding(dp(10),dp(8),dp(10),dp(6));composer.setBackground(shape(0xfff7f8fa,24));
        input=new EditText(this);input.setTextSize(16);input.setTextColor(ink);input.setHint("和 Eva 一起工作");input.setBackgroundColor(Color.TRANSPARENT);input.setMinLines(2);input.setPadding(dp(6),dp(6),dp(6),dp(6));input.setMaxLines(5);input.setGravity(Gravity.TOP);input.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);input.setText(active>=0&&active<chats.length()?chats.optJSONObject(active).optString("draft",""):getPreferences(0).getString("draft",""));composer.addView(input);
        LinearLayout controls=new LinearLayout(this);controls.setGravity(Gravity.CENTER_VERTICAL);
        controls.addView(EvaUi.icon(this,"plus","打开工具",()->openTools()));
        TextView mode=label("此手机",12);mode.setTextColor(muted);mode.setPadding(dp(10),0,0,0);controls.addView(mode,new LinearLayout.LayoutParams(0,-2,1));
        controls.addView(button("连接模型",()->openSettings()));
        controls.addView(EvaUi.icon(this,"send","保存待发送消息",()->storeMessage()));composer.addView(controls);dock.addView(composer);
        TextView stateLabel=label("本地草稿 · 模型尚未连接",11);stateLabel.setTextColor(muted);stateLabel.setGravity(Gravity.CENTER);stateLabel.setPadding(0,dp(8),0,0);dock.addView(stateLabel);page.addView(dock);render();
    }
    void openSettings(){startActivity(new android.content.Intent(this,SettingsActivity.class));}
    void openTools(){new AlertDialog.Builder(this).setTitle("此手机").setItems(new String[]{"本地终端","工作区文件","Eva 浏览器","手机控制权限"},(d,n)->{if(n==3){notice("手机控制","无障碍控制服务尚未接入。");return;}android.content.Intent i=new android.content.Intent(this,LocalToolsActivity.class);i.putExtra("tool",n==1?"files":n==2?"browser":"terminal");startActivity(i);}).show();}
    void closeDrawer(){if(drawerDialog!=null)drawerDialog.dismiss();}
    void toggleDrawer(){renderHistory();if(drawer.getParent()!=null)((android.view.ViewGroup)drawer.getParent()).removeView(drawer);drawer.setVisibility(View.VISIBLE);drawerDialog=new android.app.Dialog(this);drawerDialog.setContentView(drawer);android.view.Window w=drawerDialog.getWindow();if(w!=null){w.setBackgroundDrawableResource(android.R.color.transparent);w.setLayout(dp(310),-1);w.setGravity(Gravity.LEFT);w.addFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND);android.view.WindowManager.LayoutParams lp=w.getAttributes();lp.dimAmount=.28f;w.setAttributes(lp);}drawerDialog.show();drawerDialog.getWindow().setLayout(Math.min(dp(310),getResources().getDisplayMetrics().widthPixels-dp(40)),-1);}
    void newChat(){save();active=-1;input.setText(getPreferences(0).getString("draft",""));closeDrawer();save();render();}
    void storeMessage(){String text=input.getText().toString().trim();if(text.isEmpty())return;try{
        if(active<0||active>=chats.length()){JSONObject c=new JSONObject();c.put("id",java.util.UUID.randomUUID().toString());c.put("title",text.length()>20?text.substring(0,20):text);c.put("messages",new JSONArray());chats.put(c);active=chats.length()-1;getPreferences(0).edit().putString("draft","").apply();}
        chats.getJSONObject(active).getJSONArray("messages").put(text);input.setText("");save();render();
    }catch(Exception e){notice("保存失败",e.toString());}}
    void renderHistory(){history.removeAllViews();for(int i=chats.length()-1;i>=0;i--){final int n=i;String title=chats.optJSONObject(i).optString("title","聊天");history.addView(button(title,()->{save();active=n;input.setText(chats.optJSONObject(n).optString("draft",""));closeDrawer();save();render();}));}}
    void render(){messages.removeAllViews();if(active<0||active>=chats.length()){
        heading.setText("Eva");LinearLayout welcome=new LinearLayout(this);welcome.setOrientation(1);welcome.setGravity(Gravity.CENTER);welcome.setPadding(dp(6),dp(10),dp(6),dp(30));
        TextView mark=label("Eva",42);mark.setTypeface(android.graphics.Typeface.create("sans-serif-light",0));mark.setLetterSpacing(-.04f);mark.setGravity(Gravity.CENTER);welcome.addView(mark);
        TextView title=label("把想法，变成行动",25);title.setTypeface(null,Typeface.BOLD);title.setGravity(Gravity.CENTER);LinearLayout.LayoutParams titleP=new LinearLayout.LayoutParams(-1,-2);titleP.topMargin=dp(20);welcome.addView(title,titleP);
        TextView sub=label("在此手机上浏览、创作与执行",14);sub.setTextColor(muted);sub.setGravity(Gravity.CENTER);LinearLayout.LayoutParams subP=new LinearLayout.LayoutParams(-1,-2);subP.topMargin=dp(10);subP.bottomMargin=dp(30);welcome.addView(sub,subP);
        welcome.addView(shortcut("web","浏览网页","打开 Eva 内置浏览器","browser"));welcome.addView(shortcut("folder","我的工作区","查看文件与项目","files"));welcome.addView(shortcut("terminal","本地终端","运行代码与命令","terminal"));messages.addView(welcome,new LinearLayout.LayoutParams(-1,-1));
    }else{JSONObject c=chats.optJSONObject(active);heading.setText(c.optString("title"));JSONArray a=c.optJSONArray("messages");for(int i=0;i<a.length();i++){TextView m=label(a.optString(i),16);m.setPadding(dp(14),dp(12),dp(14),dp(12));m.setBackground(shape(Color.rgb(245,245,245),16));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-2,-2);p.gravity=Gravity.RIGHT;p.bottomMargin=dp(16);messages.addView(m,p);}TextView pending=label("待发送 · 连接模型后才能执行任务",12);pending.setTextColor(muted);messages.addView(pending);}renderHistory();}
    View shortcut(String glyph,String title,String desc,String tool){LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(10),dp(7),dp(10),dp(7));row.setBackground(EvaUi.surface(this,0xfff7f8fa,16));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(70));lp.bottomMargin=dp(10);row.setLayoutParams(lp);Runnable go=()->{android.content.Intent i=new android.content.Intent(this,LocalToolsActivity.class);i.putExtra("tool",tool);startActivity(i);};row.addView(EvaUi.icon(this,glyph,title,go));LinearLayout words=new LinearLayout(this);words.setOrientation(1);words.setPadding(dp(8),0,0,0);TextView name=label(title,15);words.addView(name);TextView description=label(desc,12);description.setTextColor(muted);words.addView(description);row.addView(words);row.setOnClickListener(v->go.run());return row;}
    protected void onPause(){super.onPause();save();}
    public void onBackPressed(){if(drawerDialog!=null&&drawerDialog.isShowing())closeDrawer();else super.onBackPressed();}
}

