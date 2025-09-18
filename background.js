let websocket = null;
let currentRecording = null;
let connectionInterval = null;
let isConnecting = false; // 接続中フラグを追加

function connectWebSocket() {
    // 既に接続済みまたは接続中なら何もしない
    if ((websocket && websocket.readyState === WebSocket.OPEN) || isConnecting) {
        return;
    }

    isConnecting = true;
    console.log('Trying WebSocket connection...');
    websocket = new WebSocket('ws://localhost:8799');
    
    websocket.onopen = () => {
        console.log('WebSocket connected!');
        isConnecting = false;
        // 接続成功したら定期試行を停止
        if (connectionInterval) {
            clearInterval(connectionInterval);
            connectionInterval = null;
        }
    };
    
    websocket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        console.log('Received command:', msg);
        
        if (msg.type === 'start-recording') {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                startRecording(tabs[0]);
            }
        } else if (msg.type === 'stop-recording') {
            stopRecording();
        }
    };
    
    websocket.onclose = () => {
        console.log('WebSocket disconnected');
        websocket = null;
        isConnecting = false;
        // 切断されたら再接続ループを開始（重複チェックあり）
        startConnectionLoop();
    };
    
    websocket.onerror = (error) => {
        console.log('WebSocket connection failed');
        websocket = null;
        isConnecting = false;
        // エラー時は再接続ループを開始しない（oncloseで処理される）
    };
}

function startConnectionLoop() {
    // 既にループが動いていたら重複防止
    if (connectionInterval) {
        return;
    }
    
    console.log('Starting connection loop');
    connectionInterval = setInterval(() => {
        connectWebSocket();
    }, 10000);
}

function initializeExtension() {
    console.log('Extension initialized');
    connectWebSocket();
    startConnectionLoop();
}

// 以下の録画機能とイベントリスナーは変更なし
async function startRecording(tab) {
  if (currentRecording) {
    console.log("Recording already in progress");
    return;
  }

  const existingContexts = await chrome.runtime.getContexts({});
  const offscreenDocument = existingContexts.find(
    (c) => c.contextType === 'OFFSCREEN_DOCUMENT'
  );

  if (!offscreenDocument) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording from chrome.tabCapture API',
    });
  }

  try {
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });

    currentRecording = tab.id;
    chrome.runtime.sendMessage({
      type: 'start-recording',
      target: 'offscreen',
      data: streamId
    });
  } catch (error) {
    console.error("Failed to start recording:", error);
  }
}

function stopRecording() {
  if (currentRecording) {
    chrome.runtime.sendMessage({
      type: 'stop-recording',
      target: 'offscreen'
    });
    currentRecording = null;
  }
}

chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "start-button") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      startRecording(tabs[0]);
    });
  } else if (msg.type === "stop-button") {
    stopRecording();
  }
});