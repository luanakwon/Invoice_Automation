// singleton module
const Exporter = (()=>{
    let selectedInvoiceList;
    let curIdx;
    let curName;
    let curInvoice;

    function startExportSequence() {
        // add runtime message listener
        chrome.runtime.onMessage.addListener(runtimeMessageListener);
        // add download change listener
        chrome.downloads.onChanged.addListener(downloadChangeListener);
        // load invoice from session storage
        selectedInvoiceList = new Array(
            JSON.parse(
                window.sessionStorage.getItem("selectedInvoices")
            )
        );
        // start from 0
        curIdx = 0;
        curName = selectedInvoiceList[curIdx];
        curInvoice = JSON.parse(
            window.sessionStorage.getItem(curName)
        );
        // start by navigating tab
        chrome.tabs.update({url: curInvoice.link});
    }
    
    function exportNext(){
        curIdx++;
        // exit condition
        if (curIdx >= selectedInvoiceList.length) {
            selectedInvoiceList = null;
            curIdx = null;
            curName = null;
            curInvoice = null;
    
            // remove listener
            chrome.runtime.onMessage.removeListener(runtimeMessageListener);
            chrome.downloads.onChanged.removeListener(downloadChangeListener);
    
            chrome.runtime.sendMessage({
                action: "exportSequenceResult",
                success: true
            });
        }
        // export next
        else {
            curName = selectedInvoiceList[curIdx];
            curInvoice = JSON.parse(
                window.sessionStorage.getItem(curName)
            );
            chrome.tabs.update({url: curInvoice.link});
        }
    }
    
    function runtimeMessageListener(message, sender, sendResponse) {
        if (currentState === 4 && message.action === "pageLoaded") {
            if (curInvoice && curInvoice.link === message.url) {
                // expected page loaded
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, 
                        { action: "exportOneInvoice", url: message.url}, ()=>{});
                });
            }
        }
        // unhandled message
        else {
            console.log(`Unexpected Message(exporter.js/runtime/${currentState}): ${message}`);
        }
    }
    
    function downloadChangeListener(downloadDelta) {
        if (!downloadDelta.state || downloadDelta.state.current !== "complete") return;
    
        chrome.downloads.search({ id: downloadDelta.id }, (results) => {
            if (!results || results.length === 0) return;
    
            const downloadedFile = results[0].filename; 
            console.log(`Downloaded: ${downloadedFile}`);
            const name = downloadedFile.split('/').at(-1);
    
            // read the downloaded file only if 
            // exporter.curName === name
            if (name.startsWith(curName)) {
                readAndSaveDownloadedFile(downloadedFile)
                .then(()=>{
                    exportNext();
                })
                .catch(error => console.error("❌ Error reading file:", error));
            }
        });
    }
    
    function readAndSaveDownloadedFile(filePath) {
        return new Promise((resolve, reject) => {
            fetch("file://" + filePath)
            .then(response => response.text())
            .then(fileContent => {
                curInvoice.exportedContent = fileContent;
                window.sessionStorage.setItem(
                    curName,
                    JSON.stringify(curInvoice)
                );
                resolve();
            })
            .catch(error => reject(error));
        });
    }
    
    return { startExportSequence };

})();




