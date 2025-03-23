const ROOT = "file:///C:/PATH_TO_FOLDER/temporary";

const CATAPULT_WORKSHEET_URL = `${ROOT}/WorksheetEditor`;
const CATAPULT_PO_URL_COMMON = `${ROOT}/purchaseOrder`;
const NAVIGATE_BTN_FIRST = {Id:"navigate_btn_first"};
const NAVIGATE_BTN_NEXT = {Id:"navigate_btn_next"};

const WORKSHEETS_CHECKBOXES = {XPath: "//*[@id='checkboxes_table']//td[1]/div/input[@type='checkbox']"};

const SAVE_BTN =  {getElement: ()=>{
    const qsall = document.querySelectorAll("#actionbar span");
    const target = Array.from(qsall).find(span => span.textContent === 'S');
    if (target) return target.parentElement;
}}; //q

const EXPORT_BTN = {getElement: ()=>{
    const qsall = document.querySelectorAll("#actionbar span");
    const target = Array.from(qsall).find(span => span.textContent === 'X');
    if (target) return target.parentElement;
}}; // querysel

const EXPORT_OK = {getElement: ()=>{
    const qsall = document.querySelectorAll("#popup_panel button");
    const target = Array.from(qsall).find(btn => btn.textContent === 'OK');
    return target;
}}; // querysel

const IMPORT_FILEINPUT = "#import_fileinput"; // querysel

const IMPORT_OK = {getElement: ()=>{
    const qsall = document.querySelectorAll("#popup_panel button");
    const target = Array.from(qsall).find(btn => btn.textContent === 'OK');
    return target;
}}; // querysel

const OVERWRITE_DETAILS = ".messageBox"; //q

const OVERWRITE_DETAILS_NO = {getElement: ()=>{
    const qsall = document.querySelectorAll(".messageBox button");
    const target = Array.from(qsall).find(btn => btn.textContent === 'No');
    return target;
}}; // q

const ITEMS_NOT_IMPORTED = ".popupContent"; //q

const ITEMS_NOT_IMPORTED_IGNORE = {getElement: ()=>{
    const qsall = document.querySelectorAll(".popupContent button");
    const target = Array.from(qsall).find(btn => btn.textContent === 'Close');
    return target;
}};//q



