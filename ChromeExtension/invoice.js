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
            if (!line.includes(',')){
                console.log(line);
                console.log(index);
                console.log(line.split(','));
            }
            if (index === 2) {
                this.worksheetInfo = line.split(',');
            } else if (index >= 4) {
                let record = line.split(',');
                if (record && record.length >= RECORD_VFFLAG) {
                    for (const idx of [RECORD_RECQTY, RECORD_SHPQTY]) {
                        if (record[idx] === ''){
                            record[idx] = -1;
                        } else {
                            record[idx] = parseFloat(record[idx]);
                        }
                    }
                    console.log(record);
                    this.records.push(record);
                }
            }
        });

        this.len = this.records.length;
    }

    // override .length
    get length() {
        return this.len;
    }

    // format to txt method
    toTxt() {
        try{
            console.log(this.records);

        var records_txt = '';
        this.records.forEach((record) => {
            if (record !== null) {
                // copy record to prevent changing the original record
                let record_cp = record.slice();
                // replace -1 with ''
                for (const idx of [RECORD_RECQTY, RECORD_SHPQTY]) {
                    if (record_cp[idx] === -1) {
                        record_cp[idx] = '';
                    } 
                    // replace number to string of .3f
                    else {
                        record_cp[idx] = record_cp[idx].toFixed(3);
                    }
                }
                console.log(record_cp);
                records_txt += '\n' + record_cp.join(',');
            }    
        });

        } catch (err) {
            console.log(err);
            
            
            console.log(records_txt);
            noSuchFunction();
        }

        // if no records, return empty string
        if (records_txt === '') {
            return '';
        }

        // add worksheet info
        var txt = 'Purchase Order \n[WorkSheetInfo]\n';
        txt += this.worksheetInfo.join(',') + '\n';
        txt += '[Records]';

        return txt + records_txt;
    }
}