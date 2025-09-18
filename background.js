let websocket = null;
let currentRecording = null;
let connectionInterval = null;
let isConnecting = false;

function connectWebSocket() {
    if ((websocket && websocket.readyState === WebSocket.OPEN) || isConnecting) {
        return;
    }

    isConnecting = true;
    console.log('Trying WebSocket connection...');
    websocket = new WebSocket('ws://127.0.0.1:8799');
    
    websocket.onopen = () => {
        console.log('WebSocket connected!');
        isConnecting = false;
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
                const result = await startRecording(tabs[0]);
                // Python側に結果を送信
                websocket.send(JSON.stringify({
                    type: 'response',
                    command: 'start-recording',
                    success: result,
                    message: result ? 'Recording started' : 'Failed to start recording'
                }));
            }
        } else if (msg.type === 'stop-recording') {
            const result = stopRecording();
            // Python側に結果を送信
            websocket.send(JSON.stringify({
                type: 'response',
                command: 'stop-recording', 
                success: result,
                message: result ? 'Recording stopped' : 'No recording to stop'
            }));
        }
    };
    
    websocket.onclose = () => {
        console.log('WebSocket disconnected');
        websocket = null;
        isConnecting = false;
        startConnectionLoop();
    };
    
    websocket.onerror = (error) => {
        console.log('WebSocket connection failed');
        websocket = null;
        isConnecting = false;
    };
}

function startConnectionLoop() {
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

async function startRecording(tab) {
  if (currentRecording) {
    console.log("Recording already in progress");
    return false; // 失敗を返す
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
    return true; // 成功を返す
  } catch (error) {
    console.error("Failed to start recording:", error);
    return false; // 失敗を返す
  }
}

function stopRecording() {
  if (currentRecording) {
    chrome.runtime.sendMessage({
      type: 'stop-recording',
      target: 'offscreen'
    });
    currentRecording = null;
    return true; // 成功を返す
  }
  return false; // 録画していない場合は失敗を返す
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