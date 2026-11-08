package ai.eva.android.probe;
import android.app.*;
import android.os.Bundle;
import android.view.*;
import android.widget.*;
import android.webkit.*;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.TimeUnit;

/** Shared visual primitives only: no tool routing or tool state. */
public abstract class ToolPageActivity extends Activity {
    LinearLayout root,body,header;TextView pageTitle;int ink=EvaUi.INK,paper=0xffFFFFFF;
    int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
    Button button(String title,Runnable action){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setTextSize(14);EvaUi.style(b);b.setTextColor(ink);if(paper!=0xffFFFFFF){android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();bg.setColor(0xff303236);bg.setCornerRadius(dp(10));b.setBackground(bg);}if(settingsSurface())SettingsVisuals.button(b);b.setOnClickListener(v->action.run());return b;}

    boolean settingsSurface(){return this instanceof ModelsActivity||this instanceof AccountActivity||this instanceof RuntimeSetupActivity||this instanceof PhoneControlActivity||this instanceof DataBackupActivity||this instanceof ScheduledTaskActivity;}
    TextView label(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setLineSpacing(dp(2),1.08f);v.setTextColor(ink);v.setPadding(0,dp(8),0,dp(8));return v;}
    void section(String title){TextView v=label(title,12);v.setTextColor(paper==0xffFFFFFF?EvaUi.MUTED:0xffa0adbc);v.setTypeface(null,android.graphics.Typeface.BOLD);v.setPadding(0,dp(24),0,dp(10));body.addView(v);}
    void statusCard(TextView v){v.setPadding(dp(16),dp(16),dp(16),dp(16));v.setBackground(EvaUi.surface(this,paper==0xffFFFFFF?EvaUi.SOFT:0xff242c36,16));v.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);}
    void clear(){body.removeAllViews();}
    void page(String title,String subtitle){
        if(android.os.Build.VERSION.SDK_INT>=33){
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                ()->onBackPressed());
        }
        if(getSharedPreferences("eva-settings",0).getString("theme","light").equals("dark")){ink=0xffe9edf3;paper=0xff191e25;}
        if(settingsSurface()){ink=SettingsVisuals.ink(this);paper=EvaUi.dark(this)?0xff20231f:0xffFFFFFF;}
        root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(paper);root.setOnApplyWindowInsetsListener((v,i)->{v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});setContentView(root);if(settingsSurface())SettingsVisuals.watchInputs(root);
        header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(4),0,dp(8),0);header.addView(actionIcon("back","返回上一页",()->leavePage()));pageTitle=label(title,17);pageTitle.setTypeface(null,android.graphics.Typeface.BOLD);pageTitle.setSingleLine();pageTitle.setEllipsize(android.text.TextUtils.TruncateAt.END);header.addView(pageTitle,new LinearLayout.LayoutParams(0,-2,1));root.addView(header,new LinearLayout.LayoutParams(-1,dp(60)));View line=new View(this);line.setBackgroundColor(paper==0xffFFFFFF?0xffedf0f3:0xff303236);root.addView(line,new LinearLayout.LayoutParams(-1,dp(1)));
        body=new LinearLayout(this);body.setOrientation(1);body.setPadding(dp(20),dp(8),dp(20),dp(16));root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
    }
    View actionIcon(String kind,String description,Runnable action){View v=EvaUi.icon(this,kind,description,action);if(v instanceof ImageView)((ImageView)v).setColorFilter(ink);return v;}
    void leavePage(){finish();}
}
