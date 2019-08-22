DIR=/home/pi/Documents
echo "descargando dependencias"
wget -P $DIR/ https://nodejs.org/dist/v10.15.3/node-v10.15.3-linux-armv7l.tar.xz
tar -xvf $DIR/node-v10.15.3-linux-armv7l.tar.xz
echo "copiando archivos a la /usr/local"
cd $DIR/node-v10.15.3-linux-armv7l/ && sudo cp -R * /usr/local/
#rm $DIR/node-v10.15.3-linux-armv7l.tar.xz
#rm -r $DIR/node-v10.15.3-linux-armv7l
echo "instalndo pm2"
sudo npm i -g pm2
echo "instalando yarn"
sudo npm i -g yarn
echo "clonando iptv client"
git clone http://159.89.43.103/tvstream/iptv-client.git $DIR/iptv-client
cd $DIR/iptv-client && pm2 deploy ecosystem.config.js production setup
cd $DIR/iptv-client && pm2 deploy ecosystem.config.js production  --force

echo "configurando pm2 procesos para iniciar con el sistema"
pm2 startup systemd
sudo env PATH=$PATH:/usr/local/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi

echo "limpiando directorio"
rm $DIR/node-v10.15.3-linux-armv7l.tar.xz
rm -r $DIR/node-v10.15.3-linux-armv7l


echo "eliminando libreoffice y wolfram"
sudo apt-get -y remove --purge libreoffice*
sudo apt-get -y remove --purge wolfram*

echo install teamviewer
sudo rm -rf /var/lib/apt/lists/*
sudo apt-get update
wget -P $DIR/ https://download.teamviewer.com/download/linux/teamviewer-host_armhf.deb
sudo apt install -y $DIR/teamviewer-host_armhf.deb
sudo teamviewer passwd 9981532121
