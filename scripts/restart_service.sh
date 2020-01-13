#!/bin/bash

sudo cp /home/pi/Documents/production/current/services/maintenance.service /etc/systemd/system/maintenance.service
sudo systemctl start maintenance.service
sudo systemctl enable maintenance.service
systemctl daemon-reload