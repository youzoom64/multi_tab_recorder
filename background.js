// デバッグ用のログ関数（必ず表示される）
function debugLog(...args) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
    console.error('[LOG]', ...args); // エラーコンソールにも出力
}

let websocket = null;
let currentRecording = null;

function connectWebSocket() {
    debugLog('=== connectWebSocket called ===');
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        debugLog('WebSocket already connected');
        return;
    }

    debugLog('Creating WebSocket connection to ws://127.0.0.1:8799');
    websocket = new WebSocket('ws://127.0.0.1:8799');
    
    websocket.onopen = () => {
        debugLog('✓ WebSocket connected successfully!');
    };
    
    websocket.onmessage = async (event) => {
        debugLog('✓ Message received:', event.data);
        
        try {
            const msg = JSON.parse(event.data);
            debugLog('✓ Parsed message:', msg);
            
            if (msg.type === 'start-recording') {
                debugLog('Processing start-recording command');
                await handleStartRecording();
            } else if (msg.type === 'stop-recording') {
                debugLog('Processing stop-recording command');
                const result = stopRecording();
                sendResponse(result, result ? 'Recording stopped' : 'No recording to stop');
            }
        } catch (error) {
            debugLog('✗ Error processing message:', error.message);
        }
    };
    
    websocket.onclose = () => {
        debugLog('✗ WebSocket disconnected');
        websocket = null;
        setTimeout(() => connectWebSocket(), 3000);
    };
    
    websocket.onerror = (error) => {
        debugLog('✗ WebSocket error:', error);
    };
}

async function handleStartRecording() {
    debugLog('=== handleStartRecording started ===');
    
    try {
        // 全ウィンドウを取得
        const windows = await chrome.windows.getAll({populate: true, windowTypes: ['normal']});
        debugLog(`Found ${windows.length} windows`);
        
        if (windows.length === 0) {
            debugLog('No windows found');
            sendResponse(false, 'No windows available');
            return;
        }
        
        // 全タブを収集
        const allTabs = [];
        for (const window of windows) {
            debugLog(`Window ${window.id}: ${window.tabs.length} tabs`);
            allTabs.push(...window.tabs);
        }
        
        debugLog(`Total tabs found: ${allTabs.length}`);
        
        // 録画可能なタブをフィルタリング
        const validTabs = allTabs.filter(tab => {
            debugLog(`Tab ${tab.id} details:`, {
                id: tab.id,
                url: tab.url,
                title: tab.title,
                status: tab.status,
                active: tab.active,
                windowId: tab.windowId
            });
            
            if (!tab.url || typeof tab.url !== 'string') {
                debugLog(`Tab ${tab.id}: URL is ${tab.url} (type: ${typeof tab.url})`);
                return false;
            }
            
            const isValidUrl = !tab.url.startsWith('chrome://') && 
                              !tab.url.startsWith('chrome-extension://') &&
                              !tab.url.startsWith('edge://') &&
                              !tab.url.startsWith('about:');
            
            debugLog(`Tab ${tab.id}: ${tab.url} - Valid: ${isValidUrl}, LastAccessed: ${tab.lastAccessed}`);
            return isValidUrl;
        });
        
        debugLog(`Found ${validTabs.length} valid tabs`);
        
        if (validTabs.length === 0) {
            debugLog('No valid tabs found');
            sendResponse(false, 'No recordable tabs found. Please open a website.');
            return;
        }
        
        // 最後にアクセスしたタブを選択
        const targetTab = validTabs.sort((a, b) => b.lastAccessed - a.lastAccessed)[0];
        
        debugLog(`Selected tab: ${targetTab.id} - ${targetTab.url} (LastAccessed: ${targetTab.lastAccessed})`);
        
        const result = await startRecording(targetTab);
        debugLog(`Recording result: ${result}`);
        
        sendResponse(result, result ? `Recording started on ${targetTab.url}` : 'Failed to start recording');
        
    } catch (error) {
        debugLog('Error in handleStartRecording:', error.message);
        debugLog('Error stack:', error.stack);
        sendResponse(false, `Error: ${error.message}`);
    }
}

function sendResponse(success, message) {
    debugLog(`Sending response: success=${success}, message=${message}`);
    
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        const response = JSON.stringify({
            type: 'response',
            success: success,
            message: message
        });
        websocket.send(response);
    } else {
        debugLog('WebSocket not available for response');
    }
}

async function startRecording(tab) {
    debugLog(`Starting recording for tab ${tab.id}: ${tab.url}`);
    
    if (currentRecording) {
        debugLog("Recording already in progress");
        return false;
    }

    try {
        // まずタブをアクティブ化
        debugLog('Activating target tab...');
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        
        // 少し待機（タブのアクティブ化を確実にする）
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Offscreen document作成
        const existingContexts = await chrome.runtime.getContexts({});
        const offscreenDocument = existingContexts.find(c => c.contextType === 'OFFSCREEN_DOCUMENT');

        if (!offscreenDocument) {
            debugLog('Creating offscreen document...');
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['USER_MEDIA'],
                justification: 'Recording from chrome.tabCapture API',
            });
        }

        debugLog('Getting media stream ID...');
        const streamId = await chrome.tabCapture.getMediaStreamId({
            targetTabId: tab.id
        });

        debugLog(`Got stream ID: ${streamId}`);
        currentRecording = tab.id;
        
        chrome.runtime.sendMessage({
            type: 'start-recording',
            target: 'offscreen',
            data: streamId
        });
        
        debugLog('Recording initiated successfully');
        return true;
        
    } catch (error) {
        debugLog('Failed to start recording:', error.message);
        currentRecording = null;
        return false;
    }
}

function stopRecording() {
    debugLog('Stopping recording');
    if (currentRecording) {
        chrome.runtime.sendMessage({
            type: 'stop-recording',
            target: 'offscreen'
        });
        currentRecording = null;
        return true;
    }
    debugLog('No recording to stop');
    return false;
}

// 初期化
debugLog('=== Background script loaded ===');
connectWebSocket();

// ポップアップからのメッセージ処理
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    debugLog('Message from popup:', msg.type);
    
    if (msg.type === "start-button") {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const result = await startRecording(tabs[0]);
            sendResponse(result);
        });
        return true;
    } else if (msg.type === "stop-button") {
        const result = stopRecording();
        sendResponse(result);
    }
});