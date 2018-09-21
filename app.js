import ApolloClient from 'apollo-client';
import gql from 'graphql-tag';
import shell from 'shelljs';
import {InMemoryCache} from "apollo-cache-inmemory";
import schedule from 'node-schedule';

import * as AbsintheSocket from "@absinthe/socket";
import {createAbsintheSocketLink} from "@absinthe/socket-apollo-link";
import {Socket as PhoenixSocket} from "phoenix-channels";
import omxp from 'omxplayer-controll';



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
//const MAC_ADDRESS = "b8:27:eb:ff:8a:67"
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT
const PLATFORM = process.env.PLATFORM
const PUBLIC_IP_SERVICE = process.env.PUBLIC_IP_SERVICE
const SECONDARY_PUBLIC_IP_SERVICE = process.env.SECONDARY_PUBLIC_IP_SERVICE

let link = createAbsintheSocketLink(AbsintheSocket.create(
  new PhoenixSocket(GRAPHQL_ENDPOINT, {params: {tenant: TENANT }})
));

const apolloClient = new ApolloClient({
  link: link,
  cache: new InMemoryCache()
});

subscriptions()
playbackPlayerMutation()
updateDeviceMutation()


function subscriptions(){
  //subscripcion para reproducir
  apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
    playback(macAddress: $macAddress){
      mac_address
      error
      url
      timeOut
    }
  }` , variables: { macAddress: MAC_ADDRESS}}).subscribe({
    next(data){
      let params = data.data.playback
      playback(params)
    }
  })

  //subscripcion cuando se executa un comando
  apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
    executeAction(macAddress: $macAddress)
  }` , variables: { macAddress: MAC_ADDRESS}}).subscribe({
    next(data){
      createLogMutation("info",`Comando a ejecutar: ${data.data.executeAction}`)
      execute_cmd(data.data.executeAction)
    }})
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
      deleteOldScript()
      update()
      break;

    case "takeScreenshot":
      screenShoot()
      break;

    default:
      shell.echo("action not implemented")
      sendNotificationMutation("error", "Accion no implementada")
  }
}

function deleteOldScript(){
  shell.exec("sudo rm -rf /home/pi/Documents/scripts")
  shell.exec("sudo rm -rf /etc/init.d/player.sh")
  shell.exec("sudo  sed -i '/public_ip/d' /var/spool/cron/crontabs/root")
  shell.exec("sudo sed -i '/watch/d' /etc/rc.local")
}

function restart(){
  sendNotificationMutation("success", "Se reinicio correctamente el dispositivo.")
  createLogMutation("success","Se reinicio correctamente el dispositivo.")
  shell.exec('sudo reboot now' )
}

function update(){
  shell.exec("rm -rf /home/pi/Documents/production/source/.git/index.lock")
  shell.exec("pm2 deploy ecosystem.config.js production --force",function(code, stdout, stderr) {
    if(code != 0){
      sendNotificationMutation("error", `Error al actualizar ${stderr}`)
      createLogMutation("error", `Error al actualizar ${stderr}`)
    }
    else {
      console.log("se actualizo correctamente la aplicacion.")
      sendNotificationMutation("success", "Se actualizo correctamente el dispositivo.")
      createLogMutation("success", "Se actualizo correctamente el dispositivo.")
    }
  })
}

function screenShoot(){
  if (!shell.which('raspi2png')) {
    shell.echo('Instalando raspi2png');
    shell.exec("curl -sL https://raw.githubusercontent.com/AndrewFromMelbourne/raspi2png/master/installer.sh | bash -")
  }
  shell.exec("raspi2png -p screenshot.png", function(code,stout,stderr){
    let imageUrl = shell.exec(`curl --upload-file ./screenshot.png https://transfer.sh/screenshot.sh` , {silent:true}).stdout
    takeScreenshotMutation(imageUrl)
  })
}

function verifyStatus(){
  if(isPlayback()){
    statusMutation("active")
  }
  else {
    statusMutation("inactive")
  }
}


function playback(params){
  console.log("playback funtion")
  if(params.error){
    shell.echo(params.error)
    sendNotificationMutation("error", params.error)
    createLogMutation("error", params.error)
  }
  else{
    omxp.open(params.url,opts)
    createLogMutation("info", `url a reproducir: ${params.url}`)

  }
}

function sendNotificationMutation(type,message){
  apolloClient.mutate({mutation: gql `mutation($input: InputDeviceNotification){
    notificationMessage(input: $input){
      type
  		message
  		playerDevice{
  			macAddress
  			ip
  			location
  			liveStreamId
  		}
    }
  }`, variables: {input: {playerDevice: getPlayerDevice(), type: type, message: message }}})
}

function createLogMutation(type,message){
  apolloClient.mutate({mutation: gql `mutation($macAddress: String, $type: String, $message: String){
    createLog(macAddress: $macAddress, type: $type, message: $message){
      type
  		message
      macAddress

    }
  }`, variables: {macAddress: MAC_ADDRESS ,type: type, message: message }})
}

function takeScreenshotMutation(imageUrl){
  apolloClient.mutate({mutation: gql `mutation($macAddress: String, $imageUrl: String){
    take_screenshot(macAddress: $macAddress, imageUrl: $imageUrl){
      macAddress
      imageUrl
      playerDevice{
        name
        macAddress
        crc
        location
      }
    }
  }`, variables: {macAddress: MAC_ADDRESS ,imageUrl: imageUrl}})
}


function updateDeviceMutation(){
  apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
    updateDevice(input: $input){
      macAddress,
      name,
      location,
      ip
    }
  }`, variables: { input: getPlayerDevice()   }})
}

function playbackPlayerMutation(){
  apolloClient.mutate({mutation: gql `mutation($macAddress: String!,$platform: String!){
      playbackLiveStream(macAddress: $macAddress, platform: $platform){
        macAddress
        url
        timeOut
        error
      }
    }`, variables: { macAddress: MAC_ADDRESS, platform: PLATFORM }
  })
}

function statusMutation(status){
  apolloClient.mutate({mutation: gql `mutation($input: InputDeviceStatus!){
    status(input: $input){
      status
      playerDevice{
        macAddress
        ip
        location
        liveStreamId
      }
    }
  }`, variables: { input: {playerDevice: {macAddress: MAC_ADDRESS}, status: status}     }})
}

function getPlayerDevice(){
  let ip_details ={}
  try {
    ip_details = JSON.parse(shell.exec(`curl -s ${PUBLIC_IP_SERVICE}`, {silent:true}).stdout)
    return {
      macAddress: MAC_ADDRESS,
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

function isPlayback(){
  let isPlayback = false
  let process = shell.exec('ps -A | grep -c omxplayer').stdout.replace(/\n/g, '')
  if(process > 0) isPlayback = true
  // try {
  //   omxp.getStatus((err,status) => {
  //     if(status === "Playing") isPlayback = true
  //
  //   })
  // } catch (err) {
  //
  // }
  console.log(isPlayback)
  return isPlayback
}
omxp.on('finish', function() {
  console.log("se finalizo la transmision ")
  // sendNotificationMutation('info', 'Se detuvo la reproduccion.')
  createLogMutation("info", 'se detuvo la reproduccion')
  verifyStatus()
  playbackPlayerMutation()
});
// omxp.on("changeStatus", function(info){
//   let status = info.status != "Playing" ? "inactive" : "active"
//   console.log(status)
//   statusMutation(status)
//   if(info.status != "Playing"){
//     console.log("iniciando player")
//     playbackPlayerMutation()
//   }
// })

setInterval(function(){ updateDeviceMutation(); }, 20 * 60000);// cada 10 minutos
setInterval(function(){ shell.exec("pm2 restart iptv-client") }, 6 * 60 * 60000)// cada 6 hrs
// setInterval(function(){ verifyStatus() }, 5000);
setInterval(function(){
  verifyStatus()
  if(!isPlayback()){
    console.log("iniciando player")
    playbackPlayerMutation()
  }
 }, 5000);
