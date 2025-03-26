// popup.js is supposed to handel User Interactions
var startButton = document.getElementById("start");

// get current state from background.js
chrome.runtime.sendMessage({action:"requestCurrentState"}, (response)=>{
    if (response && response.state > 0) {
        console.log("current state > 0 in popup");
        startButton.disabled = true;
    } else {
        startButton.disabled = false;
        console.log("current state <= 0 in popup");
        console.log(response);
        if (response) console.log(response.state);
    }
});

// click the button to start the process
startButton.addEventListener("click", ()=>{
    // disable button
    startButton.disabled = true;
    // send start to background.js
    console.log("Sending message (popup->runtime) start");
    chrome.runtime.sendMessage({action:"start"});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if  (message.action === 'popup_setButton'){
        startButton.disabled = !message.setActive;
    }
    // unhandled message
    else {
        console.log(`Unexpected Message(popup.js/runtime/-): ${message.action}`);
    }
});
