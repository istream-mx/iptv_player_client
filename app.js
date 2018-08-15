import ApolloClient from 'apollo-client';
import gql from 'graphql-tag';
import shell from 'shelljs';
import {InMemoryCache} from "apollo-cache-inmemory";

import * as AbsintheSocket from "@absinthe/socket";
import {createAbsintheSocketLink} from "@absinthe/socket-apollo-link";
import {Socket as PhoenixSocket} from "phoenix-channels";


const TENANT = "dGVzdA=="
// const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address")
const MAC_ADDRESS = "6c:96:cf:db:ab:64"
const IP_DETAILS = JSON.parse(shell.exec('curl -s http://ip-api.com/json', {silent:true}).stdout)
const GRAPHQL_ENDPOINT = 'ws://localhost:4000/socket';

let link = createAbsintheSocketLink(AbsintheSocket.create(
  new PhoenixSocket(GRAPHQL_ENDPOINT, {params: {tenant: TENANT }})
));


const apolloClient = new ApolloClient({
  link: link,
  cache: new InMemoryCache()
});


apolloClient.subscribe({query:  gql `subscription($macAddress: String!, $cmd: String!){
  changeDeviceState(macAddress: $macAddress, cmd: $cmd)
}` , variables: { macAddress: MAC_ADDRESS, cmd: "restart" }}).subscribe({
  next(data){
    shell.echo('Error: Git commit failed');
    console.log(data)
  }
})




apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
  updateDevice(input: $input){
    macAddress,
    name,
    location,
    ip
  }
}`, variables: { input: {macAddress: MAC_ADDRESS, ip: IP_DETAILS.query, location: `${IP_DETAILS.countryCode}-${IP_DETAILS.city}-${IP_DETAILS.regionName}-${IP_DETAILS.timezone}`, live_stream_id: 1 }     }})
