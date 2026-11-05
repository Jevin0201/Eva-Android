package ai.eva.android.probe;

import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/** Hosts the desktop Notebook renderer with access to one workspace file. */
final class DesktopNotebookPreview {
    private static final int MAX_BYTES = 16 * 1024 * 1024;
    private static final String ORIGIN = "eva-preview.invalid";
    private static final Set<String> ASSETS = new HashSet<>(Arrays.asList(
        "/desktop-notebook.html", "/desktop-notebook.js",
        "/desktop-notebook-bundle.js", "/eva-markdown.js"
    ));
    private final WorkspacePreviewActivity host;
    private final File source;
    private final TextView status;
    private WebView web;
    private volatile boolean destroyed;
    private volatile int viewport;

    DesktopNotebookPreview(WorkspacePreviewActivity host, File source, Bundle state) {
        this.host = host;
        this.source = source;
        viewport = state == null ? 0 : Math.max(0, Math.min(10000000, state.getInt("notebook-scroll", 0)));
        host.clear();
        status = host.label("正在准备 Notebook 预览…", 12);
        host.body.addView(status);
        web = new WebView(host);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setDomStorageEnabled(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        web.addJavascriptInterface(new Reader(), "PreviewHost");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && ORIGIN.equals(uri.getHost())
                        && uri.getPort() == -1 && ASSETS.contains(uri.getPath())) {
                    String path = uri.getPath();
                    try {
                        return new WebResourceResponse(path.endsWith(".js") ? "text/javascript" : "text/html",
                            "UTF-8", host.getAssets().open(path.substring(1)));
                    } catch (Exception ignored) { }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
                    java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!destroyed) {
                    status.setText("Notebook · 单元格与已保存的输出");
                }
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                host.body.removeView(view);
                view.removeJavascriptInterface("PreviewHost");
                view.destroy();
                web = null;
                status.setText("预览进程已退出，请返回后重试。");
                return true;
            }
        });
        host.body.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        web.loadUrl("https://" + ORIGIN + "/desktop-notebook.html");
    }

    private final class Reader {
        @JavascriptInterface public void saveViewport(int top) {
            if (!destroyed && top >= 0 && top <= 10000000) viewport = top;
        }

        @JavascriptInterface public String readNotebook() {
            try {
                if (destroyed) throw new java.io.IOException("预览已关闭");
                File checked = source.getCanonicalFile();
                Path root = WorkspaceFiles.root(host).toPath();
                if (!checked.toPath().startsWith(root) || !checked.equals(source)
                        || !checked.isFile()) throw new java.io.IOException("文件不在工作区内或已移动");
                if (checked.length() > MAX_BYTES) throw new java.io.IOException("Notebook 超过 16 MiB 预览上限");
                byte[] bytes;
                try (ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(checked, ParcelFileDescriptor.MODE_READ_ONLY)) {
                    // Check the opened descriptor as well as the path. The agent
                    // can rename files or replace directory links concurrently.
                    File opened = new File(android.system.Os.readlink("/proc/self/fd/" + descriptor.getFd())).getCanonicalFile();
                    if (!opened.toPath().startsWith(root) || !opened.equals(checked)) {
                        throw new java.io.IOException("文件位置已变化，请重新打开预览");
                    }
                    try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(descriptor)) {
                        bytes = DocumentPreview.bounded(input, MAX_BYTES);
                    }
                }
                return new JSONObject().put("ok", true).put("text", DocumentPreview.utf8(bytes))
                    .put("viewport", viewport).toString();
            } catch (Exception error) {
                try { return new JSONObject().put("ok", false).put("error", error.getMessage()).toString(); }
                catch (Exception ignored) { return "{\"ok\":false,\"error\":\"文件读取失败\"}"; }
            }
        }
    }

    void save(Bundle state) {
        state.putInt("notebook-scroll", viewport);
    }

    void destroy() {
        destroyed = true;
        if (web != null) {
            web.stopLoading();
            web.removeJavascriptInterface("PreviewHost");
            host.body.removeView(web);
            web.destroy();
            web = null;
        }
    }
}
