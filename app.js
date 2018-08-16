import ApolloClient from 'apollo-client';
import gql from 'graphql-tag';
import shell from 'shelljs';
import {InMemoryCache} from "apollo-cache-inmemory";
import schedule from 'node-schedule';

import * as AbsintheSocket from "@absinthe/socket";
import {createAbsintheSocketLink} from "@absinthe/socket-apollo-link";
import {Socket as PhoenixSocket} from "phoenix-channels";


const TENANT = "dGVzdA=="
const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address").replace(/\n/g, '')
//const MAC_ADDRESS = "6c:96:cf:db:ab:64"
const GRAPHQL_ENDPOINT = 'ws://192.168.50.114:4000/socket';
const SLUG = "canal6"
const PLATFORM = "raspberry"

let link = createAbsintheSocketLink(AbsintheSocket.create(
  new PhoenixSocket(GRAPHQL_ENDPOINT, {params: {tenant: TENANT }})
));


const apolloClient = new ApolloClient({
  link: link,
  cache: new InMemoryCache()
});

//subscripcion cuando se agrega  o actualiza el dispositivo
apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
  playerLoaded(macAddress: $macAddress){
    macAddress
    name
    live_stream_id
  }
}` , variables: { macAddress: MAC_ADDRESS}}).subscribe({
  next(data){
    let device = data.data.playerLoaded
    console.log(data)
  }
})

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
    console.log(data)
    let params = data.data.playback
    if(params.error){
      shell.echo(params.error)
    }else{
      console.log(shell.exec(`omxplayer ${params.url} --timeout ${params.timeout} -b &`))
    }
  }
})



//subscripcion cuando se executa un comando
apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
  executeAction(macAddress: $macAddress)
}` , variables: { macAddress: MAC_ADDRESS}}).subscribe({
  next(data){
    console.log(data)
    execute_cmd(data.data.executeAction)
  }})


apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
    errorHandler(macAddress: $macAddress){
      message
      type
      macAddress
    }
  }` , variables: { macAddress: MAC_ADDRESS }}).subscribe({
    next(data){
      console.log(data)
    }})

apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
    verifyStatus(macAddress: $macAddress){
      macAddress
      status
      error {
        type
        message
      }
        }
      }` , variables: { macAddress: MAC_ADDRESS }}).subscribe({
        next(data){
          console.log(data)
        }})



function execute_cmd(action){
  switch (action) {
    case "restart":
      console.log(action)
      //shell.exec('sudo reboot now' )
      break;
    case "stop":
      shell.exec('killall -s 9 omxplayer')
      shell.exec('killall -s 9 omxplayer.bin')
      break;

    case "updateScript":
        updateScript()
        break;
    default:
      console.log("accion no implementada")

  }
}



function updateDevice(){
  const ip_details = JSON.parse(shell.exec('curl -s http://ip-api.com/json', {silent:true}).stdout)
  apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
    updateDevice(input: $input){
      macAddress,
      name,
      location,
      ip
    }
  }`, variables: { input: {macAddress: MAC_ADDRESS, ip: ip_details.query, location: `${ip_details.countryCode}-${ip_details.city}-${ip_details.regionName}-${ip_details.timezone}`, live_stream_id: 1 }     }})
}

function verifyStatus(){
  apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
    updateDevice(input: $input){
      macAddress
      status
    }
  }`, variables: { input: {macAddress: MAC_ADDRESS}     }})
}


function playbackPlayer(){
  apolloClient.mutate({mutation: gql `mutation($macAddress: String!,$slug: String!, $platform: String!){
    playbackLiveStream(macAddress: $macAddress,slug: $slug, platform: $platform){
      macAddress
    }
  }`, variables: { macAddress: MAC_ADDRESS, slug: SLUG,  platform: PLATFORM }
})
}

function sendError(type,message){
  apolloClient.mutate({mutation: gql `mutation($macAddress: String, $type: String, $message: String){
    errorHandler(macAddress: $macAddress, type: $type, message: $message){
      type
      message
      macAddress
    }
  }`, variables: {macAddress: MAC_ADDRESS, type: type, message: message }})
}

sendError("test","test")

function updateScript(){
  if (!shell.which('git')) {
    shell.exec('sudo apt-get update')
    shell.exe('sudo apt-get install git')
  }
  if (!shell.which('node')) {
    shell.exec('sudo apt-get update')
    shell.exe('sudo apt-get install nodejs')
  }
  console.log("updating...")
  let updateOut = shell.exec('git pull origin')
  if(updateOut.code != 0){
    updateOut.stderr
  }else{
    shell.exec('npm install')
    //shell.exit('sudo reboot now')
    shell.exit(1)
  }
}


//schedules

//schedule para actualizar o agregar el dispositivo [seg min hr day month dayweek]

//cada 1 hr
// let scheduleUpdateDevice = schedule.scheduleJob('* */1 * * *',function(){
//   updateDevice()
// })
//
// //cada 20 seg
// let schedulePlayback = schedule.scheduleJob('*/20 * * * * *',function(){
//   playbackPlayer()
// })
