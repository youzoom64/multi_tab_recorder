let currentRecording = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "start-button") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      startRecording(tabs[0]);
    });
  } else if (msg.type === "stop-button") {
    stopRecording();
  }
});

async function startRecording(tab) {
  // 既存の録画をチェック
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