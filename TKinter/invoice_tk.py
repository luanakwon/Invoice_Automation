import tkinter as tk
from tkinter import ttk, messagebox

class InvoiceApp:
    def __init__(self, root, invoices, surplus_items, missing_items):
        self.root = root
        self.root.title("Invoice Processing")
        self.invoices = invoices
        self.surplus_items = surplus_items
        self.missing_items = missing_items
        self.current_missing_index = 0

        self.show_selected_invoices()

    def show_selected_invoices(self):
        """Step 1: Show selected invoices."""
        self.clear_window()
        tk.Label(self.root, text="Invoice Name", font=("Arial", 12, "bold")).pack()
        
        self.invoice_listbox = tk.Listbox(self.root, height=10, width=50)
        for invoice in self.invoices:
            self.invoice_listbox.insert(tk.END, invoice)
        self.invoice_listbox.pack()
        
        next_button = tk.Button(self.root, text="Next", command=self.confirm_invoice_selection)
        next_button.pack(pady=10)

    def confirm_invoice_selection(self):
        """Step 2: Confirmation popup before proceeding."""
        selected_invoices = self.invoices  # Show all listed invoices as selected
        response = messagebox.askyesno("Confirm", f"Total {len(selected_invoices)} invoices found. Would you like to continue?")
        if response:
            self.show_surplus_missing_items()

    def show_surplus_missing_items(self):
        """Step 3: Show Surplus and Missing Items."""
        self.clear_window()
        
        tk.Label(self.root, text="SURPLUS ITEMS", font=("Arial", 14, "bold")).pack()
        self.surplus_tree = self.create_surplus_table().pack()
        
        tk.Label(self.root, text="MISSING ITEMS", font=("Arial", 14, "bold")).pack()
        self.missing_tree = self.create_missing_table().pack()
        
        self.create_missing_input_fields()
    
    def create_table(self, data, columns, width):
        """Create a generic table with given columns."""
        tree = ttk.Treeview(self.root, columns=columns, show="headings")
        for col, w in zip(columns, width):
            tree.heading(col, text=col)
            tree.column(col, width=w)
        
        for row in data:
            tree.insert("", tk.END, values=row)
        
        return tree
    
    def cmt(self):
        """Create a table for missing items without input fields."""
        frame = ttk.Frame(self.root)
        columns = ["Invoice No", "SUID", "UPC", "Shipped", "Received", "Receipt Alias", "Remark"]
        self.missing_tree = ttk.Treeview(frame, columns=columns, show="headings")
        for col in columns:
            self.missing_tree.heading(col, text=col)
            self.missing_tree.column(col, width=100)
        
        for row in self.missing_items:
            self.missing_tree.insert("", tk.END, values=row)
        
        self.missing_tree.pack()
        return frame
    
    def create_surplus_table(self):
        columns = ["Invoice No", "SUID", "UPC", "Shipped", "Received", "Receipt Alias", "Remark"]
        width = [100,100,100,100,100,100,100]
        tree = self.create_table(self.surplus_items, columns, width)
        return tree

    def create_missing_table(self):
        columns = ["Invoice No", "SUID", "UPC", "Shipped", "Received", "Receipt Alias", "Remark"]
        width = [100,100,100,100,100,100,100]
        tree = self.create_table(self.missing_items, columns, width)
        return tree
    
    def create_missing_input_fields(self):
        """Create input fields at the bottom for modifying missing items."""
        frame = ttk.Frame(self.root)
        frame.pack(pady=10)

        self.current_missing = tk.StringVar(value="")
        self.received_entry = tk.Entry(frame)
        self.remark_var = tk.StringVar(value="none")
        remark_dropdown = ttk.Combobox(frame, textvariable=self.remark_var, values=["none", "short", "other"], width=10)

        tk.Label(frame, textvariable=self.current_missing, font=("Arial", 12, "bold")).pack()
        self.received_entry.pack()
        remark_dropdown.pack()

        apply_button = tk.Button(frame, text="Apply", command=self.apply_missing_changes)
        apply_button.pack()

        self.load_next_missing()

    def load_next_missing(self):
        """Load the next missing item into the input fields."""
        if self.current_missing_index < len(self.missing_items):
            missing_item = self.missing_items[self.current_missing_index]
            self.current_missing.set(f"Invoice: {missing_item[0]}, SUID: {missing_item[1]}, UPC: {missing_item[2]}")
            self.received_entry.delete(0, tk.END)
            self.received_entry.insert(0, missing_item[4])
            self.remark_var.set("none")
        else:
            self.confirm_final_changes()
    
    def apply_missing_changes(self):
        """Apply changes and load the next missing item."""
        received_qty = self.received_entry.get()
        remark = self.remark_var.get()
        
        if not received_qty.replace('.', '', 1).isdigit():
            messagebox.showwarning("Invalid Input", "Received quantity must be a number.")
            return
        
        self.missing_items[self.current_missing_index][4] = received_qty
        self.missing_items[self.current_missing_index][6] = remark
        self.current_missing_index += 1
        self.load_next_missing()
    
    def confirm_final_changes(self):
        """Step 4: Final confirmation before processing invoices."""
        response = messagebox.askyesno("Confirm", "Do you confirm these changes? Once confirmed it will be reflected in the system.")
        if response:
            self.show_completion_message()
    
    def show_completion_message(self):
        """Step 5: Show final instructions."""
        self.clear_window()
        tk.Label(self.root, text="Invoice confirmation process is done.", font=("Arial", 12)).pack()
        tk.Label(self.root, text="You can push the result to the Catapult system by importing the resulted text files.").pack()
        tk.Label(self.root, text="Afterwards, please confirm the following manually:").pack()
        
        items = ["worksheet alias", "receiver", "terms", "new items", "replaced items", "mispicks", "claims and credit memos", "numbers (fuel charge, bottle tax, and total)"]
        for item in items:
            tk.Label(self.root, text=f"- {item}").pack()
        
    def clear_window(self):
        """Clear all widgets before showing new content."""
        for widget in self.root.winfo_children():
            widget.destroy()

# Example Data
invoices = ["UNFICHEESE - INV# 016163398003", "UNFIDAIRY - INV# 016163287003"]
surplus_items = [["PO1", "11039", "081312400306", 5, 10, "Cheese 1kg",""],
                 ["PO2", "12586", "810067101316", 2, 5, "Milk 2L",""]]
missing_items = [["INV# 016163287003", "66642", "30871000021", 6, "", "Tofu 16oz",""],
                 ["INV# 016163354003", "96964", "42272014286", 1, "", "Cereal 500g",""]]

root = tk.Tk()
app = InvoiceApp(root, invoices, surplus_items, missing_items)
root.mainloop()
