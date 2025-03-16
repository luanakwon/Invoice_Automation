// popup.js is supposed to handel User Interactions
var startButton = document.getElementById("start");

// get current state from background.js
chrome.runtime.sendMessage({action:"requestCurrentState"}, (response)=>{
    if (response && response.state > 0) {
        startButton.disabled = false;
    } else {
        startButton.disabled = true;
    }
});

// click the button to start the process
startButton.addEventListener("click", ()=>{
    // disable button
    startButton.disabled = true;
    // send start to background.js
    chrome.runtime.sendMessage({action:"start"});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if  (message.action === 'popup_alert') {
        alert(message.message);
        if (message.state === 0) {startButton.disabled = false;}
    }
    else if (message.action === 'popup_confirm') {
        sendResponse({confirmResult: confirm(message.message)});
    }
    else if (message.action === 'popup_nomsg') {
        if (message.state === 0) {startButton.disabled = false;}
    }
    // unhandled message
    else {
        console.log(`Unexpected Message(popup.js/runtime/-): ${message}`);
    }
});



