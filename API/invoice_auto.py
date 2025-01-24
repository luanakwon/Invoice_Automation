import requests
import sqlite3
import json
import os

# Configuration
API_KEY = "YOUR_API_KEY"
BASE_URL = "https://accountId.catapultweboffice.com/api"
DB_FILE = "invoice_cache.db"

# Create SQLite database if it doesn't exist
def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS surplus (
            supplierUnitId TEXT PRIMARY KEY,
            receivedQty REAL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS missing (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchaseOrderId TEXT,
            invoiceId TEXT,
            supplierUnitId TEXT,
            shippedQty REAL,
            receivedQty REAL
        )
    """)
    conn.commit()
    conn.close()

# Fetch purchase orders (only pending worksheets)
def get_purchaseOrders():
    url = f"{BASE_URL}/purchaseOrderDetail?Type=2"
    headers = {"X-ECRS-APIKEY": API_KEY}
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        print("Error fetching invoices", response.text)
        return None

def filter_purchaseOrders(purchaseOrders, invoiceNumbers):
    return [po for po in purchaseOrders \
            if po.get("worksheetInvoiceNumber") in invoiceNumbers]

# Process purchaseOrders
def process_purchaseOrders(purchaseOrders):
    surplus_items = []
    missing_items = []
    rqHanlder = POUpdateRequestHandler()
    
    for purchaseOrder in purchaseOrders:
        purchaseOrderId = purchaseOrder.get("existingWorksheetId")
        invoiceId = purchaseOrder.get("worksheetInvoiceNumber")
        supplierUnitId = purchaseOrder.get("worksheetSupplierUnitID")
        shippedQuantity = purchaseOrder.get("worksheetShippedQuantity")
        receivedQuantity = purchaseOrder.get("worksheetReceivedQuantity")
        verifiedFlag = purchaseOrder.get("worksheetItemVerified")
        
        if shippedQuantity is None:  # NaN-shipped
            surplus_items.append(supplierUnitId, receivedQuantity)
            rqHanlder.add_call(
                purchaseOrderId,'remove',supplierUnitId
            )
        elif shippedQuantity >= 0:
            if shippedQuantity == receivedQuantity:
                if verifiedFlag == 0: # to prevent unnecessary API calls.
                    rqHanlder.add_call(
                        purchaseOrderId,'verify',supplierUnitId,verified=1
                    )
            elif receivedQuantity > shippedQuantity:
                surplus_qty = receivedQuantity - shippedQuantity
                surplus_items.append(supplierUnitId, surplus_qty)
                rqHanlder.add_call(
                    purchaseOrderId,'adjust',supplierUnitId,
                    quantity=shippedQuantity,verified=1
                )
            elif receivedQuantity < shippedQuantity:
                missing_items.append(
                    purchaseOrderId, invoiceId, supplierUnitId, 
                    shippedQuantity, receivedQuantity)
                if verifiedFlag == 1: # to prevent unnecessary API calls.
                    rqHanlder.add_call(
                        purchaseOrderId,'verify',supplierUnitId,
                        verified=0
                    )
    rqHanlder.exec_pending_calls()
    
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO surplus (supplierUnitId, receivedQty) VALUES (?, ?) ON CONFLICT(supplierUnitId) DO UPDATE SET receivedQty = receivedQty + excluded.receivedQty",
        surplus_items
    )
    cursor.executemany(
        "INSERT INTO missing (purchaseOrderId, invoiceId, supplierUnitId, shippedQty, receivedQty) VALUES (?, ?, ?, ?, ?)",
        missing_items
    )
    conn.commit()
    conn.close()

    fill_missing_with_surplus()


def fetch_missing_items():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT purchaseOrderId, invoiceId, supplierUnitId, shippedQty, receivedQty FROM missing")
    missing_items = cursor.fetchall()
    conn.close()
    return missing_items  # List of tuples

def fetch_surplus_items():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT supplierUnitId, receivedQty FROM surplus")
    surplus_items = {row[0]: row[1] for row in cursor.fetchall()}  # Convert to dictionary {supplierUnitId: qty}
    conn.close()
    return surplus_items

def fill_missing_with_surplus():
    missing_items = fetch_missing_items()
    deleted_missing_items = []
    updated_missing_items = []
    surplus_items = fetch_surplus_items()


    rqHanlder = POUpdateRequestHandler()

    for purchaseOrderId, invoiceId, supplierUnitId, shippedQty, receivedQty in missing_items:
        missing_qty = shippedQty - receivedQty
        if supplierUnitId in surplus_items:
            available_surplus = surplus_items[supplierUnitId]
            
            if available_surplus >= missing_qty:
                # Fully cover the missing qty
                deleted_missing_items.append((purchaseOrderId, supplierUnitId))
                surplus_items[supplierUnitId] -= missing_qty  # Reduce surplus
                rqHanlder.add_call(
                    purchaseOrderId=purchaseOrderId,
                    action='adjust',
                    supplierUnitId=supplierUnitId,
                    quantity=shippedQty,
                    verified=1)
                print(f"Fully Filled missing {supplierUnitId} ({missing_qty}) at {invoiceId} using surplus")
            else:
                # Partially cover the missing qty
                new_qty = receivedQty + available_surplus
                updated_missing_items.append((new_qty, purchaseOrderId, supplierUnitId))
                surplus_items[supplierUnitId] = 0  # Surplus used up
                rqHanlder.add_call(
                    purchaseOrderId=purchaseOrderId,
                    action='adjust',
                    supplierUnitId=supplierUnitId,
                    quantity=new_qty,
                    verified=0)
                print(f"Partially filled missing {supplierUnitId} at {invoiceId}(shipped {shippedQty} / received {new_qty}).")

    # request adjustments
    rqHanlder.exec_pending_calls()

    # update DB
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.executemany("DELETE FROM missing WHERE purchaseOrderId=? AND supplierUnitId=?",
                       deleted_missing_items)
    cursor.executemany("UPDATE missing SET receivedQty=? WHERE purchaseOrderId=? AND supplierUnitId=?",
                       updated_missing_items)
    # update DB - Remove surplus items that were fully used
    fully_used = [(supplierUnitId,) for supplierUnitId, qty in surplus_items.items() if qty == 0]
    cursor.executemany("DELETE FROM surplus WHERE supplierUnitId=?", fully_used)

    conn.commit()
    conn.close()

class POUpdateRequestHandler:
    def __init__(self):
        self.pending_calls = {}

    def add_call(self, purchaseOrderId, action, supplierUnitId, quantity=0, verified=-1):
        """action='remove' to remove record,
        action='adjust' to adjust received quantity of a record,
        action='verify' to only verify a record.
        """
        # remove request
        if action == 'remove':
            data = {
                "action":"D",
                "supplierUnitId":supplierUnitId
            }
        # adjust quantity request
        elif action == 'adjust':
            data = {
                "action": "A", 
                "supplierUnitId": supplierUnitId, 
                "receivedQuantity": quantity,
                "verifiedFlag": 1
            }
        # verify record request
        elif action == 'verify':
            if verified != 0 and verified != 1: 
                print("verified must be either 0 or 1")
                return
            data = {
                "action": "A", 
                "supplierUnitId": supplierUnitId, 
                "verifiedFlag": verified
            }
        else:
            print("action must be either 'remove', 'adjust' or 'verify'")
            return
        
        if self.pending_calls.get(purchaseOrderId, None) is None:
                self.pending_calls[purchaseOrderId] = [data]
        else:
            self.pending_calls[purchaseOrderId].append(data)

    def exec_pending_calls(self):
        failed_pending_calls = {}
        for poID in self.pending_calls.keys():
            data = self.pending_calls.pop(poID)
            print(f"Sending API call for {poID}: {json.dumps(data, indent=2)}")

            url = f"{BASE_URL}/purchaseOrderItems?purchaseOrderId={poID}"
            headers = {"X-ECRS-APIKEY": API_KEY, "Content-Type": "application/json"}
            response = requests.put(url, headers=headers, json=data)

            if response.status_code == 200:
                print(f"request successful for purchase order {poID}")
            else:
                print(f"request failed for purchase order {poID}: {response.text}")
                failed_pending_calls[poID] = data
        # save failed calls
        with open("failed_requests.json", "w") as f:
            json.dump(failed_pending_calls, f, indent=2)

def show_purchaseOrders(purchaseOrders):
    invoiceNums = set([po.get("worksheetInvoiceNumber") for po in purchaseOrders])
    # TODO show invoice numbers

if __name__ == "__main__":
    init_db()
    purchaseOrders = get_purchaseOrders()
    # TODO we often have several day's po created in one day. 
    # Therefore, querying is not enough for filtering today's POs.
    # So what I would like to do is show the receiver all available POs, 
    # and let them choose POs(invoices) to work on.
    show_purchaseOrders(purchaseOrders)

    # TODO once the worker chose the invoices(POs) to work on, 
    # filter POs with those invoice numbers and start process_purchaseOrders
    # it'd be better to ask to double check since process_purchaseOrder will update what's on the system.
    invoiceNumbers = ['000000','111111',]
    purchaseOrders = filter_purchaseOrders(purchaseOrders, invoiceNumbers)
    if purchaseOrders:
        # process = find missing and surplus > ... > filling missing with surplus
        process_purchaseOrders(purchaseOrders)
        # show missing items
        missings = fetch_missing_items()
        print(missings)
    else:
        print("No invoices found.")
