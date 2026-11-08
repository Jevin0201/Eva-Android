package ai.eva.android.probe;

import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;

/** Explicit device-only UI regression; creates/removes its own workspace fixture. */
public final class WorkspacePreviewChromeCheck extends Instrumentation {
    private int checks;
    private void check(boolean condition, String message) { if (!condition) throw new AssertionError(message); checks++; }
    public void onCreate(Bundle options) { super.onCreate(options); start(); }
    public void onStart() {
        Bundle result = new Bundle(); File fixture = null, renderedFixture = null, cacheFixture = null, cacheScope = null; WorkspacePreviewActivity activity = null;
        ActivityMonitor monitor = null;
        try {
            String name = "preview-chrome-check-" + java.util.UUID.randomUUID() + ".txt";
            fixture = new File(WorkspaceFiles.root(getTargetContext()), name);
            if (!fixture.createNewFile()) throw new AssertionError("fixture exists");
            try (FileOutputStream output = new FileOutputStream(fixture)) { output.write("Preview chrome fixture".getBytes("UTF-8")); }
            activity = (WorkspacePreviewActivity) startActivitySync(new Intent(getTargetContext(), WorkspacePreviewActivity.class)
                .putExtra("path", name).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            final WorkspacePreviewActivity first = activity;
            runOnMainSync(() -> {
                check(first.header.getLayoutParams().height == first.dp(48), "compact header height");
                check(first.header.getChildCount() == 4, "only back title fullscreen and more occupy header");
                check(first.body.getPaddingLeft() == 0 && first.body.getPaddingRight() == 0 && first.body.getPaddingTop() == 0 && first.body.getPaddingBottom() == 0, "preview fills available body");
                first.setReadingFullscreen(true);
                check(first.header.getVisibility() == View.GONE && first.divider.getVisibility() == View.GONE, "reading fullscreen hides host chrome");
                check(first.exitFullscreen.getVisibility() == View.VISIBLE && first.root.getPaddingTop() == 0, "fullscreen offers visible exit and no host inset gap");
                int gravity = ((android.widget.FrameLayout.LayoutParams) first.exitFullscreen.getLayoutParams()).gravity;
                check((gravity & android.view.Gravity.VERTICAL_GRAVITY_MASK) == android.view.Gravity.BOTTOM, "fullscreen exit stays clear of reader top toolbar");
                first.onBackPressed();
                check(!first.isFinishing() && !first.isPreviewFullscreen() && first.header.getVisibility() == View.VISIBLE, "back restores reading chrome before leaving activity");
                first.setReadingFullscreen(true);
                AtomicInteger callback = new AtomicInteger();
                first.showMediaFullscreen(new View(first), () -> callback.incrementAndGet());
                check(first.mediaFullscreen != null && first.root.getVisibility() == View.GONE, "media custom view occupies preview stage");
                first.onBackPressed();
                check(callback.get() == 1 && first.mediaFullscreen == null && first.readingFullscreen && first.root.getVisibility() == View.VISIBLE, "media exit invokes callback and preserves reading fullscreen");
            });
            monitor = addMonitor(WorkspacePreviewActivity.class.getName(), null, false);
            runOnMainSync(first::recreate);
            WorkspacePreviewActivity recreated = (WorkspacePreviewActivity) monitor.waitForActivityWithTimeout(8000);
            if (recreated == null) throw new AssertionError("recreation timeout");
            activity = recreated;
            runOnMainSync(() -> {
                check(recreated.readingFullscreen && recreated.header.getVisibility() == View.GONE, "reading fullscreen survives activity recreation");
                recreated.exitFullscreen.performClick();
                check(!recreated.isPreviewFullscreen() && recreated.header.getVisibility() == View.VISIBLE, "exit button restores normal preview");
            });
            File workspace=WorkspaceFiles.root(getTargetContext());
            File generatedFolder=new File(workspace,".eva-previews/chrome-check-"+java.util.UUID.randomUUID());
            if(!generatedFolder.getCanonicalFile().equals(generatedFolder.getAbsoluteFile())||!generatedFolder.mkdirs())throw new AssertionError("isolated PDF fixture directory");
            renderedFixture=new File(generatedFolder,"document.pdf");
            android.graphics.pdf.PdfDocument document=new android.graphics.pdf.PdfDocument();
            try(FileOutputStream output=new FileOutputStream(renderedFixture)){
                android.graphics.pdf.PdfDocument.Page page=document.startPage(new android.graphics.pdf.PdfDocument.PageInfo.Builder(200,200,1).create());
                page.getCanvas().drawText("Original layout fixture",10,40,new android.graphics.Paint());document.finishPage(page);document.writeTo(output);
            }finally{document.close();}
            cacheScope=new File(getTargetContext().getCacheDir(),"preview-cache-check-"+java.util.UUID.randomUUID());
            File realCache=new File(cacheScope,"real"),aliasCache=new File(cacheScope,"alias");if(!realCache.mkdirs())throw new AssertionError("cache alias fixture");
            java.nio.file.Files.createSymbolicLink(aliasCache.toPath(),realCache.getCanonicalFile().toPath());
            File safeCache=OfficeLayoutPreview.cacheDirectory(aliasCache);
            check(safeCache.getParentFile().equals(realCache.getCanonicalFile()),"trusted cache ancestor alias is canonicalized before confinement check");
            java.nio.file.Files.delete(safeCache.toPath());java.nio.file.Files.createSymbolicLink(new File(realCache,"office-layout-v1").toPath(),cacheScope.getCanonicalFile().toPath());
            boolean rejectedCache=false;try{OfficeLayoutPreview.cacheDirectory(aliasCache);}catch(IOException expected){rejectedCache=true;}
            check(rejectedCache,"managed cache child itself cannot be a symlink");
            org.json.JSONObject docSelection=new org.json.JSONObject("{kind:docx,selectedText:Title,locator:{page:1,paragraphStart:0,paragraphEnd:0,startOffset:0,endOffset:5,quote:Title}}");
            org.json.JSONObject cellSelection=new org.json.JSONObject("{kind:xlsx,selectedText:'',locator:{sheetName:Sheet1,row:0,col:0,cellRange:A1,currentValue:''}}");
            for(org.json.JSONObject valid:new org.json.JSONObject[]{docSelection,cellSelection,new org.json.JSONObject("{kind:pptx,selectedText:Title,locator:{slide:1,shape:0,currentValue:Title}}"),new org.json.JSONObject("{kind:markdown,selectedText:Title,locator:{startLine:1,endLine:1,startOffset:0,endOffset:5,quote:Title}}")}){
                check(WorkspacePreviewActivity.checkedSelection(valid,valid.getString("kind")).has("selectedText"),"controlled original-format selection accepted");
            }
            org.json.JSONObject injected=new org.json.JSONObject(docSelection.toString()).put("path","/outside");
            check(!WorkspacePreviewActivity.checkedSelection(injected,"docx").has("path"),"JS file paths never become trusted edit metadata");
            org.json.JSONObject badLocator=new org.json.JSONObject(docSelection.toString());badLocator.getJSONObject("locator").put("path","/outside");
            org.json.JSONObject badRow=new org.json.JSONObject(cellSelection.toString());badRow.getJSONObject("locator").put("row",-1);
            for(org.json.JSONObject invalid:new org.json.JSONObject[]{badLocator,badRow,new org.json.JSONObject(docSelection.toString()).put("kind","xlsx"),new org.json.JSONObject(docSelection.toString()).put("selectedText",""),new org.json.JSONObject(docSelection.toString()).put("selectedText",new String(new char[16001]).replace('\0','x'))}){
                boolean refused=false;try{WorkspacePreviewActivity.checkedSelection(invalid,invalid==badRow?"xlsx":"docx");}catch(Exception expected){refused=true;}
                check(refused,"invalid stale or oversized selection rejected");
            }
            OfficeLayoutPreview preview=new OfficeLayoutPreview(recreated,fixture);
            String sourceHash=OfficeLayoutPreview.sha256(fixture),rendererHash=preview.rendererHash();long modified=fixture.lastModified(),size=fixture.length();
            preview.writeCache(workspace,fixture,renderedFixture,sourceHash,rendererHash,modified,size);cacheFixture=preview.cacheRecord();
            check(renderedFixture.equals(preview.readCache(workspace,fixture,sourceHash,rendererHash,modified,size)),"verified PDF cache reused for exact source and renderer");
            check(preview.readCache(workspace,fixture,"different-content",rendererHash,modified,size)==null,"changed source SHA rejects cached layout");
            check(preview.readCache(workspace,fixture,sourceHash,"different-renderer",modified,size)==null,"changed renderer rejects cached layout");
            check(preview.readCache(workspace,fixture,sourceHash,rendererHash,modified+1,size)==null,"source modification stamp rejects stale layout");
            org.json.JSONArray names=new org.json.JSONArray().put("总览 <一>");
            org.json.JSONObject sheetReport=new org.json.JSONObject().put("pageCount",1).put("spreadsheetMode","single-page-visible-sheets").put("visibleSheets",names);
            check(OfficeLayoutPreview.reportSheets(new File("fixture.xlsx"),sheetReport,1).getString(0).equals("总览 <一>"),"validated Excel names map one visible sheet per final page");
            check(OfficeLayoutPreview.reportSheets(new File("fixture.docx"),sheetReport,1)==null,"Word never carries worksheet metadata");
            String sheetUrl=DesktopDocumentPreview.readerUrl(renderedFixture,names);
            check(new org.json.JSONArray(android.net.Uri.parse(sheetUrl).getQueryParameter("sheetNames")).getString(0).equals("总览 <一>"),"sheet names pass as encoded JSON without HTML interpolation");
            boolean refused=false;try{OfficeLayoutPreview.reportSheets(new File("fixture.xlsx"),sheetReport,2);}catch(IOException expected){refused=true;}
            check(refused,"worksheet report count must match actual PDF pages");
            for(org.json.JSONArray invalid:new org.json.JSONArray[]{new org.json.JSONArray().put(""),new org.json.JSONArray().put(42),new org.json.JSONArray().put("line\nname"),new org.json.JSONArray().put(new String(new char[201]).replace('\0','x'))}){
                refused=false;try{OfficeLayoutPreview.checkedSheetNames(invalid,1);}catch(IOException expected){refused=true;}check(refused,"invalid worksheet name rejected");
            }
            org.json.JSONArray tooMany=new org.json.JSONArray();for(int i=0;i<301;i++)tooMany.put("Sheet "+i);
            refused=false;try{OfficeLayoutPreview.checkedSheetNames(tooMany,301);}catch(IOException expected){refused=true;}
            check(refused,"worksheet metadata bounded to 300 names");
            org.json.JSONObject damagedRecord=new org.json.JSONObject(new String(java.nio.file.Files.readAllBytes(cacheFixture.toPath()),"UTF-8")).put("pageCount",2);
            java.nio.file.Files.write(cacheFixture.toPath(),damagedRecord.toString().getBytes("UTF-8"));
            check(preview.readCache(workspace,fixture,sourceHash,rendererHash,modified,size)==null,"cache page count mismatch rejected");
            preview.writeCache(workspace,fixture,renderedFixture,sourceHash,rendererHash,modified,size);
            final File original=fixture,pdfFixture=renderedFixture;
            runOnMainSync(()->{
                recreated.showOfficeOriginal(pdfFixture);
                check(recreated.originalLayout&&recreated.source.equals(original)&&recreated.pageTitle.getText().toString().equals(original.getName())&&recreated.desktopDocument.displayedSource().equals(pdfFixture),"same activity displays PDF while source title and export identity remain original");
                recreated.showOfficeContent();
                check(!recreated.originalLayout&&((recreated.desktopDocument!=null&&recreated.desktopDocument.displayedSource().equals(original))||(recreated.rich!=null&&recreated.rich.source.equals(original))),"content switch restores original source reader");
                recreated.showOfficeStatus("preparing","fixture final rendering in progress",true);
                check(recreated.desktopDocument==null&&recreated.rich==null&&recreated.officePhase.equals("preparing"),"final preparation never displays a lightweight reader");
                recreated.showOfficeStatus("failed","fixture renderer failure",false);
                check(recreated.desktopDocument==null&&recreated.rich==null&&recreated.officePhase.equals("failed")&&recreated.officeStateText.getText().toString().contains("renderer failure"),"failed final rendering remains explicit without lightweight fallback");
            });
            check(sourceHash.equals(OfficeLayoutPreview.sha256(fixture)),"layout switching never changes original file bytes");
            try(FileOutputStream output=new FileOutputStream(renderedFixture)){output.write("corrupt cache".getBytes("UTF-8"));}
            check(preview.readCache(workspace,fixture,sourceHash,rendererHash,modified,size)==null,"tampered cached PDF rejected");
            preview.destroy();
            result.putString("stream", "PASS preview chrome " + checks + " checks\n");
        } catch (Throwable error) { result.putString("stream", "FAIL preview chrome " + error + "\n"); }
        finally {
            if (monitor != null) removeMonitor(monitor);
            if (activity != null) { final WorkspacePreviewActivity current = activity; runOnMainSync(current::finish); waitForIdleSync(); }
            if(cacheFixture!=null){new android.util.AtomicFile(cacheFixture).delete();}
            if(cacheScope!=null)try{java.nio.file.Files.walkFileTree(cacheScope.toPath(),new java.nio.file.SimpleFileVisitor<java.nio.file.Path>(){public java.nio.file.FileVisitResult visitFile(java.nio.file.Path file,java.nio.file.attribute.BasicFileAttributes attrs)throws IOException{java.nio.file.Files.delete(file);return java.nio.file.FileVisitResult.CONTINUE;}public java.nio.file.FileVisitResult postVisitDirectory(java.nio.file.Path directory,IOException error)throws IOException{java.nio.file.Files.delete(directory);return java.nio.file.FileVisitResult.CONTINUE;}});}catch(Exception error){result.putString("stream","FAIL cache fixture cleanup\n");}
            if(renderedFixture!=null){File folder=renderedFixture.getParentFile();if(renderedFixture.exists()&&!renderedFixture.delete())result.putString("stream","FAIL PDF fixture cleanup\n");if(folder.exists()&&!folder.delete())result.putString("stream","FAIL PDF directory cleanup\n");}
            if (fixture != null && fixture.exists() && !fixture.delete()) result.putString("stream", "FAIL preview chrome fixture cleanup\n");
        }
        finish(result.getString("stream", "").startsWith("PASS") ? -1 : 0, result);
    }
}
