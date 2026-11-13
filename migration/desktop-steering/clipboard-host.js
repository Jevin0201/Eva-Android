// Android host binding for the original message-copy control. The control owns
// its busy state/checkmark; only a successful native write returns true.
async function writeAndroidMessageClipboard(payload) {
  const text = typeof payload === 'string' ? payload : payload?.['text/plain'];
  try {
    if (typeof text !== 'string' || text.length === 0) throw Error('没有可复制的文字');
    if (window.EvaHost?.copyText(text) !== true) throw Error('复制失败，请重试');
    return true;
  } catch (error) {
    window.toast?.(error?.message === '没有可复制的文字' ? error.message : '复制失败，请重试');
    return false;
  }
}
