import tkinter as tk
from tkinter import ttk, messagebox

class InvoiceSelectorApp:
    def __init__(self, root, invoices):
        self.root = root
        self.root.title("Invoice Selection")

        # Store invoice data
        self.invoices = invoices
        self.selected_invoices = []

        # Create frame for treeview and scrollbar
        frame = ttk.Frame(root)
        frame.pack(pady=10, padx=10, expand=True, fill="both")

        # Create Treeview
        self.tree = ttk.Treeview(frame, columns=("Select", "Invoice Number", "Order ID"), show="headings")
        self.tree.heading("Select", text="✔")
        self.tree.heading("Invoice Number", text="Invoice Number")
        self.tree.heading("Order ID", text="Order ID")

        # Create checkboxes
        self.check_vars = []
        for inv in invoices:
            var = tk.BooleanVar()
            self.check_vars.append(var)
            self.tree.insert("", "end", values=("⬜", inv["invoiceNumber"], inv["orderId"]))

        self.tree.bind("<ButtonRelease-1>", self.toggle_checkbox)  # Bind checkbox click event
        self.tree.pack(side="left", fill="both", expand=True)

        # Add scrollbar
        scrollbar = ttk.Scrollbar(frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscroll=scrollbar.set)
        scrollbar.pack(side="right", fill="y")

        # Confirmation button
        confirm_button = tk.Button(root, text="Confirm Selection", command=self.confirm_selection)
        confirm_button.pack(pady=5)

    def toggle_checkbox(self, event):
        """Toggle checkbox state in Treeview"""
        item = self.tree.identify_row(event.y)  # Identify clicked row
        if not item:
            return

        index = self.tree.index(item)
        if self.check_vars[index].get():
            self.check_vars[index].set(False)
            self.tree.item(item, values=("⬜", self.invoices[index]["invoiceNumber"], self.invoices[index]["orderId"]))
        else:
            self.check_vars[index].set(True)
            self.tree.item(item, values=("✅", self.invoices[index]["invoiceNumber"], self.invoices[index]["orderId"]))

    def confirm_selection(self):
        """Retrieve selected invoices and ask for confirmation"""
        self.selected_invoices = [
            self.invoices[i]["invoiceNumber"]
            for i, var in enumerate(self.check_vars) if var.get()
        ]

        if not self.selected_invoices:
            messagebox.showwarning("No Selection", "Please select at least one invoice.")
            return

        confirm = messagebox.askyesno("Confirm", f"Proceed with updating these invoices?\n{self.selected_invoices}")
        if confirm:
            self.root.quit()  # Close GUI, proceed with updates

def select_invoices_gui(invoices):
    root = tk.Tk()
    app = InvoiceSelectorApp(root, invoices)
    root.mainloop()
    return app.selected_invoices  # Return selected invoices

if __name__ == "__main__":
        

    # Example Usage
    invoices = [
        {"invoiceNumber": "INV-123", "orderId": "PO-1001"},
        {"invoiceNumber": "INV-456", "orderId": "PO-1002"},
    ]
    selected = select_invoices_gui(invoices)
    print("Selected Invoices:", selected)  # Proceed with processing
