package vn.moclinh.avenor;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.Manifest;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Avenor cho Android: mở https://avenor.moclinh.vn trong WebView, giữ đăng nhập, cho chọn ảnh. */
public class MainActivity extends Activity {
    private static final String HOME = "https://avenor.moclinh.vn/";
    private static final int PICK_FILE = 1;
    private static final int MIC = 2;
    private PermissionRequest micRequest;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#f7f1ea"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " AvenorAndroid/1.1");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            // API 24+ (không có trong android.jar 23 nên không gắn @Override; vẫn được gọi khi chạy).
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return handle(req.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handle(Uri.parse(url));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) {
                    view.loadData("<html><body style='font-family:sans-serif;background:#f7f1ea;color:#3a2a22;padding:32px'>"
                        + "<h2>Không kết nối được Avenor</h2><p>Kiểm tra mạng rồi kéo xuống hoặc bấm nút dưới để thử lại.</p>"
                        + "<p><a href='" + HOME + "' style='display:inline-block;padding:12px 18px;border-radius:12px;background:#8e3b2c;color:#fff;text-decoration:none'>Thử lại</a></p>"
                        + "</body></html>", "text/html; charset=utf-8", "utf-8");
                }
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            /** Trang Avenor xin micro (ghi ý tưởng): hỏi quyền Android nếu chưa có rồi cấp cho trang. */
            @Override
            public void onPermissionRequest(final PermissionRequest req) {
                String host = req.getOrigin() == null ? "" : String.valueOf(req.getOrigin().getHost());
                boolean audio = false;
                for (String r : req.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) audio = true;
                if (!audio || !host.equals("avenor.moclinh.vn")) { req.deny(); return; }
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    req.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                } else {
                    if (micRequest != null) micRequest.deny();
                    micRequest = req;
                    requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, MIC);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                String type = (types != null && types.length > 0 && types[0] != null && !types[0].isEmpty()) ? types[0] : "*/*";
                if (type.startsWith(".")) type = "*/*";
                i.setType(type);
                try {
                    startActivityForResult(Intent.createChooser(i, "Chọn tệp"), PICK_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(HOME);
    }

    /** Trang Avenor và Strava mở trong app; liên kết khác mở bằng trình duyệt. */
    private boolean handle(Uri uri) {
        String host = uri.getHost() == null ? "" : uri.getHost();
        String scheme = uri.getScheme() == null ? "" : uri.getScheme();
        if (scheme.equals("https") && (host.equals("avenor.moclinh.vn") || host.endsWith("strava.com"))) return false;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) { }
        return true;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK_FILE && fileCallback != null) {
            Uri[] result = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int k = 0; k < n; k++) result[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[] { data.getData() };
                }
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] results) {
        if (req == MIC && micRequest != null) {
            if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) {
                micRequest.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            } else {
                micRequest.deny();
            }
            micRequest = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
