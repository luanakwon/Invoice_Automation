const WORKSHEETINFO_NAME = 0
const WORKSHEETINFO_INVNO = 16
const WORKSHEETINFO_DATEREC = 25
const WORKSHEETINFO_REMARK = 27 // idk + idk what to do with commas in the remark

const RECORD_SUID = 0
const RECORD_RECEIPTALIAS = 1
const RECORD_UPC = 2
const RECORD_UNIT = 4	
const RECORD_RECQTY = 5
const RECORD_SHPQTY = 38
const RECORD_VFFLAG = 39

class Invoice {
    constructor(txt_content){
        this.worksheetInfo = null;
        this.records = [];
        
        const lines = txt_content.split('\n');
        lines.forEach((line, index) => {
            if (index === 2) {
                this.worksheetInfo = line.split(',');
            } else if (index >= 4) {
                var record = line.split(',');
                for (idx in [RECORD_RECQTY, RECORD_SHPQTY]) {
                    if (record[idx] === ''){
                        record[idx] = -1;
                    } else {
                        record[idx] = parseFloat(record[idx]);
                    }
                }
                this.records.push(record);
            }
        });

        this.len = self.records.length;
    }

    // override .length
    get length() {
        return this.len;
    }

    // format to txt method
    toTxt() {
        var records_txt = '';
        this.records.forEach((record) => {
            if (record !== null) {
                // copy record to prevent changing the original record
                let record_cp = record.slice();
                // replace -1 with ''
                for (idx in [RECORD_RECQTY, RECORD_SHPQTY]) {
                    if (record_cp[idx] === -1) {
                        record_cp[idx] = '';
                    } 
                    // replace number to string of .3f
                    else {
                        record_cp[idx] = record_cp[idx].toFixed(3);
                    }
                }
            }
            records_txt += record.join(',');
        });

        // if no records, return empty string
        if (records_txt === '') {
            return '';
        }

        // add worksheet info
        var txt = 'Purchase Order \n[WorkSheetInfo]\n';
        txt += this.worksheetInfo.join(',');
        txt += '[Records]\n';

        return txt + records_txt;
    }
}