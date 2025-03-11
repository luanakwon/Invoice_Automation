
function LoadInvoicesFromList(invoiceList) {
    let invoices = new Map();
    invoiceList.forEach((invoice) => {
        let invoice = new Invoice(invoice);
        let invoiceID = invoice.worksheetInfo[WORKSHEETINFO_INVNO];
        invoices.set(invoiceID,invoice);
    });
    return invoices;
}

function PopInvoiceDiscrepencies(invoices) {
    let surplusItems = new Map();
    let missingItems = [];

    // for each invoice value in the invoices key-value pairs
    for (let invoiceID in invoices) {
        let invoice = invoices[invoiceID];
        for (let i=0; i<invoice.length; i++) {
            let item = invoice.records[i];
            let suID = item[RECORD_SUID];
            let alias = item[RECORD_RECEIPTALIAS];
            let upc = item[RECORD_UPC];
            let shippedQty = item[RECORD_SHPQTY];
            let receivedQty = item[RECORD_RECQTY];

            // received but not ordered (== surplus)
            if (shippedQty === -1){
                // append the item to surplus
                if (!surplusItems.has(suID)){
                    surplusItems.set(suID, 
                        {
                            'surplus': 0,
                            'details': [suID, upc, alias]
                        }
                    );
                }
                surplusItems.get(suID)['surplus'] += receivedQty;
                // modify the record
                invoice.records[i][RECORD_SHPQTY] = 0;
                // log
                console.log(`Found surplus item ${suID}/${receivedQty}(not ordered) from ${invoiceID}`);
            }
            // ordered
            else if (shippedQty >= 0){
                // shipped == ordered
                if (receivedQty === shippedQty){
                    // in this case, it should be verified, but I think importing disregards this info.
                    // so the record is not modified, hence removed
                    invoice.records[i] = null;
                }
                // received > shipped
                else if (receivedQty > shippedQty){
                    let surplusQty = receivedQty - shippedQty;
                    // append the item to surplus
                    if (!surplusItems.has(suID)){ 
                        surplusItems.set(suID, 
                            {
                                'surplus': 0,
                                'details': [suID, upc, alias]
                            }
                        );
                    }
                    surplusItems.get(suID)['surplus'] += surplusQty;
                    // modify the record
                    invoice.records[i][RECORD_RECQTY] = shippedQty;
                    // log
                    console.log(`Found surplus item ${suID}/${surplusQty}(shipped < received) from ${invoiceID}`);
                }
                // missing (received < shipped)
                else if (receivedQty < shippedQty){
                    let missingQty = shippedQty - receivedQty;
                    // append the item to missing
                    missingItems.push([
                        invoiceID, i, item.slice()
                    ]);
                    // log
                    console.log(`Found missing item ${suID}/${missingQty}(shipped > received) from ${invoiceID}`);
                } else {
                    console.log(`Error: ${suID}/${receivedQty}/${shippedQty}`);
                }
            }
            else{
                console.log(`Error: ${suID}/${receivedQty}/${shippedQty}`);
            }
        }
    }

    return [surplusItems, missingItems];
}

function FillInvoiceDiscrepencies(invoices, surplusItems, missingItems) {
    for (let i=0;i<missingItems.length;i++){
        let [invoiceID, idx, record] = missingItems[i];
        let suID = record[RECORD_SUID];
        let shippedQty = record[RECORD_SHPQTY];
        let receivedQty = record[RECORD_RECQTY];
        let missingQty = shippedQty - receivedQty;

        if (surplusItems.has(suID)){
            let surplusQty = surplusItems.get(suID)['surplus'];
            
            if (surplusQty >= missingQty){
                // surplus is enough to fill the missing quantity
                surplusItems.get(suID)['surplus'] -= missingQty;
                if (surplusItems.get(suID)['surplus'] === 0){
                    surplusItems.delete(suID);
                }
                missingItems[i] = null;
                invoices[invoiceID].records[idx][RECORD_RECQTY] = shippedQty;
                // log
                console.log(`Fully Filled missing item ${suID}/${missingQty} at ${invoiceID} using surplus`);
            } else {
                // partially cover the missing quantity
                let newQty = receivedQty + surplusQty;
                surplusItems.delete(suID);
                missingItems[i][2][RECORD_RECQTY] = newQty;
                invoices[invoiceID].records[idx][RECORD_RECQTY] = newQty;
                // log
                console.log(`Partially Filled missing item ${suID}/${missingQty} at ${invoiceID} using surplus`);
            }
        }
    }
    missingItems = missingItems.filter((item) => item !== null);
    return [surplusItems, missingItems];
}

function FormatInvoicesToTxt(invoices){
    let invoices_txt = new Map();
    invoices.values().forEach((invoice) => {
        let name = invoice.worksheetInfo[WORKSHEETINFO_NAME];
        let txt =  invoice.toTxt();
        if (txt !== ''){
            invoices_txt.set(name, txt);
            console.log(`Formatted ${name}`);
        } else {
            console.log(`skipped ${name}`);
        }
    });
    return invoices_txt;
}

function _html_header(title, len_list){
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                table {
                    width: 100%;
                    border-collapse: collapse;
                }
                th, td {
                    border: 1px solid black;
                    padding: 1px;
                    text-align: center;
                }
                th {
                    background-color: #f2f2f2;
                }
                .comment {
                    width: 98%;
                    text-align: left;
                }
            </style>
        </head>
        <body>
        <h3>${title} (${len_list})</h3>
        <table>
            <tr>
                <th>   </th>
                <th>Invoice No.</th>
                <th>SUID</th>
                <th>UPC</th>
                <th>Shipped</th>
                <th>Received</th>
                <th>Receipt Alias</th>
                <th>Comments</th>
            </tr>
    `;
}

function FormatSurplusToHTML(surplusItems){
    let surplus_html = _html_header('Surplus Items', surplusItems.size);
    
    console.log(`Surplus Items(${surplusItems.size})`);

    // sort surplus_items' values by the following order:
    // (alias + "  ")[:2] + str(suID)
    let sorted_surplus = Array.from(surplusItems.values());
    sorted_surplus.sort((a, b) => {
        let a_alias = a['details'][2];
        let b_alias = b['details'][2];
        let a_id = a['details'][0];
        let b_id = b['details'][0];
        return (a_alias + "  ").slice(0,2) + String(a_id) > (b_alias + "  ").slice(0,2) + String(b_id);
    });
    sorted_surplus.forEach((record) => {
        let suID = record['details'][0];
        let upc = record['details'][1];
        let alias = record['details'][2];
        let qty = record['surplus'];
        let row = `
            <tr>
                <td><input type="checkbox"></td>
                <td></td>
                <td>${suID}</td>
                <td>${upc}</td>
                <td></td>
                <td>${qty}</td>
                <td>${alias}</td>
                <td><input class="comment" type="text" maxlength="20"></td>
            </tr>
        `;
        surplus_html += row;
        console.log(`-, ${suID}, ${upc}, -, ${qty}, ${alias}`);
    });
    surplus_html += '</table></body></html>';
    console.log('Surplus Items formatted');
    return surplus_html;
}

function FormatMissingToHTML(missingItems){
    let missing_html = _html_header('Missing Items', missingItems.length);
    
    console.log(`Missing Items(${missingItems.length})`);

    // sort missing items by the suID
    missingItems.sort((a, b) => {
        return a[0] + String(a[2][RECORD_SUID]) > b[0] + String(b[2][RECORD_SUID]);
    });

    missingItems.forEach((item) => {
        let invoiceID = item[0];
        let record = item[2];
        let suID = record[RECORD_SUID];
        let upc = record[RECORD_UPC];
        let alias = record[RECORD_RECEIPTALIAS];
        let shippedQty = record[RECORD_SHPQTY];
        let receivedQty = record[RECORD_RECQTY];

        let row = `
            <tr>
                <td><input type="checkbox"></td>
                <td>${invoiceID}</td>
                <td>${suID}</td>
                <td>${upc}</td>
                <td>${shippedQty}</td>
                <td>${receivedQty}</td>
                <td>${alias}</td>
                <td><input class="comment" type="text" maxlength="20"></td>
            </tr>
        `;
        missing_html += row;
        console.log(`${invoiceID}, ${suID}, ${upc}, ${shippedQty}, ${receivedQty}, ${alias}`);
    });
    missing_html += '</table></body></html>';
    console.log('Missing Items formatted');
    return missing_html;
}

function OrganizeInvoices(invoiceList){
    let invoices = LoadInvoicesFromList(invoiceList);
    
    console.log('Invoices Processed: ')
    invoices.values().forEach((invoice) => {
        console.log(invoice.worksheetInfo[WORKSHEETINFO_NAME]);
    });

    let [surplusItems, missingItems] = PopInvoiceDiscrepencies(invoices);
    [surplusItems, missingItems] = FillInvoiceDiscrepencies(invoices, surplusItems, missingItems);

    missingItems = missingItems.filter((item) => item !== null);

    let surplus_html = FormatSurplusToHTML(surplusItems);
    let missing_html = FormatMissingToHTML(missingItems);
    let invoices_txt = FormatInvoicesToTxt(invoices);

    return [surplus_html, missing_html, invoices_txt];
}