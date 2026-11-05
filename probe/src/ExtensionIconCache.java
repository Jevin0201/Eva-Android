package ai.eva.android.probe;

import android.content.Context;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;

/** Persistent public extension artwork. Never uses the model transport or its credentials. */
public final class ExtensionIconCache {
    static final int MAX_IMAGE_BYTES = 1024 * 1024;
    static final int MAX_SVG_BYTES = 512 * 1024;
    static final long MAX_STORE_BYTES = 32L * 1024 * 1024;
    private static final int MAGIC = 0x45564931;
    private static final int MAX_REDIRECTS = 3;
    private static final ConcurrentHashMap<String, CompletableFuture<Image>> IN_FLIGHT = new ConcurrentHashMap<>();
    private static final Object COMMIT_LOCK = new Object();
    private static final java.util.Set<String> INITIALIZED_ROOTS = new java.util.HashSet<>();

    private ExtensionIconCache() {}

    public static WebResourceResponse serve(Context context, Uri uri) {
        try {
            if (!"https".equals(uri.getScheme()) || !"eva.invalid".equals(uri.getHost())
                    || !"/extension-icon".equals(uri.getPath())) {
                throw new IOException("Invalid icon endpoint");
            }
            File directory = new File(context.getFilesDir(), "extension-icons");
            Image image = load(directory, uri.getQueryParameter("url"),
                    uri.getQueryParameter("revision"), ExtensionIconCache::download,
                    ExtensionIconCache::validateImage);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "private, max-age=31536000, immutable");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'");
            return new WebResourceResponse(image.mime, null, 200, "OK", headers,
                    new ByteArrayInputStream(image.bytes));
        } catch (Exception error) {
            // URL/query parameters can contain signed tokens. Do not log them or echo exceptions.
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                    Collections.singletonMap("Cache-Control", "no-store"),
                    new ByteArrayInputStream(new byte[0]));
        }
    }

    interface Transport { Image fetch(URL url) throws Exception; }
    interface Validator { void validate(Image image) throws Exception; }

    static final class Image {
        final String mime;
        final byte[] bytes;
        Image(String mime, byte[] bytes) {
            this.mime = mime;
            this.bytes = bytes;
        }
    }

    /** Injection points keep network/cache fixtures independent of Android graphics and a real server. */
    static Image load(File directory, String address, String revision,
                      Transport transport, Validator validator) throws Exception {
        URL url = checkedUrl(address);
        String version = revision == null ? "" : revision;
        if (version.length() > 512) throw new IOException("Icon revision too long");
        File root = directory.getCanonicalFile();
        if (!root.isDirectory() && !root.mkdirs()) throw new IOException("Icon storage unavailable");
        removeInterruptedWrites(root);
        String key = hex(digest((url.toExternalForm() + "\n" + version).getBytes(StandardCharsets.UTF_8)));
        File file = new File(root, key + ".icon");
        Image cached = read(file, validator);
        if (cached != null) return cached;

        String requestKey = root.getPath() + "/" + key;
        CompletableFuture<Image> own = new CompletableFuture<>();
        CompletableFuture<Image> pending = IN_FLIGHT.putIfAbsent(requestKey, own);
        if (pending != null) return pending.get();
        try {
            cached = read(file, validator);
            if (cached != null) {
                own.complete(cached);
                return cached;
            }
            Image fetched = transport.fetch(url);
            validateEnvelope(fetched);
            validator.validate(fetched);
            write(root, file, fetched);
            own.complete(fetched);
            return fetched;
        } catch (Exception error) {
            own.completeExceptionally(error);
            throw error;
        } finally {
            IN_FLIGHT.remove(requestKey, own);
        }
    }

    private static void removeInterruptedWrites(File directory) throws IOException {
        synchronized (COMMIT_LOCK) {
            if (INITIALIZED_ROOTS.contains(directory.getPath())) return;
            File[] partials = directory.listFiles(file -> file.getName().startsWith("icon-")
                    && file.getName().endsWith(".part"));
            if (partials == null) throw new IOException("Icon storage unavailable");
            for (File file : partials) {
                if (!file.delete()) throw new IOException("Interrupted icon cleanup failed");
            }
            INITIALIZED_ROOTS.add(directory.getPath());
        }
    }

    private static URL checkedUrl(String address) throws Exception {
        if (address == null || address.length() > 8192) throw new IOException("Invalid icon URL");
        URI uri = new URI(address);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || uri.getRawUserInfo() != null || uri.getRawFragment() != null
                || (uri.getPort() != -1 && uri.getPort() != 443)) {
            throw new IOException("Unsupported icon URL");
        }
        return uri.toURL();
    }

    private static Image download(URL original) throws Exception {
        URL current = original;
        for (int redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
            HttpURLConnection connection = (HttpURLConnection) current.openConnection();
            connection.setConnectTimeout(6000);
            connection.setReadTimeout(6000);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/x-icon");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cookie", "");
            connection.setRequestProperty("Authorization", "");
            try {
                int status = connection.getResponseCode();
                if (status == 301 || status == 302 || status == 303 || status == 307 || status == 308) {
                    if (redirect == MAX_REDIRECTS) throw new IOException("Icon redirect limit");
                    String location = connection.getHeaderField("Location");
                    if (location == null) throw new IOException("Missing icon redirect");
                    current = checkedUrl(current.toURI().resolve(location).toString());
                    continue;
                }
                if (status != 200) throw new IOException("Icon response unavailable");
                String type = connection.getContentType();
                String mime = normalizeMime(type);
                long declared = connection.getContentLengthLong();
                if (declared > MAX_IMAGE_BYTES) throw new IOException("Icon size limit");
                try (InputStream stream = connection.getInputStream()) {
                    Image image = new Image(mime, boundedRead(stream, MAX_IMAGE_BYTES,
                            System.nanoTime() + java.util.concurrent.TimeUnit.SECONDS.toNanos(20)));
                    validateEnvelope(image);
                    return image;
                }
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Icon redirect limit");
    }

    static byte[] boundedRead(InputStream stream, int maximum) throws IOException {
        return boundedRead(stream, maximum, Long.MAX_VALUE);
    }

    private static byte[] boundedRead(InputStream stream, int maximum, long deadline) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = stream.read(buffer)) != -1) {
            if (System.nanoTime() > deadline) throw new IOException("Icon read timeout");
            if (count > maximum - output.size()) throw new IOException("Icon size limit");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }

    static String normalizeMime(String contentType) throws IOException {
        String type = contentType == null ? "" : contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        if ("image/jpg".equals(type)) type = "image/jpeg";
        if ("image/vnd.microsoft.icon".equals(type)) type = "image/x-icon";
        if (!Arrays.asList("image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "image/x-icon").contains(type)) {
            throw new IOException("Unsupported icon MIME");
        }
        return type;
    }

    private static void validateEnvelope(Image image) throws IOException {
        if (image == null || image.bytes == null || image.bytes.length == 0
                || image.bytes.length > MAX_IMAGE_BYTES) throw new IOException("Invalid icon size");
        normalizeMime(image.mime);
        if ("image/svg+xml".equals(image.mime) && image.bytes.length > MAX_SVG_BYTES) {
            throw new IOException("SVG size limit");
        }
    }

    private static void validateImage(Image image) throws Exception {
        if ("image/svg+xml".equals(image.mime)) {
            validateSvg(image.bytes);
            return;
        }
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(image.bytes, 0, image.bytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outWidth > 8192 || bounds.outHeight > 8192
                || bounds.outMimeType == null || !normalizeMime(bounds.outMimeType).equals(image.mime)) {
            throw new IOException("Invalid icon image");
        }
    }

    static void validateSvg(byte[] bytes) throws Exception {
        String text = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(java.nio.charset.CodingErrorAction.REPORT)
                .onUnmappableCharacter(java.nio.charset.CodingErrorAction.REPORT)
                .decode(java.nio.ByteBuffer.wrap(bytes)).toString();
        if (text.indexOf(0) >= 0) throw new IOException("SVG encoding unsupported");
        String upper = text.toUpperCase(Locale.ROOT);
        if (upper.contains("<!DOCTYPE") || upper.contains("<!ENTITY")) throw new IOException("SVG declarations forbidden");
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setExpandEntityReferences(false);
        javax.xml.parsers.DocumentBuilder builder = factory.newDocumentBuilder();
        builder.setEntityResolver((publicId, systemId) -> { throw new org.xml.sax.SAXException("External SVG resource forbidden"); });
        builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
            @Override public void error(org.xml.sax.SAXParseException error) throws org.xml.sax.SAXException { throw error; }
            @Override public void fatalError(org.xml.sax.SAXParseException error) throws org.xml.sax.SAXException { throw error; }
        });
        Document document = builder.parse(new ByteArrayInputStream(bytes));
        if (!"svg".equals(document.getDocumentElement().getLocalName())
                || !"http://www.w3.org/2000/svg".equals(document.getDocumentElement().getNamespaceURI())) {
            throw new IOException("Invalid SVG root");
        }
    }

    private static Image read(File file, Validator validator) {
        if (!file.isFile() || file.length() > MAX_IMAGE_BYTES + 256L) return null;
        try (DataInputStream input = new DataInputStream(new FileInputStream(file))) {
            if (input.readInt() != MAGIC) return null;
            String mime = input.readUTF();
            int length = input.readInt();
            if (length <= 0 || length > MAX_IMAGE_BYTES) return null;
            byte[] expected = new byte[32];
            input.readFully(expected);
            byte[] bytes = new byte[length];
            input.readFully(bytes);
            if (input.read() != -1 || !MessageDigest.isEqual(expected, digest(bytes))) return null;
            Image image = new Image(mime, bytes);
            validateEnvelope(image);
            validator.validate(image);
            file.setLastModified(System.currentTimeMillis());
            return image;
        } catch (Exception error) {
            return null;
        }
    }

    private static void write(File directory, File destination, Image image) throws Exception {
        File temporary = File.createTempFile("icon-", ".part", directory);
        try {
            try (FileOutputStream stream = new FileOutputStream(temporary);
                 DataOutputStream output = new DataOutputStream(stream)) {
                output.writeInt(MAGIC);
                output.writeUTF(image.mime);
                output.writeInt(image.bytes.length);
                output.write(digest(image.bytes));
                output.write(image.bytes);
                output.flush();
                stream.getFD().sync();
            }
            synchronized (COMMIT_LOCK) {
                prune(directory, temporary.length(), destination);
                try {
                    Files.move(temporary.toPath(), destination.toPath(),
                            StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException error) {
                    // Same-directory rename is atomic on Android's app-private filesystem.
                    if (!temporary.renameTo(destination)) throw new IOException("Icon commit failed");
                }
            }
        } finally {
            Files.deleteIfExists(temporary.toPath());
        }
    }

    private static void prune(File directory, long incoming, File destination) throws IOException {
        File[] files = directory.listFiles(file -> file.isFile() && file.getName().matches("[0-9a-f]{64}\\.icon"));
        if (files == null) throw new IOException("Icon storage unavailable");
        long total = incoming;
        for (File file : files) if (!file.equals(destination)) total += file.length();
        Arrays.sort(files, java.util.Comparator.comparingLong(File::lastModified));
        for (File file : files) {
            if (total <= MAX_STORE_BYTES) break;
            if (!file.equals(destination)) {
                long size = file.length();
                if (file.delete()) total -= size;
            }
        }
        if (total > MAX_STORE_BYTES) throw new IOException("Icon storage full");
    }

    private static byte[] digest(byte[] bytes) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(bytes);
    }

    private static String hex(byte[] bytes) {
        StringBuilder text = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) text.append(String.format(Locale.ROOT, "%02x", value & 255));
        return text.toString();
    }
}
