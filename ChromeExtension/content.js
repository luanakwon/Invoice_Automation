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

        chrome.runtime.sendMessage({
            action: "startConditionResult",
            success: urlCheck && elementCheck
        });
    }
    // listen to "gatherSelectedInvoices"
    else if (message.action === "gatherSelectedInvoices"){
        // gather
        let selectedInvoiceMap = gatherInvoiceSelection();
        let selectedInvoiceList = Array.from(selectedInvoiceMap.keys());
        window.sessionStorage.setItem("selectedInvoices",
            JSON.stringify(selectedInvoiceList)
        );
        for (const name of selectedInvoiceList){
            window.sessionStorage.setItem(name,
                JSON.stringify(selectedInvoiceMap.get(name))
            )
        }
        // send "selectedInvoicesResult"
        chrome.runtime.sendMessage({
            action: "selectedInvoicesResult",
            selectedInvoices_size: selectedInvoices.size
        });
    }
    // listen to "exportInvoices"
    else if (message.action === "exportOneInvoice"){
        if (message.url === window.location.href){
            // export at this url
            startExport();
        }
    }
});

async function startExport(){
    // 2. wait for the export button to be ready
    const exportReady = new Promise((resolve) => {
        let checkExportButton = setInterval(() => {
            let exportButton = document.querySelector(EXPORT_BTN);
            if (exportButton && !exportButton.disabled) {
                clearInterval(checkExportButton);
                resolve();
            }
        }, 500);
    });
    await exportReady;

    // 3. click export button
    document.querySelector(EXPORT_BTN).click();

    // 4. wait for the export format popup to be ready
    const exportFormatPopUp = new Promise((resolve) => {
        let checkExportFormat = setInterval(() => {
            let exportFormat = document.querySelector(EXPORT_OK);
            if (exportFormat) {
                clearInterval(checkExportFormat);
                resolve();
            }
        }, 500);
    });
    await exportFormatPopUp;

    // 5. click ok button inside popup
    document.querySelector(EXPORT_OK).click();    
}


// check if current URL is correct
function checkURLStartsWith(pattern) {
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


// set_download_dir => skip
// inject_select_and_continue =>
// change from injecting script to using chrome extension popup

//### Main process ###
// 1. set download dir => skip
// 2. open catapult => skip
// 3. user login => skip
// 4. Navigate to Purchase Order Worksheet => skip

// 5. set popup
//    "select the invoices you'd like to process, then click 'Continue'"
// 6. Once Continue is clicked:
//    check if the URL is correct
//    check if the P.O. page is loaded
//    check if any invoices are selected
//    = gatherSelectedInvoices()
//        => if not, alert the user
//        => if yes, process the invoices

// 7. Navigate to the first page of Purchase Orders table.
// 8. iterate through each page and gather 'name' and 'href' of each invoice.
// 9. confirm the number of invoices to process.

// 10. Fetch/download selected invoices.
// 11. Process the invoices:
//     InvoiceOrganizer.run(
//         list of invoice txt content)
//     => [surplus, missing, invoices_done]

// 12. Ask if the user wants to import the results
// 13. If yes, import the results
//     - open each invoice
//     - Import the result
//     - handle popups (format, detail, not-imported)
//     - save and close

// 14. open missing and surplus in a new tab

// 15. download logs
// 16. close chrome extension popup.

async function gatherInvoiceSelection() {
    // navigate to the first page of Purchase Orders table
    let first_button = document.getElementById(NAVIGATE_BTN_FIRST.Id);
    if (first_button && !first_button.disabled) {
        first_button.scrollIntoView();
        first_button.click();
        console.log("Navigating to the first page of Purchase Orders table.");
    }
    
    // wait for the table to load
    await new Promise(r => setTimeout(r, 500));

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
                while (row && row.tagName !== 'tr') {
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

// async function exportInvoices(selectedInvoices) {
//     let downloadCompletePromises = new Map();

//     // add event listener that listens to the download event
//     // and reads the file into selectedInvoices.get(name).content
//     // and resolves matching promise
//     chrome.downloads.onChanged.addListener((downloadDelta) => {
//         if (!downloadDelta.state || downloadDelta.state.current !== "complete") return;
    
//         chrome.downloads.search({ id: downloadDelta.id }, (results) => {
//             if (!results || results.length === 0) return;
    
//             let downloadedFile = results[0].filename; // Full file path
//             console.log(`Downloaded: ${downloadedFile}`);
//             let name = downloadedFile.split('/').at(-1).split('.')[0];

//             // ✅ Read the downloaded file
//             selectedInvoices.get(name).content = readDownloadedFile(downloadedFile);
            
//             // resolve the promise
//             downloadCompletePromises.get(name).resolve();
//         });
//     });


//     // call export on each invoice and wait for the content to be loaded
//     for (const name of selectedInvoices.keys()) {
//         let invoice = selectedInvoices.get(name);
//         let href = invoice.link;

//         // 1. open link
//         window.open(href, '_blank');
//         console.log(`Opened invoice for export: ${name}`);

//         // 2. wait for the export button to be ready
//         const exportReady = new Promise((resolve) => {
//             let checkExportButton = setInterval(() => {
//                 let exportButton = document.querySelector(EXPORT_BTN);
//                 if (exportButton && !exportButton.disabled) {
//                     clearInterval(checkExportButton);
//                     resolve();
//                 }
//             }, 500);
//         });
//         await exportReady;

//         // 3. click export button
//         document.querySelector(EXPORT_BTN).click();
    
//         // 4. wait for the export format popup to be ready
//         const exportFormatPopUp = new Promise((resolve) => {
//             let checkExportFormat = setInterval(() => {
//                 let exportFormat = document.querySelector(EXPORT_OK);
//                 if (exportFormat) {
//                     clearInterval(checkExportFormat);
//                     resolve();
//                 }
//             }, 500);
//         });
//         await exportFormatPopUp;

//         // 5. click ok button inside popup
//         document.querySelector(EXPORT_OK).click();
        
//         // 6. wait for the download to complete
//         const downloadComplete = new Promise((resolve) => {
//             downloadCompletePromises.set(name, {resolve});
//         });
//         await downloadComplete;

//         // continue to the next invoice
//     }

//     // return promise that resolves when all invoices are exported
//     return new Promise(() => {});
// }

function confirmAndProcessInvoiceSelection(selectedInvoices) {
    if (confirm(
        `${selectedInvoices.size} invoices selected. Would you like to proceed?`
    )) {
        // read(or export) selected invoices
        // run invoiceOrganizer
        exportInvoices(selectedInvoices)
            .then(() => {
                let [
                    missing_html,
                    surplus_html,
                    invoicesOut_Name2Txt
                ] = OrganizeInvoices(selectedInvoices)

                let invoicesSel_Name2Href = new Map();
                selectedInvoices.keys().forEach(name => {
                    invoicesSel_Name2Href.set(name, selectedInvoices.get(name).link);
                });
                // ask if the user wants to update the system
                // if yes, update the system
                confirmAndImportResults(invoicesOut_Name2Txt, invoicesSel_Name2Href);
                

                // open missing and surplus in a new tab
                window.open(`data:text/html,${missing_html}`, '_blank');
                window.open(`data:text/html,${surplus_html}`, '_blank');
                // download logs

                // close chrome extension popup
            })
    } else {
        alert("Process cancelled.");
    }
}

async function confirmAndImportResults(invoicesOut_Name2Txt, invoicesSel_Name2Href) {
    if (confirm(
        'Would you also like to update your system?'
    )) {
        for (const [name, txt] of invoicesOut_Name2Txt) {
            let href = invoicesSel_Name2Href.get(name).link;
            
            // open href
            window.open(href, '_blank');
            console.log(`Opened invoice for import: ${name}`);

            // import via file input element
            let fileInput = document.querySelector(`${IMPORT_FILEINPUT} input[type="file"]`);
            let file = new Blob([txt], { type: 'text/plain' });
            let dataTransfer = new DataTransfer();
            dataTransfer.items.add(new File([file], `${name}.txt`));
            fileInput.files = dataTransfer.files;

            // trigger change event to simulate user action
            let event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);

            // handle import format popup
            const importFormatPopUp = new Promise((resolve) => {
                let checkImportFormat = setInterval(() => {
                    let importFormat = document.querySelector(IMPORT_OK);
                    if (importFormat) {
                        clearInterval(checkImportFormat);
                        resolve();
                    }
                }, 500);
            });
            await importFormatPopUp;
            document.querySelector(IMPORT_OK).click();

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
            await overwriteDetailsPopUp;
            document.querySelector(OVERWRITE_DETAILS_NO).click();

            // handle "items not imported" popup
            const itemsNotImportedPopUp = new Promise((resolve) => {
                let checkItemsNotImported = setInterval(() => {
                    let itemsNotImported = document.querySelector(ITEMS_NOT_IMPORTED);
                    if (itemsNotImported) {
                        clearInterval(checkItemsNotImported);
                        resolve(true);
                    }
                }, 500);
                setTimeout(() => {
                    clearInterval(checkItemsNotImported);
                    resolve(false);
                }, 1100);
            });
            const itemsNotImportedAppeared = await itemsNotImportedPopUp;
            if (itemsNotImportedAppeared) {
                document.querySelector(ITEMS_NOT_IMPORTED_IGNORE).click();
            }

            // save worksheet
            let save_btn = document.querySelector(SAVE_BTN);
            if (save_btn && !save_btn.disabled) {
                save_btn.click();
                // wait for the save to complete
                const saveBtnDisabled = new Promise((resolve) => {
                    let checkSaveBtn = setInterval(() => {
                        let save_btn = document.querySelector(SAVE_BTN);
                        if (save_btn.disabled) {
                            clearInterval(checkSaveBtn);
                            resolve();
                        }
                    }, 500);
                });
                await saveBtnDisabled;

                console.log(`Invoice imported: ${name}`);
            }

            // close this tab
            // window.close();
        }
    } else {
        alert("Import process dismissed");
    }
}

