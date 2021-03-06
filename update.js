import ApiClient from './api_client';
import shell from 'shelljs';
const TENANT = process.env.TENANT
const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address").replace(/\n/g, '')
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT
const PLATFORM = process.env.PLATFORM



let api_client = new ApiClient(GRAPHQL_ENDPOINT,MAC_ADDRESS)
api_client.subscribeExecuteAction(function(action){
  execute_cmd(action)
})


function execute_cmd(action){

  switch (action) {
    case "update":
      deleteOldScript()
      update()
      break;
    case "getLogs":
      shell.exec(`curl --upload-file ./iptv-client.log https://transfer.sh/${MAC_ADDRESS}.log` , function(code,stdout,stderr){
        if(code != 0 ) api_client.sendNotificationMutation("error", stderr)
        else {
          api_client.sendNotificationMutation("info", stdout)
        }
      })
      break;

    case "deleteLogs":
      shell.exec("pm2 flush",{silent: true})
      break;

    default:
      break;

  }
}



function update(){
  api_client.sendNotificationMutation("info", "Se esta actualizando el receptor")
  shell.exec("pm2 delete iptv-client")//se elimina para poder actualizar sus configuraciones
  shell.exec("pm2 start ecosystem.config.js --only iptv-client --env production")
  shell.exec("rm -rf /home/pi/Documents/production/source/.git/index.lock")
  shell.exec("cd /home/pi/Documents/production/current && git reset --hard")
  shell.exec("pm2 deploy ecosystem.config.js production --force",function(code, stdout, stderr) {
    if(code != 0){
      api_client.sendNotificationMutation("error", `Error al actualizar ${stderr}`)
      api_client.createLogMutation("error", `Error al actualizar ${stderr}`)
      shell.exec("sudo reboot now")
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
