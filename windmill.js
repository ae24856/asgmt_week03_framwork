// windmill.js (你的框架核心)
const net = require("node:net");
const url = require('url');
const fs = require('fs');
const path = require('path');

function createApp() {
  const app = {
    _routes: { GET: {}, POST: {} }, // 建議的路由存儲結構
    _staticConfig: null,
    _defaultNotFoundPage: fs.readFileSync(path.resolve(__dirname, 'public', 'notFound.html'), 'utf-8'),
    _notFoundHandler: (req, res) => {
      // 預設 404 handler 回傳這個頁面
      res.status(404).send(app._defaultNotFoundPage);
    },
       _errorHandler: (err, req, res) => {
      console.error("💥 Global Error:", err);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>500 Internal Server Error</h1>');
    },
    get(path, handler) {
      this._routes.GET[path] = handler;
    },
    post(path, handler) {
      this._routes.POST[path] = handler;
    },
    _staticDir: null,
    static(dir) {
      // 轉成絕對路徑，避免安全漏洞
      this._staticDir = path.resolve(dir);
    },
    notFound(handler) {
      // 讓外面可以用 app.notFound() 來自訂 404 頁面
      this._notFoundHandler = handler;
    },
    onError(handler) {
      this._errorHandler = handler;
    },
  };

  const server = net.createServer((socket) => {
    console.log("🔌 有客戶端連線！");
    let requestData = '';

    socket.on("data", (chunk) => { 
      requestData += chunk.toString();
      let contentLength = 0;

      if (!requestData) return;

      console.log("📄 完整接收到數據:\n", requestData);
      // 第一次接收時先嘗試解析 headers，取得 Content-Length

      if (!contentLength) {
        const [headerPart] = requestData.split('\r\n\r\n');
        if (headerPart) {
          const headerLines = headerPart.split('\r\n');
          const [requestLine, ...rawHeaderLines] = headerLines;
          const headers = {};
          for (const line of rawHeaderLines) {
            const [key, value] = line.split(': ');
            headers[key.toLowerCase()] = value;
          }
          if (headers['content-length']) {
            contentLength = parseInt(headers['content-length'], 10);
          }
        }
      }

      // 判斷 body 是否完整接收
      const headerEndIndex = requestData.indexOf('\r\n\r\n') + 4;
      const body = requestData.slice(headerEndIndex);
      if (body.length < contentLength) {
        // 尚未收完body，繼續等待
        return;
      }

      // === 1. 解析 HTTP 請求 ===
      const [headerPart, bodyPart] = requestData.split('\r\n\r\n'); 
      // 把 headerPart 每一行換行 \r\n 拆成陣列
      const headerLines = headerPart.split('\r\n');
      // 陣列解構，把第一行當 requestLine，剩下全部是 rawHeaderLines
      const [requestLine, ...rawHeaderLines] = headerLines;  // requestLine: GET / HTTP/1.1
      const [method, urlStr] = requestLine.split(' ');

      // 將原始的 HTTP 標頭字串轉換為易於操作的 obj
      const headers = {};
      for (const line of rawHeaderLines) {
        const [key, value] = line.split(': ');
        headers[key.toLowerCase()] = value;
      }
      // 預設為 undefined？ 改成是字串
      let reqBody = bodyPart || '';
      // 若是 JSON，嘗試解析
      if (method === 'POST' && headers['content-type']?.includes('application/json')) {
        try {
          reqBody = JSON.parse(reqBody);
        } catch (err) {
          reqBody = null; // 解析失敗也不崩潰
        }
      }

      // === 2. 建立 request 物件 ===
      const parsedUrl = url.parse(urlStr, true);
      // 分解成一個物件，true 的作用是將 URL 中的查詢字串（即 ? 後面的部分）解析為一個物件
      // console.log(parsedUrl);
      // Url {
      //   protocol: null,
      //   slashes: null,
      //   auth: null,
      //   host: null,
      //   port: null,
      //   hostname: null,
      //   hash: null,
      //   search: '?id=123',
      //   query: [Object: null prototype] { id: '123' },
      //   pathname: '/api/user',
      //   path: '/api/user?id=123',
      //   href: '/api/user?id=123'
      // }
      const req = {
        method,
        url: urlStr,
        path: parsedUrl.pathname,
        query: parsedUrl.query,
        headers,
        body: reqBody,
      };
      console.log("方法:", method);
      console.log("URL:", urlStr);
      console.log("path:", parsedUrl.pathname);
      console.log("query:", parsedUrl.query);
      console.log("headers:", headers);
      console.log("body:", bodyPart);

      // === 3. 建立 response 物件（封裝回應邏輯） ===
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) {
          this.headers[name] = value; //res.setHeader('Content-Type', 'text/html');
        },
        writeHead(statusCode, headers) {
          this.statusCode = statusCode;
          this.headers = { ...this.headers, ...headers }; 
        },
        // res.writeHead(200, {
        //   'Content-Type': 'application/json',
        //   'X-Custom-Header': 'value'
        // });
        end(content = '') {
          // 狀態碼對照表
          const statusMsgs = {
            200: 'OK',
            302: 'Redirect',
            404: 'Not Found',
            500: 'Internal Server Error',
          };
          const statusMsg = statusMsgs[this.statusCode] || '';
          const responseLine = `HTTP/1.1 ${this.statusCode} ${statusMsg}\r\n`;

          // 把所有 headers 組成文字
          const headersText = Object.entries(this.headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\r\n');

          // 先寫 response line + headers + 空行
          socket.write(`${responseLine}${headersText}\r\n\r\n`);

          if (Buffer.isBuffer(content)) {
            socket.write(content); // 直接寫二進位 Buffer
          } else {
            socket.write(content); // 字串直接寫
          }

          // 把 HTTP 回應 原始字串寫進 socket 傳給客戶端瀏覽器
          // 完整寫出：status line + headers + 空行 + body
          // socket.write(`${responseLine}${headersText}\r\n\r\n${content}`);

          // 關閉連線
          socket.end(() => {
            console.log("🔌 客戶端連線已關閉。");
          });
        },
        send(body) {
          if (typeof body === 'string') {
            if (!this.headers['Content-Type']) {
              this.setHeader('Content-Type', 'text/html; charset=utf-8');
            }
            this.end(body);
          } else if (typeof body === 'object') {
            if (!this.headers['Content-Type']) {
              this.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            this.end(JSON.stringify(body));
          } else {
            this.end(String(body));
          }
        },
        status(code) {
          this.statusCode = code;
          return this; // 可以連續調用同一個物件上的其他方法
        },
        json(data) {
          this.setHeader('Content-Type', 'application/json; charset=utf-8');
          this.send(data);  // 直接送物件，send 裡會幫你 stringify
        },
        redirect(location, statusCode = 302) {
          this.statusCode = statusCode;
          this.setHeader('Location', location);
          this.end();
        },
        write(chunk) {
          // chunk 可以是 Buffer 或字串
          socket.write(chunk);
        }
      };

      // === 4. 路由查找與執行 ===
      // 從 app._routes（api 註冊的 GET/POST 路由）中找對應的 handler
      const routeHandler = app._routes[method]?.[parsedUrl.pathname];
      try {
        if (routeHandler) {
          routeHandler(req, res);
        } else if (app._tryStatic(req, res)) {
          // 靜態檔案成功處理
        } else {
          app._notFoundHandler(req, res);
        }
      } catch (err) {
        app._errorHandler(err, req, res);
      }
    });

    socket.on("error", (err) => {
      console.error("❌ Socket 錯誤:", err);
      // 也許需要調用 app._errorHandler
    });

  });

  app._tryStatic = function (req, res) { // 沒有設定靜態目錄就直接跳過，不處理
    if (!app._staticDir) return false;
  
    let reqPath = decodeURIComponent(req.path); // 根目錄 /，就預設回傳 index.html
    if (reqPath === '/') {
      reqPath = '/index.html';
    }
    const targetPath = path.join(app._staticDir, reqPath);
    const resolved = path.resolve(targetPath);  
    // path.join() 是字串合併，不會解析 ..、.
    // path.resolve() 會回傳「絕對路徑且標準化」結果，解析 ..、.
  
    if (!resolved.startsWith(app._staticDir)) {
      return false;
    }
  
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      const mime = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.json': 'application/json',
      }[ext] || 'application/octet-stream';
  
      // 處理圖片 ?
      const chunks = [];
      const stream = fs.createReadStream(resolved);
  
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
  
      stream.on('end', () => {
        // 合併所有 Buffer
        const buffer = Buffer.concat(chunks);
        // console.log('圖片 buffer 長度:', buffer.length);
        res.writeHead(200, { 'Content-Type': mime });  // 這裡設定標頭
        // 直接用 buffer 結束回應，不用編碼
        res.end(buffer);
      });
      stream.on('error', (err) => {
        app._errorHandler(err, req, res);
      });
      return true;
    }
    return false;
  };
  
  app.listen = (port, callback) => {
    server.listen(port, callback);
  };

  return app;
}

module.exports = createApp;