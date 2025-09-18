let currentRecorder = null;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== 'offscreen') return;
  
  if (message.type === 'start-recording') {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: message.data } },
        video: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: message.data } }
      });

      currentRecorder = new MediaRecorder(media);
      let chunks = [];
      
      currentRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      currentRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        currentRecorder = null;
      };
      
      currentRecorder.start();
      console.log("Recording started");
      
    } catch (error) {
      console.error("Recording error:", error.name, error.message);
    }
  } else if (message.type === 'stop-recording') {
    if (currentRecorder && currentRecorder.state === 'recording') {
      currentRecorder.stop();
      console.log("Recording stopped");
    }
  }
});