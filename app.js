import ApolloClient from 'apollo-client';
import gql from 'graphql-tag';
import shell from 'shelljs';
import {InMemoryCache} from "apollo-cache-inmemory";
import schedule from 'node-schedule';

import * as AbsintheSocket from "@absinthe/socket";
import {createAbsintheSocketLink} from "@absinthe/socket-apollo-link";
import {Socket as PhoenixSocket} from "phoenix-channels";


const TENANT = "dGVzdA=="
//const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address").replace(/\n/g, '')
const MAC_ADDRESS = "b8:27:eb:95:3c:c2"
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT
const SLUG = process.env.SLUG
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
    execute_cmd(data.data.executeAction)
  }})


apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
    verifyStatus(macAddress: $macAddress){
      playerDevice{
        macAddress
        ip
        location
        liveStreamId
      }
      status
        }
      }` , variables: { macAddress: MAC_ADDRESS }}).subscribe({
        next(data){
          shell.echo(data)
        }})



function execute_cmd(action){
  switch (action) {
    case "restart":
      shell.exec('sudo reboot now' )
      break;
    case "stop":
      shell.exec('sudo killall -s 9 omxplayer')
      shell.exec('sudo killall -s 9 omxplayer.bin')
      break;
    case "updateApp":
      shell.exec("pm2 deploy ecosystem.config.js production --force",function(code, stdout, stderr) {
        if(code != 0){
          sendError("deploy", `Error al actualizar ${stderr}`)
        }
      })
      break;
    default:
      shell.echo("action not implemented")
      sendError("action", "action not implemented")
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
  let status = isPlayback() ? "Reproduciendo" : "No Reproduciendo"

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
}


function playbackPlayer(){
  if(!isPlayback()){
    apolloClient.mutate({mutation: gql `mutation($macAddress: String!,$slug: String!, $platform: String!){
      playbackLiveStream(macAddress: $macAddress,slug: $slug, platform: $platform){
        macAddress
        url
        timeOut
        error
      }
    }`, variables: { macAddress: MAC_ADDRESS, slug: SLUG,  platform: PLATFORM }
  })
  }

}

function playback(params){
  if(params.error){
    shell.echo(params.error)
    sendError("Playback", params.error)
  }else{
    // let process = shell.exec('ps -A | grep -c omxplayer',{ silent: true }).stdout.replace(/\n/g, '')
    if(!isPlayback()) {
      shell.echo("iniciando reproduccion...")
      let child = shell.exec(`omxplayer ${params.url} --timeout ${params.timeout} -b &`, {async:true})
      child.stdout.on('data', function(data) {
        sendError("Playback",`No se puede reproducir el live stream ${params.url}`)
      });
    }
    else shell.echo("ya esta inicializado el player")
  }
}

function sendError(type,message){
  apolloClient.mutate({mutation: gql `mutation($input: InputDeviceError){
    errorHandler(input: $input){
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
  return isPlayback
}



function getPlayerDevice(){
  console.log(PUBLIC_IP_SERVICE)
  const ip_details = JSON.parse(shell.exec(`curl -s ${PUBLIC_IP_SERVICE}`, {silent:true}).stdout)
  return {
    macAddress: MAC_ADDRESS,
    ip: ip_details.query,
    location: `${ip_details.countryCode}-${ip_details.city}-${ip_details.regionName}-${ip_details.timezone}`,
    live_stream_id: 1
  }
}


//schedules

//schedule para actualizar o agregar el dispositivo [seg min hr day month dayweek]

//cada 1 hr
let scheduleUpdateDevice = schedule.scheduleJob('* */1 * * *',function(){
  updateDevice()
})
//
// //cada 20 seg
let schedulePlayback = schedule.scheduleJob('*/20 * * * * *',function(){
  playbackPlayer()
})
//cada 20 seg
let scheduleStatus = schedule.scheduleJob('*/20 * * * * *',function(){
  verifyStatus()
})
