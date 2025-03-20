// singleton module
const Exporter = (()=>{
    let selectedInvoiceList;
    let curIdx;
    let curName;
    let curInvoice;

    async function startExportSequence() {
        // add runtime message listener
        chrome.runtime.onMessage.addListener(runtimeMessageListener);
        // add download change listener
        chrome.downloads.onChanged.addListener(downloadChangeListener);
        // load invoice from session storage
        await chrome.storage.session.get("selectedInvoices").then((result)=>{
            console.log(JSON.parse(result["selectedInvoices"]));
            selectedInvoiceList = JSON.parse(result["selectedInvoices"]);
        });
        // selectedInvoiceList = new Array(
        //     JSON.parse(
        //         window.sessionStorage.getItem("selectedInvoices")
        //     )
        // );
        // start from 0
        curIdx = 0;
        curName = selectedInvoiceList[curIdx];
        console.log(selectedInvoiceList);
        console.log(curName);
        await chrome.storage.session.get(curName).then((result)=>{
            console.log(result[curName]);
            curInvoice = JSON.parse(result[curName]);
        });
        // curInvoice = JSON.parse(
        //     window.sessionStorage.getItem(curName)
        // );
        // start by navigating tab
        chrome.tabs.update({url: curInvoice.link});
    }
    
    function exportNext(){
        curIdx++;
        // exit condition
        if (curIdx >= selectedInvoiceList.length) {
            console.log("export finished");
            
            selectedInvoiceList = null;
            curIdx = null;
            curName = null;
            curInvoice = null;
    
            // remove listener
            chrome.runtime.onMessage.removeListener(runtimeMessageListener);
            chrome.downloads.onChanged.removeListener(downloadChangeListener);
    
            loadAndOrganizeExportedResult();
        }
        // export next
        else {
            curName = selectedInvoiceList[curIdx];
            chrome.storage.session.get(curName).then((result)=>{
                curInvoice = JSON.parse(result[curName]);
                chrome.tabs.update({url: curInvoice.link});
            });
            // curInvoice = JSON.parse(
            //     window.sessionStorage.getItem(curName)
            // );
        }
    }
    
    function runtimeMessageListener(message, sender, sendResponse) {
        if (currentState === 4 && message.action === "pageLoaded") {
            console.log(`Caught message pageLoaded`);
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
            console.log(`Unexpected Message(exporter.js/runtime/${currentState}): ${message.action}`);
        }
    }
    
    function downloadChangeListener(downloadDelta) {
        if (!downloadDelta.state || downloadDelta.state.current !== "complete") return;
    
        chrome.downloads.search({ id: downloadDelta.id }, (results) => {
            if (!results || results.length === 0) return;
    
            const downloadedFile = results[0].filename.replace(/\\/g, "/"); 
            console.log(results[0]);
            console.log(`Downloaded: ${downloadedFile}`);
            const name = downloadedFile.split('/').at(-1);
    
            // read the downloaded file only if 
            // exporter.curName === name
            if (name.startsWith(curName)) {
                console.log(`reading ${name}`);
                readAndSaveDownloadedFile(downloadedFile)
                .then(()=>{
                    console.log("successfully exported " + name);
                    exportNext();
                })
                .catch(error => console.error("❌ Error reading file:", error));
            } else {
                console.log(`name not match \nname:${name}\ncurName:${curName}`);
            }
        });
    }
    
    function readAndSaveDownloadedFile(filePath) {
        return new Promise((resolve, reject) => {
            console.log("file://" + filePath);
            const encodedPath = encodeURI("file://"+filePath).replace(/#/g, "%23");
            fetch(encodedPath)
            .then(response => response.text())
            .then(fileContent => {
                curInvoice.exportedContent = fileContent;
                chrome.storage.session.set(
                    Object.fromEntries([[
                        curName,
                        JSON.stringify(curInvoice)
                    ]])
                ).then(()=>{resolve();})
                // window.sessionStorage.setItem(
                //     curName,
                //     JSON.stringify(curInvoice)
                // );
                // resolve();
            })
            .catch(error => reject(error));
        });
    }
    
    return { startExportSequence };

})();




