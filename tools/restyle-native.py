from pathlib import Path
p=Path('probe/src/EvaActivity.java');s=p.read_text(encoding='utf-8-sig');s=s.replace('    EditText input;', '    android.app.Dialog drawerDialog;\n    EditText input;')
s=s.replace('b.setOnClickListener(v->action.run());return b;', 'EvaUi.style(b);b.setOnClickListener(v->action.run());return b;')
s=s.replace('top.addView(button("会话",()->toggleDrawer()));','top.addView(EvaUi.icon(this,"menu","打开会话侧栏",()->toggleDrawer()));')
a=s.index('        top.addView(button("更多"');b=s.index('page.addView(top);',a)
s=s[:a]+'        top.addView(EvaUi.icon(this,"plus","新聊天",()->newChat()));top.addView(EvaUi.icon(this,"more","设置",()->openSettings()));'+s[b:]
s=s.replace('drawer.setVisibility(View.GONE);page.addView(drawer);','drawer.setVisibility(View.GONE);')
s=s.replace('hs,new LinearLayout.LayoutParams(-1,dp(200))','hs,new LinearLayout.LayoutParams(-1,0,1)')
s=s.replace('controls.addView(button("工具",()->openTools()));','controls.addView(EvaUi.icon(this,"plus","打开工具",()->openTools()));')
s=s.replace('controls.addView(button("保存",()->storeMessage()));','controls.addView(EvaUi.icon(this,"send","保存待发送消息",()->storeMessage()));')
s=s.replace('composer.setBackground(shape(Color.WHITE,20));','composer.setBackground(shape(0xfff7f8fa,24));')
s=s.replace('input.setMinLines(2);','input.setMinLines(2);input.setPadding(dp(6),dp(6),dp(6),dp(6));')
a=s.index('    void toggleDrawer()');b=s.index('    void newChat()',a)
s=s[:a]+'''    void closeDrawer(){if(drawerDialog!=null)drawerDialog.dismiss();}
    void toggleDrawer(){renderHistory();if(drawer.getParent()!=null)((android.view.ViewGroup)drawer.getParent()).removeView(drawer);drawer.setVisibility(View.VISIBLE);drawerDialog=new android.app.Dialog(this);drawerDialog.setContentView(drawer);android.view.Window w=drawerDialog.getWindow();if(w!=null){w.setBackgroundDrawableResource(android.R.color.transparent);w.setLayout(dp(310),-1);w.setGravity(Gravity.LEFT);w.addFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND);android.view.WindowManager.LayoutParams lp=w.getAttributes();lp.dimAmount=.28f;w.setAttributes(lp);}drawerDialog.show();drawerDialog.getWindow().setLayout(Math.min(dp(310),getResources().getDisplayMetrics().widthPixels-dp(40)),-1);}
''' +s[b:]
s=s.replace('drawer.setVisibility(View.GONE);save();render();','closeDrawer();save();render();')
s=s.replace('if(drawer.getVisibility()==View.VISIBLE)drawer.setVisibility(View.GONE);','if(drawerDialog!=null&&drawerDialog.isShowing())closeDrawer();')
a=s.index('        heading.setText("新聊天");TextView welcome=');b=s.index('    }else{JSONObject c=',a)
s=s[:a]+'''        heading.setText("Eva");LinearLayout welcome=new LinearLayout(this);welcome.setOrientation(1);welcome.setGravity(Gravity.CENTER);welcome.setPadding(dp(6),dp(10),dp(6),dp(30));
        TextView mark=label("Eva",42);mark.setTypeface(android.graphics.Typeface.create("sans-serif-light",0));mark.setLetterSpacing(-.04f);mark.setGravity(Gravity.CENTER);welcome.addView(mark);
        TextView title=label("把想法，变成行动",25);title.setTypeface(null,Typeface.BOLD);title.setGravity(Gravity.CENTER);LinearLayout.LayoutParams titleP=new LinearLayout.LayoutParams(-1,-2);titleP.topMargin=dp(20);welcome.addView(title,titleP);
        TextView sub=label("在此手机上浏览、创作与执行",14);sub.setTextColor(muted);sub.setGravity(Gravity.CENTER);LinearLayout.LayoutParams subP=new LinearLayout.LayoutParams(-1,-2);subP.topMargin=dp(10);subP.bottomMargin=dp(30);welcome.addView(sub,subP);
        welcome.addView(shortcut("web","浏览网页","打开 Eva 内置浏览器","browser"));welcome.addView(shortcut("folder","我的工作区","查看文件与项目","files"));welcome.addView(shortcut("terminal","本地终端","运行代码与命令","terminal"));messages.addView(welcome,new LinearLayout.LayoutParams(-1,-1));
''' +s[b:]
pos=s.index('    protected void onPause()')
s=s[:pos]+'''    View shortcut(String glyph,String title,String desc,String tool){LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);row.setPadding(dp(10),dp(7),dp(10),dp(7));row.setBackground(EvaUi.surface(this,0xfff7f8fa,16));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(70));lp.bottomMargin=dp(10);row.setLayoutParams(lp);Runnable go=()->{android.content.Intent i=new android.content.Intent(this,LocalToolsActivity.class);i.putExtra("tool",tool);startActivity(i);};row.addView(EvaUi.icon(this,glyph,title,go));LinearLayout words=new LinearLayout(this);words.setOrientation(1);words.setPadding(dp(8),0,0,0);TextView name=label(title,15);words.addView(name);TextView description=label(desc,12);description.setTextColor(muted);words.addView(description);row.addView(words);row.setOnClickListener(v->go.run());return row;}
''' +s[pos:];p.write_text(s,encoding='utf8')
for filename in ['SettingsActivity.java','LocalToolsActivity.java']:
 p=Path('probe/src')/filename;s=p.read_text(encoding='utf-8-sig');s=s.replace('b.setOnClickListener(v->','EvaUi.style(b);b.setOnClickListener(v->');s=s.replace('back.setText("返回 · 设置");','back.setText("返回 · 设置");EvaUi.style(back);');p.write_text(s,encoding='utf8')
p=Path('tools/build-probe.ps1');s=p.read_text();s=s.replace("'probe/src/SettingsCheck.java'","'probe/src/SettingsCheck.java','probe/src/EvaUi.java'");p.write_text(s)
