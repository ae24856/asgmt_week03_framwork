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

    // socket.on("data", (chunk) => {
    //   requestData += chunk.toString();
    //   // 思考：如何判斷請求是否完整接收？（提示：HTTP 請求頭中有 Content-Length）
    //   // 簡化處理：本次作業中，你可以假設小請求一次 'data' 事件就能收完。
    //   // 但可以思考一下，如果請求很大，分多次 chunk 過來怎麼辦？
    // });

    //   socket.on("end", () => { // 當客戶端發送完畢時 (例如瀏覽器發送GET請求後，會立即發送FIN)
    //       if (!requestData) return; // 沒有數據則不處理

    //       console.log("📄 完整接收到數據:\n", requestData);
    //       // 在這裡開始解析請求，並調用路由處理等邏輯
    //       // 你需要將 requestData 傳遞給後續的處理器

    //       // 1. 解析請求 (method, url, headers, body) -> 封裝成 req 物件
    //       // 2. 根據 method 和 url 查找路由
    //       // 3. 執行對應的路由處理函數，傳入 req 和 res 物件
    //       // 4. 如果沒有匹配的路由，調用 _notFoundHandler
    //       // 5. 如果處理過程中發生錯誤，調用 _errorHandler

    //       // 初始的 socket.end() 可以在 res.end() 中調用，或者由框架統一處理
    //   });
    socket.on("data", (chunk) => {  //監聽對方關閉連線
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
          return this;
        },
        json(data) {
          this.setHeader('Content-Type', 'application/json; charset=utf-8');
          this.send(data);  // 直接送物件，send裡會幫你 stringify
        }





      };

      // === 4. 路由查找與執行 ===
      // const routeHandler = app._routes[method]?.[urlStr];
      const routeHandler = app._routes[method]?.[parsedUrl.pathname];
      if (routeHandler) {
        routeHandler(req, res);
      } else if (app._tryStatic(req, res)) {
        // 靜態檔案成功處理
      } else {
        app._notFoundHandler(req, res);
      }



    });

    socket.on("error", (err) => {
      console.error("❌ Socket 錯誤:", err);
      // 也許需要調用 app._errorHandler
    });

  });
  const fs = require('fs');
  const path = require('path');

  app._tryStatic = function (req, res) {
    if (!app._staticDir) return false;

    const reqPath = decodeURIComponent(req.path); // 例如 /style.css
    const targetPath = path.join(app._staticDir, reqPath);      // 合併路徑
    const resolved = path.resolve(targetPath);                  // 轉絕對路徑

    // 安全檢查：不能跳出靜態資料夾
    if (!resolved.startsWith(app._staticDir)) {
      return false;
    }

    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved);
      const mime = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
      }[ext] || 'application/octet-stream';

      const stream = fs.createReadStream(resolved);
      res.writeHead(200, { 'Content-Type': mime });

      let fileData = '';
      stream.on('data', chunk => {
        fileData += chunk;
      });
      stream.on('end', () => {
        res.end(fileData);
      });
      stream.on('error', err => {
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