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
    'audioOutput': 'both', //  'hdmi' | 'local' | 'both'
    'blackBackground': false, //false | true | default: true
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
    console.log("Se ejecuto el comando: ", data.executeCmd.action)
    execute_cmd(data.data.executeAction)
  }})


// apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
//     verifyStatus(macAddress: $macAddress){
//       playerDevice{
//         macAddress
//         ip
//         location
//         liveStreamId
//       }
//       status
//         }
//       }` , variables: { macAddress: MAC_ADDRESS }}).subscribe({
//         next(data){
//           let status = data.data.verifyStatus.status
//           console.log("status",data.data.verifyStatus.status)
//           if()
//           playbackPlayer()
//         }})



function execute_cmd(action){
  switch (action) {
    case "restart":
      sendNotification("succes", "Se reinicio correctamente el dispositivo.")
      shell.exec('sudo reboot now' )
      break;

    case "stop":
      shell.exec('sudo killall -s 9 omxplayer')
      shell.exec('sudo killall -s 9 omxplayer.bin')
      sendNotification("success", "Se detuvo correctamente la reproduccion del contenido.")
      break;

    case "updateApp":
      shell.exec("pm2 deploy ecosystem.config.js production --force",function(code, stdout, stderr) {
        if(code != 0){
          sendNotification("error", `Error al actualizar ${stderr}`)
          setTimeout(function(){
            //repetir la actualizacion cada 3 minutos si falla
            execute_cmd(action)
          }, 3 * 60 * 1000)
        }
        else sendNotification("success", "Se actualizo correctamente el dispositivo.")
      })
      break;

    default:
      shell.echo("action not implemented")
  }
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
    //let status = isPlayback() ? "active" : "inactive"
    if(err) console.log(err)
    console.log("getStatus: ", status)
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


function playbackPlayer(){
  if(!isPlayback()){
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

}

function playback(params){
  if(params.error){
    shell.echo(params.error)
    sendNotification("error", params.error)
  }else{
    if(!isPlayback()) {
      console.log("Reproduciendo",params.url)
      //let child = shell.exec(`omxplayer ${params.url} --timeout ${params.timeout} --vol 600 -b &`, {async:true})
      //child.stdout.on('data', function(data) {
        //sendNotification("error",`No se puede reproducir el live stream ${params.url}`)
    //  });
      omxp.open(params.url, opts)
      omxp.on('changeStatus', function(status) {
        console.log('Status', status.status);
      });

    }
    else {
      shell.echo("Ya se encuentra reproduciendo el contenido.")
      //sendNotification("success","Ya se encuentra reproduciendo el contenido.")
    }
  }
}

function sendNotification(type,message){
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

function isPlayback(){
  let process = shell.exec('ps -A | grep -c omxplayer',{ silent: true }).stdout.replace(/\n/g, '')
  let isPlayback = process != 0 ? true : false
  // console.log(status)

  // let isPlayback = status == 'Playing' ? true : false
  return isPlayback
}



function getPlayerDevice(){
  const ip_details = JSON.parse(shell.exec(`curl -s ${PUBLIC_IP_SERVICE}`, {silent:true}).stdout)
  return {
    macAddress: MAC_ADDRESS,
    ip: ip_details.query,
    location: `${ip_details.countryCode}-${ip_details.city}-${ip_details.regionName}-${ip_details.timezone}`
  }
}

//para agregar dispositivo al iniciar el script
updateDevice()
playbackPlayer()
omxp.on('finish', function() {
  console.log("se finalizo la transmision ")
  playbackPlayer()
});

//schedules

//schedule para actualizar o agregar el dispositivo [seg min hr day month dayweek]

//cada 30 min
let scheduleUpdateDevice = schedule.scheduleJob('0 */30 * * * *',function(){
  updateDevice()
})
//
// //cada 20 seg
// let schedulePlayback = schedule.scheduleJob('*/20 * * * * *',function(){
//   playbackPlayer()
// })
//cada 20 seg
let scheduleStatus = schedule.scheduleJob('*/15 * * * * *',function(){
  verifyStatus()
})
