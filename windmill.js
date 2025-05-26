// windmill.js (你的框架核心)
const net = require("node:net");
const url = require('url');
const fs = require('fs');
const path = require('path');

function createApp() {
  const app = {
    _routes: { GET: {}, POST: {} }, // 建議的路由存儲結構
    _staticConfig: null,
    _notFoundHandler: (req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1>');
    },
    // 讓外面可以用 app.notFound() 來自訂 404 頁面
    notFound(handler) {
      this._notFoundHandler = handler;
    },
    _errorHandler: (err, req, res) => {
      console.error("💥 Global Error:", err);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>500 Internal Server Error</h1>');
    },
    get(path, handler) {
      app._routes.GET[path] = handler;
    },
    post(path, handler) {
      app._routes.POST[path] = handler;
    },
    _staticDir: null,
    static(dir) {
      // 轉成絕對路徑，避免安全漏洞
      app._staticDir = path.resolve(dir);
    },
    notFound(handler) {
      this._notFoundHandler = handler;
    },
    onError(handler) {
      this._errorHandler = handler;
    },
    // ... 其他框架內部屬性和方法

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
      // 先分 headers & body
      const [headerPart, bodyPart] = requestData.split('\r\n\r\n');
      // 把 headerPart 每一行換行 \r\n 拆成陣列
      const headerLines = headerPart.split('\r\n');
      // 陣列解構，把第一行當 requestLine，剩下全部當成 rawHeaderLines
      const [requestLine, ...rawHeaderLines] = headerLines;
      const [method, urlStr] = requestLine.split(' ');

      const headers = {};
      for (const line of rawHeaderLines) {
        const [key, value] = line.split(': ');
        headers[key.toLowerCase()] = value;
      }

      // 預設 req.body 就是字串
      let reqBody = bodyPart || '';

      // 如果是 JSON，嘗試解析
      if (method === 'POST' && headers['content-type']?.includes('application/json')) {
        try {
          reqBody = JSON.parse(reqBody);
        } catch (err) {
          reqBody = null; // 解析失敗也不崩潰
        }
      }

      // === 2. 建立 request 物件 ===
      const parsedUrl = url.parse(urlStr, true);
      const req = {
        method,
        url: urlStr,
        path: parsedUrl.pathname,
        query: parsedUrl.query,
        headers,
        body: reqBody,
      };
      console.log("📄 方法:", method);
      console.log("📄 URL:", urlStr);
      console.log("📄 headers:", headers);
      console.log("📄 body:", bodyPart);

      // === 3. 建立 response 物件（封裝回應邏輯） ===
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) {
          this.headers[name] = value;
        },
        writeHead(statusCode, headers) {
          this.statusCode = statusCode;
          this.headers = { ...this.headers, ...headers };
        },
        end(content = '') {
          // 狀態碼對照表
          const statusMsgs = {
            200: 'OK',
            404: 'Not Found',
            500: 'Internal Server Error',
          };
          const statusMsg = statusMsgs[this.statusCode] || '';
          const responseLine = `HTTP/1.1 ${this.statusCode} ${statusMsg}\r\n`;

          // 把所有 headers 組成文字
          const headersText = Object.entries(this.headers)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\r\n');

          // 完整寫出：status line + headers + 空行 + body
          socket.write(`${responseLine}${headersText}\r\n\r\n${content}`);

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
          this.send(data);  // 直接送物件，send裡會幫你 stringify
        }
      };

      // === 4. 路由查找與執行 ===
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

  app._tryStatic = function (req, res) {
    if (!app._staticDir) return false;
  
    const reqPath = decodeURIComponent(req.path);
    const targetPath = path.join(app._staticDir, reqPath);
    const resolved = path.resolve(targetPath);
  
    if (!resolved.startsWith(app._staticDir)) {
      return false;
    }
  
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      const mime = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
      }[ext] || 'application/octet-stream';
  
      res.writeHead(200, { 'Content-Type': mime });
  
      const chunks = [];
      const stream = fs.createReadStream(resolved);
  
      stream.on('data', (chunk) => {
        chunks.push(chunk);
      });
  
      stream.on('end', () => {
        // 合併所有 Buffer
        const buffer = Buffer.concat(chunks);
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

  // 你需要在此處或app物件的方法中實現下面的功能...
  return app;
}

module.exports = createApp;