

// importScripts("catapultElements_test.js");

console.log("content.js loaded");

// send current url everytime content.js is loaded
chrome.runtime.sendMessage({
    action: "pageLoaded",
    url: window.location.href
})


// message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // listen to message "checkStartCondition"
    if (message.action === "checkStartCondition") {
        let urlPattern = CATAPULT_WORKSHEET_URL;
        let elementPattern = CATAPULT_PO_URL_COMMON;

        let urlCheck = checkURLStartsWith(urlPattern);
        let elementCheck = checkElementHREfStartsWith(elementPattern);
        
        console.log(`start condition result ${urlCheck}, ${elementCheck}`);

        chrome.runtime.sendMessage({
            action: "startConditionResult",
            success: urlCheck && elementCheck
        });
    }
    // listen to "gatherSelectedInvoices"
    else if (message.action === "gatherSelectedInvoices"){
        // gather
        // let selectedInvoiceMap = gatherInvoiceSelection();
        // let selectedInvoiceList = Array.from(selectedInvoiceMap.keys);
        // let selectedInvoiceMap;
        // let selectedInvoiceList;
        gatherInvoiceSelection().then((result)=>{
            console.log("gather selection then");
            // selectedInvoiceMap = result;
            // selectedInvoiceList = Array.from(selectedInvoiceMap.keys());

            console.log("all gathered. sending result to background");
            console.log(result.size);
            console.log(result.keys());
            console.log(Object.fromEntries(result));
            chrome.runtime.sendMessage({
                action: "selectedInvoicesResult",
                result: Object.fromEntries(result)
            });

        });
        // }).then(
        //     chrome.storage.session.set(
        //         {selectedInvoices:JSON.stringify(selectedInvoiceList)}
        // )).then(()=>{
        //     return Promise.all([
        //         selectedInvoiceList.map(name=>
        //             chrome.storage.session.set(
        //                 Object.fromEntries(
        //                     [[name,JSON.stringify(selectedInvoiceMap.get(name))]]
        //                 )
        //             )
        //         )
        //     ]);
        // }).then(()=>{
        //     console.log("all gathered and saved to storage.session");
        //     chrome.runtime.sendMessage({
        //         action: "selectedInvoicesResult",
        //         selectedInvoices_size: selectedInvoiceMap.size
        //     });
        // });

        // window.sessionStorage.setItem("selectedInvoices",
        //     JSON.stringify(selectedInvoiceList)
        // );
        // for (const name of selectedInvoiceList){
        //     window.sessionStorage.setItem(name,
        //         JSON.stringify(selectedInvoiceMap.get(name))
        //     )
        // }
        // // send "selectedInvoicesResult"
        // chrome.runtime.sendMessage({
        //     action: "selectedInvoicesResult",
        //     selectedInvoices_size: selectedInvoices.size
        // });
    }
    // listen to "exportOneInvoice"
    else if (message.action === "exportOneInvoice"){
        console.log("exportOneInvoice caught");
        if (message.url === window.location.href){
            console.log(`url matches: ${message.url}\n${window.location.href}`);
            // export at this url
            exportFromCurrentPage();
            // following sequence expected to happen at
            // download listener at exporter.js
        }
    }
    // listen to "importOneInvoice"
    else if (message.action === "importOneInvoice") {
        if (message.url === window.location.href){
            // import to this url
            importToCurrentPage(
                message.name,
                JSON.parse(message.invoice)
            );
        }
    }
    // unhandled message
    else {
        console.log(`Unexpected Message(content.js/runtime/-): ${message.action}`);
    }
});


// check if current URL is correct
function checkURLStartsWith(pattern) {
    console.log(window.location.href);
    console.log(pattern);
    return window.location.href.startsWith(pattern);
}

// check if the element's href attribute starts with the pattern
function checkElementHREfStartsWith(pattern) {
    let element = document.querySelector(`a[href^="${pattern}"] `);
    if (element){
        return true;
    } else {
        return false;
    }
}

async function gatherInvoiceSelection() {
    // navigate to the first page of Purchase Orders table
    let first_button = document.getElementById(NAVIGATE_BTN_FIRST.Id);
    if (first_button && !first_button.disabled) {
        first_button.scrollIntoView();
        first_button.click();
        console.log("Navigating to the first page of Purchase Orders table.");

        // wait for the table to load
        await new Promise(r => setTimeout(r, 500));
    }

    let selectedInvoices = new Map();
    let page = 1;
    while (page <= 10) {
        let checkboxes = document.evaluate(
            WORKSHEETS_CHECKBOXES.XPath,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
        );

        for (let i = 0; i < checkboxes.snapshotLength; i++) {
            let checkbox = checkboxes.snapshotItem(i);
            if (checkbox.checked) {
                let row = checkbox;
                while (row && row.tagName !== 'TR') {
                    console.log(row);
                    row = row.parentElement;
                }

                let col2 = row.querySelector('td:nth-child(2) a')
                let name = col2.innerText;
                let href = col2.href;
                selectedInvoices.set(
                    name,
                    {
                        link: href,
                        exportedContent: null,
                        importedContent: null
                    }
                );
            }
        }

        let next_button = document.getElementById(NAVIGATE_BTN_NEXT.Id);
        if (next_button && !next_button.disabled) {
            next_button.scrollIntoView();
            next_button.click();

            await new Promise(r => setTimeout(r, 1000));

            page++;
        } else { // no more pages
            break;
        }
    }

    return selectedInvoices;
}

async function exportFromCurrentPage(){
    // 2. wait for the export button to be ready
    const exportReady = new Promise((resolve) => {
        let checkExportButton = setInterval(() => {
            let exportButton = EXPORT_BTN.getElement();
            if (exportButton && !exportButton.disabled) {
                clearInterval(checkExportButton);
                resolve();
            }
        }, 500);
    });
    await exportReady;

    // 3. click export button
    EXPORT_BTN.getElement().click();

    // 4. wait for the export format popup to be ready
    const exportFormatPopUp = new Promise((resolve) => {
        console.log("export format poped up");
        let checkExportFormat = setInterval(() => {
            let exportFormat = EXPORT_OK.getElement();
            if (exportFormat) {
                console.log('export button found');
                clearInterval(checkExportFormat);
                resolve();
            }
        }, 500);
    });
    await exportFormatPopUp;

    // 5. click ok button inside popup
    EXPORT_OK.getElement().click();    
}

async function importToCurrentPage(name, invoice){
    // let invoice;
    // await chrome.storage.session.get(name).then((result)=>{
    //     invoice = JSON.parse(result[name]);
    // });
    // import via file input element
    let fileInput = document.querySelector(`${IMPORT_FILEINPUT} input[type="file"]`);
    let file = new Blob([invoice.importedContent], { type: 'text/plain' });
    let dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([file], `${name}.txt`));
    fileInput.files = dataTransfer.files;

    // trigger change event to simulate user action
    let event = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(event);

    // handle import format popup
    const importFormatPopUp = new Promise((resolve) => {
        let checkImportFormat = setInterval(() => {
            let importFormat = IMPORT_OK.getElement();
            if (importFormat) {
                clearInterval(checkImportFormat);
                resolve();
            }
        }, 500);
    });
    await importFormatPopUp.then(()=>{
        IMPORT_OK.getElement().click();
    });

    // handle "overwrite details?" popup
    const overwriteDetailsPopUp = new Promise((resolve) => {
        let checkOverwriteDetails = setInterval(() => {
            let overwriteDetails = document.querySelector(OVERWRITE_DETAILS);
            if (overwriteDetails) {
                clearInterval(checkOverwriteDetails);
                resolve();
            }
        }, 500);
    });
    await overwriteDetailsPopUp.then(()=>{
        OVERWRITE_DETAILS_NO.getElement().click();
    });
    
    // handle "items not imported" popup
    const itemsNotImportedPopUp = new Promise((resolve, reject) => {
        let checkItemsNotImported = setInterval(() => {
            let itemsNotImported = document.querySelector(ITEMS_NOT_IMPORTED);
            if (itemsNotImported) {
                clearInterval(checkItemsNotImported);
                resolve();
            }
        }, 500);
        setTimeout(() => {
            clearInterval(checkItemsNotImported);
            reject();
        }, 1100);
    });
    await itemsNotImportedPopUp.then(()=>{
        ITEMS_NOT_IMPORTED_IGNORE.getElement().click();
        console.log('not imported items dismissed');
    }).catch(()=>{
        console.log('every item imported');
    });

    // save worksheet
    let save_btn = SAVE_BTN.getElement();
    if (save_btn && !save_btn.disabled) {
        save_btn.click();
        // wait for the save to complete
        const saveBtnDisabled = new Promise((resolve) => {
            let checkSaveBtn = setInterval(() => {
                let save_btn = SAVE_BTN.getElement();
                if (save_btn.disabled) {
                    clearInterval(checkSaveBtn);
                    resolve();
                }
            }, 500);
        });
        await saveBtnDisabled;

        console.log(`Invoice imported: ${name}`);
    }

    chrome.runtime.sendMessage({
        action: "importOneInvoiceResult",
        url: window.location.href
    });
}
