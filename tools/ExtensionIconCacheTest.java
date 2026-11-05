package ai.eva.android.probe;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

/** Host fixtures use a deterministic transport, leaving Android bitmap decoding to device QA. */
public final class ExtensionIconCacheTest {
    private static int checks;
    private static final String URL = "https://icons.example.test/logo.svg?asset=one&sig=private";
    private static final byte[] SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\"><path d=\"M0 0h24v24z\"/></svg>".getBytes(StandardCharsets.UTF_8);
    private static final ExtensionIconCache.Validator SVG_VALIDATOR = image -> {
        if (!"image/svg+xml".equals(image.mime)) throw new java.io.IOException("Wrong test MIME");
        ExtensionIconCache.validateSvg(image.bytes);
    };

    private static void require(boolean condition, String name) {
        checks++;
        if (!condition) throw new AssertionError(name);
    }

    private interface Action { void run() throws Exception; }
    private static void rejected(Action action, String name) throws Exception {
        boolean failed = false;
        try { action.run(); } catch (Exception expected) { failed = true; }
        require(failed, name);
    }

    public static void main(String[] args) throws Exception {
        File root = Files.createTempDirectory("eva-icon-fixtures-").toFile();
        try {
            run(root);
            System.out.println("PASS ExtensionIconCache " + checks + " checks");
        } finally {
            try (java.util.stream.Stream<Path> paths = Files.walk(root.toPath())) {
                paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> {
                    try { Files.delete(path); } catch (java.io.IOException error) { throw new java.io.UncheckedIOException(error); }
                });
            }
        }
    }

    static void run(File root) throws Exception {
        AtomicInteger requests = new AtomicInteger();
        ExtensionIconCache.Transport online = url -> {
            requests.incrementAndGet();
            return new ExtensionIconCache.Image("image/svg+xml", SVG);
        };
        ExtensionIconCache.Transport offline = url -> { throw new java.io.IOException("Offline"); };
        File cache = new File(root, "icons");
        require(cache.mkdirs(), "fixture icon directory");
        File interrupted = new File(cache, "icon-interrupted.part");
        Files.write(interrupted.toPath(), new byte[]{1, 2, 3});
        require(ExtensionIconCache.load(cache, URL, "1", online, SVG_VALIDATOR).bytes.length == SVG.length, "first fetch");
        require(requests.get() == 1, "one network fetch");
        require(!interrupted.exists(), "restart cleans interrupted atomic write");
        ExtensionIconCache.load(cache, URL, "1", online, SVG_VALIDATOR);
        require(requests.get() == 1, "cache hit performs zero transport calls");
        ExtensionIconCache.load(new File(root.getCanonicalFile(), "icons"), URL, "1", offline, SVG_VALIDATOR);
        require(requests.get() == 1, "new reader survives restart and offline");
        ExtensionIconCache.load(cache, URL, "2", online, SVG_VALIDATOR);
        require(requests.get() == 2, "new revision has distinct identity");
        ExtensionIconCache.load(cache, URL + "2", "1", online, SVG_VALIDATOR);
        require(requests.get() == 3, "query identity retained");
        rejected(() -> ExtensionIconCache.load(cache, URL, "3", offline, SVG_VALIDATOR), "offline new revision is visible failure");
        ExtensionIconCache.load(cache, URL, "1", offline, SVG_VALIDATOR);
        require(cache.listFiles((dir, name) -> name.endsWith(".icon")).length == 3, "failure preserves older valid cache");

        ExecutorService workers = Executors.newFixedThreadPool(8);
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger concurrent = new AtomicInteger();
        ExtensionIconCache.Transport delayed = url -> {
            concurrent.incrementAndGet();
            started.countDown();
            if (!release.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new AssertionError("Fixture release timeout");
            return new ExtensionIconCache.Image("image/svg+xml", SVG);
        };
        try {
            List<Future<ExtensionIconCache.Image>> futures = new ArrayList<>();
            for (int index = 0; index < 8; index++) {
                futures.add(workers.submit(() -> ExtensionIconCache.load(cache, URL, "concurrent", delayed, SVG_VALIDATOR)));
            }
            require(started.await(5, java.util.concurrent.TimeUnit.SECONDS), "concurrent fetch started");
            release.countDown();
            for (Future<ExtensionIconCache.Image> future : futures) require(future.get().bytes.length == SVG.length, "all waiters receive image");
            require(concurrent.get() == 1, "concurrent requests share transport");
        } finally {
            release.countDown();
            workers.shutdownNow();
        }

        int before = cache.listFiles((dir, name) -> name.endsWith(".icon")).length;
        rejected(() -> ExtensionIconCache.load(cache, URL, "html", url -> new ExtensionIconCache.Image("text/html", SVG), SVG_VALIDATOR), "HTML MIME rejected");
        rejected(() -> ExtensionIconCache.load(cache, URL, "fake", url -> new ExtensionIconCache.Image("image/svg+xml", "<html/>".getBytes(StandardCharsets.UTF_8)), SVG_VALIDATOR), "fake image body rejected");
        rejected(() -> ExtensionIconCache.load(cache, URL, "empty", url -> new ExtensionIconCache.Image("image/png", new byte[0]), SVG_VALIDATOR), "empty body rejected");
        rejected(() -> ExtensionIconCache.load(cache, URL, "large", url -> new ExtensionIconCache.Image("image/png", new byte[ExtensionIconCache.MAX_IMAGE_BYTES + 1]), SVG_VALIDATOR), "large transport body rejected");
        require(cache.listFiles((dir, name) -> name.endsWith(".icon")).length == before, "bad responses never committed");
        require(cache.listFiles((dir, name) -> name.endsWith(".part")).length == 0, "atomic writes leave no partial files");
        rejected(() -> ExtensionIconCache.load(cache, "http://icons.example.test/logo.svg", "1", online, SVG_VALIDATOR), "HTTPS required");
        rejected(() -> ExtensionIconCache.load(cache, "https://user:password@icons.example.test/logo.svg", "1", online, SVG_VALIDATOR), "embedded credentials rejected");
        rejected(() -> ExtensionIconCache.load(cache, "https://icons.example.test:8080/logo.svg", "1", online, SVG_VALIDATOR), "custom port rejected");
        rejected(() -> ExtensionIconCache.load(cache, URL + "#fragment", "1", online, SVG_VALIDATOR), "fragment rejected");
        require("image/svg+xml".equals(ExtensionIconCache.normalizeMime("IMAGE/SVG+XML; charset=UTF-8")), "MIME parameters normalize");
        rejected(() -> ExtensionIconCache.boundedRead(new ByteArrayInputStream(new byte[11]), 10), "stream limit covers unknown content length");
        require(ExtensionIconCache.boundedRead(new ByteArrayInputStream(new byte[10]), 10).length == 10, "exact byte limit accepted");
        rejected(() -> ExtensionIconCache.validateSvg("<!DOCTYPE svg [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><svg xmlns='http://www.w3.org/2000/svg'>&x;</svg>".getBytes(StandardCharsets.UTF_8)), "SVG external entity forbidden");
        rejected(() -> ExtensionIconCache.validateSvg("<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_16)), "SVG alternate encoding rejected");

        rejected(() -> ExtensionIconCache.normalizeMime(null), "missing MIME rejected");
        rejected(() -> ExtensionIconCache.load(cache, URL, "svg-limit",
                url -> new ExtensionIconCache.Image("image/svg+xml", new byte[ExtensionIconCache.MAX_SVG_BYTES + 1]),
                SVG_VALIDATOR), "SVG byte limit applies before parsing");
        AtomicInteger failures = new AtomicInteger();
        ExtensionIconCache.Transport broken = url -> {
            failures.incrementAndGet();
            throw new java.io.IOException("Fixture failure");
        };
        rejected(() -> ExtensionIconCache.load(cache, URL, "retry", broken, SVG_VALIDATOR), "failed attempt propagates");
        ExtensionIconCache.load(cache, URL, "retry", online, SVG_VALIDATOR);
        require(failures.get() == 1, "failed flight removed so next request can recover");

        File budget = new File(root, "budget");
        byte[] payload = new byte[ExtensionIconCache.MAX_IMAGE_BYTES];
        ExtensionIconCache.Transport storageFixture = url -> new ExtensionIconCache.Image("image/png", payload);
        ExtensionIconCache.Validator storageOnly = image -> {};
        for (int index = 0; index < 34; index++) {
            ExtensionIconCache.load(budget, URL, String.valueOf(index), storageFixture, storageOnly);
        }
        long bytes = 0;
        for (File file : budget.listFiles()) bytes += file.length();
        require(bytes <= ExtensionIconCache.MAX_STORE_BYTES, "persistent cache stays within total budget");
        ExtensionIconCache.load(budget, URL, "33", offline, storageOnly);
        require(budget.listFiles().length < 34, "budget evicts older entries while newest stays offline");

        // Tampering cannot turn a persistent cache entry into a successful hit.
        File corrupted = cache.listFiles((dir, name) -> name.endsWith(".icon"))[0];
        Files.write(corrupted.toPath(), new byte[]{0, 1, 2});
        // A fresh directory containing this corrupt entry must still fetch its exact key again.
        File repair = new File(root, "repair");
        ExtensionIconCache.load(repair, URL, "repair", online, SVG_VALIDATOR);
        File damaged = repair.listFiles((dir, name) -> name.endsWith(".icon"))[0];
        byte[] valid = Files.readAllBytes(damaged.toPath());
        valid[valid.length - 2] ^= 1;
        Files.write(damaged.toPath(), valid);
        int prior = requests.get();
        ExtensionIconCache.load(repair, URL, "repair", online, SVG_VALIDATOR);
        require(requests.get() == prior + 1, "digest mismatch refetches instead of serving corrupted body");
    }
}
