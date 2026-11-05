package ai.eva.android.probe;
import android.os.*;import android.widget.*;import android.graphics.*;import android.graphics.pdf.PdfRenderer;import java.io.*;

/** Native offline PDF/image preview; no web content or file URLs. */
public class WorkspacePreviewActivity extends ToolPageActivity {
 DesktopNotebookPreview notebook;OfficeLayoutPreview layout;RichPreview rich;PdfRenderer pdf;ParcelFileDescriptor descriptor;ImageView image;TextView counter;Bitmap bitmap;int number;Button previous,next;File source;
 public void onCreate(Bundle state){super.onCreate(state);page("文件预览","");try{
  File file=WorkspaceFiles.resolve(this,getIntent().getStringExtra("path"));if(!file.isFile())throw new IOException("文件不存在");source=file;if(state==null&&getIntent().getBooleanExtra("export-on-open",false))header.post(this::export);if(java.util.Arrays.asList("text","markdown","html").contains(DocumentPreview.kind(file)))header.addView(button("编辑",()->startActivity(new android.content.Intent(this,WorkspaceEditActivity.class).putExtra("path",getIntent().getStringExtra("path")))),new LinearLayout.LayoutParams(-2,dp(44)));pageTitle.setText(file.getName());if(file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".apk"))header.addView(button("安装",this::installApk),new LinearLayout.LayoutParams(-2,dp(44)));header.addView(actionIcon("file","另存到手机",()->export()));
  if(file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".apk")){
   body.addView(label("Android 安装包",17));
   android.content.pm.PackageInfo info=getPackageManager().getPackageArchiveInfo(file.getAbsolutePath(),0);
   if(info!=null){body.addView(label(info.packageName,14));body.addView(label("版本 "+info.versionName+" · "+info.getLongVersionCode(),12));}
   else body.addView(label("系统安装器会进一步检查安装包格式与签名。",13));
   body.addView(label(android.text.format.Formatter.formatFileSize(this,file.length()),12));
   body.addView(button("使用系统安装器安装",this::installApk));return;
  }
  if(file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".ipynb")){notebook=new DesktopNotebookPreview(this,file,state);return;}
  if(!file.getName().toLowerCase(java.util.Locale.ROOT).matches(".*\\.(pdf|png|jpg|jpeg|webp|gif|bmp|img)$")){rich=new RichPreview(this,file,state);if(DocumentPreview.kind(file).equals("office"))layout=new OfficeLayoutPreview(this,file);return;}
  image=new ImageView(this);image.setAdjustViewBounds(true);image.setScaleType(ImageView.ScaleType.FIT_CENTER);body.addView(image,new LinearLayout.LayoutParams(-1,0,1));
  if(file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")){
   descriptor=ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY);pdf=new PdfRenderer(descriptor);if(pdf.getPageCount()==0)throw new IOException("PDF 没有页面");
   LinearLayout controls=new LinearLayout(this);previous=button("上一页",()->draw(number-1));next=button("下一页",()->draw(number+1));counter=label("",12);controls.addView(previous,new LinearLayout.LayoutParams(0,-2,1));counter.setGravity(android.view.Gravity.CENTER);controls.addView(counter,new LinearLayout.LayoutParams(0,-2,1));controls.addView(next,new LinearLayout.LayoutParams(0,-2,1));body.addView(controls);draw(state==null?0:Math.min(state.getInt("page",0),pdf.getPageCount()-1));
  }else{BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getPath(),options);if(options.outWidth<=0||options.outHeight<=0)throw new IOException("图片格式无法预览");options.inSampleSize=1;while((long)(options.outWidth/options.inSampleSize)*(options.outHeight/options.inSampleSize)>2000000)options.inSampleSize*=2;options.inJustDecodeBounds=false;bitmap=BitmapFactory.decodeFile(file.getPath(),options);if(bitmap==null)throw new IOException("图片读取失败");image.setImageBitmap(bitmap);}
 }catch(Exception e){body.addView(label("无法预览："+e.getMessage(),14));}}
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
 protected void onActivityResult(int request,int result,android.content.Intent intent){super.onActivityResult(request,result,intent);if(request!=702||result!=RESULT_OK||intent==null||intent.getData()==null||source==null)return;File selected=source;new Thread(()->{String message;try{WorkspaceFiles.export(this,selected,intent.getData());message="文件已保存到所选位置";}catch(Exception e){message="保存失败，请重新选择位置";}final String done=message;runOnUiThread(()->{if(!isDestroyed())Toast.makeText(this,done,1).show();});}).start();}
 protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);out.putInt("page",number);if(rich!=null)rich.save(out);if(notebook!=null)notebook.save(out);}
 protected void onPause(){if(rich!=null)rich.pause();super.onPause();}
 protected void onResume(){super.onResume();if(rich!=null)rich.resume();}
 protected void onDestroy(){if(notebook!=null)notebook.destroy();if(layout!=null)layout.destroy();if(rich!=null)rich.destroy();if(image!=null)image.setImageDrawable(null);if(bitmap!=null)bitmap.recycle();if(pdf!=null)pdf.close();if(descriptor!=null)try{descriptor.close();}catch(Exception ignored){}super.onDestroy();}
}
