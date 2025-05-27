const createApp = require('./windmill'); // 假設你的框架叫做 windmill.js
const app = createApp();

app.get('/about', (req, res) => {
  res.redirect('/about.html'); // 302 預設導向
});

app.post('/api', (req, res) => {
  console.log('請求方法:', req.method); // 'POST'
  console.log('請求路徑:', req.path); // '/submit'
  console.log('查詢參數:', req.query); // { id: '123' }
  console.log('請求標頭:', req.headers); // { 'content-type': 'application/json', ... }
  console.log('請求主體:', req.body); // { name: 'Alice', age: 25 }

  res.json({ message: '資料已接收' });
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
  res.json({ received: req.body, message: 'Data echoed!' });
});

app.static('public');

app.get('/error', (req, res) => {
  throw new Error('故意丟錯誤測試');
});

app.onError((err, req, res) => {
  console.error("噢不，發生了錯誤:", err.message);
  res.status(500).send(`<h1>伺服器內部錯誤: ${err.message}</h1>`);
});

app.listen(3310, () => {
  console.log('🚀 Windmill.js 伺服器運行在 http://localhost:3310');
});