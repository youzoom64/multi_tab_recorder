let currentRecorder = null;

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.target !== 'offscreen') return;
    
    console.log('Offscreen received message:', message);
    
    if (message.type === 'start-recording') {
        try {
            console.log('Starting recording with stream ID:', message.data);
            
            const media = await navigator.mediaDevices.getUserMedia({
                audio: { 
                    mandatory: { 
                        chromeMediaSource: "tab", 
                        chromeMediaSourceId: message.data 
                    } 
                },
                video: { 
                    mandatory: { 
                        chromeMediaSource: "tab", 
                        chromeMediaSourceId: message.data 
                    } 
                }
            });

            currentRecorder = new MediaRecorder(media);
            let chunks = [];
            
            currentRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            
            currentRecorder.onstop = () => {
                console.log('Recording stopped, creating download');
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `recording-${Date.now()}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                currentRecorder = null;
                chunks = [];
            };
            
            currentRecorder.onstart = () => {
                console.log("Recording started successfully");
                // background.jsに成功を通知
                chrome.runtime.sendMessage({
                    type: 'recording-started'
                });
            };
            
            currentRecorder.start();
            
        } catch (error) {
            console.error("Recording error:", error.name, error.message);
            // エラーを background.js に通知
            chrome.runtime.sendMessage({
                type: 'recording-error',
                error: error.message
            });
        }
    } else if (message.type === 'stop-recording') {
        if (currentRecorder && currentRecorder.state === 'recording') {
            console.log("Stopping recording");
            currentRecorder.stop();
        } else {
            console.log("No active recording to stop");
        }
    }
});