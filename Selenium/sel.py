import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import InvoiceOrganizer
from log_config import logger
from catapult_elements import *
        
def set_download_dir(dirpath) -> webdriver.ChromeOptions:
    download_dir = os.path.abspath(dirpath)  # Change to your invoices folder

    chrome_options = webdriver.ChromeOptions()
    prefs = {
        "download.default_directory": download_dir,
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True
    }
    chrome_options.add_experimental_option("prefs", prefs)
    chrome_options.add_experimental_option("detach", True)  # Keep browser open

    logger.info(f"chrome download folder set to {download_dir}")
    return chrome_options

def inject_select_and_continue(driver):
    driver.execute_script("""
        window.continueFlag = false;
        var msg = document.createElement("div");
        msg.setAttribute("id","invauto_injected_popup");
        msg.innerHTML = "<h3>Select the invoices you'd like to work on, then click 'Continue' </h3>";
        msg.style.position = "fixed";
        msg.style.top = "10px";
        msg.style.right = "10px";
        msg.style.zIndex = "9998";
        msg.style.backgroundColor = "yellow";
        msg.style.padding = "10px";
        msg.style.width = "580px"; 
        document.body.appendChild(msg);

        var btn = document.createElement("button");
        btn.innerHTML = "Continue";
        btn.style.display = "block";  
        btn.style.marginLeft = "auto"; 
        btn.style.marginTop = "10px";  
        btn.style.width = "160px"; 
        btn.style.height = "40px";
        btn.style.zIndex = "9999";
        btn.onclick = function() { window.continueFlag = true; };
        msg.appendChild(btn);
    """)
    logger.info("Select-and-continue button injected")
    

def foo():    
    # Set Chrome download preferences
    download_dir = "./invoices"
    chrome_options = set_download_dir(download_dir)

    # Open Catapult
    driver = webdriver.Chrome(options=chrome_options)
    driver.get(CATAPULT_MAIN_URL)
    logger.info(f"redirecting to {driver.current_url}")

    # wait for the user log-in
    try:
        is_logged_in = True # if is already logged in, the login might never pop up.
        # first wait for the login to pop up
        WebDriverWait(driver, 3).until(EC.presence_of_all_elements_located(LOGIN_POPUP))
        is_logged_in = False # login popped up, meaning we are not logged in.
        # wait for the user to log in to catapult.
        WebDriverWait(driver, 300).until_not(EC.presence_of_element_located(LOGIN_POPUP))
        is_logged_in = True
        logger.info("✅ Login detected")
        
        # ✅ 4. Navigate to Worksheets & Select 'Purchase Order'
        driver.get(CATAPULT_WORKSHEET_URL)
        logger.info(f"redirecting to {driver.current_url}")

    except TimeoutException:
        if is_logged_in: # timeout occurred before login popup
            logger.info("seems like we are already logged in.")
        else: # timeout occurred while waiting for user log in.
            logger.info("login not detected in 5 minutes. Exiting program")
            return  

    # often times worksheetEditor does not load any kind of worksheet until being refreshed.
    # Therefore, force refresh to load content
    driver.refresh()
    # Wait 10 times, for 10s each, for dropdown to appear
    for attempts in range(10):
        try:
            WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable(WORKSHEETS_DROPDOWN)
            )
            logger.info(f"{driver.current_url} loaded successfully.")
            break
        except TimeoutException:
            logger.info(f"({attempts}) unable to load the P.O. worksheet Editor. Please manually open worksheets to continue.")
            if attempts == 9:
                raise AssertionError("failed loading worksheet Editor after 10 attempts.")

    # click and open the dropdown
    dropdown = driver.find_element(*WORKSHEETS_DROPDOWN)
    dropdown.click()  # Open dropdown
    
    # Select 'Purchase Order' option
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located(WOKRSHEETS_DROPDOWN_PO_OPTION)
    )
    driver.find_element(*WOKRSHEETS_DROPDOWN_PO_OPTION).click()

    # wait for the purchaseOrder page to load
    # detect it by looking at the links to each P.O.
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located(PO_HREF_COMMON))
    logger.info("Successfully loaded purchase Order worksheet")

    # ✅ 5. Inject JavaScript for User Invoice Selection
    inject_select_and_continue(driver)
    
    # export invoices after user confirmation
    # try 100 attempts of re-confirmation
    for _ in range(100):
        # ✅ 6. Wait for user confirmation by constantly checking the window.continueFlag;
        flag = False
        for attempts in range(1000):
            if driver.execute_script("return window.continueFlag === false;"):
                time.sleep(1)
            else:
                flag = True
        if not flag: # selecting invoices took too long -> quit
            raise TimeoutError("exited from loop after 1000 attempts of continueFlag===true")

        # ✅ 7. Gather selected invoices (handle pagination)
        # start from the first page
        first_button = driver.find_element(*NAVIGATE_BTN_FIRST)
        if first_button.is_enabled():
            first_button.click()
            WebDriverWait(driver,10).until_not(EC.element_to_be_clickable(first_button))
            logger.info("starting from the first page of P.Os table")
        
        selected_invoices = []
        for page in range(100):
            checkboxes = driver.find_elements(*WORKSHEETS_CHECKBOX)  # Modify XPATH if needed
            for checkbox in checkboxes:
                if checkbox.is_selected():
                    row = checkbox.find_element(By.XPATH, "./ancestor::tr[1]")
                    invoice_name = row.find_element(By.XPATH, ".//td[2]//a").text 
                    invoice_link = row.find_element(By.XPATH, ".//td[2]//a").get_attribute("href")
                    selected_invoices.append((invoice_name, invoice_link))
            
            # load next page of P.Os table
            next_button = driver.find_elements(*NAVIGATE_BTN_NEXT)
            if next_button:
                if next_button[0].is_enabled():
                    next_button[0].click()
                    time.sleep(1)  # Allow page to load
                else:
                    # no more pages to navigate
                    break
            else:
                break  # no next button

            if page >= 100:
                logger.warning("invoice selection interrupted after page 100")

        # log the selected(ready to be exported) invoices
        msg = "selected invoices:\n"
        for name, link in selected_invoices:
            msg += f"name: {name}\n"
            msg += f"link: {link}\n"
        logger.info(msg)
        
        # ✅ 8. Confirm selection before proceeding (Web Popup)
        driver.execute_script(
            f"""
            window.confirmSelection = false;
            window.confirmSelection = window.confirm('{len(selected_invoices)} invoices selected. Would you like to continue?');
            """
        )
        # wait for the popup to appear
        WebDriverWait(driver, 30).until(EC.alert_is_present())
        # wait for the popup to disappear(either user confirmed or canceled)
        WebDriverWait(driver, 300).until_not(EC.alert_is_present())
        # if user confirmed the selected invoics, proceed
        if driver.execute_script("return window.confirmSelection;"):
            logger.info("confirmed to proceed(export) with the selection")
            driver.execute_script("document.getElementById('invauto_injected_popup')?.remove();")
            break
        # if user canceled the selected invoices, re-select.
        else:
            logger.info("canceled, re-selecting...")
            driver.execute_script("window.continueFlag = false;")
            continue

    # ✅ 9. Export Selected Invoices
    invoice_map = {}  # Save invoice name:link mapping
    for invoice_name, invoice_link in selected_invoices:
        invoice_map[invoice_name] = invoice_link
        # open each invoices via link
        driver.get(invoice_link)
    
        try:
            # wait for the invoice to load (export is enabled)
            WebDriverWait(driver, 10).until(EC.presence_of_element_located(EXPORT_BTN))
            # click export
            driver.find_element(*EXPORT_BTN).click()
            
            # Confirm export
            WebDriverWait(driver, 10).until(EC.presence_of_element_located(POPUP_COMMON))
            driver.find_element(*EXPORT_OK).click()

            logger.info(f"✅ Exported: {invoice_name}")
        except TimeoutException:
            logger.info(f"Timeout occurred while exporting {invoice_name}. Skipping.")
            continue

        # ✅ 10. Wait for download to complete
        download_wait_attempts = 0
        while not any(fname.endswith(f"{invoice_name}.txt") for fname in os.listdir(download_dir)):
            time.sleep(1)
            download_wait_attempts += 1
            if download_wait_attempts > 1000:
                raise TimeoutError(f"timeout while waiting for {invoice_name} to be downloaded.")

    # organize downloaded invoices
    # this will result the following files:
    # ./surplus.html
    # ./missing.html
    # ./invoices_out/DONE_{invoice_name}.txt
    InvoiceOrganizer.run(
        [name for name,link in selected_invoices],
        "./invoices", 
        "./invoices_out", 
        'html'
    )

    # ✅ 11. Ask if the user wants to update the system (Web Popup)
    driver.execute_script(
        f"""
        window.confirmImport = false;
        window.confirmImport = window.confirm('Would you also like to update your system?');
        """
    )
    # wait for the popup to appear
    WebDriverWait(driver, 30).until(EC.alert_is_present())
    # wait for the user to confirm or cancel the popup
    WebDriverWait(driver, 300).until_not(EC.alert_is_present())
    # import invoices if user confirmed
    if driver.execute_script("return window.confirmImport;"):
        for invoice_name, invoice_link in invoice_map.items():
            done_file = f"./invoices_out/DONE_{invoice_name}.txt"
            if os.path.exists(done_file):
                # Open invoice page
                driver.get(invoice_link)  
                # import via file input element
                importUploaderCont = driver.find_element(*IMPORT_FILEINPUT)
                importUploaderCont.find_element(By.XPATH, ".//input[@type='file']").send_keys(os.path.abspath(done_file))

                # Handle import format popup
                try:
                    WebDriverWait(driver, 5).until(EC.presence_of_element_located(POPUP_COMMON))
                    logger.info(f"page successfully detected a file input. importing {done_file}..")
                    driver.find_element(*IMPORT_OK).click()
                except TimeoutException:
                    logger.error(f"Timeout while waiting format popup")
                    logger.info(f"Timeout occurred while importing {done_file}. skipping..")
                    continue

                # wait import
                ## where import actually happens(1~2s) ##

                # Handle "Overwrite Details?" popup
                try:
                    WebDriverWait(driver, 120).until(EC.presence_of_element_located(OVERWRITE_DETAIL_POPUP))
                    driver.find_element(*OVERWRITE_DETAIL_POPUP).find_element(By.XPATH, "//button[text()='No']").click()
                    
                    logger.info(f"✅ Imported: {invoice_name}")
                except TimeoutException:
                    logger.error(f"Timeout while waiting overwrite popup")
                    logger.info(f"Timeout occurred while importing {done_file}. skipping..")
                    continue
        
                # ✅ Handle Items Not Imported popup
                try:
                    WebDriverWait(driver, 1).until(EC.presence_of_element_located(ITEM_NOT_IMPORTED_POPUP)) 
                    items_not_imported = driver.find_element(*ITEM_NOT_IMPORTED_POPUP)
                    items_not_imported.find_element(By.XPATH, "//button[text()='Close']").click()
                    logger.info("few items not imported (ignored)")
                except TimeoutException:
                    logger.info("every items are imported")

                # ✅ 12. Save worksheet and wait for it to complete
                save_btn = driver.find_element(*SAVE_BTN)
                if save_btn.is_enabled():
                    save_btn.click()
                    WebDriverWait(driver, 20).until_not(EC.element_to_be_clickable(save_btn))
                    logger.info(f"✅ Imported and saved {invoice_name}")
                else:
                    logger.info(f"nothing to save with {invoice_name}")
            else:
                logger.info(f"{done_file} does not exist")
    else:
        logger.info("import process dismissed")

    # ✅ 13. Leave Missing.html, Surplus.html Open
    js_abspath = lambda p: os.path.abspath(p).replace("\\","/")
    driver.get(f"file:///{js_abspath('missing.html')}")
    driver.execute_script(f"window.open(\"file:///{js_abspath('surplus.html')}\");")

    logger.info("✅ Automation complete. Leaving pages open.")

if __name__ == "__main__":
    try:
        foo()
    except BaseException as err:
        logger.error(f"Error Occurred : {err}")
