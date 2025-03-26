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

importScripts("exporter.js", "importer.js", "invoiceOrganizer.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // state request message from popup.js
    if (message.action === "requestCurrentState"){
        sendResponse({state: currentState});
    }
    // start 
    else if (currentState === 0 && message.action === "start") {
        console.log("message 'start' caught from background runtime");
        // clear up the session storage
        chrome.storage.session.clear();
        // next state = 1 : checkCondition
        currentState = 1;
        // start the sequence by checking conditions
        // expected answer: startConditionResult
        console.log("sending message (background->tab[0]) checkstartcondition");
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {           
            try {
                chrome.tabs.sendMessage(tabs[0].id, {action: "checkStartCondition"}, ()=>{
                    if (chrome.runtime.lastError) {
                        if (chrome.runtime.lastError.message.startsWith("Could not establish connection")){
                            console.log("no connection");
                            currentState = 0;
                            requestUIPopUP('alert',
                                "Please navigate to \"Purchase Order Worksheet\" to start the process."
                            );
                            setStartButtonActive(true);
                        }
                    }
                });
            } catch ({name, message}) {
                if (name === 'TypeError') {
                    console.log("no accessible tab");
                    currentState = 0;
                    requestUIPopUP('alert',
                        "Please navigate to \"Purchase Order Worksheet\" to start the process."
                    );
                    setStartButtonActive(true);
                }
            }
        });
    }
    
    // listen to "startConditionResult"
    else if (currentState === 1 && message.action === "startConditionResult"){
        console.log("caught startCondition Result from background runtime listener");
        if (message.success){
            console.log("next state = 2 : gatherSelection");
            currentState = 2;
            console.log("send message to gather selection");
            // expected answer: selectedInvoiceResult
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: "gatherSelectedInvoices" }, ()=>{});
            });
        } else {
            console.log(message);
            // start condition faild. alert.
            currentState = 0;
            requestUIPopUP('alert',
                "Please navigate to \"Purchase Order Worksheet\" to start the process."
            );
            setStartButtonActive(true);
        }
    }

    // listen to "selectedInvoicesResult"
    else if (currentState === 2 && message.action === "selectedInvoicesResult"){
        console.log(message);
        let selectedInvoiceMap = new Map(Object.entries(message.result));
        let selectedInvoiceList = Array.from(selectedInvoiceMap.keys());
        let n_selection = selectedInvoiceList.length;

        if (n_selection > 0){
            currentState = 3; // confirmSelection
            // confirm selection
            requestUIPopUP('confirm',
                `${n_selection} invoices selected. Would you like to proceed?`
            ).then((confirmResult)=>{
                if (confirmResult) {
                    // save list
                    console.log("saving selectedInvoiceList");
                    console.log(selectedInvoiceList);
                    console.log()
                    chrome.storage.session.set(
                        {selectedInvoices:JSON.stringify(selectedInvoiceList)}
                    ).then(()=>{
                        // save each item
                        console.log("saving each item from selectedInvoiceMap");
                        return Promise.all([
                            selectedInvoiceList.map(name=>
                                chrome.storage.session.set(
                                    Object.fromEntries(
                                        [[name,JSON.stringify(selectedInvoiceMap.get(name))]]
                                    )
                                )
                            )
                        ]);
                    }).then(()=>{
                        currentState = 4; // export
                        // start sequential export
                        // expected answer: exportSequenceResult   
                        Exporter.startExportSequence();
                    });
                } else {
                    currentState = 0;
                    setStartButtonActive(true);
                }
            });
        } else {
            // zero invoices selected 
            currentState = 0;
            requestUIPopUP('alert',
                "Please select at least 1 invoice to continue"
            );
            setStartButtonActive(true);
        }
    }
    // unhandled message
    else {
        console.log(`Unexpected Message(background.js/runtime/${currentState}): ${message.action}`);
    }
});

async function loadAndOrganizeExportedResult(){
    if (currentState != 4) {
        console.log("loadAndOrganizeExportedResult called in wrong state "+currentState);
        return;
    }
    console.log("load the export result from chrome session");
    let exportedList;
    await chrome.storage.session.get("selectedInvoices").then((result)=>{
        // exportedList = new Array(JSON.parse(result["selectedInvoices"]));
        exportedList = JSON.parse(result["selectedInvoices"]);
        console.log(exportedList);
    });

    let txtContentList = [];
    for (const invoiceName of exportedList){
        await chrome.storage.session.get(invoiceName).then((result)=>{
            txtContentList.push(
                JSON.parse(result[invoiceName]).exportedContent
            );
        });
    }
    // current state = 5: Organize
    currentState = 5;
    
    let [
        missing_html, 
        surplus_html, 
        name2txtContentMap
        ] = InvoiceOrganizer.organizeInvoices(txtContentList);
    // save returned content to session storage
    await chrome.storage.session.set({missing_html});
    await chrome.storage.session.set({surplus_html});
    await chrome.storage.session.set(
        {organizedInvoices:JSON.stringify(Array.from(name2txtContentMap.keys()))}
    );

    for (const name of name2txtContentMap.keys()){
        let invoice;
        await chrome.storage.session.get(name).then((result)=>{
            invoice = JSON.parse(result[name]);
        });
        invoice.importedContent = name2txtContentMap.get(name);
        await chrome.storage.session.set(
            Object.fromEntries([[name, JSON.stringify(invoice)]]));
    }
    // next state = confirm import
    
    requestUIPopUP('confirm',
        'Would you also like to update your system?'
    ).then((confirmResult)=>{
        if (confirmResult) {
            currentState = 6; // Set state to import
            Importer.startImportSequence();
        } else {
            openResultsAndFinishProcess();
        }
    });    
}

function openResultsAndFinishProcess(){
    currentState = 7; // finish
            
    chrome.tabs.create({url:chrome.runtime.getURL("missing.html")});
    chrome.tabs.create({url:chrome.runtime.getURL("surplus.html")});
    
    // back to idle state
    currentState = 0;
    setStartButtonActive(true);
}

function requestUIPopUP(type, message){
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (type, message) => {
                    if (type === 'alert'){
                        alert(message);
                    } 
                    else if (type === 'confirm') {
                        return confirm(message);
                    } else {
                        console.log(`No such PopUp type (type=${type}).`);
                    }
                    return;
                },
                args: [type, message]
            }).then(results => {
                if (type === 'confirm') {
                    resolve(results[0].result);
                }
                else {
                    resolve();
                }
            }).catch((err) => reject(err));
        });
    });
}
function setStartButtonActive(flag){
    // send message to popup.js to set the start button
    // when popup.html is inactive, the message will be lost
    // in that case, popup.html will update itself when activated
    chrome.runtime.sendMessage({
        action: 'popup_setButton',
        setActive: flag
    })
}
