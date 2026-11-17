package ai.eva.android.probe;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;

/** Queries the official balance endpoint with the selected provider's stored credential. */
final class DeepSeekBalance {
    static final String ENDPOINT = "https://api.deepseek.com/user/balance";

    static boolean supports(String address) {
        try {
            URI uri = new URI(address);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "api.deepseek.com".equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception invalid) {
            return false;
        }
    }

    static JSONObject project(JSONObject source) throws Exception {
        JSONObject result = new JSONObject();
        if (source.opt("is_available") instanceof Boolean)
            result.put("is_available", source.getBoolean("is_available"));
        JSONArray balances = new JSONArray();
        JSONArray rows = source.optJSONArray("balance_infos");
        if (rows == null) throw new IOException("服务未返回 DeepSeek 余额");
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            if (row == null) continue;
            String currency = row.optString("currency");
            if (!"USD".equals(currency) && !"CNY".equals(currency)) continue;
            JSONObject balance = new JSONObject().put("currency", currency);
            for (String field : new String[]{"total_balance", "granted_balance", "topped_up_balance"}) {
                String amount = row.optString(field);
                if (amount.matches("-?[0-9]{1,24}(\\.[0-9]{1,12})?")) balance.put(field, amount);
            }
            if (balance.has("total_balance")) balances.put(balance);
        }
        return result.put("balance_infos", balances);
    }

    static JSONObject read(Context context, String id, String revision) throws Exception {
        ModelStore store = new ModelStore(context);
        JSONObject provider = store.provider(id);
        if (!supports(provider.optString("url")) || !revision.equals(ModelStore.connectionRevision(provider)))
            throw new IOException("DeepSeek 连接已变更，请刷新余额");
        HttpURLConnection connection = (HttpURLConnection) new URL(ENDPOINT).openConnection();
        try {
            return project(ModelClient.exchange(connection, store.secret(provider), null, new ModelClient.Job(), 5000, 7000));
        } finally {
            connection.disconnect();
        }
    }
}
