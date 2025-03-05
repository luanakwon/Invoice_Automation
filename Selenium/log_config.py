import logging

# ✅ Create a global logger
logger = logging.getLogger("invoiceLogger")

# ✅ Set logging level
logger.setLevel(logging.INFO)

# ✅ Create a file handler (logs to a file)
file_handler = logging.FileHandler("InvAuto.log", encoding="utf-8")
file_handler.setLevel(logging.INFO)

# ✅ Define a log format
formatter = logging.Formatter(
    fmt = "%(asctime)s - %(levelname)s - %(message)s",
    datefmt = "%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(formatter)

# ✅ Add handlers to logger
logger.addHandler(file_handler)
