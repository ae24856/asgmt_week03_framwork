// 引入 net 模組
const net = require("node:net");
const fs = require("fs");

// 定義伺服器聆聽的 port
const PORT = 3310;

// 建立 TCP 伺服器
const server = net.createServer((socket) => {
  console.log("🔌 有客戶端連線！");

  // 當接收到客戶端數據時觸發
  socket.on("data", (data) => {
    console.log("📄 接收到數據:\n", data.toString());
    // 解析 method 和 URL
    const request = data.toString();
    const requestLine = request.split("\r\n")[0];
    const [method, url] = requestLine.split(" ");
    console.log("📄 方法:", method);
    console.log("📄 URL:", url);

    let httpResponse;

    // 這裡可以根據 method 和 url 進行不同的處理
    if (method === "GET" && url === "/") {
      console.log("📄 處理首頁請求");
      // 構建一個簡單的 HTTP 回應
      // 注意：這是一個非常基礎的回應，實際的 HTTP 伺服器會更複雜
      httpResponse = `HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<head><title>我的簡易網站</title></head>
<body><h1>歡迎來到我的首頁！(net)</h1></body>
</html>`;
    } else if (method === "GET" && url === "/favicon.ico") {
      console.log("📄 處理 favicon 請求");
      // 處理 favicon 請求
      try {
        const image = fs.readFileSync("./image.png");
        httpResponse = `HTTP/1.1 200 OK
Content-Type: image/png
Content-Length: ${image.length}

`;
        // 先發送 header
        socket.write(httpResponse, "binary");
        // 再發送圖片內容
        socket.write(image);
        // 關閉連線
        socket.end(() => {
          console.log("🔌 客戶端連線已關閉。");
        });
        return; // 已經處理完畢，避免後續重複發送
      } catch (err) {
        console.error("❌ 讀取圖片失敗:", err);
        httpResponse = `HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body><h1>404 Not Found</h1></body>
</html>`;
      }
    } else {
      // 回傳 404 Not Found
      console.log("📄 處理 404 錯誤");
      httpResponse = `HTTP/1.1 404 Not Found
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body><h1>404 Not Found</h1></body>
</html>`;
    }

    // 發送 HTTP 回應給客戶端
    socket.write(httpResponse);

    // 關閉連線
    socket.end(() => {
      console.log("🔌 客戶端連線已關閉。");
    });
  });

  // 當連線發生錯誤時觸發
  socket.on("error", (err) => {
    console.error("❌ Socket 錯誤:", err);
  });
});

// 讓伺服器開始聆聽指定的 port
server.listen(PORT, () => {
  console.log(`🚀 伺服器正在聆聽 port ${PORT} (使用 net 模組)`);
  console.log(`👉 請在瀏覽器中開啟 http://localhost:${PORT}`);
});

// 監聽伺服器錯誤事件
server.on("error", (err) => {
  console.error("❌ 伺服器錯誤:", err);
});
