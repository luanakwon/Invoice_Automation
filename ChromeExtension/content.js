

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
//    => if not, alert the user
//    => if yes, process the invoices

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
