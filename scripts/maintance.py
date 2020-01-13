#! /usr/bin/env python

import os.path
import os
import time
from datetime import datetime

def current_time():
    datetime.now().strftime("%H:M")
    

def restart():
    if current_time() == "23:30": 
        remount()
        set_teamviewer_pass()
        os.system("sudo reboot now")

def remount():
    os.system("sudo mount -o remount, rw /")

def set_teamviewer_pass():
    os.system("sudo teamviewer passwd 9981532121")



while True: 
    restart()
    time.sleep(60)
    print(datetime.now())


