// singleton module
const Importer = (()=>{
    let organizedInvoiceList;
    let curIdx;
    let curName;
    let curInvoice;

    function startImportSequence() {
        // add listener
        chrome.runtime.onMessage.addListener(runtimeMessageListener);
        // load list from session storage
        organizedInvoiceList = new Array(
            JSON.parse(
                window.sessionStorage.getItem("organizedInvoice")
            )
        );
        // start from 0
        curIdx = 0;
        curName = organizedInvoiceList[curIdx];
        curInvoice = JSON.parse(
            window.sessionStorage.getItem(curName)
        );
        // start by navigating tab
        chrome.tabs.update({url: curInvoice.link});
    }

    function importNext(){
        curIdx++;
        // exit condition
        if (curIdx >= organizedInvoiceList.length) {
            organizedInvoiceList = null;
            curIdx = null;
            curName = null;
            curInvoice = null;

            chrome.runtime.onMessage.removeListener(runtimeMessageListener);

            chrome.runtime.sendMessage({
                action: "importSequenceResult",
                success: true
            });
        }
        // export next
        else {
            curName = organizedInvoiceList[curIdx];
            curInvoice = JSON.parse(
                window.sessionStorage.getItem(curName)
            );
            chrome.tabs.update({url: curInvoice.link});
        }
    }

    function runtimeMessageListener(message, sender, sendResponse) {
        if (currentState === 6 && message.action === "pageLoaded") {
            if (curInvoice && curInvoice.link === message.url) {
                // expected page loaded
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) =>{
                    chrome.tabs.sendMessage(tabs[0].id,
                        { action: "importOneInvoice", url: message.url, name:curName}, 
                        ()=>{});
                });
            }
        }
        // one import step complete
        else if (currentState === 6 && message.action === "importOneInvoiceResult") {
            if (curInvoice && curInvoice.link === message.url) {
                importNext();
            }
        }
        // unhandled message
        else {
            console.log(`Unexpected Message(importer.js/runtime/${currentState}): ${message}`);
        }
    }

    return {startImportSequence};
})();




