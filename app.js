import ApolloClient from 'apollo-client';
import gql from 'graphql-tag';
import shell from 'shelljs';
import {InMemoryCache} from "apollo-cache-inmemory";
import schedule from 'node-schedule';

import * as AbsintheSocket from "@absinthe/socket";
import {createAbsintheSocketLink} from "@absinthe/socket-apollo-link";
import {Socket as PhoenixSocket} from "phoenix-channels";


const TENANT = "dGVzdA=="
// const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address")
const MAC_ADDRESS = "6c:96:cf:db:ab:64"
const GRAPHQL_ENDPOINT = 'ws://localhost:4000/socket';
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
  }
}` , variables: { macAddress: MAC_ADDRESS}}).subscribe({
  next(data){
    let params = data.data.playback
    if(params.error){
      shell.echo(params.error)
    }else{
      shell.exec(`omxplayer ${params.url} --timeout ${params.timeout} -b &`)
    }
  }
})



//subscripcion cuando se executa un comando
apolloClient.subscribe({query:  gql `subscription($macAddress: String!, $cmd: String!){
  executeAction(macAddress: $macAddress, cmd: $cmd)
}` , variables: { macAddress: MAC_ADDRESS, cmd: "restart" }}).subscribe({
  next(data){
    console.log(data)
    execute_cmd(data.data.executeAction)
  }})



function execute_cmd(action){
  switch (action) {
    case "restart":
      console.log(action)
      //shell.exec('sudo reboot now')
      break;
    case "stop":
      shell.exec('killall -s 9 omxplayer')
      shell.exec('killall -s 9 omxplayer.bin')
      break;

    case "updateScript":

        break;
    default:
      console.log("accion no implementada")

  }
}



function updateDevice(apolloClient,mac_address,gql){
  const ip_details = JSON.parse(shell.exec('curl -s http://ip-api.com/json', {silent:true}).stdout)
  apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
    updateDevice(input: $input){
      macAddress,
      name,
      location,
      ip
    }
  }`, variables: { input: {macAddress: mac_address, ip: ip_details.query, location: `${ip_details.countryCode}-${ip_details.city}-${ip_details.regionName}-${ip_details.timezone}`, live_stream_id: 1 }     }})
}


function playbackPlayer(apolloClient,mac_address,slug,platform,gql){
  apolloClient.mutate({mutation: gql `mutation($macAddress: String!,$slug: String!, $platform: String!){
    playbackLiveStream(macAddress: $macAddress,slug: $slug, platform: $platform){
      macAddress
    }
  }`, variables: { macAddress: mac_address, slug: slug,  platform: platform }
})
}



//schedules

//schedule para actualizar o agregar el dispositivo [seg min hr day month dayweek]

//cada 1 hr
// let scheduleUpdateDevice = schedule.scheduleJob('* * 1 * * *',function(){
//   updateDevice(apolloClient,MAC_ADDRESS,gql)
// })
//
// //cada 20 seg
// let schedulePlayback = schedule.scheduleJob('*/20 * * * * *',function(){
//   playbackPlayer(apolloClient,MAC_ADDRESS,SLUG,PLATFORM,gql)
// })
