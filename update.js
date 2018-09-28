import ApiClient from './api_client';
import shell from 'shelljs';
const TENANT = process.env.TENANT
const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address").replace(/\n/g, '')
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT
const PLATFORM = process.env.PLATFORM



let api_client = new ApiClient(GRAPHQL_ENDPOINT,TENANT,MAC_ADDRESS)
subscriptions()


function subscriptions(){
  api_client.subscribeExecuteAction(function(action){
    execute_cmd(action)
  })
}

function execute_cmd(action){

  switch (action) {
    case "update":
      deleteOldScript()
      update()
      break;
    case "startupConfig":
      startup()//eliminar al actualizar dispositivos
      break;
    default:
      break;

  }
}

function startup(){
  shell.exec('pm2 unstartup')
  shell.exec('sudo env PATH=$PATH:/home/pi/.nvm/versions/node/v9.11.2/bin /home/pi/.nvm/versions/node/v9.11.2/lib/node_modules/pm2/bin/pm2 unstartup systemd -u pi --hp /home/pi')
  shell.exec('pm2 startup systemd')
  shell.exec('sudo env PATH=$PATH:/home/pi/.nvm/versions/node/v9.11.2/bin /home/pi/.nvm/versions/node/v9.11.2/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi')

}

function update(){
  console.log("update")
  shell.exec("rm -rf /home/pi/Documents/production/source/.git/index.lock")
  shell.exec("pm2 deploy ecosystem.config.js production --force",function(code, stdout, stderr) {
    if(code != 0){
      api_client.sendNotificationMutation("error", `Error al actualizar ${stderr}`)
      api_client.createLogMutation("error", `Error al actualizar ${stderr}`)
    }
    else {
      console.log("se actualizo correctamente la aplicacion.")
      api_client.createLogMutation("success", "Se actualizo correctamente el dispositivo.")
    }
  })
}

function deleteOldScript(){
  shell.exec("sudo rm -rf /home/pi/Documents/scripts")
  shell.exec("sudo rm -rf /etc/init.d/player.sh")
  shell.exec("sudo  sed -i '/public_ip/d' /var/spool/cron/crontabs/root")
  shell.exec("sudo sed -i '/watch/d' /etc/rc.local")
}
