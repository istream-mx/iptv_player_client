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
    createLog("info",`Comando a ejecutar: ${data.data.executeAction}`)
    execute_cmd(data.data.executeAction)
  }})

function execute_cmd(action){
  switch (action) {
    case "restart":
      sendNotificationMutation("success", "Se reinicio correctamente el dispositivo.")
      createLog("success","Se reinicio correctamente el dispositivo.")
      shell.exec('sudo reboot now' )
      break;

    case "stop":
      shell.exec('sudo killall -s 9 omxplayer')
      shell.exec('sudo killall -s 9 omxplayer.bin')
      break;

    case "updateApp":
      deleteOldScript()
      shell.exec("pm2 deploy ecosystem.config.js production --force",function(code, stdout, stderr) {
        if(code != 0){
          sendNotificationMutation("error", `Error al actualizar ${stderr}`)
          createLog("error", `Error al actualizar ${stderr}`)
          setTimeout(function(){
            //repetir la actualizacion cada 3 minutos si falla
            execute_cmd(action)
          }, 3 * 60 * 1000)
        }
        else {
          console.log("se actualizo correctamente la aplicacion.")
          sendNotificationMutation("success", "Se actualizo correctamente el dispositivo.")
          createLog("success", "Se actualizo correctamente el dispositivo.")
        }
      })
      break;
    case "takeScreenshot":
      if (!shell.which('raspi2png')) {
        shell.echo('Instalando raspi2png');
        shell.exec("curl -sL https://raw.githubusercontent.com/AndrewFromMelbourne/raspi2png/master/installer.sh | bash -")
      }
      shell.exec("raspi2png -p screenshot.png", function(code,stout,stderr){
        let imageUrl = shell.exec(`curl --upload-file ./screenshot.png https://transfer.sh/screenshot.sh` , {silent:true}).stdout
        takeScreenshotMutation(imageUrl)
      })

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

function updateDevice(){
  apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
    updateDevice(input: $input){
      macAddress,
      name,
      location,
      ip
    }
  }`, variables: { input: getPlayerDevice()   }})
}

function verifyStatus(){

  omxp.getStatus(function(err, status){
    if(err) console.log(err)
    status = status == "Playing" ? "active" : "inactive"

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
    }`, variables: { input: {playerDevice: getPlayerDevice(), status: status}     }})
  });
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

function playback(params){
  if(params.error){
    shell.echo(params.error)
    sendNotificationMutation("error", params.error)
    createLog("error", params.error)

  }
  else{
    omxp.getStatus(function(err, status){
      if(status != "Playing") {
        createLog("info", `Url a reproducir ${params.url}`)
        omxp.open(params.url, opts)
      }
      else if(err){
        createLog("error", err)
      }
      else if(status == 'Paused') createLog("info", "Player pausado, conexion lenta.")
      // else sendNotificationMutation("warning", `Ya se encuentra reproduciendo.`)
    })
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

function createLog(type,message){
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
    }
  }`, variables: {macAddress: MAC_ADDRESS ,imageUrl: imageUrl}})
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
    ip_details = JSON.parse(shell.exec(`curl -s ${SECONDARY_PUBLIC_IP_SERVICE}`, {silent:true}).stdout)
    return {
      macAddress: MAC_ADDRESS,
      ip: ip_details.ip,
      location: `${ip_details.country}-${ip_details.city}-${ip_details.region}`
    }
  }

}
function getInfo(){
  let mPosition = ""
  let mStatus = ""
  let mError = ""
  omxp.getPosition(function(err, position){
    mPosition = position
    mError = err
  })
  omxp.getStatus(function(err, status){
    mError += err
    mStatus = status
  })
  createLog("info", `Status: ${mStatus}, position: ${mPosition}, Error: ${mError}`)
}

//para agregar dispositivo al iniciar el script
updateDevice()
playbackPlayerMutation()
omxp.on('finish', function() {
  console.log("se finalizo la transmision ")
  // sendNotificationMutation('info', 'Se detuvo la reproduccion.')
  createLog("info", 'se detuvo la reproduccion')
  verifyStatus()
  playbackPlayerMutation()
});

//schedules

//schedule para actualizar o agregar el dispositivo [seg min hr day month dayweek]

//cada 30 min
let scheduleUpdateDevice = schedule.scheduleJob('0 */30 * * * *',function(){
  updateDevice()
})
//cada 20 seg
let scheduleStatus = schedule.scheduleJob('*/5 * * * * *',function(){
  verifyStatus()
})
//cada 20 seg
let loginfo = schedule.scheduleJob('*/5 * * * * *',function(){
  // getInfo()
  playbackPlayerMutation()
})
