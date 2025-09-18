document.getElementById("start").onclick = () => {
  chrome.runtime.sendMessage({ type: "start-button" });
};

document.getElementById("stop").onclick = () => {
  chrome.runtime.sendMessage({ type: "stop-button" });
};