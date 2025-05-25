const net = require("node:net");
const createApp = require('./windmill'); // 假設你的框架叫做 windmill.js
const app = createApp();

app.get('/', (req, res) => {
  console.log("進到首頁路由");
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send('<h1>歡迎來到 Windmill.js 打造的首頁!</h1>');
});

app.get('/about', (req, res) => {
  res.send('<h1>這是關於我們頁面</h1>');
});

app.post('/submit-data', (req, res) => {
  // req.body 中應該要有解析後的 POST 數據 (進階)
  // 簡化版：先讓 POST 請求能被正確路由到這裡即可
  console.log("收到 POST 請求的 body:", req.body);
  res.send('表單已提交 (POST)');
});

app.get('/error', (req, res) => {
  throw new Error('故意丟錯誤測試');
});

app.get('/api/user', (req, res) => {
  console.log("進入 /api/user 路由，req.query=", req.query);
  const userId = req.query.id; // 假設 URL 是 /api/user?id=123
  if (userId === '123') {
    res.json({ id: userId, name: '實習生小明', message: '成功使用 req.query 和 res.json!' });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/echo', (req, res) => {
  // 假設已實現 req.body 解析 (例如 JSON)
  // 如果是 Content-Type: application/json 的請求
  // req.body 應該是解析後的 JavaScript 物件
  res.json({ received: req.body, message: 'Data echoed!' });
});

app.static('public');

app.notFound((req, res) => {
  res.status(404).send('<h1>:( 自訂的 404 頁面 - 資源不存在</h1>');
});

app.onError((err, req, res) => {
  console.error("噢不，發生了錯誤:", err.message);
  res.status(500).send(`<h1>伺服器內部錯誤: ${err.message}</h1>`);
});

app.listen(3310, () => {
  console.log('🚀 Windmill.js 伺服器運行在 http://localhost:3310');
});