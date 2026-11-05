function quotaFailureText(raw){
 const text=String(raw?.message||raw||'');
 if(/usage.?limit|hit your.*limit|insufficient_quota|使用上限|额度/.test(text)){const reset=/try again at ([^.]+(?:AM|PM)?)/i.exec(text)?.[1]?.trim();return '当前账号的使用额度已用完。'+(reset?'可在 '+reset+' 后重试，也可在账户用量设置中查看额度。':'请在账户用量设置中查看恢复时间或可用额度。');}
 if(/rate.?limit|too many requests/i.test(text))return '请求过于频繁，请稍后重试。';return null;
}
