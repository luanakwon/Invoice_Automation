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
                invoice.records[i] = None    
                # log
                logging.info(f"Found surplus item {suID}/{receivedQty}(not ordered)") 
            # ordered
            elif shippedQty >= 0:
                # shipped == ordered
                if shippedQty == receivedQty:
                    invoice.records[i][RECORD_VFFLAG] = '1'
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

def confirm_missing(invoices, missing_items) -> bool:
    # print
    print('Please confirm the actual received quantity and any remarks')

    confirmed = []
    for invoiceID, idx, detail in missing_items:
        invoiceID, remark, detail = confirm_each_missing(invoiceID, detail)
        confirmed.append((
            invoiceID, idx, detail, remark
        ))
    
    # print
    print("======summary======")
    for invoiceID, _, detail, remark in confirmed:
        print('{}, {}, {}, {}, {}, {}, {}'.format(
            invoiceID, 
            detail[RECORD_SUID], detail[RECORD_UPC], detail[RECORD_SHPQTY],
            detail[RECORD_RECQTY], detail[RECORD_RECEIPTALIAS],
            remark
        ))
    print("="*19)
    ans = input("Do you confirm these changes?\nOnce confirmed, it will be reflected to the system(y/n): ").lower()
    if ans == 'y':
        for invoiceID, idx, detail, remark in confirmed:
            invoices[invoiceID].records[idx][RECORD_RECQTY] = detail[RECORD_RECQTY]
            invoices[invoiceID].records[idx][RECORD_VFFLAG] = '1'
            if remark is not None:
                remark_str = f'item {detail[RECORD_SUID]} - {remark}\n'
                invoices[invoiceID].worksheetInfo[WORKSHEETINFO_REMARK] += remark_str
        return True
    else:
        # TODO
        # deal with it in the GUI
        return False
        




def confirm_each_missing(invoiceID, detail):
    # print info
    out = "{}, {}, {}, {}, {}, {}".format(
        invoiceID, 
        detail[RECORD_SUID], detail[RECORD_UPC], detail[RECORD_SHPQTY],
        detail[RECORD_RECQTY], detail[RECORD_RECEIPTALIAS]
    )
    print(out)
    # confirm received quantity
    while True:
        try:
            detail[RECORD_RECQTY] = float(input('Received Quantity: '))
            assert(detail[RECORD_RECQTY] >= 0)
            break
        except ValueError:
            print('Please enter a numeric value', end='\t')
        except AssertionError:
            print('Please enter a positive value', end='\t')

    # confirm remark
    while True:
        remark = input('Remark (none/short/other): ').lower()
        if remark == 'none':
            remark = None
            break
        elif remark == 'short' or remark == 'other':
            break
        else:
            print('Please choose from none/short/other', end='\t')

    return invoiceID, remark, detail


def save_invoices_to_txt(invoices):
    dir_path = './sample_invoices_out'
    for invoice in invoices.values():
        name = invoice.worksheetInfo[WORKSHEETINFO_NAME]
        fp = os.path.join(dir_path,f'DONE_{name}.txt')
        invoice.save_to_txt(fp)
        # log
        logging.info(f"Saved invoice {name} to {fp}.")

if __name__ == "__main__":
    INVOICES_FOLDER = "./sample_invoices"

    invoices = get_invoices_from_folder(INVOICES_FOLDER)

    # confirm invoices to process
    print("INVOICES:")
    for invoice in invoices.values():
        print(invoice.worksheetInfo[WORKSHEETINFO_NAME])
    print(f'total {len(invoices)} invoics found.')
    if input('Would you like to continue? (y/n)').lower() != 'y':
        print('Process interrupted. Please make sure that you only have desired invoices in the folder.')
        exit()   
    
    surplus_items, missing_items = pop_invoice_discrepencies(invoices)

    surplus_items, missing_items = fill_invoice_discrepencies(invoices, surplus_items, missing_items)

    # show results
    
    ## pop none from missing
    missing_items = [el for el in missing_items if el is not None]
    ## print
    print(f"======SURPLUS ITEMS====== ({len(surplus_items)})")
    print("Invoice No.  | SUID  |      UPC      | Shipped | Received | Receipt Alias ")
    for record in sorted(surplus_items.values(), key=lambda x:x['details'][2]):
        qty = record['surplus']
        suID, upc, alias = record['details']
        out = "{:>13}, {:>6}, {:>14}, {:>8}, {:>9}, {}".format(
            '-', suID, upc, '-', qty, alias
        )
        print(out)

    print(f"======MISSING ITEMS====== ({len(missing_items)})")
    print("Invoice No.  | SUID  |      UPC      | Shipped | Received | Receipt Alias ")
    for invoiceID, _, detail in sorted(missing_items, key=lambda x:x[2][RECORD_RECEIPTALIAS]):
        out = "{:>13}, {:>6}, {:>14}, {:>8}, {:>9}, {}".format(
            invoiceID, 
            detail[RECORD_SUID], detail[RECORD_UPC], detail[RECORD_SHPQTY],
            detail[RECORD_RECQTY], detail[RECORD_RECEIPTALIAS]
        )
        print(out) 

    print()
    # things taht needs to be confirmed manually
    # while True:
    #     ret = confirm_missing(invoices, missing_items)
    #     if ret == True:
    #         break

    save_invoices_to_txt(invoices)  

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