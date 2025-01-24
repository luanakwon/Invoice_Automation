
WORKSHEETINFO_NAME = 0
WORKSHEETINFO_INVNO = 16
WORKSHEETINFO_DATEREC = 25
WORKSHEETINFO_REMARK = 27 # idk + idk what to do with commas in the remark

RECORD_SUID = 0
RECORD_RECEIPTALIAS = 1
RECORD_UPC = 2
RECORD_UNIT = 4	
RECORD_RECQTY = 5
RECORD_SHPQTY = 38
RECORD_VFFLAG = 39

import os

class Invoice:
    def __init__(self, txt_fp):

        self.worksheetInfo = None
        self.records = []

        if not os.path.exists(txt_fp):
            raise FileNotFoundError(f"Invoice file {txt_fp} not found")
        with open(txt_fp, 'r') as f:
            for i, line in enumerate(f.readlines()):
                if i == 2:
                    self.worksheetInfo = line.split(',')
                elif i >= 4:
                    record = line.split(',')
                    for idx in (RECORD_RECQTY,RECORD_SHPQTY):
                        if record[idx] == '':
                            record[idx] = -1
                        else:
                            record[idx] = float(record[idx])
                    self.records.append(record)

        self.len = len(self.records)

    def __len__(self):
        return self.len
    
    def save_to_txt(self, filepath):
        with open(filepath, 'w') as f:
            f.write("Purchase Order\n[WorkSheetInfo]\n")
            f.write(','.join(self.worksheetInfo))
            f.write('[Records]\n')
            for record in self.records:
                if record is not None:
                    record_cp = record[:]
                    for idx in (RECORD_RECQTY,RECORD_SHPQTY):
                        if record_cp[idx] == -1:
                            record_cp[idx] = ''
                        else:
                            record_cp[idx] = f'{record_cp[idx]:.03f}'
                    f.write(','.join(record_cp))

