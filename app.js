import shell from 'shelljs';
import schedule from 'node-schedule';
import omxp from 'omxplayer-controll';
import speedTest from 'speedtest-net';
import ApiClient from './api_client';


var opts = {
    'audioOutput': 'local', //  'hdmi' | 'local' | 'both'
    'blackBackground': true, //false | true | default: true
    'disableKeys': true, //false | true | default: false
    'disableOnScreenDisplay': true, //false | true | default: false
    'disableGhostbox': true, //false | true | default: false
    'startVolume': 1.0 ,//0.0 ... 1.0 default: 1.0,
    'closeOtherPlayers': true
};



const TENANT = process.env.TENANT
const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address").replace(/\n/g, '')
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT
const PLATFORM = process.env.PLATFORM
const PUBLIC_IP_SERVICE = process.env.PUBLIC_IP_SERVICE
const SECONDARY_PUBLIC_IP_SERVICE = process.env.SECONDARY_PUBLIC_IP_SERVICE
const SCRIPT_VERSION = process.env.SCRIPT_VERSION


let api_client = new ApiClient(GRAPHQL_ENDPOINT,TENANT, MAC_ADDRESS)
subscriptions()
api_client.playbackPlayerMutation(PLATFORM)
api_client.updateDeviceMutation(getPlayerDevice())

function subscriptions(){
  //subscripcion para reproducir
  api_client.subscribePlayback(function(params){
    playback(params)
  })
  api_client.subscribeExecuteAction(function(action){
    execute_cmd(action)
  })

}

function execute_cmd(action){
  switch (action) {
    case "restart":
      restart()
      break;

    case "stop":
      shell.exec('sudo killall -s 9 omxplayer')
      shell.exec('sudo killall -s 9 omxplayer.bin')
      break;

    case "updateApp":
      shell.exec("pm2 start ecosystem.config.js --only update_worker --env production",{silent: true})
      api_client.sendNotificationMutation("info", "configurando es startup")
      shell.exec('pm2 save',{silent: true})
      update()//eliminar el case despues de actualizar
      //
      break;

    case "upUpdateService":
      shell.exec("pm2 start ecosystem.config.js --only update_worker --env production")
      break;

    case "takeScreenshot":
      screenShoot()
      break;
    case "speedTest":
      runSpeedTest()
      break;

    default:
      // if(action != "update") api_client.sendNotificationMutation("error", "Accion no implementada")
      break;
  }
}

//eliminar
function update(){
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

function restart(){
  // api_client.createLogMutation("success","Se reinicio correctamente el dispositivo.")
  shell.exec('sudo reboot now' )
}


function screenShoot(){
  if (!shell.which('raspi2png')) {
    shell.echo('Instalando raspi2png');
    shell.exec("curl -sL https://raw.githubusercontent.com/AndrewFromMelbourne/raspi2png/master/installer.sh | bash -")
  }
  shell.exec("raspi2png -p screenshot.png", function(code,stout,stderr){
    let imageUrl = shell.exec(`curl --upload-file ./screenshot.png https://transfer.sh/screenshot.png` , {silent:true}).stdout
    api_client.takeScreenshotMutation(imageUrl)
  })
}

function verifyStatus(){
  isPlayback(function(isActive){
    if(isActive) api_client.statusMutation("active")
    else api_client.statusMutation("inactive")
  })
}


function playback(params){
  if(params.error){
    shell.echo(params.error)
    api_client.sendNotificationMutation("error", params.error)
    api_client.createLogMutation("error", params.error)
  }
  else{
    omxp.open(params.url,opts)
    api_client.createLogMutation("info", `url a reproducir: ${params.url}`)

  }
}
function runSpeedTest(){
  if (!shell.which('speedtest-cli')){
    shell.exec("sudo apt install speedtest-cli")
  }
  let child_speed = shell.exec("speedtest-cli --json", function(code, stdout, stderr){
    if(code != 0) api_client.createLogMutation("error", stderr)
    else {
      api_client.speedTestMutation(JSON.parse(stdout))
    }
  });
}



function getPlayerDevice(){
  let ip_details ={}
  try {
    ip_details = JSON.parse(shell.exec(`curl -s ${PUBLIC_IP_SERVICE}`, {silent:true}).stdout)
    return {
      macAddress: MAC_ADDRESS,
      scriptVersion: SCRIPT_VERSION,
      ip: ip_details.query,
      location: `${ip_details.countryCode}-${ip_details.city}-${ip_details.regionName}-${ip_details.timezone}`
    }
  }
  catch(err) {
    console.log(err)
  }
  if(!ip_details.city){
    try {
        ip_details = JSON.parse(shell.exec(`curl -s ${SECONDARY_PUBLIC_IP_SERVICE}`, {silent:true}).stdout)
        return {
          macAddress: MAC_ADDRESS,
          ip: ip_details.ip,
          location: `${ip_details.country}-${ip_details.city}-${ip_details.region}`
      }
    }
      catch (err) {
        console.log(err)
      }
    }
  else{
    return {
      macAddress: MAC_ADDRESS
    }
  }
}

function isPlayback(callback){
  let isPlayback  = false
  try {
    omxp.getStatus(function(err, status){
      if(err) console.log(err)
      else if(status === "Playing") isPlayback = true
      callback(isPlayback)
    })
  } catch (err) {
    console.log(err)
    let process = shell.exec('ps -A | grep -c omxplayer',{silent:true}).stdout.replace(/\n/g, '')
    if(process > 0) callback(true)
    else callback(false)
  }
}


omxp.on('finish', function() {
  api_client.createLogMutation("info", 'se detuvo la reproduccion')
  verifyStatus()
  api_client.playbackPlayerMutation(PLATFORM)
});

setInterval(function(){ api_client.updateDeviceMutation(getPlayerDevice()); }, 20 * 60000);// cada 10 minutos
setInterval(function(){ shell.exec("pm2 restart iptv-client") }, 8 * 60 * 60000)// cada 6 hrs
// setInterval(function(){ verifyStatus() }, 5000);

setInterval(function(){
  verifyStatus()
  isPlayback(function(isActive){
    if(!isActive){
      api_client.playbackPlayerMutation(PLATFORM)
    }
  })
 }, 5000);
