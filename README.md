# Invoice Auto-Processing for Improved Receiving and Confirmation

---

## **📌 Purpose**

The goal of this project is to improve the efficiency and accuracy of **scanning, confirming invoices in Catapult, and verifying missing items**. The current process is time-consuming and involves significant manual effort, leading to inefficiencies.

---

## **🚨 Current Bottlenecks**

### **1️⃣ Handling Multiple Purchase Orders (Invoices)**

- The same or similar items are often ordered across multiple invoices.
- While tracking different invoices might be necessary for **special orders or ADS**, it **slows down the receiving process** without adding value to the receiver.

### **2️⃣ Verifying Missing Items is Time Consuming**

- When an item is flagged as **"missing"**, it may fall into one of these cases:
    1. **Scanned under a different invoice** (not truly missing).
    2. **Missed during scanning** (requires rescanning).
    3. **Actually missing** (short, mispick, replaced, etc.).
- Checking across **multiple invoices** to confirm whether an item is truly missing **takes excessive time**, especially if the item has already been stocked.

---

## **💡 Proposed Solution**

I developed a simple program called **InvoiceAuto** that automates the following tasks:

1. **Automatically distributes scanned items to their matching invoices**, reducing manual tracking.
2. **Consolidates surplus and missing items**, allowing receivers to **see, compare, and verify discrepancies in one step** instead of manually searching through invoices.

---

## **✅ Key Benefits**

### **🚀 Increased Speed & Efficiency**

✔ **Receivers can scan items into a single invoice** under the same account, reducing time spent navigating multiple invoices(unless scanning in the right invoice is otherwise necessary).

✔ **Eliminates the need to search for "missing" items** that were simply scanned under another invoice.

### **🎯 Improved Accuracy**

✔ **Simplifies discrepancy verification** caused by item number mismatches (e.g., Lacroix Hi-biscus misidentification).

✔ **Verifies missing items all at once**, reducing back-and-forth validation efforts.

✔ **Speeds up confirmation, increasing the chances of verifying missing items before they get stocked.**

---

## **⚠️ Important Cautions**

- **Each record must be manually checked as "verified."** While this program adjusts received quantities, the **verified flag cannot be modified** via imports and must be checked manually in Catapult.
- **Records of 0-ordered-0-received items must be removed manually.** Since imports do not allow record deletion, **these must be removed manually**. Typically, these items are moved to the **surplus list or other shorted records**, and all transactions can be found in `invoice_log.txt`.
- **Highly recommended to run this program after all scans are completed.** Any changes made after exporting **will not be reflected** in this program's results.

---

## **🛠 How to Use InvoiceAuto**

### **Step 1: Scan Received Items**

- Ideally, scan into the correct invoice, but **it does not matter if scanned elsewhere** (as long as  you don’t mis-stock something, like special orders).

### **Step 2: Export Purchase Orders**

- For all purchase orders shipped **today** (except **cheese** and **bulk**, which are paper-checked):
    - Open each purchase order.
    - Click **Export > Yes** and download the `.txt` files.

### **Step 3: Prepare the Files**

1. **Clear the `invoices/` folder** (prevents mixing invoices from previous days).
2. **Move all exported `.txt` files into the `invoices/` folder** (These are the invoices that are to be processed, but also acts as a backup in case of errors).

### **Step 4: Run InvoiceAuto**

- Execute `InvoiceAuto.exe`.
- The program will **list all found invoices** and prompt for confirmation:
    - If the list is correct, type `'y'`.
    - If incorrect, type `'n'` and update the `invoices/` folder.

### **Step 5: Review Generated Output Files**

- The program will create:
    - **`surplus.txt`** → Items **not used to fill missing orders** (over-scanned, over-shipped, or not ordered but received).
    - **`missing.txt`** → Items that **could not be matched with any surplus** (actual missing or scanning mistakes).
    - **`invoices_out/DONE-{P.O name}.txt`** → **Updated invoice files** ready for import into Catapult.

### **Step 6: Verify Missing Items**

- Review `missing.txt`, locate items, and confirm **before they get stocked**.
- 💡 **Example Issue Detection:**
    
    Some items may have **different item numbers between systems** (e.g., Lacroix Hi-biscus is **54458 in their system but 54459 in ours**).
    
    This **always results in a "missing" 54458 and a "surplus" 54459**.
    
    Comparing `surplus.txt` and `missing.txt` can **reveal such mismatches**.
    

### **Step 7: Import Updated Invoices into Catapult**

1. Open **Catapult** and select the **purchase order to process**.
2. Click **Import** > select the corresponding file from `invoices_out/`.
3. When prompted to **overwrite details**, select **'No'**.
4. You can disregard the system flags about **unrecognized items.**

### **Step 8: Complete the Purchase Order Confirmation**

- Once imported, **continue the normal confirmation process**:
    - ✅ Fill in **Alias, Terms, Receiver, Fuel Charges, Invoice Totals**.
    - ✅ Check **Verified** for items where **Shipped = Received**.
    - ✅ Write **Credit Memos** for any **shorted items**.
    - ✅ Confirm **new or replaced items**.

### Anything that happens in the process is logged into `invoice_log.txt`.

---

## **📌 Summary**

### **🚀 InvoiceAuto Helps:**

✔ **Speed up receiving** by allowing flexible scanning.

✔ **Automatically distribute scanned items** into the correct invoices.

✔ **Consolidate missing/surplus items** for easy verification.

✔ **Prevent unnecessary item searches** across invoices.

✔ **Increase accuracy** by catching mismatched item numbers.

✔ **Reduce manual effort** in confirming invoices in Catapult.

By implementing this program, we can **improve efficiency, reduce errors, and simplify the warehouse receiving process**.

---
> *This document was generated with assistance from ChatGPT.*

