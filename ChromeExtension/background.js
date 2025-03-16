// state tracking variable
// visible to all scripts in background
// 0 : idle
// 1 : checkCondition
// 2 : gather selection
// 3 : confirm selection
// 4 : export
// 5 : organize
// 6 : import
// 7 : finish
var currentState = 0;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // state request message from popup.js
    if (message.action === "requestCurrentState"){
        sendResponse({state: currentState});
    }
    // start 
    else if (currentState === 0 && message.action === "start") {
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
    if (currentState === 1 && message.action === "startConditionResult"){
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
    else if (currentState === 2 && message.action === "selectedInvoicesResult"){
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
                        // expected answer: exportSequenceResult   
                        startExportSequence();
                    } else {
                        // selection denied
                        // to state idle w/o additional message
                        currentState = 0;
                        chrome.runtime.sendMessage({
                            action: "popup_nomsg",
                            state: currentState
                        });
                    }
                });
        } else {
            // zero invoices selected 2wq2
            currentState = 0;
            chrome.runtime.sendMessage({
                action: "popup_alert",
                message: "Please select at least 1 invoice to continue",
                state: currentState
            });
        }
    }
    // listen to "exportSequenceResult"
    else if (currentState === 4 && message.action === "exportSequenceResult") {
        // make generator = list of txt content
        function* makeInvoiceContentList(namesList) {
            let iterationCount = 0;
            for (const invoiceName of namesList) {
                iterationCount++;
                yield new JSON.parse(
                    window.sessionStorage.getItem(invoiceName)
                );
            }
            return iterationCount;
        }
        let exportedList = new Array(JSON.parse(
            window.sessionStorage.getItem("selectedInvoices")
        ));
        let txtContentList = makeInvoiceContentList(exportedList);
        // current state = 5: Organize
        currentState = 5;

        // process(list of txt content) -> [missing_html, surplus_html, (sessionStorage)]
        let [missing_html, surplus_html, name2txtContentMap] = OrganizeInvoices(txtContentList);
        // save returned content to session storage
        window.sessionStorage.setItem('missing_html', missing_html);
        window.sessionStorage.setItem('surplus_html', surplus_html);
        window.sessionStorage.setItem('organizedInvoices',
            JSON.stringify(Array.from(name2txtContentMap.keys()))
        );
        for (const name of name2txtContentMap.keys()){
            let invoice = JSON.parse(
                window.sessionStorage.getItem(name)
            );
            invoice.importedContent = name2txtContentMap.getItem(name);
            window.sessionStorage.setItem(name,
                JSON.stringify(invoice)
            );
        }
        // next state = confirm import
        chrome.runtime.sendMessage(
            {
                action: "popup_confirm",
                message: 'Would you also like to update your system?',
                state: currentState
            }, (response) => {
                if (response.confirmResult){
                    // current state = 6: import
                    currentState = 6;
                    // start sequantial import                    
                    // expected answer: importSequenceResult  
                    startImportSequence(); 
                } else {
                    // import dismissed
                    currentState = 7;
                    saveAndOpenHtml("missing.html", missing_html);
                    saveAndOpenHtml("surplus.html", surplus_html);

                    // back to idle state
                    currentState = 0;
                    chrome.runtime.sendMessage({
                        action: "popup_nomsg",
                        state: currentState
                    });
                }
            }
        );
    }
    
    // listen to importSequenceResult
    else if (currentState === 6 && message.action === "importSequenceResult") {
        if (success) {
            currentState = 7; // finish
            let missing_html = window.sessionStorage.getItem('missing_html');
            let surplus_html = window.sessionStorage.getItem('surplus_html');
            saveAndOpenHtml("missing.html", missing_html);
            saveAndOpenHtml("surplus.html", surplus_html);

            // back to idle state
            currentState = 0;
            chrome.runtime.sendMessage({
                action: "popup_nomsg",
                state: currentState
            });
        }
    }
    
    // unhandled message
    else {
        console.log(`Unexpected Message(background.js/runtime/${currentState}): ${message}`);
    }
});

// document.write() deprecated
// function openMissingAndSurplus(missing_html, surplus_html){
//     for (const _html of [missing_html, surplus_html]) {
//         let newTab = window.open();
//         newTab.document.open();
//         newTab.document.write(htmlContent);
//         newTab.document.close();
//     }
//     window.open(`data:text/html,${missing_html}`, '_blank');
//     window.open(`data:text/html,${surplus_html}`, '_blank');
// }

function saveAndOpenHtml(htmlName, htmlContent) {
    let blob = new Blob([htmlContent], { type: "text/html" });
    let blobUrl = URL.createObjectURL(blob);

    chrome.downloads.download({
        url: blobUrl,
        filename: htmlName,
        saveAs: false
    }, () => {
        setTimeout(() => { window.open(blobUrl, "_blank"); }, 500);
    });
}

