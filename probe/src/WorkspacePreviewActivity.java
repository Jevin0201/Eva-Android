package ai.eva.android.probe;
import android.os.*;import android.widget.*;import android.graphics.*;import android.graphics.pdf.PdfRenderer;import android.view.*;import android.webkit.WebChromeClient;import java.io.*;import org.json.JSONObject;

/** Native offline PDF/image preview; no web content or file URLs. */
public class WorkspacePreviewActivity extends ToolPageActivity {
 DesktopDocumentPreview desktopDocument;DesktopNotebookPreview notebook;OfficeLayoutPreview layout;RichPreview rich;PdfRenderer pdf;ParcelFileDescriptor descriptor;ImageView image;TextView counter;Bitmap bitmap;int number;Button previous,next;File source;boolean pendingLayout;
 FrameLayout previewStage;View divider,exitFullscreen,mediaFullscreen;WebChromeClient.CustomViewCallback mediaCallback;boolean readingFullscreen;int insetLeft,insetTop,insetRight,insetBottom;
 boolean originalLayout;TextView layoutProgress,officeStateText;String officePhase="none",officeMessage="";
 static final java.util.concurrent.ExecutorService selectionWorker=java.util.concurrent.Executors.newSingleThreadExecutor();boolean selectionPreparing;
 public void onCreate(Bundle state){super.onCreate(state);page("文件预览","");configurePreviewChrome(state);pendingLayout=state!=null&&state.getBoolean("pendingLayout");try{
  File file=WorkspaceFiles.resolve(this,getIntent().getStringExtra("path"));if(!file.isFile())throw new IOException("文件不存在");source=file;if(state==null&&getIntent().getBooleanExtra("export-on-open",false))header.post(this::export);pageTitle.setText(file.getName());pageTitle.setContentDescription(file.getName());
  if(file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".apk")){
   body.addView(label("Android 安装包",17));
   android.content.pm.PackageInfo info=getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(),0);
   if(info!=null){body.addView(label(info.packageName,14));body.addView(label("版本 "+info.versionName+" · "+info.getLongVersionCode(),12));}
   else body.addView(label("系统安装器会进一步检查安装包格式与签名。",13));
   body.addView(label(android.text.format.Formatter.formatFileSize(this,file.length()),12));
   body.addView(button("使用系统安装器安装",this::installApk));return;
  }
  if(DesktopDocumentPreview.supports(file)){desktopDocument=new DesktopDocumentPreview(this,file,state);return;}
  if(file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".ipynb")){notebook=new DesktopNotebookPreview(this,file,state);return;}
  if(!file.getName().toLowerCase(java.util.Locale.ROOT).matches(".*\\.(pdf|png|jpg|jpeg|webp|gif|bmp|img)$")){rich=new RichPreview(this,file,state);return;}
  image=new ImageView(this);image.setAdjustViewBounds(true);image.setScaleType(ImageView.ScaleType.FIT_CENTER);body.addView(image,new LinearLayout.LayoutParams(-1,0,1));
  if(file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")){
   descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);pdf=new PdfRenderer(descriptor);if(pdf.getPageCount()==0)throw new IOException("PDF 没有页面");
   LinearLayout controls=new LinearLayout(this);previous=button("上一页",()->draw(number-1));next=button("下一页",()->draw(number+1));counter=label("",12);controls.addView(previous,new LinearLayout.LayoutParams(0,-2,1));counter.setGravity(android.view.Gravity.CENTER);controls.addView(counter,new LinearLayout.LayoutParams(0,-2,1));controls.addView(next,new LinearLayout.LayoutParams(0,-2,1));body.addView(controls);draw(state==null?0:Math.min(state.getInt("page",0),pdf.getPageCount()-1));
  }else{BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getPath(),options);if(options.outWidth<=0||options.outHeight<=0)throw new IOException("图片格式无法预览");options.inSampleSize=1;while((long)(options.outWidth/options.inSampleSize)*(options.outHeight/options.inSampleSize)>2000000)options.inSampleSize*=2;options.inJustDecodeBounds=false;bitmap=BitmapFactory.decodeFile(file.getPath(),options);if(bitmap==null)throw new IOException("图片读取失败");image.setImageBitmap(bitmap);}
 }catch(Exception e){body.addView(label("无法预览："+e.getMessage(),14));}}
 void closeOfficeSurface(){hideMediaFullscreen();if(desktopDocument!=null){desktopDocument.destroy();desktopDocument=null;}if(rich!=null){rich.destroy();rich=null;}setLayoutProgress(null);officeStateText=null;body.removeAllViews();}
 void showOfficeStatus(String phase,String message,boolean working){
  closeOfficeSurface();originalLayout=false;officePhase=phase;officeMessage=message;
  LinearLayout panel=new LinearLayout(this);panel.setOrientation(1);panel.setGravity(Gravity.CENTER);panel.setPadding(dp(24),dp(16),dp(24),dp(16));
  if(working)panel.addView(new ProgressBar(this),new LinearLayout.LayoutParams(dp(32),dp(32)));
  TextView title=label(working?"正在准备最终排版":"最终排版未完成",18);panel.addView(title);officeStateText=label(message,14);panel.addView(officeStateText);
  if(working)panel.addView(button("取消生成",()->{if(layout!=null)layout.cancel();}));else panel.addView(button("重试最终排版",()->{if(layout!=null)layout.start();}));
  body.addView(panel,new LinearLayout.LayoutParams(-1,0,1));
 }
 void setLayoutProgress(String text){
  if(text!=null&&officeStateText!=null){officeStateText.setText(text);officeMessage=text;return;}
  if(text==null){if(layoutProgress!=null)body.removeView(layoutProgress);layoutProgress=null;return;}
  if(layoutProgress==null){layoutProgress=label("",12);layoutProgress.setPadding(dp(12),dp(6),dp(12),dp(6));layoutProgress.setMaxLines(2);layoutProgress.setOnClickListener(v->{if(layout!=null)layout.showDetails();});body.addView(layoutProgress,0,new LinearLayout.LayoutParams(-1,-2));}layoutProgress.setText(text);
 }
 void showOfficeOriginal(File rendered){
  showOfficeOriginal(rendered,null);
 }
 void showOfficeOriginal(File rendered,org.json.JSONArray sheetNames){
  closeOfficeSurface();desktopDocument=new DesktopDocumentPreview(this,rendered,null,sheetNames);originalLayout=true;officePhase="ready";officeMessage="最终排版已就绪";
 }
 void showOfficeContent(){
  if(layout!=null)layout.showWhenReady=false;
  closeOfficeSurface();if(DesktopDocumentPreview.supports(source))desktopDocument=new DesktopDocumentPreview(this,source,null);else rich=new RichPreview(this,source,null);originalLayout=false;officePhase="content";officeMessage="可选内容工具视图，非最终排版";
  if(layout!=null&&layout.busy)setLayoutProgress("原版排版正在后台生成，可在更多中取消");
 }
 void configurePreviewChrome(Bundle state){
  body.setPadding(0,0,0,0);header.setPadding(0,0,0,0);header.getLayoutParams().height=dp(48);pageTitle.setTextSize(15);
  header.getChildAt(0).setLayoutParams(new LinearLayout.LayoutParams(dp(48),dp(48)));
  divider=root.getChildAt(1);
  View expand=fullscreenIcon("全屏阅读",()->setReadingFullscreen(true));header.addView(expand,new LinearLayout.LayoutParams(dp(48),dp(48)));
  View more=actionIcon("more","更多预览工具",()->showPreviewMenu());header.addView(more,new LinearLayout.LayoutParams(dp(48),dp(48)));
  previewStage=new FrameLayout(this);((ViewGroup)root.getParent()).removeView(root);previewStage.addView(root,new FrameLayout.LayoutParams(-1,-1));setContentView(previewStage);
  exitFullscreen=fullscreenIcon("退出全屏阅读",()->{if(mediaFullscreen!=null)hideMediaFullscreen();else setReadingFullscreen(false);});
  exitFullscreen.setBackground(EvaUi.surface(this,paper,12));exitFullscreen.setElevation(dp(4));
  FrameLayout.LayoutParams exitParams=new FrameLayout.LayoutParams(dp(48),dp(48),Gravity.BOTTOM|Gravity.END);exitParams.setMargins(dp(8),dp(8),dp(8),dp(8));previewStage.addView(exitFullscreen,exitParams);
  root.setOnApplyWindowInsetsListener((view,insets)->{insetLeft=insets.getSystemWindowInsetLeft();insetTop=insets.getSystemWindowInsetTop();insetRight=insets.getSystemWindowInsetRight();insetBottom=insets.getSystemWindowInsetBottom();updatePreviewInsets();
   android.view.DisplayCutout cutout=insets.getDisplayCutout();FrameLayout.LayoutParams params=(FrameLayout.LayoutParams)exitFullscreen.getLayoutParams();params.bottomMargin=dp(8)+Math.max(insetBottom,cutout==null?0:cutout.getSafeInsetBottom());params.rightMargin=dp(8)+Math.max(insetRight,cutout==null?0:cutout.getSafeInsetRight());exitFullscreen.setLayoutParams(params);return insets;});
  readingFullscreen=state!=null&&state.getBoolean("preview-fullscreen");applyPreviewFullscreen();
 }
 View fullscreenIcon(String description,Runnable action){
  View icon=new View(this){final Paint stroke=new Paint(3);protected void onDraw(Canvas canvas){super.onDraw(canvas);canvas.save();canvas.translate(getWidth()/2f-dp(12),getHeight()/2f-dp(12));canvas.scale(dp(24)/24f,dp(24)/24f);stroke.setColor(ink);stroke.setStrokeWidth(1.7f);stroke.setStyle(Paint.Style.STROKE);stroke.setStrokeCap(Paint.Cap.ROUND);if(description.startsWith("退出")){canvas.drawLine(6,6,18,18,stroke);canvas.drawLine(18,6,6,18,stroke);}else for(int x:new int[]{5,19})for(int y:new int[]{5,19}){canvas.drawLine(x,y,x+(x==5?5:-5),y,stroke);canvas.drawLine(x,y,x,y+(y==5?5:-5),stroke);}canvas.restore();}};
  icon.setContentDescription(description);icon.setTooltipText(description);icon.setFocusable(true);icon.setOnClickListener(v->action.run());icon.setBackground(EvaUi.surface(this,paper,12));return icon;
 }
 void showPreviewMenu(){
  PopupMenu menu=new PopupMenu(this,header.getChildAt(header.getChildCount()-1));
  menu.getMenu().add(0,1,0,"另存到手机");
  if(desktopDocument!=null&&source!=null&&java.util.Arrays.asList("docx","xlsx","pptx","md","markdown").contains(DocumentPreview.ext(source)))menu.getMenu().add(0,9,1,"将选区交给 Eva 修改");
  if(source!=null&&java.util.Arrays.asList("text","markdown","html").contains(DocumentPreview.kind(source)))menu.getMenu().add(0,2,1,"编辑文件");
  if(source!=null&&DocumentPreview.ext(source).equals("apk"))menu.getMenu().add(0,3,2,"安装应用");
  menu.getMenu().add(0,6,5,"文件信息");
  menu.setOnMenuItemClickListener(item->{switch(item.getItemId()){case 1:export();break;case 2:startActivity(new android.content.Intent(this,WorkspaceEditActivity.class).putExtra("path",getIntent().getStringExtra("path")));break;case 3:installApk();break;case 9:requestSelectionEdit();break;case 6:if(source!=null)new android.app.AlertDialog.Builder(this).setTitle(source.getName()).setMessage(android.text.format.Formatter.formatFileSize(this,source.length())).setPositiveButton("关闭",null).show();break;}return true;});menu.show();
 }
 static JSONObject checkedSelection(JSONObject selected,String expectedKind)throws Exception{
  Object text=selected.opt("selectedText");if(text==null||text==JSONObject.NULL)text=selected.opt("text");
  if(!(text instanceof String)||(!expectedKind.equals("xlsx")&&((String)text).trim().isEmpty())||((String)text).length()>16000)throw new IOException("请先选中文字或单元格（最多 16000 字符）");
  if(!(selected.opt("kind") instanceof String)||!expectedKind.equals(selected.getString("kind")))throw new IOException("选区类型与原文件不一致，请重新选择");
  JSONObject locator=selected.getJSONObject("locator"),safe=new JSONObject();String[] numbers,strings;
  switch(expectedKind){
   case "docx":numbers=new String[]{"page","paragraphStart","paragraphEnd","startOffset","endOffset"};strings=new String[]{"quote"};break;
   case "xlsx":numbers=new String[]{"row","col"};strings=new String[]{"sheetName","cellRange","currentValue"};break;
   case "pptx":numbers=new String[]{"slide","shape"};strings=new String[]{"currentValue"};break;
   case "markdown":numbers=new String[]{"startLine","endLine","startOffset","endOffset"};strings=new String[]{"quote"};break;
   default:throw new IOException("此格式暂不支持定位选区修改");
  }
  java.util.Set<String> allowed=new java.util.HashSet<>();java.util.Collections.addAll(allowed,numbers);java.util.Collections.addAll(allowed,strings);
  java.util.Iterator<String> keys=locator.keys();while(keys.hasNext())if(!allowed.contains(keys.next()))throw new IOException("选区定位包含不支持的字段");
  for(String key:numbers){Object value=locator.get(key);if(!(value instanceof Integer||value instanceof Long))throw new IOException("选区位置必须是整数");long n=((Number)value).longValue();long min=java.util.Arrays.asList("page","slide","startLine","endLine").contains(key)?1:0;long max=key.equals("col")?16383:key.equals("row")?1048575:40000000;if(n<min||n>max)throw new IOException("选区位置超出支持范围");safe.put(key,n);}
  for(String key:strings){Object value=locator.get(key);if(!(value instanceof String)||((String)value).length()>(key.equals("sheetName")?200:key.equals("cellRange")?80:16000))throw new IOException("选区定位文字无效或过长");safe.put(key,value);}
  if(expectedKind.equals("docx")&&(safe.getLong("paragraphEnd")<safe.getLong("paragraphStart")||safe.getLong("paragraphStart")==safe.getLong("paragraphEnd")&&safe.getLong("endOffset")<safe.getLong("startOffset")))throw new IOException("文字选区顺序无效");
  if(expectedKind.equals("markdown")&&(safe.getLong("endLine")<safe.getLong("startLine")||safe.getLong("endOffset")<safe.getLong("startOffset")))throw new IOException("Markdown 选区顺序无效");
  if(expectedKind.equals("xlsx")){String sheet=safe.getString("sheetName");if(sheet.trim().isEmpty()||!safe.getString("cellRange").matches("\\$?[A-Z]{1,3}\\$?[1-9][0-9]{0,6}(:\\$?[A-Z]{1,3}\\$?[1-9][0-9]{0,6})?"))throw new IOException("单元格定位无效");for(int i=0;i<sheet.length();i++)if(Character.isISOControl(sheet.charAt(i)))throw new IOException("工作表名称包含控制字符");if(((String)text).isEmpty()&&!safe.getString("currentValue").isEmpty())throw new IOException("空选区与单元格当前值不一致");}
  return new JSONObject().put("kind",expectedKind).put("selectedText",text).put("locator",safe);
 }
 void selectionError(String message){selectionPreparing=false;if(!isDestroyed()&&!isFinishing())Toast.makeText(this,message,Toast.LENGTH_LONG).show();}
 void requestSelectionEdit(){
  if(selectionPreparing){Toast.makeText(this,"正在处理上一次选区操作，请稍候",Toast.LENGTH_SHORT).show();return;}if(desktopDocument==null||source==null)return;selectionPreparing=true;
  final DesktopDocumentPreview reader=desktopDocument;final File selectedSource=source;
  reader.readSelection(value->{
   try{
    if(value==null||value.equals("null")){selectionError("请先选中文字或单元格");return;}if(value.length()>512*1024)throw new IOException("选区返回内容过长，请缩小选择范围");
    String ext=DocumentPreview.ext(selectedSource),kind=java.util.Arrays.asList("md","markdown").contains(ext)?"markdown":ext;
    JSONObject selected=checkedSelection(new JSONObject(value),kind);
    selectionWorker.execute(()->{try{
     File original=selectedSource.getCanonicalFile(),workspace=WorkspaceFiles.root(this);
     if(!original.isFile()||!original.toPath().startsWith(workspace.toPath())||original.length()>32L*1024*1024)throw new IOException("原文件不存在、越界或超过 32 MiB");
     long stamp=original.lastModified(),length=original.length();String hash=OfficeLayoutPreview.sha256(original);
     OfficeRuntime.deploy(this);
     if(stamp!=original.lastModified()||length!=original.length()||!hash.equals(OfficeLayoutPreview.sha256(original)))throw new IOException("原文件已变化，请重新选择文字或单元格");
     JSONObject payload=new JSONObject().put("id",java.util.UUID.randomUUID().toString()).put("path",workspace.toPath().relativize(original.toPath()).toString().replace('\\','/')).put("name",original.getName()).put("sourceSha256",hash)
      .put("kind",selected.getString("kind")).put("selectedText",selected.getString("selectedText")).put("locator",selected.getJSONObject("locator"));
     runOnUiThread(()->{if(isDestroyed()||isFinishing()||desktopDocument!=reader){selectionPreparing=false;return;}showSelectionInstruction(original,hash,payload);});
    }catch(Exception error){runOnUiThread(()->selectionError("无法准备选区修改："+error.getMessage()));}});
   }catch(Exception error){selectionError(error.getMessage()==null?"无法读取选区，请重新选择":error.getMessage());}
  });
 }
 void showSelectionInstruction(File original,String hash,JSONObject payload){
  LinearLayout panel=new LinearLayout(this);panel.setOrientation(1);panel.setPadding(dp(20),0,dp(20),0);
  TextView selected=label("",13);String text=payload.optString("selectedText");selected.setText(text.isEmpty()?"已选空单元格 "+payload.optJSONObject("locator").optString("cellRange"):text.length()>1000?text.substring(0,1000)+"…":text);selected.setMaxLines(5);panel.addView(selected);
  EditText instruction=new EditText(this);instruction.setHint("例如：把选中的标题改为……");instruction.setMinLines(2);instruction.setMaxLines(4);instruction.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);instruction.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(2000)});panel.addView(instruction);
  panel.addView(label("或直接替换选中内容",13));EditText replacement=new EditText(this);replacement.setHint("替换文字；留空将清除选区");replacement.setMinLines(2);replacement.setMaxLines(4);replacement.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE);replacement.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(16000)});panel.addView(replacement);
  Spinner type=new Spinner(this);boolean spreadsheet=payload.optString("kind").equals("xlsx");if(spreadsheet){ArrayAdapter<String> options=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,new String[]{"文字（按字面保存）","数字","公式（明确写入公式）"});options.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);type.setAdapter(options);panel.addView(type);}
  ScrollView scroll=new ScrollView(this);scroll.addView(panel);android.app.AlertDialog dialog=new android.app.AlertDialog.Builder(this).setTitle("修改选中内容").setView(scroll).setNegativeButton("取消",null).setPositiveButton("交给 Eva 修改",null).setNeutralButton("直接替换",null).create();boolean[] submitted={false};
  dialog.setOnDismissListener(ignored->{if(!submitted[0])selectionPreparing=false;});dialog.show();
  dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).setOnClickListener(ignored->{String request=instruction.getText().toString().trim();if(request.isEmpty()){instruction.setError("请填写希望如何修改选区");return;}submitted[0]=true;dialog.dismiss();
   selectionWorker.execute(()->{try{if(!original.isFile()||!hash.equals(OfficeLayoutPreview.sha256(original)))throw new IOException("原文件已变化，请重新选择");payload.put("instruction",request);
    runOnUiThread(()->{selectionPreparing=false;if(isDestroyed()||isFinishing())return;startActivity(new android.content.Intent(this,ShellActivity.class).putExtra("page","preview-selection").putExtra("preview-selection",payload.toString()));});
   }catch(Exception error){runOnUiThread(()->selectionError("未发送修改请求："+error.getMessage()));}});
  });
  dialog.getButton(android.app.AlertDialog.BUTTON_NEUTRAL).setOnClickListener(ignored->{if(spreadsheet&&payload.optJSONObject("locator").optString("cellRange").contains(":")){Toast.makeText(this,"直接替换请先只选择一个单元格",Toast.LENGTH_LONG).show();return;}submitted[0]=true;String valueType=spreadsheet?new String[]{"text","number","formula"}[type.getSelectedItemPosition()]:"text";String value=replacement.getText().toString();dialog.dismiss();applySelectionEdit(original,hash,payload,value,valueType);});
 }
 void applySelectionEdit(File original,String hash,JSONObject selection,String replacement,String valueType){
  setLayoutProgress("正在保存原格式修改…");final android.content.Context context=getApplicationContext();
  selectionWorker.execute(()->{File requestFile=null,requestDirectory=null;boolean createdDirectory=false;ExecutionLease lease=null;java.lang.Process editingProcess=null;String message="修改未完成";boolean refresh=false;
   try{
    lease=ExecutionLease.acquire(context,"preview-edit:"+java.util.UUID.randomUUID());OfficeRuntime.deploy(context);File workspace=WorkspaceFiles.root(context);
    if(!original.equals(original.getCanonicalFile())||!original.toPath().startsWith(workspace.toPath())||!original.isFile()||!hash.equals(OfficeLayoutPreview.sha256(original)))throw new IOException("原文件已变化，请重新选择");
    requestDirectory=new File(workspace,".eva-edit-requests");if(java.nio.file.Files.isSymbolicLink(requestDirectory.toPath()))throw new IOException("编辑请求目录包含链接");
    if(!requestDirectory.exists()){if(!requestDirectory.mkdir())throw new IOException("无法创建编辑请求目录");createdDirectory=true;}
    if(!requestDirectory.getCanonicalFile().equals(requestDirectory.getAbsoluteFile())||!requestDirectory.isDirectory())throw new IOException("编辑请求目录不安全");
    requestFile=new File(requestDirectory,java.util.UUID.randomUUID()+".json");
    String editKind=DocumentPreview.ext(original);if(editKind.equals("markdown"))editKind="md";
    JSONObject request=new JSONObject().put("path",workspace.toPath().relativize(original.toPath()).toString().replace('\\','/')).put("expectedSha256",hash).put("kind",editKind)
     .put("selectedText",selection.getString("selectedText")).put("locator",selection.getJSONObject("locator")).put("replacement",replacement).put("valueType",valueType);
    java.nio.file.Files.write(requestFile.toPath(),request.toString().getBytes("UTF-8"),java.nio.file.StandardOpenOption.CREATE_NEW,java.nio.file.StandardOpenOption.WRITE);
    ProcessBuilder builder=OfficeRuntime.process(context,"apply","--request","/root/eva-workspace/.eva-edit-requests/"+requestFile.getName());java.util.List<String> command=builder.command();int at=command.indexOf("/root/eva-office.py");if(at<0)throw new IOException("编辑入口命令无效");command.set(at,"/root/.eva-runtime/eva-document-edit.py");
    java.lang.Process child=LinuxRuntime.start(context,builder);editingProcess=child;StringBuilder output=new StringBuilder();Thread drain=new Thread(()->{try(BufferedReader reader=new BufferedReader(new InputStreamReader(child.getInputStream(),"UTF-8"))){String line;while((line=reader.readLine())!=null){synchronized(output){if(output.length()+line.length()<256*1024)output.append(line).append('\n');}}}catch(IOException ignored){}},"eva-preview-edit-output");drain.start();
    if(!child.waitFor(60,java.util.concurrent.TimeUnit.SECONDS)){runOnUiThread(()->{if(!isDestroyed()&&!isFinishing()){setLayoutProgress("仍在保存，等待原子事务结束，请勿重复提交");Toast.makeText(this,"保存仍在处理中，将等待安全结束",Toast.LENGTH_LONG).show();}});child.waitFor();}
    drain.join(3000);String log;synchronized(output){log=output.toString();}JSONObject result=null;for(String line:log.split("\\n"))try{JSONObject row=new JSONObject(line);if(row.has("success"))result=row;}catch(org.json.JSONException ignored){}
    if(child.exitValue()!=0||result==null||!result.optBoolean("success")){if(result!=null&&(result.optBoolean("applied")||result.optBoolean("changed")))throw new IOException("保存可能已提交，但回读校验未通过；备份已保留，请重新打开原文件核对");throw new IOException(result==null?"编辑器未返回有效保存报告":result.optString("error","原格式保存失败"));}
    if(!(result.opt("changed") instanceof Boolean))throw new IOException("保存报告缺少修改状态");String newHash=result.optString("newSHA256");
    if(!original.equals(original.getCanonicalFile())||!newHash.matches("[a-fA-F0-9]{64}")||!newHash.equalsIgnoreCase(OfficeLayoutPreview.sha256(original)))throw new IOException("写回结果未通过文件哈希核验，请检查原文件与备份");
    if(result.getBoolean("changed")){
     String backupPath=result.optString("backupPath");if(backupPath.startsWith("/root/eva-workspace/"))backupPath=backupPath.substring("/root/eva-workspace/".length());else if(backupPath.startsWith("/"))throw new IOException("备份路径不在工作区内");
     if(backupPath.isEmpty())throw new IOException("保存报告缺少自动备份");File backup=WorkspaceFiles.resolve(context,backupPath);if(!backup.isFile()||!hash.equals(OfficeLayoutPreview.sha256(backup)))throw new IOException("自动备份未通过原文件哈希核验");
     refresh=true;message="已保存原格式修改，并保留修改前备份";if(DocumentPreview.ext(original).equals("xlsx")&&result.optJSONArray("warnings")!=null&&result.getJSONArray("warnings").length()>0)message+="；相关公式尚未自动重算";
    }else{if(!hash.equalsIgnoreCase(newHash))throw new IOException("未修改报告与实际文件哈希不一致");message="内容相同，原文件未修改";}
   }catch(Exception error){message="修改未确认完成："+error.getMessage();}
   finally{
    boolean restoreInterrupt=false;while(editingProcess!=null&&editingProcess.isAlive())try{editingProcess.waitFor();}catch(InterruptedException interrupted){restoreInterrupt=true;}
    if(requestFile!=null&&requestDirectory!=null)try{if(!java.nio.file.Files.isSymbolicLink(requestDirectory.toPath())&&requestDirectory.getCanonicalFile().equals(requestDirectory.getAbsoluteFile())){java.nio.file.Files.deleteIfExists(requestFile.toPath());if(createdDirectory){String[] remaining=requestDirectory.list();if(remaining!=null&&remaining.length==0)java.nio.file.Files.deleteIfExists(requestDirectory.toPath());}}}catch(IOException ignored){}
    if(lease!=null)lease.close();final String done=message;final boolean reload=refresh;
    runOnUiThread(()->{selectionPreparing=false;if(isDestroyed()||isFinishing())return;setLayoutProgress(null);if(reload&&source!=null&&source.equals(original)){hideMediaFullscreen();if(desktopDocument!=null)desktopDocument.destroy();desktopDocument=new DesktopDocumentPreview(this,original,null);}Toast.makeText(this,done,Toast.LENGTH_LONG).show();});
    if(restoreInterrupt)Thread.currentThread().interrupt();
   }
  });
 }
 boolean isPreviewFullscreen(){return readingFullscreen||mediaFullscreen!=null;}
 void setReadingFullscreen(boolean fullscreen){readingFullscreen=fullscreen;applyPreviewFullscreen();}
 void updatePreviewInsets(){if(root!=null)root.setPadding(isPreviewFullscreen()?0:insetLeft,isPreviewFullscreen()?0:insetTop,isPreviewFullscreen()?0:insetRight,isPreviewFullscreen()?0:insetBottom);}
 void applyPreviewFullscreen(){
  if(header==null)return;boolean fullscreen=isPreviewFullscreen();header.setVisibility(fullscreen?View.GONE:View.VISIBLE);divider.setVisibility(fullscreen?View.GONE:View.VISIBLE);exitFullscreen.setVisibility(fullscreen?View.VISIBLE:View.GONE);exitFullscreen.setContentDescription(mediaFullscreen!=null?"退出媒体全屏":"退出全屏阅读");
  if(getActionBar()!=null)getActionBar().hide();
  if(Build.VERSION.SDK_INT>=30){android.view.WindowInsetsController controller=getWindow().getInsetsController();if(controller!=null){controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);if(fullscreen)controller.hide(WindowInsets.Type.systemBars());else controller.show(WindowInsets.Type.systemBars());}}
  else getWindow().getDecorView().setSystemUiVisibility(fullscreen?View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE:View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
  updatePreviewInsets();root.requestApplyInsets();
 }
 void showMediaFullscreen(View view,WebChromeClient.CustomViewCallback callback){if(mediaFullscreen!=null){callback.onCustomViewHidden();return;}mediaFullscreen=view;mediaCallback=callback;root.setVisibility(View.GONE);previewStage.addView(view,new FrameLayout.LayoutParams(-1,-1));exitFullscreen.bringToFront();applyPreviewFullscreen();}
 void hideMediaFullscreen(){if(mediaFullscreen==null)return;View view=mediaFullscreen;WebChromeClient.CustomViewCallback callback=mediaCallback;mediaFullscreen=null;mediaCallback=null;previewStage.removeView(view);root.setVisibility(View.VISIBLE);if(callback!=null)callback.onCustomViewHidden();applyPreviewFullscreen();}
 public void onBackPressed(){if(mediaFullscreen!=null){hideMediaFullscreen();return;}if(readingFullscreen){setReadingFullscreen(false);return;}super.onBackPressed();}
 public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused&&previewStage!=null)applyPreviewFullscreen();}
 void draw(int page){if(pdf==null||page<0||page>=pdf.getPageCount())return;try(PdfRenderer.Page p=pdf.openPage(page)){float scale=Math.min(2f,1400f/Math.max(p.getWidth(),p.getHeight()));Bitmap nextBitmap=Bitmap.createBitmap(Math.max(1,(int)(p.getWidth()*scale)),Math.max(1,(int)(p.getHeight()*scale)),Bitmap.Config.ARGB_8888);nextBitmap.eraseColor(Color.WHITE);try{p.render(nextBitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);}catch(Exception e){nextBitmap.recycle();throw e;}image.setImageBitmap(nextBitmap);if(bitmap!=null)bitmap.recycle();bitmap=nextBitmap;number=page;counter.setText((page+1)+" / "+pdf.getPageCount());previous.setEnabled(page>0);next.setEnabled(page+1<pdf.getPageCount());}catch(Exception e){Toast.makeText(this,"页面渲染失败",1).show();}}
 void installApk(){if(source==null)return;try{
  if(!getPackageManager().canRequestPackageInstalls()){
   Toast.makeText(this,"请允许 Eva 安装应用，返回后再次点击安装",Toast.LENGTH_LONG).show();
   startActivity(new android.content.Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,android.net.Uri.parse("package:"+getPackageName())));return;
  }
  android.net.Uri uri=ApkInstallProvider.uri(this,source);
  android.content.Intent intent=new android.content.Intent(android.content.Intent.ACTION_VIEW).setDataAndType(uri,ApkInstallProvider.MIME).addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
  intent.setClipData(android.content.ClipData.newRawUri("APK",uri));startActivity(intent);
 }catch(Exception error){Toast.makeText(this,"无法打开系统安装器："+error.getMessage(),Toast.LENGTH_LONG).show();}}
 void export(){if(source==null)return;try{startActivityForResult(new android.content.Intent(android.content.Intent.ACTION_CREATE_DOCUMENT).addCategory(android.content.Intent.CATEGORY_OPENABLE).setType(DocumentPreview.mime(source)).putExtra(android.content.Intent.EXTRA_TITLE,source.getName()),702);}catch(Exception e){Toast.makeText(this,"无法打开保存位置",1).show();}}
 protected void onActivityResult(int request,int result,android.content.Intent intent){super.onActivityResult(request,result,intent);if(request==721){boolean resume=pendingLayout;pendingLayout=false;if(resume&&layout!=null){if(RuntimeComponents.installed(this,"office"))layout.start();else showOfficeStatus("component-declined","办公组件尚未就绪，未生成最终排版。可重试完成安装。",false);}return;}if(request!=702||result!=RESULT_OK||intent==null||intent.getData()==null||source==null)return;File selected=source;new Thread(()->{String message;try{WorkspaceFiles.export(this,selected,intent.getData());message="文件已保存到所选位置";}catch(Exception e){message="保存失败，请重新选择位置";}final String done=message;runOnUiThread(()->{if(!isDestroyed())Toast.makeText(this,done,1).show();});}).start();}
 protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putInt("page",number);out.putBoolean("pendingLayout",pendingLayout);out.putBoolean("preview-fullscreen",readingFullscreen);if(rich!=null)rich.save(out);if(notebook!=null)notebook.save(out);}
 protected void onPause(){hideMediaFullscreen();if(desktopDocument!=null)desktopDocument.pause();if(rich!=null)rich.pause();super.onPause();}
 protected void onResume(){if(desktopDocument!=null)desktopDocument.resume();super.onResume();if(rich!=null)rich.resume();}
 protected void onDestroy(){hideMediaFullscreen();if(desktopDocument!=null)desktopDocument.destroy();if(notebook!=null)notebook.destroy();if(layout!=null)layout.destroy();if(rich!=null)rich.destroy();if(image!=null)image.setImageDrawable(null);if(bitmap!=null)bitmap.recycle();if(pdf!=null)pdf.close();if(descriptor!=null)try{descriptor.close();}catch(Exception ignored){}super.onDestroy();}
}
