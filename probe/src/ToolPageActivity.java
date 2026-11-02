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
    LinearLayout root,body,header;TextView pageTitle;int ink=0xff202124,paper=0xffFFFFFF;
    int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
    Button button(String title,Runnable action){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setTextSize(13);EvaUi.style(b);b.setTextColor(ink);if(paper!=0xffFFFFFF){android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();bg.setColor(0xff303236);bg.setCornerRadius(dp(10));b.setBackground(bg);}b.setOnClickListener(v->action.run());return b;}

    TextView label(String value,int size){TextView v=new TextView(this);v.setText(value);v.setTextSize(size);v.setTextColor(ink);v.setPadding(0,dp(8),0,dp(8));return v;}
    void clear(){body.removeAllViews();}
    void page(String title,String subtitle){
        if(getSharedPreferences("eva-settings",0).getString("theme","light").equals("dark")){ink=0xffeeeeee;paper=0xff191b1d;}
        root=new LinearLayout(this);root.setOrientation(1);root.setBackgroundColor(paper);root.setOnApplyWindowInsetsListener((v,i)->{v.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});setContentView(root);
        header=new LinearLayout(this);header.setGravity(Gravity.CENTER_VERTICAL);header.setPadding(dp(4),0,dp(8),0);header.addView(actionIcon("back","返回上一页",()->leavePage()));pageTitle=label(title,17);pageTitle.setTypeface(null,android.graphics.Typeface.BOLD);pageTitle.setSingleLine();pageTitle.setEllipsize(android.text.TextUtils.TruncateAt.END);header.addView(pageTitle,new LinearLayout.LayoutParams(0,-2,1));root.addView(header,new LinearLayout.LayoutParams(-1,dp(56)));View line=new View(this);line.setBackgroundColor(paper==0xffFFFFFF?0xffedf0f3:0xff303236);root.addView(line,new LinearLayout.LayoutParams(-1,dp(1)));
        body=new LinearLayout(this);body.setOrientation(1);body.setPadding(dp(16),0,dp(16),dp(12));root.addView(body,new LinearLayout.LayoutParams(-1,0,1));
    }
    View actionIcon(String kind,String description,Runnable action){View v=EvaUi.icon(this,kind,description,action);if(v instanceof ImageView)((ImageView)v).setColorFilter(ink);return v;}
    void leavePage(){finish();}
}
