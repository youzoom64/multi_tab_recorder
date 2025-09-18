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
            // 最後に操作されたChromeウィンドウの最後のタブを取得
            const windows = await chrome.windows.getAll({populate: true, windowTypes: ['normal']});
            const lastWindow = windows.sort((a, b) => b.id - a.id)[0]; // 最後のウィンドウ
            const lastTab = lastWindow.tabs[lastWindow.tabs.length - 1]; // そのウィンドウの最後のタブ
            
            console.log(`Recording tab: ${lastTab.url} (Tab ID: ${lastTab.id})`);
            
            const result = await startRecording(lastTab);
            websocket.send(JSON.stringify({
                type: 'response',
                command: 'start-recording',
                success: result,
                message: result ? `Recording started on ${lastTab.url}` : 'Failed to start recording'
            }));
        } else if (msg.type === 'stop-recording') {
            const result = stopRecording();
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

// 他の関数は変更なし
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
    return false;
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
    return true;
  } catch (error) {
    console.error("Failed to start recording:", error);
    return false;
  }
}

function stopRecording() {
  if (currentRecording) {
    chrome.runtime.sendMessage({
      type: 'stop-recording',
      target: 'offscreen'
    });
    currentRecording = null;
    return true;
  }
  return false;
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