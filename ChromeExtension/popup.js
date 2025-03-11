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
    if (message.action === 'done') {
        // all process finished.
        alert("Process finished successfully.");
        startButton.disabled = false;
    }
    else if  (message.action === 'popup_alert') {
        alert(message.message);
        if (message.state === 0) {startButton.disabled = false;}
    }
    else if (message.action === 'popup_confirm') {
        sendResponse({confirmResult: confirm(message.message)});
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
})



// document.getElementById("start").addEventListener("click", () => {
//     if (checkURLStartsWith("url-common") && checkElementHREfStartsWith("elementId", "href-common")) {
        
//         // using chrome.scripting.executeScript 
//         chrome.scripting.executeScript({
//             target: { allFrames: true },
//             func: gatherInvoiceSelection
//         }, (gatherResults) => {
//             if (gatherResults && gatherResults[0].result.length === 0) {
//                 alert("No invoices selected. Please select at least one invoice.");
//             } else {
//                 let selectedInvoices = gatherResults[0].result;
//                 chrome.scripting.executeScript({
//                     target: { allFrames: true },
//                     func: confirmAndProcessInvoiceSelection,
//                     args: [selectedInvoices]
//                 }, (confirmResults) => {
//                     if (confirmResults && confirmResults[0].result) {
//                         // read(or export) selected invoices
//                         // run invoiceOrganizer
//                         // ask if the user wants to update the system
//                         // if yes, update the system
//                         // open missing and surplus in a new tab
//                         // download logs
//                         // close chrome extension popup
                
//                     } else {
//                         alert("Process cancelled.");
//                     }
//                 });
//             }
//         });


//     } else {
//         alert("Please navigate to \"Purchase Order Worksheet\" to start the process.");
//     }
// });

function checkURLStartsWith(pattern) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let currentUrl = tabs[0].url;
        if (currentUrl.startsWith(pattern)) {
            console.log("The URL starts with 'url-common'");
            return true;
        } else {
            console.log("The URL does not start with 'url-common'");
            return false;
        }
    });
}

function checkElementHREfStartsWith(elementId, pattern) {
    let element = document.getElementById(elementId);
    if (element && element.href) {
        return element.href.startsWith(pattern);
    } else {
        console.log("Element not found or does not have an href attribute");
        return false;
    }
}


