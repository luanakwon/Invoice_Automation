import os
from invoice import *
import logging

# Configure logging
logging.basicConfig(
    filename="invoice_log.txt",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

def get_invoices_from_folder(folder_path):
    invoices = {}

    for fname in os.listdir(folder_path):
        if fname.endswith('.txt'):
            invoice = Invoice(os.path.join(folder_path,fname))
            invoiceID = invoice.worksheetInfo[WORKSHEETINFO_INVNO]
            invoices[invoiceID] = invoice
    return invoices

def pop_invoice_discrepencies(invoices):
    surplus_items = {}
    missing_items = []

    for invoice in invoices.values():
        invoiceID = invoice.worksheetInfo[WORKSHEETINFO_INVNO]
        for i, item in enumerate(invoice.records):
            suID = item[RECORD_SUID]
            alias = item[RECORD_RECEIPTALIAS]
            upc = item[RECORD_UPC]
            shippedQty = item[RECORD_SHPQTY]
            receivedQty = item[RECORD_RECQTY]

            # received but not ordered(== surplus)
            if shippedQty == -1:
                # append to surplus
                surplus_items.setdefault(
                    suID, {
                        'surplus': 0, 
                        'details': (suID, upc, alias)}
                )['surplus'] += receivedQty
                # modify invoice
                invoice.records[i][RECORD_RECQTY] = 0    
                # log
                logging.info(f"Found surplus item {suID}/{receivedQty}(not ordered) from {invoiceID}") 
            # ordered
            elif shippedQty >= 0:
                # shipped == ordered
                if shippedQty == receivedQty:
                    # in this case, it should be verified, but I think importing disregards this info.
                    # so the record is not modified, hence removed
                    invoice.records[i] = None
                # surplus item
                elif receivedQty > shippedQty:
                    surplusQty = receivedQty - shippedQty
                    # append to surplus
                    surplus_items.setdefault(
                        suID, {
                            'surplus': 0, 
                            'details': (suID, upc, alias)}
                    )['surplus'] += surplusQty
                    # modify invoice
                    invoice.records[i][RECORD_RECQTY] = shippedQty
                    invoice.records[i][RECORD_VFFLAG] = '1'
                    # log
                    logging.info(f"Found surplus item {suID}/{surplusQty}")
                # missing item
                elif receivedQty < shippedQty:
                    # append to missing
                    missing_items.append((
                        invoiceID, i, item[:]
                    ))
                    # modify invoice
                    invoice.records[i][RECORD_VFFLAG] = '0'
                    # log
                    logging.info(f"Found missing item {suID}/{receivedQty-shippedQty} from invoice {invoiceID}")
                else:
                    logging.error('error: error while comparing received quantity with shipped quantity.')
            else:
                logging.error('error: shipped quantity is less than -1')
            
    return surplus_items, missing_items

def fill_invoice_discrepencies(invoices, surplus_items, missing_items):
    for i, (invoiceID, idx, record) in enumerate(missing_items):
        suID = record[RECORD_SUID]
        shippedQty = record[RECORD_SHPQTY]
        receivedQty = record[RECORD_RECQTY]
        missingQty = shippedQty - receivedQty

        if suID in surplus_items:
            available_surplus = surplus_items[suID]['surplus']

            if available_surplus >= missingQty:
                # fully cover the missing quantity
                ## recduce surplus
                surplus_items[suID]['surplus'] -= missingQty
                if surplus_items[suID]['surplus'] == 0:
                    surplus_items.pop(suID)
                ## reduce missing
                missing_items[i] = None
                ## modify invoice
                invoices[invoiceID].records[idx][RECORD_RECQTY] = shippedQty
                invoices[invoiceID].records[idx][RECORD_VFFLAG] = '1'
                ## logging
                logging.info(f"Fully Filled missing {suID} ({missingQty}) at {invoiceID} using surplus")
            else:
                # partially cover the missing quantity
                newQty = receivedQty + available_surplus
                ## remove surplus
                surplus_items.pop(suID)
                ## reduce missing
                missing_items[i][2][RECORD_RECQTY] = newQty
                ## modify invoice
                invoices[invoiceID].records[idx][RECORD_RECQTY] = newQty
                invoices[invoiceID].records[idx][RECORD_VFFLAG] = '0'
                ## logging
                logging.info(f"Partially filled missing {suID} at {invoiceID}(shipped {shippedQty}/ received {receivedQty}).")

    missing_items = [el for el in missing_items if el is not None]
    return surplus_items, missing_items


def save_invoices_to_txt(invoices, dir_path):
    for invoice in invoices.values():
        name = invoice.worksheetInfo[WORKSHEETINFO_NAME]
        fp = os.path.join(dir_path,f'DONE_{name}.txt')
        is_saved = invoice.save_to_txt(fp)
        if is_saved:
            # log
            logging.info(f"Saved invoice {name} to {fp}.")
        else:
            logging.info(f"Skipped invoice {name} (zero modified record).")

def save_surplus_items_to_txt(surplus_items: dict, fp):
    with open(fp, 'w') as f:
        f.write(f"Surplus Items ({len(surplus_items)})\n")
        logging.info(f"Surplus Items ({len(surplus_items)})")
        f.write(     " Invoice No.  |  SUID  |       UPC      | Shipped | Received | Receipt Alias \n")
        logging.info(" Invoice No.  |  SUID  |       UPC      | Shipped | Received | Receipt Alias ")
        for record in sorted(surplus_items.values(), key=lambda x:x['details'][0]):
            qty = record['surplus']
            suID, upc, alias = record['details']
            out = "{:>14}, {:>7}, {:>15}, {:>8}, {:>9}, {}".format(
                '- ', suID, upc, '- ', qty, alias
            )
            f.write(out+'\n')
            logging.info(out)

def save_missing_items_to_txt(missing_items: list, fp):
    with open(fp, 'w') as f:
        f.write(f"Missing Items ({len(missing_items)})\n")
        logging.info(f"Missing Items ({len(missing_items)})")
        f.write(     " Invoice No.  |  SUID  |       UPC      | Shipped | Received | Receipt Alias \n")
        logging.info(" Invoice No.  |  SUID  |       UPC      | Shipped | Received | Receipt Alias ")
        for invoiceID, _, detail in sorted(missing_items, key=lambda x:x[0]+str(x[2][RECORD_SUID])):
            out = "{:>14}, {:>7}, {:>15}, {:>8}, {:>9}, {}".format(
                invoiceID, 
                detail[RECORD_SUID], detail[RECORD_UPC], detail[RECORD_SHPQTY],
                detail[RECORD_RECQTY], detail[RECORD_RECEIPTALIAS]
            )
            f.write(out+'\n')
            logging.info(out)


if __name__ == "__main__":
    INVOICES_FOLDER = "./invoices"

    invoices = get_invoices_from_folder(INVOICES_FOLDER)

    # confirm invoices to process
    print("INVOICES:")
    for invoice in invoices.values():
        print(invoice.worksheetInfo[WORKSHEETINFO_NAME])
    print(f'total {len(invoices)} invoics found.')
    if input('Would you like to continue? (y/n)').lower() != 'y':
        print('Process interrupted. Please make sure that you only have desired invoices in the folder.')
        exit()   
    out = 'Invoices processed: '+' '.join([inv.worksheetInfo[WORKSHEETINFO_NAME] for inv in invoices.values()])
    logging.info(out)
    
    surplus_items, missing_items = pop_invoice_discrepencies(invoices)

    surplus_items, missing_items = fill_invoice_discrepencies(invoices, surplus_items, missing_items)

    # save missing, surplus results
    ## pop none from missing
    missing_items = [el for el in missing_items if el is not None]
    save_surplus_items_to_txt(surplus_items,'surplus.txt')
    save_missing_items_to_txt(missing_items, 'missing.txt')
    ## save resulting invoices
    save_dir_path = './invoices_out'
    if not os.path.exists(save_dir_path):
        os.mkdir(save_dir_path)
    save_invoices_to_txt(invoices, save_dir_path)  

    # things that needs to be entered manually
    # - new items
    # - replaced items
    # - mispicks
    # - creditmemo
    # - invoice total, fuel charge, bottle tax
    # - terms
    # - Alias?
    # - Receiver?
    print("Invoice confirmation process is done.")
    print("You can push the result to the Catapult system by importing the resulted text files.")
    print("Afterwards, please confirm the followings manually:")
    print("\tworksheet alias \n\treceiver \n\tterms")
    print("\tnew items \n\treplaced items \n\tmispicks \n\tclaims and creditmemos")
    print("\tnumbers(fuel charge, bottle tax and total)")
    input("Hit Enter to finish.")

    # open results
    os.startfile('surplus.txt')
    os.startfile('missing.txt')