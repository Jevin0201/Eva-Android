'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('probe/assets/models.js', 'utf8');
const declaration = source.split('\n').find(line => line.startsWith('function compactPhoneImages('));
assert(declaration, 'production image-history function exists');
const context = vm.createContext({});
vm.runInContext(declaration, context);
const compact = context.compactPhoneImages;
const image = {type: 'inputImage', imageUrl: 'data:image/png;base64,c2NyZWVu'};
const text = {type: 'inputText', text: '真实工具结果'};
function tool(name) {
 return {id: name, type: 'dynamicToolCall', tool: name, arguments: {action: 'observe'}, contentItems: [{...image}, {...text}]};
}
const names = ['eva_phone', 'eva_phone_steps', 'eva_phone_route', 'eva_wechat', 'eva_browser'];
for (const name of names) {
 const input = tool(name);
 assert.equal(compact(input), input, 'existing event object identity is preserved');
 assert.equal(input.contentItems[0].type, 'inputText');
 assert(input.contentItems[0].text.includes('截图已提供给模型'));
 assert.equal(input.contentItems[0].imageUrl, undefined);
 assert.equal(input.contentItems[1].text, text.text);
 assert.equal(input.arguments.action, 'observe');
 const once = JSON.stringify(input);
 compact(input);
 assert.equal(JSON.stringify(input), once, 'compaction is idempotent');
}
const other = tool('unrelated_image_tool');
const before = JSON.stringify(other);
compact(other);
assert.equal(JSON.stringify(other), before, 'other tools retain images');
const nested = {thread: {turns: [{items: names.map(tool)}]}};
compact(nested);
assert(!JSON.stringify(nested).includes(image.imageUrl), 'nested thread/turns/items history loses screenshot payloads');
assert.equal(nested.thread.turns[0].items.length, names.length);
const event = {turn: {items: [tool('eva_phone_route')]}, item: tool('eva_wechat')};
compact(event);
assert(!JSON.stringify(event).includes(image.imageUrl), 'turn completion and item event shapes are compacted');
const user = {type: 'userMessage', contentItems: [{...image}]};
compact(user);
assert.equal(user.contentItems[0].imageUrl, image.imageUrl, 'user attachments remain intact');
assert.equal(compact(null), null);
assert.equal(compact('text'), 'text');
console.log('PASS production phone/steps/route/WeChat/browser image compaction, nested history, idempotence and unrelated tools/user attachments');
