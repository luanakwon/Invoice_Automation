// state tracker
// 0 : idle
// 1 : checkCondition
// 2 : gather selection

var currentState = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // state request message from popup.js
    if (message.action === "requestCurrentState"){
        sendResponse({state: currentState});
    }
    // start 
    else if (message.action === "start" && currentState === 0) {
        // clear up the session storage
        window.sessionStorage.clear();
        // next state = 1 : checkCondition
        currentState = 1;
        // start the sequence by checking conditions
        // expected answer: startConditionResult
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: "checkStartCondition"}, ()=>{});
        })
    }
    
    // listen to "startConditionResult"
    if (message.action === "startConditionResult"){
        if (message.success){
            // next state = 2 : gatherSelection
            currentState = 2;
            // send message to gather selection
            // expected answer: selectedInvoiceResult
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: "gatherSelectedInvoices" }, ()=>{});
            });
        } else {
            // start condition faild. alert.
            currentState = 0;
            chrome.runtime.sendMessage({
                action: "popup_alert",
                message: "Please navigate to \"Purchase Order Worksheet\" to start the process.",
                state: currentState
            });
        }
    }

    // listen to "selectedInvoicesResult"
    else if (message.action === "selectedInvoicesResult"){
        let n_selection = message.selectedInvoices_size;
        if (n_selection > 0){
            currentState = 3; // confirmSelection
            // confirm selection
            chrome.runtime.sendMessage(
                {
                    action: "popup_confirm",
                    message: `${n_selection} invoices selected. Would you like to proceed?`,
                    state: currentState
                }, (response) => {
                    if (response.confirmResult){
                        currentState = 4; // export
                        // start sequential export
                        // expected answer: exportInvoicesResult   
                        startExportSequence();
                    } else {
                        // selection denied
                        currentState = 0
                        chrome.runtime.sendMessage({
                            action: "popup_alert",
                            message: "Please select at least 1 invoice to continue",
                            state: currentState
                        });
                    }
                })
        } else {
            alert("Please select at least 1 invoice to continue");
            startButton.diabled = false;
        }
    }
    // listen to "exportInvoicesResult"
    // TODO
    // process -> [missing_html, surplus_html, (sessionStorage)]
    // next state = confirm import


    // listen to "processInvoicesResult"
    else if (message.action === "processInvoicesResult"){
        let n_processed = message.processInvoices_size;
        if (n_processed > 0) {
            // confirm import
            if (window.confirm('Would you also like to update your system?')){
                // send message to import invoices
                // expected answer: importInvoicesResult
            } else {
                // import dismissed
                // send message to open missing + surplus

                startButton.disabled = false;
            }
        } else {
            // Nothing changed. All invoices up to date.
            alert("Nothing changed. All invoices up to date.");
            startButton.disabled = false;
        }
    }
    
    // listen to "importInvoicesResult"
    else if (message.action === "importInvoicesResult"){
        if (message.success) {
            // send message to open missing + surplus

            startButton.disabled = false;
        } else {
            // import fail? why?
            console.log("import failed");
            startButton.disabled = false;
        }
    }

})